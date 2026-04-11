import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useClinicSubscription } from '@/hooks/useClinicFeatures';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { PlanSelectionModal } from './PlanSelectionModal';

interface UpgradePromptProps {
  featureName: string;
  featureDescription?: string;
  requiredPlan?: 'professional' | 'enterprise';
  clinicId?: string;
  compact?: boolean;
}

export default function UpgradePrompt({
  featureName,
  featureDescription,
  requiredPlan = 'professional',
  clinicId,
  compact = false,
}: UpgradePromptProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: subscription } = useClinicSubscription(clinicId);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const currentPlanSlug = subscription?.plan?.slug;

  const handleUpgrade = () => {
    if (!user) {
      navigate('/auth?redirect=/pricing');
      return;
    }

    if (!clinicId) {
      navigate('/pricing');
      return;
    }

    // Open plan selection modal
    setShowPlanModal(true);
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-gold/10 border border-primary/20">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{featureName} requires upgrade</p>
            <p className="text-xs text-muted-foreground truncate">
              Upgrade your plan to use this feature
            </p>
          </div>
          <Button size="sm" onClick={handleUpgrade}>
            Upgrade
          </Button>
        </div>

        <PlanSelectionModal
          open={showPlanModal}
          onOpenChange={setShowPlanModal}
          clinicId={clinicId}
          featureName={featureName}
          requiredPlan={requiredPlan}
        />
      </>
    );
  }

  return (
    <>
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-gold/5">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-gold flex items-center justify-center shadow-lg">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-xl">{featureName}</CardTitle>
          {featureDescription && (
            <CardDescription>{featureDescription}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {currentPlanSlug && (
            <div className="text-center">
              <Badge variant="outline" className="mb-2">
                Current Plan: {currentPlanSlug.charAt(0).toUpperCase() + currentPlanSlug.slice(1)}
              </Badge>
            </div>
          )}

          <div className="text-center p-4 rounded-xl bg-muted/50">
            <p className="text-sm text-muted-foreground mb-3">
              Upgrade your plan to unlock {featureName} and many more premium features
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              size="lg" 
              className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80"
              onClick={handleUpgrade}
            >
              <Sparkles className="h-4 w-4" />
              View Plans & Upgrade
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/pricing')}
            >
              Compare all plans
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            30-day money-back guarantee. Cancel anytime.
          </p>
        </CardContent>
      </Card>

      <PlanSelectionModal
        open={showPlanModal}
        onOpenChange={setShowPlanModal}
        clinicId={clinicId}
        featureName={featureName}
        requiredPlan={requiredPlan}
      />
    </>
  );
}