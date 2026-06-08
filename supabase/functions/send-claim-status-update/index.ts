import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, logEmail, generateClaimStatusUpdateHTML } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClaimStatusPayload {
  claimId: string;
  userId: string;
  clinicId: string;
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

    const payload: ClaimStatusPayload = await req.json();
    const { claimId, userId, clinicId } = payload;

    if (!claimId || !userId || !clinicId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: claimId, userId, clinicId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: claim, error: claimError } = await supabase
      .from("clinic_claims")
      .select("*, clinic:clinics!clinic_claims_clinic_id_fkey(name)")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      return new Response(
        JSON.stringify({ success: false, error: claimError?.message || "Claim not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("email, first_name")
      .eq("id", userId)
      .single();

    if (userError || !user?.email) {
      return new Response(
        JSON.stringify({ success: false, error: userError?.message || "User not found or no email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clinicName = claim.clinic?.name || "Your Clinic";
    const statusMessages: Record<string, string> = {
      approved: "Congratulations! Your claim has been approved. You now have full control over your clinic profile.",
      rejected: "Your claim was not approved. Please contact support for more information.",
      pending_review: "Your claim is now under manual review. Our team will get back to you within 24-48 hours.",
      submitted: "Your claim has been submitted successfully. We will review it shortly.",
    };

    const html = generateClaimStatusUpdateHTML({
      clinicName,
      userName: user.first_name || "there",
      status: claim.status,
      message: statusMessages[claim.status] || `Your claim status has been updated to: ${claim.status}`,
      dashboardUrl: Deno.env.get("SITE_URL")
        ? `${Deno.env.get("SITE_URL")}/dashboard/my-clinic`
        : "https://www.appointpanda.com/dashboard/my-clinic",
    });

    const subject = `Claim ${claim.status.replace("_", " ")} - ${clinicName}`;
    const result = await sendEmail(resendApiKey, user.email, subject, html);

    await logEmail(supabase, {
      recipient: user.email,
      subject,
      type: "claim_status_update",
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
