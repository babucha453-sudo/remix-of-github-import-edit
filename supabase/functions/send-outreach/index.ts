import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const OutreachSchema = z.object({
  action: z.enum(['send-single', 'run-campaign', 'get-stats', 'send-test', 'send-bulk']),
  messageId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  // For test emails - allow empty string and transform to undefined
  testEmail: z.string().optional().transform(val => val && val.trim() ? val.trim() : undefined),
  // templateId can be "default" or a UUID
  templateId: z.string().optional(),
  // For bulk sending
  targetFilter: z.object({
    claim_status: z.enum(['claimed', 'unclaimed', 'all']).optional(),
    source: z.string().optional(),
    has_email: z.boolean().optional(),
  }).optional(),
}).refine(
  (data) => {
    // If action is send-test, testEmail must be a valid email
    if (data.action === 'send-test' && data.testEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(data.testEmail);
    }
    return true;
  },
  { message: "Valid email is required for send-test action", path: ["testEmail"] }
);

interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  enabled: boolean;
}

async function getSmtpSettings(supabase: any): Promise<SMTPSettings | null> {
  const { data } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'smtp')
    .single();
  
  if (!data?.value) return null;
  
  const settings = data.value as unknown as SMTPSettings;
  if (!settings.enabled || !settings.host || !settings.username || !settings.password) {
    return null;
  }
  
  return settings;
}

