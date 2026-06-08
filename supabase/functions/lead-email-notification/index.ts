import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, getEmailSettings, generateLeadNotificationHTML } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: "lead_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lead, error: leadError } = await supabaseClient
      .from("clinic_lead_requests")
      .select(`
        *,
        clinic:clinics(id, name, email, phone, slug, cover_image_url)
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clinic = lead.clinic;
    if (!clinic?.email) {
      return new Response(
        JSON.stringify({ error: "Clinic has no email configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailSettings = await getEmailSettings(supabaseClient);
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.appointpanda.com";

    const html = generateLeadNotificationHTML({
      clinicName: clinic.name,
      patientName: lead.patient_name,
      patientEmail: lead.patient_email || "",
      patientPhone: lead.patient_phone || undefined,
      service: lead.service || undefined,
      message: lead.message || undefined,
      dashboardUrl: `${siteUrl}/dashboard?tab=leads`,
      logoUrl: clinic.cover_image_url || undefined,
    });
    const subject = `New Lead: ${lead.patient_name} - ${clinic.name}`;
    const from = `${emailSettings.from_name} <${emailSettings.from_email}>`;
    const result = await sendEmail(resendApiKey, clinic.email, subject, html, { from });

    await logEmail(supabaseClient, {
      recipient: clinic.email,
      subject,
      type: "lead_notification",
      status: result.success ? "sent" : "failed",
      error_message: result.error,
      resend_id: result.id,
      clinic_id: clinic.id,
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
