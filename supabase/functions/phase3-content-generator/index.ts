import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// PHASE 3 CONTENT GENERATOR
// Sprint 3.1: Content Scaling (100+ blog posts)
// Sprint 3.2: Neighborhood Pages (150-200 pages)
// ============================================================

interface Phase3Request {
  action: "generate-blog" | "generate-neighborhood";
  category?: string;
  template?: string;
  city?: string;
  neighborhood?: string;
  target_word_count?: number;
}

// ========================================
// BLOG TEMPLATES BY CATEGORY
// ========================================

const INFORMATIONAL_TEMPLATE = `You are writing an INFORMATIONAL DEEP DIVE blog post for AppointPanda dental directory.

=== TEMPLATE: "What to Expect During Your First [Specialty] Visit" ===
Target: 1,800-2,200 words

H1: What to Expect During Your First [Specialty] Visit: Complete Guide [2026]

1. INTRODUCTION (200 words)
   - The importance of this first visit
   - Common patient concerns
   - What this guide covers

2. H2: Before Your Appointment (300 words)
   - What to bring (ID, insurance, records)
   - How to prepare
   - Questions to have ready
   - What to eat/not eat

3. H2: What Happens During the Visit (400 words)
   - Check-in process
   - Initial examination steps
   - Diagnostic procedures (X-rays, scans)
   - Consultation with the dentist
   - Treatment planning discussion

4. H2: Common Procedures at First Visit (300 words)
   - Cleaning and examination
   - X-rays and imaging
   - Oral health assessment
   - Treatment recommendations

5. H2: Questions to Ask Your Dentist (250 words)
   - About your specific condition
   - About treatment options
   - About costs and insurance
   - About follow-up care

6. H2: After Your Appointment (200 words)
   - What to expect
   - Follow-up steps
   - Scheduling next visit

7. H2: Cost Expectations (250 words)
   - Typical first visit costs
   - What insurance covers
   - Payment options

8. H2: Find a [Specialty] Near You (150 words)
   - CTA to AppointPanda
   - Benefits of using directory

9. H2: FAQs (200 words)
   - 5-6 common first-visit questions`;

const PROBLEM_SOLVING_TEMPLATE = `You are writing a PROBLEM-SOLVING blog post for AppointPanda.

=== TEMPLATE: Emergency/Problem-Solving Content ===
Target: 1,200-1,800 words

H1: [Problem]: Causes, Treatment & When to See a Dentist [2026]

1. INTRODUCTION (150 words)
   - Acknowledge the urgency
   - Quick summary of what to do
   - When this is an emergency

2. H2: Understanding [Problem] (250 words)
   - What causes it
   - Common symptoms
   - Risk factors

3. H2: Immediate Relief: What to Do Right Now (300 words)
   - Step-by-step first aid
   - Safe home remedies
   - What NOT to do
   - Over-the-counter options

4. H2: When to See a Dentist Immediately (200 words)
   - Warning signs of emergency
   - Symptoms requiring urgent care
   - What can wait vs. what can't

5. H2: Professional Treatment Options (300 words)
   - What the dentist will do
   - Treatment procedures
   - Recovery expectations
   - Prevention going forward

6. H2: Cost of Treatment (200 words)
   - Typical cost range
   - Emergency visit costs
   - Insurance considerations

7. H2: Find Emergency Dental Care Now (150 words)
   - CTA to emergency finder
   - 24/7 availability
   - Walk-in options

8. H2: FAQs (150 words)
   - 5 urgent questions`;

