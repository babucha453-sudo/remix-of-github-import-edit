import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Crown, Zap, Shield, Loader2, ArrowRight, Sparkles, Rocket, Percent } from 'lucide-react';
import { useSubscriptionPlans, useClinicSubscription, getPlanTier } from '@/hooks/useClinicFeatures';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getDiscountedPrice } from './PromotionBanner';

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
  featureName?: string;
  requiredPlan?: string;
}

// Monthly-only fallback plans matching our new pricing model
const FALLBACK_PLANS = [
  {
    id: 'verified_presence',
    slug: 'verified_presence',
    name: 'Verified Presence',
    price_monthly: 99,
    description: 'Establish trust and control your online presence',
    features: [
      { feature_key: 'verified_badge', is_enabled: true },
      { feature_key: 'claimed_profile', is_enabled: true },
      { feature_key: 'enhanced_profile', is_enabled: true },
      { feature_key: 'review_display', is_enabled: true },
      { feature_key: 'basic_analytics', is_enabled: true },
    ],
  },
  {
    id: 'growth_engine',
    slug: 'growth_engine',
    name: 'Growth Engine',
    price_monthly: 299,
    description: 'Drive patient demand and visibility',
    popular: true,
    features: [
      { feature_key: 'reputation_suite', is_enabled: true },
      { feature_key: 'review_funnels', is_enabled: true },
      { feature_key: 'lead_intelligence', is_enabled: true },
      { feature_key: 'seo_optimization', is_enabled: true },
      { feature_key: 'ai_reply_drafts', is_enabled: true },
    ],
  },
  {
    id: 'autopilot_growth',
    slug: 'autopilot_growth',
    name: 'Autopilot Growth',
    price_monthly: 499,
    description: 'Hands-off growth infrastructure',
    features: [
      { feature_key: 'dental_website', is_enabled: true },
      { feature_key: 'gmb_optimization', is_enabled: true },
      { feature_key: 'ai_blog_drafts', is_enabled: true },
      { feature_key: 'dedicated_support', is_enabled: true },
      { feature_key: 'priority_ranking', is_enabled: true },
    ],
  },
];

const FEATURE_NAMES: Record<string, string> = {
  // Verified Presence
  verified_badge: 'Verified Badge',
  claimed_profile: 'Claimed Profile',
  enhanced_profile: 'Enhanced Profile',
  review_display: 'Public Reviews Display',
  basic_analytics: 'Basic Analytics',
  // Growth Engine
  reputation_suite: 'Full Reputation Suite',
  review_funnels: 'Review Collection Funnels',
  lead_intelligence: 'Lead Intelligence Dashboard',
  seo_optimization: 'SEO Optimization',
  ai_reply_drafts: 'AI Reply Drafts',
  // Autopilot Growth
  dental_website: 'Custom Dental Website',
  gmb_optimization: 'GMB Optimization',
  ai_blog_drafts: 'AI Blog Drafts',
  dedicated_support: 'Dedicated Support',
  priority_ranking: 'Priority Search Ranking',
  // Legacy keys
  profile_listing: 'Profile Listing',
  appointment_booking: 'Appointment Booking',
  email_support: 'Email Support',
  priority_listing: 'Priority Search Ranking',
  reputation_management: 'Reputation Management',
  sms_reminders: 'SMS Reminders',
  gmb_sync: 'Google Business Sync',
  unlimited_listings: 'Unlimited Listings',
  dedicated_manager: 'Dedicated Account Manager',
  api_access: 'API Access',
  custom_branding: 'Custom Branding',
  phone_support: '24/7 Phone Support',
};

