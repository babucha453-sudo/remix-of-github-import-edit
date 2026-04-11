import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchIntent {
  treatments: string[];
  location: {
    state?: string;
    city?: string;
    nearMe?: boolean;
    userLat?: number;
    userLon?: number;
    radiusKm?: number;
  };
  budget: {
    max?: number;
    min?: number;
    preference?: "affordable" | "premium" | "any";
  };
  quantity?: number;
  insurance?: string;
  urgency?: "emergency" | "same_day" | "weekend" | "normal";
  preferences: string[];
  originalQuery: string;
  needsMoreInfo?: boolean;
  missingInfo?: string[];
}

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  address: string;
  city_name: string;
  state_slug: string;
  rating: number;
  review_count: number;
  cover_image_url: string;
  is_paid: boolean;
  relevance_score: number;
  match_reasons: string[];
  treatments_matched: string[];
  price_range?: { from: number; to: number };
  distance_km?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { query, sessionId, visitorId, userLocation } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  // Extract intent using fallback regex parser
  const intent = extractIntentFallback(query, userLocation);
  const missingInfo: string[] = [];
  
  // Check for missing critical info - BE SMART about what's needed
  const hasBudgetOnly = intent.budget.max && intent.treatments.length === 0 && !intent.location.city && !intent.location.state && !intent.location.nearMe;
  const hasServiceNoLocation = intent.treatments.length > 0 && !intent.location.city && !intent.location.state && !intent.location.nearMe;
  const hasBudgetNoService = intent.budget.max && intent.treatments.length === 0;
  
  // Priority: Service > Location
  if (hasBudgetNoService) {
    missingInfo.push("service");
  }
  if (!intent.location.city && !intent.location.state && !intent.location.nearMe) {
    missingInfo.push("location");
  }
  
  // If we only have budget (no service, no location), ask for service first
  if (hasBudgetOnly) {
    return new Response(
      JSON.stringify({
        results: [],
        totalCount: 0,
        intent,
        suggestions: [],
        followUpQuestion: "What dental service are you looking for? (e.g., cleaning, implants, whitening, braces)",
        searchDurationMs: Date.now() - startTime,
        fallbackUsed: true,
        needsMoreInfo: true,
        missingInfo: ["service", "location"],
        conversationStep: "ask_service",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  // If we have service but no location, ask for location
  if (hasServiceNoLocation && !userLocation?.lat) {
    return new Response(
      JSON.stringify({
        results: [],
        totalCount: 0,
        intent,
        suggestions: [],
        followUpQuestion: `Great! Where are you looking for ${intent.treatments[0] || 'this service'}? (e.g., Los Angeles, Boston, or "near me")`,
        searchDurationMs: Date.now() - startTime,
        fallbackUsed: true,
        needsMoreInfo: true,
        missingInfo: ["location"],
        conversationStep: "ask_location",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

    // Fetch clinics with paid status (optimized query)
    const { data: clinicsRaw, error: clinicsError } = await supabase
      .from("clinics")
      .select(`
        id, name, slug, address, rating, review_count, cover_image_url, 
        latitude, longitude, city_id
      `)
      .eq("is_active", true)
      .eq("is_duplicate", false)
      .order("rating", { ascending: false })
      .limit(150);

    if (clinicsError) {
      console.error("[AI Search] Clinics fetch error:", clinicsError);
      throw new Error(`Database search failed: ${clinicsError.message}`);
    }

    // Get paid status for clinics
    const clinicIds = clinicsRaw?.map(c => c.id) || [];
    let paidClinicIds = new Set<string>();
    
    if (clinicIds.length > 0) {
      const { data: subscriptions } = await supabase
        .from("clinic_subscriptions")
        .select("clinic_id")
        .in("clinic_id", clinicIds)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString());
      
      if (subscriptions) {
        paidClinicIds = new Set(subscriptions.map(s => s.clinic_id));
      }
    }

    // Fetch cities for location matching
    const cityIds = [...new Set(clinicsRaw?.map(c => c.city_id).filter(Boolean) || [])];
    let citiesMap: Record<string, { name: string; slug: string; state?: { slug: string; abbreviation: string } }> = {};

    if (cityIds.length > 0) {
      const { data: cities } = await supabase
        .from("cities")
        .select("id, name, slug, state_id")
        .in("id", cityIds.slice(0, 100));

      if (cities) {
        const stateIds = [...new Set(cities.map(c => c.state_id).filter(Boolean))];
        let statesMap: Record<string, { slug: string; abbreviation: string }> = {};

        if (stateIds.length > 0) {
          const { data: states } = await supabase
            .from("states")
            .select("id, slug, abbreviation")
            .in("id", stateIds);

          if (states) {
            statesMap = Object.fromEntries(states.map(s => [s.id, s]));
          }
        }

        citiesMap = Object.fromEntries(
          cities.map(c => [c.id, { ...c, state: statesMap[c.state_id] }])
        );
      }
    }

    // Fetch clinic treatments for budget matching
    let clinicTreatmentsMap: Record<string, Array<{ treatment_name: string; price_from: number | null; price_to: number | null }>> = {};
    
    if (clinicIds.length > 0 && (intent.treatments.length > 0 || intent.budget.max)) {
      const { data: clinicTreatments } = await supabase
        .from("clinic_treatments")
        .select(`
          clinic_id, price_from, price_to,
          treatment:treatments(name, slug)
        `)
        .in("clinic_id", clinicIds.slice(0, 100));

      if (clinicTreatments) {
        for (const ct of clinicTreatments) {
          if (!clinicTreatmentsMap[ct.clinic_id]) {
            clinicTreatmentsMap[ct.clinic_id] = [];
          }
          clinicTreatmentsMap[ct.clinic_id].push({
            treatment_name: (ct.treatment as any)?.name || "",
            price_from: ct.price_from,
            price_to: ct.price_to,
          });
        }
      }
    }

    // Normalize helper
    const normalize = (str: string): string =>
      str.toLowerCase().replace(/[\s\-_]+/g, "").trim();

    // Filter and score clinics
    let filteredClinics = clinicsRaw || [];
    const intentCity = normalize(intent.location.city || "");
    const intentState = normalize(intent.location.state || "");

    // Location filtering
    if (intentCity || intentState) {
      const stateAbbreviations: Record<string, string> = {
        california: "ca", massachusetts: "ma", connecticut: "ct",
        newyork: "ny", texas: "tx", florida: "fl",
      };
      const stateAbbr = stateAbbreviations[intentState] || intentState;

      filteredClinics = filteredClinics.filter((clinic: any) => {
        const cityData = citiesMap[clinic.city_id];
        if (!cityData) return false;

        const citySlug = normalize(cityData.slug || "");
        const cityName = normalize(cityData.name || "");
        const stateSlug = normalize(cityData.state?.slug || "");
        const stateAbbrNorm = normalize(cityData.state?.abbreviation || "");

        // City match
        if (intentCity) {
          const cityMatches =
            citySlug === intentCity ||
            cityName === intentCity ||
            citySlug.includes(intentCity) ||
            intentCity.includes(citySlug);
          if (!cityMatches) return false;
        }

        // State match
        if (intentState) {
          const stateMatches = stateSlug === stateAbbr || stateAbbrNorm === stateAbbr;
          if (!stateMatches) return false;
        }

        return true;
      });
    }

    // Near-me filtering with geolocation
    if (intent.location.nearMe && intent.location.userLat && intent.location.userLon) {
      const radiusKm = intent.location.radiusKm || 15;
      filteredClinics = filteredClinics.filter((clinic: any) => {
        if (!clinic.latitude || !clinic.longitude) return false;
        const dist = haversineDistance(
          intent.location.userLat!,
          intent.location.userLon!,
          clinic.latitude,
          clinic.longitude
        );
        (clinic as any)._distance_km = dist;
        return dist <= radiusKm;
      });
    }

    // Budget filtering
    if (intent.budget.max && intent.treatments.length > 0) {
      const budgetMax = intent.budget.max;
      const quantity = intent.quantity || 1;
      const targetTreatment = normalize(intent.treatments[0] || "");

      filteredClinics = filteredClinics.filter((clinic: any) => {
        const treatments = clinicTreatmentsMap[clinic.id] || [];
        const matchingTreatment = treatments.find(t =>
          normalize(t.treatment_name).includes(targetTreatment) ||
          targetTreatment.includes(normalize(t.treatment_name))
        );

        if (!matchingTreatment) return true; // No pricing = include by default
        if (!matchingTreatment.price_from && !matchingTreatment.price_to) return true;

        // Calculate total cost for quantity
        const minPrice = (matchingTreatment.price_from || 0) * quantity;
        return minPrice <= budgetMax;
      });
    }

    // Score and prepare results
    const results: SearchResult[] = filteredClinics.map((clinic: any) => {
      const cityData = citiesMap[clinic.city_id] || {};
      const stateData = (cityData as any).state || {};
      const isPaid = paidClinicIds.has(clinic.id);
      const treatments = clinicTreatmentsMap[clinic.id] || [];

      // Calculate relevance score
      let relevanceScore = 0.5;
      
      // Rating boost
      if (clinic.rating) {
        relevanceScore += (clinic.rating / 5) * 0.25;
      }

      // Paid boost
      if (isPaid) {
        relevanceScore += 0.15;
      }

      // Treatment match boost
      const matchedTreatments: string[] = [];
      if (intent.treatments.length > 0) {
        for (const intentTreatment of intent.treatments) {
          const match = treatments.find(t =>
            normalize(t.treatment_name).includes(normalize(intentTreatment))
          );
          if (match) {
            matchedTreatments.push(match.treatment_name);
            relevanceScore += 0.1;
          }
        }
      }

      // Build match reasons
      const matchReasons: string[] = [];
      if (clinic.rating && clinic.rating >= 4.5) {
        matchReasons.push(`Highly rated (${clinic.rating}★)`);
      }
      if (matchedTreatments.length > 0) {
        matchReasons.push(`Offers ${matchedTreatments[0]}`);
      }
      if (intent.budget.max) {
        const treatment = treatments.find(t => t.price_from || t.price_to);
        if (treatment && treatment.price_from && treatment.price_from <= intent.budget.max) {
          matchReasons.push(`Within budget`);
        }
      }
      if ((clinic as any)._distance_km) {
        matchReasons.push(`${(clinic as any)._distance_km.toFixed(1)} km away`);
      }
      if (isPaid) {
        matchReasons.push("Verified practice");
      }

      // Get price range for display
      let priceRange: { from: number; to: number } | undefined;
      if (intent.treatments.length > 0) {
        const targetTreatment = normalize(intent.treatments[0]);
        const match = treatments.find(t =>
          normalize(t.treatment_name).includes(targetTreatment)
        );
        if (match && (match.price_from || match.price_to)) {
          priceRange = {
            from: match.price_from || 0,
            to: match.price_to || match.price_from || 0,
          };
        }
      }

      return {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        address: clinic.address || "",
        city_name: cityData.name || "",
        state_slug: stateData.slug || "",
        rating: clinic.rating || 0,
        review_count: clinic.review_count || 0,
        cover_image_url: clinic.cover_image_url || "",
        is_paid: isPaid,
        relevance_score: Math.min(relevanceScore, 1),
        match_reasons: matchReasons,
        treatments_matched: matchedTreatments,
        price_range: priceRange,
        distance_km: (clinic as any)._distance_km,
      };
    });

    // Sort: paid first, then by relevance, then by rating
    results.sort((a, b) => {
      if (a.is_paid !== b.is_paid) return b.is_paid ? 1 : -1;
      if (Math.abs(a.relevance_score - b.relevance_score) > 0.1) {
        return b.relevance_score - a.relevance_score;
      }
      return b.rating - a.rating;
    });

    const topResults = results.slice(0, 15);

    // Generate follow-up question - be specific and actionable
    let followUpQuestion: string | undefined;
    let conversationStep: string | undefined;
    
    if (results.length === 0 && missingInfo.includes("service")) {
      followUpQuestion = "What specific service are you looking for? (e.g., cleaning, implants, whitening)";
      conversationStep = "ask_service";
    } else if (results.length === 0 && missingInfo.includes("location")) {
      const service = intent.treatments[0] || "dental care";
      followUpQuestion = `Which city would you like to find ${service} in?`;
      conversationStep = "ask_location";
    } else if (results.length === 0) {
      followUpQuestion = `No dentists found for "${intent.treatments[0] || 'your search'}" within $${intent.budget.max || '?'} in ${intent.location.city || 'your area'}. Try a higher budget or different location.`;
      conversationStep = "no_results";
    } else if (results.length < 5 && intent.budget.max) {
      followUpQuestion = `Found ${results.length} matches. Want to see more options at a higher budget?`;
      conversationStep = "expand_budget";
    }

    const searchDuration = Date.now() - startTime;

    // Log search (fire and forget)
    supabase.from("ai_search_logs").insert({
      session_id: sessionId || crypto.randomUUID(),
      visitor_id: visitorId,
      original_query: query,
      extracted_intent: intent as any,
      results_shown: topResults.map(r => ({ id: r.id, score: r.relevance_score })) as any,
      results_count: results.length,
      search_duration_ms: searchDuration,
      fallback_used: true,
    }).then(() => console.log("[AI Search] Logged"));

    return new Response(
      JSON.stringify({
        results: topResults,
        totalCount: results.length,
        intent,
        suggestions: generateSuggestions(intent, results.length),
        followUpQuestion,
        conversationStep,
        searchDurationMs: searchDuration,
        fallbackUsed: true,
        needsMoreInfo: missingInfo.length > 0,
        missingInfo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Search error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Search failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Haversine distance in km
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function generateSuggestions(intent: SearchIntent, resultCount: number): string[] {
  const suggestions: string[] = [];
  
  if (resultCount === 0 && intent.budget.max) {
    suggestions.push(`Try increasing budget to $${intent.budget.max * 1.5}`);
  }
  
  if (!intent.location.city && !intent.location.nearMe) {
    suggestions.push("Try adding a city name for better results");
  }
  
  if (intent.treatments.length === 0) {
    suggestions.push("Specify a service like 'cleaning' or 'whitening'");
  }
  
  return suggestions.slice(0, 3);
}

function extractIntentFallback(query: string, userLocation: any): SearchIntent {
  const lowerQuery = query.toLowerCase();

  // Extract treatments
  const treatmentKeywords = [
    "implant", "root canal", "braces", "invisalign", "whitening", "veneers",
    "crown", "bridge", "denture", "extraction", "wisdom", "cleaning", "checkup",
    "emergency", "cosmetic", "gum", "sedation", "filling", "cavity", "dental work",
    "teeth", "tooth", "molar", "orthodontic", "periodontal", "fluoride", "sealant",
  ];
  const treatments = treatmentKeywords.filter(t => lowerQuery.includes(t));

  // Extract budget
  const budgetMatch = lowerQuery.match(/(?:under|below|max|budget|within)\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
  const budgetMax = budgetMatch ? parseFloat(budgetMatch[1].replace(",", "")) : undefined;

  // Extract quantity (e.g., "4 implants")
  const quantityMatch = lowerQuery.match(/(\d+)\s*(?:implants?|teeth|tooth|crowns?|veneers?)/i);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

  let budgetPreference: "affordable" | "premium" | "any" = "any";
  if (lowerQuery.includes("affordable") || lowerQuery.includes("cheap") || lowerQuery.includes("budget") || lowerQuery.includes("low cost")) {
    budgetPreference = "affordable";
  } else if (lowerQuery.includes("premium") || lowerQuery.includes("best") || lowerQuery.includes("top") || lowerQuery.includes("luxury")) {
    budgetPreference = "premium";
  }

  // Extract location
  const stateTokens: Array<{ token: string; canonical: string }> = [
    { token: "california", canonical: "CA" },
    { token: "ca", canonical: "CA" },
    { token: "massachusetts", canonical: "MA" },
    { token: "ma", canonical: "MA" },
    { token: "connecticut", canonical: "CT" },
    { token: "ct", canonical: "CT" },
    { token: "new york", canonical: "NY" },
    { token: "ny", canonical: "NY" },
    { token: "texas", canonical: "TX" },
    { token: "tx", canonical: "TX" },
    { token: "florida", canonical: "FL" },
    { token: "fl", canonical: "FL" },
  ];

  let state: string | undefined;
  for (const s of stateTokens) {
    if (new RegExp(`\\b${s.token}\\b`, "i").test(lowerQuery)) {
      state = s.canonical;
      break;
    }
  }

  let city: string | undefined;
  const locMatch = lowerQuery.match(
    /\b(?:in|near|around)\s+([a-z\-\s]+?)(?:,\s*([a-z]{2}|california|massachusetts|connecticut))?(?:\b|$)/i
  );
  if (locMatch?.[1]) {
    const rawCity = locMatch[1]
      .trim()
      .replace(/\s{2,}/g, " ")
      .replace(/[^a-z\s\-]/gi, "")
      .trim();
    if (rawCity && rawCity.length > 1) city = rawCity;

    const rawState = (locMatch[2] || "").trim();
    if (!state && rawState) {
      const st = stateTokens.find((x) => x.token === rawState.toLowerCase());
      state = st?.canonical || rawState.toUpperCase();
    }
  } else {
    const commaMatch = lowerQuery.match(/\b([a-z\-\s]+),\s*([a-z]{2})\b/i);
    if (commaMatch?.[1]) {
      const rawCity = commaMatch[1].trim().replace(/\s{2,}/g, " ");
      const rawState = commaMatch[2].trim().toUpperCase();
      if (rawCity) city = rawCity;
      if (!state && rawState) state = rawState;
    }
  }

  // Extract insurance
  const insurances = ["delta dental", "aetna", "metlife", "cigna", "united", "blue cross", "humana", "guardian"];
  let insurance: string | undefined;
  for (const ins of insurances) {
    if (lowerQuery.includes(ins)) {
      insurance = ins;
      break;
    }
  }

  // Extract urgency
  let urgency: "emergency" | "same_day" | "weekend" | "normal" = "normal";
  if (lowerQuery.includes("emergency") || lowerQuery.includes("urgent") || lowerQuery.includes("asap")) {
    urgency = "emergency";
  } else if (lowerQuery.includes("today") || lowerQuery.includes("same day") || lowerQuery.includes("now")) {
    urgency = "same_day";
  } else if (lowerQuery.includes("weekend") || lowerQuery.includes("saturday") || lowerQuery.includes("sunday")) {
    urgency = "weekend";
  }

  // Extract preferences
  const preferenceKeywords = ["gentle", "pain-free", "painless", "experienced", "highly rated", "sedation", "female", "male", "speaks spanish"];
  const preferences = preferenceKeywords.filter(p => lowerQuery.includes(p));

  return {
    treatments,
    location: {
      state,
      city,
      nearMe: lowerQuery.includes("near me") || lowerQuery.includes("nearby") || lowerQuery.includes("close to me"),
      userLat: userLocation?.lat,
      userLon: userLocation?.lon,
      radiusKm: 15,
    },
    budget: {
      max: budgetMax,
      preference: budgetPreference,
    },
    quantity,
    insurance,
    urgency,
    preferences,
    originalQuery: query,
  };
}
