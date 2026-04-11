import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type VerificationType = 'identity' | 'license' | 'insurance' | 'background';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ProviderVerification {
  id: string;
  clinic_id: string | null;
  dentist_id: string | null;
  verification_type: VerificationType;
  status: VerificationStatus;
  submitted_at: string;
  verified_at: string | null;
  verified_by: string | null;
  expires_at: string | null;
  documents: any[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useProviderVerifications(clinicId?: string) {
  return useQuery({
    queryKey: ['provider-verifications', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];

      const { data, error } = await supabase
        .from('provider_verifications')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProviderVerification[];
    },
    enabled: !!clinicId,
  });
}

export function useAllVerifications(status?: VerificationStatus) {
  return useQuery({
    queryKey: ['all-verifications', status],
    queryFn: async () => {
      let query = supabase
        .from('provider_verifications')
        .select(`
          *,
          clinic:clinics(id, name),
          dentist:dentists(id, name)
        `)
        .order('submitted_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clinic_id?: string;
      dentist_id?: string;
      verification_type: VerificationType;
      documents?: any[];
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('provider_verifications')
        .insert({
          clinic_id: data.clinic_id,
          dentist_id: data.dentist_id,
          verification_type: data.verification_type,
          status: 'pending',
          documents: data.documents || [],
          notes: data.notes
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['all-verifications'] });
      toast.success('Verification request submitted');
    },
    onError: (error) => {
      toast.error('Failed to submit: ' + error.message);
    },
  });
}

export function useUpdateVerificationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      notes,
      expiresAt
    }: { 
      id: string; 
      status: VerificationStatus;
      notes?: string;
      expiresAt?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'approved') {
        updateData.verified_at = new Date().toISOString();
        updateData.verified_by = user?.id;
        updateData.expires_at = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('provider_verifications')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // If approved, update clinic verification status
      if (status === 'approved') {
        const { data: verification } = await supabase
          .from('provider_verifications')
          .select('clinic_id, verification_type')
          .eq('id', id)
          .single();

        if (verification?.clinic_id && verification.verification_type === 'identity') {
          await supabase
            .from('clinics')
            .update({ verification_status: 'verified' })
            .eq('id', verification.clinic_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['all-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      toast.success('Verification status updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}

export function useVerificationStats() {
  return useQuery({
    queryKey: ['verification-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_verifications')
        .select('status');

      if (error) throw error;

      const stats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        total: data.length
      };

      data.forEach(v => {
        stats[v.status as keyof typeof stats]++;
      });

      return stats;
    },
  });
}
