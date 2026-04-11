import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripCodeFences(text: string): string {
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function tryParseJsonFromText(text: string): unknown | null {
  const cleaned = stripCodeFences(text);

  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
    } catch {
      // fallthrough
    }
  }

  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(cleaned.slice(objStart, objEnd + 1));
    } catch {
      // fallthrough
    }
  }

  return null;
}

/**
 * Best-effort recovery for truncated FAQ JSON.
 * If the model stops mid-answer, we still return whatever complete FAQ objects exist.
 */
function parseFaqsBestEffort(text: string): { faqs: Array<{ question: string; answer: string }> } | null {
  const cleaned = stripCodeFences(text);
  const faqsKeyIdx = cleaned.indexOf('"faqs"');
  const searchFrom = faqsKeyIdx !== -1 ? faqsKeyIdx : 0;
  const arrStart = cleaned.indexOf("[", searchFrom);
  const lastObjEnd = cleaned.lastIndexOf("}");

  if (arrStart === -1 || lastObjEnd === -1 || lastObjEnd <= arrStart) return null;

  // Keep only complete objects up to the last `}` and close the array.
  const repairedArray = cleaned.slice(arrStart, lastObjEnd + 1) + "]";
  const repairedObject = `{"faqs": ${repairedArray}}`;

  try {
    const parsed = JSON.parse(repairedObject) as any;
    if (!parsed?.faqs || !Array.isArray(parsed.faqs)) return null;

    const normalized = parsed.faqs
      .filter((f: any) => f && typeof f.question === "string" && typeof f.answer === "string")
      .map((f: any) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f: any) => f.question && f.answer);

    if (normalized.length === 0) return null;
    return { faqs: normalized };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AIMLAPI_KEY = Deno.env.get("AIMLAPI_KEY");
    if (!AIMLAPI_KEY) {
      throw new Error("AIMLAPI_KEY is not configured");
    }

    const { action, title, content, excerpt, url, count } = await req.json();

    // Handle image generation separately using AIMLAPI Image endpoint
    if (action === "generate_image") {
      if (!title || typeof title !== "string") {
        return new Response(JSON.stringify({ error: "Title is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imagePrompt = `Create a professional, high-quality blog featured image for a dental/healthcare article titled "${title}". Clean modern clinical aesthetic, photorealistic, bright lighting, no text, suitable for a dentist website header image.`;

      const genResp = await fetch("https://api.aimlapi.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${AIMLAPI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          prompt: imagePrompt,
          num_images: 1,
          aspect_ratio: "16:9",
        }),
      });

      if (!genResp.ok) {
        const errorText = await genResp.text();
        console.error("AIMLAPI image generation error:", genResp.status, errorText);
        return new Response(
          JSON.stringify({ error: `Image generation failed: ${genResp.status}`, details: errorText }),
          {
            status: genResp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const genData = await genResp.json();
      const sourceUrl = genData?.data?.[0]?.url as string | undefined;

      if (!sourceUrl) {
        console.error("AIMLAPI image response missing url:", JSON.stringify(genData));
        return new Response(JSON.stringify({ error: "No image URL returned" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prefer storing in our storage bucket and returning that URL
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !supabaseServiceKey) {
        // Fallback: return the hosted URL
        return new Response(JSON.stringify({ imageUrl: sourceUrl, sourceUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imgResp = await fetch(sourceUrl);
      if (!imgResp.ok) {
        const t = await imgResp.text();
        console.error("Failed to download generated image:", imgResp.status, t);
        return new Response(JSON.stringify({ imageUrl: sourceUrl, sourceUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contentType = imgResp.headers.get("content-type") || "image/png";
      const bytes = new Uint8Array(await imgResp.arrayBuffer());

      const ext = contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : contentType.includes("webp")
          ? "webp"
          : "png";

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const timestamp = Date.now();
      const safeSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "blog-image";
      const filename = `featured/${safeSlug}-${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-images")
        .upload(filename, bytes, { contentType, upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return new Response(JSON.stringify({ imageUrl: sourceUrl, sourceUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from("blog-images")
        .getPublicUrl(filename);

      return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl, sourceUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "generate_excerpt":
        systemPrompt = "You are a content editor. Generate a concise, engaging excerpt (2-3 sentences, max 160 characters) for the given blog post. The excerpt should capture the main point and entice readers to read more.";
        userPrompt = `Title: ${title}\n\nContent:\n${content?.substring(0, 2000)}...\n\nGenerate a compelling excerpt:`;
        break;

      case "generate_seo":
        systemPrompt = "You are an SEO expert. Generate optimized SEO title (under 60 characters) and meta description (under 160 characters) for the given blog post. Focus on primary keywords and search intent.";
        userPrompt = `Title: ${title}\n\nContent:\n${content?.substring(0, 2000)}...\n\nGenerate SEO title and description in JSON format: {"seo_title": "...", "seo_description": "..."}`;
        break;

      case "suggest_internal_links": {
        // Fetch real pages from database to match against content
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        let availablePages = "";
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          // Fetch treatments, cities, states, and blog posts
          const [treatmentsRes, citiesRes, statesRes, blogsRes, clinicsRes] = await Promise.all([
            supabase.from("treatments").select("slug, name").eq("is_active", true).limit(100),
            supabase.from("cities").select("slug, name, states(slug, name)").eq("is_active", true).limit(100),
            supabase.from("states").select("slug, name").eq("is_active", true),
            supabase.from("blog_posts").select("slug, title").eq("status", "published").limit(50),
            supabase.from("clinics").select("slug, name, cities(slug, states(slug))").eq("is_active", true).limit(50),
          ]);
          
          const pages: string[] = [];
          
          // Add treatments/services
          (treatmentsRes.data || []).forEach((t: any) => {
            pages.push(`Service: "${t.name}" → /services/${t.slug}`);
          });
          
          // Add states
          (statesRes.data || []).forEach((s: any) => {
            pages.push(`State: "${s.name}" → /${s.slug}`);
          });
          
          // Add cities with state
          (citiesRes.data || []).forEach((c: any) => {
            const state = Array.isArray(c.states) ? c.states[0] : c.states;
            if (state?.slug) {
              pages.push(`City: "${c.name}, ${state.name || ''}" → /${state.slug}/${c.slug}`);
            }
          });
          
          // Add blog posts
          (blogsRes.data || []).forEach((b: any) => {
            pages.push(`Blog: "${b.title}" → /blog/${b.slug}`);
          });
          
          // Add clinics
          (clinicsRes.data || []).forEach((cl: any) => {
            const city = Array.isArray(cl.cities) ? cl.cities[0] : cl.cities;
            const state = city?.states ? (Array.isArray(city.states) ? city.states[0] : city.states) : null;
            if (state?.slug && city?.slug) {
              pages.push(`Clinic: "${cl.name}" → /${state.slug}/${city.slug}/${cl.slug}`);
            }
          });
          
          availablePages = pages.slice(0, 200).join("\n");
        }
        
        systemPrompt = `You are an SEO content strategist for a dental directory website. Analyze the blog content and identify internal linking opportunities. Match mentions in the content to the available pages on the site. Focus on natural anchor text that would improve SEO and user experience.

Available pages on the site:
${availablePages || "No page data available - suggest generic dental service and location page patterns."}`;
        
        userPrompt = `Blog content to analyze:\n${content?.substring(0, 4000)}\n\nFind 5-10 internal linking opportunities. For each, identify:
1. The exact anchor text from the content that should be linked
2. The URL it should link to (from the available pages list)
3. Brief reason why this link adds value

Return JSON: {"links": [{"anchor_text": "exact text from content", "url": "/actual/page/path", "reason": "why this link helps", "type": "service|city|blog|clinic"}]}`;
        break;
      }

      case "detect_topic_cluster":
        systemPrompt = "You are a content strategist. Analyze the blog post and identify the main topic cluster. Common dental topic clusters include: Oral Health, Preventive Care, Cosmetic Dentistry, Pediatric Dentistry, Dental Procedures, Dental Technology.";
        userPrompt = `Title: ${title}\n\nContent:\n${content?.substring(0, 2000)}\n\nIdentify the topic cluster and primary keyword in JSON format: {"cluster_name": "...", "primary_keyword": "...", "related_keywords": ["..."]}`;
        break;

      case "generate_faqs": {
        const faqCount = count && typeof count === "number" ? Math.min(Math.max(count, 3), 15) : 5;
        systemPrompt = `You are a dental content expert. Generate exactly ${faqCount} frequently asked questions (FAQs) that people commonly ask about the given topic. The FAQs should be:
1. Relevant to potential dental patients searching for this topic
2. Informative and helpful
3. Cover different aspects of the topic
4. Written in a natural, conversational tone
5. Include comprehensive but concise answers (2-4 sentences, avoid long paragraphs)
6. Return ONLY valid JSON (no markdown, no extra text)`;
        userPrompt = `Topic/Title: ${title}\n\n${content ? `Additional context:\n${content.substring(0, 2000)}\n\n` : ''}Return exactly ${faqCount} FAQs as STRICT JSON in this shape: {"faqs": [{"question": "...", "answer": "..."}]}`;
        break;
      }

      case "improve_content":
        systemPrompt = "You are a professional content editor. Analyze the blog post and provide specific suggestions to improve readability, engagement, and SEO. Focus on structure, clarity, and value to readers.";
        userPrompt = `Title: ${title}\n\nContent:\n${content?.substring(0, 3000)}\n\nProvide improvement suggestions in JSON format: {"suggestions": [{"type": "...", "description": "...", "priority": "high|medium|low"}]}`;
        break;

      case "generate_slug":
        systemPrompt = "You are a URL optimization expert. Generate an SEO-friendly URL slug for the blog post. The slug should be lowercase, use hyphens, be concise (3-6 words), and include the primary keyword.";
        userPrompt = `Title: ${title}\n\nGenerate a slug (just the slug, nothing else):`;
        break;

      default:
        throw new Error("Invalid action");
    }

    const maxTokens = action === "generate_faqs" ? 1800 : 1000;

    const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AIMLAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON responses
    let result: any = { raw: aiResponse };
    try {
      const parsed = tryParseJsonFromText(aiResponse);
      if (parsed && typeof parsed === "object") {
        result = { ...(parsed as any), raw: aiResponse };
      } else if (action === "generate_faqs") {
        const recovered = parseFaqsBestEffort(aiResponse);
        if (recovered) {
          result = { ...recovered, raw: aiResponse };
        }
      }
    } catch {
      // If parsing fails, just return raw response
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Blog AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});