import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TabVisibility {
  adminTabs: Record<string, boolean>;
  dentistTabs: Record<string, boolean>;
}

// Default: all tabs visible
const DEFAULT_VISIBILITY: TabVisibility = {
  adminTabs: {},
  dentistTabs: {},
};

export function useTabVisibility() {
  const { data, isLoading } = useQuery({
    queryKey: ['tab-visibility-settings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('global_settings')
          .select('*')
          .eq('key', 'tab_visibility')
          .maybeSingle();
        if (error) {
          console.warn('Tab visibility settings error:', error);
          return DEFAULT_VISIBILITY;
        }
        return data?.value ? (data.value as unknown as TabVisibility) : DEFAULT_VISIBILITY;
      } catch (err) {
        console.warn('Tab visibility query failed:', err);
        return DEFAULT_VISIBILITY;
      }
    },
    staleTime: 60000,
    gcTime: 300000,
    placeholderData: DEFAULT_VISIBILITY,
  });

  const isTabVisible = (tabId: string, dashboardType: 'admin' | 'dentist'): boolean => {
    // For dentist dashboard, always show all tabs
    if (dashboardType === 'dentist') return true;
    
    if (!data) return true; // Default to visible if no settings

    const visibilityMap = dashboardType === 'admin' ? data.adminTabs : data.dentistTabs;
    
    // If the tab is not in the map, default to visible
    if (visibilityMap[tabId] === undefined) return true;
    
    return visibilityMap[tabId];
  };

  return {
    visibility: data || DEFAULT_VISIBILITY,
    isLoading,
    isTabVisible,
  };
}
