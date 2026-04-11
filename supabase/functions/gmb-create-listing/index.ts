import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GMB Create Listing
 *
 * Creates a clinic listing with data from a selected Google Business Profile.
 * This is called after the user selects a business from the GMBBusinessSelection page.
 *
 * Flow:
 * 1. User selects a business from GMBBusinessSelection
 * 2. Frontend calls this function with the selected business data
 * 3. We create/update the clinic with the GMB data
 * 4. Auto-detect and match location (country, city, area)
 * 5. Assign dentist role to user
 * 6. Mark GMB as synced
 */

interface CreateListingRequest {
  business: {
    id: string; // accounts/xxx/locations/yyy
    accountId: string;
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    category: string | null;
    description: string | null;
    placeId: string | null;
    latitude: number | null;
    longitude: number | null;
    hours: Array<{
      openDay?: string;
      openTime?: { hours?: number; minutes?: number };
      closeDay?: string;
      closeTime?: { hours?: number; minutes?: number };
    }> | null;
  };
}

interface LocationMatch {
  countryId: string | null;
  cityId: string | null;
  areaId: string | null;
  countryName: string | null;
  cityName: string | null;
  areaName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  requiresManualSelection: boolean;
}

/**
 * Parse GMB address to extract location components
 */
function parseGMBAddress(address: string | null): {
  country: string | null;
  city: string | null;
  area: string | null;
  postalCode: string | null;
} {
  if (!address) {
    return { country: null, city: null, area: null, postalCode: null };
  }

  // GMB addresses are typically formatted as:
  // "Street Address, Area, City, Country" or variations
  const parts = address.split(',').map(p => p.trim());
  
  // Common UAE patterns
  const uaePatterns = ['UAE', 'United Arab Emirates', 'U.A.E'];
  const dubaiPatterns = ['Dubai', 'دبي'];
  
  let country: string | null = null;
  let city: string | null = null;
  let area: string | null = null;
  let postalCode: string | null = null;

  // Look for postal code pattern (numbers)
  const postalMatch = address.match(/\b\d{5,6}\b/);
  if (postalMatch) {
    postalCode = postalMatch[0];
  }

  // Check each part for country/city identification
  for (const part of parts) {
    const normalized = part.toLowerCase().trim();
    
    // Check for UAE
    if (uaePatterns.some(p => normalized.includes(p.toLowerCase()))) {
      country = 'United Arab Emirates';
    }
    
    // Check for Dubai
    if (dubaiPatterns.some(p => normalized.includes(p.toLowerCase()))) {
      city = 'Dubai';
    }
    
    // Check for other UAE emirates
    if (normalized.includes('abu dhabi')) city = 'Abu Dhabi';
    if (normalized.includes('sharjah')) city = 'Sharjah';
    if (normalized.includes('ajman')) city = 'Ajman';
    if (normalized.includes('ras al')) city = 'Ras Al Khaimah';
    if (normalized.includes('fujairah')) city = 'Fujairah';
    if (normalized.includes('umm al')) city = 'Umm Al Quwain';
  }

  // The area is typically the part before the city
  // Filter out already identified parts
  const remainingParts = parts.filter(p => {
    const lower = p.toLowerCase();
    if (country && lower.includes('emirates')) return false;
    if (city && lower.toLowerCase() === city.toLowerCase()) return false;
    if (postalCode && p.includes(postalCode)) return false;
    return true;
  });

  // First remaining part after street is usually the area
  if (remainingParts.length >= 2) {
    // Skip what looks like a street address (contains numbers at start)
    const potentialAreas = remainingParts.filter(p => !p.match(/^\d+\s/));
    if (potentialAreas.length > 0) {
      area = potentialAreas[0];
    }
  }

  console.log(`Parsed address "${address}" -> country: ${country}, city: ${city}, area: ${area}`);
  
  return { country, city, area, postalCode };
}

/**
 * Normalize text for matching (slug-like comparison)
 */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

/**
 * Calculate string similarity (simple Levenshtein-based)
 */
function stringSimilarity(a: string, b: string): number {
  const s1 = normalizeForMatch(a);
  const s2 = normalizeForMatch(b);
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple word overlap
  const words1 = s1.split('-');
  const words2 = s2.split('-');
  const common = words1.filter(w => words2.includes(w));
  
  if (common.length > 0) {
    return common.length / Math.max(words1.length, words2.length);
  }
  
  return 0;
}

/**
 * Match parsed address against existing locations in database
 */
