import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==========================================
// CONTENT STUDIO - STRICT FIELD SEPARATION
// ==========================================
// This tool is ONLY allowed to write to body content fields.
// It must NEVER write to: meta_title, meta_description, og_title, og_description, faqs
// Those are managed by Meta Optimizer and FAQ Studio respectively.

const CONTENT_STUDIO_ALLOWED_FIELDS = [
  'h1', 'page_intro', 'h2_sections', 'content', 
  'internal_links_intro', 'word_count', 'is_thin_content',
  'last_content_edit_source', 'updated_at', 'is_optimized',
  'optimized_at', 'metadata_hash', 'is_duplicate', 
  'similarity_score', 'similar_to_slug', 'last_generated_at'
];

const CONTENT_STUDIO_BLOCKED_FIELDS = [
  'meta_title', 'meta_description', 'og_title', 'og_description', 'faqs'
];

function validateContentStudioWrite(fields: string[]): { valid: boolean; blockedFields: string[] } {
  const blockedFields = fields.filter(f => CONTENT_STUDIO_BLOCKED_FIELDS.includes(f));
  return { valid: blockedFields.length === 0, blockedFields };
}

interface ContentRequest {
  action: "generate_content" | "preview_content" | "apply_content" | "manual_edit" | "rollback_version";
  page_id?: string;
  version_id?: string;
  config?: {
    word_count?: number;
    rewrite_entire?: boolean;
    generate_intro?: boolean;
    generate_sections?: boolean;
    // generate_faqs REMOVED - FAQ Studio responsibility
    generate_internal_links?: boolean;
    expand_existing?: boolean;
    save_as_draft?: boolean;
    do_not_overwrite_existing?: boolean;
    rewrite_only_thin_sections?: boolean;
  };
  content?: {
    // meta_title REMOVED - Meta Optimizer responsibility
    // meta_description REMOVED - Meta Optimizer responsibility
    h1?: string;
    content?: string;
    intro_paragraph?: string;
    h2_sections?: any[];
    // faq REMOVED - FAQ Studio responsibility
    closing_paragraph?: string;
    internal_links_intro?: string;
  };
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

    const body: ContentRequest = await req.json();
    const { action, page_id, version_id, config, content } = body;
    const now = new Date().toISOString();

