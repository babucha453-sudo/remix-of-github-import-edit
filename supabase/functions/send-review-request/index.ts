import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewRequestPayload {
  clinicId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName: string;
  channel: 'email' | 'sms' | 'whatsapp';
  customMessage?: string;
}

interface ClinicBranding {
  name: string;
  logo?: string;
  primaryColor: string;
  slug: string;
  googlePlaceId?: string;
}

function generateReviewEmailHTML(
  clinicName: string,
  patientName: string,
  reviewLink: string,
  googleReviewLink: string | null,
  customMessage: string | null,
  logoUrl: string | null,
  primaryColor: string
): string {
  const message = customMessage || 
    `We hope your recent visit to ${clinicName} was excellent! Your feedback means the world to us and helps other patients find quality dental care.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Your Experience - ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #0891b2 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${clinicName}" style="max-height: 60px; margin-bottom: 16px;">` : ''}
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">${clinicName}</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">⭐ Share Your Experience</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">
                Hello ${patientName}!
              </h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                ${message}
              </p>

              <!-- Quick Feedback Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f0fdfa 0%, #f0f9ff 100%); border: 2px solid #99f6e4; border-radius: 16px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 32px; text-align: center;">
                    <p style="color: #0d9488; font-size: 18px; font-weight: 600; margin: 0 0 24px 0;">
                      How was your experience?
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 12px;">
                          <a href="${reviewLink}?rating=positive" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 20px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 24px;">
                            👍
                          </a>
                          <p style="color: #059669; font-size: 14px; margin: 12px 0 0 0; font-weight: 600;">Great!</p>
                        </td>
                        <td style="padding: 0 12px;">
                          <a href="${reviewLink}?rating=negative" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 20px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 24px;">
                            👎
                          </a>
                          <p style="color: #d97706; font-size: 14px; margin: 12px 0 0 0; font-weight: 600;">Could be better</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${googleReviewLink ? `
              <!-- Google Review Direct Link -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${googleReviewLink}" style="display: inline-block; background: #4285f4; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      ⭐ Leave a Google Review
                    </a>
                    <p style="color: #64748b; font-size: 13px; margin: 12px 0 0 0;">
                      Your Google review helps others find us
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Alternative Link -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                <tr>
                  <td>
                    <p style="color: #64748b; font-size: 13px; margin: 0;">
                      Or copy and paste this link: <a href="${reviewLink}" style="color: ${primaryColor}; text-decoration: underline;">${reviewLink}</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 28px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">
                Thank you for choosing ${clinicName}
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} All rights reserved
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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Twilio credentials from global_settings table (API Control tab)
    const { data: smsSettings } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'sms')
      .single();

    const { data: whatsappSettings } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'whatsapp')
      .single();

    const smsConfig = (smsSettings?.value as Record<string, unknown>) || {};
    const twilioAccountSid = smsConfig.account_sid as string;
    const twilioAuthToken = smsConfig.auth_token as string;
    const twilioFromNumber = smsConfig.from_number as string;
    const smsEnabled = smsConfig.enabled as boolean;

    const whatsappConfig = (whatsappSettings?.value as Record<string, unknown>) || {};
    const whatsappEnabled = whatsappConfig.enabled as boolean;
    // Use WhatsApp-specific number if configured, otherwise use Twilio Sandbox default
    const whatsappFromNumber = (whatsappConfig.from_number as string) || '+14155238886';

    const payload: ReviewRequestPayload = await req.json();
    const { clinicId, recipientEmail, recipientPhone, recipientName, channel, customMessage } = payload;

    console.log(`Processing review request for ${channel} to ${recipientEmail || recipientPhone}`);

    // Fetch clinic data
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, slug, cover_image_url, google_place_id')
      .eq('id', clinicId)
      .maybeSingle();

    if (clinicError) {
      console.error('Database error fetching clinic:', clinicError);
      throw new Error(`Database error: ${clinicError.message}`);
    }

    if (!clinic) {
      console.error(`Clinic with ID ${clinicId} not found`);
      throw new Error('Clinic not found');
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://appointpanda.com';
    const reviewLink = `${siteUrl}/review/${clinic.slug}`;
    const googleReviewLink = clinic.google_place_id 
      ? `https://search.google.com/local/writereview?placeid=${clinic.google_place_id}`
      : null;

    let success = false;
    let errorMessage = '';

    // Handle Email
    if (channel === 'email') {
      if (!resendApiKey) {
        throw new Error('Email service not configured');
      }
      if (!recipientEmail) {
        throw new Error('Email address required');
      }

      const htmlContent = generateReviewEmailHTML(
        clinic.name,
        recipientName,
        reviewLink,
        googleReviewLink,
        customMessage || null,
        clinic.cover_image_url,
        '#0d9488'
      );

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${clinic.name} <no-reply@appointpanda.com>`,
          to: [recipientEmail],
          subject: `${recipientName}, how was your visit to ${clinic.name}?`,
          html: htmlContent,
        }),
      });

      if (response.ok) {
        success = true;
      } else {
        const errorBody = await response.text();
        console.error('Resend error:', errorBody);
        errorMessage = `Email failed: ${errorBody}`;
      }
    }

    // Handle SMS
    if (channel === 'sms') {
      if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
        throw new Error('SMS service not configured in API Control tab. Please add Twilio credentials.');
      }
      if (!smsEnabled) {
        throw new Error('SMS gateway is disabled in API Control tab');
      }
      if (!recipientPhone) {
        throw new Error('Phone number required');
      }

      const message = customMessage || 
        `Hi ${recipientName}! Thanks for visiting ${clinic.name}. We'd love your feedback: ${reviewLink}`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: recipientPhone,
          From: twilioFromNumber,
          Body: message,
        }),
      });

      if (response.ok) {
        success = true;
      } else {
        const errorBody = await response.text();
        console.error('Twilio SMS error:', errorBody);
        errorMessage = `SMS failed: ${errorBody}`;
      }
    }

    // Handle WhatsApp
    if (channel === 'whatsapp') {
      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error('WhatsApp service not configured in API Control tab. Please add Twilio credentials.');
      }
      if (!whatsappEnabled) {
        throw new Error('WhatsApp is disabled in API Control tab');
      }
      if (!recipientPhone) {
        throw new Error('Phone number required');
      }

      const message = customMessage || 
        `Hi ${recipientName}! 👋\n\nThank you for visiting *${clinic.name}*!\n\nWe'd love to hear about your experience. Please take a moment to share your feedback:\n\n${reviewLink}\n\nThank you! ⭐`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      console.log(`Sending WhatsApp to ${recipientPhone} from ${whatsappFromNumber}`);

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:${recipientPhone}`,
          From: `whatsapp:${whatsappFromNumber}`,
          Body: message,
        }),
      });

      if (response.ok) {
        success = true;
      } else {
        const errorBody = await response.text();
        console.error('Twilio WhatsApp error:', errorBody);
        errorMessage = `WhatsApp failed: ${errorBody}`;
      }
    }

    // Log the request
    await supabase.from('review_requests').insert({
      clinic_id: clinicId,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      channel,
      custom_message: customMessage,
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date().toISOString() : null,
      error_message: errorMessage || null,
    });

    if (!success && errorMessage) {
      throw new Error(errorMessage);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Review request sent successfully' }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: unknown) {
    console.error('Error in send-review-request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});
