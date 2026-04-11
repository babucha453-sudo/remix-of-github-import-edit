import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats } from '@/types/database';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch clinic stats
      const [
        { count: totalClinics },
        { count: unclaimedClinics },
        { count: claimedClinics },
        { count: verifiedClinics },
        { count: duplicateClinics },
      ] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'unclaimed'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_duplicate', true),
      ]);

      // Fetch lead stats
      const [
        { count: leadsToday },
        { count: leadsWeek },
        { count: leadsMonth },
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
      ]);

      // Fetch appointment stats
      const [
        { count: pendingAppointments },
        { count: confirmedAppointments },
        { count: noShowAppointments },
      ] = await Promise.all([
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'no_show'),
      ]);

      // Reviews stats - use review_funnel_events as proxy
      const { count: pendingReviews } = await supabase
        .from('review_funnel_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'rating_submitted');

      return {
        clinics: {
          total: totalClinics || 0,
          unclaimed: unclaimedClinics || 0,
          claimed: claimedClinics || 0,
          verified: verifiedClinics || 0,
          duplicates: duplicateClinics || 0,
        },
        leads: {
          today: leadsToday || 0,
          week: leadsWeek || 0,
          month: leadsMonth || 0,
        },
        appointments: {
          pending: pendingAppointments || 0,
          confirmed: confirmedAppointments || 0,
          noShow: noShowAppointments || 0,
        },
        reviews: {
          pending: pendingReviews || 0,
          approved: 0,
          rejected: 0,
        },
        revenue: {
          activeSubscriptions: 0,
          monthlyRevenue: 0,
        },
      };
    },
    refetchInterval: 30000,
  });
}
