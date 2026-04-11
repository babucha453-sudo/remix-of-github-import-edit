import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Subscription {
  id: string;
  clinic_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  billing_cycle: string | null;
  amount_paid: number | null;
  starts_at: string | null;
  expires_at: string | null;
  next_billing_date: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  clinic?: { id: string; name: string };
  plan?: { id: string; name: string; slug: string; price_monthly: number };
}

export function useAdminSubscriptions(status?: string) {
  return useQuery({
    queryKey: ['admin-subscriptions', status],
    queryFn: async () => {
      let query = supabase
        .from('clinic_subscriptions')
        .select(`
          *,
          clinic:clinics(id, name),
          plan:subscription_plans(id, name, slug, price_monthly)
        `)
        .order('created_at', { ascending: false });
      
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Subscription[];
    },
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sub: { clinic_id: string; plan_id: string; billing_cycle?: string }) => {
      const { data, error } = await supabase
        .from('clinic_subscriptions')
        .insert({
          clinic_id: sub.clinic_id,
          plan_id: sub.plan_id,
          billing_cycle: sub.billing_cycle || 'monthly',
          status: 'active',
          starts_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success('Subscription created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Subscription> }) => {
      const { error } = await supabase
        .from('clinic_subscriptions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success('Subscription updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('clinic_subscriptions')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success('Subscription cancelled');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
