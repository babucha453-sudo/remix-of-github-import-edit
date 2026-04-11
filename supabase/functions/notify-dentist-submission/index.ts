import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  submissionId: string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  formName: string;
  clinicId: string;
}

interface EmailSettings {
  from_email: string;
  from_name: string;
}

async function getEmailSettings(supabase: any): Promise<EmailSettings | null> {
  const { data } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'email')
    .single();
  
  if (data?.value) {
    return data.value as EmailSettings;
  }
  
  return {
    from_email: 'no-reply@appointpanda.com',
    from_name: 'AppointPanda'
  };
}

function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n/g, '')
    .replace(/\r/g, '')
    .replace(/\n/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

async function sendEmailViaResend(
  resendApiKey: string,
  settings: EmailSettings,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanHtml = minifyHtml(html);
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${settings.from_name} <${settings.from_email}>`,
        to: [to],
        subject: subject,
        html: cleanHtml,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', response.status, errorData);
      return { success: false, error: `Resend API error: ${response.status}` };
    }

    const result = await response.json();
    console.log('Dentist notification email sent successfully via Resend:', result);
    return { success: true };
  } catch (error) {
    console.error('Resend send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Resend send failed',
    };
  }
}

function generateNotificationEmailHTML(
  clinicName: string,
  formName: string,
  patientName: string | undefined,
  patientEmail: string | undefined,
  patientPhone: string | undefined,
  dashboardUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>New Form Submission</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #0D9488 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">📋 New Form Submission</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">${clinicName}</div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">
                A patient has submitted a form!
              </h2>
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Form Submitted</p>
                    <p style="color: #15803d; font-size: 20px; font-weight: 700; margin: 0;">📄 ${formName}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #f8fafc; border-radius: 12px;">
                    <p style="color: #64748b; font-size: 12px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Patient Details</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      ${patientName ? `
                      <tr>
                        <td style="padding: 4px 0; color: #64748b; font-size: 14px;">Name:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${patientName}</td>
                      </tr>
                      ` : ''}
                      ${patientEmail ? `
                      <tr>
                        <td style="padding: 4px 0; color: #64748b; font-size: 14px;">Email:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${patientEmail}</td>
                      </tr>
                      ` : ''}
                      ${patientPhone ? `
                      <tr>
                        <td style="padding: 4px 0; color: #64748b; font-size: 14px;">Phone:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${patientPhone}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #0D9488 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      View Submission Details
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0; text-align: center;">
                Log in to your dashboard to view the complete submission
              </p>

            </td>
          </tr>

          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 28px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">
                This is an automated notification from AppointPanda
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} AppointPanda. All rights reserved
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotifyRequest = await req.json();
    const {
      submissionId,
      patientName,
      patientEmail,
      patientPhone,
      formName,
      clinicId,
    } = body;

    // Get clinic details and notification settings
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, email, claimed_by')
      .eq('id', clinicId)
      .single();

    if (!clinic) {
      return new Response(
        JSON.stringify({ error: 'Clinic not found' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Get notification settings from clinic_automation_settings
    const { data: automationSettings } = await supabase
      .from('clinic_automation_settings')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    // Check if form submission notifications are enabled
    const notifyFormSubmission = automationSettings?.is_messaging_enabled !== false;
    
    if (!notifyFormSubmission) {
      console.log('Form submission notifications disabled for clinic:', clinicId);
      return new Response(
        JSON.stringify({ success: true, message: 'Notifications disabled' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Determine notification email (clinic email or owner's email)
    let notificationEmail = clinic.email;

    // If no clinic email, try to get the user's email
    if (!notificationEmail && clinic.claimed_by) {
      const { data: authData } = await supabase.auth.admin.getUserById(clinic.claimed_by);
      notificationEmail = authData?.user?.email;
    }

    if (!notificationEmail) {
      console.log('No notification email found for clinic:', clinicId);
      return new Response(
        JSON.stringify({ success: true, message: 'No notification email configured' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if Resend API key is available
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured (RESEND_API_KEY missing)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Get email settings
    const emailSettings = await getEmailSettings(supabase);

    // Generate dashboard URL
    const dashboardUrl = 'https://www.appointpanda.com/dashboard?tab=my-intake-forms';

    // Generate and send email
    const emailHtml = generateNotificationEmailHTML(
      clinic.name,
      formName,
      patientName,
      patientEmail,
      patientPhone,
      dashboardUrl
    );

    const result = await sendEmailViaResend(
      resendApiKey,
      emailSettings!,
      notificationEmail,
      `📋 New Form Submission: ${formName} - ${patientName || 'Patient'}`,
      emailHtml
    );

    if (!result.success) {
      console.error("Failed to send notification email:", result.error);
      return new Response(
        JSON.stringify({ error: result.error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: unknown) {
    console.error("Error sending notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
