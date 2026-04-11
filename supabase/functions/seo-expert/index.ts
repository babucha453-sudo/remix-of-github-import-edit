import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google SEO Policies & Guidelines (Updated 2024-2025)
const GOOGLE_SEO_POLICIES = {
  lastUpdated: "2025-01-15",
  coreUpdates: [
    "March 2024 Core Update - Prioritizes helpful content, reduces low-quality content by 40%",
    "August 2024 Core Update - Enhanced E-E-A-T signals, focuses on original content",
    "November 2024 Core Update - Improved understanding of search intent, better AI content detection",
    "December 2024 Spam Update - Penalizes manipulative SEO tactics, rewards genuine expertise"
  ],
  contentGuidelines: {
    helpful_content: [
      "Create content for people first, not search engines",
      "Content should demonstrate first-hand experience and expertise",
      "Avoid creating content primarily for search engine rankings",
      "Stay on topic - don't pivot to unrelated topics for SEO purposes",
      "Provide substantial value beyond what's already available online"
    ],
    eeat: [
      "Experience - Show first-hand experience with the topic",
      "Expertise - Demonstrate deep knowledge in the field", 
      "Authoritativeness - Build reputation and citations from other sources",
      "Trustworthiness - Be accurate, honest, safe, and reliable"
    ],
    onPage: {
      meta_title: {
        maxLength: 60,
        minLength: 30,
        rules: [
          "Unique for every page",
          "Primary keyword near the beginning",
          "Brand name at end if space permits",
          "Accurately describes page content",
          "No keyword stuffing"
        ]
      },
      meta_description: {
        maxLength: 155,
        minLength: 70,
        rules: [
          "Unique for every page",
          "Summarize page content accurately",
          "Include call-to-action when appropriate",
          "Include target keywords naturally",
          "Written to encourage clicks"
        ]
      },
      h1: {
        rules: [
          "Exactly one H1 per page",
          "Contains primary keyword",
          "Different from meta title but topically related",
          "Accurately describes main content",
          "Between 20-70 characters"
        ]
      },
      headingStructure: {
        rules: [
          "Proper hierarchy: H1 → H2 → H3 → H4",
          "H2s break content into logical sections",
          "H3s for sub-topics within H2 sections",
          "Include keywords naturally in headings",
          "Each heading adds semantic meaning"
        ]
      },
      content: {
        minWords: 300,
        idealWords: 800,
        rules: [
          "Minimum 300 words for adequate coverage",
          "Avoid thin content (under 300 words)",
          "No duplicate content across pages",
          "Include relevant internal links",
          "Use structured data where appropriate"
        ]
      }
    },
    technical: {
      rules: [
        "Pages must be mobile-friendly",
        "Core Web Vitals must pass",
        "Proper canonical URLs",
        "Clean URL structure",
        "Sitemap updated and valid",
        "Robots.txt properly configured",
        "HTTPS required",
        "No broken links (404s)",
        "Proper redirects (301 for permanent)",
        "Fast page load speed (<3 seconds)"
      ]
    }
  }
};

interface PageAuditResult {
  slug: string;
  page_type: string;
  issues: {
    category: "meta_title" | "meta_description" | "h1" | "h2" | "content" | "technical";
    severity: "critical" | "high" | "medium" | "low";
    issue: string;
    current_value?: string;
    recommendation: string;
    google_policy: string;
  }[];
  seo_score: number;
  passed_checks: string[];
}

