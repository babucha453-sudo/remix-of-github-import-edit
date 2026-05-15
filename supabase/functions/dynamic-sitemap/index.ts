import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.appointpanda.com";
const CHUNK_SIZE = 1000;

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority: number;
  changefreq: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeUrl(path: string): string {
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  cleanPath = cleanPath.replace(/\/+/g, '/');
  if (cleanPath !== '/' && !cleanPath.endsWith('/')) {
    cleanPath = cleanPath + '/';
  }
  return `${BASE_URL}${cleanPath}`;
}

function generateSitemapXml(urls: SitemapUrl[]): string {
  const validUrls = urls.filter(url => {
    if (!url.loc || url.loc.length < 10) return false;
    const afterProtocol = url.loc.replace('https://', '');
    return !afterProtocol.includes('//') && !url.loc.endsWith('//');
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${validUrls
    .map((url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${new Date(url.lastmod).toISOString().split('T')[0]}</lastmod>` : ''}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`)
    .join('\n')}
</urlset>`;
}

function generateSitemapIndex(sitemaps: Array<{loc: string; lastmod: string}>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
    .map((sitemap) => `  <sitemap>
    <loc>${escapeXml(sitemap.loc)}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`)
    .join('\n')}
</sitemapindex>`;
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

function getChunk(urls: SitemapUrl[], chunkIndex: number): SitemapUrl[] {
  const start = (chunkIndex - 1) * CHUNK_SIZE;
  return urls.slice(start, start + CHUNK_SIZE);
}

function getChunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / CHUNK_SIZE));
}

async function getAllCitiesWithClinics(supabase: any): Promise<Array<{id: string; slug: string; stateSlug: string; updated_at: string}>> {
  const cities = await fetchAllRows(supabase, "cities", "id, slug, updated_at, states(slug)", { is_active: true });
  const clinics = await fetchAllRows(supabase, "clinics", "city_id", { is_active: true, is_duplicate: false });
  
  const cityClinicMap: Record<string, number> = {};
  for (const c of clinics) {
    if (c.city_id) cityClinicMap[c.city_id] = (cityClinicMap[c.city_id] || 0) + 1;
  }
  
  return cities
    .filter(city => cityClinicMap[city.id] && cityClinicMap[city.id] > 0)
    .map(city => {
      const stateData = Array.isArray(city.states) ? city.states[0] : city.states;
      return { id: city.id, slug: city.slug, stateSlug: stateData?.slug || '', updated_at: city.updated_at };
    })
    .filter(city => city.slug && city.stateSlug);
}

async function generateCounts(supabase: any) {
  const clinics = await fetchAllRows(supabase, "clinics", "id, slug, description", { is_active: true, is_duplicate: false });
  const states = await fetchAllRows(supabase, "states", "id", { is_active: true });
  const cities = await getAllCitiesWithClinics(supabase);
  const treatments = await fetchAllRows(supabase, "treatments", "id", { is_active: true });
  const insurances = await fetchAllRows(supabase, "insurances", "id", { is_active: true });
  const blogPosts = await fetchAllRows(supabase, "blog_posts", "id", { status: "published" });
  const dentists = await fetchAllRows(supabase, "dentists", "id", { is_active: true });

  const clinicChunks = getChunkCount(clinics.length);
  const cityChunks = getChunkCount(cities.length);
  const serviceLocationCount = cities.length * treatments.length;
  const serviceLocationChunks = getChunkCount(serviceLocationCount);
  const insuranceChunks = getChunkCount(insurances.length);

  return {
    clinics, clinicChunks,
    states, stateCount: states.length,
    cities, cityChunks,
    treatments, treatmentCount: treatments.length,
    serviceLocationCount, serviceLocationChunks,
    insurances, insuranceChunks,
    blogPosts, blogCount: blogPosts.length,
    dentists, dentistCount: dentists.length
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const sitemapType = url.searchParams.get("type") || "index";
    const chunk = url.searchParams.get("chunk") ? parseInt(url.searchParams.get("chunk")!, 10) : null;
    const today = new Date().toISOString().split("T")[0];

    const xmlResponse = (xml: string) => new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" }
    });

    const counts = await generateCounts(supabase);

    if (sitemapType === "index") {
      const sitemaps = [
        { loc: `${BASE_URL}/sitemap-static.xml`, lastmod: today },
        { loc: `${BASE_URL}/sitemap-states.xml`, lastmod: today },
      ];
      for (let i = 1; i <= counts.cityChunks; i++) {
        sitemaps.push({ loc: `${BASE_URL}/sitemap-cities${counts.cityChunks > 1 ? `-${i}` : ''}.xml`, lastmod: today });
      }
      sitemaps.push({ loc: `${BASE_URL}/sitemap-services.xml`, lastmod: today });
      for (let i = 1; i <= counts.serviceLocationChunks; i++) {
        sitemaps.push({ loc: `${BASE_URL}/sitemap-service-locations-${i}.xml`, lastmod: today });
      }
      sitemaps.push({ loc: `${BASE_URL}/sitemap-insurance.xml`, lastmod: today });
      for (let i = 1; i <= counts.clinicChunks; i++) {
        sitemaps.push({ loc: `${BASE_URL}/sitemap-profiles-${i}.xml`, lastmod: today });
      }
      sitemaps.push(
        { loc: `${BASE_URL}/sitemap-blog.xml`, lastmod: today },
        { loc: `${BASE_URL}/sitemap-dentists.xml`, lastmod: today }
      );
      return xmlResponse(generateSitemapIndex(sitemaps));
    }

    if (sitemapType === "static") {
      const staticPages = [
        { path: "/", priority: 1.0, changefreq: "daily" },
        { path: "/search", priority: 0.9, changefreq: "daily" },
        { path: "/find-dentist", priority: 0.9, changefreq: "daily" },
        { path: "/services", priority: 0.9, changefreq: "weekly" },
        { path: "/blog", priority: 0.8, changefreq: "daily" },
        { path: "/insurance", priority: 0.8, changefreq: "weekly" },
        { path: "/about", priority: 0.5, changefreq: "monthly" },
        { path: "/contact", priority: 0.5, changefreq: "monthly" },
        { path: "/faq", priority: 0.6, changefreq: "monthly" },
        { path: "/how-it-works", priority: 0.6, changefreq: "monthly" },
        { path: "/pricing", priority: 0.6, changefreq: "monthly" },
        { path: "/emergency-dentist", priority: 0.8, changefreq: "weekly" },
        { path: "/tools/dental-cost-calculator", priority: 0.6, changefreq: "monthly" },
        { path: "/tools/insurance-checker", priority: 0.6, changefreq: "monthly" },
        { path: "/sitemap", priority: 0.4, changefreq: "weekly" },
        { path: "/privacy", priority: 0.3, changefreq: "yearly" },
        { path: "/terms", priority: 0.3, changefreq: "yearly" },
      ];
      return xmlResponse(generateSitemapXml(staticPages.map(p => ({ loc: normalizeUrl(p.path), priority: p.priority, changefreq: p.changefreq }))));
    }

    if (sitemapType === "states") {
      const urls: SitemapUrl[] = counts.states.map(s => ({
        loc: normalizeUrl(`/${s.id}`),
        priority: 0.9,
        changefreq: "weekly"
      }));
      const statesData = await fetchAllRows(supabase, "states", "slug, updated_at", { is_active: true });
      for (const state of statesData) {
        if (state.slug) urls.push({ loc: normalizeUrl(`/${state.slug}`), lastmod: state.updated_at, priority: 0.9, changefreq: "weekly" });
      }
      return xmlResponse(generateSitemapXml(urls));
    }

    if (sitemapType === "cities") {
      let urls: SitemapUrl[] = counts.cities.map(c => ({
        loc: normalizeUrl(`/${c.stateSlug}/${c.slug}`),
        lastmod: c.updated_at,
        priority: 0.85,
        changefreq: "weekly"
      }));
      if (chunk !== null) urls = getChunk(urls, chunk);
      return xmlResponse(generateSitemapXml(urls));
    }

    if (sitemapType === "services") {
      const treatments = await fetchAllRows(supabase, "treatments", "slug, updated_at", { is_active: true });
      const urls: SitemapUrl[] = treatments.filter(t => t.slug).map(t => ({
        loc: normalizeUrl(`/services/${t.slug}`),
        lastmod: t.updated_at,
        priority: 0.8,
        changefreq: "weekly"
      }));
      return xmlResponse(generateSitemapXml(urls));
    }

    if (sitemapType === "service-locations") {
      const treatments = await fetchAllRows(supabase, "treatments", "slug", { is_active: true });
      let urls: SitemapUrl[] = [];
      for (const city of counts.cities) {
        for (const treatment of treatments) {
          if (treatment.slug) {
            urls.push({
              loc: normalizeUrl(`/${city.stateSlug}/${city.slug}/${treatment.slug}`),
              lastmod: city.updated_at,
              priority: 0.7,
              changefreq: "weekly"
            });
          }
        }
      }
      if (chunk !== null) urls = getChunk(urls, chunk);
      return xmlResponse(generateSitemapXml(urls));
    }

    if (sitemapType === "insurance") {
      const insurances = await fetchAllRows(supabase, "insurances", "slug, created_at", { is_active: true });
      let urls: SitemapUrl[] = [];
      urls.push({ loc: normalizeUrl("/insurance"), priority: 0.8, changefreq: "weekly" });
      for (const ins of insurances) {
        if (ins.slug) {
          urls.push({
            loc: normalizeUrl(`/insurance/${ins.slug}`),
            lastmod: ins.created_at,
            priority: 0.7,
            changefreq: "weekly"
          });
        }
      }
      if (chunk !== null) urls = getChunk(urls, chunk);
      return xmlResponse(generateSitemapXml(urls));
    }

    if (sitemapType === "profiles" || sitemapType === "clinics") {
      const clinicsData = await fetchAllRows(supabase, "clinics", "id, slug, description", { is_active: true, is_duplicate: false });
      let urls: SitemapUrl[] = clinicsData.filter(c => c.slug).map(c => {
        const hasContent = c.description && c.description.length >= 50;
        return { loc: normalizeUrl(`/clinic/${c.slug}`), priority: hasContent ? 0.7 : 0.5, changefreq: "weekly" };
      });
      if (chunk !== null) urls = getChunk(urls, chunk);
      return xmlResponse(generateSitemapXml(urls));
    }

    if (sitemapType === "blog" || sitemapType === "posts") {
      const posts = await fetchAllRows(supabase, "blog_posts", "slug, updated_at, published_at", { status: "published" });
      const urls: SitemapUrl[] = posts.filter(p => p.slug).map(p => ({
        loc: normalizeUrl(`/blog/${p.slug}`),
        lastmod: p.updated_at || p.published_at,
        priority: 0.6,
        changefreq: "monthly"
      }));
      return xmlResponse(generateSitemapXml(urls));
    }

    if (sitemapType === "dentists") {
      const dentists = await fetchAllRows(supabase, "dentists", "slug, updated_at, bio", { is_active: true });
      const urls: SitemapUrl[] = dentists.filter(d => d.slug).map(d => ({
        loc: normalizeUrl(`/dentist/${d.slug}`),
        lastmod: d.updated_at,
        priority: d.bio && d.bio.length >= 50 ? 0.6 : 0.4,
        changefreq: "weekly"
      }));
      return xmlResponse(generateSitemapXml(urls));
    }

    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><error>Unknown sitemap type</error>`);
  } catch (err) {
    console.error("Sitemap error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});