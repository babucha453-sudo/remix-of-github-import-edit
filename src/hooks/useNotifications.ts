import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface PlatformNotification {
  id: string;
  user_id: string | null;
  role: string | null;
  title: string;
  message: string;
  category: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  action_type: string | null;
  action_url: string | null;
  action_data: Record<string, unknown> | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  expires_at: string | null;
  created_at: string;
}

export type NotificationCategory = 
  | 'appointment'
  | 'review'
  | 'claim'
  | 'payment'
  | 'oauth'
  | 'seo'
  | 'system'
  | 'content'
  | 'general';

// Fetch notifications for current user
export function useNotifications() {
  const { user, roles } = useAuth();
  
  return useQuery({
    queryKey: ['platform-notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('platform_notifications')
        .select('*')
        .or(`user_id.eq.${user.id},and(user_id.is.null,role.in.(${roles.join(',')}))`)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as PlatformNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// Get unread count
export function useUnreadNotificationCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter(n => !n.is_read).length || 0;
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
    },
  });
}

// Mark all as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('platform_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
      toast.success('All notifications marked as read');
    },
  });
}

// Dismiss notification
export function useDismissNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_notifications')
        .update({ is_dismissed: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
    },
  });
}

// Create notification (admin only)
export function useCreateNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notification: {
      user_id?: string;
      role?: string;
      title: string;
      message: string;
      category: NotificationCategory;
      severity: 'info' | 'warning' | 'error' | 'success';
      action_type?: string;
      action_url?: string;
      action_data?: Record<string, string | number | boolean | null>;
      entity_type?: string;
      entity_id?: string;
      expires_at?: string;
    }) => {
      const { error } = await supabase
        .from('platform_notifications')
        .insert([{
          ...notification,
          action_data: notification.action_data ? notification.action_data as unknown as null : null,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
      toast.success('Notification sent');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Subscribe to real-time notifications
export function useNotificationSubscription() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('platform-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'platform_notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
        
        // Show toast for new notifications
        const notification = payload.new as PlatformNotification;
        if (notification.severity === 'error') {
          toast.error(notification.title, { description: notification.message });
        } else if (notification.severity === 'warning') {
          toast.warning(notification.title, { description: notification.message });
        } else if (notification.severity === 'success') {
          toast.success(notification.title, { description: notification.message });
        } else {
          toast.info(notification.title, { description: notification.message });
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}

// Get notifications by category
export function useNotificationsByCategory(category: NotificationCategory) {
  const { data: notifications } = useNotifications();
  return notifications?.filter(n => n.category === category) || [];
}

// Helper to get icon and color for notification
export function getNotificationStyle(notification: PlatformNotification) {
  const severityColors = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  
  const categoryIcons = {
    appointment: 'Calendar',
    review: 'Star',
    claim: 'Shield',
    payment: 'CreditCard',
    oauth: 'Key',
    seo: 'Search',
    system: 'Settings',
    content: 'FileText',
    general: 'Bell',
  };
  
  return {
    color: severityColors[notification.severity] || severityColors.info,
    iconName: categoryIcons[notification.category as NotificationCategory] || 'Bell',
  };
}
