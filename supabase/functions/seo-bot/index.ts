import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Synonym pools for title/description variety
const TITLE_VERBS = ["Find", "Book", "Discover", "Search", "Connect with", "Get", "Schedule"];
const TITLE_MODIFIERS = ["Top", "Best-Rated", "Trusted", "Experienced", "Licensed", "Verified", "Expert"];
const LOCATION_PHRASES = ["Near You", "in Your Area", "Today", "Online", "Now"];
const DESC_OPENERS = [
  "Looking for", "Need", "Find", "Search for", "Discover", "Connect with", "Book appointments with"
];
const DESC_CLOSERS = [
  "Book online today.", "Schedule your visit now.", "Free consultations available.",
  "Compare reviews and book.", "Same-day appointments possible.", "Verified professionals."
];

// Helper to pick random from array deterministically based on slug
function pickFromSeed(arr: string[], seed: string, index = 0): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i) + index;
    hash = hash & hash;
  }
  return arr[Math.abs(hash) % arr.length];
}

// Truncate to max length while respecting word boundaries
function truncateTitle(title: string, maxLen: number = 60): string {
  if (title.length <= maxLen) return title;
  const truncated = title.slice(0, maxLen - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

// Generate unique title based on page type and data (max 60 chars)
function generateTitle(pageType: string, data: Record<string, any>): string {
  const slug = data.slug || "";
  const name = data.name || data.title || "";
  const cityName = data.cityName || "";
  const stateAbbr = data.stateAbbr || "";
  
  let title = "";
  
  switch (pageType) {
    case "state":
      title = `${pickFromSeed(TITLE_MODIFIERS, slug)} Dentists in ${name}`;
      break;
    
    case "city": {
      const loc = stateAbbr ? `${name}, ${stateAbbr}` : name;
      title = `Dentists in ${loc} - Book Online`;
      break;
    }
    
    case "treatment":
      title = `${name} - Find Dental Providers`;
      break;
    
    case "city_treatment": {
      const loc = stateAbbr ? `${cityName}, ${stateAbbr}` : cityName;
      title = `${name} in ${loc}`;
      break;
    }
    
    case "clinic": {
      const loc = cityName && stateAbbr ? ` - ${cityName}, ${stateAbbr}` : "";
      title = `${name}${loc}`;
      break;
    }
    
    case "dentist": {
      const spec = data.specialty ? `, ${data.specialty}` : "";
      title = `${name}${spec}${cityName ? ` in ${cityName}` : ""}`;
      break;
    }
    
    case "blog":
      title = `${name} | Dental Tips`;
      break;
    
    case "static":
      title = `${name} | AppointPanda`;
      break;
    
    default:
      title = `${name || "Dental Care"} | AppointPanda`;
  }
  
  return truncateTitle(title, 60);
}

// Truncate description to max length
function truncateDesc(desc: string, maxLen: number = 155): string {
  if (desc.length <= maxLen) return desc;
  const truncated = desc.slice(0, maxLen - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 50 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

// Generate unique meta description (max 155 chars)
function generateDescription(pageType: string, data: Record<string, any>): string {
  const slug = data.slug || "";
  const name = data.name || data.title || "";
  const cityName = data.cityName || "";
  const stateAbbr = data.stateAbbr || "";
  const clinicCount = data.clinicCount || 0;
  
  const opener = pickFromSeed(DESC_OPENERS, slug);
  const closer = pickFromSeed(DESC_CLOSERS, slug, 1);
  
  let desc = "";
  
  switch (pageType) {
    case "state":
      desc = `${opener} dentists in ${name}? Browse verified dental professionals, compare ratings and ${closer.toLowerCase()}`;
      break;
    
    case "city": {
      const loc = stateAbbr ? `${name}, ${stateAbbr}` : name;
      desc = `${opener} a dentist in ${loc}? Explore dental clinics with verified reviews and ${closer.toLowerCase()}`;
      break;
    }
    
    case "treatment":
      desc = `Learn about ${name.toLowerCase()} treatment. Find qualified providers, compare costs, and book online.`;
      break;
    
    case "city_treatment": {
      const loc = stateAbbr ? `${cityName}, ${stateAbbr}` : cityName;
      desc = `${opener} ${name.toLowerCase()} in ${loc}? Compare providers, read reviews and ${closer.toLowerCase()}`;
      break;
    }
    
    case "clinic": {
      const loc = cityName ? ` in ${cityName}` : "";
      desc = `${name}${loc} - View services, patient reviews, hours and contact info. ${closer}`;
      break;
    }
    
    case "dentist":
      desc = `${name}${data.specialty ? `, ${data.specialty}` : ""} - Read patient reviews and ${closer.toLowerCase()}`;
      break;
    
    case "blog":
      desc = data.excerpt || `${name} - Expert dental health advice and tips from verified professionals.`;
      break;
    
    case "static": {
      const staticDescs: Record<string, string> = {
        "/": "Find and book trusted dentists near you. Compare reviews and schedule appointments online.",
        "/services": "Browse dental services from cleanings to implants. Find providers in your area.",
        "/blog": "Expert dental health tips and oral care advice from verified professionals.",
        "/insurance": "Find dentists that accept your insurance. Compare in-network providers.",
        "/about": "AppointPanda connects patients with verified dental professionals.",
        "/contact": "Get in touch with AppointPanda. Questions about booking or listings?",
        "/faq": "FAQs about AppointPanda. Learn how to find dentists and book appointments.",
        "/how-it-works": "Book a dentist in 3 easy steps. Search, compare, and schedule online.",
        "/pricing": "Transparent pricing for dental practices. List your clinic on AppointPanda.",
        "/privacy": "Learn how AppointPanda protects your personal information and data.",
        "/terms": "Terms of service for AppointPanda platform users.",
        "/sitemap": "Browse all pages on AppointPanda. Find dentists by location or service.",
      };
      desc = staticDescs[slug] || `${name} - AppointPanda helps you find trusted dentists online.`;
      break;
    }
    
    default:
      desc = `Find trusted dental care with AppointPanda. ${closer}`;
  }
  
  return truncateDesc(desc, 155);
}

// Generate unique H1 (different from title)
function generateH1(pageType: string, data: Record<string, any>): string {
  const slug = data.slug || "";
  const name = data.name || data.title || "";
  const cityName = data.cityName || "";
  const stateAbbr = data.stateAbbr || "";
  
  switch (pageType) {
    case "state":
      return `Dentists in ${name}`;
    
    case "city": {
      const locationPart = stateAbbr ? `${name}, ${stateAbbr}` : name;
      return `Find a Dentist in ${locationPart}`;
    }
    
    case "treatment":
      return `${name} Dental Services`;
    
    case "city_treatment": {
      const locationPart = stateAbbr ? `${cityName}, ${stateAbbr}` : cityName;
      return `${name} in ${locationPart}`;
    }
    
    case "clinic":
      return name;
    
    case "dentist":
      return data.title ? `${data.title} ${name}` : name;
    
    case "blog":
      return name;
    
    case "static": {
      const staticH1s: Record<string, string> = {
        "/": "Find Your Perfect Dentist",
        "/services": "Dental Services & Treatments",
        "/blog": "Dental Health Insights",
        "/insurance": "Dental Insurance Guide",
        "/about": "About AppointPanda",
        "/contact": "Contact Us",
        "/faq": "Frequently Asked Questions",
        "/how-it-works": "How AppointPanda Works",
        "/pricing": "Pricing for Practices",
        "/privacy": "Privacy Policy",
        "/terms": "Terms of Service",
        "/sitemap": "Site Directory",
      };
      return staticH1s[slug] || name;
    }
    
    default:
      return name || "Dental Care";
  }
}

// Simple hash function for change detection
function hashMetadata(title: string, desc: string, h1: string): string {
  const str = `${title}|${desc}|${h1}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Similarity check using Jaccard index on word sets
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Paginated fetch to get ALL records without hitting limits
async function fetchAllRecords(supabase: any, table: string, select: string, filters: Record<string, any> = {}): Promise<any[]> {
  const allRecords: any[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase.from(table).select(select).range(page * pageSize, (page + 1) * pageSize - 1);
    
    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === true || value === false) {
        query = query.eq(key, value);
      } else if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      allRecords.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  
  return allRecords;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify super_admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action || "audit";
    const now = new Date().toISOString();
    const batchId = `batch_${Date.now()}`;

    // Get bot settings
    const { data: settingsRows } = await supabaseAdmin
      .from("seo_bot_settings")
      .select("setting_key, setting_value");
    
    const settings: Record<string, any> = {};
    for (const s of settingsRows ?? []) {
      settings[s.setting_key] = s.setting_value;
    }

    const similarityThreshold = settings.similarity_threshold?.title || 0.85;

    if (action === "generate_metadata") {
      // Create audit run record
      const { data: runData } = await supabaseAdmin
        .from("seo_audit_runs")
        .insert({
          run_type: "metadata_full",
          status: "running",
          started_at: now,
          triggered_by: user.id,
        })
        .select("id")
        .single();

      const runId = runData?.id;

      console.log("Starting full metadata generation...");

      // Fetch ALL entities - no limits
      const [states, cities, treatments, clinics, dentists, blogPosts] = await Promise.all([
        fetchAllRecords(supabaseAdmin, "states", "id,slug,name,abbreviation", { is_active: true }),
        fetchAllRecords(supabaseAdmin, "cities", "id,slug,name,state_id", { is_active: true }),
        fetchAllRecords(supabaseAdmin, "treatments", "id,slug,name", { is_active: true }),
        fetchAllRecords(supabaseAdmin, "clinics", "id,slug,name,city_id", { is_active: true }),
        fetchAllRecords(supabaseAdmin, "dentists", "id,slug,name,title,specializations,clinic_id", { is_active: true }),
        supabaseAdmin.from("blog_posts").select("id,slug,title,excerpt").eq("status", "published"),
      ]);

      // Build lookup maps for efficient joining
      const stateMap = new Map<string, any>();
      for (const s of states) {
        stateMap.set(s.id, s);
      }

      const cityMap = new Map<string, any>();
      const citiesByState = new Map<string, any[]>();
      for (const c of cities) {
        const state = stateMap.get(c.state_id);
        if (state) {
          cityMap.set(c.id, { ...c, state });
          if (!citiesByState.has(c.state_id)) {
            citiesByState.set(c.state_id, []);
          }
          citiesByState.get(c.state_id)!.push(c);
        }
      }

      const clinicCityMap = new Map<string, any>();
      for (const clinic of clinics) {
        if (clinic.city_id && cityMap.has(clinic.city_id)) {
          clinicCityMap.set(clinic.id, cityMap.get(clinic.city_id));
        }
      }

      console.log(`Loaded: ${states.length} states, ${cities.length} cities, ${treatments.length} treatments, ${clinics.length} clinics`);

      const allPages: Array<{
        slug: string;
        page_type: string;
        data: Record<string, any>;
      }> = [];

      // 1. Static pages
      const staticPages = ["/", "/services", "/blog", "/insurance", "/about", "/contact", "/faq", "/how-it-works", "/pricing", "/privacy", "/terms", "/sitemap"];
      for (const slug of staticPages) {
        allPages.push({ slug, page_type: "static", data: { slug, name: slug.slice(1) || "Home" } });
      }

      // 2. State pages
      for (const s of states) {
        allPages.push({
          slug: `/${s.slug}`,
          page_type: "state",
          data: { slug: s.slug, name: s.name, stateAbbr: s.abbreviation },
        });
      }

      // 3. City pages
      for (const c of cities) {
        const state = stateMap.get(c.state_id);
        if (state) {
          allPages.push({
            slug: `/${state.slug}/${c.slug}`,
            page_type: "city",
            data: {
              slug: c.slug,
              name: c.name,
              stateName: state.name,
              stateAbbr: state.abbreviation,
            },
          });
        }
      }

      // 4. Treatment (service) pages
      for (const t of treatments) {
        allPages.push({
          slug: `/services/${t.slug}`,
          page_type: "treatment",
          data: { slug: t.slug, name: t.name },
        });
      }

      // 5. City + Treatment combo pages (THE BIG ONE - ~5,040 pages)
      for (const c of cities) {
        const state = stateMap.get(c.state_id);
        if (state) {
          for (const t of treatments) {
            allPages.push({
              slug: `/${state.slug}/${c.slug}/${t.slug}`,
              page_type: "city_treatment",
              data: {
                slug: `${c.slug}-${t.slug}`,
                name: t.name,
                cityName: c.name,
                stateName: state.name,
                stateAbbr: state.abbreviation,
              },
            });
          }
        }
      }

      // 6. Clinic pages (ALL 6,501)
      for (const clinic of clinics) {
        const cityData = clinicCityMap.get(clinic.id);
        allPages.push({
          slug: `/clinic/${clinic.slug}`,
          page_type: "clinic",
          data: {
            slug: clinic.slug,
            name: clinic.name,
            cityName: cityData?.name,
            stateAbbr: cityData?.state?.abbreviation,
          },
        });
      }

      // 7. Dentist pages
      for (const d of dentists) {
        const clinicCity = clinicCityMap.get(d.clinic_id);
        allPages.push({
          slug: `/dentist/${d.slug}`,
          page_type: "dentist",
          data: {
            slug: d.slug,
            name: d.name,
            title: d.title,
            specialty: d.specializations?.[0],
            cityName: clinicCity?.name,
          },
        });
      }

      // 8. Blog pages
      const blogData = blogPosts.data ?? [];
      for (const p of blogData) {
        allPages.push({
          slug: `/blog/${p.slug}`,
          page_type: "blog",
          data: { slug: p.slug, name: p.title, excerpt: p.excerpt },
        });
      }

      console.log(`Total pages to process: ${allPages.length}`);

      // Generate metadata for ALL pages
      const updates: Array<{
        slug: string;
        page_type: string;
        title: string;
        meta_title: string;
        meta_description: string;
        h1: string;
        og_title: string;
        og_description: string;
        canonical_url: string;
        metadata_hash: string;
        is_indexed: boolean;
        last_generated_at: string;
        updated_at: string;
      }> = [];

      const historyRecords: Array<{
        slug: string;
        new_title: string;
        new_meta_description: string;
        new_h1: string;
        change_reason: string;
        changed_by: string;
        batch_id: string;
      }> = [];

      // Track titles for duplicate detection
      const titleMap = new Map<string, string[]>();

      for (const page of allPages) {
        const title = generateTitle(page.page_type, page.data);
        const description = generateDescription(page.page_type, page.data);
        const h1 = generateH1(page.page_type, page.data);
        const metaHash = hashMetadata(title, description, h1);

        // Track for duplicates
        const titleLower = title.toLowerCase();
        if (!titleMap.has(titleLower)) {
          titleMap.set(titleLower, []);
        }
        titleMap.get(titleLower)!.push(page.slug);

        updates.push({
          slug: page.slug,
          page_type: page.page_type,
          title: page.data.name || page.data.title || "",
          meta_title: title,
          meta_description: description,
          h1: h1,
          og_title: title,
          og_description: description,
          canonical_url: `https://www.appointpanda.com${page.slug}`,
          metadata_hash: metaHash,
          is_indexed: true,
          last_generated_at: now,
          updated_at: now,
        });

        historyRecords.push({
          slug: page.slug,
          new_title: title,
          new_meta_description: description,
          new_h1: h1,
          change_reason: "Full SEO audit - automated metadata generation",
          changed_by: user.id,
          batch_id: batchId,
        });
      }

      // Check for duplicates
      const duplicateTitles: string[] = [];
      for (const [title, slugs] of titleMap.entries()) {
        if (slugs.length > 1) {
          duplicateTitles.push(`"${title.slice(0, 50)}..." used by ${slugs.length} pages`);
        }
      }

      console.log(`Upserting ${updates.length} pages...`);

      // Upsert pages in larger batches for efficiency
      let fixedPages = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const batch of chunk(updates, 500)) {
        const { error } = await supabaseAdmin
          .from("seo_pages")
          .upsert(batch, { onConflict: "slug" });
        if (error) {
          console.error("Upsert error:", error);
          errorCount++;
          errors.push(error.message);
        } else {
          fixedPages += batch.length;
        }
      }

      console.log(`Upserted ${fixedPages} pages, ${errorCount} errors`);

      // Store history (skip if too large to avoid timeouts)
      if (historyRecords.length <= 2000) {
        for (const batch of chunk(historyRecords, 500)) {
          await supabaseAdmin.from("seo_metadata_history").insert(batch);
        }
      }

      // Update run status
      if (runId) {
        await supabaseAdmin.from("seo_audit_runs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          total_pages: allPages.length,
          processed_pages: updates.length,
          fixed_pages: fixedPages,
          error_count: errorCount,
          errors: errors.slice(0, 10),
          summary: {
            states: states.length,
            cities: cities.length,
            treatments: treatments.length,
            city_treatment_combos: cities.length * treatments.length,
            clinics: clinics.length,
            dentists: dentists.length,
            blog: blogData.length,
            static: staticPages.length,
            duplicate_titles_found: duplicateTitles.length,
            duplicates_sample: duplicateTitles.slice(0, 5),
          },
        }).eq("id", runId);
      }

      return new Response(JSON.stringify({
        success: true,
        action: "generate_metadata",
        total_pages: allPages.length,
        processed_pages: updates.length,
        fixed_pages: fixedPages,
        error_count: errorCount,
        duplicate_titles_found: duplicateTitles.length,
        batch_id: batchId,
        run_id: runId,
        breakdown: {
          states: states.length,
          cities: cities.length,
          treatments: treatments.length,
          city_treatment_combos: cities.length * treatments.length,
          clinics: clinics.length,
          dentists: dentists.length,
          blog: blogData.length,
          static: staticPages.length,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_duplicates") {
      // Fetch all seo_pages with metadata
      const pages = await fetchAllRecords(supabaseAdmin, "seo_pages", "id,slug,meta_title,meta_description");

      const duplicates: Array<{
        type: "title" | "description";
        value: string;
        pages: string[];
      }> = [];

      // Check for exact title duplicates
      const titleMap = new Map<string, string[]>();
      const descMap = new Map<string, string[]>();

      for (const p of pages) {
        if (p.meta_title) {
          const key = p.meta_title.trim().toLowerCase();
          if (!titleMap.has(key)) titleMap.set(key, []);
          titleMap.get(key)!.push(p.slug);
        }
        if (p.meta_description) {
          const key = p.meta_description.trim().toLowerCase();
          if (!descMap.has(key)) descMap.set(key, []);
          descMap.get(key)!.push(p.slug);
        }
      }

      for (const [title, slugs] of titleMap.entries()) {
        if (slugs.length > 1) {
          duplicates.push({ type: "title", value: title.slice(0, 60), pages: slugs });
        }
      }

      for (const [desc, slugs] of descMap.entries()) {
        if (slugs.length > 1) {
          duplicates.push({ type: "description", value: desc.slice(0, 80), pages: slugs });
        }
      }

      // Update is_duplicate flags
      const duplicateSlugs = new Set<string>();
      for (const d of duplicates) {
        for (const slug of d.pages) {
          duplicateSlugs.add(slug);
        }
      }

      // Clear existing duplicate flags
      await supabaseAdmin
        .from("seo_pages")
        .update({ is_duplicate: false, updated_at: now })
        .eq("is_duplicate", true);

      // Set new duplicate flags
      if (duplicateSlugs.size > 0) {
        const slugArray = Array.from(duplicateSlugs);
        for (const batch of chunk(slugArray, 500)) {
          await supabaseAdmin
            .from("seo_pages")
            .update({ is_duplicate: true, updated_at: now })
            .in("slug", batch);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        action: "check_duplicates",
        total_pages_checked: pages.length,
        exact_title_duplicates: duplicates.filter(d => d.type === "title").length,
        exact_description_duplicates: duplicates.filter(d => d.type === "description").length,
        flagged_pages: duplicateSlugs.size,
        duplicates_sample: duplicates.slice(0, 20),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "audit") {
      // Quick audit - just count and report issues
      const totalPages = await fetchAllRecords(supabaseAdmin, "seo_pages", "slug,meta_title,meta_description,is_indexed,is_duplicate");
      
      const issues = {
        missing_title: 0,
        missing_description: 0,
        short_title: 0,
        long_title: 0,
        short_description: 0,
        long_description: 0,
        duplicates: 0,
        not_indexed: 0,
      };

      for (const p of totalPages) {
        if (!p.meta_title) issues.missing_title++;
        else if (p.meta_title.length < 30) issues.short_title++;
        else if (p.meta_title.length > 70) issues.long_title++;
        
        if (!p.meta_description) issues.missing_description++;
        else if (p.meta_description.length < 100) issues.short_description++;
        else if (p.meta_description.length > 170) issues.long_description++;
        
        if (p.is_duplicate) issues.duplicates++;
        if (!p.is_indexed) issues.not_indexed++;
      }

      return new Response(JSON.stringify({
        success: true,
        action: "audit",
        total_pages: totalPages.length,
        issues,
        health_score: Math.round((1 - (Object.values(issues).reduce((a, b) => a + b, 0) / (totalPages.length * 6))) * 100),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rollback") {
      const { batch_id: targetBatchId, page_slug } = body;

      if (!targetBatchId && !page_slug) {
        return new Response(JSON.stringify({ success: false, error: "batch_id or page_slug required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabaseAdmin.from("seo_metadata_history").select("*");
      if (targetBatchId) query = query.eq("batch_id", targetBatchId);
      if (page_slug) query = query.eq("slug", page_slug);

      const { data: history } = await query.order("created_at", { ascending: false });

      if (!history?.length) {
        return new Response(JSON.stringify({ success: false, error: "No history found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        action: "rollback",
        records_found: history.length,
        sample: history.slice(0, 5).map(h => ({
          slug: h.slug,
          changed_at: h.created_at,
          batch_id: h.batch_id,
        })),
        message: "Rollback preview - implement actual rollback as needed",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_settings") {
      return new Response(JSON.stringify({
        success: true,
        settings,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_settings") {
      const { key, value } = body;
      if (!key) {
        return new Response(JSON.stringify({ success: false, error: "key required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("seo_bot_settings")
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_at: now,
          updated_by: user.id,
        }, { onConflict: "setting_key" });

      return new Response(JSON.stringify({
        success: true,
        action: "update_settings",
        key,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_runs") {
      const { data: runs } = await supabaseAdmin
        .from("seo_audit_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({
        success: true,
        runs: runs ?? [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: return current stats
    const totalPages = await fetchAllRecords(supabaseAdmin, "seo_pages", "id,is_duplicate,meta_title");

    const stats = {
      total_pages: totalPages.length,
      duplicates: totalPages.filter(p => p.is_duplicate).length,
      missing_meta: totalPages.filter(p => !p.meta_title).length,
    };

    return new Response(JSON.stringify({
      success: true,
      stats,
      available_actions: ["generate_metadata", "check_duplicates", "audit", "rollback", "get_settings", "update_settings", "get_runs"],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("seo-bot error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
