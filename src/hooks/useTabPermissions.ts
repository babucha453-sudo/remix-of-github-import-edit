import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Available tabs for permission assignment
// Tab keys MUST match the tab IDs used in AdminDashboard.tsx
export const AVAILABLE_TABS = [
  // Overview & Analytics
  { key: 'overview', label: 'Command Center', category: 'Overview' },
  { key: 'weekly', label: 'Weekly Report', category: 'Overview' },
  { key: 'visitor-analytics', label: 'Visitor Analytics', category: 'Overview' },
  
  // Content & SEO
  { key: 'pages', label: 'Page Manager', category: 'Content & SEO' },
  { key: 'blog', label: 'Blog', category: 'Content & SEO' },
  { key: 'static-pages', label: 'Static Pages', category: 'Content & SEO' },
  { key: 'seo-health', label: 'SEO Health Check', category: 'Content & SEO' },
  { key: 'seo', label: 'SEO Management', category: 'Content & SEO' },
  { key: 'seo-expert', label: 'SEO Expert', category: 'Content & SEO' },
  { key: 'seo-bot', label: 'SEO Bot', category: 'Content & SEO' },
  { key: 'seo-copilot', label: 'SEO Copilot', category: 'Content & SEO' },
  { key: 'seo-content-optimizer', label: 'Content Optimizer', category: 'Content & SEO' },
  { key: 'ranking-rules', label: 'Ranking Rules', category: 'Content & SEO' },
  { key: 'pinned-profiles', label: 'Pinned Profiles', category: 'Content & SEO' },
  { key: 'top-dentists', label: 'Top Dentists', category: 'Content & SEO' },
  
  // Users & Clinics
  { key: 'clinics', label: 'Dental Offices', category: 'Users & Clinics' },
  { key: 'clinic-enrichment', label: 'Content Enrichment', category: 'Users & Clinics' },
  { key: 'users', label: 'Users', category: 'Users & Clinics' },
  { key: 'claims', label: 'Claims', category: 'Users & Clinics' },
  { key: 'treatments', label: 'Treatments', category: 'Users & Clinics' },
  { key: 'locations', label: 'Locations', category: 'Users & Clinics' },
  
  // Reputation
  { key: 'review-insights', label: 'Review Insights', category: 'Reputation' },
  { key: 'gmb-connections', label: 'GMB Connections', category: 'Reputation' },
  
  // Marketing
  { key: 'gmb-scraper', label: 'Scraper Bot', category: 'Marketing' },
  { key: 'email-enrichment', label: 'Email Enrichment', category: 'Marketing' },
  { key: 'gmb-bridge', label: 'Google Import', category: 'Marketing' },
  { key: 'outreach', label: 'Outreach Center', category: 'Marketing' },
  { key: 'promotions', label: 'Promotions', category: 'Marketing' },
  
  // Appointments
  { key: 'booking-system', label: 'Booking System', category: 'Appointments' },
  { key: 'appointments', label: 'Appointments', category: 'Appointments' },
  { key: 'leads', label: 'Lead CRM', category: 'Appointments' },
  
  // Integrations
  { key: 'api-control', label: 'API Control', category: 'Integrations' },
  { key: 'crm-numbers', label: 'CRM Numbers', category: 'Integrations' },
  { key: 'messaging-control', label: 'Messaging', category: 'Integrations' },
  
  // System & Admin
  { key: 'marketplace-control', label: 'Marketplace Control', category: 'System' },
  { key: 'system-audit', label: 'System Audit', category: 'System' },
  { key: 'feature-flags', label: 'Feature Flags', category: 'System' },
  { key: 'roles', label: 'Access Control', category: 'System' },
  { key: 'platform-services', label: 'Platform Services', category: 'System' },
  { key: 'plans', label: 'Plans & Features', category: 'System' },
  { key: 'subscriptions', label: 'Revenue', category: 'System' },
  { key: 'ai-controls', label: 'AI Controls', category: 'System' },
  { key: 'automation', label: 'Automation Rules', category: 'System' },
  { key: 'support-admin', label: 'Support Tickets', category: 'System' },
  { key: 'audit', label: 'Audit Logs', category: 'System' },
  { key: 'smoke-test', label: 'URL Smoke Test', category: 'System' },
  { key: 'site-config', label: 'Header / Footer', category: 'System' },
  { key: 'contact-details', label: 'Contact Details', category: 'System' },
  { key: 'tab-visibility', label: 'Tab Visibility', category: 'System' },
  { key: 'settings', label: 'Settings', category: 'System' },
];

export interface TabPermission {
  id: string;
  user_id: string;
  tab_key: string;
  can_access: boolean;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch tab permissions for a user
export function useUserTabPermissions(userId?: string) {
  return useQuery({
    queryKey: ['tab-permissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_tab_permissions')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data as TabPermission[];
    },
    enabled: !!userId,
  });
}

// Save tab permissions for a user
export function useSaveTabPermissions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, tabs }: { userId: string; tabs: string[] }) => {
      // First, delete existing permissions for this user
      const { error: deleteError } = await supabase
        .from('user_tab_permissions')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;
      
      // Insert new permissions
      if (tabs.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const records = tabs.map(tab_key => ({
          user_id: userId,
          tab_key,
          can_access: true,
          granted_by: user?.id || null,
        }));
        
        const { error: insertError } = await supabase
          .from('user_tab_permissions')
          .insert(records);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tab-permissions', variables.userId] });
      toast.success('Tab permissions updated');
    },
    onError: (e: Error) => toast.error('Failed to save: ' + e.message),
  });
}

// Get tabs by category
export function getTabsByCategory() {
  return AVAILABLE_TABS.reduce((acc, tab) => {
    if (!acc[tab.category]) acc[tab.category] = [];
    acc[tab.category].push(tab);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_TABS>);
}