    // AI call helper with retries
    async function callAIWithRetry(requestBody: object, maxRetries = 4): Promise<Response> {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          console.log(`content-generation-studio: Retry attempt ${attempt + 1}/${maxRetries}`);
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

    // Master system prompt for AppointPanda content (non-clinic pages)
    const PLATFORM_SYSTEM_PROMPT = `You are generating SEO content ONLY for AppointPanda, a dental listing and appointment platform.

=== CRITICAL BUSINESS CONTEXT ===
- AppointPanda helps users find, compare, and book dentists and dental clinics
- We are NOT a dental clinic - we are a directory/booking platform
- ALL content must be written in AppointPanda's first-party voice: "we", "our platform", "AppointPanda helps patients..."

You must NEVER write as:
- a dentist or dental clinic
- a guest author or third-party blog
- Never claim medical diagnosis

=== CONTENT QUALITY STANDARDS ===
- Simple, human, friendly language
- Non-academic, conversational tone
- No keyword stuffing - natural usage only
- Written for patients first
- Clear, helpful, trustworthy
- No exaggerated claims ("best dentist", fake statistics)

=== STRUCTURE RULES ===
- Exactly ONE H1 per page
- 4-6 H2 sections with meaningful headings
- H3 only when logically belonging under an H2
- No bullet spam, no filler text
- 3-5 contextual FAQs at bottom

=== UNIQUENESS REQUIREMENT (CRITICAL) ===
- Each page MUST be completely unique - this is non-negotiable
- NEVER reuse paragraphs, sentence structures, or phrasing patterns
- Start each section with a different approach (question, statement, scenario, statistic)
- Vary sentence lengths dramatically (some short, some complex)
- Use location-specific or context-specific details unique to this page
- Even similar pages (e.g., two city pages) must read completely differently
- Rotate opening styles: "When you need...", "Finding...", "Located in...", "Patients seeking...", etc.
- Add unique local context: neighborhoods, landmarks, demographics
- Include varied examples and scenarios specific to the location/service

=== SEO COMPLIANCE ===
- Meta title under 60 characters, keyword near beginning
- Meta description under 155 characters with clear CTA
- Google E-E-A-T compliance
- No AI footprints or repetitive patterns

=== CALL TO ACTION ===
End with calm, helpful CTA encouraging users to:
- Explore dentists on AppointPanda
- Book appointments through our platform`;

    // CLINIC-SPECIFIC system prompt - focuses on the clinic itself for branded SEO
    const CLINIC_SYSTEM_PROMPT = `You are generating SEO content for a DENTAL CLINIC/PRACTICE profile page.

=== CRITICAL BUSINESS CONTEXT ===
- This content is for the clinic's profile page to help it RANK for the clinic name
- Write as a neutral, informative third-party describing THIS clinic
- DO NOT mention "AppointPanda", "our platform", or any directory references
- Focus 100% on the CLINIC: its services, location, team, patient experience
- Goal: When someone searches the clinic name on Google, this page should rank

=== VOICE & TONE ===
- Write ABOUT the clinic, not FOR the clinic (neutral third-party perspective)
- Use the clinic name naturally throughout the content
- "This practice offers...", "[Clinic Name] provides...", "Patients visiting [Clinic Name] can expect..."
- DO NOT use "we", "our" (that would imply you ARE the clinic)
- DO NOT use "they" excessively - use the clinic name for SEO

=== CONTENT QUALITY STANDARDS ===
- Simple, human, friendly language
- Professional but approachable tone
- No keyword stuffing - natural clinic name usage
- Written for patients researching this specific clinic
- Helpful, informative, trustworthy
- No exaggerated claims ("best dentist in the city", fake reviews)

=== STRUCTURE RULES ===
- Exactly ONE H1 (should include clinic name)
- 4-6 H2 sections covering: About, Services, Location, Patient Experience, etc.
- H3 only when logically belonging under an H2
- No bullet spam, no filler text
- 3-5 FAQs specific to this clinic

=== UNIQUENESS REQUIREMENT ===
- Each clinic page must be completely unique
- NEVER reuse generic dental content across clinics
- Personalize based on clinic name, location, and any known details
- Even similar clinics must read differently

=== SEO COMPLIANCE (BRANDED SEARCH) ===
- Meta title: "[Clinic Name] | Dental Services in [City]" (under 60 chars)
- Meta description: Unique description mentioning clinic name (under 155 chars)
- Include clinic name naturally 3-5 times in content
- Location references (city, neighborhood) for local SEO
- Google E-E-A-T compliance

=== WHAT TO INCLUDE ===
- Clinic overview and what makes it notable
- Services offered (general, cosmetic, emergency, etc.)
- Location and accessibility information
- What patients can expect during a visit
- FAQs about the clinic specifically

=== WHAT TO AVOID ===
- Do NOT invent specific facts (founding year, staff names, awards)
- Do NOT make up patient testimonials
- Do NOT claim specific certifications unless provided
- Do NOT mention AppointPanda or any booking platform`;

    // ==========================================
    // EXPANDED UNIQUENESS ENGINE
    // ==========================================
    
    // 50+ unique opening styles - randomized selection
    const OPENING_STYLES = [
      // Question-based (10)
      "Start with a thought-provoking question that immediately connects to the reader's situation.",
      "Open with a patient concern question: 'Are you wondering...' or 'Do you want to know...'",
      "Begin with an empathy-driven question addressing common dental anxieties.",
      "Start with a practical question patients actually ask their dentist.",
      "Open with a consequences-focused question: 'What happens if you delay...'",
      "Begin with a comparison question that helps readers understand their options.",
      "Start with a cost-focused question that addresses financial concerns.",
      "Open with a process question explaining what to expect.",
      "Begin with a 'who should' question targeting specific patient groups.",
      "Start with a timing question addressing urgency or best timing.",
      
      // Statistic/Fact-based (10)
      "Open with a compelling local statistic or healthcare trend.",
      "Begin with a surprising fact about dental health in this area.",
      "Start with a data point that puts the service into context.",
      "Open with a percentage or ratio that highlights importance.",
      "Begin with a 'did you know' fact about dental procedures.",
      "Start with an industry statistic that establishes credibility.",
      "Open with a before/after statistic showing impact.",
      "Begin with a cost comparison statistic.",
      "Start with a patient outcome statistic.",
      "Open with a prevalence statistic about dental needs in the area.",
      
      // Scenario-based (10)
      "Begin with a relatable patient scenario that captures daily life.",
      "Open with a 'first visit' scenario describing the patient experience.",
      "Start with a decision-making scenario helping patients choose.",
      "Begin with an emergency scenario that establishes urgency.",
      "Open with a family scenario showing broader impact.",
      "Start with a lifestyle scenario connecting dental health to daily life.",
      "Begin with a comparison scenario between options.",
      "Open with a cost-benefit scenario for decision making.",
      "Start with a recovery timeline scenario setting expectations.",
      "Begin with a 'typical patient' scenario for relatability.",
      
      // Statement-based (10)
      "Open with a bold, confident statement about what patients deserve.",
      "Begin with a direct address to the reader: 'If you're in [area], you have options...'",
      "Start with an empowering statement about dental health ownership.",
      "Open with a reassuring statement addressing common fears.",
      "Begin with a factual statement establishing expertise.",
      "Start with a promise statement about what you'll learn.",
      "Open with a clarity statement cutting through confusion.",
      "Begin with a value proposition statement.",
      "Start with an expectations-setting statement.",
      "Open with a benefit-focused opening statement.",
      
      // Contrast/Comparison (10)
      "Open with a contrast between outdated beliefs and modern reality.",
      "Begin with a comparison that reframes patient expectations.",
      "Start with a 'myth vs reality' framing.",
      "Open with a before/after transformation framing.",
      "Begin with a local vs generic comparison.",
      "Start with a 'many think vs actually' framing.",
      "Open with a old approach vs new approach contrast.",
      "Begin with a DIY vs professional comparison.",
      "Start with a fear vs reality contrast.",
      "Open with a cost vs value comparison framing."
    ];
    
    // 50+ H2 heading variations per section type
    const HEADING_VARIATIONS = {
      // Introduction/Openings
      intro: [
        "Understanding [X] in [Location]",
        "[Location]'s Guide to [X]",
        "Everything About [X] for [Location] Residents",
        "[X] in [Location]: What You Need to Know",
        "Getting Started with [X] in [Location]",
        "[X] Near You: A Complete Overview",
        "Why [Location] Residents Choose [X]",
        "Your [X] Resource for [Location]",
        "[X] Explained for [Location] Patients",
        "The [Location] [X] Experience"
      ],
      // About/What is
      about: [
        "What Exactly is [X]?",
        "Understanding [X]: The Basics",
        "[X] 101: A Quick Introduction",
        "The Science Behind [X]",
        "How [X] Works: An Overview",
        "Breaking Down [X]",
        "[X]: What You Should Know",
        "The Essentials of [X]",
        "A Clear Explanation of [X]",
        "Understanding the [X] Process"
      ],
      // Who needs/When
      whoNeeds: [
        "Is [X] Right for You?",
        "Who Should Consider [X]?",
        "Signs You Might Need [X]",
        "When [X] Becomes Necessary",
        "Common Reasons for [X]",
        "Who Benefits Most from [X]?",
        "Identifying [X] Candidates",
        "Understanding If [X] is Needed",
        "Who Makes a Good [X] Candidate?",
        "The [X] Decision: Is It Time?"
      ],
      // Cost/Pricing
      cost: [
        "How Much Does [X] Cost in [Location]?",
        "[Location] [X] Pricing Guide",
        "Understanding [X] Investment",
        "[X] Costs: What to Expect",
        "Affording [X] in [Location]",
        "[X] Price Ranges Explained",
        "The True Cost of [X]",
        "[Location] [X]: Budgeting Guide",
        "[X] Expenses: A Breakdown",
        "What Influences [X] Pricing?"
      ],
      // Process/Procedure
      procedure: [
        "What Happens During [X]?",
        "The [X] Procedure: Step by Step",
        "A Patient's Journey Through [X]",
        "Inside the [X] Experience",
        "What to Expect During [X]",
        "The [X] Process Demystified",
        "Your [X] Appointment: What Occurs",
        "Breaking Down the [X] Steps",
        "From Consultation to [X] Completion",
        "The [X] Timeline Explained"
      ],
      // Recovery/Aftercare
      recovery: [
        "Healing After [X]: What to Expect",
        "[X] Recovery Timeline",
        "Your [X] Aftercare Guide",
        "Post-[X] Care Essentials",
        "Recovering from [X]",
        "[Location] [X] Recovery Tips",
        "Managing [X] Healing",
        "What Happens After [X]?",
        "Your Recovery Journey",
        "After [X]: Next Steps"
      ],
      // Benefits/Why
      benefits: [
        "Why Choose [X]? Key Benefits",
        "The Advantages of [X]",
        "Transform Your Smile with [X]",
        "Benefits That Matter Most",
        "Why [Location] Patients Prefer [X]",
        "[X] Benefits Explained",
        "Is [X] Worth It? Benefits Overview",
        "Top Reasons for [X]",
        "What [X] Can Do for You",
        "The Value of Choosing [X]"
      ],
      // Insurance/Payment
      insurance: [
        "Does Insurance Cover [X]?",
        "[Location] Insurance for [X]",
        "Making [X] Affordable",
        "[X] and Your Dental Insurance",
        "Payment Options for [X]",
        "Financing [X] in [Location]",
        "[X] Costs and Insurance Guide",
        "Understanding [X] Coverage",
        "Affordable [X] Options",
        "[X] Payment Plans"
      ],
      // Finding/Choosing
      finding: [
        "Finding the Right [X] Provider",
        "Choosing Your [X] Dentist",
        "Where to Get [X] in [Location]",
        "Selecting a [X] Specialist",
        "The Best [X] Options Nearby",
        "Finding Quality [X] Care",
        "[Location] [X] Provider Guide",
        "Your [X] Dentist Search Starts Here",
        "What to Look for in a [X] Provider",
        "Getting Started with [X] Treatment"
      ],
      // FAQ
      faq: [
        "Common Questions About [X]",
        "[X] FAQ: Quick Answers",
        "Your [X] Questions Answered",
        "Everything You Wonder About [X]",
        "[X] Mysteries Explained",
        "Top [X] Questions",
        "What Patients Ask About [X]",
        "[X] Essentials: Q&A",
        "The [X] Question Pool",
        "Demystifying [X]"
      ],
      // Closing/CTA
      closing: [
        "Ready to Explore [X]?",
        "Take the Next Step",
        "Find Your Perfect [X] Provider",
        "Book Your [X] Consultation",
        "Start Your [X] Journey",
        "Discover [X] Options Near You",
        "Get the [X] Care You Deserve",
        "Schedule Your [X] Visit",
        "Begin Your Smile Transformation",
        "Connect with Top [X] Dentists"
      ]
    };
    
    // 30+ CTA variations
    const CTA_VARIATIONS = [
      "Ready to learn more? Browse our directory to find the perfect dentist for your needs.",
      "Take the next step toward better dental health. Explore dentists offering [X] in [Location] today.",
      "Find a qualified provider near you. Our directory makes it easy to compare dentists and book appointments.",
      "Your journey to a healthier smile starts here. Discover top-rated dentists in [Location] offering [X].",
      "Don't wait to get the care you need. Search our verified network of dental professionals now.",
      "Looking for a dentist who specializes in [X]? We can help you find the right match.",
      "From routine care to specialized treatments, find the dentist who's right for you.",
      "Make an informed decision about your dental health. Compare dentists in [Location] on our platform.",
      "Get personalized recommendations for [X] providers in [Location]. Start your search today.",
      "Finding the right dentist shouldn't be stressful. Let us help you connect with quality care.",
      "Your perfect dental match is waiting. Explore our comprehensive directory of verified providers.",
      "Take control of your dental health journey. Find and book appointments with trusted dentists near you.",
      "Quality dental care is closer than you think. Discover top dentists in [Location] offering [X].",
      "Whether you need a routine checkup or specialized treatment, we can connect you with the right provider.",
      "Ready to smile with confidence? Find dentists in [Location] who can help you achieve your goals.",
      "We make finding a dentist simple. Browse verified reviews, compare providers, and book with ease.",
      "Your dental health matters. Find a dentist in [Location] who meets your specific needs.",
      "From first consultations to ongoing care, discover dentists who prioritize patient comfort and quality.",
      "Stop searching multiple websites. Our directory brings together the best dental professionals in one place.",
      "Experience the convenience of online booking. Find and schedule appointments with top-rated dentists now.",
      "Your smile deserves expert care. Connect with dental professionals who understand your needs.",
      "Finding the right dentist is the first step. We'll help you take it.",
      "See why thousands of patients trust our directory to find their perfect dental match.",
      "Don't settle for the first option you find. Compare dentists and make an informed choice.",
      "Quality care is available in your area. Let us help you find dentists who exceed expectations.",
      "Start your search with confidence. Our directory features verified, patient-reviewed dental professionals.",
      "Every smile is unique. Find a dentist in [Location] who understands your individual needs.",
      "From preventive care to complex procedures, connect with dentists offering the services you need.",
      "Your dental journey begins with one search. Find top-rated dentists in [Location] today.",
      "Making dental decisions is easier with the right information. Browse our directory to learn more."
    ];
    
    // Random selection helper
    function randomSelect<T>(arr: T[], seed: number): T {
      return arr[Math.floor((seed * 9301 + 49297) % arr.length)];
    }
    
    // Shuffle array helper
    function shuffle<T>(arr: T[], seed: number): T[] {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(((seed + i) * 9301) % (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }

    // Generate unique anti-duplication seed with expanded variations
    function generateUniquenessSeed(slug: string, pageType: string, cityData?: any, serviceName?: string): string {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 12);
      const seed = timestamp + randomId.charCodeAt(0);
      
      // Select random opening, headings, and CTA using seeded randomness
      const selectedOpening = randomSelect(OPENING_STYLES, seed);
      
      // Build section-specific heading variations
      const sectionHeadings = {
        about: randomSelect(HEADING_VARIATIONS.about, seed + 1),
        whoNeeds: randomSelect(HEADING_VARIATIONS.whoNeeds, seed + 2),
        cost: randomSelect(HEADING_VARIATIONS.cost, seed + 3),
        procedure: randomSelect(HEADING_VARIATIONS.procedure, seed + 4),
        recovery: randomSelect(HEADING_VARIATIONS.recovery, seed + 5),
        benefits: randomSelect(HEADING_VARIATIONS.benefits, seed + 6),
        insurance: randomSelect(HEADING_VARIATIONS.insurance, seed + 7),
        finding: randomSelect(HEADING_VARIATIONS.finding, seed + 8),
        faq: randomSelect(HEADING_VARIATIONS.faq, seed + 9),
        closing: randomSelect(HEADING_VARIATIONS.closing, seed + 10)
      };
      
      const selectedCTA = randomSelect(CTA_VARIATIONS, seed + 11);
      
      // Build unique structure by shuffling section order
      const sectionOrder = shuffle([
        { key: 'about', label: sectionHeadings.about },
        { key: 'whoNeeds', label: sectionHeadings.whoNeeds },
        { key: 'cost', label: sectionHeadings.cost },
        { key: 'procedure', label: sectionHeadings.procedure },
        { key: 'recovery', label: sectionHeadings.recovery },
        { key: 'benefits', label: sectionHeadings.benefits },
        { key: 'insurance', label: sectionHeadings.insurance },
        { key: 'finding', label: sectionHeadings.finding },
        { key: 'faq', label: sectionHeadings.faq }
      ], seed + 12);
      
      // Replace placeholders in section headings
      const locationName = cityData?.name || cityData?.city || 'your area';
      const service = serviceName || 'this treatment';
      
      const headingInstructions = sectionOrder.map((s, i) => 
        `${i + 1}. "${s.label.replace('[X]', service).replace('[Location]', locationName)}" - Write unique content for this section, different from all other pages`
      ).join('\n');
      
      return `
=== UNIQUENESS DIRECTIVE (ID: ${randomId}) ===
CRITICAL: This content MUST be completely unique from all other pages. Failure to comply will result in duplicate content penalties.

OPENING STYLE (MANDATORY): ${selectedOpening.replace('[X]', service).replace('[Location]', locationName)}

STRUCTURE: Write sections in this RANDOMIZED order (DO NOT use standard order):
${headingInstructions}

CLOSING CTA (MANDATORY): ${selectedCTA.replace('[X]', service).replace('[Location]', locationName)}

MANDATORY UNIQUENESS RULES:
1. Do NOT use these phrases (they signal AI-generated content):
   - "In today's fast-paced world"
   - "When it comes to"
   - "It's important to note"
   - "First and foremost"
   - "Additionally,"
   - "Furthermore,"
   - "In conclusion,"
   - "To summarize"
   - "As mentioned earlier"
   - "It's worth mentioning"

2. Do NOT use generic transitions (use varied, natural ones):
   - BAD: "Also, Another, Moreover, Furthermore, Additionally"
   - GOOD: "This means, As a result, Here's the thing, What this looks like, The benefit is"

3. VARY YOUR WRITING:
   - Mix short punchy sentences (5-8 words) with longer explanatory ones (20-30 words)
   - Start paragraphs differently (some with verbs, some with nouns, some with adjectives)
   - Use different sentence openers throughout
   - Vary the structure of your lists and examples

4. ADD GENUINE VALUE:
   - Include specific, actionable advice (not generic "consult your dentist")
   - Share practical tips patients can use immediately
   - Explain the "why" behind recommendations
   - Give real-world context that helps decision-making

5. LOCAL CONTEXT (for location pages):
   - Reference specific aspects of ${locationName}: its character, accessibility, patient demographics
   - Mention relevant local factors (commute patterns, local healthcare landscape, community needs)
   - DO NOT invent statistics or neighborhood names - only reference what's verifiable

UNIQUE IDENTIFIER: ${slug.toUpperCase()}-${randomId}
`;
    }
    
    // Fetch real location data for enhanced context
    async function fetchLocationContext(slug: string, pageType: string): Promise<any> {
      const parts = slug.split("/").filter(Boolean);
      
      try {
        if (pageType === "city" || pageType === "city_treatment") {
          const citySlug = parts[parts.length - 1] || parts[0];
          const { data: city } = await supabaseAdmin
            .from("cities")
            .select(`
              name,
              slug,
              description,
              states:state_id(name, abbreviation, name),
              neighborhoods(id, name, description)
            `)
            .eq("slug", citySlug)
            .single();
          return city;
        }
        
        if (pageType === "state") {
          const stateSlug = parts[0];
          const { data: state } = await supabaseAdmin
            .from("states")
            .select(`name, abbreviation, description, cities(name, slug)`)
            .eq("slug", stateSlug)
            .single();
          return state;
        }
      } catch (e) {
        console.log("Location context fetch failed:", e);
      }
      
      return null;
    }
    
    // Pre-generation uniqueness check - BEFORE generating
    async function checkPreGenerationUniqueness(pageId: string, pageType: string, slug: string): Promise<{
      similarPages: Array<{slug: string, content: string}>;
      avoidanceInstructions: string;
    }> {
      try {
        // Get 5 most similar pages of same type to use as anti-examples
        const { data: similarPages } = await supabaseAdmin
          .from('seo_pages')
          .select('slug, content')
          .eq('page_type', pageType)
          .neq('id', pageId)
          .not('content', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(5);
        
        if (!similarPages || similarPages.length === 0) {
          return { similarPages: [], avoidanceInstructions: '' };
        }
        
        // Build avoidance instructions
        const avoidanceInstructions = `
=== CRITICAL: DO NOT COPY THESE PAGES ===
The following pages already exist. Your content must be COMPLETELY DIFFERENT:

${similarPages.map((p, i) => `
Page ${i + 1}: /${p.slug}
Content excerpt: ${(p.content || '').slice(0, 300)}...
`).join('\n')}

ABSOLUTELY FORBIDDEN:
- Do not use similar opening sentences or hooks
- Do not repeat the same section structure or headings
- Do not use the same examples or scenarios
- Do not copy writing patterns or transitional phrases
- Do not follow the same flow or organization
Write something COMPLETELY NEW and DIFFERENT.
`;
        
        return { similarPages, avoidanceInstructions };
      } catch (e) {
        console.log("Pre-generation uniqueness check failed:", e);
        return { similarPages: [], avoidanceInstructions: '' };
      }
    }

    // Generate content for a page
    async function generateContent(pageData: any, wordCount: number, clinicData?: any) {
      const { id: pageId, page_type, slug, title, content: existingContent } = pageData;
      
      // Determine if this is a clinic page (uses different voice/strategy)
      const isClinicPage = page_type === "clinic" || page_type === "dentist";
      
      // Generate uniqueness seed
      const uniquenessSeed = generateUniquenessSeed(slug, page_type);
      
      // PRE-GENERATION: Check for similar pages to avoid
      const { avoidanceInstructions } = await checkPreGenerationUniqueness(
        pageId || '', 
        page_type, 
        slug
      );
      
      // Fetch real location context for enhanced content
      const locationContext = await fetchLocationContext(slug, page_type);
      
      // Build context based on page type
      let pageContext = "";
      const parts = slug.split("/").filter(Boolean);
      
      switch (page_type) {
        case "state":
          const stateName = title || parts[0]?.toUpperCase() || "this state";
          pageContext = `This is a STATE directory page for ${stateName}.
Context: Show all dental providers in ${stateName}. Explain how AppointPanda helps patients find dentists across the state.
Include: Overview of dental care landscape, how to find a dentist, what AppointPanda offers, popular services.`;
          break;
          
        case "city":
          const cityName = title || parts[1] || parts[0] || "this city";
          const stateAbbr = parts[0]?.toUpperCase() || "";
          pageContext = `This is a CITY directory page for ${cityName}, ${stateAbbr}.
Context: Show dentists in ${cityName}. Explain how AppointPanda helps local residents find dental care.
Include: Local dental care overview, finding the right dentist, services available, cost considerations.
LOCAL SPECIFICITY: Mention specific aspects of ${cityName} - its neighborhoods, community character, or regional healthcare landscape.`;
          break;
          
        case "treatment":
        case "service":
          const serviceName = title || slug.replace(/-/g, " ");
          pageContext = `This is a SERVICE/TREATMENT page for ${serviceName}.
Context: Explain what ${serviceName} is, who needs it, what to expect.
Include: What is this treatment, who is it for, process overview, cost considerations, how AppointPanda helps find providers.`;
          break;
          
        case "service_location":
        case "city_treatment":
          const treatmentName = title || parts[parts.length - 1]?.replace(/-/g, " ") || "dental treatment";
          const locationCity = parts[1]?.replace(/-/g, " ") || "this city";
          const locationState = parts[0]?.toUpperCase() || "";
          pageContext = `This is a SERVICE + LOCATION page for ${treatmentName} in ${locationCity}, ${locationState}.
Context: Explain ${treatmentName} and how to find providers offering it in ${locationCity}.
Include: What is ${treatmentName}, local availability, cost in this area, how to choose a provider, AppointPanda's role.
IMPORTANT: Make this unique - combine local ${locationCity} context with ${treatmentName} specifics. Don't just merge generic content.`;
          break;
          
        case "clinic":
        case "dentist":
          // For clinic pages, extract clinic name and location for branded SEO
          const clinicName = clinicData?.name || title || "this dental practice";
          const clinicCity = clinicData?.city || "";
          const clinicState = clinicData?.state || "";
          const clinicAddress = clinicData?.address || "";
          const clinicServices = clinicData?.services?.join(", ") || "general dental services";
          
          pageContext = `This is a CLINIC PROFILE page for: ${clinicName}
${clinicCity ? `Location: ${clinicCity}${clinicState ? `, ${clinicState}` : ""}` : ""}
${clinicAddress ? `Address: ${clinicAddress}` : ""}
${clinicServices ? `Known services: ${clinicServices}` : ""}

GOAL: Help this page RANK when someone searches for "${clinicName}" on Google.

Content Focus:
- Use "${clinicName}" naturally 3-5 times throughout the content
- Write ABOUT the clinic from a neutral third-party perspective
- Include: About ${clinicName}, Services offered, Location & accessibility, Patient experience, FAQs about ${clinicName}
- DO NOT invent specific facts (founding year, staff names, awards, patient counts)
- DO NOT create fake testimonials
- Focus on what patients searching for this clinic would want to know`;
          break;
          
        case "static":
          pageContext = `This is a STATIC page (About, Features, Policy, etc.).
Context: Write informative content appropriate for the page's purpose.
Include: Clear explanation of the topic, how it relates to AppointPanda, user benefits.`;
          break;
          
        default:
          pageContext = `This is a general page on AppointPanda.
Context: Write helpful, informative content for dental patients.
Include: Clear explanations, how AppointPanda helps, relevant information for the topic.`;
      }

      // Select the appropriate system prompt
      const systemPrompt = isClinicPage ? CLINIC_SYSTEM_PROMPT : PLATFORM_SYSTEM_PROMPT;
      
      // Build user prompt - include uniqueness seed for differentiation
      const userPrompt = isClinicPage 
        ? `Generate SEO-optimized content for this CLINIC profile page:

PAGE URL: /${slug}
PAGE TYPE: ${page_type}
TARGET WORD COUNT: ${wordCount} words

${pageContext}

${existingContent ? `EXISTING CONTENT (for reference, improve upon it):
${existingContent.slice(0, 500)}...` : "No existing content - create from scratch."}

${locationContext ? `\n\nLOCATION CONTEXT:\n${JSON.stringify(locationContext, null, 2)}` : ''}

${uniquenessSeed}

${avoidanceInstructions}

Generate comprehensive, unique content that helps this clinic rank for its name. Remember: NO AppointPanda mentions, write about the clinic only.`
        : `Generate SEO-optimized content for this page:

PAGE URL: /${slug}
PAGE TYPE: ${page_type}
TARGET WORD COUNT: ${wordCount} words

${pageContext}

${existingContent ? `EXISTING CONTENT (for reference, but write COMPLETELY NEW unique content):
${existingContent.slice(0, 500)}...` : "No existing content - create from scratch."}

${locationContext ? `\n\nLOCATION CONTEXT:\n${JSON.stringify(locationContext, null, 2)}` : ''}

${uniquenessSeed}

${avoidanceInstructions}

CRITICAL: This content MUST be 100% unique. Do not reuse any phrases, structures, or patterns from other pages. Generate fresh, original content following the uniqueness directive above.`;

      const requestBody = {
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        // STRICT TOOL SEPARATION: Content Studio does NOT generate meta_title, meta_description, or FAQs
        // Those are handled by Meta Optimizer and FAQ Studio respectively
        tools: [
          {
            type: "function",
            function: {
              name: "generate_page_content",
              description: isClinicPage 
                ? "Generate BODY CONTENT ONLY for a dental clinic profile page (no meta tags, no FAQs)" 
                : "Generate BODY CONTENT ONLY for SEO page (no meta tags, no FAQs - those are handled separately)",
              parameters: {
                type: "object",
                properties: {
                  // meta_title REMOVED - Meta Optimizer responsibility
                  // meta_description REMOVED - Meta Optimizer responsibility
                  h1: { type: "string", description: isClinicPage ? "Main H1 with clinic name" : "Main H1 heading" },
                  intro_paragraph: { type: "string", description: "Opening paragraph 50-100 words" },
                  h2_sections: {
                    type: "array",
                    description: "4-6 H2 sections covering the page topic comprehensively",
                    items: {
                      type: "object",
                      properties: {
                        heading: { type: "string", description: "H2 section heading" },
                        content: { type: "string", description: "Section content 80-150 words" },
                        h3_subsections: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              heading: { type: "string" },
                              content: { type: "string" }
                            }
                          }
                        }
                      }
                    }
                  },
                  // faq REMOVED - FAQ Studio responsibility (strict separation)
                  closing_paragraph: { type: "string", description: isClinicPage ? "Closing paragraph (no CTA to external platforms)" : "Closing with CTA" },
                  internal_links_intro: { type: "string", description: "Optional bridge sentence before internal links section" }
                },
                required: ["h1", "intro_paragraph", "h2_sections", "closing_paragraph"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_page_content" } }
      };
      const response = await callAIWithRetry(requestBody);

      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate limit exceeded. Please wait and try again.");
        if (response.status === 402) throw new Error("AI credits exhausted. Please add credits.");
        throw new Error(`AI service error (${response.status})`);
      }

      const aiJson = await response.json();
      
      // Extract from tool call
      if (aiJson.choices?.[0]?.message?.tool_calls?.[0]) {
        const toolCall = aiJson.choices[0].message.tool_calls[0];
        if (toolCall.function?.arguments) {
          try {
            return JSON.parse(toolCall.function.arguments);
          } catch (e) {
            console.error("Failed to parse tool arguments:", e);
          }
        }
      }
      
      // Fallback: try parsing content
      const content = aiJson.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      throw new Error("Failed to generate content");
    }

    // Build full content markdown from generated sections
    // NOTE: FAQs are NOT included here - they are managed separately by FAQ Studio
    function buildContentMarkdown(generated: any): string {
      let markdown = "";
      
      if (generated.intro_paragraph) {
        markdown += generated.intro_paragraph + "\n\n";
      }
      
      if (generated.h2_sections && Array.isArray(generated.h2_sections)) {
        for (const section of generated.h2_sections) {
          markdown += `## ${section.heading}\n\n${section.content}\n\n`;
          
          if (section.h3_subsections && Array.isArray(section.h3_subsections)) {
            for (const subsection of section.h3_subsections) {
              markdown += `### ${subsection.heading}\n\n${subsection.content}\n\n`;
            }
          }
        }
      }
      
      // FAQs REMOVED - FAQ Studio is responsible for FAQs (strict tool separation)
      // The FAQ section will be rendered from the dedicated `faqs` JSONB column
      
      if (generated.closing_paragraph) {
        markdown += generated.closing_paragraph + "\n";
      }
      
      // Add internal links intro if provided
      if (generated.internal_links_intro) {
        markdown += "\n" + generated.internal_links_intro + "\n";
      }
      
      return markdown;
    }

    // Count words in content
    function countWords(text: string): number {
      if (!text) return 0;
      return text.split(/\s+/).filter(Boolean).length;
    }

    // Simple hash for content fingerprinting
    function hashContent(content: string): string {
      let hash = 0;
      const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
      for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(16);
    }

    // Check content uniqueness against existing pages - ENHANCED with stricter checks
    async function checkContentUniqueness(content: string, pageId: string, pageType: string): Promise<{
      isUnique: boolean;
      similarity: number;
      similarSlug: string | null;
    }> {
      // Get more candidates for comparison (100 instead of 50)
      const { data: candidates } = await supabaseAdmin
        .from('seo_pages')
        .select('id, slug, content')
        .eq('page_type', pageType)
        .neq('id', pageId)
        .not('content', 'is', null)
        .limit(100);
      
      let maxSimilarity = 0;
      let similarSlug: string | null = null;
      
      // Normalize content for comparison
      const normalizeText = (text: string) => text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      const words1 = new Set(normalizeText(content));
      
      // Also check opening sentences (first 100 words) for intro uniqueness
      const intro1 = normalizeText(content.slice(0, 500));
      
      for (const candidate of candidates || []) {
        if (!candidate.content) continue;
        
        const words2 = new Set(normalizeText(candidate.content));
        const intro2 = normalizeText(candidate.content.slice(0, 500));
        
        if (words1.size === 0 || words2.size === 0) continue;
        
        // Calculate word overlap similarity
        let shared = 0;
        for (const word of words1) {
          if (words2.has(word)) shared++;
        }
        const wordSimilarity = shared / Math.max(words1.size, words2.size);
        
        // Calculate intro overlap (stricter check for opening)
        let introShared = 0;
        const introSet1 = new Set(intro1);
        for (const word of intro2) {
          if (introSet1.has(word)) introShared++;
        }
        const introSimilarity = intro2.length > 0 ? introShared / Math.max(intro1.length, intro2.length) : 0;
        
        // Combined similarity (weight intro more heavily as it's often most duplicated)
        const combinedSimilarity = (wordSimilarity * 0.6) + (introSimilarity * 0.4);
        
        if (combinedSimilarity > maxSimilarity) {
          maxSimilarity = combinedSimilarity;
          similarSlug = candidate.slug;
        }
      }
      
      // Stricter threshold: 70% instead of 80%
      return {
        isUnique: maxSimilarity < 0.70,
        similarity: maxSimilarity,
        similarSlug
      };
    }

    // Save content version for rollback
    async function saveContentVersion(pageId: string, contentData: any, source: string, reason: string) {
      // Get current max version
      const { data: versions } = await supabaseAdmin
        .from("seo_content_versions")
        .select("version_number")
        .eq("seo_page_id", pageId)
        .order("version_number", { ascending: false })
        .limit(1);
      
      const nextVersion = (versions?.[0]?.version_number || 0) + 1;
      
      // Mark existing versions as not current
      await supabaseAdmin
        .from("seo_content_versions")
        .update({ is_current: false })
        .eq("seo_page_id", pageId);
      
      // Insert new version
      await supabaseAdmin.from("seo_content_versions").insert({
        seo_page_id: pageId,
        version_number: nextVersion,
        meta_title: contentData.meta_title,
        meta_description: contentData.meta_description,
        h1: contentData.h1,
        content: contentData.content,
        word_count: countWords(contentData.content),
        seo_score: contentData.seo_score,
        faq: contentData.faq,
        internal_links: contentData.internal_links,
        change_source: source,
        change_reason: reason,
        changed_by: userId,
        is_current: true,
      });
    }

    // Handle actions
    switch (action) {
      case "generate_content":
      case "preview_content": {
        if (!page_id) {
          return new Response(JSON.stringify({ error: "page_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get page data
        const { data: page, error: pageError } = await supabaseAdmin
          .from("seo_pages")
          .select("*")
          .eq("id", page_id)
          .single();

        if (pageError || !page) {
          return new Response(JSON.stringify({ error: "Page not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const wordCount = config?.word_count || 700;
        
        // For clinic pages, fetch additional clinic data for better content
        let clinicData = null;
        if (page.page_type === "clinic" || page.page_type === "dentist") {
          // Try to extract clinic ID from slug (e.g., /clinic/clinic-slug)
          const slugParts = page.slug.split("/").filter(Boolean);
          const clinicSlug = slugParts[slugParts.length - 1];
          
          // Fetch clinic data for richer content
          const { data: clinic } = await supabaseAdmin
            .from("clinics")
            .select("id, name, city, state, address, services, description")
            .eq("slug", clinicSlug)
            .single();
          
          if (clinic) {
            clinicData = {
              name: clinic.name,
              city: clinic.city,
              state: clinic.state,
              address: clinic.address,
              services: clinic.services || [],
              description: clinic.description,
            };
          }
        }
        
        const generated = await generateContent(page, wordCount, clinicData);
        
        // Build full content
        const fullContent = buildContentMarkdown(generated);
        const actualWordCount = countWords(fullContent);

        // For preview, just return the generated content
        if (action === "preview_content") {
          return new Response(JSON.stringify({
            ...generated,
            content: fullContent,
            word_count: actualWordCount,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // For generate_content, save it
        if (!config?.save_as_draft) {
          // Save version for rollback
          await saveContentVersion(page_id, {
            meta_title: page.meta_title,
            meta_description: page.meta_description,
            h1: page.h1,
            content: page.content,
            faq: null,
          }, "ai_backup", "Auto-backup before AI generation");

          // Check uniqueness before saving
          const uniquenessResult = await checkContentUniqueness(fullContent, page_id, page.page_type);
          
          // Update the page with uniqueness info
          // STRICT SEPARATION: Content Studio does NOT write to meta_title, meta_description, or faqs
          const contentHash = hashContent(fullContent);
          
          // Build update object - ONLY body content fields
          const updateData: Record<string, any> = {
            // meta_title REMOVED - Meta Optimizer responsibility
            // meta_description REMOVED - Meta Optimizer responsibility
            h1: generated.h1,
            page_intro: generated.intro_paragraph || null,
            h2_sections: generated.h2_sections || null,
            internal_links_intro: generated.internal_links_intro || null,
            content: fullContent,
            word_count: actualWordCount,
            is_thin_content: actualWordCount < 300,
            is_optimized: true,
            optimized_at: now,
            updated_at: now,
            metadata_hash: contentHash,
            is_duplicate: !uniquenessResult.isUnique,
            similarity_score: uniquenessResult.similarity,
            similar_to_slug: uniquenessResult.similarSlug,
            last_generated_at: now,
            last_content_edit_source: 'content_studio',
          };
          
          // Validate we're not writing to blocked fields
          const validation = validateContentStudioWrite(Object.keys(updateData));
          if (!validation.valid) {
            console.error(`Content Studio attempted to write to blocked fields: ${validation.blockedFields.join(', ')}`);
            // Remove blocked fields from update
            for (const blocked of validation.blockedFields) {
              delete updateData[blocked];
            }
          }
          
          const { error: updateError } = await supabaseAdmin
            .from("seo_pages")
            .update(updateData)
            .eq("id", page_id);

          if (updateError) {
            console.error("Update error:", updateError);
            return new Response(JSON.stringify({ error: "Failed to save content" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Save new version - ONLY body content fields (no meta, no faqs)
          await saveContentVersion(page_id, {
            // meta_title REMOVED - Meta Optimizer responsibility
            // meta_description REMOVED - Meta Optimizer responsibility
            h1: generated.h1,
            content: fullContent,
            seo_score: generated.seo_score,
            // faq REMOVED - FAQ Studio responsibility
          }, "content_studio", `Generated ${actualWordCount} words (body content only)`);
        }

        return new Response(JSON.stringify({
          success: true,
          ...generated,
          content: fullContent,
          word_count: actualWordCount,
          is_unique: !page.is_duplicate,
          similarity_score: page.similarity_score || 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "apply_content": {
        if (!page_id || !content) {
          return new Response(JSON.stringify({ error: "page_id and content required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get current page for backup
        const { data: currentPage } = await supabaseAdmin
          .from("seo_pages")
          .select("*")
          .eq("id", page_id)
          .single();

        if (currentPage) {
          await saveContentVersion(page_id, {
            meta_title: currentPage.meta_title,
            meta_description: currentPage.meta_description,
            h1: currentPage.h1,
            content: currentPage.content,
          }, "ai_backup", "Auto-backup before applying preview");
        }

        // Build content if we have sections
        let fullContent = content.content || "";
        if (content.intro_paragraph || content.h2_sections) {
          fullContent = buildContentMarkdown(content);
        }
        const wordCount = countWords(fullContent);

        // Update page
        const { error: updateError } = await supabaseAdmin
          .from("seo_pages")
          .update({
            meta_title: content.meta_title,
            meta_description: content.meta_description,
            h1: content.h1,
            content: fullContent,
            word_count: wordCount,
            is_thin_content: wordCount < 300,
            is_optimized: true,
            optimized_at: now,
            updated_at: now,
          })
          .eq("id", page_id);

        if (updateError) {
          return new Response(JSON.stringify({ error: "Failed to apply content" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save new version
        await saveContentVersion(page_id, {
          meta_title: content.meta_title,
          meta_description: content.meta_description,
          h1: content.h1,
          content: fullContent,
          faq: content.faq,
        }, "ai_applied", "Content applied from preview");

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "manual_edit": {
        if (!page_id || !content) {
          return new Response(JSON.stringify({ error: "page_id and content required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get current page for backup
        const { data: currentPage } = await supabaseAdmin
          .from("seo_pages")
          .select("*")
          .eq("id", page_id)
          .single();

        if (currentPage) {
          await saveContentVersion(page_id, {
            meta_title: currentPage.meta_title,
            meta_description: currentPage.meta_description,
            h1: currentPage.h1,
            content: currentPage.content,
          }, "manual_backup", "Auto-backup before manual edit");
        }

        const wordCount = countWords(content.content || "");

        // Update page
        const { error: updateError } = await supabaseAdmin
          .from("seo_pages")
          .update({
            meta_title: content.meta_title,
            meta_description: content.meta_description,
            h1: content.h1,
            content: content.content,
            word_count: wordCount,
            is_thin_content: wordCount < 300,
            updated_at: now,
          })
          .eq("id", page_id);

        if (updateError) {
          return new Response(JSON.stringify({ error: "Failed to save edits" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save new version
        await saveContentVersion(page_id, {
          meta_title: content.meta_title,
          meta_description: content.meta_description,
          h1: content.h1,
          content: content.content,
        }, "manual_edit", "Manual edit by admin");

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "rollback_version": {
        if (!page_id || !version_id) {
          return new Response(JSON.stringify({ error: "page_id and version_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get the version to restore
        const { data: version, error: versionError } = await supabaseAdmin
          .from("seo_content_versions")
          .select("*")
          .eq("id", version_id)
          .single();

        if (versionError || !version) {
          return new Response(JSON.stringify({ error: "Version not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get current page for backup
        const { data: currentPage } = await supabaseAdmin
          .from("seo_pages")
          .select("*")
          .eq("id", page_id)
          .single();

        if (currentPage) {
          await saveContentVersion(page_id, {
            meta_title: currentPage.meta_title,
            meta_description: currentPage.meta_description,
            h1: currentPage.h1,
            content: currentPage.content,
          }, "rollback_backup", `Backup before rollback to v${version.version_number}`);
        }

        // Update page with version content
        const { error: updateError } = await supabaseAdmin
          .from("seo_pages")
          .update({
            meta_title: version.meta_title,
            meta_description: version.meta_description,
            h1: version.h1,
            content: version.content,
            word_count: version.word_count,
            is_thin_content: (version.word_count || 0) < 300,
            updated_at: now,
          })
          .eq("id", page_id);

        if (updateError) {
          return new Response(JSON.stringify({ error: "Failed to rollback" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Mark all versions as not current
        await supabaseAdmin
          .from("seo_content_versions")
          .update({ is_current: false })
          .eq("seo_page_id", page_id);

        // Mark restored version as current
        await supabaseAdmin
          .from("seo_content_versions")
          .update({ is_current: true })
          .eq("id", version_id);

        return new Response(JSON.stringify({ success: true, restored_version: version.version_number }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

  } catch (error) {
    console.error("content-generation-studio error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
