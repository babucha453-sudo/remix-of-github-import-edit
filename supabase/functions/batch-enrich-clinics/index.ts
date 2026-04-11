import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrichRequest {
  action: "generate_descriptions" | "generate_single_description" | "generate_bulk_descriptions" | "get_stats";
  batchSize?: number;
  clinicId?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicCity?: string;
  clinicState?: string;
  clinicIds?: string[];
  wordCount?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aimlapiKey = Deno.env.get("AIMLAPI_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log("Auth error or no user:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", user.email);

    // Verify admin role - check for any admin role (super_admin or district_manager)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    console.log("Role data:", roleData, "Role error:", roleError);

    const isAdmin = roleData?.some((r: any) => 
      r.role === "super_admin" || r.role === "district_manager"
    );

    if (!isAdmin) {
      console.log("User is not admin. Roles:", roleData);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Admin verified, processing request...");

    const body: EnrichRequest = await req.json();
    const { action, batchSize = 25, wordCount = 150, clinicIds = [] } = body;

    if (action === "get_stats") {
      const { count: noDesc } = await supabase
        .from("clinics")
        .select("*", { count: "exact", head: true })
        .is("description", null)
        .eq("is_active", true);

      const { count: total } = await supabase
        .from("clinics")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      return new Response(JSON.stringify({
        total,
        withoutDescription: noDesc,
        withDescription: (total || 0) - (noDesc || 0),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate single description for one clinic
    if (action === "generate_single_description") {
      if (!aimlapiKey) {
        return new Response(JSON.stringify({ error: "AI API key not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { clinicName, clinicAddress, clinicCity, clinicState } = body;

      if (!clinicName) {
        return new Response(JSON.stringify({ error: "Clinic name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetWords = wordCount || 150;
      const prompt = `Write a professional, unique description for a dental clinic:

Clinic Name: ${clinicName}
Location: ${clinicCity || "Unknown City"}, ${clinicState || "Unknown State"}
Address: ${clinicAddress || "Not specified"}

Requirements:
- Write naturally as if a human wrote it, avoiding generic AI phrases
- Mention the specific location (city, state)
- Highlight what patients can expect (comprehensive care, modern techniques, patient comfort)
- Include a welcoming tone that builds trust
- Keep it approximately ${targetWords} words (can be ${targetWords - 20} to ${targetWords + 20} words)
- Do NOT include any placeholder text or brackets
- Do NOT mention specific services unless you're certain about them
- Focus on professionalism, patient care, and community presence

Return ONLY the description text, no quotes or formatting.`;

      try {
        const aiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${aimlapiKey}`,
          },
          body: JSON.stringify({
            model: "gemini-2.0-flash",
            messages: [
              { role: "system", content: "You are a professional medical copywriter specializing in dental practice descriptions. Write authentic, human-sounding content that builds trust with potential patients." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          throw new Error(`AI API error: ${errorText}`);
        }

        const aiData = await aiResponse.json();
        const description = aiData.choices?.[0]?.message?.content?.trim();

        return new Response(JSON.stringify({ 
          success: true, 
          description 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error generating single description:", error);
        return new Response(JSON.stringify({ 
          error: error instanceof Error ? error.message : "Failed to generate description" 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate descriptions for selected clinics (bulk)
    if (action === "generate_bulk_descriptions") {
      if (!aimlapiKey) {
        return new Response(JSON.stringify({ error: "AI API key not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!clinicIds || clinicIds.length === 0) {
        return new Response(JSON.stringify({ error: "No clinics selected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Processing ${clinicIds.length} selected clinics with ${wordCount} word target`);

      // Fetch selected clinics
      const { data: clinics, error: clinicsError } = await supabase
        .from("clinics")
        .select(`
          id, name, slug, address, phone, website, rating, review_count,
          city:cities(name, slug, state:states(name, abbreviation))
        `)
        .in("id", clinicIds)
        .eq("is_active", true);

      if (clinicsError) throw clinicsError;

      if (!clinics || clinics.length === 0) {
        return new Response(JSON.stringify({ 
          message: "No valid clinics found",
          processed: 0 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let processed = 0;
      let errors = 0;
      const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];
      const targetWords = wordCount || 150;

      for (const clinic of clinics) {
        try {
          const cityName = (clinic.city as any)?.name || "Unknown City";
          const stateName = (clinic.city as any)?.state?.name || "Unknown State";
          const stateAbbr = (clinic.city as any)?.state?.abbreviation || "";

          const prompt = `Write a professional, unique description for a dental clinic:

Clinic Name: ${clinic.name}
Location: ${cityName}, ${stateName} ${stateAbbr}
Address: ${clinic.address || "Not specified"}
Rating: ${clinic.rating || "Not rated"} stars (${clinic.review_count || 0} reviews)

Requirements:
- Write naturally as if a human wrote it, avoiding generic AI phrases
- Mention the specific location (city, state)
- Highlight what patients can expect (comprehensive care, modern techniques, patient comfort)
- Include a welcoming tone that builds trust
- Keep it approximately ${targetWords} words (can be ${targetWords - 20} to ${targetWords + 20} words)
- Do NOT include any placeholder text or brackets
- Do NOT mention specific services unless you're certain about them
- Focus on professionalism, patient care, and community presence

Return ONLY the description text, no quotes or formatting.`;

          const aiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${aimlapiKey}`,
            },
            body: JSON.stringify({
              model: "gemini-2.0-flash",
              messages: [
                { role: "system", content: "You are a professional medical copywriter specializing in dental practice descriptions. Write authentic, human-sounding content that builds trust with potential patients." },
                { role: "user", content: prompt }
              ],
              temperature: 0.7,
              max_tokens: targetWords * 3,
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`AI API error: ${errorText}`);
          }

          const aiData = await aiResponse.json();
          const description = aiData.choices?.[0]?.message?.content?.trim();

          if (description && description.length > 50) {
            const { error: updateError } = await supabase
              .from("clinics")
              .update({ description })
              .eq("id", clinic.id);

            if (updateError) throw updateError;

            results.push({ id: clinic.id, name: clinic.name, success: true });
            processed++;
          } else {
            throw new Error("Generated description too short or empty");
          }
        } catch (error) {
          console.error(`Error processing clinic ${clinic.id}:`, error);
          results.push({ 
            id: clinic.id, 
            name: clinic.name, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
          errors++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processed,
        errors,
        total: clinics.length,
        results,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_descriptions") {
      if (!aimlapiKey) {
        return new Response(JSON.stringify({ error: "AI API key not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get clinics without descriptions
      const { data: clinics, error: clinicsError } = await supabase
        .from("clinics")
        .select(`
          id, name, slug, address, phone, website, rating, review_count,
          city:cities(name, slug, state:states(name, abbreviation))
        `)
        .is("description", null)
        .eq("is_active", true)
        .limit(batchSize);

      if (clinicsError) {
        throw clinicsError;
      }

      if (!clinics || clinics.length === 0) {
        return new Response(JSON.stringify({ 
          message: "No clinics need description enrichment",
          processed: 0 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let processed = 0;
      let errors = 0;
      const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

      for (const clinic of clinics) {
        try {
          const cityName = (clinic.city as any)?.name || "Unknown City";
          const stateName = (clinic.city as any)?.state?.name || "Unknown State";
          const stateAbbr = (clinic.city as any)?.state?.abbreviation || "";

          const prompt = `Write a professional, unique 2-3 paragraph description for a dental clinic:

Clinic Name: ${clinic.name}
Location: ${cityName}, ${stateName} ${stateAbbr}
Address: ${clinic.address || "Not specified"}
Rating: ${clinic.rating || "Not rated"} stars (${clinic.review_count || 0} reviews)

Requirements:
- Write naturally as if a human wrote it, avoiding generic AI phrases
- Mention the specific location (city, state)
- Highlight what patients can expect (comprehensive care, modern techniques, patient comfort)
- Include a welcoming tone that builds trust
- Keep it between 100-150 words
- Do NOT include any placeholder text or brackets
- Do NOT mention specific services unless you're certain about them
- Focus on professionalism, patient care, and community presence

Return ONLY the description text, no quotes or formatting.`;

          const aiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${aimlapiKey}`,
            },
            body: JSON.stringify({
              model: "gemini-2.0-flash",
              messages: [
                { role: "system", content: "You are a professional medical copywriter specializing in dental practice descriptions. Write authentic, human-sounding content that builds trust with potential patients." },
                { role: "user", content: prompt }
              ],
              temperature: 0.7,
              max_tokens: 500,
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`AI API error: ${errorText}`);
          }

          const aiData = await aiResponse.json();
          const description = aiData.choices?.[0]?.message?.content?.trim();

          if (description && description.length > 50) {
            const { error: updateError } = await supabase
              .from("clinics")
              .update({ description })
              .eq("id", clinic.id);

            if (updateError) {
              throw updateError;
            }

            results.push({ id: clinic.id, name: clinic.name, success: true });
            processed++;
          } else {
            throw new Error("Generated description too short or empty");
          }
        } catch (error) {
          console.error(`Error processing clinic ${clinic.id}:`, error);
          results.push({ 
            id: clinic.id, 
            name: clinic.name, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
          errors++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processed,
        errors,
        total: clinics.length,
        results,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in batch-enrich-clinics:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
