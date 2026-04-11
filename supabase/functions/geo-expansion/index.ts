import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AIMLAPI_KEY = Deno.env.get("AIMLAPI_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PageGenerationRequest {
  action: 
    | "generate_state_content"
    | "generate_city_content"
    | "validate_seo"
    | "publish_page"
    | "rollback_page"
    | "get_queue"
    | "approve_page"
    | "reject_page"
    | "get_settings"
    | "update_settings"
    | "get_stats"
    | "enqueue_page";
  entityId?: string;
  entityType?: "state" | "city";
  queueId?: string;
  settingKey?: string;
  settingValue?: any;
  batchId?: string;
  filters?: {
    status?: string;
    pageType?: string;
    limit?: number;
  };
}

// SEO Validation Rules
const SEO_RULES = {
  title: { min: 30, max: 60 },
  metaDescription: { min: 120, max: 160 },
  h1: { min: 10, max: 70 },
  contentMinWords: 400,
  contentMaxWords: 800,
  maxKeywordDensity: 0.03,
  duplicateSimilarityThreshold: 0.7,
  bannedPatterns: [
    /near me/gi,
    /nearby/gi,
    /close to me/gi,
    /best .*? in/gi,
    /top .*? dentist/gi,
    /#1 dentist/gi,
    /number one/gi,
  ],
};

// Generate unique content for state pages
async function generateStateContent(
  supabase: any,
  stateId: string
): Promise<{ success: boolean; content?: any; error?: string; confidenceScore?: number }> {
  const { data: state, error: stateError } = await supabase
    .from("states")
    .select("*")
    .eq("id", stateId)
    .single();

  if (stateError || !state) {
    return { success: false, error: "State not found" };
  }

  // Get existing city pages to avoid duplication
  const { data: existingPages } = await supabase
    .from("seo_pages")
    .select("h1, meta_title, content")
    .eq("page_type", "state")
    .neq("slug", state.slug)
    .limit(10);

  const existingContent = existingPages?.map((p: any) => p.h1 + " " + p.meta_title).join("\n") || "";

  const systemPrompt = `You are a senior local SEO strategist and healthcare content editor with 15+ years of experience.
Your goal is to create high-quality, E-E-A-T compliant content for dental directory location pages.

STRICT RULES:
1. NO fake statistics or claims about dentist counts
2. NO keyword stuffing - primary keyword max 2-3 times naturally
3. NO "near me", "nearby", "best", "top", "#1" or similar spam patterns
4. Content must be UNIQUE - do not duplicate phrases from other pages
5. Write for humans first, search engines second
6. Include helpful, actionable information
7. Maintain professional healthcare tone
8. Focus on what makes this specific location unique

EXISTING CONTENT TO AVOID DUPLICATING:
${existingContent.slice(0, 1500)}`;

  const userPrompt = `Create SEO-optimized content for a dental directory state page for ${state.name} (${state.abbreviation}).

Generate JSON with EXACTLY this structure:
{
  "h1": "Find Dentists in ${state.name}",
  "meta_title": "Dentists in ${state.name} | Find Local Dental Care | AppointPanda",
  "meta_description": "Looking for a dentist in ${state.name}? Browse verified dental professionals, read patient reviews, and book appointments online.",
  "intro": "Two paragraphs introducing dental care options in ${state.name}. Be specific about the state's healthcare landscape without making false claims.",
  "service_overview": "A paragraph about general dental services available in the state.",
  "faq": [
    {"question": "How do I find a dentist in ${state.name}?", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ],
  "internal_links": [
    {"text": "Browse cities in ${state.name}", "href": "/state/${state.slug}/"},
    {"text": "View dental services", "href": "/services/"}
  ],
  "schema_type": "LocalBusiness"
}

REQUIREMENTS:
- H1: 10-70 characters, location-focused
- Meta title: 30-60 characters, includes location and brand
- Meta description: 120-160 characters, compelling CTA
- Intro: 150-250 words, factual and helpful
- FAQ: 3-5 questions specific to ${state.name}
- No claims about dentist counts or rankings`;

  try {
    const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIMLAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AIMLAPI error:", errorText);
      return { success: false, error: `AI API error: ${response.status}` };
    }

    const result = await response.json();
    const contentText = result.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Failed to parse AI response as JSON" };
    }

    const content = JSON.parse(jsonMatch[0]);

    // Calculate confidence score based on quality checks
    let confidenceScore = 1.0;
    const issues: string[] = [];

    // Check title length
    if (content.meta_title?.length < SEO_RULES.title.min || content.meta_title?.length > SEO_RULES.title.max) {
      confidenceScore -= 0.1;
      issues.push("Title length out of range");
    }

    // Check meta description length
    if (content.meta_description?.length < SEO_RULES.metaDescription.min || 
        content.meta_description?.length > SEO_RULES.metaDescription.max) {
      confidenceScore -= 0.1;
      issues.push("Meta description length out of range");
    }

    // Check for banned patterns
    const allText = JSON.stringify(content).toLowerCase();
    for (const pattern of SEO_RULES.bannedPatterns) {
      if (pattern.test(allText)) {
        confidenceScore -= 0.15;
        issues.push(`Contains banned pattern: ${pattern.source}`);
      }
    }

    // Check H1 length
    if (content.h1?.length < SEO_RULES.h1.min || content.h1?.length > SEO_RULES.h1.max) {
      confidenceScore -= 0.1;
      issues.push("H1 length out of range");
    }

    return {
      success: true,
      content: {
        ...content,
        validationIssues: issues,
        wordCount: content.intro?.split(/\s+/).length + content.service_overview?.split(/\s+/).length,
      },
      confidenceScore: Math.max(0, confidenceScore),
    };
  } catch (error) {
    console.error("Content generation error:", error);
    return { success: false, error: String(error) };
  }
}

