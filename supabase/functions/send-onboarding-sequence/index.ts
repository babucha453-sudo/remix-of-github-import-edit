import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingSequencePayload {
  dentistId: string;
  clinicId?: string;
  email: string;
  firstName: string;
  clinicName: string;
  sequenceDay?: number;
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

function generateDay0WelcomeEmail(data: { firstName: string; clinicName: string; profileUrl: string; dashboardUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AppointPanda!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0fdf4;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0891b2 100%); border-radius: 16px 16px 0 0; padding: 48px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🐼</div>
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px;">Welcome to AppointPanda!</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">Your journey to more bookings starts here</div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px;">Hello ${data.firstName},</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                Welcome to <strong style="color: #059669;">AppointPanda</strong>! We're thrilled to have <strong>${data.clinicName}</strong> on board.
              </p>
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 32px 0;">
                You've taken the first step toward attracting more patients and streamlining your appointment management. Here's what you need to know to get started:
              </p>
              <div style="background: #ecfdf5; border: 2px solid #6ee7b7; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
                <h3 style="color: #065f46; margin: 0 0 16px 0; font-size: 16px;">🎯 Your First Week Checklist:</h3>
                <ul style="color: #047857; font-size: 14px; margin: 0; padding-left: 20px; line-height: 2;">
                  <li>Complete your profile with photos and services</li>
                  <li>Set up your appointment types and pricing</li>
                  <li>Configure your availability calendar</li>
                  <li>Add payment and contact information</li>
                </ul>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${data.profileUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">Complete Your Profile</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display: inline-block; background: #1e293b; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 14px; text-align: center;">
                Questions? Email us at <a href="mailto:support@appointpanda.com" style="color: #059669;">support@appointpanda.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 24px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">🐼 AppointPanda &copy; ${new Date().getFullYear()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateDay3ReminderEmail(data: { firstName: string; clinicName: string; profileUrl: string; dashboardUrl: string; profileCompletionPercent: number }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your Profile - Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fef3c7;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px 16px 0 0; padding: 48px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px;">Complete Your Profile</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">3 days in - let's finish what you started!</div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px;">Hi ${data.firstName},</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                We noticed you started setting up <strong>${data.clinicName}</strong> on AppointPanda. That's great! But there's still room to make your profile shine.
              </p>
              ${data.profileCompletionPercent < 100 ? `
              <div style="background: #fef9c3; border: 2px solid #fcd34d; border-radius: 12px; padding: 24px; margin-bottom: 28px; text-align: center;">
                <p style="color: #92400e; font-size: 14px; margin: 0 0 12px 0;">Your profile is ${data.profileCompletionPercent}% complete</p>
                <div style="background: #e5e7eb; border-radius: 8px; height: 12px; width: 100%; overflow: hidden;">
                  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); height: 100%; width: ${data.profileCompletionPercent}%;"></div>
                </div>
              </div>
              ` : ''}
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                <strong>To attract more patients, make sure you've added:</strong>
              </p>
              <ul style="color: #475569; font-size: 15px; margin: 0 0 32px 0; padding-left: 24px; line-height: 2;">
                <li>High-quality clinic photos</li>
                <li>Your services and treatments</li>
                <li>Business hours and availability</li>
                <li>Contact information</li>
                <li>A compelling bio/description</li>
              </ul>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${data.profileUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">Finish Your Profile</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display: inline-block; background: #1e293b; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">View Dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 14px; text-align: center;">
                Need help? <a href="mailto:support@appointpanda.com" style="color: #059669;">Contact support</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 24px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">🐼 AppointPanda &copy; ${new Date().getFullYear()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateDay7TipsEmail(data: { firstName: string; clinicName: string; dashboardUrl: string; tips: string[] }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pro Tips for More Bookings</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #e0e7ff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #e0e7ff;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 48px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">💡</div>
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px;">Pro Tips for More Bookings</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">One week in - let's maximize your potential!</div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px;">Hi ${data.firstName},</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                You've been with us for a week now! Here are some expert tips to help <strong>${data.clinicName}</strong> attract more patients:
              </p>
              <div style="margin-bottom: 28px;">
                ${data.tips.map((tip, i) => `
                <div style="background: #f5f3ff; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 16px;">
                  <p style="color: #4338ca; font-size: 15px; margin: 0; font-weight: 600;">${i + 1}. ${tip.title}</p>
                  <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">${tip.description}</p>
                </div>
                `).join('')}
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 14px; text-align: center;">
                Want personalized advice? <a href="mailto:support@appointpanda.com" style="color: #059669;">Talk to our team</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 24px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">🐼 AppointPanda &copy; ${new Date().getFullYear()}</p>
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

    const payload: OnboardingSequencePayload = await req.json();
    const { dentistId, clinicId, email, firstName, clinicName, sequenceDay } = payload;

    console.log(`Processing onboarding sequence for dentist: ${dentistId}, day: ${sequenceDay}`);

    if (!email || !firstName || sequenceDay === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
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

    const profileUrl = clinicId ? `${siteUrl}/clinic/${clinicId}/edit` : `${siteUrl}/dashboard/profile`;
    const dashboardUrl = `${siteUrl}/dashboard`;

    let subject: string;
    let html: string;

    if (sequenceDay === 0) {
      subject = `Welcome to AppointPanda, ${firstName}! 🎉`;
      html = generateDay0WelcomeEmail({ firstName, clinicName: clinicName || 'Your Clinic', profileUrl, dashboardUrl });
    } else if (sequenceDay === 3) {
      subject = `Complete your ${clinicName} profile - 3-day reminder`;
      let profilePercent = 50;
      if (clinicId) {
        const { data: clinic } = await supabase.from('clinics').select('profile_completion').eq('id', clinicId).single();
        profilePercent = clinic?.profile_completion || 50;
      }
      html = generateDay3ReminderEmail({ firstName, clinicName: clinicName || 'Your Clinic', profileUrl, dashboardUrl, profileCompletionPercent: profilePercent });
    } else if (sequenceDay === 7) {
      subject = `${firstName}, 7 tips to get more dental bookings`;
      const tips = [
        { title: 'Showcase your expertise', description: 'Add detailed descriptions of your services and treatments.' },
        { title: 'Add photos', description: 'Listings with photos get 2x more engagement. Show your clinic, team, and facilities.' },
        { title: 'Encourage reviews', description: 'Ask happy patients to leave reviews. Reviews build trust and attract new patients.' },
        { title: 'Keep availability updated', description: 'Accurate availability prevents no-shows and double-bookings.' },
        { title: 'Respond quickly', description: 'Quick responses to inquiries convert more leads into appointments.' },
        { title: 'Use booking links everywhere', description: 'Share your AppointPanda booking link on social media and your website.' },
        { title: 'Check your analytics', description: 'Review your dashboard to see where patients are coming from.' },
      ];
      html = generateDay7TipsEmail({ firstName, clinicName: clinicName || 'Your Clinic', dashboardUrl, tips });
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid sequence day. Use 0, 3, or 7.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending day ${sequenceDay} onboarding email to ${email}`);

    const result = await sendEmailViaResend(resendApiKey, emailSettings!, email, subject, html);

    if (!result.success) {
      console.error(`Day ${sequenceDay} onboarding email send failed:`, result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('email_logs').insert({
      recipient: email,
      subject,
      type: `onboarding_day_${sequenceDay}`,
      status: 'sent',
      dentist_id: dentistId,
      clinic_id: clinicId,
    });

    console.log(`Day ${sequenceDay} onboarding email sent successfully`);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-onboarding-sequence:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});