import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailPayload {
  dentistId: string;
  clinicId?: string;
  email: string;
  firstName: string;
  clinicName: string;
  claimToken?: string;
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
    return data.value as unknown as EmailSettings;
  }

  return {
    from_email: 'no-reply@appointpanda.com',
    from_name: 'Appoint Panda',
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
    const fromName = (settings.from_name || 'Appoint Panda').trim() || 'Appoint Panda';
    const fromEmail = (settings.from_email || '').trim() || 'no-reply@appointpanda.com';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: cleanHtml,
      }),
    });

    const bodyText = await response.text();
    if (response.ok) {
      return { success: true };
    }

    let message = bodyText;
    try {
      const parsed = JSON.parse(bodyText);
      message = parsed?.message || parsed?.error || bodyText;
    } catch {}

    return {
      success: false,
      error: `Resend API error (${response.status}): ${message}`,
    };
  } catch (error) {
    console.error('Resend send error:', error);
    return { success: false };
  }
}

function generateWelcomeEmailHTML(data: {
  firstName: string;
  clinicName: string;
  profileUrl: string;
  dashboardUrl: string;
  claimToken?: string;
}): string {
  const { firstName, clinicName, profileUrl, dashboardUrl, claimToken } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Welcome to AppointPanda - ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0fdf4; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0891b2 100%); border-radius: 16px 16px 0 0; padding: 48px 32px; text-align: center;">
              <div style="display: inline-block; background: #ffffff; border-radius: 50%; width: 80px; height: 80px; margin-bottom: 20px; line-height: 80px; font-size: 36px;">🐼</div>
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 32px; font-weight: 700;">Welcome to AppointPanda!</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 18px;">Your journey to more bookings starts here</div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">
                Hello ${firstName},
              </h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                Welcome to <strong style="color: #059669;">AppointPanda</strong>! We're thrilled to have <strong>${clinicName}</strong> on board. You've taken the first step toward attracting more patients and streamlining your appointment management.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #6ee7b7; border-radius: 12px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 28px;">
                    <h3 style="color: #065f46; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">🚀 Quick Start Guide - 3 Steps to Success</h3>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 12px 0; vertical-align: top; width: 40px;">
                          <div style="background: #059669; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-weight: 700; font-size: 16px;">1</div>
                        </td>
                        <td style="padding: 12px 0;">
                          <strong style="color: #065f46; font-size: 15px;">Complete Your Profile</strong><br>
                          <span style="color: #047857; font-size: 14px;">Add your services, photos, and credentials to stand out</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; vertical-align: top;">
                          <div style="background: #059669; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-weight: 700; font-size: 16px;">2</div>
                        </td>
                        <td style="padding: 12px 0;">
                          <strong style="color: #065f46; font-size: 15px;">Set Up Your Calendar</strong><br>
                          <span style="color: #047857; font-size: 14px;">Configure your availability and appointment types</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; vertical-align: top;">
                          <div style="background: #059669; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-weight: 700; font-size: 16px;">3</div>
                        </td>
                        <td style="padding: 12px 0;">
                          <strong style="color: #065f46; font-size: 15px;">Start Accepting Bookings</strong><br>
                          <span style="color: #047857; font-size: 14px;">Share your booking link and watch your schedule fill up</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${profileUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                      ✨ Complete Your Profile
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; background: #1e293b; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      📊 Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <h4 style="color: #92400e; margin: 0 0 12px 0; font-size: 15px; font-weight: 600;">💡 Tips for Getting More Bookings</h4>
                    <ul style="color: #78350f; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                      <li>Add high-quality photos of your clinic and team</li>
                      <li>List all your services with detailed descriptions</li>
                      <li>Encourage satisfied patients to leave reviews</li>
                      <li>Keep your availability up-to-date</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                <tr>
                  <td style="padding-top: 20px;">
                    <p style="color: #64748b; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">
                      Need help? We're here for you:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 4px 0;">
                          <a href="mailto:support@appointpanda.com" style="color: #059669; font-size: 14px; text-decoration: none;">✉️ support@appointpanda.com</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <span style="color: #64748b; font-size: 14px;">🌐 Visit our help center for tutorials</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 28px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px 0;">
                🐼 <strong style="color: #ffffff;">AppointPanda</strong> - Smart Dental Appointments
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} AppointPanda. All rights reserved.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WelcomeEmailPayload = await req.json();
    const { dentistId, clinicId, email, firstName, clinicName, claimToken } = payload;

    console.log(`Processing welcome email for dentist: ${dentistId}, clinic: ${clinicId}`);

    if (!email || !firstName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email and firstName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailSettings = await getEmailSettings(supabase);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.appointpanda.com';

    const profileUrl = clinicId 
      ? `${siteUrl}/clinic/${clinicId}/edit`
      : `${siteUrl}/dashboard/profile`;
    const dashboardUrl = `${siteUrl}/dashboard`;

    const subject = `Welcome to AppointPanda, ${firstName}! 🎉`;
    const html = generateWelcomeEmailHTML({
      firstName,
      clinicName: clinicName || 'Your Clinic',
      profileUrl,
      dashboardUrl,
      claimToken,
    });

    console.log(`Sending welcome email to ${email}`);

    const result = await sendEmailViaResend(
      resendApiKey,
      emailSettings!,
      email,
      subject,
      html
    );

    if (!result.success) {
      console.error('Welcome email send failed:', result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('email_logs').insert({
      recipient: email,
      subject,
      type: 'welcome_email',
      status: 'sent',
      dentist_id: dentistId,
      clinic_id: clinicId,
    });

    console.log('Welcome email sent successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-welcome-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});