const INSURANCE_TEMPLATE = `You are writing an INSURANCE & FINANCIAL blog post for AppointPanda.

=== TEMPLATE: "Does [Insurance] Cover [Procedure]?" ===
Target: 1,800-2,200 words

H1: Does [Insurance Company] Cover [Procedure]? [2026 Coverage Guide]

1. INTRODUCTION (200 words)
   - Quick answer to the main question
   - Why coverage varies
   - How to verify your specific coverage

2. H2: [Insurance] Dental Coverage Overview (300 words)
   - Types of plans offered
   - General coverage levels
   - Network considerations

3. H2: [Procedure] Coverage Details (400 words)
   - What's typically covered
   - Coverage percentages (50%, 80%, etc.)
   - Waiting periods
   - Annual maximums
   - Pre-authorization requirements

4. H2: What [Insurance] Covers vs. Excludes (300 words)
   - TABLE: Covered vs. Not Covered
   - Common exclusions
   - Age restrictions
   - Frequency limitations

5. H2: How to Verify Your Coverage (250 words)
   - Contacting [Insurance]
   - Questions to ask
   - Getting pre-authorization
   - Understanding your EOB

6. H2: Out-of-Pocket Costs to Expect (250 words)
   - Deductibles
   - Copays vs. coinsurance
   - Maximum out-of-pocket
   - In-network vs. out-of-network

7. H2: How to Save Money on [Procedure] (200 words)
   - Finding in-network providers
   - Dental savings plans
   - Payment plans
   - FSA/HSA usage

8. H2: Find [Insurance] Dentists Near You (150 words)
   - CTA to AppointPanda
   - Filter by insurance

9. H2: FAQs (150 words)
   - 5 insurance-specific questions`;

const NEIGHBORHOOD_TEMPLATE = `You are generating a NEIGHBORHOOD landing page for AppointPanda.

=== TEMPLATE: Best Dentists in [Neighborhood], [City] ===
Target: 1,500-2,000 words

H1: Best Dentists in [Neighborhood], [City] | [#] Local Clinics [2026]

1. INTRODUCTION (150 words)
   - Overview of dental care in [Neighborhood]
   - What makes this area unique
   - Number of dentists available

2. H2: Top Dentists in [Neighborhood] (250 words)
   - What to look for
   - Types of practices in the area
   - CTA: View all dentists

3. H2: Why Choose a Dentist in [Neighborhood]? (200 words)
   - Convenience factors
   - Local character
   - Accessibility (parking, transit)

4. H2: Services Available in [Neighborhood] (250 words)
   - Common services offered
   - Specialty services
   - Emergency care availability

5. H2: Average Dental Costs in [Neighborhood] (300 words)
   - COST TABLE: 10 common procedures
   - How [Neighborhood] compares to [City] average
   - Factors affecting local pricing

6. H2: Insurance Accepted (150 words)
   - Common insurers in the area
   - Finding in-network dentists

7. H2: Nearby Neighborhoods (200 words)
   - Links to adjacent areas
   - Why patients travel between neighborhoods

8. H2: Find Your Perfect Dentist in [Neighborhood] (100 words)
   - CTA to filtered search
   - Book appointment

9. H2: FAQs (200 words)
   - 5 neighborhood-specific questions

=== REQUIREMENTS ===
- Mention specific [Neighborhood] landmarks, streets, or character
- Reference nearby transit or parking
- Local cost context
- Natural internal links
- Schema-ready FAQ format`;

