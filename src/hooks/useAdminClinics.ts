import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface AdminClinic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city_id: string | null;
  area_id: string | null;
  claim_status: string | null;
  verification_status: string | null;
  source: string | null;
  rating: number | null;
  review_count: number | null;
  is_duplicate: boolean | null;
  duplicate_group_id: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  city?: { id: string; name: string; slug: string } | null;
  area?: { id: string; name: string; slug: string } | null;
}

export interface AdminDentist {
  id: string;
  clinic_id: string | null;
  name: string;
  slug: string;
  title: string | null;
  bio: string | null;
  image_url: string | null;
  specializations: string[] | null;
  languages: string[] | null;
  years_experience: number | null;
  is_active: boolean | null;
  rating: number | null;
  review_count: number | null;
  created_at: string;
  updated_at: string;
}

interface ClinicsFilters {
  search?: string;
  cityId?: string;
  areaId?: string;
  claimStatus?: string;
  verificationStatus?: string;
  source?: string;
  isDuplicate?: boolean;
}

export function useAdminClinics(filters: ClinicsFilters = {}) {
  return useQuery({
    queryKey: ['admin-clinics', filters],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select('*, city:cities(id, name, slug), area:areas(id, name, slug)')
        .order('created_at', { ascending: false });

      if (filters.search) query = query.ilike('name', `%${filters.search}%`);
      if (filters.cityId) query = query.eq('city_id', filters.cityId);
      if (filters.areaId) query = query.eq('area_id', filters.areaId);
      if (filters.claimStatus) query = query.eq('claim_status', filters.claimStatus);
      if (filters.verificationStatus) query = query.eq('verification_status', filters.verificationStatus);
      if (filters.source) query = query.eq('source', filters.source);
      if (filters.isDuplicate !== undefined) query = query.eq('is_duplicate', filters.isDuplicate);

      const { data, error } = await query.limit(20000);
      if (error) throw error;
      return (data || []) as unknown as AdminClinic[];
    },
  });
}

export function useAdminClinic(id: string) {
  return useQuery({
    queryKey: ['admin-clinic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*, city:cities(*), area:areas(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as AdminClinic;
    },
    enabled: !!id,
  });
}

export function useUpdateClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdminClinic> }) => {
      const { data: oldData } = await supabase.from('clinics').select('*').eq('id', id).single();
      const { error } = await supabase.from('clinics').update(updates as any).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'clinic', entityId: id, oldValues: oldData as any, newValues: updates as any });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clinic'] });
      toast.success('Clinic updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useAdminDentists(clinicId?: string) {
  return useQuery({
    queryKey: ['admin-dentists', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('dentists')
        .select('*')
        .order('name');
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(20000);
      if (error) throw error;
      return (data || []) as unknown as AdminDentist[];
    },
  });
}

export function useUpdateDentist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdminDentist> }) => {
      const { error } = await supabase.from('dentists').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dentists'] });
      toast.success('Dentist updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useCreateClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clinic: Record<string, unknown>) => {
      const { data, error } = await supabase.from('clinics').insert([clinic as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'clinic', entityId: data.id, newValues: clinic });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      toast.success('Clinic created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useCreateDentist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dentist: Record<string, unknown>) => {
      const { data, error } = await supabase.from('dentists').insert([dentist as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'dentist', entityId: data.id, newValues: dentist });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dentists'] });
      toast.success('Dentist created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
