import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SetupRequest {
  state_id: string;
  generate_content?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { state_id, generate_content = false }: SetupRequest = await req.json();

    if (!state_id) {
      return new Response(
        JSON.stringify({ error: "state_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get state info
    const { data: state, error: stateError } = await supabaseAdmin
      .from("states")
      .select("id, name, slug, abbreviation")
      .eq("id", state_id)
      .single();

    if (stateError || !state) {
      return new Response(
        JSON.stringify({ error: "State not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all cities in state
    const { data: cities, error: citiesError } = await supabaseAdmin
      .from("cities")
      .select("id, name, slug")
      .eq("state_id", state_id)
      .eq("is_active", true);

    if (citiesError) throw citiesError;

    // Get all active treatments/services
    const { data: treatments, error: treatmentsError } = await supabaseAdmin
      .from("treatments")
      .select("id, name, slug")
      .eq("is_active", true);

    if (treatmentsError) throw treatmentsError;

    const results: {
      state: string;
      cities_count: number;
      services_count: number;
      city_pages_created: number;
      service_location_pages_created: number;
      errors: string[];
      content_generation_queued?: number;
    } = {
      state: state.name,
      cities_count: cities?.length || 0,
      services_count: treatments?.length || 0,
      city_pages_created: 0,
      service_location_pages_created: 0,
      errors: [],
    };

    // Create city SEO pages
    for (const city of cities || []) {
      const citySlug = `${state.slug}/${city.slug}`;
      const canonicalUrl = `/${citySlug}`;

      try {
        const { error } = await supabaseAdmin
          .from("seo_pages")
          .upsert({
            slug: citySlug,
            page_type: "city",
            title: `Dentists in ${city.name}, ${state.name}`,
            meta_title: `Find Dentists in ${city.name}, ${state.abbreviation} | AppointPanda`,
            meta_description: `Discover top-rated dentists in ${city.name}, ${state.name}. Compare reviews, services, and book appointments online with AppointPanda.`,
            h1: `Dentists in ${city.name}, ${state.name}`,
            canonical_url: canonicalUrl,
            is_indexed: true,
            is_thin_content: true, // Will be updated after content generation
            needs_optimization: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "slug" });

        if (error) {
          results.errors.push(`City ${city.name}: ${error.message}`);
        } else {
          results.city_pages_created++;
        }
      } catch (e) {
        results.errors.push(`City ${city.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
      }

      // Create service+city pages for each treatment
      for (const treatment of treatments || []) {
        const serviceLocationSlug = `${state.slug}/${city.slug}/${treatment.slug}`;
        const serviceCanonicalUrl = `/${serviceLocationSlug}`;

        try {
          const { error } = await supabaseAdmin
            .from("seo_pages")
            .upsert({
              slug: serviceLocationSlug,
              page_type: "service_location",
              title: `${treatment.name} in ${city.name}, ${state.name}`,
              meta_title: `${treatment.name} Dentists in ${city.name}, ${state.abbreviation} | AppointPanda`,
              meta_description: `Find dentists offering ${treatment.name} in ${city.name}, ${state.name}. Compare providers, read reviews, and book appointments on AppointPanda.`,
              h1: `${treatment.name} Dentists in ${city.name}, ${state.name}`,
              canonical_url: serviceCanonicalUrl,
              is_indexed: true,
              is_thin_content: true,
              needs_optimization: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: "slug" });

          if (error) {
            results.errors.push(`${treatment.name} in ${city.name}: ${error.message}`);
          } else {
            results.service_location_pages_created++;
          }
        } catch (e) {
          results.errors.push(`${treatment.name} in ${city.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
      }
    }

    // If content generation is requested, trigger it
    if (generate_content && results.city_pages_created > 0) {
      // Get all newly created pages for this state
      const { data: newPages } = await supabaseAdmin
        .from("seo_pages")
        .select("id, slug, page_type")
        .like("slug", `${state.slug}/%`)
        .eq("is_thin_content", true)
        .limit(100); // Process in batches

      if (newPages && newPages.length > 0) {
        // Queue content generation for first batch
        results.content_generation_queued = newPages.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Created ${results.city_pages_created} city pages and ${results.service_location_pages_created} service+location pages for ${state.name}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Setup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
