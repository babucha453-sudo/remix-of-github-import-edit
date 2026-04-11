import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook to get the clinic owned/claimed by the current dentist user
 * This enforces that dentists can ONLY access their own clinic data
 */
export function useDentistClinic() {
  const { user, isDentist, isAdmin, isSuperAdmin } = useAuth();

  return useQuery({
    queryKey: ['dentist-clinic', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get clinic where this user is the owner (claimed_by)
      const { data, error } = await supabase
        .from('clinics')
        .select(`
          *,
          city:cities(id, name, slug, state:states(id, name, slug))
        `)
        .eq('claimed_by', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching dentist clinic:', error);
        throw error;
      }

      return data;
    },
    // Admins don't need to have a clinic linked - they can access admin features
    // Only require clinic for dentist-only users
    enabled: !!user?.id && isDentist && !isAdmin && !isSuperAdmin,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to get appointments ONLY for the dentist's own clinic
 */
export function useDentistAppointments() {
  const { data: clinic } = useDentistClinic();

  return useQuery({
    queryKey: ['dentist-appointments', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          treatment:treatments(id, name),
          dentist:dentists(id, name)
        `)
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });
}

/**
 * Hook to get reviews ONLY for the dentist's own clinic
 */
export function useDentistReviews() {
  const { data: clinic } = useDentistClinic();

  return useQuery({
    queryKey: ['dentist-reviews', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return { internal: [], google: [] };

      const [internalResult, googleResult] = await Promise.all([
        supabase
          .from('internal_reviews')
          .select('*')
          .eq('clinic_id', clinic.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('google_reviews')
          .select('*')
          .eq('clinic_id', clinic.id)
          .order('review_time', { ascending: false }),
      ]);

      return {
        internal: internalResult.data || [],
        google: googleResult.data || [],
      };
    },
    enabled: !!clinic?.id,
  });
}

/**
 * Hook to get team members (dentists) ONLY for the dentist's own clinic
 */
export function useDentistTeam() {
  const { data: clinic } = useDentistClinic();

  return useQuery({
    queryKey: ['dentist-team', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];

      const { data, error } = await supabase
        .from('dentists')
        .select('*')
        .eq('clinic_id', clinic.id)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });
}

/**
 * Hook to get patients ONLY for the dentist's own clinic
 */
export function useDentistPatients() {
  const { data: clinic } = useDentistClinic();

  return useQuery({
    queryKey: ['dentist-patients', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });
}

/**
 * Hook to get messages ONLY for the dentist's own clinic
 */
export function useDentistMessages() {
  const { data: clinic } = useDentistClinic();

  return useQuery({
    queryKey: ['dentist-messages', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];

      const { data, error } = await supabase
        .from('clinic_messages')
        .select(`
          *,
          patient:patients(id, name, phone)
        `)
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });
}

/**
 * Hook to get leads ONLY for the dentist's own clinic
 */
export function useDentistLeads() {
  const { data: clinic } = useDentistClinic();

  return useQuery({
    queryKey: ['dentist-leads', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];

      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          treatment:treatments(id, name)
        `)
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });
}

/**
 * Hook to get clinic stats for the dentist's own clinic only
 */
export function useDentistStats() {
  const { data: clinic } = useDentistClinic();

  return useQuery({
    queryKey: ['dentist-stats', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return null;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        { count: totalAppointments },
        { count: pendingAppointments },
        { count: confirmedAppointments },
        { count: leadsThisMonth },
        { count: reviewsTotal },
        { count: patientsTotal },
      ] = await Promise.all([
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).eq('status', 'pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).eq('status', 'confirmed'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', monthAgo.toISOString()),
        supabase.from('internal_reviews').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
        supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
      ]);

      return {
        appointments: {
          total: totalAppointments || 0,
          pending: pendingAppointments || 0,
          confirmed: confirmedAppointments || 0,
        },
        leads: leadsThisMonth || 0,
        reviews: reviewsTotal || 0,
        patients: patientsTotal || 0,
        rating: clinic.rating || 0,
        reviewCount: clinic.review_count || 0,
      };
    },
    enabled: !!clinic?.id,
    refetchInterval: 60000, // Refresh every minute
  });
}
