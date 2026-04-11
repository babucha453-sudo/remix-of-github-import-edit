import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// PHASE 2 CONTENT GENERATOR - Sprint-Based Long-Form Templates
// ============================================================
// Sprint 2.1: Service Pages (3,500-5,000 words)
// Sprint 2.2: City Pages (2,500-3,500 words)
// Sprint 2.3: Blog Posts (1,500-2,800 words)

interface Phase2Request {
  action: "generate" | "preview";
  page_id: string;
  sprint: "2.1" | "2.2" | "2.3";
  template: "service" | "city" | "blog";
  target_word_count: number;
  max_word_count: number;
  blog_category?: string; // For Sprint 2.3
}

interface Phase2Request {
  action: "generate" | "preview";
  page_id: string;
  sprint: "2.1" | "2.2" | "2.3";
  template: "service" | "city" | "blog";
  target_word_count: number;
  max_word_count: number;
  blog_category?: string; // For Sprint 2.3
}

// ========================================
// UNIQUENESS ENGINE - Randomized Content
// ========================================

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

const SECTION_ORDER_VARIATIONS = [
  ["intro", "about", "when", "procedure", "cost", "insurance", "recovery", "benefits", "comparison", "choose", "faq", "cta"],
  ["intro", "when", "about", "procedure", "recovery", "benefits", "cost", "insurance", "comparison", "choose", "faq", "cta"],
  ["intro", "procedure", "about", "when", "benefits", "recovery", "cost", "comparison", "insurance", "choose", "faq", "cta"],
  ["intro", "benefits", "about", "procedure", "when", "comparison", "recovery", "cost", "choose", "insurance", "faq", "cta"],
  ["intro", "cost", "about", "insurance", "procedure", "when", "recovery", "benefits", "comparison", "faq", "choose", "cta"],
  ["intro", "comparison", "about", "procedure", "when", "benefits", "cost", "insurance", "recovery", "choose", "faq", "cta"],
  ["intro", "when", "benefits", "about", "cost", "procedure", "insurance", "comparison", "recovery", "faq", "choose", "cta"],
  ["intro", "insurance", "about", "when", "procedure", "cost", "benefits", "recovery", "comparison", "choose", "faq", "cta"],
];

const OPENING_STYLES = [
  "Open with a compelling statistic about dental health trends.",
  "Start with a relatable patient scenario that captures daily life challenges.",
  "Begin with a thought-provoking question about dental care decisions.",
  "Open with a statement about what modern dental technology enables.",
  "Start with an empathy-driven introduction acknowledging patient concerns.",
  "Begin with a brief history or evolution of this treatment option.",
  "Open with a comparison hook: 'While many think X, the reality is Y.'",
  "Start with a patient outcome statement that sets expectations.",
  "Begin with an industry fact that puts the service in context.",
  "Open with a direct address to readers searching for this service.",
];

const CLOSING_STYLES = [
  "End with an encouraging call-to-action about taking the first step.",
  "Close with a summary of key benefits and a soft CTA.",
  "End with reassurance about modern dental care options.",
  "Close with a prompt to compare dentists on AppointPanda.",
  "End with patient empowerment messaging about dental health.",
  "Close with trust signals about AppointPanda's verification process.",
  "End with practical next steps for readers.",
  "Close with a warm invitation to book a consultation.",
];

// Service page section definitions
const SERVICE_SECTIONS = {
  intro: {
    title: "Introduction to [Service]",
    words: 200,
    description: "Overview of service, why patients need it, what to expect, engaging hook"
  },
  about: {
    title: "What is [Service]?",
    words: 400,
    description: "Medical explanation, types/variations, materials, technology involved"
  },
  when: {
    title: "When Do You Need [Service]?",
    words: 300,
    description: "Symptoms, conditions, warning signs, preventive vs restorative context"
  },
  procedure: {
    title: "The [Service] Procedure: Step-by-Step",
    words: 500,
    description: "Consultation, preparation, during procedure, recovery timeline, technology, duration"
  },
  cost: {
    title: "Cost of [Service] in [2026]",
    words: 600,
    description: "National averages, state/city cost table, factors affecting cost, payment options"
  },
  insurance: {
    title: "Does Insurance Cover [Service]?",
    words: 400,
    description: "Coverage overview, percentages, pre-auth, FSA/HSA, verify coverage CTA"
  },
  recovery: {
    title: "Recovery & Aftercare",
    words: 400,
    description: "Post-procedure expectations, timeline, care instructions, complications"
  },
  benefits: {
    title: "Benefits of [Service]",
    words: 300,
    description: "Functional, aesthetic, long-term health, psychological benefits"
  },
  comparison: {
    title: "[Service] vs [Alternative]",
    words: 400,
    description: "Detailed comparison, pros/cons, which is right for different profiles"
  },
  choose: {
    title: "How to Choose a Dentist for [Service]",
    words: 350,
    description: "Qualifications, questions to ask, red flags, first visit expectations"
  },
  faq: {
    title: "Frequently Asked Questions",
    words: 500,
    description: "10-15 common questions with detailed answers, FAQ schema format"
  },
  cta: {
    title: "Find Top [Service] Dentists Near You",
    words: 200,
    description: "Directory CTA, featured links, trust signals"
  },
};

