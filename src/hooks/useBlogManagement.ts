import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Blog Categories
export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_active: boolean;
  post_count: number;
  created_at: string;
  updated_at: string;
}

export function useBlogCategories() {
  return useQuery({
    queryKey: ['blog-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BlogCategory[];
    },
  });
}

export function useAllBlogCategories() {
  return useQuery({
    queryKey: ['blog-categories-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as BlogCategory[];
    },
  });
}

export function useCreateBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<BlogCategory>) => {
      const slug = category.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
      const { data, error } = await supabase
        .from('blog_categories')
        .insert([{ ...category, slug } as never])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      queryClient.invalidateQueries({ queryKey: ['blog-categories-all'] });
      toast.success('Category created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BlogCategory> }) => {
      const { error } = await supabase
        .from('blog_categories')
        .update(updates as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      queryClient.invalidateQueries({ queryKey: ['blog-categories-all'] });
      toast.success('Category updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      queryClient.invalidateQueries({ queryKey: ['blog-categories-all'] });
      toast.success('Category deleted');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

// Blog Authors
export interface BlogAuthor {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  post_count: number;
  created_at: string;
  updated_at: string;
}

export function useBlogAuthors() {
  return useQuery({
    queryKey: ['blog-authors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_authors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BlogAuthor[];
    },
  });
}

export function useAllBlogAuthors() {
  return useQuery({
    queryKey: ['blog-authors-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_authors')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as BlogAuthor[];
    },
  });
}

export function useCreateBlogAuthor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (author: Partial<BlogAuthor>) => {
      const { data, error } = await supabase
        .from('blog_authors')
        .insert([author as never])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-authors'] });
      queryClient.invalidateQueries({ queryKey: ['blog-authors-all'] });
      toast.success('Author created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateBlogAuthor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BlogAuthor> }) => {
      const { error } = await supabase
        .from('blog_authors')
        .update(updates as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-authors'] });
      queryClient.invalidateQueries({ queryKey: ['blog-authors-all'] });
      toast.success('Author updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteBlogAuthor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_authors')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-authors'] });
      queryClient.invalidateQueries({ queryKey: ['blog-authors-all'] });
      toast.success('Author deleted');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

// AI Assistant
export function useBlogAIAssistant() {
  return useMutation({
    mutationFn: async ({ action, title, content, excerpt }: { 
      action: 'generate_excerpt' | 'generate_seo' | 'suggest_internal_links' | 'detect_topic_cluster' | 'improve_content' | 'generate_slug' | 'generate_image';
      title?: string;
      content?: string;
      excerpt?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('blog-ai-assistant', {
        body: { action, title, content, excerpt },
      });
      if (error) throw error;
      return data;
    },
  });
}

// Generate Featured Image
export function useGenerateFeaturedImage() {
  return useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const { data, error } = await supabase.functions.invoke('blog-ai-assistant', {
        body: { action: 'generate_image', title },
      });
      if (error) throw error;
      return data;
    },
  });
}

// Utility function to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}
