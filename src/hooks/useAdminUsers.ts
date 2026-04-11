import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  roles: string[];
  // Extended fields for tracking
  signup_method: 'manual' | 'google' | 'gmb' | 'admin_created' | 'unknown';
  account_status: 'active' | 'pending' | 'suspended';
  verification_status: 'verified' | 'unverified' | 'pending';
  gmb_connected: boolean;
  last_sign_in_at: string | null;
  // Clinic profile link
  clinic_slug: string | null;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Fetch all users via edge function (this returns auth.users data)
      const { data: userData, error: userError } = await supabase.functions.invoke('admin-list-users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (userError) {
        console.error('Failed to fetch users:', userError);
        throw new Error(userError.message || 'Failed to fetch users');
      }

      // Fetch all roles - use service role equivalent by querying all (works for super_admin due to RLS policy)
      // Note: Super admins can read all user_roles via the RLS policy
      let roles: Array<{ user_id: string; role: string; created_at: string }> | null = null;
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .order('created_at', { ascending: false });
      
      if (rolesError) {
        console.error('Failed to fetch roles:', rolesError);
        // Don't throw - continue with empty roles, users will show as 'patient'
      } else {
        roles = rolesData;
      }

      // Fetch all clinics to check GMB connection and get slugs
      const { data: clinics } = await supabase
        .from('clinics')
        .select('claimed_by, google_place_id, verification_status, slug');

      // Build role map
      const roleMap = new Map<string, string[]>();
      for (const r of roles || []) {
        if (!roleMap.has(r.user_id)) {
          roleMap.set(r.user_id, []);
        }
        roleMap.get(r.user_id)!.push(r.role);
      }

      // Build clinic map for GMB status and slug
      const clinicMap = new Map<string, { gmb_connected: boolean; verification_status: string | null; slug: string | null }>();
      for (const c of clinics || []) {
        if (c.claimed_by) {
          clinicMap.set(c.claimed_by, {
            gmb_connected: !!c.google_place_id,
            verification_status: c.verification_status,
            slug: c.slug || null,
          });
        }
      }

      // Transform users
      const users: AdminUser[] = (userData?.users || []).map((u: any) => {
        const userRoles = roleMap.get(u.id) || ['patient'];
        const clinicInfo = clinicMap.get(u.id);
        
        // Determine signup method based on user data
        let signupMethod: AdminUser['signup_method'] = 'unknown';
        const providers = u.app_metadata?.providers || [];
        const provider = u.app_metadata?.provider;
        
        if (providers.includes('google') || provider === 'google') {
          // Check if GMB connected
          signupMethod = clinicInfo?.gmb_connected ? 'gmb' : 'google';
        } else if (u.user_metadata?.created_by_admin) {
          signupMethod = 'admin_created';
        } else if (provider === 'email' || !provider) {
          signupMethod = 'manual';
        }

        // Determine account status
        let accountStatus: AdminUser['account_status'] = 'active';
        if (u.banned_until) {
          accountStatus = 'suspended';
        } else if (!u.email_confirmed_at && !u.confirmed_at) {
          accountStatus = 'pending';
        }

        // Determine verification status
        let verificationStatus: AdminUser['verification_status'] = 'unverified';
        if (clinicInfo?.verification_status === 'verified') {
          verificationStatus = 'verified';
        } else if (clinicInfo?.verification_status === 'pending') {
          verificationStatus = 'pending';
        } else if (u.email_confirmed_at || u.confirmed_at) {
          verificationStatus = 'verified';
        }

        return {
          id: u.id,
          user_id: u.id,
          email: u.email || null,
          full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
          phone: u.phone || null,
          avatar_url: u.user_metadata?.avatar_url || null,
          created_at: u.created_at,
          updated_at: u.updated_at || u.created_at,
          roles: userRoles,
          signup_method: signupMethod,
          account_status: accountStatus,
          verification_status: verificationStatus,
          gmb_connected: clinicInfo?.gmb_connected || false,
          last_sign_in_at: u.last_sign_in_at || null,
          clinic_slug: clinicInfo?.slug || null,
        };
      });

      return users;
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // Delete existing roles
      await supabase.from('user_roles').delete().eq('user_id', userId);
      // Insert new role
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: role as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'activate' | 'suspend' | 'delete' }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('admin-manage-user', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId, action },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
