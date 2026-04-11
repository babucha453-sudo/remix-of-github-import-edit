import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SeoBotSettings {
  rate_limits?: { requests_per_minute: number; pages_per_batch: number };
  cost_guardrails?: { daily_budget_usd: number; max_pages_per_run: number };
  generation_config?: { title_min_length: number; title_max_length: number; description_min_length: number; description_max_length: number };
  similarity_threshold?: { title: number; description: number; content: number };
  auto_fix_enabled?: boolean;
  excluded_page_types?: string[];
}

export interface SeoAuditRun {
  id: string;
  run_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  total_pages: number;
  processed_pages: number;
  fixed_pages: number;
  skipped_pages: number;
  error_count: number;
  errors: any[];
  summary: Record<string, any>;
  triggered_by: string | null;
  created_at: string;
}

export interface SeoMetadataHistory {
  id: string;
  page_id: string | null;
  slug: string;
  previous_title: string | null;
  previous_meta_description: string | null;
  previous_h1: string | null;
  new_title: string | null;
  new_meta_description: string | null;
  new_h1: string | null;
  change_reason: string | null;
  changed_by: string | null;
  batch_id: string | null;
  created_at: string;
}

export function useSeoBotSettings() {
  return useQuery({
    queryKey: ['seo-bot-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-bot', {
        body: { action: 'get_settings' },
      });
      if (error) throw error;
      return data.settings as SeoBotSettings;
    },
  });
}

export function useUpdateSeoBotSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data, error } = await supabase.functions.invoke('seo-bot', {
        body: { action: 'update_settings', key, value },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-bot-settings'] });
      toast.success('Setting updated');
    },
    onError: (e) => toast.error('Failed to update setting: ' + e.message),
  });
}

export function useSeoAuditRuns() {
  return useQuery({
    queryKey: ['seo-audit-runs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-bot', {
        body: { action: 'get_runs' },
      });
      if (error) throw error;
      return (data.runs || []) as SeoAuditRun[];
    },
  });
}

export function useSeoMetadataHistory(batchId?: string) {
  return useQuery({
    queryKey: ['seo-metadata-history', batchId],
    queryFn: async () => {
      let query = supabase
        .from('seo_metadata_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (batchId) {
        query = query.eq('batch_id', batchId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SeoMetadataHistory[];
    },
    enabled: true,
  });
}

export function useGenerateMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-bot', {
        body: { action: 'generate_metadata' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      queryClient.invalidateQueries({ queryKey: ['seo-audit-runs'] });
      toast.success(`Generated metadata for ${data.processed_pages} pages. ${data.duplicate_titles_found} potential duplicates found.`);
    },
    onError: (e) => toast.error('Failed to generate metadata: ' + e.message),
  });
}

export function useCheckDuplicates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-bot', {
        body: { action: 'check_duplicates' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      toast.success(`Found ${data.exact_duplicates} exact duplicates and ${data.near_duplicates} near-duplicates.`);
    },
    onError: (e) => toast.error('Failed to check duplicates: ' + e.message),
  });
}

export function useRollbackBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, pageSlug }: { batchId?: string; pageSlug?: string }) => {
      const { data, error } = await supabase.functions.invoke('seo-bot', {
        body: { action: 'rollback', batch_id: batchId, page_slug: pageSlug },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      queryClient.invalidateQueries({ queryKey: ['seo-metadata-history'] });
      toast.success(`Rollback info: ${data.records_found} records found.`);
    },
    onError: (e) => toast.error('Failed to rollback: ' + e.message),
  });
}
