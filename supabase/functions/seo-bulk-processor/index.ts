import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractJsonFromResponseText } from "../_shared/parse-ai-json.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 2000; // 2 seconds between AI requests
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 3000; // 3 seconds initial backoff on rate limit

interface RegenerationConfig {
  regenerateH1: boolean;
  regenerateH2: boolean;
  regenerateMetaTitle: boolean;
  regenerateMetaDescription: boolean;
  regenerateIntro: boolean;
  regenerateSections: boolean;
  regenerateFaq: boolean;
  addInternalLinks: boolean;
  rewriteForUniqueness: boolean;
  expandContent: boolean;
  targetWordCount: number;
}

// Helper to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aimlapiKey = Deno.env.get("AIMLAPI_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, job_id, page_ids, config, apply_mode, quality_threshold, custom_prompt } = await req.json();

    if (action === "process_job") {
      // Update job status to running
      await supabase
        .from("seo_fix_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job_id);

      let successful = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < page_ids.length; i++) {
        const pageId = page_ids[i];

        // Add delay between requests to avoid rate limiting (skip first request)
        if (i > 0) {
          await delay(RATE_LIMIT_DELAY_MS);
        }

        try {
          // Fetch current page data
          const { data: page, error: pageError } = await supabase
            .from("seo_pages")
            .select("*")
            .eq("id", pageId)
            .single();

          if (pageError || !page) {
            throw new Error(`Page not found: ${pageId}`);
          }

          // Store before snapshot
          const beforeSnapshot = {
            meta_title: page.meta_title,
            meta_description: page.meta_description,
            h1: page.h1,
            h2_sections: page.h2_sections,
            intro_text: page.intro_text,
            faq_items: page.faq_items,
            internal_links: page.internal_links,
            word_count: page.word_count,
          };

          // Generate new content based on config with retry logic
          const generatedContent = await generateSeoContentWithRetry(
            page,
            config,
            custom_prompt,
            aimlapiKey
          );

          // Calculate quality score
          const qualityScore = calculateQualityScore(generatedContent, page);

          // Store after snapshot
          const afterSnapshot = { ...beforeSnapshot, ...generatedContent };

          // Create job item record
          const { data: jobItem } = await supabase
            .from("seo_fix_job_items")
            .insert({
              job_id,
              page_id: pageId,
              status: "completed",
              before_snapshot: beforeSnapshot,
              after_snapshot: afterSnapshot,
              quality_score: qualityScore,
              changes_applied: false,
            })
            .select("id")
            .single();

          // Decide whether to apply based on mode
          let shouldApply = false;
          if (apply_mode === "auto_apply") {
            shouldApply = true;
          } else if (apply_mode === "quality_gated" && qualityScore >= quality_threshold) {
            shouldApply = true;
          }

          if (shouldApply) {
            // Apply changes to seo_pages
            const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

            if (config.regenerateMetaTitle && generatedContent.meta_title) {
              updateData.meta_title = generatedContent.meta_title;
            }
            if (config.regenerateMetaDescription && generatedContent.meta_description) {
              updateData.meta_description = generatedContent.meta_description;
            }
            if (config.regenerateH1 && generatedContent.h1) {
              updateData.h1 = generatedContent.h1;
            }
            if (config.regenerateH2 && generatedContent.h2_sections) {
              updateData.h2_sections = generatedContent.h2_sections;
            }
            if (config.regenerateIntro && generatedContent.intro_text) {
              updateData.intro_text = generatedContent.intro_text;
            }
            if (config.regenerateFaq && generatedContent.faq_items) {
              updateData.faq_items = generatedContent.faq_items;
            }
            if (generatedContent.word_count) {
              updateData.word_count = generatedContent.word_count;
            }

            await supabase
              .from("seo_pages")
              .update(updateData)
              .eq("id", pageId);

            // Create content version for rollback
            await supabase.from("seo_content_versions").insert({
              page_id: pageId,
              job_id,
              version_type: "ai_regeneration",
              content_before: beforeSnapshot,
              content_after: afterSnapshot,
              changed_by: "system",
            });

            // Mark as applied
            await supabase
              .from("seo_fix_job_items")
              .update({ changes_applied: true, applied_at: new Date().toISOString() })
              .eq("id", jobItem?.id);
          }

          successful++;

          // Update job progress
          await supabase
            .from("seo_fix_jobs")
            .update({
              processed_pages: successful + failed,
              successful_pages: successful,
              failed_pages: failed,
            })
            .eq("id", job_id);

        } catch (err) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`${pageId}: ${errorMsg}`);

          await supabase.from("seo_fix_job_items").insert({
            job_id,
            page_id: pageId,
            status: "failed",
            error_message: errorMsg,
          });

          // Update job progress even on failure
          await supabase
            .from("seo_fix_jobs")
            .update({
              processed_pages: successful + failed,
              successful_pages: successful,
              failed_pages: failed,
            })
            .eq("id", job_id);
        }
      }

      // Complete the job
      await supabase
        .from("seo_fix_jobs")
        .update({
          status: failed === page_ids.length ? "failed" : "completed",
          completed_at: new Date().toISOString(),
          processed_pages: successful + failed,
          successful_pages: successful,
          failed_pages: failed,
          error_log: errors.length > 0 ? errors : null,
        })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({ success: true, processed: successful + failed, successful, failed, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "rollback_page") {
      const { version_id } = await req.json();

      const { data: version } = await supabase
        .from("seo_content_versions")
        .select("*")
        .eq("id", version_id)
        .single();

      if (!version) {
        throw new Error("Version not found");
      }

      // Restore content_before
      await supabase
        .from("seo_pages")
        .update({
          ...version.content_before,
          updated_at: new Date().toISOString(),
        })
        .eq("id", version.page_id);

      // Mark version as rolled back
      await supabase
        .from("seo_content_versions")
        .update({ is_rolled_back: true })
        .eq("id", version_id);

      return new Response(
        JSON.stringify({ success: true, message: "Rollback completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("seo-bulk-processor error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Wrapper with exponential backoff retry logic
async function generateSeoContentWithRetry(
  page: Record<string, unknown>,
  config: RegenerationConfig,
  customPrompt: string | undefined,
  apiKey: string
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await generateSeoContent(page, config, customPrompt, apiKey);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a rate limit error
      if (lastError.message.includes("429") || lastError.message.includes("rate limit")) {
        // Exponential backoff: 3s, 6s, 12s
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`Rate limited, retrying in ${backoffTime}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(backoffTime);
        continue;
      }

      // For non-rate-limit errors, throw immediately
      throw lastError;
    }
  }

  // All retries exhausted, return fallback content
  console.warn("All retries exhausted, using fallback content");
  return generateFallbackContent(page, config);
}

async function generateSeoContent(
  page: Record<string, unknown>,
  config: RegenerationConfig,
  customPrompt: string | undefined,
  apiKey: string
): Promise<Record<string, unknown>> {
  const pageType = page.page_type as string;
  const slug = page.slug as string;
  const currentTitle = page.meta_title as string || "";
  const currentDesc = page.meta_description as string || "";
  const currentH1 = page.h1 as string || "";

  // Build context from slug
  const slugParts = slug.split("/").filter(Boolean);
  let location = "";
  let service = "";
  let state = "";

  if (pageType === "city" && slugParts.length >= 2) {
    state = slugParts[0].replace(/-/g, " ");
    location = slugParts[1].replace(/-/g, " ");
  } else if (pageType === "service_location" && slugParts.length >= 3) {
    state = slugParts[0].replace(/-/g, " ");
    location = slugParts[1].replace(/-/g, " ");
    service = slugParts[2].replace(/-/g, " ");
  } else if (pageType === "service") {
    service = slugParts[slugParts.length - 1].replace(/-/g, " ");
  } else if (pageType === "state") {
    state = slugParts[0].replace(/-/g, " ");
  }

  const contextInfo = [
    location && `Location: ${location}`,
    state && `State: ${state}`,
    service && `Service: ${service}`,
    `Page Type: ${pageType}`,
    currentTitle && `Current Title: ${currentTitle}`,
    currentH1 && `Current H1: ${currentH1}`,
  ].filter(Boolean).join("\n");

  const tasksToGenerate: string[] = [];
  if (config.regenerateMetaTitle) tasksToGenerate.push("meta_title (max 60 chars, include location/service)");
  if (config.regenerateMetaDescription) tasksToGenerate.push("meta_description (max 155 chars, compelling CTA)");
  if (config.regenerateH1) tasksToGenerate.push("h1 (main heading, unique, keyword-rich)");
  if (config.regenerateH2) tasksToGenerate.push("h2_sections (array of {heading, content} objects, 3-5 sections)");
  if (config.regenerateIntro) tasksToGenerate.push("intro_text (2-3 sentences, engaging opener)");
  if (config.regenerateFaq) tasksToGenerate.push("faq_items (array of {question, answer} objects, 3-6 FAQs)");

  const systemPrompt = `You are an SEO expert for AppointPanda, a dental appointment booking platform.
Write content that is:
- Unique and not templated/repetitive
- Written in first-person plural ("we", "our team")
- Helpful and patient-focused
- Google SEO compliant (Title < 60 chars, Desc < 160 chars)
- CTR-Focused: Use numbers (clinic counts, ratings) and strong CTAs ("Book Online Today", "Compare Top Dentists")
- No fake landmarks or unverified local info

${customPrompt ? `Additional instructions: ${customPrompt}` : ""}

${config.expandContent ? `Target word count: ${config.targetWordCount} words minimum for content sections.` : ""}
${config.rewriteForUniqueness ? "Ensure maximum uniqueness - avoid any templated patterns." : ""}`;

  const userPrompt = `Generate SEO content for this page:

${contextInfo}

Generate these elements as JSON:
${tasksToGenerate.join("\n")}

Return ONLY valid JSON object with the requested fields.`;

  const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const parsed = extractJsonFromResponseText(content) as Record<string, unknown>;

  // Calculate word count if we have content
  let wordCount = 0;
  if (parsed.intro_text) wordCount += String(parsed.intro_text).split(/\s+/).length;
  if (parsed.h2_sections && Array.isArray(parsed.h2_sections)) {
    for (const section of parsed.h2_sections) {
      if (section.content) wordCount += String(section.content).split(/\s+/).length;
    }
  }
  if (parsed.faq_items && Array.isArray(parsed.faq_items)) {
    for (const faq of parsed.faq_items) {
      if (faq.answer) wordCount += String(faq.answer).split(/\s+/).length;
    }
  }

  return { ...parsed, word_count: wordCount };
}

function generateFallbackContent(
  page: Record<string, unknown>,
  config: RegenerationConfig
): Record<string, unknown> {
  const slug = page.slug as string;
  const parts = slug.split("/").filter(Boolean);
  const titlePart = parts[parts.length - 1]?.replace(/-/g, " ") || "Dental Services";
  const titleCase = titlePart.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const result: Record<string, unknown> = {};

  if (config.regenerateMetaTitle) {
    result.meta_title = `${titleCase} | Find Dentists Near You | AppointPanda`;
  }
  if (config.regenerateMetaDescription) {
    result.meta_description = `Book ${titleCase.toLowerCase()} appointments with top-rated dentists. Compare prices, read reviews, and schedule online with AppointPanda.`;
  }
  if (config.regenerateH1) {
    result.h1 = `${titleCase} - Expert Dental Care`;
  }

  return result;
}

function calculateQualityScore(content: Record<string, unknown>, page: Record<string, unknown>): number {
  let score = 50; // Base score

  // Check meta title length
  const metaTitle = content.meta_title as string;
  if (metaTitle) {
    if (metaTitle.length > 0 && metaTitle.length <= 60) score += 10;
    if (metaTitle.length > 60) score -= 5;
  }

  // Check meta description length
  const metaDesc = content.meta_description as string;
  if (metaDesc) {
    if (metaDesc.length > 0 && metaDesc.length <= 160) score += 10;
    if (metaDesc.length > 160) score -= 5;
  }

  // Check H1 presence and uniqueness
  const h1 = content.h1 as string;
  if (h1 && h1.length > 0) score += 10;

  // Check for sections
  const sections = content.h2_sections as unknown[];
  if (sections && sections.length >= 3) score += 10;

  // Check for FAQs
  const faqs = content.faq_items as unknown[];
  if (faqs && faqs.length >= 3) score += 10;

  // Bonus for word count
  const wordCount = content.word_count as number;
  if (wordCount && wordCount >= 500) score += 5;
  if (wordCount && wordCount >= 700) score += 5;

  return Math.min(100, Math.max(0, score));
}
