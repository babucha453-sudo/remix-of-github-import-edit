import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RealCounts {
  clinics: number;
  states: number;
  cities: number;
  dentists: number;
  treatments: number;
}

export function useRealCounts() {
  return useQuery({
    queryKey: ['real-counts'],
    queryFn: async (): Promise<RealCounts> => {
      // First get active state IDs
      const { data: activeStates } = await supabase
        .from('states')
        .select('id')
        .eq('is_active', true);
      
      const activeStateIds = (activeStates || []).map(s => s.id);
      
      // Count cities only in active states
      let citiesCount = 0;
      if (activeStateIds.length > 0) {
        const { count } = await supabase
          .from('cities')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .in('state_id', activeStateIds);
        citiesCount = count || 0;
      }
      
      // Get clinic IDs in active cities within active states
      let clinicCount = 0;
      let dentistCount = 0;
      if (activeStateIds.length > 0) {
        const { data: activeCities } = await supabase
          .from('cities')
          .select('id')
          .eq('is_active', true)
          .in('state_id', activeStateIds);
        
        const activeCityIds = (activeCities || []).map(c => c.id);
        
        if (activeCityIds.length > 0) {
          const { count: cCount } = await supabase
            .from('clinics')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .in('city_id', activeCityIds);
          clinicCount = cCount || 0;
        }
        
        // Count dentists in active clinics
        const { count: dCount } = await supabase
          .from('dentists')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        dentistCount = dCount || 0;
      }
      
      const [
        { count: treatmentsCount },
      ] = await Promise.all([
        supabase.from('treatments').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      return {
        clinics: clinicCount,
        states: activeStateIds.length,
        cities: citiesCount,
        dentists: dentistCount,
        treatments: treatmentsCount || 0,
      };
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - reduce unnecessary refetches
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}

// Hook to get clinic count for a specific state
export function useStateClinicCount(stateId?: string) {
  return useQuery({
    queryKey: ['state-clinic-count', stateId],
    queryFn: async () => {
      if (!stateId) return 0;
      
      // Get cities in state, then clinics in those cities
      const { data: cities } = await supabase
        .from('cities')
        .select('id')
        .eq('state_id', stateId)
        .eq('is_active', true);
      
      if (!cities || cities.length === 0) return 0;
      
      const cityIds = cities.map(c => c.id);
      const { count } = await supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true })
        .in('city_id', cityIds)
        .eq('is_active', true);
      
      return count || 0;
    },
    enabled: !!stateId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to get clinic count for a specific service/treatment
export function useTreatmentClinicCount(treatmentId?: string) {
  return useQuery({
    queryKey: ['treatment-clinic-count', treatmentId],
    queryFn: async () => {
      if (!treatmentId) return 0;
      
      const { count } = await supabase
        .from('clinic_treatments')
        .select('clinic_id', { count: 'exact', head: true })
        .eq('treatment_id', treatmentId);
      
      return count || 0;
    },
    enabled: !!treatmentId,
    staleTime: 5 * 60 * 1000,
  });
}
