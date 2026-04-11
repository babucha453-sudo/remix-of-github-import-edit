import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==========================================
// META OPTIMIZER - STRICT FIELD SEPARATION
// ==========================================
// This tool is ONLY allowed to write to meta-related fields.
// It must NEVER write to: h1, content, page_intro, h2_sections, faqs
// Those are managed by Content Studio and FAQ Studio respectively.

const META_OPTIMIZER_ALLOWED_FIELDS = [
  'meta_title', 'meta_description', 'og_title', 'og_description',
  'is_optimized', 'optimized_at', 'needs_optimization',
  'last_meta_edit_source', 'updated_at'
];

const META_OPTIMIZER_BLOCKED_FIELDS = [
  'h1', 'content', 'page_intro', 'h2_sections', 'internal_links_intro', 'faqs'
];

function validateMetaOptimizerWrite(fields: string[]): { valid: boolean; blockedFields: string[] } {
  const blockedFields = fields.filter(f => META_OPTIMIZER_BLOCKED_FIELDS.includes(f));
  return { valid: blockedFields.length === 0, blockedFields };
}

// Rate limiting configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 3000;

// Helper to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Google-compliant meta tag guidelines
const SYSTEM_PROMPT = `You are an SEO expert specializing in dental and healthcare websites. Your task is to generate Google-compliant meta titles and descriptions.

STRICT RULES:
1. Meta Title: MUST be under 60 characters (aim for 50-58). Include primary keyword naturally.
2. Meta Title Tip: For local pages, include clinic counts or ratings (e.g., "15+ Top Rated Dentists in...")
3. Meta Description: MUST be under 160 characters (aim for 140-155). Include call-to-action.
4. Meta Description Tip: Mention price ranges, insurance, or "Book Online Instantly".
5. Use natural language - no keyword stuffing
6. Follow Google E-E-A-T guidelines
7. Be specific and relevant to the page content
8. Include location for local pages
7. For AppointPanda: We are a dental directory helping patients find dentists

OUTPUT FORMAT (JSON only, no markdown):
{
  "meta_title": "Your title here",
  "meta_description": "Your description here"
}`;

