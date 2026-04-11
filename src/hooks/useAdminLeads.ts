import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface AdminLead {
  id: string;
  clinic_id: string | null;
  dentist_id: string | null;
  treatment_id: string | null;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string;
  message: string | null;
  source: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  contacted_at: string | null;
  clinic?: { id: string; name: string };
  treatment?: { id: string; name: string };
}

interface LeadsFilters {
  status?: string;
  clinicId?: string;
  source?: string;
}

export function useAdminLeads(filters: LeadsFilters = {}) {
  return useQuery({
    queryKey: ['admin-leads', filters],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*, clinic:clinics(id, name), treatment:treatments(id, name)')
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.clinicId) query = query.eq('clinic_id', filters.clinicId);
      if (filters.source) query = query.eq('source', filters.source);

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data || []) as unknown as AdminLead[];
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdminLead> }) => {
      const { data: old } = await supabase.from('leads').select('*').eq('id', id).single();
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.status === 'contacted') updateData.contacted_at = new Date().toISOString();

      const { error } = await supabase.from('leads').update(updateData).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'lead', entityId: id, oldValues: old, newValues: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Lead updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