// Generate unique content for city pages
async function generateCityContent(
  supabase: any,
  cityId: string
): Promise<{ success: boolean; content?: any; error?: string; confidenceScore?: number }> {
  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select(`
      *,
      state:states(*)
    `)
    .eq("id", cityId)
    .single();

  if (cityError || !city) {
    return { success: false, error: "City not found" };
  }

  // Get existing pages from same state to ensure uniqueness
  const { data: existingPages } = await supabase
    .from("seo_pages")
    .select("h1, meta_title, content")
    .eq("page_type", "city")
    .like("slug", `${city.state?.slug}/%`)
    .neq("slug", `${city.state?.slug}/${city.slug}`)
    .limit(15);

  const existingContent = existingPages?.map((p: any) => p.h1 + " " + p.meta_title + " " + (p.content || "").slice(0, 200)).join("\n") || "";

  const systemPrompt = `You are a senior local SEO strategist and healthcare content editor with 15+ years of experience.
Your goal is to create high-quality, E-E-A-T compliant content for dental directory city pages.

STRICT RULES:
1. NO fake statistics or claims about dentist counts
2. NO keyword stuffing - primary keyword max 2-3 times naturally
3. NO "near me", "nearby", "best", "top", "#1" or similar spam patterns
4. Content must be UNIQUE - every city page must have different phrasing
5. Write for humans first, search engines second
6. Include helpful, actionable information specific to this city
7. Maintain professional healthcare tone
8. Reference local landmarks or neighborhoods if known

EXISTING CONTENT FROM OTHER CITIES IN ${city.state?.name?.toUpperCase()} TO AVOID:
${existingContent.slice(0, 2000)}`;

  const userPrompt = `Create SEO-optimized content for a dental directory city page for ${city.name}, ${city.state?.abbreviation}.

Generate JSON with EXACTLY this structure:
{
  "h1": "Dentists in ${city.name}, ${city.state?.abbreviation}",
  "meta_title": "Dentists in ${city.name}, ${city.state?.abbreviation} | AppointPanda",
  "meta_description": "Find dentists in ${city.name}, ${city.state?.abbreviation}. Browse verified dental professionals, read reviews, and book appointments.",
  "intro": "Two paragraphs about dental care in ${city.name}. Make it specific to this city - mention what makes dental care here accessible or unique. DO NOT copy from other cities.",
  "service_overview": "A paragraph about dental services available in ${city.name}.",
  "local_info": "A paragraph about the ${city.name} community and how residents can find quality dental care.",
  "faq": [
    {"question": "How do I find a dentist in ${city.name}?", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ],
  "internal_links": [
    {"text": "More dentists in ${city.state?.name}", "href": "/state/${city.state?.slug}/"},
    {"text": "View dental services", "href": "/services/"}
  ],
  "nearby_cities_placeholder": true,
  "schema_type": "LocalBusiness"
}

REQUIREMENTS:
- H1: 10-70 characters, city + state focused
- Meta title: 30-60 characters
- Meta description: 120-160 characters, compelling CTA
- Intro: 150-300 words, unique to ${city.name}
- FAQ: 3-5 questions specific to this city
- Content must be COMPLETELY DIFFERENT from other cities listed above`;

  try {
    const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIMLAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AIMLAPI error:", errorText);
      return { success: false, error: `AI API error: ${response.status}` };
    }

    const result = await response.json();
    const contentText = result.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Failed to parse AI response as JSON" };
    }

    const content = JSON.parse(jsonMatch[0]);

    // Calculate confidence score
    let confidenceScore = 1.0;
    const issues: string[] = [];

    if (content.meta_title?.length < SEO_RULES.title.min || content.meta_title?.length > SEO_RULES.title.max) {
      confidenceScore -= 0.1;
      issues.push("Title length out of range");
    }

    if (content.meta_description?.length < SEO_RULES.metaDescription.min || 
        content.meta_description?.length > SEO_RULES.metaDescription.max) {
      confidenceScore -= 0.1;
      issues.push("Meta description length out of range");
    }

    const allText = JSON.stringify(content).toLowerCase();
    for (const pattern of SEO_RULES.bannedPatterns) {
      if (pattern.test(allText)) {
        confidenceScore -= 0.15;
        issues.push(`Contains banned pattern: ${pattern.source}`);
      }
    }

    // Check for duplicate content with existing pages
    if (existingPages && existingPages.length > 0) {
      for (const existing of existingPages) {
        const similarity = calculateSimilarity(content.intro || "", existing.content || "");
        if (similarity > SEO_RULES.duplicateSimilarityThreshold) {
          confidenceScore -= 0.3;
          issues.push(`High similarity (${(similarity * 100).toFixed(1)}%) with existing page`);
          break;
        }
      }
    }

    return {
      success: true,
      content: {
        ...content,
        validationIssues: issues,
        wordCount: (content.intro?.split(/\s+/).length || 0) + 
                   (content.service_overview?.split(/\s+/).length || 0) +
                   (content.local_info?.split(/\s+/).length || 0),
      },
      confidenceScore: Math.max(0, confidenceScore),
    };
  } catch (error) {
    console.error("Content generation error:", error);
    return { success: false, error: String(error) };
  }
}