// City page section definitions
const CITY_SECTIONS = {
  intro: {
    title: "Introduction to [City] Dentists",
    words: 200,
    description: "Overview of dental care, number of clinics, unique characteristics"
  },
  topRated: {
    title: "Top-Rated Dentists in [City]",
    words: 300,
    description: "Preview of options, practice types, ratings explanation, CTA"
  },
  services: {
    title: "Dental Services in [City]",
    words: 400,
    description: "Major services, popular procedures, specialties, pediatric, links"
  },
  costs: {
    title: "Average Dental Costs in [City]",
    words: 500,
    description: "Cost comparison table (15 procedures), city vs state vs national"
  },
  insurance: {
    title: "Dental Insurance in [City]",
    words: 300,
    description: "Accepted insurers, Medicaid/Medicare, finding dentists by insurance"
  },
  neighborhoods: {
    title: "Dentists by Neighborhood",
    words: 400,
    description: "6-10 neighborhoods, clinics per area, character of each area"
  },
  emergency: {
    title: "Emergency Dental Care in [City]",
    words: 300,
    description: "After-hours options, emergency clinics, what constitutes emergency"
  },
  faq: {
    title: "Frequently Asked Questions",
    words: 400,
    description: "Common questions about dental care in this city"
  },
  cta: {
    title: "Find Your Dentist in [City]",
    words: 200,
    description: "Final CTA, trust signals, next steps"
  },
};

// ========================================
// DYNAMIC TEMPLATE GENERATOR
// ========================================
function generateServiceTemplate(serviceName: string, seed: number): string {
  const orderedSections = selectWithSeed(SECTION_ORDER_VARIATIONS, seed);
  const openingStyle = selectWithSeed(OPENING_STYLES, seed + 1);
  const closingStyle = selectWithSeed(CLOSING_STYLES, seed + 2);
  
  const sectionList = orderedSections.map((key, idx) => {
    const section = SERVICE_SECTIONS[key as keyof typeof SERVICE_SECTIONS];
    return `${idx + 1}. H2: ${section.title.replace("[Service]", serviceName)} (${section.words} words)
   - ${section.description}`;
  }).join("\n\n");

  return `You are generating a COMPREHENSIVE service page for AppointPanda dental directory.

=== UNIQUE CONTENT STRUCTURE ===
UNIQUE SEED: ${seed}
OPENING STYLE: ${openingStyle}
CLOSING STYLE: ${closingStyle}

Write these sections in this RANDOMIZED order (do not use standard order):
${sectionList}

=== CONTENT REQUIREMENTS ===
- Write in AppointPanda's first-party voice
- No medical claims or diagnoses
- Include realistic cost ranges with placeholders for actual data
- Include comparison with common alternative treatment
- Include multiple CTAs throughout
- Mobile-friendly formatting
- Natural keyword usage (no stuffing)
- E-E-A-T compliant
- Vary your writing style - mix sentence lengths, use natural transitions
- DO NOT use these AI-phrases: "In today's world", "When it comes to", "It's important to note"
`;
}