async function matchLocation(
  supabaseAdmin: any,
  parsedAddress: { country: string | null; city: string | null; area: string | null }
): Promise<LocationMatch> {
  const result: LocationMatch = {
    countryId: null,
    cityId: null,
    areaId: null,
    countryName: null,
    cityName: null,
    areaName: null,
    matchConfidence: 'none',
    requiresManualSelection: true,
  };

  // 1. Try to match country
  if (parsedAddress.country) {
    const { data: countries } = await supabaseAdmin
      .from('countries')
      .select('id, name, code')
      .eq('is_active', true);

    if (countries) {
      for (const country of countries) {
        const similarity = stringSimilarity(parsedAddress.country, country.name);
        if (similarity >= 0.8 || parsedAddress.country.toLowerCase().includes(country.name.toLowerCase())) {
          result.countryId = country.id;
          result.countryName = country.name;
          break;
        }
      }
    }
  }

  // 2. Try to match city
  if (parsedAddress.city) {
    let cityQuery = supabaseAdmin
      .from('cities')
      .select('id, name, slug, country_id')
      .eq('is_active', true);

    if (result.countryId) {
      cityQuery = cityQuery.eq('country_id', result.countryId);
    }

    const { data: cities } = await cityQuery;

    if (cities) {
      let bestMatch = null;
      let bestScore = 0;

      for (const city of cities) {
        const similarity = stringSimilarity(parsedAddress.city, city.name);
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = city;
        }
      }

      if (bestMatch && bestScore >= 0.7) {
        result.cityId = bestMatch.id;
        result.cityName = bestMatch.name;
        
        // If we matched city, also get country if not already matched
        if (!result.countryId && bestMatch.country_id) {
          result.countryId = bestMatch.country_id;
        }
      }
    }
  }

  // 3. Try to match area
  if (parsedAddress.area && result.cityId) {
    const { data: areas } = await supabaseAdmin
      .from('areas')
      .select('id, name, slug')
      .eq('city_id', result.cityId)
      .eq('is_active', true);

    if (areas) {
      let bestMatch = null;
      let bestScore = 0;

      for (const area of areas) {
        const similarity = stringSimilarity(parsedAddress.area, area.name);
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = area;
        }
      }

      if (bestMatch && bestScore >= 0.6) {
        result.areaId = bestMatch.id;
        result.areaName = bestMatch.name;
      }
    }
  }

  // Determine match confidence and whether manual selection is needed
  if (result.areaId && result.cityId) {
    result.matchConfidence = 'high';
    result.requiresManualSelection = false;
  } else if (result.cityId && !result.areaId) {
    result.matchConfidence = 'medium';
    result.requiresManualSelection = true; // City found but area not matched
  } else if (result.countryId && !result.cityId) {
    result.matchConfidence = 'low';
    result.requiresManualSelection = true;
  } else {
    result.matchConfidence = 'none';
    result.requiresManualSelection = true;
  }

  console.log('Location match result:', result);
  
  return result;
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

    const body: CreateListingRequest = await req.json();
    const { business } = body;

    if (!business || !business.id || !business.name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing business data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;
    const now = new Date().toISOString();

    console.log("Creating listing for business:", business.name, "user:", userId);

    // Parse and match location from GMB address
    const parsedAddress = parseGMBAddress(business.address);
    const locationMatch = await matchLocation(supabaseAdmin, parsedAddress);

    // 1) Ensure dentist role
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const hasDentistRole = (existingRoles ?? []).some((r) => r.role === "dentist");

    if (!hasDentistRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "dentist" });

      if (roleError) {
        console.error("Failed to assign dentist role:", roleError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to assign dentist role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2) Check if user already has a clinic or if this GMB location is already claimed
    const { data: existingClinic } = await supabaseAdmin
      .from("clinics")
      .select("id, slug, gmb_location_id")
      .or(`claimed_by.eq.${userId},gmb_location_id.eq.${business.id}`)
      .maybeSingle();

    let clinicId: string;
    let clinicSlug: string;

    // Prepare location data for clinic
    const locationData = {
      city_id: locationMatch.cityId,
      area_id: locationMatch.areaId,
      location_verified: !locationMatch.requiresManualSelection,
      location_pending_approval: false,
      // Only set is_active if location is fully verified
      is_active: !locationMatch.requiresManualSelection,
    };

    if (existingClinic) {
      // Update existing clinic with GMB data
      const slug = existingClinic.slug;
      
      const { error: updateError } = await supabaseAdmin
        .from("clinics")
        .update({
          name: business.name,
          address: business.address,
          phone: business.phone,
          website: business.website,
          description: business.description,
          google_place_id: business.placeId,
          gmb_location_id: business.id,
          gmb_account_id: business.accountId,
          gmb_connected: true,
          gmb_last_sync_at: now,
          latitude: business.latitude,
          longitude: business.longitude,
          claim_status: "claimed",
          claimed_by: userId,
          claimed_at: now,
          verification_status: "verified",
          source: "gmb",
          updated_at: now,
          ...locationData,
        })
        .eq("id", existingClinic.id);

      if (updateError) {
        console.error("Failed to update clinic:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update clinic" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      clinicId = existingClinic.id;
      clinicSlug = slug;
    } else {
      // Create new clinic with unique slug (no random codes)
      const baseSlug = business.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
      
      const { data: existingSlugs } = await supabaseAdmin
        .from('clinics')
        .select('slug')
        .like('slug', `${baseSlug}%`);
      
      let slug = baseSlug;
      if (existingSlugs && existingSlugs.length > 0) {
        const exactMatch = existingSlugs.some((row: any) => row.slug === baseSlug);
        if (exactMatch) {
          let counter = 2;
          while (existingSlugs.some((row: any) => row.slug === `${baseSlug}-${counter}`)) {
            counter++;
          }
          slug = `${baseSlug}-${counter}`;
        }
      }

      const { data: newClinic, error: insertError } = await supabaseAdmin
        .from("clinics")
        .insert({
          name: business.name,
          slug,
          address: business.address,
          phone: business.phone,
          website: business.website,
          description: business.description,
          google_place_id: business.placeId,
          gmb_location_id: business.id,
          gmb_account_id: business.accountId,
          gmb_connected: true,
          gmb_last_sync_at: now,
          latitude: business.latitude,
          longitude: business.longitude,
          claimed_by: userId,
          claimed_at: now,
          claim_status: "claimed",
          verification_status: "verified",
          source: "gmb",
          updated_at: now,
          ...locationData,
        })
        .select("id, slug")
        .single();

      if (insertError || !newClinic) {
        console.error("Failed to create clinic:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create clinic" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      clinicId = newClinic.id;
      clinicSlug = newClinic.slug;
    }

    // 3) Store business hours if available
    if (business.hours && business.hours.length > 0) {
      // First delete existing hours
      await supabaseAdmin
        .from("clinic_hours")
        .delete()
        .eq("clinic_id", clinicId);

      // Map day names to day numbers (0 = Sunday, 1 = Monday, etc.)
      const dayMap: Record<string, number> = {
        SUNDAY: 0,
        MONDAY: 1,
        TUESDAY: 2,
        WEDNESDAY: 3,
        THURSDAY: 4,
        FRIDAY: 5,
        SATURDAY: 6,
      };

      const hoursData = business.hours.map((period) => {
        const dayNum = dayMap[period.openDay || ""] ?? 0;
        const openHour = period.openTime?.hours ?? 9;
        const openMin = period.openTime?.minutes ?? 0;
        const closeHour = period.closeTime?.hours ?? 18;
        const closeMin = period.closeTime?.minutes ?? 0;

        return {
          clinic_id: clinicId,
          day_of_week: dayNum,
          open_time: `${String(openHour).padStart(2, "0")}:${String(openMin).padStart(2, "0")}`,
          close_time: `${String(closeHour).padStart(2, "0")}:${String(closeMin).padStart(2, "0")}`,
          is_closed: false,
        };
      });

      await supabaseAdmin.from("clinic_hours").insert(hoursData);
    }

    // 4) Update onboarding status
    await supabaseAdmin
      .from("user_onboarding")
      .upsert({
        user_id: userId,
        google_auth_connected: true,
        gmb_profile_synced: true,
        onboarding_status: "in_progress",
        first_login_at: now,
        updated_at: now,
      }, { onConflict: "user_id" });

    // 5) Audit log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "GMB_LISTING_CREATED",
        entity_type: "clinic",
        entity_id: clinicId,
        user_id: userId,
        new_values: {
          business_name: business.name,
          gmb_location_id: business.id,
          place_id: business.placeId,
          was_update: !!existingClinic,
          location_match: locationMatch,
          parsed_address: parsedAddress,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log failed:", auditErr);
    }

    console.log("Listing created successfully:", clinicId, clinicSlug, "Location verified:", !locationMatch.requiresManualSelection);

    return new Response(
      JSON.stringify({
        success: true,
        clinicId,
        clinicSlug,
        message: existingClinic ? "Clinic updated with GMB data" : "Clinic created from GMB data",
        locationMatch: {
          countryId: locationMatch.countryId,
          cityId: locationMatch.cityId,
          areaId: locationMatch.areaId,
          countryName: locationMatch.countryName,
          cityName: locationMatch.cityName,
          areaName: locationMatch.areaName,
          matchConfidence: locationMatch.matchConfidence,
          requiresManualSelection: locationMatch.requiresManualSelection,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmb-create-listing error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});