// Call AI with retry logic for rate limiting
async function callAIWithRetry(
  pageContext: string,
  apiKey: string
): Promise<{ meta_title: string; meta_description: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const aiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: pageContext },
          ],
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errorText);

        if (aiResponse.status === 429) {
          // Rate limited - use exponential backoff
          const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.log(`Rate limited, retrying in ${backoffTime}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(backoffTime);
          continue;
        }

        if (aiResponse.status === 402) {
          throw new Error("AI credits exhausted. Please add funds.");
        }

        throw new Error(`AI Gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";

      // Parse the JSON response
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);
      return {
        meta_title: parsed.meta_title || "",
        meta_description: parsed.meta_description || "",
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a rate limit error message, continue retrying
      if (lastError.message.includes("429") || lastError.message.includes("rate limit")) {
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`Rate limit detected in error, retrying in ${backoffTime}ms`);
        await delay(backoffTime);
        continue;
      }

      // For parsing errors, throw immediately (will use fallback)
      if (lastError.message.includes("JSON")) {
        throw lastError;
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error("All retries exhausted");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page_id } = await req.json();

    if (!page_id) {
      return new Response(
        JSON.stringify({ error: "page_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aimlapiKey = Deno.env.get("AIMLAPI_KEY");

    if (!aimlapiKey) {
      throw new Error("AIMLAPI_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the page
    const { data: page, error: fetchError } = await supabase
      .from("seo_pages")
      .select("*")
      .eq("id", page_id)
      .single();

    if (fetchError || !page) {
      throw new Error(`Page not found: ${fetchError?.message || "Unknown error"}`);
    }

    // Build context for the AI
    const pageContext = buildPageContext(page);

    // Call AI with retry logic
    let metaTitle: string;
    let metaDescription: string;

    try {
      const result = await callAIWithRetry(pageContext, aimlapiKey);
      metaTitle = result.meta_title;
      metaDescription = result.meta_description;
    } catch (error) {
      console.error("AI call failed after retries:", error);
      // Fallback: generate from page data
      metaTitle = generateFallbackTitle(page);
      metaDescription = generateFallbackDescription(page);
    }

    // Enforce length limits
    if (metaTitle.length > 60) {
      metaTitle = metaTitle.substring(0, 57) + "...";
    }
    if (metaDescription.length > 160) {
      metaDescription = metaDescription.substring(0, 157) + "...";
    }

    // Update the database - STRICT SEPARATION: Meta Optimizer ONLY writes to meta fields
    const updateData: Record<string, any> = {
      meta_title: metaTitle,
      meta_description: metaDescription,
      is_optimized: true,
      optimized_at: new Date().toISOString(),
      needs_optimization: false,
      last_meta_edit_source: 'meta_optimizer',
    };

    // Validate we're not writing to blocked fields
    const validation = validateMetaOptimizerWrite(Object.keys(updateData));
    if (!validation.valid) {
      console.error(`Meta Optimizer attempted to write to blocked fields: ${validation.blockedFields.join(', ')}`);
      // Remove blocked fields from update
      for (const blocked of validation.blockedFields) {
        delete updateData[blocked];
      }
    }

    const { error: updateError } = await supabase
      .from("seo_pages")
      .update(updateData)
      .eq("id", page_id);

    if (updateError) {
      throw new Error(`Failed to update page: ${updateError.message}`);
    }

    console.log(`Optimized page ${page.slug}: title=${metaTitle.length} chars, desc=${metaDescription.length} chars`);

    return new Response(
      JSON.stringify({
        success: true,
        page_id,
        meta_title: metaTitle,
        meta_description: metaDescription,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPageContext(page: any): string {
  const parts: string[] = [];

  parts.push(`Page Type: ${page.page_type}`);
  parts.push(`URL Slug: /${page.slug}`);

  if (page.title) {
    parts.push(`Current Title: ${page.title}`);
  }

  if (page.h1) {
    parts.push(`H1 Heading: ${page.h1}`);
  }

  if (page.content) {
    // Include first 500 chars of content for context
    const contentPreview = page.content.substring(0, 500).replace(/\n+/g, " ").trim();
    parts.push(`Content Preview: ${contentPreview}`);
  }

  if (page.meta_title) {
    parts.push(`Existing Meta Title: ${page.meta_title} (${page.meta_title.length} chars)`);
  }

  if (page.meta_description) {
    parts.push(`Existing Meta Description: ${page.meta_description} (${page.meta_description.length} chars)`);
  }

  // Add page type specific context
  switch (page.page_type) {
    case "city":
      parts.push("Context: This is a city-level dental directory page listing dentists in a specific city.");
      break;
    case "state":
      parts.push("Context: This is a state-level page showing dental services across the state.");
      break;
    case "service":
      parts.push("Context: This is a dental service page explaining a specific treatment.");
      break;
    case "service-location":
      parts.push("Context: This combines a dental service with a location (e.g., teeth whitening in Los Angeles).");
      break;
    case "clinic":
      parts.push("Context: This is a dental practice/clinic profile page.");
      break;
    case "dentist":
      parts.push("Context: This is an individual dentist's profile page.");
      break;
    case "blog":
      parts.push("Context: This is a blog article about dental health or care.");
      break;
    case "static":
      parts.push("Context: This is a static informational page (About, Contact, FAQ, etc.).");
      break;
  }

  parts.push("\nGenerate optimized meta title and description following Google guidelines. Remember: title <60 chars, description <160 chars.");

  return parts.join("\n");
}

function generateFallbackTitle(page: any): string {
  const slug = page.slug || "";
  const parts = slug.split("/").filter(Boolean);

  if (page.page_type === "city" && parts.length >= 2) {
    const city = parts[1].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    return `Find Top Dentists in ${city} | AppointPanda`;
  }

  if (page.page_type === "service-location" && parts.length >= 3) {
    const city = parts[1].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const service = parts[2].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    return `${service} in ${city} | AppointPanda`;
  }

  if (page.title) {
    return page.title.length > 50 ? page.title.substring(0, 47) + "..." : page.title + " | AppointPanda";
  }

  return "Find Trusted Dentists Near You | AppointPanda";
}

function generateFallbackDescription(page: any): string {
  const slug = page.slug || "";
  const parts = slug.split("/").filter(Boolean);

  if (page.page_type === "city" && parts.length >= 2) {
    const city = parts[1].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    return `Find top-rated dentists in ${city}. Read patient reviews, compare services, and book appointments online. Your trusted dental care starts here.`;
  }

  if (page.page_type === "service-location" && parts.length >= 3) {
    const city = parts[1].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const service = parts[2].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    return `Looking for ${service.toLowerCase()} in ${city}? Find qualified dentists, read reviews, and book your appointment online today.`;
  }

  return "Find trusted dentists near you. Compare reviews, services, and book appointments online with AppointPanda.";
}