function generateCityTemplate(cityName: string, stateAbbr: string, seed: number): string {
  const openingStyle = selectWithSeed(OPENING_STYLES, seed + 1);
  const closingStyle = selectWithSeed(CLOSING_STYLES, seed + 2);
  
  const sectionKeys = Object.keys(CITY_SECTIONS);
  const orderedSections = shuffleWithSeed(sectionKeys, seed);
  
  const sectionList = orderedSections.map((key, idx) => {
    const section = CITY_SECTIONS[key as keyof typeof CITY_SECTIONS];
    return `${idx + 1}. H2: ${section.title.replace("[City]", cityName)} (${section.words} words)
   - ${section.description}`;
  }).join("\n\n");

  return `You are generating a COMPREHENSIVE city directory page for AppointPanda.

=== UNIQUE CONTENT STRUCTURE ===
UNIQUE SEED: ${seed}
OPENING STYLE: ${openingStyle}
CLOSING STYLE: ${closingStyle}
LOCATION: ${cityName}, ${stateAbbr}

Write these sections in this RANDOMIZED order (do not use standard order):
${sectionList}

=== CONTENT REQUIREMENTS ===
- Include LOCAL context specific to ${cityName}
- Include cost comparison table for 15 common procedures
- Include 6-10 real neighborhoods/areas in ${cityName}
- Write in AppointPanda's first-party voice
- Mobile-friendly formatting
- Natural keyword usage
- E-E-A-T compliant
- Vary your writing style - mix sentence lengths, use natural transitions
- DO NOT use these AI-phrases: "In today's world", "When it comes to", "It's important to note"
`;
}

// ========================================
// SERVICE PAGE TEMPLATE (Sprint 2.1)
// 14 sections, 3,500-5,000 words
// ========================================
const SERVICE_PAGE_TEMPLATE = `You are generating a COMPREHENSIVE service page for AppointPanda dental directory.

=== TEMPLATE STRUCTURE (3,500-5,000 words) ===

1. H1: "[Service Name]: Complete Guide, Costs & Best Dentists [2026]"

2. INTRODUCTION (200 words)
   - What is this service
   - Why patients need it
   - What to expect overview
   - Hook the reader immediately

3. H2: What is [Service Name]? (400 words)
   - Detailed medical explanation
   - Types/variations of the procedure
   - Materials used (titanium, ceramic, composite, etc.)
   - Technology involved (CAD/CAM, 3D imaging, etc.)

4. H2: When Do You Need [Service]? (300 words)
   - Symptoms that indicate need
   - Medical conditions requiring treatment
   - Warning signs to watch for
   - Preventive vs. restorative context

5. H2: The [Service] Procedure: Step-by-Step (500 words)
   - Initial consultation and assessment
   - Preparation phase
   - During the procedure (detailed)
   - Recovery timeline expectations
   - Technology and equipment used
   - Duration and number of visits

6. H2: Cost of [Service] in [2026] (600 words)
   - National average cost range
   - COST TABLE BY STATE (use markdown table):
     | State | Average Cost | Range |
     |-------|--------------|-------|
     | California | $X,XXX | $X,XXX-$X,XXX |
     | Massachusetts | $X,XXX | $X,XXX-$X,XXX |
     | Connecticut | $X,XXX | $X,XXX-$X,XXX |
     | New Jersey | $X,XXX | $X,XXX-$X,XXX |
   - COST TABLE BY TOP CITIES (10 cities)
   - Factors affecting cost (complexity, materials, location, dentist experience)
   - Payment options and financing

7. H2: Does Insurance Cover [Service]? (400 words)
   - General coverage overview
   - What major insurers typically cover (percentage breakdown)
   - Pre-authorization requirements
   - What's usually included/excluded
   - How to verify your coverage
   - FSA/HSA applicability
   - CTA: "Check dentists accepting your insurance on AppointPanda"

8. H2: Recovery & Aftercare (400 words)
   - Immediate post-procedure expectations
   - Day-by-day recovery timeline
   - Care instructions (dos and don'ts)
   - When to call your dentist
   - Potential complications and warning signs
   - Long-term maintenance

9. H2: Benefits of [Service] (300 words)
   - Functional benefits (chewing, speaking, etc.)
   - Aesthetic benefits
   - Long-term oral health benefits
   - Psychological/confidence benefits
   - Longevity and durability

10. H2: [Service] vs [Alternative] (400 words)
    - Detailed comparison with main alternative
    - COMPARISON TABLE:
      | Factor | [Service] | [Alternative] |
      |--------|-----------|---------------|
      | Cost | | |
      | Duration | | |
      | Longevity | | |
      | Invasiveness | | |
    - Pros and cons of each
    - Which is right for different patient profiles

11. H2: How to Choose a Dentist for [Service] (350 words)
    - Qualifications and certifications to look for
    - Questions to ask during consultation
    - Red flags to avoid
    - What to expect in your first visit
    - Importance of before/after photos and reviews

12. H2: Find Top [Service] Dentists Near You (200 words)
    - CTA to search AppointPanda directory
    - Featured cities links
    - "Book your consultation today"
    - Trust signals (verified dentists, reviews)

13. H2: Frequently Asked Questions (500 words)
    - 10-15 common questions with detailed answers
    - Include cost, pain, duration, alternatives questions
    - Format for FAQ schema markup

14. H2: Patient Success Stories (200 words)
    - General patient satisfaction insights
    - What patients typically report
    - Link to verified reviews

=== CONTENT REQUIREMENTS ===
- Write in AppointPanda's first-party voice
- No medical claims or diagnoses
- Cite approximate costs with ranges
- Include multiple CTAs throughout
- Mobile-friendly formatting
- Natural keyword usage (no stuffing)
- E-E-A-T compliant`;

