import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface SeoPage {
  id: string;
  page_type: string;
  slug: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  content: string | null;
  is_thin_content: boolean | null;
  is_duplicate: boolean | null;
  word_count: number | null;
  last_crawled_at: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  is_indexed: boolean | null;
  noindex_reason: string | null;
  similarity_score: number | null;
  similar_to_slug: string | null;
  metadata_hash: string | null;
  last_generated_at: string | null;
  generation_version: number | null;
  created_at: string;
  updated_at: string;
}

interface SeoPagesFilters {
  pageType?: string;
  isThinContent?: boolean;
  isDuplicate?: boolean;
  missingMeta?: boolean;
}

export function useAdminSeoPages(filters: SeoPagesFilters = {}) {
  return useQuery({
    queryKey: ['admin-seo-pages', filters],
    queryFn: async () => {
      let query = supabase
        .from('seo_pages')
        .select('*')
        .order('updated_at', { ascending: false });

      if (filters.pageType) query = query.eq('page_type', filters.pageType);
      if (filters.isThinContent !== undefined) query = query.eq('is_thin_content', filters.isThinContent);
      if (filters.isDuplicate !== undefined) query = query.eq('is_duplicate', filters.isDuplicate);
      if (filters.missingMeta) query = query.is('meta_title', null);

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return (data || []) as SeoPage[];
    },
  });
}

export function useAdminSeoPagesStats() {
  return useQuery({
    queryKey: ['admin-seo-pages-stats'],
    queryFn: async () => {
      const [totalRes, duplicatesRes, thinRes, missingMetaRes, indexedRes] = await Promise.all([
        supabase.from('seo_pages').select('id', { count: 'exact', head: true }),
        supabase.from('seo_pages').select('id', { count: 'exact', head: true }).eq('is_duplicate', true),
        supabase.from('seo_pages').select('id', { count: 'exact', head: true }).eq('is_thin_content', true),
        supabase.from('seo_pages').select('id', { count: 'exact', head: true }).is('meta_title', null),
        supabase.from('seo_pages').select('id', { count: 'exact', head: true }).eq('is_indexed', true),
      ]);

      return {
        total: totalRes.count || 0,
        duplicates: duplicatesRes.count || 0,
        thinContent: thinRes.count || 0,
        missingMeta: missingMetaRes.count || 0,
        indexed: indexedRes.count || 0,
      };
    },
  });
}

export function useCreateSeoPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (page: Record<string, unknown>) => {
      const { data, error } = await supabase.from('seo_pages').insert([page as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'seo_page', entityId: data.id, newValues: page });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages-stats'] });
      toast.success('SEO Page created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateSeoPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SeoPage> }) => {
      const { data: old } = await supabase.from('seo_pages').select('*').eq('id', id).single();
      const { error } = await supabase.from('seo_pages').update(updates as any).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'seo_page', entityId: id, oldValues: old, newValues: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages-stats'] });
      toast.success('SEO Page updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useBulkUpdateSeoPages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; updates: Partial<SeoPage> }>) => {
      for (const { id, updates: pageUpdates } of updates) {
        const { error } = await supabase.from('seo_pages').update(pageUpdates as any).eq('id', id);
        if (error) throw error;
      }
      return updates.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages-stats'] });
      toast.success(`Updated ${count} SEO pages`);
    },
    onError: (e) => toast.error('Bulk update failed: ' + e.message),
  });
}

export function useDeleteSeoPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seo_pages').delete().eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'DELETE', entityType: 'seo_page', entityId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages-stats'] });
      toast.success('SEO Page deleted');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
