import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.appointpanda.com";
const DEFAULT_BATCH_SIZE = 50;

interface PageData {
  path: string;
  pageType: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  content: string;
  breadcrumbs: { name: string; url: string }[];
  structuredData?: object;
}

interface GenerationProgress {
  page_type: string;
  current_offset: number;
  total_count: number;
  status: string;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

function generateHtml(page: PageData): string {
  const breadcrumbsHtml = page.breadcrumbs
    .map((b, i) => `<a href="${b.url}">${b.name}</a>${i < page.breadcrumbs.length - 1 ? ' &gt; ' : ''}`)
    .join('');

  const structuredDataScript = page.structuredData
    ? `<script type="application/ld+json">${JSON.stringify(page.structuredData)}</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.metaTitle)}</title>
  <meta name="description" content="${escapeHtml(page.metaDescription)}">
  <link rel="canonical" href="${BASE_URL}${page.path}">
  
  <meta property="og:title" content="${escapeHtml(page.metaTitle)}">
  <meta property="og:description" content="${escapeHtml(page.metaDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE_URL}${page.path}">
  <meta property="og:site_name" content="AppointPanda">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.metaTitle)}">
  <meta name="twitter:description" content="${escapeHtml(page.metaDescription)}">
  
  <meta name="robots" content="index, follow">
  <meta name="googlebot" content="index, follow">
  
  ${structuredDataScript}
  
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #1a1a1a; }
    h2 { font-size: 1.75rem; margin-top: 2rem; color: #2a2a2a; }
    h3 { font-size: 1.25rem; margin-top: 1.5rem; color: #3a3a3a; }
    p { margin: 1rem 0; color: #444; }
    a { color: #0066cc; }
    .breadcrumbs { font-size: 0.875rem; color: #666; margin-bottom: 1.5rem; }
    .breadcrumbs a { color: #0066cc; text-decoration: none; }
    .content { margin-top: 2rem; }
    .cta { background: #10b981; color: white; padding: 1rem 2rem; border-radius: 8px; display: inline-block; text-decoration: none; margin-top: 2rem; }
    ul, ol { margin: 1rem 0; padding-left: 1.5rem; }
    li { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <nav class="breadcrumbs">${breadcrumbsHtml}</nav>
  
  <main>
    <h1>${escapeHtml(page.h1)}</h1>
    
    <div class="content">
      ${markdownToHtml(page.content)}
    </div>
    
    <a href="${BASE_URL}${page.path}" class="cta">Book an Appointment</a>
  </main>
  
  <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #eee; color: #666;">
    <p>&copy; ${new Date().getFullYear()} AppointPanda. All rights reserved.</p>
    <p>
      <a href="/about">About</a> | 
      <a href="/contact">Contact</a> | 
      <a href="/privacy">Privacy Policy</a> | 
      <a href="/terms">Terms of Service</a>
    </p>
  </footer>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p>Content coming soon.</p>';
  
  return markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hulo])/gm, '<p>')
    .replace(/(?<![>])$/gm, '</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hulo])/g, '$1')
    .replace(/(<\/[hulo][^>]*>)<\/p>/g, '$1');
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

async function fetchAllRows(supabase: any, table: string, selectQuery: string, filters: Record<string, any> = {}) {
  const allRows: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    let query = supabase.from(table).select(selectQuery).range(offset, offset + limit - 1);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) { console.error(`Error fetching ${table}:`, error); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return allRows;
}

async function updateProgress(supabase: any, pageType: string, updates: Partial<GenerationProgress>) {
  await supabase
    .from('static_page_generation_progress')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('page_type', pageType);
}

async function getProgress(supabase: any): Promise<GenerationProgress[]> {
  const { data } = await supabase
    .from('static_page_generation_progress')
    .select('*')
    .order('page_type');
  return data || [];
}

async function getCachedPaths(supabase: any, pageType: string): Promise<Set<string>> {
  const paths = new Set<string>();
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('static_page_cache')
      .select('path')
      .eq('page_type', pageType)
      .range(offset, offset + limit - 1);
    
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      paths.add(row.path);
    }
    if (data.length < limit) break;
    offset += limit;
  }
  
  return paths;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, pageType, batchSize = DEFAULT_BATCH_SIZE, reset = false } = await req.json().catch(() => ({}));

    // Clear cache action
    if (action === 'clear_cache') {
      console.log(`Clearing cache${pageType ? ` for ${pageType}` : ' for all types'}`);
      
      let query = supabase.from('static_page_cache').select('id', { count: 'exact', head: true });
      
      if (pageType && pageType !== 'all') {
        if (pageType === 'stale') {
          query = query.eq('is_stale', true);
        } else {
          query = query.eq('page_type', pageType);
        }
      }
      
      // First get count
      const { count: countBeforeDelete } = await query;
      
      // Now delete
      let deleteQuery = supabase.from('static_page_cache').delete();
      
      if (pageType && pageType !== 'all') {
        if (pageType === 'stale') {
          deleteQuery = deleteQuery.eq('is_stale', true);
        } else {
          deleteQuery = deleteQuery.eq('page_type', pageType);
        }
      } else {
        // Delete all - need a condition
        deleteQuery = deleteQuery.not('id', 'is', null);
      }
      
      const { error: deleteError } = await deleteQuery;
      
      if (deleteError) {
        console.error('Error deleting cache:', deleteError);
        throw deleteError;
      }
      
      // Also reset progress for the type if specified
      if (pageType && pageType !== 'all' && pageType !== 'stale') {
        await updateProgress(supabase, pageType, { 
          current_offset: 0, 
          status: 'idle', 
          last_error: null,
          completed_at: null
        });
      }
      
      console.log(`Deleted ${countBeforeDelete || 0} cache entries`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        deleted: countBeforeDelete || 0,
        pageType: pageType || 'all'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset progress for a type
    if (action === 'reset') {
      if (pageType) {
        await updateProgress(supabase, pageType, { 
          current_offset: 0, 
          total_count: 0,
          status: 'idle', 
          last_error: null,
          started_at: null,
          completed_at: null
        });
      } else {
        // Reset all
        for (const type of ['state', 'city', 'service', 'service_location', 'clinic']) {
          await updateProgress(supabase, type, { 
            current_offset: 0, 
            total_count: 0,
            status: 'idle', 
            last_error: null,
            started_at: null,
            completed_at: null
          });
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get stats
    if (action === 'stats') {
      const states = await fetchAllRows(supabase, 'states', 'id', { is_active: true });
      const cities = await fetchAllRows(supabase, 'cities', 'id', { is_active: true });
      const treatments = await fetchAllRows(supabase, 'treatments', 'id', { is_active: true });
      const { count: clinicCount } = await supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_active', true);
      
      // Get cached counts by type
      const allCacheEntries = await fetchAllRows(supabase, 'static_page_cache', 'page_type', {});
      const cachedByType: Record<string, number> = {
        state: 0,
        city: 0,
        service: 0,
        service_location: 0,
        clinic: 0
      };
      for (const row of allCacheEntries) {
        if (row.page_type && cachedByType[row.page_type] !== undefined) {
          cachedByType[row.page_type]++;
        }
      }
      
      const totalPossible = states.length + cities.length + treatments.length + (cities.length * treatments.length) + (clinicCount || 0);
      const totalCached = Object.values(cachedByType).reduce((a, b) => a + b, 0);
      
      // Get progress info
      const progress = await getProgress(supabase);
      
      return new Response(JSON.stringify({
        cached: totalCached,
        stale: 0,
        totalPossible,
        breakdown: {
          states: states.length,
          cities: cities.length,
          treatments: treatments.length,
          serviceLocations: cities.length * treatments.length,
          clinics: clinicCount || 0
        },
        cachedByType,
        progress
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate pages in batches
    if (!pageType) {
      return new Response(JSON.stringify({ 
        error: "pageType is required for generation. Use 'state', 'city', 'service', 'service_location', or 'clinic'" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting batch generation for ${pageType}, batchSize=${batchSize}, reset=${reset}`);

