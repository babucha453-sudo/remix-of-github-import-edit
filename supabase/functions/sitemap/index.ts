import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.appointpanda.com";
const CHUNK_SIZE = 2500; // Max URLs per sitemap chunk

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority: number;
  changefreq: string;
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Normalize URL - ensure trailing slash (canonical format) and no double slashes
function normalizeUrl(path: string): string {
  // Remove leading slash if present (we'll add BASE_URL)
  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Remove double slashes
  cleanPath = cleanPath.replace(/\/+/g, '/');

  // Add trailing slash (canonical: WITH trailing slash)
  // Exception: root path stays as /
  if (cleanPath !== '/' && !cleanPath.endsWith('/')) {
    cleanPath = cleanPath + '/';
  }

  return `${BASE_URL}${cleanPath}`;
}

// Validate URL - must not have double slashes (except after protocol)
function isValidSitemapUrl(loc: string): boolean {
  if (!loc || loc.length < 10) return false;
  // Check for double slashes after the protocol
  const afterProtocol = loc.replace('https://', '');
  if (afterProtocol.includes('//')) return false;
  // Check for empty path segments
  if (loc.endsWith('//')) return false;
  return true;
}

// Generate individual sitemap XML (no XSL for cleaner parsing)
function generateSitemapXml(urls: SitemapUrl[]): string {
  // Filter out invalid URLs
  const validUrls = urls.filter(url => isValidSitemapUrl(url.loc));

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${validUrls
      .map(
        (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${new Date(url.lastmod).toISOString().split("T")[0]}</lastmod>` : ""}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
      )
      .join("\n")}
</urlset>`;
}

// Generate sitemap index dynamically based on URL counts
function generateSitemapIndex(clinicChunks: number, serviceLocationChunks: number, cityChunks: number = 1): string {
  const today = new Date().toISOString().split("T")[0];
  const sitemaps: string[] = [
    "sitemap-static.xml",
    "sitemap-states.xml", // NEW: Dedicated states sitemap
  ];

  // Add city chunks
  for (let i = 1; i <= cityChunks; i++) {
    sitemaps.push(cityChunks > 1 ? `sitemap-cities-${i}.xml` : "sitemap-cities.xml");
  }

  sitemaps.push("sitemap-services.xml");

  // Add service-location chunks
  for (let i = 1; i <= serviceLocationChunks; i++) {
    sitemaps.push(`sitemap-service-locations-${i}.xml`);
  }

  // Add clinic chunks (profiles)
  for (let i = 1; i <= clinicChunks; i++) {
    sitemaps.push(`sitemap-profiles-${i}.xml`); // Renamed from clinics to profiles
  }

  sitemaps.push("sitemap-dentists.xml", "sitemap-posts.xml");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
      .map(
        (sitemap) => `  <sitemap>
    <loc>${BASE_URL}/${sitemap}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`
      )
      .join("\n")}
</sitemapindex>`;
}

// Helper to fetch all rows with pagination (Supabase has 1000 row limit)
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

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }

    if (!data || data.length === 0) break;

    allRows.push(...data);

    if (data.length < limit) break;
    offset += limit;
  }

  return allRows;
}

// Get chunk of URLs
function getChunk(urls: SitemapUrl[], chunkIndex: number): SitemapUrl[] {
  const start = (chunkIndex - 1) * CHUNK_SIZE;
  const end = start + CHUNK_SIZE;
  return urls.slice(start, end);
}

// Calculate number of chunks needed
function getChunkCount(totalUrls: number): number {
  return Math.ceil(totalUrls / CHUNK_SIZE);
}

// Return response (skip compression for edge function compatibility)
function xmlResponse(xml: string, headers: Record<string, string>) {
  return new Response(xml, {
    headers: {
      ...headers,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Surrogate-Control": "max-age=300",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check URL for specific sitemap type and chunk
    const url = new URL(req.url);
    const sitemapType = url.searchParams.get("type") || "index";
    const chunkParam = url.searchParams.get("chunk");
    const chunk = chunkParam ? parseInt(chunkParam, 10) : null;

    console.log(`Generating sitemap type: ${sitemapType}, chunk: ${chunk}`);

    // STATIC PAGES SITEMAP
    if (sitemapType === "static") {
      const staticPages = [
        { path: "/", priority: 1.0, changefreq: "daily" },
        { path: "/services", priority: 0.9, changefreq: "weekly" },
        { path: "/blog", priority: 0.8, changefreq: "daily" },
        { path: "/about", priority: 0.5, changefreq: "monthly" },
        { path: "/contact", priority: 0.5, changefreq: "monthly" },
        { path: "/faq", priority: 0.6, changefreq: "monthly" },
        { path: "/how-it-works", priority: 0.6, changefreq: "monthly" },
        { path: "/pricing", priority: 0.6, changefreq: "monthly" },
        { path: "/insurance", priority: 0.6, changefreq: "monthly" },
        { path: "/sitemap", priority: 0.4, changefreq: "weekly" },
        { path: "/privacy", priority: 0.3, changefreq: "yearly" },
        { path: "/terms", priority: 0.3, changefreq: "yearly" },
      ];

      const urls: SitemapUrl[] = staticPages.map((page) => ({
        loc: normalizeUrl(page.path),
        priority: page.priority,
        changefreq: page.changefreq,
      }));

      console.log(`Static sitemap: ${urls.length} URLs`);
      return xmlResponse(generateSitemapXml(urls), corsHeaders);
    }

    // STATES SITEMAP (NEW - Dedicated)
    if (sitemapType === "states") {
      const urls: SitemapUrl[] = [];

      // Fetch active states
      const states = await fetchAllRows(supabase, "states", "id, slug, name, updated_at", { is_active: true });

      for (const state of states) {
        if (!state.slug || state.slug.trim() === '') continue;
        urls.push({
          loc: normalizeUrl(`/${state.slug}`),
          lastmod: state.updated_at,
          priority: 0.9,
          changefreq: "weekly",
        });
      }

      console.log(`States sitemap: ${urls.length} URLs`);
      return xmlResponse(generateSitemapXml(urls), corsHeaders);
    }

    // CITIES SITEMAP (Separated from locations)
    if (sitemapType === "cities") {
      const allUrls: SitemapUrl[] = [];

      // Cities with state relationship - only include cities with at least 1 clinic
      const cities = await fetchAllRows(supabase, "cities", "id, slug, updated_at, state_id, states(slug)", { is_active: true });

      // Get all active clinics to count per city
      const clinics = await fetchAllRows(supabase, "clinics", "city_id", { is_active: true, is_duplicate: false });

      const cityClinicMap: Record<string, number> = {};
      for (const c of clinics) {
        if (c.city_id) {
          cityClinicMap[c.city_id] = (cityClinicMap[c.city_id] || 0) + 1;
        }
      }

      for (const city of cities) {
        // Skip cities with no clinics (would be thin content / soft 404)
        if (!cityClinicMap[city.id] || cityClinicMap[city.id] < 1) continue;
        if (!city.slug || city.slug.trim() === '') continue;

        const stateData = Array.isArray(city.states) ? city.states[0] : city.states;
        if (stateData?.slug) {
          allUrls.push({
            loc: normalizeUrl(`/${stateData.slug}/${city.slug}`),
            lastmod: city.updated_at,
            priority: 0.85,
            changefreq: "weekly",
          });
        }
      }

      // If chunk specified, return that chunk
      if (chunk !== null && chunk > 0) {
        const chunkUrls = getChunk(allUrls, chunk);
        console.log(`Cities sitemap chunk ${chunk}: ${chunkUrls.length} URLs (total: ${allUrls.length})`);
        return xmlResponse(generateSitemapXml(chunkUrls), corsHeaders);
      }

      console.log(`Cities sitemap: ${allUrls.length} URLs`);
      return xmlResponse(generateSitemapXml(allUrls), corsHeaders);
    }

    // LOCATIONS SITEMAP (Legacy - redirects to cities for backwards compatibility)
    if (sitemapType === "locations") {
      // Redirect to cities sitemap for backwards compatibility
      console.log("Redirecting locations to cities sitemap");
      const urls: SitemapUrl[] = [];

      // Fetch active states
      const states = await fetchAllRows(supabase, "states", "id, slug, updated_at", { is_active: true });

      for (const state of states) {
        if (!state.slug || state.slug.trim() === '') continue;
        urls.push({
          loc: normalizeUrl(`/${state.slug}`),
          lastmod: state.updated_at,
          priority: 0.9,
          changefreq: "weekly",
        });
      }

      // Cities with state relationship - only include cities with at least 1 clinic
      const cities = await fetchAllRows(supabase, "cities", "id, slug, updated_at, state_id, states(slug)", { is_active: true });

      // Get all active clinics to count per city
      const clinics = await fetchAllRows(supabase, "clinics", "city_id", { is_active: true, is_duplicate: false });

      const cityClinicMap: Record<string, number> = {};
      for (const c of clinics) {
        if (c.city_id) {
          cityClinicMap[c.city_id] = (cityClinicMap[c.city_id] || 0) + 1;
        }
      }

      for (const city of cities) {
        // Skip cities with no clinics (would be thin content / soft 404)
        if (!cityClinicMap[city.id] || cityClinicMap[city.id] < 1) continue;
        if (!city.slug || city.slug.trim() === '') continue;

        const stateData = Array.isArray(city.states) ? city.states[0] : city.states;
        if (stateData?.slug) {
          urls.push({
            loc: normalizeUrl(`/${stateData.slug}/${city.slug}`),
            lastmod: city.updated_at,
            priority: 0.85,
            changefreq: "weekly",
          });
        }
      }

      console.log(`Locations sitemap (legacy): ${urls.length} URLs`);
      return xmlResponse(generateSitemapXml(urls), corsHeaders);
    }

    // SERVICES SITEMAP (Treatments)
    if (sitemapType === "services") {
      const urls: SitemapUrl[] = [];

      const treatments = await fetchAllRows(supabase, "treatments", "slug, updated_at", { is_active: true });

      for (const treatment of treatments) {
        if (!treatment.slug || treatment.slug.trim() === '') continue;
        urls.push({
          loc: normalizeUrl(`/services/${treatment.slug}`),
          lastmod: treatment.updated_at,
          priority: 0.8,
          changefreq: "weekly",
        });
      }

      console.log(`Services sitemap: ${urls.length} URLs`);
      return xmlResponse(generateSitemapXml(urls), corsHeaders);
    }

    // SERVICE-LOCATION COMBINATIONS SITEMAP (CHUNKED)
    if (sitemapType === "service-locations") {
      const allUrls: SitemapUrl[] = [];

      // Get cities with clinic counts
      const cities = await fetchAllRows(supabase, "cities", "id, slug, states(slug)", { is_active: true });
      const treatments = await fetchAllRows(supabase, "treatments", "slug", { is_active: true });

      // Get clinic counts per city to avoid thin content pages
      const clinics = await fetchAllRows(supabase, "clinics", "city_id", { is_active: true, is_duplicate: false });

      const cityClinicMap: Record<string, number> = {};
      for (const c of clinics) {
        if (c.city_id) {
          cityClinicMap[c.city_id] = (cityClinicMap[c.city_id] || 0) + 1;
        }
      }

      for (const city of cities) {
        // Skip cities with fewer than 2 clinics (thin content)
        if (!cityClinicMap[city.id] || cityClinicMap[city.id] < 2) continue;
        if (!city.slug || city.slug.trim() === '' || city.slug.startsWith('ae/')) continue;

        const stateData = Array.isArray(city.states) ? city.states[0] : city.states;
        if (stateData?.slug) {
          for (const treatment of treatments) {
            if (!treatment.slug || treatment.slug.trim() === '') continue;
            allUrls.push({
              loc: normalizeUrl(`/${stateData.slug}/${city.slug}/${treatment.slug}`),
              lastmod: city.updated_at, // Use city update time as proxy
              priority: 0.7,
              changefreq: "weekly",
            });
          }
        }
      }

      // If chunk specified, return that chunk
      if (chunk !== null && chunk > 0) {
        const chunkUrls = getChunk(allUrls, chunk);
        console.log(`Service-locations sitemap chunk ${chunk}: ${chunkUrls.length} URLs (total: ${allUrls.length})`);
        return xmlResponse(generateSitemapXml(chunkUrls), corsHeaders);
      }

      // Otherwise return full (for backwards compatibility, though shouldn't be used)
      console.log(`Service-locations sitemap (full): ${allUrls.length} URLs`);
      return xmlResponse(generateSitemapXml(allUrls), corsHeaders);
    }

    // PROFILES SITEMAP (Clinics - CHUNKED) - Renamed for SEO clarity
    if (sitemapType === "profiles" || sitemapType === "clinics") {
      const allUrls: SitemapUrl[] = [];

      const clinicsData = await fetchAllRows(supabase, "clinics", "slug, updated_at, description", { is_active: true, is_duplicate: false });

      for (const clinic of clinicsData) {
        // Skip clinics with invalid slugs
        if (!clinic.slug || clinic.slug.trim() === '') continue;

        const hasThinContent = !clinic.description || clinic.description.length < 50;
        allUrls.push({
          loc: normalizeUrl(`/clinic/${clinic.slug}`),
          lastmod: clinic.updated_at,
          priority: hasThinContent ? 0.5 : 0.7,
          changefreq: "weekly",
        });
      }

      // If chunk specified, return that chunk
      if (chunk !== null && chunk > 0) {
        const chunkUrls = getChunk(allUrls, chunk);
        console.log(`Profiles sitemap chunk ${chunk}: ${chunkUrls.length} URLs (total: ${allUrls.length})`);
        return xmlResponse(generateSitemapXml(chunkUrls), corsHeaders);
      }

      // Otherwise return full (for backwards compatibility)
      console.log(`Profiles sitemap (full): ${allUrls.length} URLs`);
      return xmlResponse(generateSitemapXml(allUrls), corsHeaders);
    }

    // DENTISTS SITEMAP
    if (sitemapType === "dentists") {
      const urls: SitemapUrl[] = [];

      const dentists = await fetchAllRows(supabase, "dentists", "slug, updated_at, bio", { is_active: true });

      for (const dentist of dentists) {
        // Skip dentists with invalid slugs
        if (!dentist.slug || dentist.slug.trim() === '') continue;

        const hasThinContent = !dentist.bio || dentist.bio.length < 50;
        urls.push({
          loc: normalizeUrl(`/dentist/${dentist.slug}`),
          lastmod: dentist.updated_at,
          priority: hasThinContent ? 0.4 : 0.6,
          changefreq: "weekly",
        });
      }

      console.log(`Dentists sitemap: ${urls.length} URLs`);
      return xmlResponse(generateSitemapXml(urls), corsHeaders);
    }

    // BLOG POSTS SITEMAP
    if (sitemapType === "posts") {
      const urls: SitemapUrl[] = [];

      const posts = await fetchAllRows(supabase, "blog_posts", "slug, updated_at, published_at", { status: "published" });

      for (const post of posts) {
        if (!post.slug || post.slug.trim() === '') continue;
        urls.push({
          loc: normalizeUrl(`/blog/${post.slug}`),
          lastmod: post.updated_at || post.published_at || undefined,
          priority: 0.6,
          changefreq: "monthly",
        });
      }

      console.log(`Posts sitemap: ${urls.length} URLs`);
      return xmlResponse(generateSitemapXml(urls), corsHeaders);
    }

    // DEFAULT: Return sitemap index with dynamically calculated chunks
    console.log("Generating sitemap index with dynamic chunks");

    // Count clinics to determine chunks
    const clinicsData = await fetchAllRows(supabase, "clinics", "id", { is_active: true, is_duplicate: false });
    const clinicChunks = getChunkCount(clinicsData.length);

    // Count cities to determine chunks
    const citiesAll = await fetchAllRows(supabase, "cities", "id", { is_active: true });
    const cityChunks = getChunkCount(citiesAll.length);

    // Count service-location combinations
    const cities = await fetchAllRows(supabase, "cities", "id, state_id", { is_active: true });
    const treatments = await fetchAllRows(supabase, "treatments", "id", { is_active: true });
    const clinicsForCount = await fetchAllRows(supabase, "clinics", "city_id", { is_active: true, is_duplicate: false });

    const cityClinicMap: Record<string, number> = {};
    for (const c of clinicsForCount) {
      if (c.city_id) {
        cityClinicMap[c.city_id] = (cityClinicMap[c.city_id] || 0) + 1;
      }
    }

    const citiesWithClinics = cities.filter(city => cityClinicMap[city.id] && cityClinicMap[city.id] >= 1);
    const serviceLocationCount = citiesWithClinics.length * treatments.length;
    const serviceLocationChunks = getChunkCount(serviceLocationCount);

    console.log(`Index: ${clinicsData.length} profiles (${clinicChunks} chunks), ${citiesWithClinics.length} cities, ${serviceLocationCount} service-locations (${serviceLocationChunks} chunks)`);

    return xmlResponse(generateSitemapIndex(clinicChunks, serviceLocationChunks, cityChunks), corsHeaders);
  } catch (err) {
    const error = err as Error;
    console.error("Sitemap generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
