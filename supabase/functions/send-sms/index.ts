import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const SendSMSSchema = z.object({
  action: z.enum(['send', 'send-appointment-reminder', 'send-booking-confirmation', 'check-status']),
  to: z.string().min(1).max(20).optional(),
  message: z.string().min(1).max(1600).optional(),
  clinicId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  templateType: z.string().max(50).optional(),
  appointmentId: z.string().uuid().optional(),
  twilioSid: z.string().max(100).optional(),
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
      console.error('SMS: No authorization header');
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
      console.error('SMS: Invalid authentication', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = SendSMSSchema.safeParse(rawBody);
    if (!validationResult.success) {
      // Log detailed errors server-side only
      console.error('SMS: Input validation failed', validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request. Please check your input and try again.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = validationResult.data;
    console.log(`SMS action: ${action} by user: ${user.id}`);

    // Get SMS settings (only non-sensitive config from DB, secrets from env)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioFromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

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
      case 'send': {
        const { to, message, clinicId, patientId, templateType } = params;

        if (!to || !message || !clinicId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields: to, message, clinicId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Authorization check
        const isAuthorized = await checkClinicAuthorization(clinicId, user!.id);
        if (!isAuthorized) {
          console.error(`SMS: Unauthorized access attempt by user ${user.id} for clinic ${clinicId}`);
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized: You do not have access to this clinic' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
          // Log the message attempt even without API configured
          await supabase.from('clinic_messages').insert({
            clinic_id: clinicId,
            recipient_phone: to,
            message_content: message,
            channel: 'sms',
            direction: 'outbound',
            status: 'failed',
            error_message: 'SMS API not configured',
            template_type: templateType,
            patient_id: patientId,
          });

          return new Response(
            JSON.stringify({ success: false, error: 'SMS API not configured. Please add Twilio credentials in Settings.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create message record first
        const { data: msgRecord, error: insertError } = await supabase
          .from('clinic_messages')
          .insert({
            clinic_id: clinicId,
            recipient_phone: to,
            message_content: message,
            channel: 'sms',
            direction: 'outbound',
            status: 'pending',
            template_type: templateType,
            patient_id: patientId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Send via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: twilioFromNumber,
            Body: message,
          }),
        });

        const twilioResult = await twilioResponse.json();

        if (!twilioResponse.ok) {
          // Update message as failed
          await supabase
            .from('clinic_messages')
            .update({
              status: 'failed',
              error_message: twilioResult.message || 'SMS send failed',
            })
            .eq('id', msgRecord.id);

          return new Response(
            JSON.stringify({ success: false, error: twilioResult.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update message as sent
        await supabase
          .from('clinic_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { twilio_sid: twilioResult.sid },
          })
          .eq('id', msgRecord.id);

        console.log(`SMS sent successfully: ${twilioResult.sid}`);

        return new Response(
          JSON.stringify({ success: true, message_id: msgRecord.id, twilio_sid: twilioResult.sid }),
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

        // Get appointment details
        const { data: appointment, error: apptError } = await supabase
          .from('appointments')
          .select('*, clinic:clinics(id, name, phone, claimed_by)')
          .eq('id', appointmentId)
          .single();

        if (apptError || !appointment) {
          return new Response(
            JSON.stringify({ success: false, error: 'Appointment not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Authorization check for this clinic
        const isAuthorized = await checkClinicAuthorization(appointment.clinic_id, user!.id);
        if (!isAuthorized) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const message = `Hi ${appointment.patient_name}! This is a reminder for your dental appointment at ${appointment.clinic?.name} on ${appointment.preferred_date} at ${appointment.preferred_time}. Reply CONFIRM to confirm or call ${appointment.clinic?.phone || 'us'} to reschedule.`;

        // Recursive call to send with auth header
        const sendResult = await fetch(req.url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            action: 'send',
            to: appointment.patient_phone,
            message,
            clinicId: appointment.clinic_id,
            templateType: 'appointment_reminder',
          }),
        });

        return sendResult;
      }

      case 'send-booking-confirmation': {
        const { appointmentId } = params;

        if (!appointmentId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing appointmentId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: appointment } = await supabase
          .from('appointments')
          .select('*, clinic:clinics(id, name, address, claimed_by)')
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

        const message = `Booking Confirmed! ✅\n\nHi ${appointment.patient_name}, your appointment at ${appointment.clinic?.name} is confirmed for ${appointment.preferred_date} at ${appointment.preferred_time}.\n\nAddress: ${appointment.clinic?.address || 'See clinic for details'}\n\nNeed to change? Reply RESCHEDULE`;

        const sendResult = await fetch(req.url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            action: 'send',
            to: appointment.patient_phone,
            message,
            clinicId: appointment.clinic_id,
            templateType: 'booking_confirmation',
          }),
        });

        return sendResult;
      }

      case 'check-status': {
        const { twilioSid } = params;

        if (!twilioSid) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing twilioSid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!twilioAccountSid || !twilioAuthToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'Twilio not configured' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const statusUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${twilioSid}.json`;
        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        const statusResponse = await fetch(statusUrl, {
          headers: { 'Authorization': `Basic ${twilioAuth}` },
        });

        const statusResult = await statusResponse.json();

        return new Response(
          JSON.stringify({ success: true, status: statusResult.status }),
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
    console.error('SMS error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
