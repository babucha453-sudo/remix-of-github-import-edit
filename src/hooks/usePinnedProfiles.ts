import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PinnedClinic {
  id: string;
  position: number;
  featured: boolean;
}

export function usePinnedProfiles(pageType: 'homepage' | 'state' | 'city' | 'service', stateSlug?: string, citySlug?: string, serviceSlug?: string) {
  const getSettingKey = () => {
    if (pageType === 'homepage') return 'pinned_clinics_homepage';
    if (pageType === 'state' && stateSlug) return `pinned_clinics_state_${stateSlug}`;
    if (pageType === 'city' && stateSlug && citySlug) return `pinned_clinics_city_${stateSlug}_${citySlug}`;
    if (pageType === 'service' && serviceSlug) return `pinned_clinics_service_${serviceSlug}`;
    return null;
  };

  const settingKey = getSettingKey();

  return useQuery({
    queryKey: ['pinned-profiles', settingKey],
    queryFn: async () => {
      if (!settingKey) return [];
      
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', settingKey)
        .maybeSingle();
      
      if (!data?.value) return [];
      
      try {
        const pins = typeof data.value === 'string' 
          ? JSON.parse(data.value) 
          : data.value;
        return (Array.isArray(pins) ? pins : []) as PinnedClinic[];
      } catch {
        return [];
      }
    },
    enabled: !!settingKey,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Utility to sort profiles with pinned ones first
export function sortWithPinnedFirst<T extends { id: string }>(
  profiles: T[],
  pinnedIds: PinnedClinic[]
): T[] {
  if (!pinnedIds.length) return profiles;
  
  const pinnedMap = new Map(pinnedIds.map((p, i) => [p.id, i]));
  
  return [...profiles].sort((a, b) => {
    const aPinIndex = pinnedMap.get(a.id);
    const bPinIndex = pinnedMap.get(b.id);
    
    // Both pinned: sort by position
    if (aPinIndex !== undefined && bPinIndex !== undefined) {
      return aPinIndex - bPinIndex;
    }
    // Only a is pinned: a comes first
    if (aPinIndex !== undefined) return -1;
    // Only b is pinned: b comes first
    if (bPinIndex !== undefined) return 1;
    // Neither pinned: maintain original order
    return 0;
  });
}