// ========================================
// CITY PAGE TEMPLATE (Sprint 2.2)
// 11 sections, 2,500-3,500 words
// ========================================
const CITY_PAGE_TEMPLATE = `You are generating a COMPREHENSIVE city directory page for AppointPanda.

=== TEMPLATE STRUCTURE (2,500-3,500 words) ===

1. H1: "Best Dentists in [City], [State] | [#] Verified Clinics [2026]"

2. INTRODUCTION (200 words)
   - Overview of dental care in this city
   - Number of clinics/dentists available
   - What makes this city's dental scene unique
   - Local context (neighborhoods, demographics)

3. H2: Top-Rated Dentists in [City] (300 words)
   - Preview of what patients can find
   - Types of practices available
   - How ratings work on AppointPanda
   - CTA: "View all dentists in [City]"

4. H2: Dental Services Available in [City] (400 words)
   - List of all major services offered
   - Most popular procedures in this city
   - Specialty services (orthodontics, oral surgery, etc.)
   - Pediatric and family dentistry
   - Links to service-specific pages

5. H2: Average Dental Costs in [City] (500 words)
   - COST COMPARISON TABLE (15 procedures):
     | Procedure | [City] Avg | [State] Avg | National Avg |
     |-----------|------------|-------------|--------------|
     | Cleaning | $XX | $XX | $XX |
     | Filling | $XXX | $XXX | $XXX |
     | Crown | $X,XXX | $X,XXX | $X,XXX |
     | Root Canal | $X,XXX | $X,XXX | $X,XXX |
     | Implant | $X,XXX | $X,XXX | $X,XXX |
     | Invisalign | $X,XXX | $X,XXX | $X,XXX |
     | Extraction | $XXX | $XXX | $XXX |
     | Deep Cleaning | $XXX | $XXX | $XXX |
     | Veneer (per tooth) | $X,XXX | $X,XXX | $X,XXX |
     | Dentures | $X,XXX | $X,XXX | $X,XXX |
   - Why costs vary in [City]
   - Tips for affordable dental care

6. H2: Dental Insurance Accepted in [City] (300 words)
   - Most commonly accepted insurance providers
   - Percentage of dentists accepting major insurers
   - Medicaid/Medicare acceptance
   - How to find dentists with your insurance on AppointPanda

7. H2: Dentists by Neighborhood (400 words)
   - List 6-10 major neighborhoods
   - Number of clinics per area
   - Character of each neighborhood's dental options
   - Links to neighborhood-specific searches
   
   Example neighborhoods to cover:
   - Downtown [City]
   - [Major Neighborhood 1]
   - [Major Neighborhood 2]
   - [Suburb/Area]

8. H2: Emergency Dental Care in [City] (300 words)
   - 24/7 emergency dentist availability
   - Weekend and evening availability
   - Walk-in clinics
   - What constitutes a dental emergency
   - Average emergency visit costs
   - CTA: "Find emergency dentists in [City]"

9. H2: Finding a Dentist in [City]: What to Know (350 words)
   - State licensing requirements
   - How to verify credentials
   - Patient rights in [State]
   - What to expect at first visit
   - Choosing between private practice vs. group practice

10. H2: [City] Dental Care Statistics (250 words)
    - Number of practicing dentists
    - Dentist to population ratio
    - Most common dental issues in area
    - Community dental health programs
    - Dental schools or teaching clinics nearby

11. H2: Frequently Asked Questions (400 words)
    - 8-10 city-specific FAQs
    - Questions about insurance, costs, availability
    - Format for FAQ schema markup

=== LOCAL CONTEXT REQUIREMENTS ===
- Mention specific neighborhoods by name
- Reference local landmarks or areas
- Include regional cost context
- Note any unique local factors (university towns, tech hubs, etc.)`;

