import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  reviewId: string;
  reviewType: "internal" | "google";
  content: string;
}

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

    const { reviewId, reviewType, content }: AnalyzeRequest = await req.json();

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Analyze sentiment and HIPAA concerns using AI via AIMLAPI
    const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIMLAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          {
            role: "system",
            content: `You are a review analysis assistant for a dental practice. Analyze the following review for:
1. Sentiment (positive, neutral, or negative) with a score from -1 to 1
2. HIPAA concerns - flag if the review contains any Protected Health Information (PHI) such as:
   - Specific medical conditions, diagnoses, or treatments
   - Prescription medications
   - Specific dates of medical appointments with identifying info
   - Health insurance information
   - Any information that could identify a patient combined with health info

Respond with JSON only in this exact format:
{
  "sentiment_score": 0.85,
  "sentiment_label": "positive",
  "hipaa_flagged": false,
  "hipaa_flag_reason": null
}`
          },
          {
            role: "user",
            content: `Analyze this dental practice review:\n\n"${content}"`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_review",
              description: "Analyze review sentiment and HIPAA compliance",
              parameters: {
                type: "object",
                properties: {
                  sentiment_score: { type: "number", description: "Score from -1 (negative) to 1 (positive)" },
                  sentiment_label: { type: "string", enum: ["positive", "neutral", "negative"] },
                  hipaa_flagged: { type: "boolean", description: "True if review contains PHI" },
                  hipaa_flag_reason: { type: "string", description: "Reason for HIPAA flag, null if not flagged" }
                },
                required: ["sentiment_score", "sentiment_label", "hipaa_flagged"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_review" } }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    // Extract the tool call result
    let analysis = {
      sentiment_score: 0,
      sentiment_label: "neutral",
      hipaa_flagged: false,
      hipaa_flag_reason: null
    };

    if (aiResponse.choices?.[0]?.message?.tool_calls?.[0]) {
      const toolCall = aiResponse.choices[0].message.tool_calls[0];
      if (toolCall.function?.arguments) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    }

    // Update the review in the database
    const table = reviewType === "internal" ? "internal_reviews" : "google_reviews";
    const { error: updateError } = await supabase
      .from(table)
      .update({
        sentiment_score: analysis.sentiment_score,
        sentiment_label: analysis.sentiment_label,
        hipaa_flagged: analysis.hipaa_flagged,
        hipaa_flag_reason: analysis.hipaa_flag_reason
      })
      .eq("id", reviewId);

    if (updateError) {
      console.error("Failed to update review:", updateError);
    }

    // Log HIPAA flagged reviews
    if (analysis.hipaa_flagged) {
      const { data: review } = await supabase
        .from(table)
        .select("clinic_id")
        .eq("id", reviewId)
        .single();

      if (review?.clinic_id) {
        await supabase.from("hipaa_audit_log").insert({
          clinic_id: review.clinic_id,
          action: "review_hipaa_flagged",
          resource_type: "review",
          resource_id: reviewId,
          details: {
            review_type: reviewType,
            flag_reason: analysis.hipaa_flag_reason
          },
          risk_level: "medium"
        });
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
