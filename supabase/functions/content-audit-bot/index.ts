import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Active states filter
const ACTIVE_STATE_SLUGS = ['ca', 'ct', 'ma', 'nj'];

// Google E-E-A-T content quality guidelines
const CONTENT_QUALITY_CRITERIA = {
  minWords: 800,
  goodWords: 1000,
  excellentWords: 1500,
  minHeadings: 3,
  maxDuplicateSimilarity: 0.70, // 70% similarity threshold
};

interface AuditRequest {
  action: 'run_audit' | 'get_audit_results' | 'analyze_page' | 'get_duplication_report';
  page_type?: string;
  state_filter?: string;
  city_filter?: string;
  limit?: number;
  offset?: number;
  page_id?: string;
  audit_id?: string;
}

interface PageAuditResult {
  id: string;
  slug: string;
  page_type: string;
  word_count: number;
  content_status: 'excellent' | 'good' | 'thin' | 'missing';
  duplication_score: number;
  similar_pages: { slug: string; similarity: number }[];
  quality_score: number;
  issues: string[];
  recommendations: string[];
  eeat_compliance: boolean;
  has_unique_content: boolean;
}

// Calculate word overlap similarity between two texts
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // Normalize and tokenize
  const normalize = (t: string) => t.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let shared = 0;
  for (const word of words1) {
    if (words2.has(word)) shared++;
  }
  
  // Jaccard similarity
  const union = words1.size + words2.size - shared;
  return union > 0 ? shared / union : 0;
}

