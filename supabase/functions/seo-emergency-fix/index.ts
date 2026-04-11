// ============================================================================
// SEO Emergency Fix Edge Function
// Implements critical fixes from SEO Audit:
// 1. Clears all poisoned cache entries (pages with noindex or thin content)
// 2. Validates and marks thin content pages
// 3. Forces regeneration of critical pages
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    console.log(`SEO Emergency Fix - Action: ${action}`);

    switch (action) {
      case 'clear_all_cache':
        return await clearAllCache(supabase);
      
      case 'clear_stale_cache':
        return await clearStaleCache(supabase);
      
      case 'identify_thin_content':
        return await identifyThinContent(supabase);
      
      case 'mark_all_stale':
        return await markAllStale(supabase);
      
      case 'force_regenerate_top_pages':
        return await forceRegenerateTopPages(supabase);
      
      case 'status':
      default:
        return await getStatus(supabase);
    }

  } catch (err) {
    const error = err as Error;
    console.error("SEO Emergency Fix error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Get current cache and thin content status
 */
async function getStatus(supabase: any) {
  // Get cache stats
  const { data: cacheStats, error: cacheError } = await supabase
    .from('static_page_cache')
    .select('page_type, is_stale, count')
    .group('page_type, is_stale');

  if (cacheError) {
    console.error('Failed to get cache stats:', cacheError);
  }

  // Get thin content count
  const { count: thinContentCount, error: thinError } = await supabase
    .from('seo_pages')
    .select('*', { count: 'exact', head: true })
    .eq('is_thin_content', true);

  if (thinError) {
    console.error('Failed to get thin content count:', thinError);
  }

  // Get total seo_pages count
  const { count: totalSeoPages, error: totalError } = await supabase
    .from('seo_pages')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('Failed to get total seo_pages count:', totalError);
  }

  // Get pages with no content
  const { count: noContentCount, error: noContentError } = await supabase
    .from('seo_pages')
    .select('*', { count: 'exact', head: true })
    .or('content.is.null,content.eq.');

  if (noContentError) {
    console.error('Failed to get no content count:', noContentError);
  }

  // Calculate cache breakdown
  const breakdown: Record<string, { cached: number; stale: number }> = {};
  if (cacheStats) {
    for (const row of cacheStats) {
      if (!breakdown[row.page_type]) {
        breakdown[row.page_type] = { cached: 0, stale: 0 };
      }
      if (row.is_stale) {
        breakdown[row.page_type].stale = parseInt(row.count);
      } else {
        breakdown[row.page_type].cached = parseInt(row.count);
      }
    }
  }

  const totalCached = Object.values(breakdown).reduce((sum, p) => sum + p.cached + p.stale, 0);

  return new Response(
    JSON.stringify({
      status: 'ok',
      cache: {
        total: totalCached,
        breakdown,
      },
      content: {
        total_seo_pages: totalSeoPages || 0,
        thin_content: thinContentCount || 0,
        no_content: noContentCount || 0,
        healthy_content: (totalSeoPages || 0) - (thinContentCount || 0) - (noContentCount || 0),
      },
      issues: {
        has_stale_cache: Object.values(breakdown).some(p => p.stale > 0),
        has_thin_content: (thinContentCount || 0) > 0,
        has_no_content: (noContentCount || 0) > 0,
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Clear ALL cache entries - EMERGENCY FIX for noindex poisoning
 */
async function clearAllCache(supabase: any) {
  console.log('Clearing ALL cache entries...');

  // Delete all entries from static_page_cache
  const { data: deleted, error: deleteError } = await supabase
    .from('static_page_cache')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    .select('count');

  if (deleteError) {
    console.error('Failed to clear cache:', deleteError);
    return new Response(
      JSON.stringify({ error: 'Failed to clear cache', details: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const deletedCount = deleted?.length || 0;
  console.log(`Deleted ${deletedCount} cache entries`);

  return new Response(
    JSON.stringify({
      action: 'clear_all_cache',
      success: true,
      deleted_count: deletedCount,
      message: `Successfully cleared ${deletedCount} cache entries. All pages will be regenerated on next bot visit.`,
      next_steps: [
        'Request recrawl in Google Search Console for top 50 pages',
        'Monitor indexing status in GSC over next 2-4 weeks',
        'Regenerate critical pages using the static page generator'
      ]
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Clear only stale cache entries
 */
async function clearStaleCache(supabase: any) {
  console.log('Clearing stale cache entries...');

  const { data: deleted, error: deleteError } = await supabase
    .from('static_page_cache')
    .delete()
    .eq('is_stale', true)
    .select('path');

  if (deleteError) {
    console.error('Failed to clear stale cache:', deleteError);
    return new Response(
      JSON.stringify({ error: 'Failed to clear stale cache', details: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const deletedCount = deleted?.length || 0;
  const paths = deleted?.map((d: any) => d.path) || [];

  return new Response(
    JSON.stringify({
      action: 'clear_stale_cache',
      success: true,
      deleted_count: deletedCount,
      paths: paths.slice(0, 20), // Show first 20
      message: `Cleared ${deletedCount} stale cache entries`,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Mark ALL cache entries as stale (forces regeneration on next visit)
 */
async function markAllStale(supabase: any) {
  console.log('Marking all cache entries as stale...');

  const { data: updated, error: updateError } = await supabase
    .from('static_page_cache')
    .update({ is_stale: true })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('count');

  if (updateError) {
    console.error('Failed to mark cache as stale:', updateError);
    return new Response(
      JSON.stringify({ error: 'Failed to mark cache as stale', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const updatedCount = updated?.length || 0;

  return new Response(
    JSON.stringify({
      action: 'mark_all_stale',
      success: true,
      updated_count: updatedCount,
      message: `Marked ${updatedCount} cache entries as stale. They will be regenerated on next bot visit.`,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Identify pages with thin content (< 500 words)
 */
async function identifyThinContent(supabase: any) {
  console.log('Identifying thin content pages...');

  // Find pages with content length < 500 characters (roughly < 100 words)
  // or null/empty content
  const { data: thinPages, error: selectError } = await supabase
    .from('seo_pages')
    .select('id, slug, page_type, meta_title, content')
    .or('content.is.null,content.eq.,word_count.lt.100')
    .limit(100);

  if (selectError) {
    console.error('Failed to identify thin content:', selectError);
    return new Response(
      JSON.stringify({ error: 'Failed to identify thin content', details: selectError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Mark them as thin content
  if (thinPages && thinPages.length > 0) {
    const { error: updateError } = await supabase
      .from('seo_pages')
      .update({ is_thin_content: true })
      .in('id', thinPages.map((p: any) => p.id));

    if (updateError) {
      console.error('Failed to mark thin content:', updateError);
    }
  }

  return new Response(
    JSON.stringify({
      action: 'identify_thin_content',
      success: true,
      thin_pages_found: thinPages?.length || 0,
      sample_pages: (thinPages || []).slice(0, 10).map((p: any) => ({
        slug: p.slug,
        page_type: p.page_type,
        meta_title: p.meta_title,
        content_length: p.content?.length || 0,
      })),
      message: `Found and marked ${thinPages?.length || 0} pages with thin content`,
      recommendation: 'Use the seo-bulk-processor to generate content for these pages',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Force regenerate top priority pages (home, major cities, popular clinics)
 */
async function forceRegenerateTopPages(supabase: any) {
  console.log('Forcing regeneration of top pages...');

  // Get top cities by dentist count
  const { data: topCities, error: citiesError } = await supabase
    .from('cities')
    .select('slug, state:states(slug)')
    .order('dentist_count', { ascending: false })
    .limit(20);

  if (citiesError) {
    console.error('Failed to get top cities:', citiesError);
  }

  // Get top clinics by rating/review count
  const { data: topClinics, error: clinicsError } = await supabase
    .from('clinics')
    .select('slug')
    .gt('rating', 0)
    .order('review_count', { ascending: false })
    .limit(20);

  if (clinicsError) {
    console.error('Failed to get top clinics:', clinicsError);
  }

  const pagesToRegenerate: string[] = [
    '/', // Home
    '/about/',
    '/services/',
    '/blog/',
  ];

  // Add top cities
  if (topCities) {
    for (const city of topCities) {
      if (city.state?.slug && city.slug) {
        pagesToRegenerate.push(`/${city.state.slug}/${city.slug}/`);
      }
    }
  }

  // Add top clinics
  if (topClinics) {
    for (const clinic of topClinics) {
      if (clinic.slug) {
        pagesToRegenerate.push(`/clinic/${clinic.slug}/`);
      }
    }
  }

  // Mark these pages as stale in cache to force regeneration
  const { error: updateError } = await supabase
    .from('static_page_cache')
    .update({ is_stale: true })
    .in('path', pagesToRegenerate);

  if (updateError) {
    console.error('Failed to mark pages for regeneration:', updateError);
  }

  return new Response(
    JSON.stringify({
      action: 'force_regenerate_top_pages',
      success: true,
      pages_marked: pagesToRegenerate.length,
      pages: pagesToRegenerate.slice(0, 20),
      message: `Marked ${pagesToRegenerate.length} top pages for regeneration`,
      next_steps: [
        'Use Google Search Console to request recrawl of these pages',
        'Monitor indexing status in GSC',
        'Regenerate remaining pages using the static page generator'
      ]
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
