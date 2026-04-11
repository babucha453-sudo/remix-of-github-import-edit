import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==========================================
// FAQ STUDIO - STRICT FIELD SEPARATION
// ==========================================
// This tool is ONLY allowed to write to FAQ-related fields.
// It must NEVER write to: meta_title, meta_description, h1, content, page_intro, h2_sections
// Those are managed by Meta Optimizer and Content Studio respectively.

const FAQ_STUDIO_ALLOWED_FIELDS = [
  'faqs', 'last_faq_edit_source', 'updated_at'
];

const FAQ_STUDIO_BLOCKED_FIELDS = [
  'meta_title', 'meta_description', 'og_title', 'og_description',
  'h1', 'content', 'page_intro', 'h2_sections', 'internal_links_intro'
];

function validateFAQStudioWrite(fields: string[]): { valid: boolean; blockedFields: string[] } {
  const blockedFields = fields.filter(f => FAQ_STUDIO_BLOCKED_FIELDS.includes(f));
  return { valid: blockedFields.length === 0, blockedFields };
}

interface FAQRequest {
  action: "generate_faqs" | "preview_faqs" | "apply_faqs" | "audit_faqs";
  page_id?: string;
  page_ids?: string[];
  config?: {
    faq_count?: number;
    use_paa_style?: boolean;
    include_local_context?: boolean;
    make_unique?: boolean;
    tone?: 'friendly' | 'professional' | 'simple';
    avoid_duplicates_across_city?: boolean;
    regenerate_weak_only?: boolean;
  };
  faqs?: Array<{ question: string; answer: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const AIMLAPI_KEY = Deno.env.get("AIMLAPI_KEY");

    if (!AIMLAPI_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AIMLAPI_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify authentication
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

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isAdmin = (roles ?? []).some((r) => 
      ["super_admin", "district_manager", "content_team", "seo_team"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: FAQRequest = await req.json();
    const { action, page_id, page_ids, config, faqs } = body;
    const now = new Date().toISOString();

    // AI call helper with retries
    async function callAIWithRetry(requestBody: object, maxRetries = 4): Promise<Response> {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          console.log(`faq-generation-studio: Retry attempt ${attempt + 1}/${maxRetries}`);
        }
        
        try {
          const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${AIMLAPI_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (response.ok) return response;
          
          if (response.status >= 500 || response.status === 429) {
            lastError = new Error(`AI gateway returned ${response.status}`);
            continue;
          }
          
          return response;
        } catch (networkError) {
          lastError = networkError instanceof Error ? networkError : new Error(String(networkError));
        }
      }
      throw lastError || new Error("AI gateway failed after retries");
    }

    // FAQ System Prompt - Optimized for "People Also Ask" style
    const FAQ_SYSTEM_PROMPT = `You are an expert FAQ generator for dental pages. Generate FAQs that:

=== STYLE: GOOGLE "PEOPLE ALSO ASK" ===
- Questions should mirror actual search queries people type into Google
- Focus on practical, actionable questions patients actually ask
- Include question variations: "How much does...", "What is...", "Where can I...", "Is it safe to...", "How long does..."
- Prioritize high search-volume question patterns

=== UNIQUENESS REQUIREMENTS (CRITICAL) ===
- Each FAQ set MUST be completely unique - no duplicate questions across pages
- Questions must include location/service-specific context
- Never use generic questions that could apply to any page
- Customize every answer with specific details about the location or service
- Vary question structures and phrasing dramatically between pages

=== CONTENT QUALITY ===
- Answers should be 40-80 words - comprehensive but scannable
- Use natural language, avoid jargon
- Include helpful details: cost ranges, time estimates, what to expect
- Be accurate and trustworthy
- No promotional language or exaggeration

=== LOCAL SEO OPTIMIZATION ===
- Include city/state names in questions naturally
- Reference local context (neighborhoods, regional healthcare)
- Mention local insurance considerations when relevant
- Add seasonal or regional context when appropriate

=== QUESTION CATEGORIES TO INCLUDE ===
1. Cost/pricing questions
2. Process/procedure questions  
3. Timing/duration questions
4. Qualification/eligibility questions
5. Comparison questions (vs alternatives)
6. Safety/risk questions
7. Recovery/aftercare questions
8. Insurance/payment questions`;

    // Generate uniqueness seed for FAQs
    function generateFAQUniqueSeed(slug: string, pageType: string): string {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      
      const questionStyles = [
        "Focus on 'How' and 'What' questions primarily",
        "Lead with cost and pricing questions",
        "Start with patient experience questions",
        "Emphasize safety and recovery questions",
        "Begin with eligibility and qualification questions",
        "Focus on comparison and alternatives questions",
        "Lead with timeline and process questions",
        "Start with insurance and payment questions"
      ];
      
      const answerStyles = [
        "Use conversational, friendly tone throughout",
        "Include specific numbers and ranges where possible",
        "Start answers with direct statements, then elaborate",
        "Use 'you' and 'your' to address the reader directly",
        "Include practical tips in each answer",
        "Reference local context in most answers",
        "Use reassuring language about safety",
        "Mention cost-saving options where relevant"
      ];
      
      const selectedQuestion = questionStyles[timestamp % questionStyles.length];
      const selectedAnswer = answerStyles[(timestamp + 3) % answerStyles.length];
      
      return `
=== FAQ UNIQUENESS DIRECTIVE (ID: ${randomId}) ===
QUESTION STYLE: ${selectedQuestion}
ANSWER STYLE: ${selectedAnswer}

MANDATORY: Each question must be unique to this specific page. Do NOT use:
- Generic "What is [treatment]?" without location context
- "How much does X cost?" without location specifics
- Any question that could apply to a different city/service page

GOOD examples:
- "How much does teeth whitening cost in [City], [State]?"
- "What should I expect during my first dental visit in [City]?"
- "Are there emergency dentists open on weekends in [City]?"

BAD examples (too generic):
- "What is teeth whitening?"
- "How long does the procedure take?"
- "Is it safe?"
`;
    }

    // Parse page context from slug and data
    function getPageContext(pageData: any): string {
      const { page_type, slug, title, content } = pageData;
      const parts = slug.split("/").filter(Boolean);
      
      let context = "";
      
      switch (page_type) {
        case "state":
          const stateName = title || parts[0]?.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "this state";
          context = `STATE DIRECTORY PAGE: ${stateName}
Focus FAQs on:
- Finding dentists across the state
- State dental licensing requirements
- Regional cost variations
- State-specific insurance considerations
- General dental care access in ${stateName}`;
          break;
          
        case "city":
          const cityName = title || parts[1]?.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "this city";
          const stateAbbr = parts[0]?.toUpperCase() || "";
          context = `CITY DIRECTORY PAGE: ${cityName}, ${stateAbbr}
Focus FAQs on:
- Finding local dentists in ${cityName}
- Dental costs specific to ${cityName} area
- Emergency dental care availability
- Insurance acceptance in the area
- What to expect at ${cityName} dental offices
- Pediatric and family dentistry options`;
          break;
          
        case "service_location":
        case "city_treatment":
          const treatmentName = parts[parts.length - 1]?.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "dental treatment";
          const locationCity = parts[1]?.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "this city";
          const locationState = parts[0]?.toUpperCase() || "";
          context = `SERVICE + LOCATION PAGE: ${treatmentName} in ${locationCity}, ${locationState}
Focus FAQs on:
- ${treatmentName} costs in ${locationCity}
- How ${treatmentName} works and what to expect
- Finding ${treatmentName} specialists in ${locationCity}
- Recovery and aftercare for ${treatmentName}
- Insurance coverage for ${treatmentName} in ${locationState}
- ${treatmentName} alternatives available in ${locationCity}
- Duration and number of visits for ${treatmentName}`;
          break;
          
        case "treatment":
        case "service":
          const serviceName = title || slug.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
          context = `SERVICE PAGE: ${serviceName}
Focus FAQs on:
- What ${serviceName} involves
- Who needs ${serviceName}
- ${serviceName} costs and financing
- ${serviceName} process and timeline
- ${serviceName} recovery and results
- Alternatives to ${serviceName}
- Insurance and payment for ${serviceName}`;
          break;
          
        default:
          context = `PAGE: ${title || slug}
Generate relevant dental FAQs for this page.`;
      }
      
      return context;
    }

    // Generate FAQs for a page
    async function generateFAQs(pageData: any, faqCount: number = 10): Promise<Array<{ question: string; answer: string }>> {
      const pageContext = getPageContext(pageData);
      const uniqueSeed = generateFAQUniqueSeed(pageData.slug, pageData.page_type);
      
      const userPrompt = `Generate ${faqCount} unique FAQs for this dental page:

${pageContext}

PAGE URL: /${pageData.slug}
PAGE TYPE: ${pageData.page_type}

${pageData.content ? `EXISTING CONTENT (for context):
${pageData.content.slice(0, 800)}...` : ""}

${uniqueSeed}

Generate ${faqCount} FAQs that are:
1. Unique to this specific page (include location/service context)
2. Written in "People Also Ask" style (real search queries)
3. Comprehensive but scannable (40-80 word answers)
4. Locally relevant with specific details

CRITICAL: Each question MUST include the specific city/state/service name to ensure uniqueness.`;

      const requestBody = {
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: FAQ_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_faqs",
              description: "Generate unique, location-specific FAQs for a dental page",
              parameters: {
                type: "object",
                properties: {
                  faqs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "FAQ question including location/service context" },
                        answer: { type: "string", description: "Comprehensive 40-80 word answer" }
                      },
                      required: ["question", "answer"]
                    }
                  }
                },
                required: ["faqs"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_faqs" } }
      };

      const response = await callAIWithRetry(requestBody);

      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate limit exceeded");
        if (response.status === 402) throw new Error("AI credits exhausted");
        throw new Error(`AI service error (${response.status})`);
      }

      const aiJson = await response.json();
      
      // Extract from tool call
      if (aiJson.choices?.[0]?.message?.tool_calls?.[0]) {
        const toolCall = aiJson.choices[0].message.tool_calls[0];
        if (toolCall.function?.arguments) {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            return parsed.faqs || [];
          } catch (e) {
            console.error("Failed to parse FAQ tool arguments:", e);
          }
        }
      }
      
