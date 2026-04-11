import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

// Extended clinic management hooks for Super Admin control

export function usePauseClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isPaused }: { id: string; isPaused: boolean }) => {
      const { data: oldData } = await supabase.from('clinics').select('*').eq('id', id).single();
      const { error } = await supabase.from('clinics').update({ 
        is_active: !isPaused,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      await createAuditLog({ 
        action: isPaused ? 'PAUSE_CLINIC' : 'UNPAUSE_CLINIC', 
        entityType: 'clinic', 
        entityId: id, 
        oldValues: oldData,
        newValues: { is_active: !isPaused }
      });
    },
    onSuccess: (_, { isPaused }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      toast.success(isPaused ? 'Clinic paused' : 'Clinic reactivated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: oldData } = await supabase.from('clinics').select('*').eq('id', id).single();
      const { error } = await supabase.from('clinics').delete().eq('id', id);
      if (error) throw error;
      await createAuditLog({ 
        action: 'DELETE', 
        entityType: 'clinic', 
        entityId: id, 
        oldValues: oldData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      toast.success('Clinic deleted');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useVerifyClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { data: oldData } = await supabase.from('clinics').select('*').eq('id', id).single();
      const { error } = await supabase.from('clinics').update({ 
        verification_status: verified ? 'verified' : 'unverified',
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      await createAuditLog({ 
        action: verified ? 'VERIFY_CLINIC' : 'UNVERIFY_CLINIC', 
        entityType: 'clinic', 
        entityId: id, 
        oldValues: oldData,
        newValues: { verification_status: verified ? 'verified' : 'unverified' }
      });
    },
    onSuccess: (_, { verified }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      toast.success(verified ? 'Clinic verified' : 'Verification revoked');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useClaimClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string | null }) => {
      const { data: oldData } = await supabase.from('clinics').select('*').eq('id', id).single();
      
      // Update clinic claim status
      const { error } = await supabase.from('clinics').update({ 
        claim_status: userId ? 'claimed' : 'unclaimed',
        claimed_by: userId,
        claimed_at: userId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      
      // If assigning to a user, ensure they have the dentist role
      if (userId) {
        // Check if user already has dentist role
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'dentist')
          .maybeSingle();
        
        // Add dentist role if not exists
        if (!existingRole) {
          await supabase.from('user_roles').insert({
            user_id: userId,
            role: 'dentist'
          });
        }
      }
      
      await createAuditLog({ 
        action: userId ? 'ASSIGN_CLAIM' : 'REVOKE_CLAIM', 
        entityType: 'clinic', 
        entityId: id, 
        oldValues: oldData,
        newValues: { claim_status: userId ? 'claimed' : 'unclaimed', claimed_by: userId }
      });
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(userId ? 'Clinic assigned to user' : 'Claim revoked');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateFeatureLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, featureKey, limit }: { planId: string; featureKey: string; limit: number | null }) => {
      const { error } = await supabase
        .from('plan_features')
        .update({ usage_limit: limit })
        .eq('plan_id', planId)
        .eq('feature_key', featureKey);
      if (error) throw error;
      await createAuditLog({
        action: 'UPDATE_FEATURE_LIMIT',
        entityType: 'plan_feature',
        entityId: `${planId}_${featureKey}`,
        newValues: { limit }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('Feature limit updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
