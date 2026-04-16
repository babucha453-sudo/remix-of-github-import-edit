import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PinnedClinic {
  id: string;
  position: number;
  featured: boolean;
}

export function usePinnedProfiles(pageType: 'homepage' | 'state' | 'city' | 'service', stateSlug?: string, citySlug?: string, serviceSlug?: string) {
  const getSettingKeys = (): string[] => {
    const keys: string[] = [];
    
    if (pageType === 'homepage') {
      keys.push('pinned_clinics_homepage');
    }
    if (pageType === 'state' && stateSlug) {
      keys.push(`pinned_clinics_state_${stateSlug}`);
    }
    if (pageType === 'city' && stateSlug && citySlug) {
      keys.push(`pinned_clinics_city_${stateSlug}_${citySlug}`);
      keys.push(`pinned_clinics_${citySlug}`);
    }
    if (pageType === 'service' && serviceSlug) {
      keys.push(`pinned_clinics_service_${serviceSlug}`);
    }
    
    return keys;
  };

  const settingKeys = getSettingKeys();

  return useQuery({
    queryKey: ['pinned-profiles', ...settingKeys],
    queryFn: async () => {
      if (!settingKeys.length) return [];
      
      const { data, error } = await supabase
        .from('global_settings')
        .select('value, key')
        .in('key', settingKeys);
      
      if (error || !data?.length) return [];
      
      const allPins: PinnedClinic[] = [];
      
      for (const row of data) {
        try {
          const pins = typeof row.value === 'string' 
            ? JSON.parse(row.value) 
            : row.value;
          if (Array.isArray(pins)) {
            pins.forEach((id: string, index: number) => {
              allPins.push({ id, position: index, featured: true });
            });
          }
        } catch {}
      }
      
      return allPins;
    },
    enabled: !!settingKeys.length,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTopDentists(cityId?: string) {
  return useQuery({
    queryKey: ['top-dentists', cityId],
    queryFn: async () => {
      if (!cityId) return [];
      
      const { data, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', `top_dentists_${cityId}`)
        .maybeSingle();
      
      if (error || !data?.value) return [];
      
      try {
        const ids = typeof data.value === 'string' 
          ? JSON.parse(data.value) 
          : data.value;
        return Array.isArray(ids) ? ids : [];
      } catch {
        return [];
      }
    },
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
  });
}

// Utility to sort profiles with pinned and top dentists first
export function sortWithPinnedFirst<T extends { id: string }>(
  profiles: T[],
  pinnedClinic: PinnedClinic[],
  topDentistIds: string[] = []
): T[] {
  const pinnedMap = new Map(pinnedClinic.map((p, i) => [p.id, i]));
  const topSet = new Set(topDentistIds);
  
  return [...profiles].sort((a, b) => {
    const aIsTop = topSet.has(a.id);
    const bIsTop = topSet.has(b.id);
    
    if (aIsTop && !bIsTop) return -1;
    if (bIsTop && !aIsTop) return 1;
    
    const aPinIndex = pinnedMap.get(a.id);
    const bPinIndex = pinnedMap.get(b.id);
    
    if (aPinIndex !== undefined && bPinIndex !== undefined) {
      return aPinIndex - bPinIndex;
    }
    if (aPinIndex !== undefined) return -1;
    if (bPinIndex !== undefined) return 1;
    
    return 0;
  });
}