    // Fetch reference data first to get total counts
    const states = await fetchAllRows(supabase, 'states', 'id, slug, name, abbreviation', { is_active: true });
    const cities = await fetchAllRows(supabase, 'cities', 'id, slug, name, state_id, states(slug, name, abbreviation)', { is_active: true });
    const treatments = await fetchAllRows(supabase, 'treatments', 'id, slug, name, description', { is_active: true });
    const seoPages = await fetchAllRows(supabase, 'seo_pages', 'slug, page_type, title, meta_title, meta_description, h1, content', {});

    const seoMap = new Map<string, any>();
    for (const sp of seoPages) {
      seoMap.set(sp.slug, sp);
    }

    // Get all already-cached paths for this type to skip them
    const cachedPaths = await getCachedPaths(supabase, pageType);
    console.log(`Found ${cachedPaths.size} already cached paths for ${pageType}`);

    // Build full item list based on page type
    let allItems: any[] = [];
    
    if (pageType === 'state') {
      allItems = states;
    } else if (pageType === 'city') {
      allItems = cities;
    } else if (pageType === 'service') {
      allItems = treatments;
    } else if (pageType === 'service_location') {
      for (const city of cities) {
        const stateData = Array.isArray(city.states) ? city.states[0] : city.states;
        if (!stateData?.slug) continue;
        for (const treatment of treatments) {
          allItems.push({ city, stateData, treatment });
        }
      }
    } else if (pageType === 'clinic') {
      const clinics = await fetchAllRows(supabase, 'clinics', 'id, slug, name, description, address, phone, rating, review_count, city_id, cities(slug, name, states(slug, name, abbreviation))', { is_active: true });
      allItems = clinics;
    }

