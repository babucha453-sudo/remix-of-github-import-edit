import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, generateProfileCompletionReminderHTML } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompletionReminderPayload {
  clinicId: string;
  userId: string;
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

    const payload: CompletionReminderPayload = await req.json();
    const { clinicId, userId } = payload;

    if (!clinicId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: clinicId, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("name, slug, cover_image_url")
      .eq("id", clinicId)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ success: false, error: clinicError?.message || "Clinic not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("email, first_name, id")
      .eq("id", userId)
      .single();

    if (userError || !user?.email) {
      return new Response(
        JSON.stringify({ success: false, error: userError?.message || "User not found or no email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clinicName = clinic.name;

    const { data: profile } = await supabase
      .from("clinic_profiles")
      .select("completion_percentage, missing_fields")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    const completionPercent = profile?.completion_percentage ?? 0;
    const missingFields: string[] = profile?.missing_fields ?? [
      "Clinic description",
      "Services and pricing",
      "Business hours",
      "Clinic photos",
      "Team members",
    ];

    const html = generateProfileCompletionReminderHTML({
      firstName: user.first_name || "there",
      clinicName,
      profileUrl: `${Deno.env.get("SITE_URL") || "https://www.appointpanda.com"}/clinic/${clinic.slug}/edit`,
      completionPercent,
      missingFields,
    });

    const subject = `Complete Your ${clinicName} Profile`;
    const result = await sendEmail(resendApiKey, user.email, subject, html);

    await logEmail(supabase, {
      recipient: user.email,
      subject,
      type: "profile_completion_reminder",
      status: result.success ? "sent" : "failed",
      error_message: result.error,
      resend_id: result.id,
      clinic_id: clinicId,
      user_id: userId,
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