// Simple similarity calculation (Jaccard similarity on word sets)
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Validate SEO content before publishing
function validateSeoContent(content: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!content.h1) errors.push("Missing H1");
  if (!content.meta_title) errors.push("Missing meta title");
  if (!content.meta_description) errors.push("Missing meta description");
  if (!content.intro) errors.push("Missing intro content");

  // Length validations
  if (content.meta_title && (content.meta_title.length < SEO_RULES.title.min || content.meta_title.length > SEO_RULES.title.max)) {
    errors.push(`Meta title must be ${SEO_RULES.title.min}-${SEO_RULES.title.max} chars (got ${content.meta_title.length})`);
  }

  if (content.meta_description && (content.meta_description.length < SEO_RULES.metaDescription.min || content.meta_description.length > SEO_RULES.metaDescription.max)) {
    errors.push(`Meta description must be ${SEO_RULES.metaDescription.min}-${SEO_RULES.metaDescription.max} chars (got ${content.meta_description.length})`);
  }

  if (content.h1 && (content.h1.length < SEO_RULES.h1.min || content.h1.length > SEO_RULES.h1.max)) {
    warnings.push(`H1 should be ${SEO_RULES.h1.min}-${SEO_RULES.h1.max} chars (got ${content.h1.length})`);
  }

  // Check word count
  const wordCount = content.wordCount || 0;
  if (wordCount < SEO_RULES.contentMinWords) {
    warnings.push(`Content is thin (${wordCount} words, minimum ${SEO_RULES.contentMinWords})`);
  }

  // Check for banned patterns
  const allText = JSON.stringify(content).toLowerCase();
  for (const pattern of SEO_RULES.bannedPatterns) {
    if (pattern.test(allText)) {
      errors.push(`Contains spam pattern: "${pattern.source}"`);
    }
  }

  // Check internal links
  if (!content.internal_links || content.internal_links.length < 2) {
    warnings.push("Should have at least 2 internal links");
  }

  // Check FAQs
  if (!content.faq || content.faq.length < 3) {
    warnings.push("Should have at least 3 FAQs");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Enqueue a page for generation
async function enqueuePageGeneration(
  supabase: any,
  entityType: "state" | "city",
  entityId: string,
  triggeredBy: string,
  triggeredByUser?: string,
  triggeredByClinic?: string
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  // Get entity info
  const table = entityType === "state" ? "states" : "cities";
  const { data: entity, error: entityError } = await supabase
    .from(table)
    .select(entityType === "city" ? "*, state:states(*)" : "*")
    .eq("id", entityId)
    .single();

  if (entityError || !entity) {
    return { success: false, error: `${entityType} not found` };
  }

  const slug = entityType === "state" 
    ? entity.slug 
    : `${entity.state?.slug}/${entity.slug}`;

  // Check if already in queue
  const { data: existing } = await supabase
    .from("page_generation_queue")
    .select("id, status")
    .eq("page_type", entityType)
    .eq("entity_id", entityId)
    .in("status", ["pending", "processing", "generated"])
    .maybeSingle();

  if (existing) {
    return { success: true, queueId: existing.id };
  }

  // Add to queue
  const { data: queue, error: queueError } = await supabase
    .from("page_generation_queue")
    .insert({
      page_type: entityType,
      entity_id: entityId,
      entity_slug: slug,
      state_slug: entityType === "city" ? entity.state?.slug : null,
      triggered_by: triggeredBy,
      triggered_by_user: triggeredByUser,
      triggered_by_clinic: triggeredByClinic,
      priority: triggeredBy === "listing" ? 10 : 0,
    })
    .select()
    .single();

  if (queueError) {
    return { success: false, error: queueError.message };
  }

  return { success: true, queueId: queue.id };
}

// Publish a page (move from draft to live)
async function publishPage(
  supabase: any,
  queueId: string,
  approvedBy: string
): Promise<{ success: boolean; error?: string }> {
  const { data: queue, error: queueError } = await supabase
    .from("page_generation_queue")
    .select("*")
    .eq("id", queueId)
    .single();

  if (queueError || !queue) {
    return { success: false, error: "Queue item not found" };
  }

  if (!queue.content_generated) {
    return { success: false, error: "No content generated yet" };
  }

  // Validate content before publishing
  const validation = validateSeoContent(queue.content_generated);
  if (!validation.valid) {
    return { success: false, error: `SEO validation failed: ${validation.errors.join(", ")}` };
  }

  const content = queue.content_generated;
  const slug = queue.page_type === "state" 
    ? queue.entity_slug 
    : queue.entity_slug;

  // Create or update SEO page
  const { data: existingSeoPage } = await supabase
    .from("seo_pages")
    .select("id")
    .eq("slug", slug)
    .eq("page_type", queue.page_type)
    .maybeSingle();

  const seoPageData = {
    slug,
    page_type: queue.page_type,
    h1: content.h1,
    meta_title: content.meta_title,
    meta_description: content.meta_description,
    content: JSON.stringify({
      intro: content.intro,
      service_overview: content.service_overview,
      local_info: content.local_info,
      faq: content.faq,
      internal_links: content.internal_links,
    }),
    word_count: content.wordCount,
    is_indexed: true,
    is_thin_content: content.wordCount < SEO_RULES.contentMinWords,
    last_generated_at: new Date().toISOString(),
    generation_version: 1,
  };

  let seoPageId: string;

  if (existingSeoPage) {
    await supabase
      .from("seo_pages")
      .update(seoPageData)
      .eq("id", existingSeoPage.id);
    seoPageId = existingSeoPage.id;
  } else {
    const { data: newPage, error: insertError } = await supabase
      .from("seo_pages")
      .insert(seoPageData)
      .select()
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }
    seoPageId = newPage.id;
  }

  // Update entity with SEO status
  const table = queue.page_type === "state" ? "states" : "cities";
  await supabase
    .from(table)
    .update({
      seo_status: "live",
      page_exists: true,
      seo_page_id: seoPageId,
      ai_confidence_score: queue.ai_confidence_score,
      last_generated_at: new Date().toISOString(),
    })
    .eq("id", queue.entity_id);

  // Update queue status
  await supabase
    .from("page_generation_queue")
    .update({
      status: "published",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    })
    .eq("id", queueId);

  // Log version
  await supabase.from("content_versions").insert({
    seo_page_id: seoPageId,
    page_type: queue.page_type,
    entity_id: queue.entity_id,
    version_number: 1,
    field_name: "full_content",
    old_value: null,
    new_value: JSON.stringify(content),
    change_trigger: "new_page",
    ai_confidence_score: queue.ai_confidence_score,
    changed_by: approvedBy,
  });

  return { success: true };
}

