import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface AdminStats {
  locations: { countries: number; cities: number; areas: number };
  services: { total: number; parents: number; children: number };
  clinics: { 
    total: number; 
    unclaimed: number; 
    claimed: number; 
    verified: number; 
    duplicates: number; 
    suspended: number;
    active: number;
    paused: number;
    gmbImported: number;
    manual: number;
  };
  dentists: { total: number; active: number; featured: number };
  patients: { total: number };
  leads: { today: number; week: number; month: number; total: number };
  appointments: { pending: number; confirmed: number; completed: number; cancelled: number; noShow: number };
  reviews: { pending: number; approved: number; rejected: number };
  revenue: { activeSubscriptions: number; monthlyRevenue: number; yearlyRevenue: number };
  claims: { pending: number; approved: number; rejected: number };
  alerts: { unresolved: number; critical: number };
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminStats> => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        // Locations
        { count: countriesCount },
        { count: citiesCount },
        { count: areasCount },
        // Services
        { count: totalTreatments },
        // Clinics
        { count: totalClinics },
        { count: unclaimedClinics },
        { count: claimedClinics },
        { count: verifiedClinics },
        { count: duplicateClinics },
        { count: activeClinics },
        { count: pausedClinics },
        { count: gmbImportedClinics },
        { count: manualClinics },
        // Dentists
        { count: totalDentists },
        { count: activeDentists },
        // Patients
        { count: totalPatients },
        // Leads
        { count: leadsToday },
        { count: leadsWeek },
        { count: leadsMonth },
        { count: leadsTotal },
        // Appointments
        { count: pendingAppointments },
        { count: confirmedAppointments },
        { count: completedAppointments },
        { count: cancelledAppointments },
        { count: noShowAppointments },
        // Claims
        { count: pendingClaims },
        { count: approvedClaims },
        { count: rejectedClaims },
        // Alerts
        { count: unresolvedAlerts },
        { count: criticalAlerts },
        // Subscriptions
        { count: activeSubscriptions },
      ] = await Promise.all([
        // Locations
        supabase.from('countries').select('*', { count: 'exact', head: true }),
        supabase.from('cities').select('*', { count: 'exact', head: true }),
        supabase.from('areas').select('*', { count: 'exact', head: true }),
        // Services
        supabase.from('treatments').select('*', { count: 'exact', head: true }),
        // Clinics
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'unclaimed'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_duplicate', true),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_active', false),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('source', 'gmb'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('source', 'manual'),
        // Dentists
        supabase.from('dentists').select('*', { count: 'exact', head: true }),
        supabase.from('dentists').select('*', { count: 'exact', head: true }).eq('is_active', true),
        // Patients
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        // Leads
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        // Appointments
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'no_show'),
        // Claims
        supabase.from('claim_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('claim_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('claim_requests').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        // Alerts
        supabase.from('platform_alerts').select('*', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('platform_alerts').select('*', { count: 'exact', head: true }).eq('severity', 'critical').eq('is_read', false),
        // Subscriptions
        supabase.from('clinic_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      return {
        locations: {
          countries: countriesCount || 0,
          cities: citiesCount || 0,
          areas: areasCount || 0,
        },
        services: {
          total: totalTreatments || 0,
          parents: 0,
          children: 0,
        },
        clinics: {
          total: totalClinics || 0,
          unclaimed: unclaimedClinics || 0,
          claimed: claimedClinics || 0,
          verified: verifiedClinics || 0,
          duplicates: duplicateClinics || 0,
          suspended: 0,
          active: activeClinics || 0,
          paused: pausedClinics || 0,
          gmbImported: gmbImportedClinics || 0,
          manual: manualClinics || 0,
        },
        dentists: {
          total: totalDentists || 0,
          active: activeDentists || 0,
          featured: 0,
        },
        patients: {
          total: totalPatients || 0,
        },
        leads: {
          today: leadsToday || 0,
          week: leadsWeek || 0,
          month: leadsMonth || 0,
          total: leadsTotal || 0,
        },
        appointments: {
          pending: pendingAppointments || 0,
          confirmed: confirmedAppointments || 0,
          completed: completedAppointments || 0,
          cancelled: cancelledAppointments || 0,
          noShow: noShowAppointments || 0,
        },
        reviews: {
          pending: 0,
          approved: 0,
          rejected: 0,
        },
        revenue: {
          activeSubscriptions: activeSubscriptions || 0,
          monthlyRevenue: 0,
          yearlyRevenue: 0,
        },
        claims: {
          pending: pendingClaims || 0,
          approved: approvedClaims || 0,
          rejected: rejectedClaims || 0,
        },
        alerts: {
          unresolved: unresolvedAlerts || 0,
          critical: criticalAlerts || 0,
        },
      };
    },
    staleTime: 60000, // 1 minute
  });
}

export function useCreatePlatformAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alert: { alert_type: string; title: string; message?: string; severity?: string }) => {
      const { error } = await supabase.from('platform_alerts').insert([alert]);
      if (error) throw error;
      await createAuditLog({ action: 'CREATE_ALERT', entityType: 'platform_alert', newValues: alert });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Alert created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useResolvePlatformAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('platform_alerts')
        .update({ is_read: true })
        .eq('id', alertId);
      if (error) throw error;
      await createAuditLog({ action: 'RESOLVE_ALERT', entityType: 'platform_alert', entityId: alertId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-alerts'] });
      toast.success('Alert resolved');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export interface PlatformAlert {
  id: string;
  alert_type: string;
  title: string;
  message: string | null;
  severity: string | null;
  is_read: boolean | null;
  created_at: string;
}

export function usePlatformAlerts() {
  return useQuery({
    queryKey: ['platform-alerts'],
    queryFn: async (): Promise<PlatformAlert[]> => {
      const { data, error } = await supabase
        .from('platform_alerts')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PlatformAlert[];
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('platform_alerts')
        .update({ is_read: true })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Alert resolved');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
