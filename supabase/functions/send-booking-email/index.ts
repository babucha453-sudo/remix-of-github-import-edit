import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailPayload {
  appointmentId: string;
  type?: 'new_booking' | 'status_update';
  newStatus?: string;
}

interface EmailSettings {
  from_email: string;
  from_name: string;
}

interface ClinicBranding {
  name: string;
  logo?: string;
  primaryColor: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  slug: string;
}

async function getEmailSettings(supabase: any): Promise<EmailSettings | null> {
  const { data } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'email')
    .single();

  if (data?.value) {
    const settings = data.value as unknown as EmailSettings;
    return settings;
  }

  // Default sender should be on your verified domain.
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

    const send = async () => {
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
      return { ok: response.ok, status: response.status, bodyText };
    };

    console.log(`Sending email via Resend from "${fromEmail}" to "${to}"`);

    const res = await send();
    if (res.ok) {
      return { success: true };
    }

    let message = res.bodyText;
    try {
      const parsed = JSON.parse(res.bodyText);
      message = parsed?.message || parsed?.error || res.bodyText;
    } catch {
      // ignore
    }

    const lower = String(message).toLowerCase();
    const isTestMode =
      res.status === 403 &&
      (lower.includes('only send testing emails') || lower.includes('verify a domain') || lower.includes('testing emails'));

    const isDomainNotVerified =
      res.status === 403 &&
      (lower.includes('domain') && lower.includes('not verified'));

    if (isTestMode) {
      return {
        success: false,
        error:
          'Resend is still treating this API key as test mode. This usually means the RESEND_API_KEY belongs to a different Resend account/team than the one where your domain is verified, OR the "from" address is not on the verified domain. Please confirm the API key and ensure from_email uses @appointpanda.com.',
      };
    }

    if (isDomainNotVerified) {
      return {
        success: false,
        error: `Resend sender domain not verified for from_email="${fromEmail}". Ensure your domain is verified in Resend and that from_email is on that domain.`,
      };
    }

    return {
      success: false,
      error: `Resend API error (${res.status}): ${message}`,
    };
  } catch (error) {
    console.error('Resend send error:', error);
    return {
      success: false,
    };
  }
}

