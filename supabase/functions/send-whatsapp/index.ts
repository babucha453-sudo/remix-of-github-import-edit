import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const SendWhatsAppSchema = z.object({
  action: z.enum(['send-template', 'send-text', 'send-appointment-reminder', 'get-templates']),
  to: z.string().min(1).max(20).optional(),
  message: z.string().min(1).max(4096).optional(),
  templateName: z.string().max(100).optional(),
  templateLanguage: z.string().max(10).optional(),
  components: z.array(z.any()).optional(),
  clinicId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('WhatsApp: No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('WhatsApp: Invalid authentication', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = SendWhatsAppSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error('WhatsApp: Input validation failed', validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid input',
          details: validationResult.error.issues.map(i => i.message)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = validationResult.data;
    console.log(`WhatsApp action: ${action} by user: ${user.id}`);

    // Get WhatsApp Business API settings from environment (not DB for secrets)
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const businessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');

    // Helper function to check authorization
    async function checkClinicAuthorization(clinicId: string, userId: string): Promise<boolean> {
      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const isAdmin = roles?.some(r => ['super_admin', 'district_manager'].includes(r.role as string));
      if (isAdmin) return true;

      // Check if user owns the clinic
      const { data: clinic } = await supabase
        .from('clinics')
        .select('claimed_by')
        .eq('id', clinicId)
        .single();
      
      return clinic?.claimed_by === userId;
    }

    switch (action) {
      case 'send-template': {
        const { to, templateName, templateLanguage = 'en', components, clinicId, patientId } = params;

        if (!to || !templateName || !clinicId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields: to, templateName, clinicId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Authorization check
        const isAuthorized = await checkClinicAuthorization(clinicId, user!.id);
        if (!isAuthorized) {
          console.error(`WhatsApp: Unauthorized access attempt by user ${user.id} for clinic ${clinicId}`);
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized: You do not have access to this clinic' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!accessToken || !phoneNumberId) {
          await supabase.from('clinic_messages').insert({
            clinic_id: clinicId,
            recipient_phone: to,
            message_content: `Template: ${templateName}`,
            channel: 'whatsapp',
            direction: 'outbound',
            status: 'failed',
            error_message: 'WhatsApp API not configured',
            template_type: templateName,
            patient_id: patientId,
          });

          return new Response(
            JSON.stringify({ success: false, error: 'WhatsApp Business API not configured. Please add credentials in Settings.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create message record first
        const { data: msgRecord, error: insertError } = await supabase
          .from('clinic_messages')
          .insert({
            clinic_id: clinicId,
            recipient_phone: to,
            message_content: `Template: ${templateName}`,
            channel: 'whatsapp',
            direction: 'outbound',
            status: 'pending',
            template_type: templateName,
            patient_id: patientId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Send via WhatsApp Business API
        const waUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        
        const messagePayload: Record<string, unknown> = {
          messaging_product: 'whatsapp',
          to: to.replace(/\D/g, ''), // Remove non-digits
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
            ...(components && { components }),
          },
        };

        const waResponse = await fetch(waUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        });

        const waResult = await waResponse.json();

        if (!waResponse.ok) {
          await supabase
            .from('clinic_messages')
            .update({
              status: 'failed',
              error_message: waResult.error?.message || 'WhatsApp send failed',
            })
            .eq('id', msgRecord.id);

          return new Response(
            JSON.stringify({ success: false, error: waResult.error?.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update message as sent
        const waMessageId = waResult.messages?.[0]?.id;
        await supabase
          .from('clinic_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { wa_message_id: waMessageId },
          })
          .eq('id', msgRecord.id);

        console.log(`WhatsApp template sent: ${waMessageId}`);

        return new Response(
          JSON.stringify({ success: true, message_id: msgRecord.id, wa_message_id: waMessageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-text': {
        const { to, message, clinicId, patientId } = params;

        if (!to || !message || !clinicId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields: to, message, clinicId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Authorization check
        const isAuthorized = await checkClinicAuthorization(clinicId, user!.id);
        if (!isAuthorized) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!accessToken || !phoneNumberId) {
          await supabase.from('clinic_messages').insert({
            clinic_id: clinicId,
            recipient_phone: to,
            message_content: message,
            channel: 'whatsapp',
            direction: 'outbound',
            status: 'failed',
            error_message: 'WhatsApp API not configured',
            patient_id: patientId,
          });

          return new Response(
            JSON.stringify({ success: false, error: 'WhatsApp Business API not configured' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create message record
        const { data: msgRecord, error: insertError } = await supabase
          .from('clinic_messages')
          .insert({
            clinic_id: clinicId,
            recipient_phone: to,
            message_content: message,
            channel: 'whatsapp',
            direction: 'outbound',
            status: 'pending',
            patient_id: patientId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Send text message via WhatsApp
        const waUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        
        const messagePayload = {
          messaging_product: 'whatsapp',
          to: to.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        };

        const waResponse = await fetch(waUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        });

        const waResult = await waResponse.json();

        if (!waResponse.ok) {
          await supabase
            .from('clinic_messages')
            .update({
              status: 'failed',
              error_message: waResult.error?.message || 'WhatsApp send failed',
            })
            .eq('id', msgRecord.id);

          return new Response(
            JSON.stringify({ success: false, error: waResult.error?.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const waMessageId = waResult.messages?.[0]?.id;
        await supabase
          .from('clinic_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { wa_message_id: waMessageId },
          })
          .eq('id', msgRecord.id);

        return new Response(
          JSON.stringify({ success: true, message_id: msgRecord.id, wa_message_id: waMessageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-appointment-reminder': {
        const { appointmentId } = params;

        if (!appointmentId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing appointmentId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: appointment } = await supabase
          .from('appointments')
          .select('*, clinic:clinics(id, name, claimed_by)')
          .eq('id', appointmentId)
          .single();

        if (!appointment) {
          return new Response(
            JSON.stringify({ success: false, error: 'Appointment not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Authorization check
        const isAuthorized = await checkClinicAuthorization(appointment.clinic_id, user!.id);
        if (!isAuthorized) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use template message for appointment reminder
        const templateComponents = [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: appointment.patient_name },
              { type: 'text', text: appointment.clinic?.name || 'the clinic' },
              { type: 'text', text: appointment.preferred_date || 'your scheduled date' },
              { type: 'text', text: appointment.preferred_time || 'your scheduled time' },
            ],
          },
        ];

        // Recursive call with auth header
        const sendResult = await fetch(req.url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            action: 'send-template',
            to: appointment.patient_phone,
            templateName: 'appointment_reminder',
            components: templateComponents,
            clinicId: appointment.clinic_id,
          }),
        });

        return sendResult;
      }

      case 'get-templates': {
        // Only admins can view templates
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        const isAdmin = roles?.some(r => ['super_admin', 'district_manager'].includes(r.role as string));
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!accessToken || !businessAccountId) {
          return new Response(
            JSON.stringify({ success: false, error: 'WhatsApp not configured' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const templatesUrl = `https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`;
        
        const templatesResponse = await fetch(templatesUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const templatesResult = await templatesResponse.json();

        return new Response(
          JSON.stringify({ success: true, templates: templatesResult.data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('WhatsApp error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
