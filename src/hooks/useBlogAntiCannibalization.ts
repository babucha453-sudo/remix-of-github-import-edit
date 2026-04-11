import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getContentBody } from '@/lib/blogContent';

export interface BlogTopicCluster {
  id: string;
  cluster_name: string;
  primary_keyword: string;
  related_keywords: string[];
  pillar_page_slug: string | null;
  intent_type: string | null;
  created_at: string;
  updated_at: string;
}

// Simple word-based similarity for blog posts
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

export function useBlogTopicClusters() {
  return useQuery({
    queryKey: ['blog-topic-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_topic_clusters')
        .select('*')
        .order('cluster_name');
      
      if (error) throw error;
      return (data || []) as BlogTopicCluster[];
    },
  });
}

export function useCreateTopicCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cluster: Partial<BlogTopicCluster>) => {
      const { data, error } = await supabase
        .from('blog_topic_clusters')
        .insert([cluster as never])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-topic-clusters'] });
      toast.success('Topic cluster created');
    },
    onError: (e) => toast.error('Failed to create cluster: ' + e.message),
  });
}

export function useUpdateTopicCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BlogTopicCluster> }) => {
      const { error } = await supabase
        .from('blog_topic_clusters')
        .update(updates as never)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-topic-clusters'] });
      toast.success('Topic cluster updated');
    },
    onError: (e) => toast.error('Failed to update cluster: ' + e.message),
  });
}

export function useDeleteTopicCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_topic_clusters')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-topic-clusters'] });
      toast.success('Topic cluster deleted');
    },
    onError: (e) => toast.error('Failed to delete cluster: ' + e.message),
  });
}

// Check for similar blog posts before publishing
export function useCheckBlogSimilarity() {
  return useMutation({
    mutationFn: async ({ title, content, excludeId }: { title: string; content: string; excludeId?: string }) => {
      // Fetch all published blog posts
      let query = supabase
        .from('blog_posts')
        .select('id, slug, title, content, excerpt')
        .eq('status', 'published');
      
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      
      const { data: posts, error } = await query;
      if (error) throw error;
      
      const combinedText = `${title} ${content}`.toLowerCase();
      const similarPosts: Array<{ id: string; slug: string; title: string; similarity: number }> = [];
      
      for (const post of posts || []) {
        const postText = `${post.title} ${getContentBody(post.content)} ${post.excerpt || ''}`.toLowerCase();
        const similarity = calculateTextSimilarity(combinedText, postText);
        
        if (similarity > 0.4) { // 40% similarity threshold
          similarPosts.push({
            id: post.id,
            slug: post.slug,
            title: post.title,
            similarity: Math.round(similarity * 100),
          });
        }
      }
      
      // Sort by similarity descending
      similarPosts.sort((a, b) => b.similarity - a.similarity);
      
      return {
        hasSimilarPosts: similarPosts.length > 0,
        similarPosts: similarPosts.slice(0, 5),
        highestSimilarity: similarPosts[0]?.similarity || 0,
      };
    },
  });
}

// Suggest internal links for a blog post
export function useSuggestInternalLinks() {
  return useMutation({
    mutationFn: async ({ content, category }: { content: string; category?: string }) => {
      // Fetch treatments and cities for internal linking opportunities
      const [treatmentsRes, citiesRes] = await Promise.all([
        supabase.from('treatments').select('slug, name').eq('is_active', true),
        supabase.from('cities').select('slug, name, states(slug)').eq('is_active', true).limit(50),
      ]);
      
      const suggestions: Array<{ text: string; url: string; type: 'treatment' | 'city' }> = [];
      const contentLower = content.toLowerCase();
      
      // Check for treatment mentions
      for (const treatment of treatmentsRes.data || []) {
        if (contentLower.includes(treatment.name.toLowerCase())) {
          suggestions.push({
            text: treatment.name,
            url: `/services/${treatment.slug}`,
            type: 'treatment',
          });
        }
      }
      
      // Check for city mentions
      for (const city of citiesRes.data || []) {
        if (contentLower.includes(city.name.toLowerCase())) {
          const stateData = Array.isArray(city.states) ? city.states[0] : city.states;
          if (stateData?.slug) {
            suggestions.push({
              text: city.name,
              url: `/${stateData.slug}/${city.slug}`,
              type: 'city',
            });
          }
        }
      }
      
      return {
        suggestions: suggestions.slice(0, 10),
        count: suggestions.length,
      };
    },
  });
}

// Auto-assign topic cluster to blog post based on content
export function useAutoAssignCluster() {
  return useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      // Fetch all topic clusters
      const { data: clusters, error } = await supabase
        .from('blog_topic_clusters')
        .select('*');
      
      if (error) throw error;
      if (!clusters?.length) return { cluster: null, confidence: 0 };
      
      const combinedText = `${title} ${content}`.toLowerCase();
      let bestMatch: { cluster: BlogTopicCluster; score: number } | null = null;
      
      for (const cluster of clusters) {
        let score = 0;
        
        // Check primary keyword
        if (combinedText.includes(cluster.primary_keyword.toLowerCase())) {
          score += 5;
        }
        
        // Check related keywords
        for (const keyword of cluster.related_keywords || []) {
          if (combinedText.includes(keyword.toLowerCase())) {
            score += 1;
          }
        }
        
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { cluster, score };
        }
      }
      
      if (bestMatch && bestMatch.score > 0) {
        return {
          cluster: bestMatch.cluster,
          confidence: Math.min(100, bestMatch.score * 15),
        };
      }
      
      return { cluster: null, confidence: 0 };
    },
  });
}