// AI generation function
async function generateContent(
  prompt: string,
  targetWordCount: number,
  aimlApiKey: string
): Promise<{ content: string; word_count: number }> {
  const systemPrompt = `You are an expert dental content writer for AppointPanda, a leading dental directory platform.

VOICE: Write in AppointPanda's first-party platform voice ("we", "our directory", "on AppointPanda").
STYLE: Professional yet accessible, patient-focused, medically accurate but not clinical.
FORMAT: Use markdown with proper heading hierarchy (H1, H2, H3).
TABLES: Use markdown tables for cost comparisons and structured data.
LENGTH: Target ${targetWordCount} words minimum. Be comprehensive.
E-E-A-T: Demonstrate expertise, experience, authoritativeness, trustworthiness.
CTAs: Include natural calls-to-action to AppointPanda directory throughout.

CRITICAL RULES:
- NO medical advice or diagnoses
- Use cost RANGES, not exact prices
- Include "consult your dentist" disclaimers
- Format FAQs for schema markup
- Natural keyword usage (no stuffing)`;

  const response = await fetch("https://api.aimlapi.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${aimlApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 8000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return { content, word_count: wordCount };
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
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isAdmin = (roles ?? []).some((r: any) =>
      ["super_admin", "district_manager", "content_team", "seo_team"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Phase3Request = await req.json();
    const { action, category, template, city, neighborhood, target_word_count = 1800 } = body;

    console.log(`Phase 3 action: ${action}`, { category, template, city, neighborhood });

    if (action === "generate-blog") {
      // Select template based on category
      let baseTemplate = INFORMATIONAL_TEMPLATE;
      if (category === "problem-solving") baseTemplate = PROBLEM_SOLVING_TEMPLATE;
      if (category === "insurance") baseTemplate = INSURANCE_TEMPLATE;

      const prompt = `${baseTemplate}

=== SPECIFIC TOPIC ===
Generate content for: "${template}"

Replace all placeholders with appropriate content for this specific topic.
Ensure the content is unique, comprehensive, and targets ${target_word_count}+ words.
Include real-world examples and actionable advice.`;

      const { content, word_count } = await generateContent(prompt, target_word_count, AIMLAPI_KEY);

      // Extract title from content
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : template;

      // Create slug
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 100);

      // Save to blog_posts
      const { data: savedPost, error: saveError } = await supabaseAdmin
        .from("blog_posts")
        .insert({
          title,
          slug,
          content: { body: content },
          category,
          status: "draft",
          tags: [category, "phase-3"],
          seo_title: title,
          seo_description: content.slice(0, 160).replace(/[#*]/g, "").trim(),
        })
        .select()
        .single();

      if (saveError) {
        console.error("Save error:", saveError);
        throw new Error(`Failed to save post: ${saveError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          post_id: savedPost.id,
          word_count,
          title,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "generate-neighborhood") {
      if (!city || !neighborhood) {
        return new Response(
          JSON.stringify({ success: false, error: "City and neighborhood required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get state for this city
      const { data: cityData } = await supabaseAdmin
        .from("cities")
        .select("state_id, states(name, abbreviation)")
        .eq("slug", city)
        .single();

      const stateName = (cityData?.states as any)?.name || "California";
      const stateAbbr = (cityData?.states as any)?.abbreviation || "CA";
      const cityName = city.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      const neighborhoodName = neighborhood.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      // Count dentists in city for context
      const { count: dentistCount } = await supabaseAdmin
        .from("clinics")
        .select("id", { count: "exact", head: true })
        .eq("city", cityName)
        .eq("is_active", true);

      const prompt = `${NEIGHBORHOOD_TEMPLATE}

=== SPECIFIC LOCATION ===
City: ${cityName}, ${stateName} (${stateAbbr})
Neighborhood: ${neighborhoodName}
Approximate dentists in city: ${dentistCount || 50}

Generate a comprehensive neighborhood page for ${neighborhoodName} in ${cityName}.
Include local context, cost estimates, and natural CTAs to AppointPanda.
Target ${target_word_count}+ words.`;

      const { content, word_count } = await generateContent(prompt, target_word_count, AIMLAPI_KEY);

      // Create slug
      const slug = `${stateAbbr.toLowerCase()}/${city}/${neighborhood}-dentists`;

      // Save to seo_pages
      const { data: savedPage, error: saveError } = await supabaseAdmin
        .from("seo_pages")
        .upsert(
          {
            slug,
            page_type: "neighborhood",
            h1: `Best Dentists in ${neighborhoodName}, ${cityName}`,
            content,
            word_count,
            is_optimized: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        )
        .select()
        .single();

      if (saveError) {
        console.error("Save error:", saveError);
        throw new Error(`Failed to save page: ${saveError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          page_id: savedPage?.id,
          word_count,
          slug,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Phase 3 generator error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
