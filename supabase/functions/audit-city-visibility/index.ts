import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action = 'audit' } = await req.json().catch(() => ({}));

    if (action === 'audit') {
      // Run city visibility audit - check all cities
      const results = await auditCityVisibility(supabase);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'City visibility audit completed',
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Audit city visibility error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function auditCityVisibility(supabase: any) {
  const stats = {
    totalCitiesChecked: 0,
    citiesWithDentists: 0,
    citiesWithoutDentists: 0,
    citiesHidden: 0,
    citiesActivated: 0,
    seoPagesUpdated: 0,
  };

  // Get all active states first
  const { data: activeStates, error: statesError } = await supabase
    .from('states')
    .select('id')
    .eq('is_active', true);

  if (statesError) {
    throw new Error(`Failed to fetch states: ${statesError.message}`);
  }

  const activeStateIds = (activeStates || []).map((s: any) => s.id);
  
  if (activeStateIds.length === 0) {
    return { ...stats, message: 'No active states found' };
  }

  // Fetch all cities in active states using pagination
  let allCities: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, is_active, seo_page_id')
      .in('state_id', activeStateIds)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (citiesError) {
      throw new Error(`Failed to fetch cities: ${citiesError.message}`);
    }

    if (!cities || cities.length === 0) {
      hasMore = false;
    } else {
      allCities = [...allCities, ...cities];
      if (cities.length < pageSize) {
        hasMore = false;
      }
      page++;
    }
  }

  stats.totalCitiesChecked = allCities.length;

  // For each city, check if it has at least one approved clinic
  for (const city of allCities) {
    const { count, error: countError } = await supabase
      .from('clinics')
      .select('*', { count: 'exact', head: true })
      .eq('city_id', city.id)
      .eq('claim_status', 'approved')
      .eq('is_active', true)
      .eq('is_duplicate', false);

    if (countError) {
      console.error(`Error counting clinics for city ${city.id}:`, countError);
      continue;
    }

    const hasDentists = (count || 0) > 0;

    if (hasDentists) {
      stats.citiesWithDentists++;
      
      // If city was inactive but has dentists, activate it
      if (!city.is_active) {
        const { error: updateError } = await supabase
          .from('cities')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', city.id);
        
        if (!updateError) {
          stats.citiesActivated++;
        }

        // Also update SEO page if exists
        if (city.seo_page_id) {
          await supabase
            .from('seo_pages')
            .update({ is_indexed: true, updated_at: new Date().toISOString() })
            .eq('id', city.seo_page_id);
          stats.seoPagesUpdated++;
        }
      }
    } else {
      stats.citiesWithoutDentists++;
      
      // If city was active but has no dentists, deactivate it
      if (city.is_active) {
        const { error: updateError } = await supabase
          .from('cities')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', city.id);
        
        if (!updateError) {
          stats.citiesHidden++;
        }

        // Also update SEO page to not be indexed
        if (city.seo_page_id) {
          await supabase
            .from('seo_pages')
            .update({ is_indexed: false, updated_at: new Date().toISOString() })
            .eq('id', city.seo_page_id);
          stats.seoPagesUpdated++;
        }
      }
    }
  }

  return stats;
}
