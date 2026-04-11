import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UniquenessRequest {
  action: "check_content" | "find_duplicates" | "hash_content";
  content?: string;
  page_id?: string;
  page_type?: string;
  threshold?: number; // similarity threshold 0-1
}

// Simple hash function for content fingerprinting
function hashContent(content: string): string {
  let hash = 0;
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Extract first N characters for quick comparison
function getContentFingerprint(content: string, length: number = 200): string {
  if (!content) return '';
  return content.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, length);
}

// Simple similarity score based on shared words
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let shared = 0;
  for (const word of words1) {
    if (words2.has(word)) shared++;
  }
  
  return shared / Math.max(words1.size, words2.size);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UniquenessRequest = await req.json();
    const { action, content, page_id, page_type, threshold = 0.8 } = body;

    switch (action) {
      case "hash_content": {
        if (!content) {
          return new Response(JSON.stringify({ error: "content required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const hash = hashContent(content);
        const fingerprint = getContentFingerprint(content);
        const wordCount = content.split(/\s+/).filter(Boolean).length;

        return new Response(JSON.stringify({ 
          hash, 
          fingerprint,
          word_count: wordCount 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_content": {
        if (!content) {
          return new Response(JSON.stringify({ error: "content required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const contentHash = hashContent(content);
        const fingerprint = getContentFingerprint(content);

        // Check for exact hash match
        let query = supabase
          .from('seo_pages')
          .select('id, slug, page_type, metadata_hash, content')
          .eq('metadata_hash', contentHash);
        
        if (page_id) {
          query = query.neq('id', page_id);
        }

        const { data: exactMatches, error: exactError } = await query.limit(5);
        
        if (exactError) throw exactError;

        if (exactMatches && exactMatches.length > 0) {
          return new Response(JSON.stringify({
            is_unique: false,
            duplicate_type: 'exact',
            similarity_score: 1.0,
            similar_pages: exactMatches.map(p => ({
              id: p.id,
              slug: p.slug,
              page_type: p.page_type,
              similarity: 1.0
            }))
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check for similar content using fingerprint
        let similarQuery = supabase
          .from('seo_pages')
          .select('id, slug, page_type, content');
        
        if (page_type) {
          similarQuery = similarQuery.eq('page_type', page_type);
        }
        if (page_id) {
          similarQuery = similarQuery.neq('id', page_id);
        }

        const { data: candidates, error: candidatesError } = await similarQuery
          .not('content', 'is', null)
          .limit(100);
        
        if (candidatesError) throw candidatesError;

        const similarPages: { id: string; slug: string; page_type: string; similarity: number }[] = [];
        
        for (const candidate of candidates || []) {
          if (!candidate.content) continue;
          
          const similarity = calculateSimilarity(content, candidate.content);
          if (similarity >= threshold) {
            similarPages.push({
              id: candidate.id,
              slug: candidate.slug,
              page_type: candidate.page_type,
              similarity
            });
          }
        }

        // Sort by similarity desc
        similarPages.sort((a, b) => b.similarity - a.similarity);

        const isUnique = similarPages.length === 0;
        const maxSimilarity = similarPages.length > 0 ? similarPages[0].similarity : 0;

        return new Response(JSON.stringify({
          is_unique: isUnique,
          duplicate_type: isUnique ? null : 'similar',
          similarity_score: maxSimilarity,
          similar_pages: similarPages.slice(0, 5),
          content_hash: contentHash
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "find_duplicates": {
        // Find all duplicate groups in the database
        const { data: pages, error: pagesError } = await supabase
          .from('seo_pages')
          .select('id, slug, page_type, content, metadata_hash')
          .not('content', 'is', null)
          .order('page_type');
        
        if (pagesError) throw pagesError;

        const duplicates: { 
          page_id: string; 
          slug: string; 
          similar_to_id: string; 
          similar_to_slug: string;
          similarity: number 
        }[] = [];

        // Group pages by type for comparison
        const pagesByType = new Map<string, typeof pages>();
        for (const page of pages || []) {
          const type = page.page_type || 'unknown';
          if (!pagesByType.has(type)) {
            pagesByType.set(type, []);
          }
          pagesByType.get(type)!.push(page);
        }

        // Check within each type for duplicates
        for (const [type, typePages] of pagesByType) {
          for (let i = 0; i < typePages.length; i++) {
            for (let j = i + 1; j < typePages.length; j++) {
              const page1 = typePages[i];
              const page2 = typePages[j];
              
              if (!page1.content || !page2.content) continue;
              
              const similarity = calculateSimilarity(page1.content, page2.content);
              if (similarity >= threshold) {
                duplicates.push({
                  page_id: page1.id,
                  slug: page1.slug,
                  similar_to_id: page2.id,
                  similar_to_slug: page2.slug,
                  similarity
                });
              }
            }
          }
        }

        // Update database with duplicate flags
        for (const dup of duplicates) {
          await supabase
            .from('seo_pages')
            .update({
              is_duplicate: true,
              similarity_score: dup.similarity,
              similar_to_slug: dup.similar_to_slug
            })
            .eq('id', dup.page_id);
        }

        return new Response(JSON.stringify({
          total_checked: pages?.length || 0,
          duplicates_found: duplicates.length,
          duplicates: duplicates.slice(0, 50)
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

  } catch (error) {
    console.error("content-uniqueness-check error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
