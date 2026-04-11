import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface AdminReview {
  id: string;
  clinic_id: string | null;
  dentist_id: string | null;
  patient_id: string | null;
  patient_name: string;
  patient_email: string | null;
  rating: number | null;
  title: string | null;
  content: string | null;
  initial_sentiment: 'positive' | 'negative' | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  is_verified_patient: boolean;
  is_featured: boolean;
  source: string;
  created_at: string;
  clinic?: { id: string; name: string };
}

// Reviews table doesn't exist yet - return empty for now
export function useAdminReviews(status?: string) {
  return useQuery({
    queryKey: ['admin-reviews', status],
    queryFn: async () => {
      // Reviews table not yet created
      return [] as AdminReview[];
    },
  });
}

export function useApproveReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      // Reviews table not yet created
      console.log('Would approve review:', reviewId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Review approved');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useRejectReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, reason }: { reviewId: string; reason: string }) => {
      // Reviews table not yet created
      console.log('Would reject review:', reviewId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Review rejected');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