// Calculate content quality score (0-100)
function calculateQualityScore(content: string | null, wordCount: number): number {
  if (!content || wordCount === 0) return 0;
  
  let score = 0;
  
  // Word count scoring (40 points max)
  if (wordCount >= CONTENT_QUALITY_CRITERIA.excellentWords) {
    score += 40;
  } else if (wordCount >= CONTENT_QUALITY_CRITERIA.goodWords) {
    score += 30;
  } else if (wordCount >= CONTENT_QUALITY_CRITERIA.minWords) {
    score += 20;
  } else if (wordCount >= 300) {
    score += 10;
  }
  
  // Structure scoring (30 points max)
  const h2Count = (content.match(/<h2|## /gi) || []).length;
  const h3Count = (content.match(/<h3|### /gi) || []).length;
  const hasLists = /<ul|<ol|- /i.test(content);
  
  if (h2Count >= 3) score += 15;
  else if (h2Count >= 2) score += 10;
  else if (h2Count >= 1) score += 5;
  
  if (h3Count >= 2) score += 10;
  else if (h3Count >= 1) score += 5;
  
  if (hasLists) score += 5;
  
  // Content variety scoring (30 points max)
  const uniqueWords = new Set(content.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const uniqueRatio = uniqueWords.size / wordCount;
  
  if (uniqueRatio >= 0.4) score += 20;
  else if (uniqueRatio >= 0.3) score += 15;
  else if (uniqueRatio >= 0.2) score += 10;
  else score += 5;
  
  // Check for location/service specific keywords (10 points)
  const hasSpecificKeywords = /dentist|dental|clinic|teeth|oral|care|treatment|service/i.test(content);
  if (hasSpecificKeywords) score += 10;
  
  return Math.min(score, 100);
}

// Determine content status based on word count
function getContentStatus(wordCount: number): 'excellent' | 'good' | 'thin' | 'missing' {
  if (wordCount >= CONTENT_QUALITY_CRITERIA.excellentWords) return 'excellent';
  if (wordCount >= CONTENT_QUALITY_CRITERIA.minWords) return 'good';
  if (wordCount >= 1) return 'thin';
  return 'missing';
}

// Check if slug belongs to active states
function isActiveStateSlug(slug: string): boolean {
  if (!slug) return false;
  const normalized = slug.toLowerCase().replace(/^\//, '');
  
  // Non-location pages are always valid
  if (normalized.startsWith('clinic/') || normalized.startsWith('dentist/') ||
      normalized.startsWith('services') || normalized.startsWith('blog')) {
    return true;
  }
  
  // Location pages must start with active state
  for (const stateSlug of ACTIVE_STATE_SLUGS) {
    if (normalized === stateSlug || normalized.startsWith(`${stateSlug}/`)) {
      return true;
    }
  }
  
  return false;
}

// Generate issues and recommendations
function analyzeContent(
  content: string | null,
  wordCount: number,
  duplicationScore: number,
  pageType: string
): { issues: string[]; recommendations: string[]; eeatCompliance: boolean } {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let eeatCompliance = true;
  
  // Word count issues
  if (wordCount === 0) {
    issues.push('No content found on page');
    recommendations.push('Generate comprehensive content with 800+ words covering location-specific dental information');
    eeatCompliance = false;
  } else if (wordCount < 300) {
    issues.push(`Very thin content (${wordCount} words)`);
    recommendations.push('Expand content to at least 800 words with detailed, unique information');
    eeatCompliance = false;
  } else if (wordCount < CONTENT_QUALITY_CRITERIA.minWords) {
    issues.push(`Thin content (${wordCount} words) - below 800 word minimum`);
    recommendations.push('Add more detailed sections about local dental services, FAQs, and community-specific information');
    eeatCompliance = false;
  }
  
  // Duplication issues
  if (duplicationScore > 0.8) {
    issues.push(`High content duplication (${Math.round(duplicationScore * 100)}% similar to other pages)`);
    recommendations.push('Regenerate with unique, location-specific content using AI content generation');
    eeatCompliance = false;
  } else if (duplicationScore > CONTENT_QUALITY_CRITERIA.maxDuplicateSimilarity) {
    issues.push(`Moderate content duplication (${Math.round(duplicationScore * 100)}% similarity)`);
    recommendations.push('Add more unique sections specific to this location or service');
  }
  
  // Structure issues
  if (content) {
    const h2Count = (content.match(/<h2|## /gi) || []).length;
    if (h2Count < 3) {
      issues.push('Insufficient heading structure');
      recommendations.push('Add more H2 headings to organize content (aim for 3-6 sections)');
    }
    
    const hasLists = /<ul|<ol|- /i.test(content);
    if (!hasLists && wordCount > 300) {
      recommendations.push('Add bulleted or numbered lists to improve readability');
    }
  }
  
  // Page type specific checks
  if (pageType === 'city' || pageType === 'service_location') {
    if (content && !(/local|nearby|area|community|neighborhood/i.test(content))) {
      issues.push('Missing local/community-focused language');
      recommendations.push('Add neighborhood and community-specific references');
    }
  }
  
  return { issues, recommendations, eeatCompliance };
}

// Use Gemini to analyze content quality deeply
async function analyzeWithAI(
  content: string,
  pageType: string,
  slug: string
): Promise<{ aiScore: number; aiIssues: string[]; aiRecommendations: string[] }> {
  const AIMLAPI_KEY = Deno.env.get('AIMLAPI_KEY');
  
  if (!AIMLAPI_KEY || !content || content.length < 100) {
    return { aiScore: 0, aiIssues: [], aiRecommendations: [] };
  }
  
  try {
    const prompt = `Analyze this dental website content for SEO quality and E-E-A-T compliance.

Page Type: ${pageType}
URL Slug: ${slug}

Content (first 2000 chars):
${content.substring(0, 2000)}

Evaluate and respond in JSON format only:
{
  "quality_score": <0-100 based on uniqueness, helpfulness, expertise>,
  "issues": ["list of specific problems found"],
  "recommendations": ["actionable suggestions to improve"],
  "is_unique": <true/false - does this seem like original content?>,
  "is_helpful": <true/false - would this help a user find a dentist?>
}`;

    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIMLAPI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'You are an SEO expert analyzing dental website content. Respond only in valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('AI analysis failed:', response.status);
      return { aiScore: 0, aiIssues: [], aiRecommendations: [] };
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        aiScore: parsed.quality_score || 0,
        aiIssues: parsed.issues || [],
        aiRecommendations: parsed.recommendations || [],
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }
  
  return { aiScore: 0, aiIssues: [], aiRecommendations: [] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AuditRequest = await req.json();
    const { action, page_type, state_filter, city_filter, limit = 100, offset = 0, page_id } = body;

    switch (action) {
      case 'run_audit': {
        console.log('Starting content audit...', { page_type, state_filter, city_filter, limit });
        
        // Fetch pages to audit
        let query = supabase
          .from('seo_pages')
          .select('id, slug, page_type, content, word_count, meta_title, meta_description, is_duplicate, similarity_score, similar_to_slug')
          .order('created_at', { ascending: false });

        if (page_type && page_type !== 'all') {
          query = query.eq('page_type', page_type);
        }
        
        const { data: pages, error: pagesError } = await query.range(offset, offset + limit - 1);
        
        if (pagesError) throw pagesError;
        
        // Filter to active states only
        const activePages = (pages || []).filter(p => isActiveStateSlug(p.slug));
        
        console.log(`Fetched ${pages?.length} pages, ${activePages.length} in active states`);

        // Apply state/city filters
        let filteredPages = activePages;
        if (state_filter) {
          filteredPages = filteredPages.filter(p => 
            p.slug.toLowerCase().startsWith(state_filter.toLowerCase() + '/')
          );
        }
        if (city_filter) {
          filteredPages = filteredPages.filter(p => 
            p.slug.toLowerCase().includes('/' + city_filter.toLowerCase())
          );
        }

        const results: PageAuditResult[] = [];
        const duplicationMap = new Map<string, { slug: string; content: string }[]>();

        // Group pages by type for duplication checking
        for (const page of filteredPages) {
          const type = page.page_type || 'unknown';
          if (!duplicationMap.has(type)) {
            duplicationMap.set(type, []);
          }
          if (page.content) {
            duplicationMap.get(type)!.push({ slug: page.slug, content: page.content });
          }
        }

        // Audit each page
        for (const page of filteredPages) {
          const wordCount = page.word_count || 0;
          const contentStatus = getContentStatus(wordCount);
          const qualityScore = calculateQualityScore(page.content, wordCount);
          
          // Check for duplicates within same page type
          let maxSimilarity = 0;
          const similarPages: { slug: string; similarity: number }[] = [];
          
          if (page.content && duplicationMap.has(page.page_type || 'unknown')) {
            const candidates = duplicationMap.get(page.page_type || 'unknown')!;
            for (const candidate of candidates) {
              if (candidate.slug === page.slug) continue;
              
              const similarity = calculateSimilarity(page.content, candidate.content);
              if (similarity > CONTENT_QUALITY_CRITERIA.maxDuplicateSimilarity) {
                similarPages.push({ slug: candidate.slug, similarity });
                if (similarity > maxSimilarity) {
                  maxSimilarity = similarity;
                }
              }
            }
          }
          
          // Sort similar pages by similarity
          similarPages.sort((a, b) => b.similarity - a.similarity);
          
          // Analyze content quality
          const { issues, recommendations, eeatCompliance } = analyzeContent(
            page.content,
            wordCount,
            maxSimilarity,
            page.page_type || 'unknown'
          );

          results.push({
            id: page.id,
            slug: page.slug,
            page_type: page.page_type || 'unknown',
            word_count: wordCount,
            content_status: contentStatus,
            duplication_score: maxSimilarity,
            similar_pages: similarPages.slice(0, 5),
            quality_score: qualityScore,
            issues,
            recommendations,
            eeat_compliance: eeatCompliance,
            has_unique_content: maxSimilarity < CONTENT_QUALITY_CRITERIA.maxDuplicateSimilarity,
          });
        }

        // Calculate summary stats
        const summary = {
          total_audited: results.length,
          excellent_content: results.filter(r => r.content_status === 'excellent').length,
          good_content: results.filter(r => r.content_status === 'good').length,
          thin_content: results.filter(r => r.content_status === 'thin').length,
          missing_content: results.filter(r => r.content_status === 'missing').length,
          duplicate_issues: results.filter(r => r.duplication_score > CONTENT_QUALITY_CRITERIA.maxDuplicateSimilarity).length,
          eeat_compliant: results.filter(r => r.eeat_compliance).length,
          avg_quality_score: results.length > 0 
            ? Math.round(results.reduce((sum, r) => sum + r.quality_score, 0) / results.length) 
            : 0,
          avg_word_count: results.length > 0
            ? Math.round(results.reduce((sum, r) => sum + r.word_count, 0) / results.length)
            : 0,
        };

        // Sort by priority: missing > thin > duplicated > good
        results.sort((a, b) => {
          const statusOrder = { missing: 0, thin: 1, good: 2, excellent: 3 };
          if (statusOrder[a.content_status] !== statusOrder[b.content_status]) {
            return statusOrder[a.content_status] - statusOrder[b.content_status];
          }
          return b.duplication_score - a.duplication_score;
        });

        return new Response(JSON.stringify({
          success: true,
          summary,
          results: results.slice(0, 500), // Limit response size
          total_count: results.length,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case 'analyze_page': {
        if (!page_id) {
          return new Response(JSON.stringify({ error: 'page_id required' }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch the specific page
        const { data: page, error: pageError } = await supabase
          .from('seo_pages')
          .select('*')
          .eq('id', page_id)
          .single();
        
        if (pageError || !page) {
          return new Response(JSON.stringify({ error: 'Page not found' }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const wordCount = page.word_count || 0;
        const contentStatus = getContentStatus(wordCount);
        const qualityScore = calculateQualityScore(page.content, wordCount);

        // Find similar pages
        const { data: candidates, error: candidatesError } = await supabase
          .from('seo_pages')
          .select('id, slug, content')
          .eq('page_type', page.page_type)
          .neq('id', page_id)
          .not('content', 'is', null)
          .limit(50);

        let maxSimilarity = 0;
        const similarPages: { slug: string; similarity: number }[] = [];

        if (!candidatesError && candidates && page.content) {
          for (const candidate of candidates) {
            if (!candidate.content) continue;
            const similarity = calculateSimilarity(page.content, candidate.content);
            if (similarity > 0.3) { // Show any meaningful similarity
              similarPages.push({ slug: candidate.slug, similarity });
              if (similarity > maxSimilarity) maxSimilarity = similarity;
            }
          }
          similarPages.sort((a, b) => b.similarity - a.similarity);
        }

        // Deep AI analysis
        const { aiScore, aiIssues, aiRecommendations } = await analyzeWithAI(
          page.content || '',
          page.page_type || 'unknown',
          page.slug
        );

        const { issues, recommendations, eeatCompliance } = analyzeContent(
          page.content,
          wordCount,
          maxSimilarity,
          page.page_type || 'unknown'
        );

        // Merge AI recommendations
        const allIssues = [...new Set([...issues, ...aiIssues])];
        const allRecommendations = [...new Set([...recommendations, ...aiRecommendations])];

        return new Response(JSON.stringify({
          success: true,
          page: {
            id: page.id,
            slug: page.slug,
            page_type: page.page_type,
            word_count: wordCount,
            content_preview: page.content?.substring(0, 500) || null,
            content_status: contentStatus,
            duplication_score: maxSimilarity,
            similar_pages: similarPages.slice(0, 10),
            quality_score: Math.max(qualityScore, aiScore),
            issues: allIssues,
            recommendations: allRecommendations,
            eeat_compliance: eeatCompliance,
            has_unique_content: maxSimilarity < CONTENT_QUALITY_CRITERIA.maxDuplicateSimilarity,
            meta_title: page.meta_title,
            meta_description: page.meta_description,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case 'get_duplication_report': {
        console.log('Generating duplication report...');
        
        // Fetch all pages with content
        const { data: pages, error: pagesError } = await supabase
          .from('seo_pages')
          .select('id, slug, page_type, content, word_count')
          .not('content', 'is', null)
          .order('page_type');

        if (pagesError) throw pagesError;

        // Filter to active states
        const activePages = (pages || []).filter(p => isActiveStateSlug(p.slug));

        // Group by page type
        const pagesByType = new Map<string, typeof activePages>();
        for (const page of activePages) {
          const type = page.page_type || 'unknown';
          if (!pagesByType.has(type)) pagesByType.set(type, []);
          pagesByType.get(type)!.push(page);
        }

        const duplicateGroups: {
          page_type: string;
          primary_slug: string;
          duplicates: { slug: string; similarity: number }[];
        }[] = [];

        // Find duplicates within each type
        for (const [type, typePages] of pagesByType) {
          const processed = new Set<string>();
          
          for (let i = 0; i < typePages.length; i++) {
            if (processed.has(typePages[i].slug)) continue;
            
            const duplicates: { slug: string; similarity: number }[] = [];
            
            for (let j = i + 1; j < typePages.length; j++) {
              if (processed.has(typePages[j].slug)) continue;
              
              const similarity = calculateSimilarity(
                typePages[i].content || '',
                typePages[j].content || ''
              );
              
              if (similarity > CONTENT_QUALITY_CRITERIA.maxDuplicateSimilarity) {
                duplicates.push({
                  slug: typePages[j].slug,
                  similarity,
                });
                processed.add(typePages[j].slug);
              }
            }
            
            if (duplicates.length > 0) {
              duplicateGroups.push({
                page_type: type,
                primary_slug: typePages[i].slug,
                duplicates: duplicates.sort((a, b) => b.similarity - a.similarity),
              });
              processed.add(typePages[i].slug);
            }
          }
        }

        // Summary stats
        const totalDuplicates = duplicateGroups.reduce(
          (sum, g) => sum + g.duplicates.length,
          0
        );

        return new Response(JSON.stringify({
          success: true,
          summary: {
            total_pages: activePages.length,
            duplicate_groups: duplicateGroups.length,
            total_duplicate_pages: totalDuplicates,
            by_type: Object.fromEntries(
              Array.from(pagesByType.entries()).map(([type, pages]) => [
                type,
                {
                  total: pages.length,
                  with_duplicates: duplicateGroups.filter(g => g.page_type === type).length,
                },
              ])
            ),
          },
          groups: duplicateGroups.slice(0, 100),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error('Content Audit Bot error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
