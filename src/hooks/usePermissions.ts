import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

// All available permissions organized by category
export const ALL_PERMISSIONS = [
  // Clinics & Dentists
  { id: 'clinics.view', label: 'View Clinics', category: 'Clinics & Dentists' },
  { id: 'clinics.create', label: 'Create Clinics', category: 'Clinics & Dentists' },
  { id: 'clinics.edit', label: 'Edit Clinics', category: 'Clinics & Dentists' },
  { id: 'clinics.delete', label: 'Delete Clinics', category: 'Clinics & Dentists' },
  { id: 'clinics.verify', label: 'Verify Clinics', category: 'Clinics & Dentists' },
  { id: 'clinics.pause', label: 'Pause Clinics', category: 'Clinics & Dentists' },
  { id: 'clinics.claim', label: 'Force Claim/Unclaim', category: 'Clinics & Dentists' },
  
  // Locations
  { id: 'locations.view', label: 'View Locations', category: 'Locations' },
  { id: 'locations.create', label: 'Create Locations', category: 'Locations' },
  { id: 'locations.edit', label: 'Edit Locations', category: 'Locations' },
  { id: 'locations.delete', label: 'Delete Locations', category: 'Locations' },
  
  // Users
  { id: 'users.view', label: 'View Users', category: 'Users' },
  { id: 'users.create', label: 'Create Users', category: 'Users' },
  { id: 'users.edit', label: 'Edit Users', category: 'Users' },
  { id: 'users.roles', label: 'Manage Roles', category: 'Users' },
  { id: 'users.delete', label: 'Delete Users', category: 'Users' },
  
  // Appointments & Leads
  { id: 'appointments.view', label: 'View Appointments', category: 'Operations' },
  { id: 'appointments.manage', label: 'Manage Appointments', category: 'Operations' },
  { id: 'leads.view', label: 'View Leads', category: 'Operations' },
  { id: 'leads.manage', label: 'Manage Leads', category: 'Operations' },
  
  // Content
  { id: 'pages.view', label: 'View Pages', category: 'Content' },
  { id: 'pages.edit', label: 'Edit Pages', category: 'Content' },
  { id: 'blog.manage', label: 'Manage Blog', category: 'Content' },
  { id: 'seo.manage', label: 'Manage SEO', category: 'Content' },
  
  // Revenue
  { id: 'subscriptions.view', label: 'View Subscriptions', category: 'Revenue' },
  { id: 'subscriptions.manage', label: 'Manage Subscriptions', category: 'Revenue' },
  { id: 'plans.manage', label: 'Manage Plans', category: 'Revenue' },
  { id: 'promotions.manage', label: 'Manage Promotions', category: 'Revenue' },
  
  // Messaging
  { id: 'messaging.sms', label: 'Send SMS', category: 'Messaging' },
  { id: 'messaging.whatsapp', label: 'Send WhatsApp', category: 'Messaging' },
  { id: 'messaging.email', label: 'Send Emails', category: 'Messaging' },
  { id: 'messaging.view_logs', label: 'View Message Logs', category: 'Messaging' },
  
  // Reputation
  { id: 'reviews.view', label: 'View Reviews', category: 'Reputation' },
  { id: 'reviews.manage', label: 'Manage Reviews', category: 'Reputation' },
  { id: 'reviews.ai_reply', label: 'AI Reply to Reviews', category: 'Reputation' },
  
  // AI & Automation
  { id: 'ai.view_insights', label: 'View AI Insights', category: 'AI & Automation' },
  { id: 'ai.manage', label: 'Manage AI Settings', category: 'AI & Automation' },
  { id: 'automation.view', label: 'View Automation', category: 'AI & Automation' },
  { id: 'automation.manage', label: 'Manage Automation', category: 'AI & Automation' },
  
  // System
  { id: 'api.manage', label: 'Manage APIs', category: 'System' },
  { id: 'audit.view', label: 'View Audit Logs', category: 'System' },
  { id: 'settings.manage', label: 'Manage Settings', category: 'System' },
  { id: 'support.view', label: 'View Support Tickets', category: 'System' },
  { id: 'support.manage', label: 'Manage Support Tickets', category: 'System' },
];

export interface RolePreset {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionOverride {
  id: string;
  user_id: string;
  permission_key: string;
  is_granted: boolean;
  expires_at: string | null;
  granted_by: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch role presets
export function useRolePresets() {
  return useQuery({
    queryKey: ['role-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_presets')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as RolePreset[];
    },
  });
}

// Create/update role preset
export function useSaveRolePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preset: Partial<RolePreset> & { name: string; permissions: string[] }) => {
      if (preset.id) {
        const { error } = await supabase
          .from('role_presets')
          .update({
            name: preset.name,
            description: preset.description,
            permissions: preset.permissions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', preset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_presets')
          .insert([{
            name: preset.name,
            description: preset.description,
            permissions: preset.permissions,
          }]);
        if (error) throw error;
      }
      await createAuditLog({
        action: preset.id ? 'UPDATE' : 'CREATE',
        entityType: 'role_preset',
        entityId: preset.id || preset.name,
        newValues: preset,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-presets'] });
      toast.success('Role preset saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Delete role preset
export function useDeleteRolePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('role_presets')
        .delete()
        .eq('id', id)
        .eq('is_system', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-presets'] });
      toast.success('Role preset deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Fetch permission overrides for a user
export function usePermissionOverrides(userId?: string) {
  return useQuery({
    queryKey: ['permission-overrides', userId],
    queryFn: async () => {
      let query = supabase
        .from('user_permission_overrides')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PermissionOverride[];
    },
    enabled: !!userId || userId === undefined,
  });
}

// Add/update permission override
export function useSavePermissionOverride() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (override: {
      user_id: string;
      permission_key: string;
      is_granted: boolean;
      expires_at?: string | null;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from('user_permission_overrides')
        .upsert({
          user_id: override.user_id,
          permission_key: override.permission_key,
          is_granted: override.is_granted,
          expires_at: override.expires_at || null,
          reason: override.reason || null,
          granted_by: user?.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,permission_key',
        });
      if (error) throw error;
      
      await createAuditLog({
        action: 'PERMISSION_OVERRIDE',
        entityType: 'user_permission',
        entityId: override.user_id,
        newValues: override,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-overrides'] });
      toast.success('Permission override saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Delete permission override
export function useDeletePermissionOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_permission_overrides')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-overrides'] });
      toast.success('Override removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Hook to check if current user has a permission
export function useHasPermission(permission: string) {
  const { user, roles } = useAuth();
  
  const { data: overrides } = usePermissionOverrides(user?.id);
  const { data: rolePermissions } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'role_permissions')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.value as Record<string, string[]> | null;
    },
  });
  
  // Super admin always has permission
  if (roles.includes('super_admin')) return true;
  
  // Check user-specific override
  const override = overrides?.find(o => 
    o.permission_key === permission &&
    (!o.expires_at || new Date(o.expires_at) > new Date())
  );
  if (override) return override.is_granted;
  
  // Check role permissions
  if (rolePermissions) {
    for (const role of roles) {
      const perms = rolePermissions[role];
      if (perms?.includes('*') || perms?.includes(permission)) {
        return true;
      }
    }
  }
  
  return false;
}

// Get permissions grouped by category
export function getPermissionsByCategory() {
  return ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);
}