interface AuditSummary {
  total_pages: number;
  pages_with_issues: number;
  pages_passed: number;
  issues_by_category: Record<string, number>;
  issues_by_severity: Record<string, number>;
  critical_issues: number;
  avg_seo_score: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Paginated fetch to get ALL records without hitting limits
async function fetchAllRecords(supabase: any, table: string, select: string, filters: Record<string, any> = {}): Promise<any[]> {
  const allRecords: any[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase.from(table).select(select).range(page * pageSize, (page + 1) * pageSize - 1);
    
    for (const [key, value] of Object.entries(filters)) {
      if (value === true || value === false) {
        query = query.eq(key, value);
      } else if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      allRecords.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  
  return allRecords;
}

// Audit a single page against Google policies
function auditPage(page: any): PageAuditResult {
  const issues: PageAuditResult["issues"] = [];
  const passedChecks: string[] = [];
  let score = 100;

  // 1. Meta Title Audit
  const title = page.meta_title || page.title || "";
  if (!title) {
    issues.push({
      category: "meta_title",
      severity: "critical",
      issue: "Missing meta title",
      recommendation: "Add a unique meta title between 30-60 characters",
      google_policy: "Every page must have a unique, descriptive title"
    });
    score -= 15;
  } else {
    if (title.length > 60) {
      issues.push({
        category: "meta_title",
        severity: "high",
        issue: `Meta title too long (${title.length} chars)`,
        current_value: title,
        recommendation: `Shorten to under 60 characters. Current: "${title.slice(0, 60)}..."`,
        google_policy: "Titles should be under 60 characters to avoid truncation"
      });
      score -= 8;
    } else if (title.length < 30) {
      issues.push({
        category: "meta_title",
        severity: "medium",
        issue: `Meta title too short (${title.length} chars)`,
        current_value: title,
        recommendation: "Expand to at least 30 characters with more descriptive keywords",
        google_policy: "Titles should be descriptive and between 30-60 characters"
      });
      score -= 5;
    } else {
      passedChecks.push("Meta title length is optimal");
    }
  }

  // 2. Meta Description Audit
  const description = page.meta_description || "";
  if (!description) {
    issues.push({
      category: "meta_description",
      severity: "high",
      issue: "Missing meta description",
      recommendation: "Add a unique meta description between 70-155 characters",
      google_policy: "Each page should have a unique meta description that summarizes content"
    });
    score -= 10;
  } else {
    if (description.length > 155) {
      issues.push({
        category: "meta_description",
        severity: "medium",
        issue: `Meta description too long (${description.length} chars)`,
        current_value: description.slice(0, 100) + "...",
        recommendation: "Shorten to under 155 characters to avoid truncation",
        google_policy: "Descriptions over 155 characters get truncated in search results"
      });
      score -= 5;
    } else if (description.length < 70) {
      issues.push({
        category: "meta_description",
        severity: "low",
        issue: `Meta description too short (${description.length} chars)`,
        current_value: description,
        recommendation: "Expand to at least 70 characters for better click-through rates",
        google_policy: "Descriptions should be descriptive enough to inform users"
      });
      score -= 3;
    } else {
      passedChecks.push("Meta description length is optimal");
    }
  }

  // 3. H1 Audit
  const h1 = page.h1 || "";
  if (!h1) {
    issues.push({
      category: "h1",
      severity: "high",
      issue: "Missing H1 heading",
      recommendation: "Add a single H1 that describes the main topic of the page",
      google_policy: "Every page should have exactly one H1 that contains the primary keyword"
    });
    score -= 10;
  } else {
    if (h1.length > 70) {
      issues.push({
        category: "h1",
        severity: "low",
        issue: `H1 too long (${h1.length} chars)`,
        current_value: h1,
        recommendation: "Shorten H1 to under 70 characters for better readability",
        google_policy: "H1 should be concise while accurately describing content"
      });
      score -= 3;
    } else if (h1.length < 10) {
      issues.push({
        category: "h1",
        severity: "medium",
        issue: `H1 too short (${h1.length} chars)`,
        current_value: h1,
        recommendation: "Expand H1 to be more descriptive (minimum 10 characters)",
        google_policy: "H1 should be descriptive and contain primary keyword"
      });
      score -= 5;
    } else {
      passedChecks.push("H1 heading present and optimal length");
    }
  }

  // 4. Content Audit
  const content = page.content || "";
  const wordCount = page.word_count || content.split(/\s+/).filter((w: string) => w.length > 0).length;
  
  if (wordCount === 0 || !content) {
    issues.push({
      category: "content",
      severity: "critical",
      issue: "No content found on page",
      recommendation: "Add at least 300 words of unique, helpful content",
      google_policy: "Pages need substantial content to rank - empty pages hurt site quality"
    });
    score -= 20;
  } else if (wordCount < 100) {
    issues.push({
      category: "content",
      severity: "critical",
      issue: `Extremely thin content (${wordCount} words)`,
      recommendation: "Expand content to at least 300 words with helpful information",
      google_policy: "Pages with very thin content may be flagged as low-quality by Google"
    });
    score -= 15;
  } else if (wordCount < 300) {
    issues.push({
      category: "content",
      severity: "high",
      issue: `Thin content (${wordCount} words)`,
      current_value: `${wordCount} words`,
      recommendation: "Expand content to at least 300 words with unique, helpful information",
      google_policy: "Minimum 300 words recommended for adequate topic coverage"
    });
    score -= 10;
  } else if (wordCount >= 800) {
    passedChecks.push(`Content depth is excellent (${wordCount} words)`);
  } else {
    passedChecks.push(`Content depth is adequate (${wordCount} words)`);
  }

  // 5. Duplicate Content Check
  if (page.is_duplicate) {
    issues.push({
      category: "content",
      severity: "critical",
      issue: "Duplicate content detected",
      current_value: page.similar_to_slug ? `Similar to: ${page.similar_to_slug}` : undefined,
      recommendation: "Rewrite content to be unique, or set canonical URL to original page",
      google_policy: "Duplicate content can cause indexing issues and ranking penalties"
    });
    score -= 15;
  }

  // 6. Check for H2 structure in content
  const h2Count = (content.match(/## /g) || []).length;
  if (wordCount >= 300 && h2Count === 0) {
    issues.push({
      category: "h2",
      severity: "medium",
      issue: "No H2 headings found in content",
      recommendation: "Add 3-6 H2 sections to organize content logically",
      google_policy: "Proper heading hierarchy (H2, H3) helps Google understand content structure"
    });
    score -= 5;
  } else if (h2Count >= 3) {
    passedChecks.push(`Good heading structure (${h2Count} H2 sections)`);
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return {
    slug: page.slug,
    page_type: page.page_type,
    issues,
    seo_score: score,
    passed_checks: passedChecks
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

    // Verify super_admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action || "get_policies";
    const now = new Date().toISOString();

    // Action: Get Google SEO Policies
    if (action === "get_policies") {
      return new Response(JSON.stringify({
        success: true,
        policies: GOOGLE_SEO_POLICIES
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Full Audit with Filtering - NO LIMIT (paginated fetch)
    if (action === "full_audit") {
      const { page_types, state_filter, city_filter, limit = 100000 } = body;
      
      console.log(`Starting UNLIMITED full audit with filters: page_types=${page_types}, state=${state_filter}, city=${city_filter}`);

      // Create audit run record
      const { data: runData } = await supabaseAdmin
        .from("seo_audit_runs")
        .insert({
          run_type: "expert_audit",
          status: "running",
          started_at: now,
          triggered_by: userId,
          summary: { filters: { page_types, state_filter, city_filter } }
        })
        .select("id")
        .single();

      const runId = runData?.id;

      // Use paginated fetch to get ALL pages without hitting limits
      const allPages: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;
      
      while (hasMore && allPages.length < limit) {
        let query = supabaseAdmin
          .from("seo_pages")
          .select("*")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (page_types && page_types.length > 0) {
          query = query.in("page_type", page_types);
        }

        if (state_filter) {
          query = query.ilike("slug", `/${state_filter}/%`);
        }

        if (city_filter) {
          query = query.ilike("slug", `%/${city_filter}/%`);
        }

        const { data: pageData, error: pageError } = await query;
        
        if (pageError) {
          console.error("Error fetching pages batch:", pageError);
          break;
        }
        
        if (!pageData || pageData.length === 0) {
          hasMore = false;
        } else {
          allPages.push(...pageData);
          page++;
          if (pageData.length < pageSize) hasMore = false;
        }
      }

      const pages = allPages;
      const pagesError = null;

      console.log(`Auditing ${pages?.length || 0} pages...`);

      const auditResults: PageAuditResult[] = [];
      const issuesByCategory: Record<string, number> = {};
      const issuesBySeverity: Record<string, number> = {};
      let pagesWithIssues = 0;
      let totalScore = 0;

      for (const page of pages || []) {
        const result = auditPage(page);
        auditResults.push(result);
        totalScore += result.seo_score;

        if (result.issues.length > 0) {
          pagesWithIssues++;
          for (const issue of result.issues) {
            issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
            issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
          }
        }

        // Update page with audit results
        await supabaseAdmin
          .from("seo_pages")
          .update({
            seo_score: result.seo_score,
            is_thin_content: result.issues.some(i => i.issue.includes("thin content") || i.issue.includes("No content")),
            last_audited_at: now,
            needs_optimization: result.seo_score < 80
          })
          .eq("id", page.id);
      }

      const summary: AuditSummary = {
        total_pages: pages?.length || 0,
        pages_with_issues: pagesWithIssues,
        pages_passed: (pages?.length || 0) - pagesWithIssues,
        issues_by_category: issuesByCategory,
        issues_by_severity: issuesBySeverity,
        critical_issues: issuesBySeverity.critical || 0,
        avg_seo_score: pages?.length ? Math.round(totalScore / pages.length) : 0
      };

      // Update audit run
      await supabaseAdmin
        .from("seo_audit_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          total_pages: pages?.length || 0,
          processed_pages: pages?.length || 0,
          fixed_pages: 0,
          summary
        })
        .eq("id", runId);

      console.log(`Audit complete. Summary:`, summary);

      return new Response(JSON.stringify({
        success: true,
        run_id: runId,
        summary,
        results: auditResults.slice(0, 100), // Return first 100 for preview
        google_policies: GOOGLE_SEO_POLICIES.lastUpdated
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Get Audit Stats - UNLIMITED (paginated fetch)
    if (action === "get_stats") {
      const { page_types, state_filter, city_filter } = body;

      // Use paginated fetch to get ALL pages
      const allPages: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabaseAdmin
          .from("seo_pages")
          .select("*")
          .range(page * pageSize, (page + 1) * pageSize - 1);
          
        if (page_types && page_types.length > 0) {
          query = query.in("page_type", page_types);
        }
        
        if (state_filter) {
          query = query.ilike("slug", `/${state_filter}/%`);
        }
        
        if (city_filter) {
          query = query.ilike("slug", `%/${city_filter}/%`);
        }

        const { data: pageData, error: pageError } = await query;
        
        if (pageError) {
          console.error("Error fetching pages batch:", pageError);
          break;
        }
        
        if (!pageData || pageData.length === 0) {
          hasMore = false;
        } else {
          allPages.push(...pageData);
          page++;
          if (pageData.length < pageSize) hasMore = false;
        }
      }

      const pages = allPages;

      // Calculate stats
      const stats = {
        total_pages: pages.length,
        by_type: {} as Record<string, number>,
        issues: {
          no_meta_title: 0,
          meta_title_too_long: 0,
          meta_title_too_short: 0,
          no_meta_description: 0,
          meta_desc_too_long: 0,
          meta_desc_too_short: 0,
          no_h1: 0,
          h1_too_long: 0,
          no_content: 0,
          thin_content: 0,
          duplicate_content: 0
        },
        avg_seo_score: 0,
        needs_optimization: 0,
        optimized: 0
      };

      let totalScore = 0;
      for (const page of pages) {
        // Count by type
        stats.by_type[page.page_type] = (stats.by_type[page.page_type] || 0) + 1;

        // Score
        totalScore += page.seo_score || 0;

        // Issues
        const title = page.meta_title || page.title || "";
        const desc = page.meta_description || "";
        const h1 = page.h1 || "";
        const wordCount = page.word_count || 0;

        if (!title) stats.issues.no_meta_title++;
        else if (title.length > 60) stats.issues.meta_title_too_long++;
        else if (title.length < 30) stats.issues.meta_title_too_short++;

        if (!desc) stats.issues.no_meta_description++;
        else if (desc.length > 155) stats.issues.meta_desc_too_long++;
        else if (desc.length < 70) stats.issues.meta_desc_too_short++;

        if (!h1) stats.issues.no_h1++;
        else if (h1.length > 70) stats.issues.h1_too_long++;

        if (wordCount === 0) stats.issues.no_content++;
        else if (wordCount < 300) stats.issues.thin_content++;

        if (page.is_duplicate) stats.issues.duplicate_content++;

        if (page.needs_optimization) stats.needs_optimization++;
        if (page.is_optimized) stats.optimized++;
      }

      stats.avg_seo_score = pages.length ? Math.round(totalScore / pages.length) : 0;

      // Get page types for filter options
      const pageTypes = [...new Set(pages.map(p => p.page_type))].sort();

      // Get latest audit run
      const { data: latestRun } = await supabaseAdmin
        .from("seo_audit_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({
        success: true,
        stats,
        page_types: pageTypes,
        latest_audit: latestRun,
        google_policies_last_updated: GOOGLE_SEO_POLICIES.lastUpdated
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Get Issues by Category - UNLIMITED (paginated fetch)
    if (action === "get_issues") {
      const { category, page_type, state_filter, city_filter, severity } = body;

      // Use paginated fetch to get ALL matching pages
      const allPages: any[] = [];
      const pageSize = 1000;
      let pageNum = 0;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabaseAdmin
          .from("seo_pages")
          .select("*")
          .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
          .order("created_at", { ascending: false });

        // Apply filters based on category
        switch (category) {
          case "meta_title":
            query = query.or("meta_title.is.null,title.is.null");
            break;
          case "meta_description":
            query = query.is("meta_description", null);
            break;
          case "h1":
            query = query.is("h1", null);
            break;
          case "content":
            query = query.or("word_count.lt.300,word_count.is.null,is_thin_content.eq.true");
            break;
          case "duplicate":
            query = query.eq("is_duplicate", true);
            break;
        }

        if (page_type) {
          query = query.eq("page_type", page_type);
        }

        if (state_filter) {
          query = query.ilike("slug", `/${state_filter}/%`);
        }

        if (city_filter) {
          query = query.ilike("slug", `%/${city_filter}/%`);
        }

        const { data: pageData, error: pageError } = await query;
        
        if (pageError) {
          console.error("Error fetching issues batch:", pageError);
          break;
        }
        
        if (!pageData || pageData.length === 0) {
          hasMore = false;
        } else {
          allPages.push(...pageData);
          pageNum++;
          if (pageData.length < pageSize) hasMore = false;
        }
      }

      const pages = allPages;

      // Audit each page to get detailed issues
      const issueDetails = (pages || []).map(page => {
        const audit = auditPage(page);
        return {
          id: page.id,
          slug: page.slug,
          page_type: page.page_type,
          current_title: page.meta_title || page.title,
          current_description: page.meta_description,
          current_h1: page.h1,
          word_count: page.word_count,
          seo_score: audit.seo_score,
          issues: audit.issues.filter(i => !category || i.category === category),
          passed_checks: audit.passed_checks
        };
      });

      return new Response(JSON.stringify({
        success: true,
        issues: issueDetails,
        total_count: issueDetails.length,
        google_policy: GOOGLE_SEO_POLICIES.contentGuidelines.onPage[category as keyof typeof GOOGLE_SEO_POLICIES.contentGuidelines.onPage] || null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Fix Issues with AI
    if (action === "fix_issues") {
      if (!AIMLAPI_KEY) {
        return new Response(JSON.stringify({ success: false, error: "AIMLAPI_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { page_ids, issue_category, custom_prompt, page_type, state_filter, city_filter, limit = 500 } = body;

      // Get pages to fix - use paginated fetch for large batches
      const allPages: any[] = [];
      
      if (page_ids && page_ids.length > 0) {
        // Fetch specific pages by ID in batches
        const batchSize = 100;
        for (let i = 0; i < page_ids.length; i += batchSize) {
          const batch = page_ids.slice(i, i + batchSize);
          const { data: batchData } = await supabaseAdmin
            .from("seo_pages")
            .select("*")
            .in("id", batch);
          if (batchData) allPages.push(...batchData);
        }
      } else {
        // Build query based on issue category - paginated
        const pageSize = 500;
        let pageNum = 0;
        let hasMore = true;
        
        while (hasMore && allPages.length < limit) {
          let query = supabaseAdmin
            .from("seo_pages")
            .select("*")
            .range(pageNum * pageSize, Math.min((pageNum + 1) * pageSize - 1, limit - 1));
          
          switch (issue_category) {
            case "meta_title":
              query = query.or("meta_title.is.null,title.is.null");
              break;
            case "meta_description":
              query = query.is("meta_description", null);
              break;
            case "h1":
              query = query.is("h1", null);
              break;
            case "content":
              query = query.or("word_count.lt.300,word_count.is.null");
              break;
          }

          if (page_type) {
            query = query.eq("page_type", page_type);
          }
          
          if (state_filter) {
            query = query.ilike("slug", `/${state_filter}/%`);
          }
          
          if (city_filter) {
            query = query.ilike("slug", `%/${city_filter}/%`);
          }

          const { data: pageData } = await query;
          
          if (!pageData || pageData.length === 0) {
            hasMore = false;
          } else {
            allPages.push(...pageData);
            pageNum++;
            if (pageData.length < pageSize || allPages.length >= limit) hasMore = false;
          }
        }
      }

      const pages = allPages.slice(0, limit);

      if (!pages?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "No pages found to fix" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Fixing ${pages.length} pages for ${issue_category} issues`);

      const results: { id: string; slug: string; status: "fixed" | "failed"; changes?: any; error?: string }[] = [];

      for (const page of pages) {
        try {
          // Build AI prompt with Google policies
          const systemPrompt = `You are an expert SEO specialist following Google's latest guidelines.

GOOGLE SEO POLICIES (Updated ${GOOGLE_SEO_POLICIES.lastUpdated}):
${JSON.stringify(GOOGLE_SEO_POLICIES.contentGuidelines.onPage, null, 2)}

TASK: Fix ${issue_category} issues for a dental directory page.
${custom_prompt ? `\nCUSTOM INSTRUCTIONS: ${custom_prompt}` : ""}

Return ONLY valid JSON with the fixed content.`;

          const userPrompt = `Fix ${issue_category} for this page:
Slug: ${page.slug}
Page Type: ${page.page_type}
Current Title: ${page.meta_title || page.title || "MISSING"}
Current Description: ${page.meta_description || "MISSING"}
Current H1: ${page.h1 || "MISSING"}
Current Content Length: ${page.word_count || 0} words

Generate unique, SEO-optimized content following Google guidelines.`;

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
                { role: "user", content: userPrompt }
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "fix_seo_issue",
                    description: "Fix SEO issues for a page",
                    parameters: {
                      type: "object",
                      properties: {
                        meta_title: { type: "string", description: "Optimized meta title (under 60 chars)" },
                        meta_description: { type: "string", description: "Optimized meta description (under 155 chars)" },
                        h1: { type: "string", description: "Optimized H1 heading" },
                        intro_paragraph: { type: "string", description: "Opening paragraph for content" },
                        h2_sections: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              heading: { type: "string" },
                              content: { type: "string" }
                            }
                          }
                        },
                        faq: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              question: { type: "string" },
                              answer: { type: "string" }
                            }
                          }
                        }
                      },
                      required: ["meta_title", "meta_description", "h1"]
                    }
                  }
                }
              ],
              tool_choice: { type: "function", function: { name: "fix_seo_issue" } }
            }),
          });

          if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`);
          }

          const aiJson = await response.json();
          let fixedContent;

          if (aiJson.choices?.[0]?.message?.tool_calls?.[0]) {
            fixedContent = JSON.parse(aiJson.choices[0].message.tool_calls[0].function.arguments);
          } else {
            throw new Error("No valid response from AI");
          }

          // Build structured content
          let structuredContent = fixedContent.intro_paragraph || "";
          if (fixedContent.h2_sections) {
            for (const section of fixedContent.h2_sections) {
              structuredContent += `\n\n## ${section.heading}\n\n${section.content}`;
            }
          }
          if (fixedContent.faq && fixedContent.faq.length > 0) {
            structuredContent += "\n\n## Frequently Asked Questions\n\n";
            for (const faq of fixedContent.faq) {
              structuredContent += `### ${faq.question}\n\n${faq.answer}\n\n`;
            }
          }

          const wordCount = structuredContent.split(/\s+/).filter((w: string) => w.length > 0).length;

          // Update the page
          const updateData: any = {
            meta_title: fixedContent.meta_title,
            meta_description: fixedContent.meta_description,
            h1: fixedContent.h1,
            updated_at: now,
            is_optimized: true,
            optimized_at: now,
            needs_optimization: false
          };

          // Only update content if we're fixing content issues
          if (issue_category === "content" && structuredContent) {
            updateData.content = structuredContent;
            updateData.word_count = wordCount;
            updateData.is_thin_content = wordCount < 300;
          }

          await supabaseAdmin
            .from("seo_pages")
            .update(updateData)
            .eq("id", page.id);

          results.push({
            id: page.id,
            slug: page.slug,
            status: "fixed",
            changes: {
              meta_title: fixedContent.meta_title,
              meta_description: fixedContent.meta_description?.slice(0, 50) + "...",
              h1: fixedContent.h1,
              word_count: issue_category === "content" ? wordCount : undefined
            }
          });

          console.log(`Fixed page: ${page.slug}`);
        } catch (err) {
          console.error(`Failed to fix page ${page.slug}:`, err);
          results.push({
            id: page.id,
            slug: page.slug,
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error"
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      const fixed = results.filter(r => r.status === "fixed").length;
      const failed = results.filter(r => r.status === "failed").length;

      return new Response(JSON.stringify({
        success: true,
        fixed_count: fixed,
        failed_count: failed,
        results
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Get States and Cities for filtering
    if (action === "get_filter_options") {
      const { data: states } = await supabaseAdmin
        .from("states")
        .select("slug, name, abbreviation")
        .eq("is_active", true)
        .order("name");

      const { data: cities } = await supabaseAdmin
        .from("cities")
        .select("slug, name, state_id, states(abbreviation)")
        .eq("is_active", true)
        .order("name")
        .limit(500);

      return new Response(JSON.stringify({
        success: true,
        states: states || [],
        cities: (cities || []).map(c => ({
          slug: c.slug,
          name: c.name,
          state_abbr: (c as any).states?.abbreviation
        }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: Return current policies
    return new Response(JSON.stringify({
      success: true,
      message: "SEO Expert Bot ready",
      policies: GOOGLE_SEO_POLICIES,
      available_actions: [
        "get_policies",
        "full_audit",
        "get_stats",
        "get_issues",
        "fix_issues",
        "get_filter_options"
      ]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("seo-expert error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
