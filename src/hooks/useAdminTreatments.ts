import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface Treatment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  display_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useAdminTreatments() {
  return useQuery({
    queryKey: ['admin-treatments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatments')
        .select('*')
        .order('display_order')
        .order('name');
      if (error) throw error;
      return (data || []) as Treatment[];
    },
  });
}

export function useCreateTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (treatment: Record<string, unknown>) => {
      const { data, error } = await supabase.from('treatments').insert([treatment as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'treatment', entityId: data.id, newValues: treatment });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-treatments'] });
      toast.success('Treatment created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Treatment> }) => {
      const { data: old } = await supabase.from('treatments').select('*').eq('id', id).single();
      const { error } = await supabase.from('treatments').update(updates as any).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'treatment', entityId: id, oldValues: old, newValues: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-treatments'] });
      toast.success('Treatment updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: old } = await supabase.from('treatments').select('*').eq('id', id).single();
      const { error } = await supabase.from('treatments').delete().eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'DELETE', entityType: 'treatment', entityId: id, oldValues: old });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-treatments'] });
      toast.success('Treatment deleted');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
