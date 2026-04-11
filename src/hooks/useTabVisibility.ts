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
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'tab_visibility')
        .maybeSingle();
      if (error) throw error;
      return data?.value as unknown as TabVisibility | null;
    },
    staleTime: 60000, // Cache for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  const isTabVisible = (tabId: string, dashboardType: 'admin' | 'dentist'): boolean => {
    if (!data) return true; // Default to visible if no settings

    const visibilityMap = dashboardType === 'admin' ? data.adminTabs : data.dentistTabs;
    
    // If the tab is not in the map, default to visible
    if (visibilityMap[tabId] === undefined) return true;
    
    return visibilityMap[tabId];
  };

  return {
    visibility: data ?? DEFAULT_VISIBILITY,
    isLoading,
    isTabVisible,
  };
}
