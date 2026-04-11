import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';
import { createContentObject, getContentBody, BlogContent } from '@/lib/blogContent';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: BlogContent | null;
  featured_image_url: string | null;
  author_id: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[] | null;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  topic_cluster_id: string | null;
}

// Helper to get string content from JSONB for display in forms
export function getPostContentAsString(post: BlogPost | null): string {
  if (!post?.content) return '';
  return getContentBody(post.content);
}

export function useAdminBlogPosts(status?: string) {
  return useQuery({
    queryKey: ['admin-blog-posts', status],
    queryFn: async () => {
      let query = supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as BlogPost[];
    },
  });
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: Record<string, unknown>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Convert content string to JSONB format
      const contentJsonb = post.content 
        ? createContentObject(post.content as string, 'markdown')
        : null;
      
      const { data, error } = await supabase.from('blog_posts').insert([{
        ...post,
        content: contentJsonb,
        author_id: user?.id,
      } as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'blog_post', entityId: data.id, newValues: post });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast.success('Blog post created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data: old } = await supabase.from('blog_posts').select('*').eq('id', id).single();
      
      // Convert content string to JSONB format if provided
      const updateData: Record<string, unknown> = { ...updates };
      if (typeof updates.content === 'string') {
        updateData.content = createContentObject(updates.content, 'markdown');
      }
      
      if (updates.status === 'published' && !old?.published_at) {
        updateData.published_at = new Date().toISOString();
      }
      const { error } = await supabase.from('blog_posts').update(updateData).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'blog_post', entityId: id, oldValues: old, newValues: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast.success('Blog post updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: old } = await supabase.from('blog_posts').select('*').eq('id', id).single();
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'DELETE', entityType: 'blog_post', entityId: id, oldValues: old });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast.success('Blog post deleted');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
