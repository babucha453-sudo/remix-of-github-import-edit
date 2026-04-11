import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

interface CheckoutOptions {
  planSlug: string;
  clinicId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export function useStripeCheckout() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ planSlug, clinicId, successUrl, cancelUrl }: CheckoutOptions) => {
      if (!user) {
        throw new Error('You must be logged in to upgrade');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      // Default URLs redirect to admin dashboard with subscription status
      const defaultSuccessUrl = `${window.location.origin}/admin?tab=dashboard&subscription=success`;
      const defaultCancelUrl = `${window.location.origin}/admin?tab=dashboard&subscription=cancelled`;

      const response = await supabase.functions.invoke('create-checkout-session', {
        body: {
          planSlug,
          clinicId,
          successUrl: successUrl || defaultSuccessUrl,
          cancelUrl: cancelUrl || defaultCancelUrl,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create checkout session');
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        // Show loading toast before redirect
        toast.loading('Redirecting to secure checkout...');
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        toast.error('Failed to get checkout URL');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start checkout');
    },
  });
}

export function useManageSubscription() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (clinicId: string) => {
      if (!user) {
        throw new Error('You must be logged in');
      }

      // Create a Stripe billing portal session
      const response = await supabase.functions.invoke('create-portal-session', {
        body: { clinicId },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create portal session');
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to open billing portal');
    },
  });
}