export function PlanSelectionModal({
  open,
  onOpenChange,
  clinicId,
  featureName,
  requiredPlan,
}: PlanSelectionModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: plansFromDB, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: currentSubscription } = useClinicSubscription(clinicId);
  const checkout = useStripeCheckout();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Filter to only show paid plans (exclude free)
  const plans = (plansFromDB?.filter((p: any) => p.slug !== 'free' && p.is_active) || []).length > 0
    ? plansFromDB.filter((p: any) => p.slug !== 'free' && p.is_active)
    : FALLBACK_PLANS;
  
  const currentPlanSlug = currentSubscription?.plan?.slug || 'free';

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'autopilot_growth': return Rocket;
      case 'growth_engine': return Zap;
      case 'verified_presence': return Shield;
      default: return Shield;
    }
  };

  const handleSelectPlan = (planSlug: string) => {
    if (!user) {
      navigate('/auth?redirect=/pricing');
      onOpenChange(false);
      return;
    }

    if (!clinicId) {
      navigate('/list-your-practice');
      onOpenChange(false);
      return;
    }

    setSelectedPlan(planSlug);
    checkout.mutate(
      {
        planSlug,
        clinicId,
        successUrl: `${window.location.origin}/dashboard?tab=my-dashboard&subscription=success`,
        cancelUrl: `${window.location.origin}/dashboard?tab=my-dashboard&subscription=cancelled`,
      },
      {
        onSettled: () => setSelectedPlan(null),
        onError: () => setSelectedPlan(null),
      }
    );
  };

  const canSelectPlan = (planSlug: string) => {
    const targetTier = getPlanTier(planSlug);
    const currentTier = getPlanTier(currentPlanSlug);
    // Allow upgrade (higher tier) - always show button
    // Current plan - show "Current Plan" disabled
    // Downgrade - could allow in future, but for now disable
    return targetTier > currentTier;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-teal flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <DialogTitle className="text-2xl font-display">
            {featureName ? `Upgrade to access ${featureName}` : 'Choose Your Growth Plan'}
          </DialogTitle>
          <DialogDescription className="text-base">
            Monthly plans designed for dental practice growth. Cancel anytime.
          </DialogDescription>
          {/* Promotion Banner */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 mx-auto">
            <Percent className="h-4 w-4 text-red-500" />
            <span className="text-sm font-bold text-red-600">
              🎉 50% OFF All Plans - Limited Time!
            </span>
          </div>
        </DialogHeader>

        {plansLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            {plans.map((plan: any) => {
              const PlanIcon = getPlanIcon(plan.slug || plan.id);
              const isPopular = plan.popular || plan.slug === 'growth_engine';
              const isCurrentPlan = currentPlanSlug === (plan.slug || plan.id);
              const canUpgrade = canSelectPlan(plan.slug || plan.id);
              const isRecommended = requiredPlan === (plan.slug || plan.id);
              const isDowngrade = getPlanTier(plan.slug || plan.id) < getPlanTier(currentPlanSlug);
              const isCheckingOut = selectedPlan === (plan.slug || plan.id);
              const price = plan.price_monthly || plan.price_aed || 0;

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    'relative transition-all hover:shadow-lg cursor-pointer',
                    isPopular && 'border-primary ring-2 ring-primary/20',
                    isRecommended && 'border-teal ring-2 ring-teal/30',
                    isCurrentPlan && 'border-teal bg-teal/5'
                  )}
                >
                  {isPopular && !isRecommended && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 shadow">
                        <Star className="h-3 w-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  {isRecommended && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-teal text-white px-3 shadow">
                        Recommended
                      </Badge>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="outline" className="bg-background border-teal text-teal px-3">
                        Current Plan
                      </Badge>
                    </div>
                  )}

                  <CardContent className="pt-8 pb-6">
                    <div className="text-center mb-4">
                      <div className={cn(
                        'mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-3',
                        isPopular ? 'bg-primary/10' : 'bg-muted'
                      )}>
                        <PlanIcon className={cn(
                          'h-6 w-6',
                          isPopular ? 'text-primary' : 'text-muted-foreground'
                        )} />
                      </div>
                      <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                      <div className="mt-2">
                        {/* 50% OFF Pricing */}
                        <div className="flex items-baseline gap-1 justify-center">
                          <span className="text-3xl font-bold text-red-600">${getDiscountedPrice(price).discounted}</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                        <div className="flex items-center gap-2 justify-center mt-1">
                          <span className="text-sm text-muted-foreground line-through">${price}</span>
                          <Badge className="bg-red-500 text-white border-0 text-xs">50% OFF</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {(plan.features || []).slice(0, 5).map((f: any) => (
                        f.is_enabled && (
                          <li key={f.feature_key} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-teal flex-shrink-0" />
                            <span>{FEATURE_NAMES[f.feature_key] || f.feature_key.replace(/_/g, ' ')}</span>
                          </li>
                        )
                      ))}
                    </ul>

                    <Button
                      className={cn(
                        'w-full gap-2',
                        canUpgrade && (isPopular || isRecommended)
                          ? 'bg-gradient-to-r from-primary to-primary/80'
                          : ''
                      )}
                      variant={canUpgrade && (isPopular || isRecommended) ? 'default' : 'outline'}
                      disabled={isCurrentPlan || isDowngrade || isCheckingOut || checkout.isPending}
                      onClick={() => handleSelectPlan(plan.slug || plan.id)}
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : isCurrentPlan ? (
                        'Current Plan'
                      ) : isDowngrade ? (
                        'Contact Support'
                      ) : (
                        <>
                          Upgrade Now
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Need help choosing?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => { onOpenChange(false); navigate('/pricing'); }}>
              View full comparison
            </Button>
          </p>
          <p className="text-xs text-muted-foreground">
            Secure payment powered by Stripe • Cancel anytime • No long-term contracts
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PlanSelectionModal;
