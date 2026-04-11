import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inline slug utility functions to avoid import issues
function generateBaseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

interface SlugRow {
  slug: string;
}

async function generateUniqueSlug(
  supabaseAdmin: SupabaseClient,
  tableName: 'clinics' | 'dentists',
  name: string
): Promise<string> {
  const baseSlug = generateBaseSlug(name);
  
  if (!baseSlug) {
    return `practice-${Date.now().toString(36)}`;
  }

  const { data: existing } = await supabaseAdmin
    .from(tableName)
    .select('slug')
    .like('slug', `${baseSlug}%`)
    .order('slug', { ascending: false });

  const rows = (existing || []) as SlugRow[];

  if (rows.length === 0) {
    return baseSlug;
  }

  let maxCounter = 0;
  const exactMatch = rows.some((row) => row.slug === baseSlug);
  
  if (exactMatch) {
    maxCounter = 1;
  }

  for (const row of rows) {
    const match = row.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
    if (match) {
      const counter = parseInt(match[1], 10);
      if (counter >= maxCounter) {
        maxCounter = counter + 1;
      }
    }
  }

  if (maxCounter === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${maxCounter}`;
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Dentist Onboarding Bootstrap (authenticated)
 *
 * Purpose: When a user signs up/signs in via Google (Gmail) and has no role yet,
 * bootstrap a user account with dentist role. Does NOT create a clinic automatically.
 * 
 * After sign-up, users are redirected to GMB business selection where they can:
 * - Select from their Google Business Profiles to create a listing
 * - Skip and manually add their practice later
 *
 * - Ensures 'dentist' role exists
 * - Marks onboarding as pending (user needs to add/claim a practice)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Use getClaims for JWT verification (handles ES256 signing properly)
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("JWT claims error:", claimsError);
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also fetch user data for metadata (name, email, etc.)
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user data:", userError);
      return new Response(JSON.stringify({ success: false, error: "Failed to get user data" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = claimsData.claims.sub as string;
    const now = new Date().toISOString();

    // 1) Ensure dentist role
    const { data: existingRoles, error: roleReadError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleReadError) {
      console.error("Failed to read user roles:", roleReadError);
      return new Response(JSON.stringify({ success: false, error: "Failed to read roles" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasDentistRole = (existingRoles ?? []).some((r) => r.role === "dentist");

    if (!hasDentistRole) {
      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "dentist" });

      if (roleInsertError) {
        console.error("Failed to assign dentist role:", roleInsertError);
        return new Response(JSON.stringify({ success: false, error: "Failed to assign dentist role" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) Check if user already has a clinic
    const { data: existingClinic } = await supabaseAdmin
      .from("clinics")
      .select("id, slug")
      .eq("claimed_by", userId)
      .maybeSingle();

    // 3) Mark onboarding status based on whether they have a clinic
    const provider = (user.app_metadata as any)?.provider as string | undefined;
    const googleConnected = provider === "google";
    
    // If no clinic, onboarding is pending - user needs to add/claim a practice
    const onboardingStatus = existingClinic ? "complete" : "pending";

    const { error: onboardingError } = await supabaseAdmin
      .from("user_onboarding")
      .upsert(
        {
          user_id: userId,
          onboarding_status: onboardingStatus,
          first_login_at: now,
          google_auth_connected: googleConnected ? true : null,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

    if (onboardingError) {
      console.warn("Failed to upsert user_onboarding (non-blocking):", onboardingError);
    }

    // Audit
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "DENTIST_BOOTSTRAP",
        entity_type: "user",
        entity_id: userId,
        user_id: userId,
        new_values: {
          role_assigned: !hasDentistRole,
          has_clinic: !!existingClinic,
          provider,
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
    console.error("dentist-onboarding-bootstrap error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
