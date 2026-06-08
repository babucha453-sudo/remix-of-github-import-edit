import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, getEmailSettings, generateBookingEmailHTML } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailPayload {
  appointmentId: string;
  type?: 'new_booking' | 'status_update';
  newStatus?: string;
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
    const clinicBranding = {
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
          day: 'numeric',
          timeZone: 'UTC',
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

    const manageToken = appointment.manage_token || appointmentId;

    const subject = getSubjectLine(status, clinicBranding.name, patientName);
    const html = generateBookingEmailHTML({
      status,
      patientName,
      clinicName: clinicBranding.name,
      clinicLogo: clinicBranding.logo,
      appointmentDate,
      appointmentTime,
      treatmentName,
      manageToken,
      mapLink: mapLink || undefined,
      clinicId: clinicData?.id,
      clinicSlug: clinicBranding.slug,
      primaryColor: clinicBranding.primaryColor,
    });

    console.log(`Sending email via Resend to ${appointment.patient_email}: ${subject}`);

    const from = emailSettings ? `${emailSettings.from_name} <${emailSettings.from_email}>` : undefined;
    const result = await sendEmail(
      resendApiKey,
      appointment.patient_email,
      subject,
      html,
      { from }
    );

    return new Response(
      JSON.stringify(result),
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
