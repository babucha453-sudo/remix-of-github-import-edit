import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Star,
  TrendingUp,
  Shield,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface ClaimProfileCTAProps {
  clinicId: string;
  clinicName: string;
  variant?: 'inline' | 'banner' | 'sidebar';
}

export function ClaimProfileCTA({
  clinicId,
  clinicName,
  variant = 'inline'
}: ClaimProfileCTAProps) {
  const benefits = [
    { icon: Star, text: "Manage & respond to reviews" },
    { icon: TrendingUp, text: "Boost your search ranking" },
    { icon: Shield, text: "Get verified badge" },
  ];

  if (variant === 'sidebar') {
    return (
      <div className="card-modern p-5 bg-gradient-to-br from-primary/5 via-background to-gold/5 border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Own this clinic?</h3>
            <p className="text-xs text-muted-foreground">Claim your free profile</p>
          </div>
        </div>

        <ul className="space-y-2 mb-4">
          {benefits.map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">{benefit.text}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full rounded-xl font-bold animate-pulse-soft"
          asChild
        >
          <Link to={`/claim-profile?clinic=${encodeURIComponent(clinicName)}`} rel="nofollow">
            Claim This Profile
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-primary/10 via-background to-gold/10 border border-primary/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground mb-1">
              Are you the owner of {clinicName}?
            </h3>
            <p className="text-muted-foreground text-sm">
              Claim your profile to manage reviews, update information, and unlock premium features.
            </p>
          </div>

          <Button
            className="rounded-xl font-bold shrink-0 animate-pulse-soft"
            size="lg"
            asChild
          >
            <Link to={`/claim-profile?clinic=${encodeURIComponent(clinicName)}`} rel="nofollow">
              Claim This Profile
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Default: inline variant
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
            This profile hasn't been claimed yet
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
            Information shown may be outdated. Clinic owners can claim and update this profile for free.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border-amber-300 hover:bg-amber-100 dark:border-amber-700"
            asChild
          >
            <Link to={`/claim-profile?clinic=${encodeURIComponent(clinicName)}`} rel="nofollow">
              Claim Profile
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
