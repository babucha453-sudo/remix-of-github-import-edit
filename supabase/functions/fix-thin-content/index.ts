import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THIN_CONTENT_THRESHOLD = 800;

// ============================================
// UNIQUENESS ENGINE - Prevent Duplication
// ============================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function selectWithSeed<T>(array: T[], seed: number): T {
  return array[Math.floor(seededRandom(seed) * array.length)];
}

const OPENING_STYLES = [
  "Open with a compelling local statistic or patient concern.",
  "Start with a question patients actually ask about this service.",
  "Begin with empathy about dental anxiety or concerns.",
  "Open with a practical statement about what patients need to know.",
  "Start with a scenario patients relate to daily.",
  "Begin with an empowering statement about dental health ownership.",
  "Open with a contrast between outdated beliefs and modern reality.",
];

const SECTION_ORDER_VARIATIONS = [
  ["intro", "about", "process", "cost", "insurance", "benefits", "finding", "faq"],
  ["intro", "process", "about", "benefits", "cost", "insurance", "faq", "finding"],
  ["intro", "benefits", "about", "process", "finding", "cost", "insurance", "faq"],
  ["intro", "cost", "about", "insurance", "process", "benefits", "finding", "faq"],
];

const H2_HEADING_VARIATIONS = {
  intro: [
    "Getting Started with [X] in [Location]",
    "Your Guide to [X] in [Location]",
    "Understanding [X] for [Location] Residents",
    "[Location]'s Complete [X] Resource",
  ],
  about: [
    "What is [X]?",
    "Understanding [X]: The Basics",
    "[X] Explained",
    "The Essentials of [X]",
  ],
  process: [
    "What to Expect During [X]",
    "The [X] Procedure",
    "Your [X] Journey",
    "Step-by-Step [X] Process",
  ],
  cost: [
    "Cost of [X]",
    "[X] Pricing in [Location]",
    "Understanding [X] Costs",
    "[X] Investment",
  ],
  insurance: [
    "Insurance Coverage for [X]",
    "Does Insurance Cover [X]?",
    "Financing [X] Options",
    "Making [X] Affordable",
  ],
  benefits: [
    "Benefits of [X]",
    "Why Choose [X]?",
    "Advantages of [X]",
    "What [X] Can Do for You",
  ],
  finding: [
    "Finding [X] Providers",
    "How to Choose a [X] Dentist",
    "Selecting Your [X] Provider",
    "Finding Quality [X] Near You",
  ],
  faq: [
    "Frequently Asked Questions",
    "Common [X] Questions",
    "[X] FAQ",
    "Your [X] Questions Answered",
  ],
};

const CTA_VARIATIONS = [
  "Find verified [X] providers on our platform and book your consultation today.",
  "Browse our network of dental professionals and schedule your appointment online.",
  "Compare dentists offering [X] and book your visit through AppointPanda.",
  "Ready to improve your smile? Find [X] specialists near you now.",
  "Take the first step - search for [X] providers and book your appointment.",
];

// ============================================
// AI CONTENT GENERATION
// ============================================

