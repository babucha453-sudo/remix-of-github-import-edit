import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadQuota {
  id: string;
  clinic_id: string;
  plan_id: string | null;
  quota_limit: number;
  leads_used: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export function useLeadQuota(clinicId?: string) {
  return useQuery({
    queryKey: ['lead-quota', clinicId],
    queryFn: async (): Promise<LeadQuota | null> => {
      if (!clinicId) return null;

      const { data, error } = await supabase
        .from('lead_quotas')
        .select('*')
        .eq('clinic_id', clinicId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as LeadQuota | null;
    },
    enabled: !!clinicId,
  });
}

export function useAllLeadQuotas() {
  return useQuery({
    queryKey: ['all-lead-quotas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_quotas')
        .select(`
          *,
          clinic:clinics(id, name),
          plan:subscription_plans(id, name, slug)
        `)
        .order('leads_used', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateLeadQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clinic_id: string;
      plan_id?: string;
      quota_limit: number;
    }) => {
      const { error } = await supabase
        .from('lead_quotas')
        .insert({
          clinic_id: data.clinic_id,
          plan_id: data.plan_id,
          quota_limit: data.quota_limit,
          leads_used: 0,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-quota'] });
      queryClient.invalidateQueries({ queryKey: ['all-lead-quotas'] });
      toast.success('Lead quota created');
    },
    onError: (error) => {
      toast.error('Failed to create quota: ' + error.message);
    },
  });
}

export function useUpdateLeadQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LeadQuota> }) => {
      const { error } = await supabase
        .from('lead_quotas')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-quota'] });
      queryClient.invalidateQueries({ queryKey: ['all-lead-quotas'] });
      toast.success('Lead quota updated');
    },
    onError: (error) => {
      toast.error('Failed to update quota: ' + error.message);
    },
  });
}

export function useResetLeadQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clinicId: string) => {
      const { error } = await supabase
        .from('lead_quotas')
        .update({
          leads_used: 0,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('clinic_id', clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-quota'] });
      queryClient.invalidateQueries({ queryKey: ['all-lead-quotas'] });
      toast.success('Lead quota reset successfully');
    },
    onError: (error) => {
      toast.error('Failed to reset quota: ' + error.message);
    },
  });
}
