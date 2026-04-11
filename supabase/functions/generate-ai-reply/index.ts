import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewData {
  review_id: string;
  review_type: "google" | "internal";
  author_name: string;
  rating: number;
  text_content: string;
  clinic_name?: string;
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
    
    const { review_id, review_type, author_name, rating, text_content, clinic_name } = await req.json() as ReviewData;

    if (!review_id || !review_type) {
      return new Response(
        JSON.stringify({ success: false, error: "review_id and review_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt based on review sentiment
    const sentiment = rating >= 4 ? "positive" : rating >= 3 ? "neutral" : "negative";
    
    const systemPrompt = `You are a professional dental clinic customer service representative for ${clinic_name || "a dental clinic"}. 
Your task is to generate thoughtful, professional, and empathetic review responses.

Guidelines:
- Be warm, professional, and genuine
- For positive reviews: Thank the patient sincerely and invite them back
- For negative reviews: Apologize, acknowledge concerns, offer to resolve issues offline
- Keep responses concise (2-4 sentences)
- Never be defensive or dismissive
- Don't use excessive emojis or exclamation marks
- Include a call-to-action when appropriate`;

    const userPrompt = `Generate a professional response to this ${sentiment} review:

Reviewer: ${author_name}
Rating: ${rating}/5 stars
Review: "${text_content || "No comment provided"}"

Respond appropriately based on the sentiment and content.`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const errorText = await aiResp.text();
      console.error("Lovable AI error:", aiResp.status, errorText);
      
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await aiResp.json();
    const generatedReply = aiJson?.choices?.[0]?.message?.content?.trim();

    if (!generatedReply) {
      return new Response(
        JSON.stringify({ success: false, error: "No response generated from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the appropriate table with the AI suggestion
    if (review_type === "google") {
      const { error } = await supabaseAdmin
        .from("google_reviews")
        .update({ ai_suggested_reply: generatedReply })
        .eq("id", review_id);

      if (error) {
        console.error("Error updating google_reviews:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to save AI reply" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (review_type === "internal") {
      const { error } = await supabaseAdmin
        .from("internal_reviews")
        .update({ ai_suggested_response: generatedReply })
        .eq("id", review_id);

      if (error) {
        console.error("Error updating internal_reviews:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to save AI response" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reply: generatedReply,
        review_id,
        review_type 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("generate-ai-reply error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
