import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CategoryType = "support_ticket" | "lead" | "review_sentiment";

interface CategorizeRequest {
  type: CategoryType;
  content: string;
  entity_id?: string;
}

interface CategoryResult {
  category?: string;
  urgency_score?: number;
  suggested_response?: string;
  quality_score?: number;
  conversion_likelihood?: string;
  recommended_action?: string;
  sentiment?: string;
  key_themes?: string[];
  requires_action?: boolean;
  action_reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Use AIMLAPI for Gemini API access
    const AIMLAPI_KEY = Deno.env.get("AIMLAPI_KEY");

    if (!AIMLAPI_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AIMLAPI_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { type, content, entity_id } = await req.json() as CategorizeRequest;

    if (!type || !content) {
      return new Response(
        JSON.stringify({ success: false, error: "type and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let prompt = "";
    let responseFormat = "";

    if (type === "support_ticket") {
      prompt = `You are an AI assistant that categorizes dental clinic support tickets.
Analyze this ticket and return a JSON object with:
- category: one of "billing", "technical", "appointment", "feedback", "complaint", "general"
- urgency_score: number from 1 (low) to 10 (critical)
- suggested_response: a brief suggested response or action

Ticket content:
${content}

Return ONLY valid JSON, no markdown or explanation.`;
      responseFormat = '{"category": "...", "urgency_score": ..., "suggested_response": "..."}';
    } else if (type === "lead") {
      prompt = `You are an AI assistant that scores and qualifies dental clinic leads.
Analyze this lead and return a JSON object with:
- quality_score: number from 1-100
- conversion_likelihood: one of "high", "medium", "low"
- recommended_action: next best action for this lead

Lead information:
${content}

Return ONLY valid JSON, no markdown or explanation.`;
      responseFormat = '{"quality_score": ..., "conversion_likelihood": "...", "recommended_action": "..."}';
    } else if (type === "review_sentiment") {
      prompt = `You are an AI assistant that analyzes dental clinic review sentiment.
Analyze this review and return a JSON object with:
- sentiment: one of "positive", "neutral", "negative", "mixed"
- key_themes: array of main topics mentioned
- requires_action: boolean if immediate attention needed
- action_reason: why action is or isn't needed

Review content:
${content}

Return ONLY valid JSON, no markdown or explanation.`;
      responseFormat = '{"sentiment": "...", "key_themes": [...], "requires_action": ..., "action_reason": "..."}';
    }

    // Call AIMLAPI for Gemini access
    const aiResp = await fetch("https://api.aimlapi.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIMLAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!aiResp.ok) {
      const errorText = await aiResp.text();
      console.error("AIMLAPI error:", aiResp.status, errorText);
      
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "AI API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await aiResp.json();
    const responseText = aiJson?.choices?.[0]?.message?.content?.trim();

    let result: CategoryResult = {};
    if (responseText) {
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                          responseText.match(/```\n?([\s\S]*?)\n?```/) ||
                          [null, responseText];
        const jsonStr = jsonMatch[1] || responseText;
        result = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse AI response:", responseText);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to parse AI response" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update entity if provided
    if (entity_id && type === "support_ticket" && result.category && result.urgency_score) {
      await supabaseAdmin
        .from("support_tickets")
        .update({
          ai_suggested_category: result.category,
          ai_urgency_score: result.urgency_score,
        })
        .eq("id", entity_id);
    }

    return new Response(
      JSON.stringify({ success: true, result, type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-categorize error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
