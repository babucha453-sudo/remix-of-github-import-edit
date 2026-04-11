import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook to determine which admin tabs a user can access based on their role
 * and explicitly assigned tab permissions in user_tab_permissions table.
 * 
 * - super_admin and district_manager: Access ALL tabs (no restrictions)
 * - Other roles (content_team, seo_team, etc.): Only access tabs explicitly granted
 */
export function useUserTabAccess() {
  const { user, roles } = useAuth();
  
  // Super admins and district managers have full access
  const hasFullAccess = roles.includes('super_admin') || roles.includes('district_manager');
  
  // Fetch user-specific tab permissions for non-super-admin users
  const { data: userTabPermissions, isLoading } = useQuery({
    queryKey: ['user-tab-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_tab_permissions')
        .select('tab_key, can_access')
        .eq('user_id', user.id)
        .eq('can_access', true);
      
      if (error) throw error;
      return data?.map(p => p.tab_key) || [];
    },
    enabled: !!user?.id && !hasFullAccess,
    staleTime: 30000, // Cache for 30 seconds
  });
  
  /**
   * Check if user can access a specific tab
   * @param tabId - The tab identifier (e.g., 'blog', 'seo', 'clinics')
   * @returns boolean - Whether user can access the tab
   */
  const canAccessTab = (tabId: string): boolean => {
    // Super admins can access everything
    if (hasFullAccess) return true;
    
    // For other users, check if they have explicit permission
    if (!userTabPermissions || userTabPermissions.length === 0) {
      // No permissions assigned = no access to admin tabs
      return false;
    }
    
    return userTabPermissions.includes(tabId);
  };
  
  /**
   * Get list of all accessible tabs for the current user
   */
  const getAccessibleTabs = (): string[] => {
    if (hasFullAccess) return []; // Empty means "all" for super admins
    return userTabPermissions || [];
  };
  
  return {
    canAccessTab,
    getAccessibleTabs,
    hasFullAccess,
    isLoading,
    permissionCount: userTabPermissions?.length || 0,
  };
}
