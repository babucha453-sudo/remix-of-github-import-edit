import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClaimStatus, VerificationStatus, ClinicSource } from '@/types/database';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city_id: string | null;
  area_id: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  claim_status: string | null;
  verification_status: string | null;
  source: string | null;
  duplicate_group_id: string | null;
  is_duplicate: boolean | null;
  is_active: boolean | null;
  gmb_data: Record<string, unknown> | null;
  rating: number | null;
  review_count: number | null;
  created_at: string;
  updated_at: string;
  city?: { id: string; name: string; slug: string } | null;
  area?: { id: string; name: string; slug: string } | null;
}

interface ClinicsFilters {
  cityId?: string;
  areaId?: string;
  claimStatus?: ClaimStatus;
  verificationStatus?: VerificationStatus;
  source?: ClinicSource;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useClinics(filters: ClinicsFilters = {}) {
  return useQuery({
    queryKey: ['clinics', filters],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          *,
          city:cities(*),
          area:areas(*)
        `)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.cityId) {
        query = query.eq('city_id', filters.cityId);
      }
      if (filters.areaId) {
        query = query.eq('area_id', filters.areaId);
      }
      if (filters.claimStatus) {
        query = query.eq('claim_status', filters.claimStatus);
      }
      if (filters.verificationStatus) {
        query = query.eq('verification_status', filters.verificationStatus);
      }
      if (filters.source) {
        query = query.eq('source', filters.source);
      }
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as unknown as Clinic[];
    },
  });
}

export function useClinic(id: string) {
  return useQuery({
    queryKey: ['clinic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select(`
          *,
          city:cities(*),
          area:areas(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as unknown as Clinic;
    },
    enabled: !!id,
  });
}

export function useUpdateClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data: oldData } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('clinics')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await createAuditLog({
        action: 'UPDATE',
        entityType: 'clinic',
        entityId: id,
        oldValues: oldData,
        newValues: updates,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinics'] });
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
      toast.success('Clinic updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update clinic: ' + error.message);
    },
  });
}

export function useMarkClinicDuplicate() {
  const updateClinic = useUpdateClinic();

  return useMutation({
    mutationFn: async ({ id, duplicateGroupId }: { id: string; duplicateGroupId: string | null }) => {
      return updateClinic.mutateAsync({
        id,
        updates: {
          is_duplicate: !!duplicateGroupId,
          duplicate_group_id: duplicateGroupId,
        },
      });
    },
  });
}