// Rollback a page to previous version
async function rollbackPage(
  supabase: any,
  seoPageId: string,
  versionId: string,
  rolledBackBy: string
): Promise<{ success: boolean; error?: string }> {
  const { data: version, error: versionError } = await supabase
    .from("content_versions")
    .select("*")
    .eq("id", versionId)
    .single();

  if (versionError || !version) {
    return { success: false, error: "Version not found" };
  }

  // Get current content for logging
  const { data: currentPage } = await supabase
    .from("seo_pages")
    .select("*")
    .eq("id", seoPageId)
    .single();

  if (!currentPage) {
    return { success: false, error: "Page not found" };
  }

  // Restore old content
  const oldContent = JSON.parse(version.old_value || "{}");
  
  if (!version.old_value) {
    // If rolling back to before page existed, delete the page
    await supabase.from("seo_pages").delete().eq("id", seoPageId);
    
    // Update entity status
    const table = version.page_type === "state" ? "states" : "cities";
    await supabase
      .from(table)
      .update({
        seo_status: "inactive",
        page_exists: false,
        seo_page_id: null,
      })
      .eq("id", version.entity_id);
  } else {
    // Update with old content
    await supabase
      .from("seo_pages")
      .update({
        h1: oldContent.h1,
        meta_title: oldContent.meta_title,
        meta_description: oldContent.meta_description,
        content: JSON.stringify(oldContent),
      })
      .eq("id", seoPageId);
  }

  // Log rollback
  await supabase.from("content_versions").insert({
    seo_page_id: seoPageId,
    page_type: version.page_type,
    entity_id: version.entity_id,
    version_number: version.version_number + 1,
    field_name: "full_content",
    old_value: JSON.stringify(currentPage),
    new_value: version.old_value,
    change_trigger: "rollback",
    changed_by: rolledBackBy,
  });

  return { success: true };
}

