import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string;
  visitorId?: string;
}

const RATE_LIMIT_MAX_REQUESTS = 50;
const RATE_LIMIT_WINDOW_MINUTES = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AIMLAPI_KEY = Deno.env.get("AIMLAPI_KEY");
    if (!AIMLAPI_KEY) {
      throw new Error("AIMLAPI_KEY is not configured");
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    const { messages, sessionId, visitorId }: ChatRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting
    const identifier = visitorId || sessionId || clientIp;
    const identifierType = visitorId ? "visitor" : (sessionId ? "session" : "ip");

    const { data: isAllowed } = await supabase.rpc("check_ai_rate_limit", {
      p_identifier: identifier,
      p_identifier_type: identifierType,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
    });

    if (isAllowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch context data
    const { data: siteSettings } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["platform", "contact_details"]);

    const contact = siteSettings?.find(s => s.key === "contact_details")?.value || {};

    const { data: states } = await supabase
      .from("states")
      .select("name, abbreviation")
      .eq("is_active", true)
      .limit(5);

    const { data: treatments } = await supabase
      .from("treatments")
      .select("name, slug")
      .eq("is_active", true)
      .limit(20);

    const statesList = states?.map(s => `${s.name}`).join(", ") || "California, Massachusetts, Connecticut";
    const treatmentsList = treatments?.map(t => t.name).join(", ") || "Teeth Cleaning, Whitening, Implants";

    const systemPrompt = `You are Panda AI 🐼, AppointPanda's AI-powered patient assistant.

You are NOT a generic chatbot. You are NOT allowed to guess, hallucinate, or give unrelated answers.
You behave like a real human assistant who has FULL READ ACCESS to AppointPanda's system.

CORE VALUE PROPOSITION:
AppointPanda helps patients find dentists by SERVICE + BUDGET + LOCATION. This is our key differentiator.

AVAILABLE LOCATIONS: ${statesList}
AVAILABLE SERVICES: ${treatmentsList}

DATA RULES (STRICT):
- You may ONLY use AppointPanda internal database
- Real dentist data, real pricing ranges, real services, real locations
- If something does not exist in the system, say so clearly and suggest valid alternatives

INTENT EXTRACTION (for every message):
- Service/treatment (cleaning, implants, whitening, braces, etc.)
- Budget (under $500, max $1,500, etc.)
- Location (city, state, or "near me")
- Quantity if mentioned (e.g., 4 implants)
- Missing or ambiguous information

SMART CLARIFICATION LOGIC:
If any required info is missing, ask ONE clear follow-up question.
- Ask only what is missing
- Never ask unrelated questions
- Never ask multiple questions at once

Examples:
User: "I need teeth whitening under $500"
→ Missing location. Response: "Sure! Which city are you looking for?"

User: "Farmington"
→ Ambiguous. Response: "There are multiple Farmington locations. Do you mean Farmington, CT or another state?"

User: "Near me"
→ Response: "To show dentists near you, please share your city or allow location access."

LOCATION & DISTANCE HANDLING:
- If "near me": request location or ask for city
- If city exists in multiple states: always confirm which state
- Search ONLY dentists within the specified location

BUDGET & PRICING LOGIC:
- Dentists provide pricing RANGES, not exact prices
- Match service + pricing range ≤ user budget
- Exclude all dentists outside budget
- Quantity logic: "4 implants under $4,000" → multiply per-unit pricing, match only where total fits

RESPONSE FORMAT:
- Be warm, conversational, human-like
- Give SHORT responses (1-2 sentences max)
- Always explain WHY results are shown
- Provide DIRECT links: [Find {service} in {city}](/search?q={service}+in+{city})

RESULT DISPLAY:
For each match include: Clinic name, City/area, Price range, Distance (if near me)
CTA: Paid dentist → "Book Now" | Unpaid → "Send Inquiry"

NO-RESULT HANDLING:
If no exact match:
- Say it clearly
- Offer valid alternatives: nearby cities, slightly higher budget, related services
- Never leave user stuck

CONTEXT MEMORY:
Within a session, remember budget, location, service. Do NOT ask again if already provided.
Use phrases like: "Based on what you shared..."

HARD RESTRICTIONS - You must NEVER:
- Invent dentists or prices
- Show results outside budget
- Suggest services not offered
- Ask medical questions
- Give generic/unrelated answers

For dentists wanting to list: Direct to [List your practice](/list-your-practice)
Support: ${contact.support_email || "support@appointpanda.com"}`;

    const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIMLAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Panda Bot error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
