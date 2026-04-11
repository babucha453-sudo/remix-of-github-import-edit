import { useDentistClinic } from '@/hooks/useDentistClinic';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ReputationSuiteNew from '@/components/dentist/ReputationSuiteNew';

/**
 * Wrapper component for the ReputationSuiteNew that injects the dentist's clinic ID.
 * This ensures dentists can ONLY see their own clinic's reputation data.
 * Admins/super_admins bypass the clinic requirement.
 */
export default function DentistReputationHub() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { data: clinic, isLoading, error } = useDentistClinic();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold mb-2">Error Loading Practice</h3>
          <p className="text-muted-foreground mb-4">
            There was an error loading your practice information.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // For admins, skip clinic requirement and render an admin-appropriate view
  if (!clinic && (isAdmin || isSuperAdmin)) {
    return <ReputationSuiteNew />;
  }

  if (!clinic) {
    return (
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="py-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-2xl font-bold mb-3">No Practice Linked</h3>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Your account is not linked to a dental practice yet. Claim your practice profile
            or contact support if you believe this is an error.
          </p>
          <Button asChild className="gap-2">
            <Link to="/claim-profile">Claim Your Practice</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render the new enterprise-grade Reputation Suite
  return <ReputationSuiteNew />;
}