    const totalCount = allItems.length;

    // Filter out already-cached items
    const uncachedItems: any[] = [];
    for (const item of allItems) {
      let path = '';
      if (pageType === 'state') {
        path = `/${item.slug}/`;
      } else if (pageType === 'city') {
        const stateData = Array.isArray(item.states) ? item.states[0] : item.states;
        if (!stateData?.slug) continue;
        path = `/${stateData.slug}/${item.slug}/`;
      } else if (pageType === 'service') {
        path = `/services/${item.slug}/`;
      } else if (pageType === 'service_location') {
        path = `/${item.stateData.slug}/${item.city.slug}/${item.treatment.slug}/`;
      } else if (pageType === 'clinic') {
        path = `/clinic/${item.slug}/`;
      }
      
      if (!cachedPaths.has(path)) {
        uncachedItems.push({ ...item, _path: path });
      }
    }

    const remainingCount = uncachedItems.length;
    console.log(`${remainingCount} pages remaining to generate for ${pageType} (${totalCount} total, ${cachedPaths.size} cached)`);

    // Update progress with totals
    await updateProgress(supabase, pageType, { 
      total_count: totalCount,
      current_offset: cachedPaths.size,
      status: remainingCount === 0 ? 'complete' : 'running',
      started_at: new Date().toISOString(),
      last_error: null,
      completed_at: remainingCount === 0 ? new Date().toISOString() : null
    });