// Get expansion statistics
async function getExpansionStats(supabase: any): Promise<any> {
  const [
    statesTotal,
    statesLive,
    statesDraft,
    citiesTotal,
    citiesLive,
    citiesDraft,
    queuePending,
    queueGenerated,
    queuePublished,
    queueFailed,
    recentVersions,
  ] = await Promise.all([
    supabase.from("states").select("id", { count: "exact", head: true }),
    supabase.from("states").select("id", { count: "exact", head: true }).eq("seo_status", "live"),
    supabase.from("states").select("id", { count: "exact", head: true }).eq("seo_status", "draft"),
    supabase.from("cities").select("id", { count: "exact", head: true }),
    supabase.from("cities").select("id", { count: "exact", head: true }).eq("seo_status", "live"),
    supabase.from("cities").select("id", { count: "exact", head: true }).eq("seo_status", "draft"),
    supabase.from("page_generation_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("page_generation_queue").select("id", { count: "exact", head: true }).eq("status", "generated"),
    supabase.from("page_generation_queue").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("page_generation_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("content_versions").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  return {
    states: {
      total: statesTotal.count || 0,
      live: statesLive.count || 0,
      draft: statesDraft.count || 0,
      inactive: (statesTotal.count || 0) - (statesLive.count || 0) - (statesDraft.count || 0),
    },
    cities: {
      total: citiesTotal.count || 0,
      live: citiesLive.count || 0,
      draft: citiesDraft.count || 0,
      inactive: (citiesTotal.count || 0) - (citiesLive.count || 0) - (citiesDraft.count || 0),
    },
    queue: {
      pending: queuePending.count || 0,
      generated: queueGenerated.count || 0,
      published: queuePublished.count || 0,
      failed: queueFailed.count || 0,
    },
    recentChanges: recentVersions.data || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: PageGenerationRequest = await req.json();

    switch (body.action) {
      case "get_stats": {
        const stats = await getExpansionStats(supabase);
        return new Response(JSON.stringify({ success: true, data: stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_queue": {
        let query = supabase
          .from("page_generation_queue")
          .select("*")
          .order("created_at", { ascending: false });

        if (body.filters?.status) {
          query = query.eq("status", body.filters.status);
        }
        if (body.filters?.pageType) {
          query = query.eq("page_type", body.filters.pageType);
        }
        query = query.limit(body.filters?.limit || 50);

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "enqueue_page": {
        if (!body.entityType || !body.entityId) {
          throw new Error("entityType and entityId are required");
        }

        const result = await enqueuePageGeneration(
          supabase,
          body.entityType,
          body.entityId,
          "admin"
        );

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate_state_content": {
        if (!body.entityId) {
          throw new Error("entityId is required");
        }

        // Update queue status
        if (body.queueId) {
          await supabase
            .from("page_generation_queue")
            .update({ status: "processing", generation_attempts: 1, last_attempt_at: new Date().toISOString() })
            .eq("id", body.queueId);
        }

        const result = await generateStateContent(supabase, body.entityId);

        if (body.queueId) {
          if (result.success) {
            await supabase
              .from("page_generation_queue")
              .update({
                status: "generated",
                content_generated: result.content,
                ai_confidence_score: result.confidenceScore,
                seo_validation_passed: result.confidenceScore! >= 0.7,
                seo_validation_errors: result.content?.validationIssues || [],
              })
              .eq("id", body.queueId);

            // Update state status
            await supabase
              .from("states")
              .update({
                seo_status: "draft",
                ai_confidence_score: result.confidenceScore,
              })
              .eq("id", body.entityId);
          } else {
            await supabase
              .from("page_generation_queue")
              .update({ status: "failed", error_message: result.error })
              .eq("id", body.queueId);
          }
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate_city_content": {
        if (!body.entityId) {
          throw new Error("entityId is required");
        }

        if (body.queueId) {
          await supabase
            .from("page_generation_queue")
            .update({ status: "processing", generation_attempts: 1, last_attempt_at: new Date().toISOString() })
            .eq("id", body.queueId);
        }

        const result = await generateCityContent(supabase, body.entityId);

        if (body.queueId) {
          if (result.success) {
            await supabase
              .from("page_generation_queue")
              .update({
                status: "generated",
                content_generated: result.content,
                ai_confidence_score: result.confidenceScore,
                seo_validation_passed: result.confidenceScore! >= 0.7,
                seo_validation_errors: result.content?.validationIssues || [],
              })
              .eq("id", body.queueId);

            await supabase
              .from("cities")
              .update({
                seo_status: "draft",
                ai_confidence_score: result.confidenceScore,
              })
              .eq("id", body.entityId);
          } else {
            await supabase
              .from("page_generation_queue")
              .update({ status: "failed", error_message: result.error })
              .eq("id", body.queueId);
          }
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "validate_seo": {
        if (!body.queueId) {
          throw new Error("queueId is required");
        }

        const { data: queue } = await supabase
          .from("page_generation_queue")
          .select("content_generated")
          .eq("id", body.queueId)
          .single();

        if (!queue?.content_generated) {
          throw new Error("No content to validate");
        }

        const validation = validateSeoContent(queue.content_generated);

        await supabase
          .from("page_generation_queue")
          .update({
            seo_validation_passed: validation.valid,
            seo_validation_errors: [...validation.errors, ...validation.warnings],
          })
          .eq("id", body.queueId);

        return new Response(JSON.stringify({ success: true, validation }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "approve_page":
      case "publish_page": {
        if (!body.queueId) {
          throw new Error("queueId is required");
        }

        // Get user from auth header
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        let userId: string | undefined;

        if (token) {
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id;
        }

        const result = await publishPage(supabase, body.queueId, userId || "system");

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reject_page": {
        if (!body.queueId) {
          throw new Error("queueId is required");
        }

        await supabase
          .from("page_generation_queue")
          .update({ status: "failed", error_message: "Rejected by admin" })
          .eq("id", body.queueId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "rollback_page": {
        if (!body.entityId || !body.queueId) {
          throw new Error("entityId (seoPageId) and queueId (versionId) are required");
        }

        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        let userId: string | undefined;

        if (token) {
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id;
        }

        const result = await rollbackPage(supabase, body.entityId, body.queueId, userId || "system");

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_settings": {
        const { data, error } = await supabase
          .from("geo_expansion_settings")
          .select("*")
          .order("setting_key");

        if (error) throw error;

        const settings: Record<string, any> = {};
        for (const row of data || []) {
          settings[row.setting_key] = row.setting_value;
        }

        return new Response(JSON.stringify({ success: true, data: settings }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_settings": {
        if (!body.settingKey || body.settingValue === undefined) {
          throw new Error("settingKey and settingValue are required");
        }

        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        let userId: string | undefined;

        if (token) {
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id;
        }

        await supabase
          .from("geo_expansion_settings")
          .update({
            setting_value: body.settingValue,
            updated_by: userId,
          })
          .eq("setting_key", body.settingKey);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }
  } catch (error) {
    console.error("Geo expansion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