function generateEmailHTML(
  status: string,
  patientName: string,
  clinic: ClinicBranding,
  appointmentDate: string,
  appointmentTime: string,
  treatmentName: string,
  appointmentId: string,
  siteUrl: string,
  manageToken: string,
  mapLink?: string,
  clinicId?: string
): string {
  const primaryColor = clinic.primaryColor || '#0d9488';
  const manageUrl = `${siteUrl}/appointment/${manageToken}`;
  const rescheduleUrl = `${siteUrl}/appointment/${manageToken}?action=reschedule`;
  const cancelUrl = `${siteUrl}/appointment/${manageToken}?action=cancel`;
  const rebookUrl = `${siteUrl}/clinic/${clinic.slug}`;
  const reviewUrl = `${siteUrl}/review/${clinicId || clinic.slug}`;

  const statusConfig: Record<string, { title: string; emoji: string; gradient: string; message: string; showManageActions: boolean; showRebook: boolean }> = {
    pending: {
      title: 'Booking Request Received',
      emoji: '📅',
      gradient: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
      message: `Thank you for your booking request! We have received your appointment request and our team will review and confirm it shortly.`,
      showManageActions: true,
      showRebook: false,
    },
    confirmed: {
      title: 'Appointment Confirmed',
      emoji: '✅',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      message: `Great news! Your appointment has been confirmed. We look forward to seeing you!`,
      showManageActions: true,
      showRebook: false,
    },
    completed: {
      title: 'Thank You for Your Visit',
      emoji: '🙏',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      message: `Thank you for visiting us! We hope you had a wonderful experience. Your oral health is our priority.`,
      showManageActions: false,
      showRebook: true,
    },
    cancelled: {
      title: 'Appointment Cancelled',
      emoji: '❌',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      message: `Your appointment has been cancelled. We understand plans change - feel free to book again whenever you're ready.`,
      showManageActions: false,
      showRebook: true,
    },
    no_show: {
      title: 'We Missed You',
      emoji: '👋',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      message: `We noticed you couldn't make it to your scheduled appointment. We hope everything is okay! You can easily reschedule below.`,
      showManageActions: true,
      showRebook: true,
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${config.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          
          <tr>
            <td style="background: ${config.gradient}; border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              ${clinic.logo ? `<img src="${clinic.logo}" alt="${clinic.name}" style="max-height: 60px; margin-bottom: 16px;">` : ''}
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">${clinic.name}</h1>
              <div style="color: rgba(255,255,255,0.9); font-size: 16px;">${config.emoji} ${config.title}</div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">
                Hello ${patientName},
              </h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.7; margin: 0 0 28px 0;">
                ${config.message}
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdfa; border: 2px solid #99f6e4; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td colspan="2" style="padding-bottom: 16px; border-bottom: 1px solid #99f6e4;">
                          <span style="color: #0d9488; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Appointment Details</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 0 0 0; color: #64748b; font-size: 14px; width: 100px;">Treatment</td>
                        <td style="padding: 14px 0 0 0; color: #1e293b; font-size: 15px; font-weight: 600;">${treatmentName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px;">Date</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 15px; font-weight: 600;">${appointmentDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px;">Time</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 15px; font-weight: 600;">${appointmentTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0 0 0; color: #64748b; font-size: 14px;">Location</td>
                        <td style="padding: 10px 0 0 0; color: #1e293b; font-size: 14px;">${clinic.address ? (mapLink ? `<a href="${mapLink}" style="color:#0d9488; text-decoration:none;">${clinic.address}</a>` : clinic.address) : 'Contact clinic for address'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${config.showManageActions ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center" style="padding: 0 0 12px 0;">
                    <a href="${manageUrl}" style="display: inline-block; background: ${config.gradient}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      View Appointment
                    </a>
                    ${mapLink ? `
                    <span style="display:inline-block; width: 10px;"></span>
                    <a href="${mapLink}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Get Directions
                    </a>
                    ` : ''}
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="${rescheduleUrl}" style="display: inline-block; background: #f1f5f9; color: #475569; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; border: 1px solid #e2e8f0;">
                            🗓️ Reschedule
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="${cancelUrl}" style="display: inline-block; background: #fef2f2; color: #dc2626; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; border: 1px solid #fecaca;">
                            ❌ Cancel
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${status === 'confirmed' ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                      <strong>⏰ Reminder:</strong> Please arrive 10-15 minutes before your scheduled time. Don't forget to bring your insurance card and ID.
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${status === 'completed' ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 28px; text-align: center;">
                    <p style="color: #78350f; font-size: 16px; margin: 0 0 16px 0; font-weight: 500;">
                      We'd love to hear about your experience!
                    </p>
                    <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      ⭐ Leave a Review
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${config.showRebook ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f9ff; border: 2px solid #bae6fd; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="color: #0369a1; font-size: 15px; margin: 0 0 16px 0; font-weight: 500;">
                      Ready to book your next appointment?
                    </p>
                    <a href="${rebookUrl}" style="display: inline-block; background: ${primaryColor}; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      📅 Book New Appointment
                    </a>
                    ${status === 'no_show' ? `
                    <p style="color: #64748b; font-size: 13px; margin: 16px 0 0 0;">
                      Or <a href="${rescheduleUrl}" style="color: ${primaryColor}; text-decoration: underline;">reschedule your missed appointment</a>
                    </p>
                    ` : ''}
                  </td>
                </tr>
              </table>
              ` : ''}

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                <tr>
                  <td style="padding-top: 20px;">
                    <p style="color: #64748b; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">
                      Need help? Contact us:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      ${clinic.phone ? `
                      <tr>
                        <td style="padding: 4px 0;">
                          <a href="tel:${clinic.phone}" style="color: #0d9488; font-size: 14px; text-decoration: none;">📞 ${clinic.phone}</a>
                        </td>
                      </tr>
                      ` : ''}
                      ${clinic.email ? `
                      <tr>
                        <td style="padding: 4px 0;">
                          <a href="mailto:${clinic.email}" style="color: #0d9488; font-size: 14px; text-decoration: none;">✉️ ${clinic.email}</a>
                        </td>
                      </tr>
                      ` : ''}
                      ${clinic.website ? `
                      <tr>
                        <td style="padding: 4px 0;">
                          <a href="${clinic.website}" style="color: #0d9488; font-size: 14px; text-decoration: none;">🌐 Visit Website</a>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 28px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">
                ${clinic.name}${clinic.address ? ` | ${clinic.address}` : ''}
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

function getSubjectLine(status: string, clinicName: string, patientName: string): string {
  const subjects: Record<string, string> = {
    pending: `Booking Request Received - ${patientName}`,
    confirmed: `Appointment Confirmed - ${patientName}`,
    completed: `Thank You for Your Visit - ${patientName}`,
    cancelled: `Appointment Cancelled - ${patientName}`,
    no_show: `We Missed You - ${patientName}`,
  };
  return subjects[status] || `Appointment Update - ${patientName}`;
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

    const payload: EmailPayload = await req.json();
    const { appointmentId, type, newStatus } = payload;

    console.log(`Processing booking email: ${type} for appointment ${appointmentId}, status: ${newStatus}`);

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing appointmentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get appointment with clinic and treatment details
    // Use explicit foreign key reference to avoid ambiguity with original_clinic_id
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select(`
        *,
        clinic:clinics!appointments_clinic_id_fkey(id, name, address, phone, email, website, slug, cover_image_url, google_place_id, claimed_by),
        treatment:treatments(id, name)
      `)
      .eq('id', appointmentId)
      .single();

    if (apptError) {
      console.error('Failed to load appointment for email:', apptError);
      return new Response(
        JSON.stringify({ success: false, error: apptError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!appointment) {
      console.error('Appointment not found:', appointmentId);
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!appointment.patient_email) {
      console.log('No patient email, skipping email send');
      return new Response(
        JSON.stringify({ success: true, message: 'No patient email provided' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a new booking and if the clinic has a paid subscription
    // Only paid clinics get immediate email notifications for new bookings
    const clinic = appointment.clinic;
    if (type === 'new_booking' && clinic?.id) {
      const { data: subscription } = await supabase
        .from('clinic_subscriptions')
        .select('id, status')
        .eq('clinic_id', clinic.id)
        .eq('status', 'active')
        .maybeSingle();

      const isPaidClinic = !!subscription;
      console.log(`Clinic ${clinic.id} paid status: ${isPaidClinic}`);

      if (!isPaidClinic) {
        // For free tier clinics, still send email to patient but log that dentist won't get notified
        console.log('Free tier clinic - booking stored but dentist email notification skipped');
        // Mark appointment as unassigned for admin routing
        await supabase
          .from('appointments')
          .update({ is_assigned: false })
          .eq('id', appointmentId);
      }
    }

    // Check if Resend API key is available
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured (RESEND_API_KEY missing)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailSettings = await getEmailSettings(supabase);

    const clinicData = clinic;
    const clinicBranding: ClinicBranding = {
      name: clinicData?.name || 'Dental Clinic',
      logo: clinicData?.cover_image_url || undefined,
      primaryColor: '#0d9488',
      address: clinicData?.address || '',
      phone: clinicData?.phone || '',
      email: clinicData?.email || '',
      website: clinicData?.website || '',
      slug: clinicData?.slug || '',
    };

    const status = newStatus || appointment.status || 'pending';
    const patientName = appointment.patient_name || 'Patient';
    const treatmentName = appointment.treatment?.name || 'Dental Consultation';
    const appointmentDate = appointment.preferred_date 
      ? new Date(appointment.preferred_date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : 'To be confirmed';
    const appointmentTime = appointment.preferred_time || 'To be confirmed';

    // Generate Google Maps link
    let mapLink: string | undefined;
    if (clinicData?.google_place_id) {
      mapLink = `https://www.google.com/maps/place/?q=place_id:${clinicData.google_place_id}`;
    } else if (clinicData?.address) {
      mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicData.address)}`;
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.appointpanda.com';
    const manageToken = appointment.manage_token || appointmentId;

    const subject = getSubjectLine(status, clinicBranding.name, patientName);
    const html = generateEmailHTML(
      status,
      patientName,
      clinicBranding,
      appointmentDate,
      appointmentTime,
      treatmentName,
      appointmentId,
      siteUrl,
      manageToken,
      mapLink || undefined,
      clinicData?.id
    );

    console.log(`Sending email via Resend to ${appointment.patient_email}: ${subject}`);

    const result = await sendEmailViaResend(
      resendApiKey,
      emailSettings!,
      appointment.patient_email,
      subject,
      html
    );

    if (!result.success) {
      console.error('Email send failed:', result.error);
      // Don't return a 500 here: this function is often called "fire-and-forget" from the UI.
      // Returning 200 prevents the client from treating it as a hard failure while still surfacing the error.
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email sent successfully via Resend');
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-booking-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