async function sendEmailViaSMTP(
  settings: SMTPSettings,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: settings.host,
        port: settings.port,
        tls: true,
        auth: {
          username: settings.username,
          password: settings.password,
        },
      },
    });

    await client.send({
      from: `${settings.from_name} <${settings.from_email}>`,
      to: to,
      subject: subject,
      content: "Please view this email in an HTML-capable client.",
      html: html,
    });

    await client.close();
    return { success: true };
  } catch (error) {
    console.error('SMTP send error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'SMTP send failed' 
    };
  }
}

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
      console.error('Outreach: No authorization header');
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
      console.error('Outreach: Invalid authentication', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only admins can use outreach
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = roles?.some(r => ['super_admin', 'district_manager'].includes(r.role as string));
    if (!isAdmin) {
      console.error(`Outreach: Unauthorized access attempt by user ${user.id}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get SMTP settings
    const smtpSettings = await getSmtpSettings(supabase);
    
    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = OutreachSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error('Outreach: Input validation failed', validationResult.error.issues);
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
    console.log(`Outreach action: ${action} by user: ${user.id}`);

    switch (action) {
      case 'send-test': {
        if (!smtpSettings) {
          return new Response(
            JSON.stringify({ success: false, error: 'SMTP not configured. Please configure SMTP settings in Settings > Email tab.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { testEmail, templateId } = params;
        
        if (!testEmail) {
          return new Response(
            JSON.stringify({ success: false, error: 'Test email address is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let htmlContent = '';
        let subject = 'Test Email from AppointPanda';

        if (templateId) {
          const { data: template } = await supabase
            .from('email_templates')
            .select('*')
            .eq('id', templateId)
            .single();
          
          if (template) {
            htmlContent = template.html_content;
            subject = template.subject;
          }
        }

        if (!htmlContent) {
          // Default test email template
          htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">🎉 SMTP Test Successful!</h1>
                </div>
                <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                    Congratulations! Your SMTP configuration is working correctly. This test email confirms that:
                  </p>
                  <ul style="font-size: 14px; color: #6b7280; line-height: 2;">
                    <li>✅ SMTP connection established</li>
                    <li>✅ Authentication successful</li>
                    <li>✅ Email delivery working</li>
                  </ul>
                  <div style="margin-top: 30px; padding: 20px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                    <p style="margin: 0; font-size: 14px; color: #0369a1;">
                      <strong>SMTP Host:</strong> ${smtpSettings.host}<br>
                      <strong>From:</strong> ${smtpSettings.from_name} &lt;${smtpSettings.from_email}&gt;
                    </p>
                  </div>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                  <p style="font-size: 12px; color: #9ca3af;">
                    Sent from AppointPanda • Powered by your SMTP server
                  </p>
                </div>
              </div>
            </body>
            </html>
          `;
        }

        // Replace variables with test data
        const testVariables = {
          clinic_name: 'Test Dental Clinic',
          claim_link: 'https://appointpanda.com/claim-profile?test=true',
          unsubscribe_link: 'https://appointpanda.com/unsubscribe?test=true',
          dentist_name: 'Dr. Test User',
          patient_name: 'Test Patient',
        };

        for (const [key, value] of Object.entries(testVariables)) {
          htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
          subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        const result = await sendEmailViaSMTP(smtpSettings, testEmail, subject, htmlContent);
        
        if (!result.success) {
          return new Response(
            JSON.stringify({ success: false, error: result.error }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log the test
        await supabase.from('automation_logs').insert({
          status: 'success',
          details: {
            action: 'send_test_email',
            recipient: testEmail,
            template_id: templateId || 'default',
            user_id: user.id,
          },
        });

        return new Response(
          JSON.stringify({ success: true, message: `Test email sent to ${testEmail}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-single': {
        if (!smtpSettings) {
          return new Response(
            JSON.stringify({ success: false, error: 'SMTP not configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { messageId } = params;
        
        if (!messageId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing messageId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Get message details
        const { data: message, error: msgError } = await supabase
          .from('outreach_messages')
          .select('*, campaign:outreach_campaigns(*, template:email_templates(*))')
          .eq('id', messageId)
          .single();
        
        if (msgError || !message) {
          return new Response(
            JSON.stringify({ success: false, error: 'Message not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const template = message.campaign?.template;
        if (!template) {
          return new Response(
            JSON.stringify({ success: false, error: 'Template not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Get clinic details for variable substitution
        const { data: clinic } = await supabase
          .from('clinics')
          .select('*')
          .eq('id', message.clinic_id)
          .single();
        
        // Replace variables in template
        let htmlContent = template.html_content;
        let subject = message.subject;
        
        const siteUrl = Deno.env.get('SITE_URL') || 'https://appointpanda.com';
        const variables = {
          clinic_name: clinic?.name || 'Your Clinic',
          claim_link: `${siteUrl}/claim-profile?clinic_id=${message.clinic_id}`,
          unsubscribe_link: `${siteUrl}/unsubscribe?email=${encodeURIComponent(message.recipient_email)}`,
        };
        
        for (const [key, value] of Object.entries(variables)) {
          htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
          subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        
        // Send email via SMTP
        const result = await sendEmailViaSMTP(smtpSettings, message.recipient_email, subject, htmlContent);
        
        if (!result.success) {
          // Update message with error
          await supabase
            .from('outreach_messages')
            .update({
              status: 'failed',
              error_message: result.error || 'Email send failed',
            })
            .eq('id', messageId);
          
          return new Response(
            JSON.stringify({ success: false, error: result.error || 'Email send failed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Update message as sent
        await supabase
          .from('outreach_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', messageId);
        
        // Log to automation logs
        await supabase.from('automation_logs').insert({
          status: 'success',
          details: {
            action: 'send_outreach_email',
            message_id: messageId,
            recipient: message.recipient_email,
            user_id: user.id,
          },
        });
        
        return new Response(
          JSON.stringify({ success: true, message_id: messageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'run-campaign': {
        const { campaignId, limit = 50 } = params;
        
        if (!campaignId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing campaignId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Get campaign details
        const { data: campaign, error: campaignError } = await supabase
          .from('outreach_campaigns')
          .select('*, template:email_templates(*)')
          .eq('id', campaignId)
          .single();
        
        if (campaignError || !campaign) {
          return new Response(
            JSON.stringify({ success: false, error: 'Campaign not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!campaign.is_active) {
          return new Response(
            JSON.stringify({ success: false, error: 'Campaign is not active' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Get target clinics based on filter
        const filter = campaign.target_filter || {};
        let clinicsQuery = supabase
          .from('clinics')
          .select('id, name, email')
          .eq('source', filter.source || 'gmb')
          .eq('claim_status', filter.claim_status || 'unclaimed')
          .not('email', 'is', null)
          .limit(limit);
        
        const { data: targetClinics } = await clinicsQuery;
        
        // Filter out clinics that already received max emails
        const clinicIds = targetClinics?.map(c => c.id) || [];
        const { data: existingMessages } = await supabase
          .from('outreach_messages')
          .select('clinic_id')
          .eq('campaign_id', campaignId)
          .in('clinic_id', clinicIds);
        
        const sentCounts = new Map<string, number>();
        existingMessages?.forEach(m => {
          sentCounts.set(m.clinic_id, (sentCounts.get(m.clinic_id) || 0) + 1);
        });
        
        const eligibleClinics = targetClinics?.filter(c => 
          (sentCounts.get(c.id) || 0) < campaign.max_sends_per_clinic
        ) || [];
        
        // Create pending messages
        const newMessages = eligibleClinics.slice(0, campaign.max_sends_per_day).map(clinic => ({
          campaign_id: campaignId,
          clinic_id: clinic.id,
          recipient_email: clinic.email,
          subject: campaign.template?.subject || 'Claim Your Clinic Profile',
          status: 'pending',
        }));
        
        if (newMessages.length > 0) {
          await supabase.from('outreach_messages').insert(newMessages);
        }
        
        // Log campaign run
        await supabase.from('automation_logs').insert({
          status: 'success',
          details: {
            action: 'run_campaign',
            campaign_id: campaignId,
            messages_queued: newMessages.length,
            user_id: user.id,
          },
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            queued: newMessages.length,
            eligible: eligibleClinics.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-bulk': {
        if (!smtpSettings) {
          return new Response(
            JSON.stringify({ success: false, error: 'SMTP not configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { templateId, targetFilter, limit = 10 } = params;
        
        if (!templateId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Template ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get template
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', templateId)
          .single();
        
        if (!template) {
          return new Response(
            JSON.stringify({ success: false, error: 'Template not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Build clinic query based on filter
        let clinicsQuery = supabase
          .from('clinics')
          .select('id, name, email')
          .not('email', 'is', null)
          .limit(limit);

        if (targetFilter?.claim_status && targetFilter.claim_status !== 'all') {
          clinicsQuery = clinicsQuery.eq('claim_status', targetFilter.claim_status);
        }
        if (targetFilter?.source) {
          clinicsQuery = clinicsQuery.eq('source', targetFilter.source);
        }

        const { data: clinics } = await clinicsQuery;

        if (!clinics || clinics.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'No matching clinics found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const siteUrl = Deno.env.get('SITE_URL') || 'https://appointpanda.com';
        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        for (const clinic of clinics) {
          let htmlContent = template.html_content;
          let subject = template.subject;

          const variables = {
            clinic_name: clinic.name || 'Your Clinic',
            claim_link: `${siteUrl}/claim-profile?clinic_id=${clinic.id}`,
            unsubscribe_link: `${siteUrl}/unsubscribe?email=${encodeURIComponent(clinic.email)}`,
          };

          for (const [key, value] of Object.entries(variables)) {
            htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
            subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
          }

          const result = await sendEmailViaSMTP(smtpSettings, clinic.email, subject, htmlContent);
          
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            errors.push(`${clinic.email}: ${result.error}`);
          }

          // Small delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Log bulk send
        await supabase.from('automation_logs').insert({
          status: failCount === 0 ? 'success' : 'partial',
          details: {
            action: 'send_bulk_email',
            template_id: templateId,
            total: clinics.length,
            success: successCount,
            failed: failCount,
            user_id: user.id,
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            total: clinics.length,
            sent: successCount,
            failed: failCount,
            errors: errors.slice(0, 5), // Only return first 5 errors
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-stats': {
        const { campaignId } = params;
        
        if (!campaignId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing campaignId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: stats } = await supabase
          .from('outreach_messages')
          .select('status')
          .eq('campaign_id', campaignId);
        
        const counts = {
          pending: 0,
          sent: 0,
          opened: 0,
          clicked: 0,
          failed: 0,
          bounced: 0,
        };
        
        stats?.forEach(s => {
          if (counts[s.status as keyof typeof counts] !== undefined) {
            counts[s.status as keyof typeof counts]++;
          }
        });
        
        return new Response(
          JSON.stringify({ success: true, stats: counts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Outreach error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
