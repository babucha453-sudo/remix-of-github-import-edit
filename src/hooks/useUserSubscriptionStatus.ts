import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserSubscriptionStatus {
  hasActiveSubscription: boolean;
  isPaid: boolean;
  planSlug: string | null;
  planName: string | null;
}

export function useUserSubscriptionStatus(clinicId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-subscription-status', clinicId],
    queryFn: async (): Promise<UserSubscriptionStatus> => {
      if (!clinicId) {
        return { hasActiveSubscription: false, isPaid: false, planSlug: null, planName: null };
      }

      const { data, error } = await supabase
        .from('clinic_subscriptions')
        .select(`
          id,
          status,
          plan:subscription_plans(id, name, slug)
        `)
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error checking user subscription status:', error);
        return { hasActiveSubscription: false, isPaid: false, planSlug: null, planName: null };
      }

      const hasActiveSubscription = !!data;
      const planSlug = (data?.plan as any)?.slug || null;
      const planName = (data?.plan as any)?.name || null;
      const isPaid = hasActiveSubscription && planSlug && planSlug !== 'free';

      return {
        hasActiveSubscription,
        isPaid,
        planSlug,
        planName,
      };
    },
    enabled: !!clinicId,
    staleTime: 60000,
  });
}