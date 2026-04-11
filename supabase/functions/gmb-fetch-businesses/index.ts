import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GMB Fetch Businesses
 *
 * Calls Google Business Profile API to fetch all businesses the user has access to.
 * This requires the user's Google OAuth token with business.manage scope.
 *
 * Flow:
 * 1. User signs in with Google (with business.manage scope)
 * 2. Frontend calls this function with the Google access token
 * 3. We call Google Business Profile API to list all locations
 * 4. Return list of businesses for user to select
 */

interface GMBLocation {
  name: string; // accounts/{accountId}/locations/{locationId}
  title: string; // Business name
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  primaryPhone?: string;
  websiteUri?: string;
  primaryCategory?: {
    displayName?: string;
  };
  regularHours?: {
    periods?: Array<{
      openDay?: string;
      openTime?: { hours?: number; minutes?: number };
      closeDay?: string;
      closeTime?: { hours?: number; minutes?: number };
    }>;
  };
  profile?: {
    description?: string;
  };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
  };
  latlng?: {
    latitude?: number;
    longitude?: number;
  };
}

interface GMBAccount {
  name: string; // accounts/{accountId}
  accountName?: string;
  type?: string;
}

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

    // Get the Google provider token from multiple sources (in priority order):
    // 1. Request body (passed from frontend after OAuth)
    // 2. Database (stored from previous OAuth flow)
    // 3. Session (only works immediately after OAuth)
    let providerToken: string | null = null;
    let tokenSource = "none";
    
    try {
      const body = await req.json();
      providerToken = body?.providerToken || null;
      if (providerToken) tokenSource = "request_body";
    } catch {
      // No body or invalid JSON - try other sources
    }

    // Fallback 1: Check database for stored token
    if (!providerToken) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: oauthAccount } = await supabaseAdmin
        .from("google_oauth_accounts")
        .select("access_token, token_expires_at")
        .eq("user_id", userId)
        .eq("gmb_connected", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (oauthAccount?.access_token) {
        // Check if token is still valid (not expired)
        const expiresAt = oauthAccount.token_expires_at ? new Date(oauthAccount.token_expires_at) : null;
        const isExpired = expiresAt && expiresAt < new Date();
        
        if (!isExpired) {
          providerToken = oauthAccount.access_token;
          tokenSource = "database";
          console.log("Using stored GMB token from database");
        } else {
          console.log("Stored GMB token has expired");
        }
      }
    }

    // Fallback 2: try to get from session (only works immediately after OAuth)
    if (!providerToken) {
      const { data: { session } } = await userClient.auth.getSession();
      providerToken = session?.provider_token || null;
      if (providerToken) tokenSource = "session";
    }

    if (!providerToken) {
      console.error("No provider token found - checked body, database, and session");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Google Business access token not found or expired. Please reconnect your Google account.",
          code: "NO_PROVIDER_TOKEN"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Provider token found (source: ${tokenSource}), fetching GMB businesses...`);
    
    console.log("Provider token received, fetching GMB businesses...");

    console.log("Fetching GMB accounts for user:", userId);

    // Step 1: Get all GMB accounts the user has access to
    const accountsResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error("GMB accounts API error:", accountsResponse.status, errorText);

      // Provide explicit, user-actionable errors (frontend can parse these)
      if (accountsResponse.status === 401) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Google token expired. Please sign in again.",
            code: "TOKEN_EXPIRED",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (accountsResponse.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Access denied. This Google account is missing Google Business permissions (business.manage) or has no Business Profile access. Please reconnect and approve access.",
            code: "ACCESS_DENIED",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (accountsResponse.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Google Business Profile API quota is currently exhausted (rate limited). Please wait a minute and try again. If this persists, the Google project used for OAuth may have zero quota for Business Profile APIs and needs to be configured.",
            code: "RATE_LIMITED",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Failed to fetch GMB accounts: ${errorText}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts: GMBAccount[] = accountsData.accounts || [];

    console.log(`Found ${accounts.length} GMB accounts`);

    if (accounts.length === 0) {
      // Update onboarding status
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      await supabaseAdmin
        .from("user_onboarding")
        .upsert({
          user_id: userId,
          google_auth_connected: true,
          gmb_profile_synced: false,
          gmb_business_count: 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      return new Response(
        JSON.stringify({
          success: true,
          businesses: [],
          message: "No Google Business Profiles found on this account"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: For each account, fetch all locations
    const allLocations: Array<GMBLocation & { accountId: string; accountName: string }> = [];

    for (const account of accounts) {
      const accountId = account.name; // accounts/{id}
      
      try {
        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title,storefrontAddress,primaryPhone,websiteUri,primaryCategory,regularHours,profile,metadata,latlng`,
          {
            headers: {
              Authorization: `Bearer ${providerToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!locationsResponse.ok) {
          console.warn(`Failed to fetch locations for account ${accountId}:`, await locationsResponse.text());
          continue;
        }

        const locationsData = await locationsResponse.json();
        const locations: GMBLocation[] = locationsData.locations || [];

        console.log(`Found ${locations.length} locations in account ${accountId}`);

        for (const location of locations) {
          allLocations.push({
            ...location,
            accountId,
            accountName: account.accountName || "Business Account",
          });
        }
      } catch (locErr) {
        console.error(`Error fetching locations for account ${accountId}:`, locErr);
      }
    }

    console.log(`Total locations found: ${allLocations.length}`);

    // Transform locations into a cleaner format for the frontend
    const businesses = allLocations.map((loc) => {
      const address = loc.storefrontAddress;
      const addressLines = address?.addressLines || [];
      const fullAddress = [
        ...addressLines,
        address?.locality,
        address?.administrativeArea,
        address?.postalCode,
      ].filter(Boolean).join(", ");

      return {
        id: loc.name, // accounts/xxx/locations/yyy
        accountId: loc.accountId,
        accountName: loc.accountName,
        name: loc.title,
        address: fullAddress,
        phone: loc.primaryPhone || null,
        website: loc.websiteUri || null,
        category: loc.primaryCategory?.displayName || null,
        description: loc.profile?.description || null,
        placeId: loc.metadata?.placeId || null,
        mapsUrl: loc.metadata?.mapsUri || null,
        latitude: loc.latlng?.latitude || null,
        longitude: loc.latlng?.longitude || null,
        hours: loc.regularHours?.periods || null,
      };
    });

    // Update onboarding status with business count
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    await supabaseAdmin
      .from("user_onboarding")
      .upsert({
        user_id: userId,
        google_auth_connected: true,
        gmb_profile_synced: false,
        gmb_business_count: businesses.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    // Audit log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "GMB_BUSINESSES_FETCHED",
        entity_type: "user",
        entity_id: userId,
        user_id: userId,
        new_values: {
          business_count: businesses.length,
          account_count: accounts.length,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log failed:", auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        businesses,
        accountCount: accounts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmb-fetch-businesses error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