async function generateAIContent(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert dental SEO content writer for AppointPanda, a dental directory platform.

CRITICAL RULES:
1. Write UNIQUE content - do NOT follow a template structure
2. Use varied sentence lengths (5-30 words)
3. Avoid AI-sounding phrases: "In today's world", "When it comes to", "It's important to note"
4. Include specific, actionable advice
5. Write for patients, not search engines
6. Focus on the specific location/service combination
7. Include real value - not generic filler
8. Use natural transitions: "This means", "As a result", "Here's what matters"

Write 600-1000 words of engaging, helpful content.`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================
// UNIQUENESS CHECK
// ============================================

async function checkSimilarity(supabase: any, newContent: string, pageType: string, excludePageId: string): Promise<number> {
  const { data: similarPages } = await supabase
    .from('seo_pages')
    .select('id, content')
    .eq('page_type', pageType)
    .neq('id', excludePageId)
    .not('content', 'is', null)
    .limit(5);
  
  if (!similarPages || similarPages.length === 0) return 0;
  
  const newWords = new Set(newContent.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  let maxSimilarity = 0;
  
  for (const page of similarPages) {
    const existingWords = new Set((page.content || '').toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (existingWords.size === 0) continue;
    
    let shared = 0;
    for (const word of newWords) {
      if (existingWords.has(word)) shared++;
    }
    const similarity = shared / Math.max(newWords.size, existingWords.size);
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }
  
  return maxSimilarity;
}

// ============================================
// PAGE TYPE SPECIFIC PROMPTS
// ============================================

function buildContentPrompt(page: any, seed: number): string {
  const slugParts = page.slug.replace(/^\/|\/$/g, "").split("/");
  const pageType = page.page_type;
  
  const orderedSections = selectWithSeed(SECTION_ORDER_VARIATIONS, seed);
  const openingStyle = selectWithSeed(OPENING_STYLES, seed + 1);
  const ctaStyle = selectWithSeed(CTA_VARIATIONS, seed + 2);
  
  let context = "";
  let location = "";
  let service = "";
  
  switch (pageType) {
    case "city_treatment":
    case "service_location":
      const stateAbbr = slugParts[0]?.toUpperCase() || "";
      const cityName = slugParts[1]?.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "";
      const treatmentName = (page.title || slugParts[2] || "").split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      location = `${cityName}, ${stateAbbr}`;
      service = treatmentName;
      context = `This is a SERVICE + LOCATION page for ${treatmentName} in ${cityName}, ${stateAbbr}.`;
      break;
      
    case "city":
      const state = slugParts[0]?.toUpperCase() || "";
      const city = slugParts[1]?.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "";
      location = city;
      service = "dental care";
      context = `This is a CITY directory page for dentists in ${city}, ${state}.`;
      break;
      
    case "treatment":
    case "service":
      service = (page.title || slugParts[0] || "").split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      location = "your area";
      context = `This is a SERVICE page for ${service}.`;
      break;
      
    case "state":
      const stateName = slugParts[0]?.toUpperCase() || "";
      location = stateName;
      service = "dental care";
      context = `This is a STATE directory page for dental providers in ${stateName}.`;
      break;
      
    default:
      location = "your area";
      service = "dental services";
      context = `This is a ${pageType} page on AppointPanda.`;
  }
  
  // Build section instructions
  const sections = orderedSections.map((section, idx) => {
    const heading = selectWithSeed(H2_HEADING_VARIATIONS[section as keyof typeof H2_HEADING_VARIATIONS], seed + idx * 10);
    return `${idx + 1}. ${heading.replace('[X]', service).replace('[Location]', location)}`;
  }).join('\n');
  
  return `${context}

WRITE STYLE: ${openingStyle}

SECTIONS TO INCLUDE (write in this order, but vary the content):
${sections}

MANDATORY CTA: ${ctaStyle}

IMPORTANT:
- Write unique content for this specific page
- Do NOT copy structure from other pages
- Include specific, actionable advice
- Mention ${location} context naturally
- Write 600-1000 words`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aimlApiKey = Deno.env.get("AIMLAPI_KEY");
    
    if (!aimlApiKey) {
      return new Response(
        JSON.stringify({ error: "AIMLAPI_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, batchSize = 10, pageType, similarityThreshold = 0.7 } = await req.json();

    // ============================================
    // ACTION: FIX SEO PAGES (AI GENERATION)
    // ============================================
    if (action === "fix_seo_pages") {
      let query = supabase
        .from("seo_pages")
        .select("id, slug, page_type, title, meta_title, meta_description, h1, content")
        .or("is_thin_content.eq.true,content.is.null,content.eq.''")
        .eq("is_indexed", true);
      
      if (pageType) {
        query = query.eq("page_type", pageType);
      }
      
      const { data: thinPages, error: pagesError } = await query.limit(batchSize);

      if (pagesError) throw pagesError;

      let fixed = 0;
      let skipped = 0;
      const results: { id: string; slug: string; status: string; reason?: string }[] = [];

      for (const page of thinPages || []) {
        const seed = Date.now() + (page.id?.charCodeAt(0) || 0);
        
        // Build unique prompt for this page
        const prompt = buildContentPrompt(page, seed);
        
        try {
          // Generate content using AI
          const newContent = await generateAIContent(prompt, aimlApiKey);
          
          // Check similarity before saving
          const similarity = await checkSimilarity(supabase, newContent, page.page_type, page.id);
          
          if (similarity > similarityThreshold) {
            results.push({
              id: page.id,
              slug: page.slug,
              status: "skipped",
              reason: `Similarity too high (${Math.round(similarity * 100)}%)`
            });
            skipped++;
            continue;
          }
          
          const wordCount = newContent.split(/\s+/).filter(Boolean).length;
          
          // Update the page
          await supabase
            .from("seo_pages")
            .update({
              content: newContent,
              is_thin_content: wordCount < THIN_CONTENT_THRESHOLD,
              word_count: wordCount,
              updated_at: new Date().toISOString()
            })
            .eq("id", page.id);
          
          results.push({
            id: page.id,
            slug: page.slug,
            status: "fixed",
          });
          fixed++;
          
        } catch (err) {
          console.error(`Error generating for ${page.slug}:`, err);
          results.push({
            id: page.id,
            slug: page.slug,
            status: "error",
            reason: err instanceof Error ? err.message : "Unknown error"
          });
        }
      }

      // Get remaining count
      const { count } = await supabase
        .from("seo_pages")
        .select("*", { count: "exact", head: true })
        .or("is_thin_content.eq.true,content.is.null,content.eq.''")
        .eq("is_indexed", true);

      return new Response(
        JSON.stringify({ 
          success: true, 
          fixed, 
          skipped,
          remaining: count || 0,
          results: results.slice(0, 20),
          message: `Fixed ${fixed} pages, skipped ${skipped}. ${count || 0} remaining.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // ACTION: CHECK SIMILARITY
    // ============================================
    if (action === "check_similarity") {
      const { page_id } = await req.json();
      
      const { data: page, error } = await supabase
        .from("seo_pages")
        .select("id, slug, page_type, content")
        .eq("id", page_id)
        .single();
      
      if (error || !page) throw error || new Error("Page not found");
      
      const similarity = await checkSimilarity(supabase, page.content || '', page.page_type, page.id);
      
      return new Response(
        JSON.stringify({ 
          similarity: Math.round(similarity * 100) + '%',
          risk: similarity > 0.7 ? 'HIGH' : similarity > 0.5 ? 'MEDIUM' : 'LOW'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // ACTION: GET STATS
    // ============================================
    if (action === "get_stats") {
      const { count: thinSeoPages } = await supabase
        .from("seo_pages")
        .select("*", { count: "exact", head: true })
        .or("is_thin_content.eq.true,content.is.null,content.eq.''")
        .eq("is_indexed", true);

      return new Response(
        JSON.stringify({ 
          thinSeoPages: thinSeoPages || 0,
          threshold: THIN_CONTENT_THRESHOLD
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
