import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GMB Listing Bootstrap
 *
 * Purpose: After a dentist signs in via the "List your practice" Google flow,
 * we only assign the dentist role. Clinic creation is handled separately
 * when the user selects a GMB business or manually adds their practice.
 *
 * This function (authenticated):
 * 1) Ensures the signed-in user has the 'dentist' role
 * 2) Creates/updates user_onboarding row to track onboarding state
 *
 * Does NOT create a clinic - that happens in gmb-create-listing when user selects a business.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;

    // 1) Ensure dentist role
    const { data: existingRoles, error: roleReadError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleReadError) {
      console.error("Failed to read user roles:", roleReadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to read user roles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasDentistRole = (existingRoles ?? []).some((r) => r.role === "dentist");

    if (!hasDentistRole) {
      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "dentist" });

      if (roleInsertError) {
        console.error("Failed to assign dentist role:", roleInsertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to assign dentist role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2) Check if user already has a clinic
    const { data: existingClinic } = await supabaseAdmin
      .from("clinics")
      .select("id, slug")
      .eq("claimed_by", userId)
      .maybeSingle();

    // 3) Upsert user_onboarding - pending if no clinic, complete if has clinic
    const now = new Date().toISOString();
    const onboardingStatus = existingClinic ? "complete" : "pending";
    
    const { error: onboardingError } = await supabaseAdmin
      .from("user_onboarding")
      .upsert(
        {
          user_id: userId,
          onboarding_status: onboardingStatus,
          first_login_at: now,
          updated_at: now,
        },
        { onConflict: "user_id", ignoreDuplicates: false }
      );

    if (onboardingError) {
      console.warn("Failed to upsert user_onboarding (non-blocking):", onboardingError);
    }

    // Audit
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "GMB_LISTING_BOOTSTRAP",
        entity_type: "user",
        entity_id: userId,
        user_id: userId,
        new_values: {
          role_assigned: !hasDentistRole,
          has_clinic: !!existingClinic,
        },
      });
    } catch (auditErr) {
      console.warn("Failed to write audit log (non-blocking):", auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dentistRole: true,
        clinicId: existingClinic?.id ?? null,
        clinicSlug: existingClinic?.slug ?? null,
        needsClinic: !existingClinic,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmb-listing-bootstrap error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
