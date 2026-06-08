import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, generateAppointmentReminderHTML } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderPayload {
  appointmentId: string;
  overrideEmail?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ReminderPayload = await req.json();
    const { appointmentId, overrideEmail } = payload;

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing appointmentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .select(`
        *,
        clinic:clinics!appointments_clinic_id_fkey(id, name, phone, address, slug, cover_image_url, google_place_id),
        treatment:treatments(id, name)
      `)
      .eq("id", appointmentId)
      .single();

    if (apptError || !appointment) {
      return new Response(
        JSON.stringify({ success: false, error: apptError?.message || "Appointment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const recipientEmail = overrideEmail || appointment.patient_email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: true, message: "No patient email to send reminder to" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clinic = appointment.clinic;
    const patientName = appointment.patient_name || "Patient";
    const treatmentName = appointment.treatment?.name || "Dental Consultation";
    const appointmentDate = appointment.preferred_date
      ? new Date(appointment.preferred_date).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
        })
      : "To be confirmed";
    const appointmentTime = appointment.preferred_time || "To be confirmed";
    const manageToken = appointment.manage_token || appointmentId;

    let mapLink: string | undefined;
    if (clinic?.google_place_id) {
      mapLink = `https://www.google.com/maps/place/?q=place_id:${clinic.google_place_id}`;
    } else if (clinic?.address) {
      mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`;
    }

    const html = generateAppointmentReminderHTML({
      patientName,
      clinicName: clinic?.name || "Your Clinic",
      clinicLogo: clinic?.cover_image_url || undefined,
      appointmentDate,
      appointmentTime,
      treatmentName,
      manageToken,
      clinicPhone: clinic?.phone || undefined,
      clinicAddress: clinic?.address || undefined,
      mapLink,
    });

    const subject = `Reminder: Appointment at ${clinic?.name || "Your Clinic"} Tomorrow`;
    const result = await sendEmail(resendApiKey, recipientEmail, subject, html);

    await logEmail(supabase, {
      recipient: recipientEmail,
      subject,
      type: "appointment_reminder",
      status: result.success ? "sent" : "failed",
      error_message: result.error,
      resend_id: result.id,
      clinic_id: clinic?.id,
    });

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