// ========================================
// BLOG POST TEMPLATES (Sprint 2.3)
// 4 categories, 1,500-2,800 words each
// ========================================
const BLOG_TEMPLATES = {
  'cost-guides': `You are writing a COST GUIDE blog post for AppointPanda.

=== TEMPLATE: "How Much Does [Procedure] Cost in [State]? [2026 Price Guide]" ===
Target: 1,800-2,200 words

H1: How Much Does [Procedure] Cost in [State]? [2026 Price Guide]

1. INTRODUCTION (150 words)
   - Direct answer to the cost question
   - Range overview
   - What affects pricing

2. H2: Average Cost of [Procedure] in [State] (300 words)
   - State average with range
   - How it compares to national average
   - Year-over-year changes

3. H2: Cost by City (400 words)
   - TABLE: Top 10 cities in state with costs
   - Why costs vary by city
   - Urban vs. suburban differences

4. H2: Factors That Affect Cost (350 words)
   - Complexity of case
   - Dentist experience
   - Materials used
   - Geographic location
   - Facility type

5. H2: Does Insurance Cover [Procedure]? (300 words)
   - Typical coverage percentages
   - In-network vs. out-of-network
   - Pre-authorization needs

6. H2: How to Save Money on [Procedure] (350 words)
   - Dental schools
   - Payment plans
   - Dental savings plans
   - Shop around tips

7. H2: Find Affordable [Procedure] Dentists (200 words)
   - CTA to AppointPanda
   - How to filter by price
   - Request quotes

8. H2: FAQs (200 words)
   - 5-6 cost-specific questions`,

  'comparisons': `You are writing a COMPARISON blog post for AppointPanda.

=== TEMPLATE: "[Option A] vs [Option B]: Complete Comparison Guide [2026]" ===
Target: 2,000-2,500 words

H1: [A] vs [B]: Complete Comparison Guide [2026]

1. INTRODUCTION (200 words)
   - Why this comparison matters
   - Quick verdict overview
   - Who should read this

2. H2: What is [Option A]? (300 words)
   - Detailed explanation
   - How it works
   - Ideal candidates

3. H2: What is [Option B]? (300 words)
   - Detailed explanation
   - How it works
   - Ideal candidates

4. H2: Side-by-Side Comparison (400 words)
   - COMPARISON TABLE:
     | Factor | [A] | [B] |
     |--------|-----|-----|
     | Cost | | |
     | Treatment Time | | |
     | Longevity | | |
     | Maintenance | | |
     | Comfort | | |
     | Aesthetics | | |
   - Detailed discussion of each factor

5. H2: Cost Comparison (300 words)
   - [A] cost range
   - [B] cost range
   - Long-term cost considerations
   - Insurance coverage differences

6. H2: Pros and Cons of [A] (200 words)
   - 4-5 pros
   - 3-4 cons

7. H2: Pros and Cons of [B] (200 words)
   - 4-5 pros
   - 3-4 cons

8. H2: Which Option is Right for You? (300 words)
   - Patient profile for [A]
   - Patient profile for [B]
   - Questions to ask your dentist

9. H2: Find Dentists Offering Both Options (150 words)
   - CTA to AppointPanda

10. H2: FAQs (150 words)
    - 5 comparison questions`,

  'how-to': `You are writing a HOW-TO GUIDE blog post for AppointPanda.

=== TEMPLATE: "How to [Action]: Complete Guide [2026]" ===
Target: 1,500-2,000 words

H1: How to [Action]: Complete Guide [2026]

1. INTRODUCTION (150 words)
   - Why this matters
   - What you'll learn
   - Quick overview of steps

2. H2: Why [Action] Matters (200 words)
   - Importance
   - Consequences of not doing it
   - Benefits

3. H2: Step 1: [First Step] (200 words)
   - Detailed instructions
   - Tips and tricks
   - Common mistakes

4. H2: Step 2: [Second Step] (200 words)
   - Detailed instructions
   - What to look for
   - Red flags

5. H2: Step 3: [Third Step] (200 words)
   - Continue pattern...

6. H2: Step 4-5: [Continue as needed]

7. H2: Common Mistakes to Avoid (250 words)
   - 5-6 mistakes
   - How to avoid each

8. H2: Tips from Dental Professionals (200 words)
   - Expert advice
   - Industry best practices

9. H2: Take Action Today (150 words)
   - CTA to AppointPanda
   - Next steps

10. H2: FAQs (150 words)
    - 5 how-to questions`,

  'local-content': `You are writing a LOCAL/LISTICLE blog post for AppointPanda.

=== TEMPLATE: "Best [Type] Dentists in [City]: Top [#] Clinics [2026]" ===
Target: 2,200-2,800 words

H1: Best [Type] Dentists in [City]: Top [#] Clinics [2026]

1. INTRODUCTION (200 words)
   - Why [City] for [type] dentistry
   - What makes a great [type] dentist
   - How we compiled this list

2. H2: How We Chose the Best (200 words)
   - Methodology
   - Criteria used
   - Data sources

3. H2: 1. [Generic Practice Description] - [Neighborhood] (250 words)
   - What makes them notable
   - Services offered
   - Patient experience highlights
   - Location advantages
   - CTA: Book on AppointPanda

4. H2: 2-7. [Repeat for each featured entry]
   - 200-250 words each
   - Unique angle for each

5. H2: What to Look for in a [Type] Dentist (300 words)
   - Qualifications
   - Experience markers
   - Red flags

6. H2: Average Costs in [City] (250 words)
   - Cost table
   - How [City] compares

7. H2: Insurance & Payment (200 words)
   - Common insurances accepted
   - Payment options

8. H2: FAQs (200 words)
   - 5-6 local questions`
};

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Phase2Request = await req.json();
    const { action, page_id, sprint, template, target_word_count, max_word_count, blog_category } = body;

    if (!page_id || !sprint || !template) {
      return new Response(JSON.stringify({ error: "page_id, sprint, and template required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AI call helper with retries
    async function callAI(messages: any[], maxRetries = 4): Promise<any> {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          console.log(`phase2-content-generator: Retry ${attempt + 1}/${maxRetries}`);
        }
        
        try {
          const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${AIMLAPI_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gemini-2.0-flash",
              messages,
              max_tokens: 16000, // Allow longer responses for Phase 2
            }),
          });

          if (!response.ok) {
            if (response.status >= 500 || response.status === 429) {
              lastError = new Error(`AI gateway returned ${response.status}`);
              continue;
            }
            throw new Error(`AI error: ${response.status}`);
          }

          const json = await response.json();
          return json.choices?.[0]?.message?.content || "";
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
        }
      }
      
      throw lastError || new Error("AI call failed");
    }

    // Get page data
    let pageData: any;
    let tableName: string;

    if (template === "blog") {
      tableName = "blog_posts";
      const { data, error } = await supabaseAdmin
        .from("blog_posts")
        .select("*")
        .eq("id", page_id)
        .single();
      if (error) throw new Error(`Blog post not found: ${error.message}`);
      pageData = data;
    } else {
      tableName = "seo_pages";
      const { data, error } = await supabaseAdmin
        .from("seo_pages")
        .select("*")
        .eq("id", page_id)
        .single();
      if (error) throw new Error(`SEO page not found: ${error.message}`);
      pageData = data;
    }

    // Build the generation prompt based on template
    let systemPrompt: string;
    let userPrompt: string;

    const timestamp = Date.now();
    const seed = timestamp + (pageData.id ? pageData.id.charCodeAt(0) : 0);

    if (template === "service") {
      // Sprint 2.1: Service pages - USE DYNAMIC TEMPLATE
      const serviceName = pageData.title || pageData.slug?.split("/").pop()?.replace(/-/g, " ") || "Dental Service";
      
      systemPrompt = generateServiceTemplate(serviceName, seed);
      userPrompt = `Generate a COMPLETE service page for: ${serviceName}

PAGE URL: /${pageData.slug}
TARGET WORD COUNT: ${target_word_count}-${max_word_count} words
UNIQUE SEED: ${seed}

Include realistic cost data for CA, MA, CT, NJ.
Include comparison with the most common alternative treatment.
Include cost tables with realistic ranges (not placeholders).

Write in AppointPanda's voice. Return pure markdown content.`;

    } else if (template === "city") {
      // Sprint 2.2: City pages - USE DYNAMIC TEMPLATE
      const parts = (pageData.slug || "").split("/").filter(Boolean);
      const cityName = pageData.title || parts[1]?.replace(/-/g, " ") || "City";
      const stateAbbr = parts[0]?.toUpperCase() || "";

      systemPrompt = generateCityTemplate(cityName, stateAbbr, seed);
      userPrompt = `Generate a COMPLETE city directory page for: ${cityName}, ${stateAbbr}

PAGE URL: /${pageData.slug}
TARGET WORD COUNT: ${target_word_count}-${max_word_count} words
UNIQUE SEED: ${seed}

Include realistic cost comparison table (15 procedures).
Include 6-10 real neighborhoods/areas in ${cityName}.
Add local context about ${cityName}'s dental care landscape.
Include cost tables with realistic ranges (not placeholders).

Write in AppointPanda's voice. Return pure markdown content.`;

    } else if (template === "blog") {
      // Sprint 2.3: Blog posts
      const category = blog_category || "cost-guides";
      const blogTemplate = BLOG_TEMPLATES[category as keyof typeof BLOG_TEMPLATES] || BLOG_TEMPLATES["cost-guides"];
      
      systemPrompt = blogTemplate;
      userPrompt = `Generate a COMPLETE blog post.

TITLE: ${pageData.title}
SLUG: ${pageData.slug}
CATEGORY: ${category}
TARGET WORD COUNT: ${target_word_count}-${max_word_count} words
UNIQUE SEED: ${seed}

Generate the FULL content following the template structure.
Include relevant data tables where specified.
Write in AppointPanda's voice - helpful, trustworthy, patient-focused.

Return pure markdown content.`;
    } else {
      throw new Error(`Unknown template: ${template}`);
    }

    console.log(`phase2-content-generator: Generating ${template} content for ${pageData.slug}`);

    // Generate content
    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    if (!content) {
      throw new Error("AI returned empty content");
    }

    // Count words
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const sectionsCount = (content.match(/^## /gm) || []).length;

    console.log(`phase2-content-generator: Generated ${wordCount} words, ${sectionsCount} sections`);

    // Extract H1 from content
    const h1Match = content.match(/^# (.+)$/m);
    const h1 = h1Match ? h1Match[1].trim() : null;

    // Save content
    const now = new Date().toISOString();

    if (template === "blog") {
      // Update blog post
      const { error: updateError } = await supabaseAdmin
        .from("blog_posts")
        .update({
          content: { type: "markdown", body: content },
          updated_at: now,
        })
        .eq("id", page_id);

      if (updateError) throw updateError;
    } else {
      // Update SEO page
      const updateData: any = {
        content,
        word_count: wordCount,
        is_thin_content: wordCount < target_word_count,
        is_optimized: wordCount >= target_word_count,
        optimized_at: wordCount >= target_word_count ? now : null,
        last_generated_at: now,
        last_content_edit_source: `phase2_sprint_${sprint}`,
        updated_at: now,
      };

      if (h1) {
        updateData.h1 = h1;
      }

      const { error: updateError } = await supabaseAdmin
        .from("seo_pages")
        .update(updateData)
        .eq("id", page_id);

      if (updateError) throw updateError;

      // Save version for rollback
      const { data: versions } = await supabaseAdmin
        .from("seo_content_versions")
        .select("version_number")
        .eq("seo_page_id", page_id)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = (versions?.[0]?.version_number || 0) + 1;

      await supabaseAdmin
        .from("seo_content_versions")
        .update({ is_current: false })
        .eq("seo_page_id", page_id);

      await supabaseAdmin.from("seo_content_versions").insert({
        seo_page_id: page_id,
        version_number: nextVersion,
        h1: h1 || pageData.h1,
        content,
        word_count: wordCount,
        change_source: `phase2_sprint_${sprint}`,
        change_reason: `Phase 2 ${template} template generation`,
        changed_by: userId,
        is_current: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        word_count: wordCount,
        sections_count: sectionsCount,
        h1,
        sprint,
        template,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("phase2-content-generator error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
