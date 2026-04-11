import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GMB Store Token
 *
 * Stores the Google OAuth access token (with business.manage scope) for GMB operations.
 * This is called immediately after OAuth to persist the token before it gets lost.
 *
 * Body:
 * - providerToken: The Google OAuth access token
 * - googleEmail: The Google account email (optional, will be fetched if not provided)
 * - scopes: The scopes granted (optional)
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Use getClaims for JWT verification (handles ES256 signing properly)
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("JWT claims error:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    // Parse request body
    const body = await req.json();
    const { providerToken, googleEmail: providedEmail, scopes } = body;

    if (!providerToken) {
      return new Response(
        JSON.stringify({ success: false, error: "providerToken is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Storing GMB token for user ${userId}`);

    // Fetch the Google email from the token if not provided
    let googleEmail = providedEmail;
    if (!googleEmail) {
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${providerToken}` },
        });
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          googleEmail = userInfo.email;
        }
      } catch (e) {
        console.warn("Failed to fetch Google user info:", e);
      }
    }

    if (!googleEmail) {
      // Fallback to user's email from JWT claims
      googleEmail = userEmail || "unknown@google.com";
    }

    // Use service role client to store the token
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert the token (update if exists, insert if not)
    const { error: upsertError } = await adminClient
      .from("google_oauth_accounts")
      .upsert(
        {
          user_id: userId,
          google_account_email: googleEmail,
          access_token: providerToken,
          // Note: Supabase OAuth doesn't give us the refresh_token directly
          // We store null for now - token refresh would require server-side OAuth flow
          refresh_token: null,
          token_expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(), // ~55 mins
          scopes: scopes ? scopes.split(" ") : ["business.manage"],
          gmb_connected: true,
          last_token_refresh_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,google_account_email" }
      );

    if (upsertError) {
      console.error("Failed to store GMB token:", upsertError);
      throw new Error(`Failed to store token: ${upsertError.message}`);
    }

    // Audit log
    try {
      await adminClient.from("audit_logs").insert({
        action: "GMB_TOKEN_STORED",
        entity_type: "google_oauth_accounts",
        entity_id: userId,
        user_id: userId,
        new_values: {
          google_email: googleEmail,
          scopes: scopes,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log failed:", auditErr);
    }

    console.log(`Successfully stored GMB token for ${googleEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "GMB token stored successfully",
        googleEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmb-store-token error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
