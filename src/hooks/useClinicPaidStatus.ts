import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ClinicPaidStatus {
  isPaid: boolean;
  planSlug: string | null;
  planName: string | null;
  canReceiveBookingEmails: boolean;
}

/**
 * Hook to check if a clinic has a paid subscription
 * Paid = any active subscription (verified_presence, growth_engine, autopilot_growth)
 * Free/Unpaid = no active subscription
 */
export function useClinicPaidStatus(clinicId: string | null | undefined) {
  return useQuery({
    queryKey: ['clinic-paid-status', clinicId],
    queryFn: async (): Promise<ClinicPaidStatus> => {
      if (!clinicId) {
        return { isPaid: false, planSlug: null, planName: null, canReceiveBookingEmails: false };
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
        console.error('Error checking clinic paid status:', error);
        return { isPaid: false, planSlug: null, planName: null, canReceiveBookingEmails: false };
      }

      const isPaid = !!data;
      const planSlug = (data?.plan as any)?.slug || null;
      const planName = (data?.plan as any)?.name || null;

      return {
        isPaid,
        planSlug,
        planName,
        canReceiveBookingEmails: isPaid, // Only paid clinics get booking emails
      };
    },
    enabled: !!clinicId,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Lightweight function to check paid status (for use in edge functions or server-side)
 */
export async function checkClinicPaidStatus(clinicId: string): Promise<boolean> {
  const { data } = await supabase
    .from('clinic_subscriptions')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('status', 'active')
    .maybeSingle();

  return !!data;
}
