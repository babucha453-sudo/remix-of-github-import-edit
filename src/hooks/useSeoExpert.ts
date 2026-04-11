import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GoogleSeoPolicies {
  lastUpdated: string;
  coreUpdates: string[];
  contentGuidelines: {
    helpful_content: string[];
    eeat: string[];
    onPage: {
      meta_title: { maxLength: number; minLength: number; rules: string[] };
      meta_description: { maxLength: number; minLength: number; rules: string[] };
      h1: { rules: string[] };
      headingStructure: { rules: string[] };
      content: { minWords: number; idealWords: number; rules: string[] };
    };
    technical: { rules: string[] };
  };
}

export interface SeoExpertStats {
  total_pages: number;
  by_type: Record<string, number>;
  issues: {
    no_meta_title: number;
    meta_title_too_long: number;
    meta_title_too_short: number;
    no_meta_description: number;
    meta_desc_too_long: number;
    meta_desc_too_short: number;
    no_h1: number;
    h1_too_long: number;
    no_content: number;
    thin_content: number;
    duplicate_content: number;
  };
  avg_seo_score: number;
  needs_optimization: number;
  optimized: number;
}

export interface PageIssue {
  id: string;
  slug: string;
  page_type: string;
  current_title: string | null;
  current_description: string | null;
  current_h1: string | null;
  word_count: number | null;
  seo_score: number;
  issues: {
    category: string;
    severity: string;
    issue: string;
    current_value?: string;
    recommendation: string;
    google_policy: string;
  }[];
  passed_checks: string[];
}

export interface AuditResult {
  slug: string;
  page_type: string;
  issues: PageIssue['issues'];
  seo_score: number;
  passed_checks: string[];
}

export interface AuditSummary {
  total_pages: number;
  pages_with_issues: number;
  pages_passed: number;
  issues_by_category: Record<string, number>;
  issues_by_severity: Record<string, number>;
  critical_issues: number;
  avg_seo_score: number;
}

export function useSeoExpertPolicies() {
  return useQuery({
    queryKey: ['seo-expert-policies'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: { action: 'get_policies' },
      });
      if (error) throw error;
      return data.policies as GoogleSeoPolicies;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useSeoExpertStats(pageTypes?: string[]) {
  return useQuery({
    queryKey: ['seo-expert-stats', pageTypes],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: { action: 'get_stats', page_types: pageTypes },
      });
      if (error) throw error;
      return {
        stats: data.stats as SeoExpertStats,
        pageTypes: data.page_types as string[],
        latestAudit: data.latest_audit,
        policiesLastUpdated: data.google_policies_last_updated,
      };
    },
  });
}

export function useSeoExpertIssues(options: {
  category?: string;
  pageType?: string;
  stateFilter?: string;
  cityFilter?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['seo-expert-issues', options],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: {
          action: 'get_issues',
          category: options.category,
          page_type: options.pageType,
          state_filter: options.stateFilter,
          city_filter: options.cityFilter,
          severity: options.severity,
          limit: options.limit || 100,
          offset: options.offset || 0,
        },
      });
      if (error) throw error;
      return {
        issues: data.issues as PageIssue[],
        totalCount: data.total_count as number,
        googlePolicy: data.google_policy,
      };
    },
    enabled: !!options.category,
  });
}

export function useSeoExpertFilterOptions() {
  return useQuery({
    queryKey: ['seo-expert-filter-options'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: { action: 'get_filter_options' },
      });
      if (error) throw error;
      return {
        states: data.states as { slug: string; name: string; abbreviation: string }[],
        cities: data.cities as { slug: string; name: string; state_abbr: string }[],
      };
    },
  });
}

export function useRunSeoAudit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (options: {
      pageTypes?: string[];
      stateFilter?: string;
      cityFilter?: string;
      limit?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: {
          action: 'full_audit',
          page_types: options.pageTypes,
          state_filter: options.stateFilter,
          city_filter: options.cityFilter,
          limit: options.limit || 50000,
        },
      });
      if (error) throw error;
      return {
        runId: data.run_id,
        summary: data.summary as AuditSummary,
        results: data.results as AuditResult[],
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seo-expert-stats'] });
      queryClient.invalidateQueries({ queryKey: ['seo-expert-issues'] });
      toast.success(`Audit complete! ${data.summary.pages_with_issues} pages need attention.`);
    },
    onError: (error) => {
      toast.error(`Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}

export function useFixSeoIssues() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (options: {
      pageIds?: string[];
      issueCategory?: string;
      pageType?: string;
      customPrompt?: string;
      limit?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: {
          action: 'fix_issues',
          page_ids: options.pageIds,
          issue_category: options.issueCategory,
          page_type: options.pageType,
          custom_prompt: options.customPrompt,
          limit: options.limit || 10,
        },
      });
      if (error) throw error;
      return {
        fixedCount: data.fixed_count as number,
        failedCount: data.failed_count as number,
        results: data.results as { id: string; slug: string; status: string; changes?: any; error?: string }[],
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seo-expert-stats'] });
      queryClient.invalidateQueries({ queryKey: ['seo-expert-issues'] });
      toast.success(`Fixed ${data.fixedCount} pages. ${data.failedCount} failed.`);
    },
    onError: (error) => {
      toast.error(`Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}
