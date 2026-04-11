import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ClinicPlan {
  id: string;
  plan_id: string;
  plan: {
    id: string;
    name: string;
    slug: string;
    description: string;
    price_monthly: number;
    price_yearly: number | null;
    billing_period: string;
  };
  status: string;
  expires_at: string | null;
}

export interface FeatureAccess {
  feature_key: string;
  is_enabled: boolean;
  usage_limit: number | null;
}

// Plan tier ordering for comparison (monthly-only model)
const PLAN_ORDER = ['free', 'verified_presence', 'growth_engine', 'autopilot_growth'];

export function getPlanTier(planSlug: string | null | undefined): number {
  if (!planSlug) return 0; // Default to free tier
  const tier = PLAN_ORDER.indexOf(planSlug);
  return tier === -1 ? 0 : tier; // Unknown plans default to free tier
}

export function isPlanHigherOrEqual(currentPlan: string | null | undefined, requiredPlan: string): boolean {
  return getPlanTier(currentPlan) >= getPlanTier(requiredPlan);
}

export function useClinicSubscription(clinicId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['clinic-subscription', clinicId],
    queryFn: async () => {
      if (!clinicId) return null;
      
      const { data, error } = await supabase
        .from('clinic_subscriptions')
        .select(`
          id,
          plan_id,
          status,
          expires_at,
          billing_cycle,
          amount_paid,
          plan:subscription_plans(id, name, slug, description, price_monthly, price_yearly, billing_period)
        `)
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      return data as ClinicPlan | null;
    },
    enabled: !!clinicId && !!user,
  });
}

export function useClinicFeatures(clinicId?: string) {
  const { data: subscription } = useClinicSubscription(clinicId);
  
  return useQuery({
    queryKey: ['clinic-features', subscription?.plan_id],
    queryFn: async () => {
      if (!subscription?.plan_id) {
        // Return free plan features as default
        const { data: freePlan } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('slug', 'free')
          .single();
        
        if (!freePlan) return [];
        
        const { data, error } = await supabase
          .from('plan_features')
          .select('feature_key, is_enabled, usage_limit')
          .eq('plan_id', freePlan.id);
        
        if (error) throw error;
        return data as FeatureAccess[];
      }
      
      const { data, error } = await supabase
        .from('plan_features')
        .select('feature_key, is_enabled, usage_limit')
        .eq('plan_id', subscription.plan_id);
      
      if (error) throw error;
      return data as FeatureAccess[];
    },
    enabled: true,
  });
}

export function useHasFeature(clinicId?: string, featureKey?: string) {
  const { data: features, isLoading } = useClinicFeatures(clinicId);
  const { data: subscription } = useClinicSubscription(clinicId);
  
  if (isLoading || !features || !featureKey) {
    return { hasAccess: false, isLoading, usageLimit: null, currentPlan: null };
  }
  
  const feature = features.find(f => f.feature_key === featureKey);
  return {
    hasAccess: feature?.is_enabled ?? false,
    isLoading: false,
    usageLimit: feature?.usage_limit ?? null,
    currentPlan: subscription?.plan?.slug ?? 'free',
  };
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select(`
          *,
          features:plan_features(feature_key, is_enabled, usage_limit)
        `)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
  });
}

export function useFeatureRegistry() {
  return useQuery({
    queryKey: ['feature-registry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_registry')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
  });
}

// Hook to check if clinic has access to a specific plan tier
export function useRequiresPlan(clinicId?: string, requiredPlan?: string) {
  const { data: subscription, isLoading } = useClinicSubscription(clinicId);
  
  if (isLoading || !requiredPlan) {
    return { hasAccess: false, isLoading, currentPlan: null, requiredPlan };
  }
  
  const currentPlan = subscription?.plan?.slug ?? 'free';
  const hasAccess = isPlanHigherOrEqual(currentPlan, requiredPlan);
  
  return {
    hasAccess,
    isLoading: false,
    currentPlan,
    requiredPlan,
  };
}