      throw new Error("Failed to generate FAQs");
    }

    // Check FAQ uniqueness against other pages
    async function checkFAQUniqueness(
      faqs: Array<{ question: string; answer: string }>,
      pageId: string,
      pageType: string
    ): Promise<{
      isUnique: boolean;
      duplicateCount: number;
      duplicateQuestions: string[];
    }> {
      // Get FAQs from similar page types
      const { data: candidates } = await supabaseAdmin
        .from('seo_pages')
        .select('id, slug, faqs')
        .eq('page_type', pageType)
        .neq('id', pageId)
        .not('faqs', 'is', null)
        .limit(50);
      
      const existingQuestions = new Set<string>();
      
      for (const candidate of candidates || []) {
        if (!candidate.faqs || !Array.isArray(candidate.faqs)) continue;
        for (const faqItem of candidate.faqs) {
          if (faqItem?.question) {
            // Normalize question for comparison
            const normalized = faqItem.question.toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .split(/\s+/)
              .filter((w: string) => w.length > 3)
              .join(' ');
            existingQuestions.add(normalized);
          }
        }
      }
      
      const duplicateQuestions: string[] = [];
      
      for (const faq of faqs) {
        const normalizedNew = faq.question.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3)
          .join(' ');
        
        // Check for high similarity
        for (const existing of existingQuestions) {
          const words1 = new Set(normalizedNew.split(' '));
          const words2 = new Set(existing.split(' '));
          const intersection = [...words1].filter(w => words2.has(w)).length;
          const union = new Set([...words1, ...words2]).size;
          const similarity = intersection / union;
          
          if (similarity > 0.7) {
            duplicateQuestions.push(faq.question);
            break;
          }
        }
      }
      
      return {
        isUnique: duplicateQuestions.length === 0,
        duplicateCount: duplicateQuestions.length,
        duplicateQuestions
      };
    }

    // Audit FAQs across pages
    async function auditFAQs(pageType?: string): Promise<{
      totalPages: number;
      pagesWithFAQs: number;
      pagesWithoutFAQs: number;
      avgFAQCount: number;
      duplicateIssues: number;
    }> {
      let query = supabaseAdmin.from('seo_pages').select('id, slug, page_type, faqs');
      
      if (pageType) {
        query = query.eq('page_type', pageType);
      }
      
      const { data: pages } = await query.limit(1000);
      
      const pagesWithFAQs = (pages || []).filter(p => p.faqs && Array.isArray(p.faqs) && p.faqs.length > 0);
      const pagesWithoutFAQs = (pages || []).filter(p => !p.faqs || !Array.isArray(p.faqs) || p.faqs.length === 0);
      
      let totalFAQCount = 0;
      const allQuestions: Map<string, string[]> = new Map();
      
      for (const page of pagesWithFAQs) {
        if (page.faqs && Array.isArray(page.faqs)) {
          totalFAQCount += page.faqs.length;
          
          for (const faqItem of page.faqs) {
            if (faqItem?.question) {
              const normalized = faqItem.question.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .trim();
              
              if (!allQuestions.has(normalized)) {
                allQuestions.set(normalized, []);
              }
              allQuestions.get(normalized)!.push(page.slug);
            }
          }
        }
      }
      
      // Count duplicates (questions appearing on multiple pages)
      const duplicateIssues = [...allQuestions.values()].filter(slugs => slugs.length > 1).length;
      
      return {
        totalPages: (pages || []).length,
        pagesWithFAQs: pagesWithFAQs.length,
        pagesWithoutFAQs: pagesWithoutFAQs.length,
        avgFAQCount: pagesWithFAQs.length > 0 ? Math.round(totalFAQCount / pagesWithFAQs.length) : 0,
        duplicateIssues
      };
    }

    // Handle different actions
    switch (action) {
      case "generate_faqs": {
        if (!page_id) {
          return new Response(JSON.stringify({ success: false, error: "page_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch page data
        const { data: pageData, error: pageError } = await supabaseAdmin
          .from('seo_pages')
          .select('*')
          .eq('id', page_id)
          .single();

        if (pageError || !pageData) {
          return new Response(JSON.stringify({ success: false, error: "Page not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const faqCount = config?.faq_count || 10;
        const generatedFAQs = await generateFAQs(pageData, faqCount);
        
        // Check uniqueness
        const uniquenessCheck = await checkFAQUniqueness(generatedFAQs, page_id, pageData.page_type);
        
        // Save FAQs to page - STRICT SEPARATION: FAQ Studio ONLY writes to FAQ fields
        const updateData: Record<string, any> = {
          faqs: generatedFAQs,
          last_faq_edit_source: 'faq_studio',
          updated_at: now
        };
        
        // Validate we're not writing to blocked fields
        const validation = validateFAQStudioWrite(Object.keys(updateData));
        if (!validation.valid) {
          console.error(`FAQ Studio attempted to write to blocked fields: ${validation.blockedFields.join(', ')}`);
          // Remove blocked fields from update
          for (const blocked of validation.blockedFields) {
            delete updateData[blocked];
          }
        }
        
        const { error: updateError } = await supabaseAdmin
          .from('seo_pages')
          .update(updateData)
          .eq('id', page_id);

        if (updateError) {
          throw updateError;
        }

        // Also save version history
        const { data: currentVersion } = await supabaseAdmin
          .from('seo_content_versions')
          .select('version_number')
          .eq('seo_page_id', page_id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        const newVersion = (currentVersion?.version_number || 0) + 1;

        // Save version to content versions if table has faqs column
        await supabaseAdmin
          .from('seo_content_versions')
          .insert({
            seo_page_id: page_id,
            version_number: newVersion,
            content: JSON.stringify({ faqs: generatedFAQs }),
            change_source: 'faq_studio',
            change_reason: `Generated ${generatedFAQs.length} FAQs`,
            is_current: true,
            created_at: now
          });

        return new Response(JSON.stringify({
          success: true,
          faq_count: generatedFAQs.length,
          faqs: generatedFAQs,
          uniqueness: uniquenessCheck,
          page_slug: pageData.slug
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "preview_faqs": {
        if (!page_id) {
          return new Response(JSON.stringify({ success: false, error: "page_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: pageData, error: pageError } = await supabaseAdmin
          .from('seo_pages')
          .select('*')
          .eq('id', page_id)
          .single();

        if (pageError || !pageData) {
          return new Response(JSON.stringify({ success: false, error: "Page not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const faqCount = config?.faq_count || 10;
        const generatedFAQs = await generateFAQs(pageData, faqCount);
        const uniquenessCheck = await checkFAQUniqueness(generatedFAQs, page_id, pageData.page_type);

        return new Response(JSON.stringify({
          success: true,
          preview: true,
          faq_count: generatedFAQs.length,
          faqs: generatedFAQs,
          uniqueness: uniquenessCheck,
          page: {
            id: pageData.id,
            slug: pageData.slug,
            title: pageData.title,
            page_type: pageData.page_type,
            existing_faqs: pageData.faqs
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "apply_faqs": {
        if (!page_id || !faqs) {
          return new Response(JSON.stringify({ success: false, error: "page_id and faqs required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await supabaseAdmin
          .from('seo_pages')
          .update({
            faqs: faqs,
            updated_at: now
          })
          .eq('id', page_id);

        if (updateError) {
          throw updateError;
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Applied ${faqs.length} FAQs to page`
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "audit_faqs": {
        const pageType = config?.faq_count ? undefined : body.page_id; // Reuse page_id as pageType filter
        const auditResults = await auditFAQs(pageType as string | undefined);

        return new Response(JSON.stringify({
          success: true,
          audit: auditResults
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("faq-generation-studio error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
