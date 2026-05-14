import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewRequestPayload {
  appointmentId: string;
  sequenceStep?: number;
}

interface ClinicData {
  id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  google_place_id: string | null;
}

interface AppointmentData {
  id: string;
  clinic_id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  confirmed_date: string | null;
  preferred_date: string | null;
  status: string;
  clinic: ClinicData | null;
}

const DAY_0_MESSAGE = `We hope your recent visit to {clinic} was excellent! Your feedback means the world to us and helps other patients find quality dental care.`;
const DAY_3_MESSAGE = `Hi {name}! Just a friendly reminder - we'd love to hear about your experience at {clinic}. Your review helps others find great dental care!`;
const DAY_7_MESSAGE = `Hi {name}, we noticed you haven't had a chance to share your experience at {clinic} yet. We'd really appreciate your feedback - it only takes a minute!`;

function generateReviewEmailHTML(
  clinicName: string,
  patientName: string,
  appointmentDate: string,
  reviewLink: string,
  googleReviewLink: string | null,
  message: string,
  logoUrl: string | null,
  primaryColor: string,
  sequenceStep: number
): string {
  const stepLabel = sequenceStep === 0 ? 'Initial Feedback' : sequenceStep === 3 ? 'Reminder' : 'Final Reminder';

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
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">⭐ ${stepLabel}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">
                Hello ${patientName}!
              </h2>
              
              <p style="color: #475569; font-size: 14px; margin: 0 0 8px 0;">
                Appointment Date: <strong>${appointmentDate}</strong>
              </p>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 16px 0 28px 0;">
                ${message}
              </p>

              <!-- Star Rating Quick Links -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f0fdfa 0%, #f0f9ff 100%); border: 2px solid #99f6e4; border-radius: 16px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 32px; text-align: center;">
                    <p style="color: #0d9488; font-size: 18px; font-weight: 600; margin: 0 0 24px 0;">
                      How was your experience? Tap a star rating:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="${reviewLink}&rating=5" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 16px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 20px;">
                            ⭐⭐⭐⭐⭐
                          </a>
                          <p style="color: #059669; font-size: 13px; margin: 8px 0 0 0; font-weight: 600;">Excellent!</p>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="${reviewLink}&rating=4" style="display: inline-block; background: linear-gradient(135deg, #34d399 0%, #10b981 100%); color: #ffffff; padding: 16px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 20px;">
                            ⭐⭐⭐⭐
                          </a>
                          <p style="color: #10b981; font-size: 13px; margin: 8px 0 0 0; font-weight: 600;">Very Good</p>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="${reviewLink}&rating=3" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #ffffff; padding: 16px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 20px;">
                            ⭐⭐⭐
                          </a>
                          <p style="color: #f59e0b; font-size: 13px; margin: 8px 0 0 0; font-weight: 600;">Good</p>
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
                    <a href="${googleReviewLink}" target="_blank" style="display: inline-block; background: #4285f4; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      ⭐ Leave a Google Review
                    </a>
                    <p style="color: #64748b; font-size: 13px; margin: 12px 0 0 0;">
                      Your Google review helps others find us
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Platform Review Link -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${reviewLink}" target="_blank" style="display: inline-block; background: ${primaryColor}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Leave a Review on AppointPanda
                    </a>
                  </td>
                </tr>
              </table>

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

function getMessageForStep(step: number, patientName: string, clinicName: string): string {
  switch (step) {
    case 0:
      return DAY_0_MESSAGE.replace('{clinic}', clinicName);
    case 3:
      return DAY_3_MESSAGE.replace('{name}', patientName).replace('{clinic}', clinicName);
    case 7:
      return DAY_7_MESSAGE.replace('{name}', patientName).replace('{clinic}', clinicName);
    default:
      return DAY_0_MESSAGE.replace('{clinic}', clinicName);
  }
}

async function sendReviewEmail(
  supabase: ReturnType<typeof createClient>,
  appointment: AppointmentData,
  step: number
): Promise<{ success: boolean; error?: string; reviewRequestId?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const siteUrl = Deno.env.get('SITE_URL') || 'https://appointpanda.com';

  if (!resendApiKey) {
    return { success: false, error: 'Email service not configured' };
  }

  if (!appointment.patient_email) {
    return { success: false, error: 'No email address available' };
  }

  const clinic = appointment.clinic;
  if (!clinic) {
    return { success: false, error: 'Clinic data not found' };
  }

  const reviewLink = `${siteUrl}/review/${clinic.slug}?appointment_id=${appointment.id}`;
  const googleReviewLink = clinic.google_place_id 
    ? `https://search.google.com/local/writereview?placeid=${clinic.google_place_id}`
    : null;

  const appointmentDate = appointment.confirmed_date || appointment.preferred_date || 'N/A';
  const message = getMessageForStep(step, appointment.patient_name, clinic.name);

  const htmlContent = generateReviewEmailHTML(
    clinic.name,
    appointment.patient_name,
    appointmentDate,
    reviewLink,
    googleReviewLink,
    message,
    clinic.cover_image_url,
    '#0d9488',
    step
  );

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${clinic.name} <no-reply@appointpanda.com>`,
        to: [appointment.patient_email],
        subject: step === 0 
          ? `${appointment.patient_name}, how was your visit to ${clinic.name}?`
          : step === 3
            ? `Reminder: How was your visit to ${clinic.name}?`
            : `Final reminder: Please share your experience at ${clinic.name}`,
        html: htmlContent,
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorBody = await response.text();
      return { success: false, error: `Email failed: ${errorBody}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendReviewSMS(
  supabase: ReturnType<typeof createClient>,
  appointment: AppointmentData,
  step: number
): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const { data: smsSettings } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'sms')
    .maybeSingle();

  const smsConfig = (smsSettings?.value as Record<string, unknown>) || {};
  const twilioAccountSid = smsConfig.account_sid as string;
  const twilioAuthToken = smsConfig.auth_token as string;
  const twilioFromNumber = smsConfig.from_number as string;
  const smsEnabled = smsConfig.enabled as boolean;

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber || !smsEnabled) {
    return { success: false, error: 'SMS service not configured' };
  }

  if (!appointment.patient_phone) {
    return { success: false, error: 'No phone number available' };
  }

  const clinic = appointment.clinic;
  if (!clinic) {
    return { success: false, error: 'Clinic data not found' };
  }

  const siteUrl = Deno.env.get('SITE_URL') || 'https://appointpanda.com';
  const reviewLink = `${siteUrl}/review/${clinic.slug}?appointment_id=${appointment.id}`;

  let message = '';
  if (step === 0) {
    message = `Hi ${appointment.patient_name}! Thanks for visiting ${clinic.name}. We'd love your feedback: ${reviewLink}`;
  } else if (step === 3) {
    message = `Hi ${appointment.patient_name}! Just a reminder - we'd love to hear about your experience at ${clinic.name}: ${reviewLink}`;
  } else {
    message = `Hi ${appointment.patient_name}, please share your experience at ${clinic.name}. It only takes a minute: ${reviewLink}`;
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

  let toPhone = appointment.patient_phone.replace(/\D/g, '');
  if (toPhone.length === 10) {
    toPhone = `+1${toPhone}`;
  } else if (!toPhone.startsWith('+')) {
    toPhone = `+${toPhone}`;
  }

  try {
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toPhone,
        From: twilioFromNumber,
        Body: message,
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorBody = await response.text();
      return { success: false, error: `SMS failed: ${errorBody}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: ReviewRequestPayload = await req.json();
    const { appointmentId, sequenceStep } = payload;

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const step = sequenceStep ?? 0;
    console.log(`Processing review request automation for appointment ${appointmentId}, step ${step}`);

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*, clinic:clinics!appointments_clinic_id_fkey(id, name, slug, cover_image_url, google_place_id)')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (appointment.status !== 'completed') {
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment is not completed yet' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const existingRequest = await supabase
      .from('review_automation_log')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('sequence_step', step)
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({ success: false, error: 'Review request already sent for this step' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const results: { email: { success: boolean; error?: string }; sms: { success: boolean; error?: string } } = {
      email: { success: false },
      sms: { success: false }
    };

    if (appointment.patient_email) {
      results.email = await sendReviewEmail(supabase, appointment, step);
    }

    if (appointment.patient_phone) {
      results.sms = await sendReviewSMS(supabase, appointment, step);
    }

    const overallSuccess = results.email.success || results.sms.success;

    await supabase.from('review_automation_log').insert({
      appointment_id: appointmentId,
      clinic_id: appointment.clinic_id,
      patient_name: appointment.patient_name,
      patient_email: appointment.patient_email,
      patient_phone: appointment.patient_phone,
      sequence_step: step,
      channel: appointment.patient_email ? 'email' : 'sms',
      status: overallSuccess ? 'sent' : 'failed',
      email_sent: results.email.success,
      email_error: results.email.error || null,
      sms_sent: results.sms.success,
      sms_error: results.sms.error || null,
      sent_at: new Date().toISOString(),
    });

    if (!overallSuccess) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send review request', results }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Review request sent successfully for appointment ${appointmentId} at step ${step}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Review request sent successfully',
        results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error('Error in review-request-automation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});