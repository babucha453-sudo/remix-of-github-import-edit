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
  clinicId?: string;
  sessionId?: string;
  visitorId?: string;
}

// Rate limit configuration
const RATE_LIMIT_MAX_REQUESTS = 30; // requests per window
const RATE_LIMIT_WINDOW_MINUTES = 60; // 1 hour window
const MAX_MESSAGES_PER_SESSION = 50; // max messages per session

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use AIMLAPI for Gemini API access
    const AIMLAPI_KEY = Deno.env.get("AIMLAPI_KEY");
    if (!AIMLAPI_KEY) {
      throw new Error("AIMLAPI_KEY is not configured");
    }

    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    const { messages, clinicId, sessionId, visitorId }: ChatRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Apply rate limiting
    const identifier = visitorId || sessionId || clientIp;
    const identifierType = visitorId ? "visitor" : (sessionId ? "session" : "ip");

    // Check rate limit using database function
    const { data: isAllowed, error: rateLimitError } = await supabase.rpc("check_ai_rate_limit", {
      p_identifier: identifier,
      p_identifier_type: identifierType,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      // Continue if rate limit check fails - fail open for better UX
    } else if (isAllowed === false) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: RATE_LIMIT_WINDOW_MINUTES * 60
        }),
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60)
          },
        }
      );
    }

    // Check session message limit
    if (sessionId && messages.length > MAX_MESSAGES_PER_SESSION) {
      return new Response(
        JSON.stringify({ 
          error: "Session message limit reached. Please start a new conversation.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required and cannot be empty" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate message content length (prevent abuse)
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    if (lastUserMessage && lastUserMessage.content.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message too long. Please keep messages under 2000 characters." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch clinic info for context if provided
    let clinicContext = "";
    if (clinicId) {
      // Validate clinicId format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clinicId)) {
        return new Response(
          JSON.stringify({ error: "Invalid clinic ID format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: clinic } = await supabase
        .from("clinics")
        .select(`
          name, address, phone, email, description,
          city:cities(name),
          clinic_hours(day_of_week, open_time, close_time, is_closed),
          clinic_treatments(treatment:treatments(name)),
          clinic_insurances(insurance:insurances(name))
        `)
        .eq("id", clinicId)
        .single();

      if (clinic) {
        const hours = clinic.clinic_hours?.map((h: any) => {
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          return h.is_closed ? `${days[h.day_of_week]}: Closed` : `${days[h.day_of_week]}: ${h.open_time} - ${h.close_time}`;
        }).join(", ") || "Contact for hours";

        const treatments = clinic.clinic_treatments?.map((t: any) => t.treatment?.name).filter(Boolean).join(", ") || "General dentistry";
        const insurances = clinic.clinic_insurances?.map((i: any) => i.insurance?.name).filter(Boolean).join(", ") || "Contact for insurance info";
        
        const cityName = Array.isArray(clinic.city) ? clinic.city[0]?.name : (clinic.city as any)?.name;

        clinicContext = `
You are the AI assistant for ${clinic.name}, a dental practice.
Location: ${clinic.address || "Contact for address"}, ${cityName || ""}
Phone: ${clinic.phone || "Available on website"}
Email: ${clinic.email || "Available on website"}
Hours: ${hours}
Services: ${treatments}
Insurance Accepted: ${insurances}
About: ${clinic.description || "Quality dental care for the whole family"}
`;
      }
    }

    const systemPrompt = `${clinicContext || "You are a helpful dental practice assistant."}

Your role is to:
1. Answer questions about the dental practice, services, hours, and insurance
2. Help patients schedule appointments (collect name, phone, email, preferred date/time, reason for visit)
3. Provide general dental health information
4. Be friendly, professional, and HIPAA-conscious (never ask for or discuss specific medical conditions in detail)

When a patient wants to book an appointment:
1. Ask for their name and contact information
2. Ask for their preferred date and time
3. Ask what type of appointment they need
4. Confirm the details and let them know someone will confirm

Keep responses concise and helpful. If you don't know something specific about the practice, offer to have someone call them back.`;

    // Log conversation if we have a clinic
    let conversationId: string | null = null;
    if (clinicId && sessionId) {
      const { data: existingConvo } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("session_id", sessionId)
        .eq("clinic_id", clinicId)
        .single();

      if (existingConvo) {
        conversationId = existingConvo.id;
      } else {
        const { data: newConvo } = await supabase
          .from("ai_conversations")
          .insert({
            clinic_id: clinicId,
            session_id: sessionId,
            visitor_id: visitorId,
            channel: "chat",
            status: "active"
          })
          .select("id")
          .single();
        
        conversationId = newConvo?.id || null;
      }

      // Log user message
      if (conversationId && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === "user") {
          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            role: "user",
            content: lastMessage.content
          });
        }
      }
    }

    // Call AIMLAPI for Gemini access
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
          ...messages.slice(-10), // Only send last 10 messages to reduce context
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
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
    console.error("AI assistant error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});