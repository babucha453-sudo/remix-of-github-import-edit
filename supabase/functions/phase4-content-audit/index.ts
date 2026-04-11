/**
 * Phase 4 Content Audit Edge Function
 * 
 * Automated content performance analysis:
 * - Identifies underperforming pages
 * - Generates enhancement recommendations
 * - Tracks competitive gaps
 * - Monitors technical SEO issues
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuditRequest {
  action: 'audit' | 'enhance' | 'analyze';
  pageId?: string;
  pageType?: string;
  limit?: number;
}

interface PageAudit {
  id: string;
  url: string;
  issues: string[];
  recommendations: string[];
  priority: 'high' | 'medium' | 'low';
  metrics: {
    wordCount: number;
    hasMetaTitle: boolean;
    hasMetaDescription: boolean;
    faqCount: number;
    internalLinks: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, pageId, pageType, limit = 50 }: AuditRequest = await req.json();

    if (action === 'audit') {
      // Run content audit on pages
      let query = supabase
        .from('seo_pages')
        .select('id, url_path, page_type, h1, word_count, content, meta_title, meta_description, faqs')
        .eq('is_indexed', true);

      if (pageType) {
        query = query.eq('page_type', pageType);
      }

      const { data: pages, error } = await query
        .order('word_count', { ascending: true, nullsFirst: true })
        .limit(limit);

      if (error) throw error;

      // Analyze each page
      const audits: PageAudit[] = pages.map(page => {
        const issues: string[] = [];
        const recommendations: string[] = [];
        let priority: 'high' | 'medium' | 'low' = 'low';

        const wordCount = page.word_count || 0;
        const faqs = (page.faqs as any[]) || [];

        // Word count checks
        if (wordCount === 0) {
          issues.push('No content');
          recommendations.push('Generate initial content using Content Studio');
          priority = 'high';
        } else if (wordCount < 300) {
          issues.push(`Thin content (${wordCount} words)`);
          recommendations.push('Expand content to 500+ words minimum');
          priority = 'high';
        } else if (wordCount < 800 && ['service', 'service_location'].includes(page.page_type)) {
          issues.push(`Below target word count (${wordCount} < 800)`);
          recommendations.push('Add detailed sections, examples, and FAQs');
          priority = 'medium';
        }

        // Meta tag checks
        if (!page.meta_title) {
          issues.push('Missing meta title');
          recommendations.push('Generate meta title using Meta Optimizer');
        }
        if (!page.meta_description) {
          issues.push('Missing meta description');
          recommendations.push('Generate meta description using Meta Optimizer');
        }

        // FAQ checks
        if (faqs.length === 0) {
          issues.push('No FAQ section');
          recommendations.push('Add 5-10 relevant FAQs using FAQ Studio');
        } else if (faqs.length < 5) {
          issues.push(`Only ${faqs.length} FAQs (target: 5-10)`);
          recommendations.push('Expand FAQ section');
        }

        // Content quality checks
        if (page.content && typeof page.content === 'string') {
          if (!page.content.includes('<h2')) {
            issues.push('Missing H2 headings');
            recommendations.push('Add structured sections with H2 headings');
          }
          if (!page.content.includes('<ul') && !page.content.includes('<ol')) {
            issues.push('No lists in content');
            recommendations.push('Add bullet points or numbered lists for readability');
          }
        }

        return {
          id: page.id,
          url: page.url_path,
          issues,
          recommendations,
          priority,
          metrics: {
            wordCount,
            hasMetaTitle: !!page.meta_title,
            hasMetaDescription: !!page.meta_description,
            faqCount: faqs.length,
            internalLinks: 0 // Would need content parsing
          }
        };
      });

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      audits.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return new Response(JSON.stringify({
        success: true,
        totalPages: audits.length,
        highPriority: audits.filter(a => a.priority === 'high').length,
        mediumPriority: audits.filter(a => a.priority === 'medium').length,
        lowPriority: audits.filter(a => a.priority === 'low').length,
        audits
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === 'enhance' && pageId) {
      // Get page details
      const { data: page, error: pageError } = await supabase
        .from('seo_pages')
        .select('*')
        .eq('id', pageId)
        .single();

      if (pageError) throw pageError;

      // Use Lovable AI to generate enhanced content
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({
          success: false,
          error: "LOVABLE_API_KEY not configured"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const currentContent = page.content || '';
      const wordCount = page.word_count || 0;
      const targetWords = page.page_type === 'service' ? 1500 : 
                         page.page_type === 'service_location' ? 1200 : 800;

      const prompt = `You are an SEO content expert enhancing dental directory pages.

Current page: ${page.url_path}
Page type: ${page.page_type}
Current word count: ${wordCount}
Target word count: ${targetWords}

Current content:
${currentContent.slice(0, 2000)}

Enhancement requirements:
1. Add 500-1000 more words of unique, valuable content
2. Include more specific details, statistics, and examples
3. Add comparison tables where relevant
4. Expand with local context and specific recommendations
5. Ensure natural keyword usage
6. Add internal linking opportunities

Generate ONLY the additional content sections to add (not the full page). Format as HTML with proper H2/H3 headings.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert SEO content writer for dental directories. Write engaging, informative content that helps users find dental care." },
            { role: "user", content: prompt }
          ],
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI API error: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const newContent = aiData.choices?.[0]?.message?.content || '';

      if (!newContent) {
        throw new Error("No content generated");
      }

      // Combine existing and new content
      const enhancedContent = currentContent + '\n\n' + newContent;
      const newWordCount = enhancedContent.split(/\s+/).filter(Boolean).length;

      // Update the page
      const { error: updateError } = await supabase
        .from('seo_pages')
        .update({
          content: enhancedContent,
          word_count: newWordCount,
          last_content_edit_source: 'phase4_audit_enhancement',
          updated_at: new Date().toISOString()
        })
        .eq('id', pageId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        success: true,
        pageId,
        previousWordCount: wordCount,
        newWordCount,
        wordsAdded: newWordCount - wordCount
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === 'analyze') {
      // Generate content health summary
      const { data: stats } = await supabase
        .from('seo_pages')
        .select('page_type, word_count, meta_title, meta_description, faqs')
        .eq('is_indexed', true);

      const summary = {
        total: stats?.length || 0,
        noContent: stats?.filter(p => !p.word_count || p.word_count === 0).length || 0,
        thinContent: stats?.filter(p => p.word_count && p.word_count > 0 && p.word_count < 300).length || 0,
        goodContent: stats?.filter(p => p.word_count && p.word_count >= 300).length || 0,
        missingMeta: stats?.filter(p => !p.meta_title || !p.meta_description).length || 0,
        missingFaqs: stats?.filter(p => !p.faqs || (p.faqs as any[]).length === 0).length || 0,
        byType: {} as Record<string, { total: number; avgWords: number }>
      };

      // Group by page type
      const typeGroups: Record<string, number[]> = {};
      stats?.forEach(p => {
        if (!typeGroups[p.page_type]) typeGroups[p.page_type] = [];
        typeGroups[p.page_type].push(p.word_count || 0);
      });

      Object.entries(typeGroups).forEach(([type, counts]) => {
        summary.byType[type] = {
          total: counts.length,
          avgWords: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
        };
      });

      return new Response(JSON.stringify({
        success: true,
        summary
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: "Invalid action"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Content audit error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
