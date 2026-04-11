import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Priority = "low" | "medium" | "high" | "critical";

type SeoTaskDraft = {
  title: string;
  description: string;
  task_type: "content" | "technical" | "linking" | "schema" | "performance" | string;
  priority: Priority;
  page_url?: string | null;
  target_keyword?: string | null;
  suggested_action?: string | null;
  ai_confidence?: number | null;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function wordCount(text: string | null): number {
  if (!text) return 0;
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Use AIMLAPI for Gemini API access
    const AIMLAPI_KEY = Deno.env.get("AIMLAPI_KEY");

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

    // Use getClaims for JWT verification (compatible with ES256 signing)
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("seo-audit: JWT verification failed", claimsError);
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = claimsData.claims.sub as string;

    // Super Admin only
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesErr) {
      console.error("seo-audit: failed to read roles", rolesErr);
      return new Response(JSON.stringify({ success: false, error: "Failed to verify permissions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // 1) Build index of real routes from DB
    const [statesRes, citiesRes, treatmentsRes, clinicsRes, dentistsRes, blogRes] = await Promise.all([
      supabaseAdmin.from("states").select("slug,name").eq("is_active", true),
      supabaseAdmin.from("cities").select("slug,name,states(slug)").eq("is_active", true),
      supabaseAdmin.from("treatments").select("slug,name").eq("is_active", true),
      supabaseAdmin.from("clinics").select("slug,name").eq("is_active", true),
      supabaseAdmin.from("dentists").select("slug,name").eq("is_active", true),
      supabaseAdmin.from("blog_posts").select("slug,title").eq("status", "published"),
    ]);

    if (statesRes.error) throw statesRes.error;
    if (citiesRes.error) throw citiesRes.error;
    if (treatmentsRes.error) throw treatmentsRes.error;
    if (clinicsRes.error) throw clinicsRes.error;
    if (dentistsRes.error) throw dentistsRes.error;
    if (blogRes.error) throw blogRes.error;

    // US-focused static pages (no /ae/ prefix)
    const staticPages: Array<{ slug: string; title: string; page_type: string }> = [
      { slug: "/", title: "Homepage", page_type: "static" },
      { slug: "/services", title: "Services", page_type: "static" },
      { slug: "/blog", title: "Blog", page_type: "static" },
      { slug: "/insurance", title: "Insurance", page_type: "static" },
      { slug: "/sitemap", title: "Sitemap", page_type: "static" },
      { slug: "/about", title: "About", page_type: "static" },
      { slug: "/contact", title: "Contact", page_type: "static" },
      { slug: "/faq", title: "FAQ", page_type: "static" },
      { slug: "/how-it-works", title: "How It Works", page_type: "static" },
      { slug: "/pricing", title: "Pricing", page_type: "static" },
      { slug: "/privacy", title: "Privacy", page_type: "static" },
      { slug: "/terms", title: "Terms", page_type: "static" },
    ];

    const indexRows: Array<{ slug: string; page_type: string; title: string; updated_at: string }> = [
      ...staticPages.map((p) => ({ slug: p.slug, page_type: p.page_type, title: p.title, updated_at: now })),
    ];

    // Add state pages (e.g., /ca)
    for (const s of statesRes.data ?? []) {
      if (s.slug && s.name) {
        indexRows.push({
          slug: `/${s.slug}`,
          page_type: "state",
          title: s.name,
          updated_at: now,
        });
      }
    }

    // Add city pages (e.g., /ca/los-angeles)
    for (const c of citiesRes.data ?? []) {
      if (c.slug && c.name) {
        const stateData = Array.isArray(c.states) ? c.states[0] : c.states;
        if (stateData?.slug) {
          indexRows.push({
            slug: `/${stateData.slug}/${c.slug}`,
            page_type: "city",
            title: c.name,
            updated_at: now,
          });
        }
      }
    }

    // Add treatment pages (e.g., /services/teeth-whitening)
    for (const t of treatmentsRes.data ?? []) {
      if (t.slug && t.name) {
        indexRows.push({
          slug: `/services/${t.slug}`,
          page_type: "treatment",
          title: t.name,
          updated_at: now,
        });
      }
    }

    // Add clinic pages (e.g., /clinic/smile-dental)
    for (const c of clinicsRes.data ?? []) {
      if (c.slug && c.name) {
        indexRows.push({
          slug: `/clinic/${c.slug}`,
          page_type: "clinic",
          title: c.name,
          updated_at: now,
        });
      }
    }

    // Add dentist pages (e.g., /dentist/dr-smith)
    for (const d of dentistsRes.data ?? []) {
      if (d.slug && d.name) {
        indexRows.push({
          slug: `/dentist/${d.slug}`,
          page_type: "dentist",
          title: d.name,
          updated_at: now,
        });
      }
    }

    // Add blog pages (e.g., /blog/post-slug)
    for (const p of blogRes.data ?? []) {
      if (p.slug && p.title) {
        indexRows.push({
          slug: `/blog/${p.slug}`,
          page_type: "blog",
          title: p.title,
          updated_at: now,
        });
      }
    }

    // Filter out any rows with null/empty slugs before upserting
    const validIndexRows = indexRows.filter(row => row.slug && row.slug.trim() !== '');
    
    // Upsert in batches (slug is unique)
    for (const batch of chunk(validIndexRows, 200)) {
      const { error } = await supabaseAdmin.from("seo_pages").upsert(batch, { onConflict: "slug" });
      if (error) throw error;
    }

    // 2) Run DB-based audit on seo_pages
    const { data: seoPages, error: seoErr } = await supabaseAdmin
      .from("seo_pages")
      .select("id,slug,page_type,title,meta_title,meta_description,h1,content");

    if (seoErr) throw seoErr;

    const pages = seoPages ?? [];
    const duplicateKeyCounts = new Map<string, number>();

    for (const p of pages) {
      if (p.meta_title) {
        const k = p.meta_title.trim().toLowerCase();
        duplicateKeyCounts.set(k, (duplicateKeyCounts.get(k) ?? 0) + 1);
      }
    }

    const THIN_WORDS = 250;
    const updates = pages.map((p) => {
      const wc = wordCount(p.content);
      const isThin = wc < THIN_WORDS;
      const isDup = p.meta_title ? (duplicateKeyCounts.get(p.meta_title.trim().toLowerCase()) ?? 0) > 1 : false;

      return {
        id: p.id,
        word_count: wc,
        is_thin_content: isThin,
        is_duplicate: isDup,
        last_crawled_at: now,
        updated_at: now,
      };
    });

    // Use update instead of upsert to avoid slug NOT NULL constraint issues
    for (const u of updates) {
      const { error } = await supabaseAdmin
        .from("seo_pages")
        .update({
          word_count: u.word_count,
          is_thin_content: u.is_thin_content,
          is_duplicate: u.is_duplicate,
          last_crawled_at: u.last_crawled_at,
          updated_at: u.updated_at,
        })
        .eq("id", u.id);
      if (error) {
        console.error("seo-audit: update failed for id", u.id, error);
      }
    }

    const summary = {
      total_pages: pages.length,
      missing_meta_title: pages.filter((p) => !p.meta_title).length,
      missing_meta_description: pages.filter((p) => !p.meta_description).length,
      missing_h1: pages.filter((p) => !p.h1).length,
      thin_content: updates.filter((u) => u.is_thin_content).length,
      duplicates: updates.filter((u) => u.is_duplicate).length,
      thin_threshold_words: THIN_WORDS,
    };

    // 3) Gemini: generate prioritized tasks from real audit summary
    let createdTasks = 0;
    let aiEventId: string | null = null;

    const sampleMissingMeta = pages
      .filter((p) => !p.meta_title || !p.meta_description)
      .slice(0, 30)
      .map((p) => p.slug);

    const promptPayload = {
      summary,
      sample_missing_meta_pages: sampleMissingMeta,
      note:
        "These routes are real. For pages missing meta/content, propose a practical plan to fix via templates + batch updates + targeted manual work.",
    };

    if (AIMLAPI_KEY) {
      // Create ai_event
      const { data: ev, error: evErr } = await supabaseAdmin
        .from("ai_events")
        .insert({
          event_type: "seo_audit",
          module: "seo_copilot",
          status: "running",
          triggered_by: "super_admin",
          user_id: userId,
          created_at: now,
        })
        .select("id")
        .single();

      if (evErr) {
        console.warn("seo-audit: failed to create ai_event", evErr);
      } else {
        aiEventId = ev?.id ?? null;
      }

      if (aiEventId) {
        await supabaseAdmin.from("ai_inputs").insert({
          event_id: aiEventId,
          input_type: "seo_audit_context",
          input_data: promptPayload,
          created_at: now,
        });
      }

      const systemPrompt = `You are an expert SEO auditor for a dental marketplace. Produce only actionable tasks based on the given audit data. Avoid generic advice. Prefer batching strategies and concrete templates.

Return a JSON object with a "tasks" array containing 5-10 high-impact SEO tasks. Each task should have:
- title: string
- description: string  
- task_type: one of "content", "technical", "linking", "schema", "performance"
- priority: one of "low", "medium", "high", "critical"
- page_url: optional string or null
- target_keyword: optional string or null
- suggested_action: optional string or null
- ai_confidence: optional number 0-1 or null`;

      // Use AIMLAPI for Gemini access
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
            { role: "user", content: `Audit Data:\n${JSON.stringify(promptPayload)}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_seo_tasks",
                description: "Generate SEO audit tasks",
                parameters: {
                  type: "object",
                  properties: {
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          task_type: { type: "string", enum: ["content", "technical", "linking", "schema", "performance"] },
                          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                          page_url: { type: "string" },
                          target_keyword: { type: "string" },
                          suggested_action: { type: "string" },
                          ai_confidence: { type: "number" }
                        },
                        required: ["title", "description", "task_type", "priority"]
                      }
                    }
                  },
                  required: ["tasks"]
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "generate_seo_tasks" } }
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ success: false, error: "Rate limits exceeded, try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const t = await aiResp.text();
        console.error("seo-audit: AI API error", aiResp.status, t);
        return new Response(JSON.stringify({ success: false, error: "AI service error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiJson = await aiResp.json();
      
      let aiTasks: SeoTaskDraft[] = [];
      if (aiJson.choices?.[0]?.message?.tool_calls?.[0]) {
        const toolCall = aiJson.choices[0].message.tool_calls[0];
        if (toolCall.function?.arguments) {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            aiTasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
          } catch (parseError) {
            console.error("Failed to parse AI response:", toolCall.function.arguments);
          }
        }
      }

      if (aiEventId) {
        await supabaseAdmin.from("ai_outputs").insert({
          event_id: aiEventId,
          output_type: "seo_tasks",
          output_data: { tasks: aiTasks },
          created_at: now,
          explanation: "SEO Copilot tasks generated via AIMLAPI Gemini",
        });

        await supabaseAdmin.from("ai_events").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", aiEventId);
      }

      if (aiTasks.length) {
        const rows = aiTasks.map((t) => ({
          title: t.title,
          description: t.description,
          task_type: t.task_type,
          priority: t.priority,
          status: "pending",
          page_url: t.page_url ?? null,
          target_keyword: t.target_keyword ?? null,
          suggested_action: t.suggested_action ?? null,
          ai_confidence: t.ai_confidence ?? null,
          created_at: now,
          updated_at: now,
        }));

        for (const batch of chunk(rows, 100)) {
          const { error } = await supabaseAdmin.from("seo_tasks").insert(batch);
          if (error) throw error;
          createdTasks += batch.length;
        }
      }

      // Audit log
      try {
        await supabaseAdmin.from("audit_logs").insert({
          action: "SEO_AUDIT_RUN",
          entity_type: "seo",
          entity_id: aiEventId ?? "seo_audit",
          user_id: userId,
          new_values: { summary, created_tasks: createdTasks },
        });
      } catch (auditErr) {
        console.warn("seo-audit: audit log failed", auditErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        indexed_pages: indexRows.length,
        updated_pages: updates.length,
        created_tasks: createdTasks,
        ai_event_id: aiEventId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("seo-audit error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