    // Check if already complete
    if (remainingCount === 0) {
      return new Response(JSON.stringify({
        pageType,
        generated: 0,
        skipped: cachedPaths.size,
        errors: 0,
        currentOffset: cachedPaths.size,
        totalCount,
        done: true,
        remaining: 0,
        message: `All ${pageType} pages already cached`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get batch to process (first N uncached items)
    const batch = uncachedItems.slice(0, batchSize);
    const pagesToGenerate: PageData[] = [];
    const errors: string[] = [];

    // Generate page data for each item
    for (const item of batch) {
      try {
        let pageData: PageData | null = null;
        const path = item._path;

        if (pageType === 'state') {
          const seo = seoMap.get(path) || seoMap.get(`/${item.slug}`) || {};
          pageData = {
            path,
            pageType: 'state',
            title: seo.title || `Dentists in ${item.name}`,
            metaTitle: seo.meta_title || `Find Dentists in ${item.name} (${item.abbreviation}) | AppointPanda`,
            metaDescription: seo.meta_description || `Find and book appointments with top-rated dentists in ${item.name}. Compare verified clinics, read reviews, and schedule your visit today.`,
            h1: seo.h1 || `Find Dentists in ${item.name}`,
            content: seo.content || `Browse our directory of verified dental professionals in ${item.name}. Find the right dentist for your needs and book an appointment online.`,
            breadcrumbs: [
              { name: 'Home', url: '/' },
              { name: item.name, url: path }
            ],
            structuredData: {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": seo.meta_title || `Dentists in ${item.name}`,
              "description": seo.meta_description || `Find dentists in ${item.name}`,
              "url": `${BASE_URL}${path}`
            }
          };
        } else if (pageType === 'city') {
          const stateData = Array.isArray(item.states) ? item.states[0] : item.states;
          const seo = seoMap.get(path) || seoMap.get(`/${stateData.slug}/${item.slug}`) || {};
          pageData = {
            path,
            pageType: 'city',
            title: seo.title || `Dentists in ${item.name}, ${stateData.abbreviation || stateData.name}`,
            metaTitle: seo.meta_title || `Dentists in ${item.name}, ${stateData.abbreviation || stateData.name} | AppointPanda`,
            metaDescription: seo.meta_description || `Find top-rated dentists in ${item.name}, ${stateData.name}. Compare clinics, read patient reviews, and book appointments online.`,
            h1: seo.h1 || `Dentists in ${item.name}, ${stateData.abbreviation || stateData.name}`,
            content: seo.content || `Looking for a dentist in ${item.name}? Browse our verified directory of dental professionals offering a range of services from routine checkups to cosmetic dentistry.`,
            breadcrumbs: [
              { name: 'Home', url: '/' },
              { name: stateData.name, url: `/${stateData.slug}/` },
              { name: item.name, url: path }
            ],
            structuredData: {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": seo.meta_title || `Dentists in ${item.name}`,
              "url": `${BASE_URL}${path}`
            }
          };
        } else if (pageType === 'service') {
          const seo = seoMap.get(path) || seoMap.get(`/services/${item.slug}`) || {};
          pageData = {
            path,
            pageType: 'service',
            title: seo.title || item.name,
            metaTitle: seo.meta_title || `${item.name} | Find Dental Specialists | AppointPanda`,
            metaDescription: seo.meta_description || `Find dentists offering ${item.name}. Compare providers, read reviews, and book your appointment online.`,
            h1: seo.h1 || item.name,
            content: seo.content || item.description || `Find experienced dental professionals offering ${item.name}. Browse our directory to compare providers and book your appointment.`,
            breadcrumbs: [
              { name: 'Home', url: '/' },
              { name: 'Services', url: '/services/' },
              { name: item.name, url: path }
            ],
            structuredData: {
              "@context": "https://schema.org",
              "@type": "MedicalWebPage",
              "name": item.name,
              "url": `${BASE_URL}${path}`
            }
          };
        } else if (pageType === 'service_location') {
          const { city, stateData, treatment } = item;
          const seo = seoMap.get(path) || seoMap.get(`/${stateData.slug}/${city.slug}/${treatment.slug}`) || {};
          pageData = {
            path,
            pageType: 'service_location',
            title: seo.title || `${treatment.name} in ${city.name}, ${stateData.abbreviation || stateData.name}`,
            metaTitle: seo.meta_title || `${treatment.name} in ${city.name}, ${stateData.abbreviation || stateData.name} | AppointPanda`,
            metaDescription: seo.meta_description || `Find ${treatment.name} specialists in ${city.name}, ${stateData.name}. Compare providers, read reviews, and book your appointment.`,
            h1: seo.h1 || `${treatment.name} in ${city.name}, ${stateData.abbreviation || stateData.name}`,
            content: seo.content || `Looking for ${treatment.name} in ${city.name}? Browse our verified directory of dental professionals offering this service in your area.`,
            breadcrumbs: [
              { name: 'Home', url: '/' },
              { name: stateData.name, url: `/${stateData.slug}/` },
              { name: city.name, url: `/${stateData.slug}/${city.slug}/` },
              { name: treatment.name, url: path }
            ],
            structuredData: {
              "@context": "https://schema.org",
              "@type": "MedicalWebPage",
              "name": `${treatment.name} in ${city.name}`,
              "url": `${BASE_URL}${path}`
            }
          };
        } else if (pageType === 'clinic') {
          const cityData = Array.isArray(item.cities) ? item.cities[0] : item.cities;
          const stateData = cityData?.states ? (Array.isArray(cityData.states) ? cityData.states[0] : cityData.states) : null;
          const seo = seoMap.get(path) || seoMap.get(`/clinic/${item.slug}`) || {};
          const locationStr = cityData && stateData 
            ? `${cityData.name}, ${stateData.abbreviation || stateData.name}`
            : 'your area';
          pageData = {
            path,
            pageType: 'clinic',
            title: seo.title || item.name,
            metaTitle: seo.meta_title || `${item.name} | Dental Clinic in ${locationStr} | AppointPanda`,
            metaDescription: seo.meta_description || item.description || `${item.name} is a dental clinic in ${locationStr}. ${item.rating ? `Rated ${item.rating}/5` : ''} ${item.review_count ? `with ${item.review_count} reviews` : ''}. Book your appointment online.`,
            h1: seo.h1 || item.name,
            content: seo.content || item.description || `${item.name} offers quality dental care in ${locationStr}. ${item.address ? `Located at ${item.address}.` : ''} ${item.phone ? `Call ${item.phone} or book online.` : 'Book your appointment online today.'}`,
            breadcrumbs: [
              { name: 'Home', url: '/' },
              ...(stateData ? [{ name: stateData.name, url: `/${stateData.slug}/` }] : []),
              ...(cityData ? [{ name: cityData.name, url: `/${stateData?.slug}/${cityData.slug}/` }] : []),
              { name: item.name, url: path }
            ],
            structuredData: {
              "@context": "https://schema.org",
              "@type": "Dentist",
              "name": item.name,
              "description": item.description || `Dental clinic in ${locationStr}`,
              "url": `${BASE_URL}${path}`,
              ...(item.address && { "address": { "@type": "PostalAddress", "streetAddress": item.address } }),
              ...(item.phone && { "telephone": item.phone }),
              ...(item.rating && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": item.rating, "reviewCount": item.review_count || 0 } })
            }
          };
        }

        if (pageData) {
          pagesToGenerate.push(pageData);
        }
      } catch (err) {
        errors.push(`Error processing item: ${err}`);
      }
    }

    // Generate and upload HTML files
    let successCount = 0;
    for (const page of pagesToGenerate) {
      try {
        const html = generateHtml(page);
        const contentHash = hashContent(html);
        const storagePath = `${page.pageType}${page.path.replace(/\//g, '_')}${contentHash}.html`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('static-pages')
          .upload(storagePath, html, {
            contentType: 'text/html',
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload error for ${page.path}:`, uploadError);
          errors.push(`${page.path}: ${uploadError.message}`);
          continue;
        }

        // Insert cache entry (not upsert - we already filtered cached)
        const { error: cacheError } = await supabase
          .from('static_page_cache')
          .insert({
            path: page.path,
            page_type: page.pageType,
            storage_path: storagePath,
            content_hash: contentHash,
            generated_at: new Date().toISOString(),
            is_stale: false
          });

        if (cacheError) {
          // If duplicate, that's fine - count as success
          if (cacheError.code === '23505') {
            successCount++;
            continue;
          }
          console.error(`Cache error for ${page.path}:`, cacheError);
          errors.push(`${page.path}: cache error`);
          continue;
        }

        successCount++;
      } catch (err) {
        errors.push(`${page.path}: ${err}`);
      }
    }

    // Update progress
    const newCachedCount = cachedPaths.size + successCount;
    const newRemaining = totalCount - newCachedCount;
    const isDone = newRemaining <= 0;
    
    await updateProgress(supabase, pageType, {
      current_offset: newCachedCount,
      status: isDone ? 'complete' : 'running',
      completed_at: isDone ? new Date().toISOString() : null,
      last_error: errors.length > 0 ? errors.slice(0, 3).join('; ') : null
    });

    console.log(`Batch complete: ${successCount} new pages, ${newCachedCount}/${totalCount} total cached, ${newRemaining} remaining`);

    return new Response(JSON.stringify({
      pageType,
      generated: successCount,
      skipped: cachedPaths.size,
      errors: errors.length,
      errorDetails: errors.slice(0, 5),
      currentOffset: newCachedCount,
      totalCount,
      done: isDone,
      remaining: newRemaining
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const error = err as Error;
    console.error("Generate static pages error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
