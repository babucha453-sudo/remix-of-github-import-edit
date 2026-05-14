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
    const mode = url.searchParams.get('mode') || 'status';
    const batchSize = parseInt(url.searchParams.get('batch') || '500');

    console.log(`SEO Cache Clear - Mode: ${mode}`);

    switch (mode) {
      case 'clear_noindex_cache':
        return await clearNoindexCache(supabase, batchSize);
      
      case 'clear_all':
        return await clearAllCache(supabase);
      
      case 'fix_noindex_headers':
        return await fixNoindexHeaders(supabase, batchSize);
      
      case 'status':
      default:
        return await getStatus(supabase);
    }

  } catch (err) {
    const error = err as Error;
    console.error("SEO Cache Clear error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getStatus(supabase: any) {
  const { data: cacheStats, error } = await supabase
    .from('static_page_cache')
    .select('id, path, page_type, is_stale, generated_at');

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to get cache status', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const total = cacheStats?.length || 0;
  const stale = cacheStats?.filter(c => c.is_stale).length || 0;
  const fresh = total - stale;

  return new Response(
    JSON.stringify({
      status: 'ok',
      total_cached: total,
      fresh_cache: fresh,
      stale_cache: stale,
      message: 'Cache is healthy. Use mode=clear_noindex_cache to remove poisoned cache entries.'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function clearNoindexCache(supabase: any, batchSize: number) {
  console.log(`Clearing noindex poisoned cache entries (batch size: ${batchSize})...`);

  let totalDeleted = 0;
  let batchNum = 0;

  while (true) {
    const { data: cachedPages, error: fetchError } = await supabase
      .from('static_page_cache')
      .select('id, path, storage_path')
      .limit(batchSize);

    if (fetchError) {
      console.error('Failed to fetch cache entries:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cache entries', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cachedPages || cachedPages.length === 0) {
      break;
    }

    const idsToDelete: string[] = [];
    const storagePathsToDelete: string[] = [];

    for (const entry of cachedPages) {
      let shouldDelete = false;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('static-pages')
        .download(entry.storage_path);

      if (!downloadError && fileData) {
        const html = await fileData.text();
        const hasNoindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex[^"']*["']\s*\/?>/gi.test(html);
        
        if (hasNoindex) {
          console.log(`Found noindex in cached page: ${entry.path}`);
          shouldDelete = true;
        }
      } else {
        console.log(`Missing file for cached page: ${entry.path} - marking for deletion`);
        shouldDelete = true;
      }

      if (shouldDelete) {
        idsToDelete.push(entry.id);
        storagePathsToDelete.push(entry.storage_path);
      }
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('static_page_cache')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Failed to delete cache entries:', deleteError);
      } else {
        totalDeleted += idsToDelete.length;
        console.log(`Deleted ${idsToDelete.length} noindex cache entries in batch ${batchNum}`);
      }

      for (const path of storagePathsToDelete) {
        try {
          await supabase.storage.from('static-pages').remove([path]);
        } catch (e) {
          console.log(`Could not remove storage file: ${path}`);
        }
      }
    }

    batchNum++;

    if (cachedPages.length < batchSize) {
      break;
    }
  }

  return new Response(
    JSON.stringify({
      mode: 'clear_noindex_cache',
      success: true,
      deleted_count: totalDeleted,
      batches_processed: batchNum,
      message: `Cleared ${totalDeleted} noindex poisoned cache entries. Pages will be regenerated with proper index headers on next bot visit.`,
      next_steps: [
        'Submit recrawl requests in Google Search Console for critical pages',
        'Monitor indexing status over the next 2-4 weeks',
        'For urgent pages, manually trigger regeneration via serve-static function'
      ]
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function fixNoindexHeaders(supabase: any, batchSize: number) {
  console.log(`Fixing noindex headers in cached pages (batch size: ${batchSize})...`);

  let totalFixed = 0;
  let batchNum = 0;

  while (true) {
    const { data: cachedPages, error: fetchError } = await supabase
      .from('static_page_cache')
      .select('id, path, storage_path')
      .eq('is_stale', false)
      .limit(batchSize);

    if (fetchError) {
      console.error('Failed to fetch cache entries:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cache entries', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cachedPages || cachedPages.length === 0) {
      break;
    }

    let batchFixed = 0;

    for (const entry of cachedPages) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('static-pages')
        .download(entry.storage_path);

      if (downloadError || !fileData) {
        continue;
      }

      let html = await fileData.text();
      const hasNoindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex[^"']*["']\s*\/?>/gi.test(html);

      if (hasNoindex) {
        html = html.replace(
          /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex[^"']*["']\s*\/?>/gi,
          '<meta name="robots" content="index, follow">'
        );

        try {
          await supabase.storage
            .from('static-pages')
            .upload(entry.storage_path, html, {
              contentType: 'text/html',
              upsert: true
            });
          
          batchFixed++;
          console.log(`Fixed noindex header in: ${entry.path}`);
        } catch (e) {
          console.error(`Failed to update ${entry.path}:`, e);
        }
      }
    }

    totalFixed += batchFixed;
    batchNum++;

    if (cachedPages.length < batchSize) {
      break;
    }
  }

  return new Response(
    JSON.stringify({
      mode: 'fix_noindex_headers',
      success: true,
      fixed_count: totalFixed,
      batches_processed: batchNum,
      message: `Fixed noindex headers in ${totalFixed} cached pages. These pages now have proper "index, follow" directives.`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function clearAllCache(supabase: any) {
  console.log('Clearing ALL cache entries...');

  const { data: allEntries, error: fetchError } = await supabase
    .from('static_page_cache')
    .select('id, storage_path');

  if (fetchError) {
    console.error('Failed to fetch cache:', fetchError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch cache', details: fetchError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let deletedCount = 0;
  const storagePaths: string[] = [];

  if (allEntries) {
    for (const entry of allEntries) {
      storagePaths.push(entry.storage_path);
    }

    const { error: deleteError } = await supabase
      .from('static_page_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Failed to delete cache:', deleteError);
    } else {
      deletedCount = allEntries.length;
    }

    try {
      await supabase.storage.from('static-pages').remove(storagePaths);
    } catch (e) {
      console.log('Could not remove some storage files');
    }
  }

  return new Response(
    JSON.stringify({
      mode: 'clear_all',
      success: true,
      deleted_count: deletedCount,
      message: `Cleared all ${deletedCount} cache entries. All pages will be regenerated on next bot visit with proper SEO headers.`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}