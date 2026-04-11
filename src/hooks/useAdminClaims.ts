import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface ClaimRequest {
  id: string;
  clinic_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  verification_method: 'email' | 'phone' | 'gmb' | 'document' | null;
  verification_code: string | null;
  verification_sent_at: string | null;
  verification_expires_at: string | null;
  business_email: string | null;
  business_phone: string | null;
  documents: Record<string, unknown> | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  clinic?: { id: string; name: string; slug: string };
  user?: { id: string; email: string; full_name: string };
}

export function useClaimRequests(status?: string) {
  return useQuery({
    queryKey: ['claim-requests', status],
    queryFn: async () => {
      let query = supabase
        .from('claim_requests')
        .select('*, clinic:clinics(id, name, slug)')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return data as ClaimRequest[];
    },
  });
}

export function useApproveClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, clinicId }: { claimId: string; clinicId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: claim } = await supabase.from('claim_requests').select('user_id').eq('id', claimId).single();

      // Update claim request
      const { error: claimError } = await supabase
        .from('claim_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId);
      if (claimError) throw claimError;

      // Update clinic ownership using claimed_by column (not owner_id)
      const { error: clinicError } = await supabase
        .from('clinics')
        .update({
          claim_status: 'claimed',
          claimed_by: claim?.user_id,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', clinicId);
      if (clinicError) throw clinicError;

      // Add dentist role to user
      if (claim?.user_id) {
        await supabase.from('user_roles').upsert([
          { user_id: claim.user_id, role: 'dentist' }
        ], { onConflict: 'user_id,role' });
      }

      await createAuditLog({
        action: 'APPROVE_CLAIM',
        entityType: 'claim_request',
        entityId: claimId,
        metadata: { clinicId, userId: claim?.user_id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      toast.success('Claim approved');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useRejectClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('claim_requests')
        .update({
          status: 'rejected',
          admin_notes: reason,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId);
      if (error) throw error;

      await createAuditLog({
        action: 'REJECT_CLAIM',
        entityType: 'claim_request',
        entityId: claimId,
        metadata: { reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
      toast.success('Claim rejected');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
