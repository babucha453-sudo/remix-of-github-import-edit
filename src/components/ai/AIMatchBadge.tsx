import { Sparkles, Check, MapPin, DollarSign, Shield, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchReason {
  icon: typeof Check;
  text: string;
}

interface AIMatchBadgeProps {
  className?: string;
  variant?: "inline" | "card";
  matchReasons?: MatchReason[];
  clinicName?: string;
  location?: string;
  priceRange?: string;
  insurance?: string[];
  rating?: number;
  isVerified?: boolean;
}

export const AIMatchBadge = ({
  className,
  variant = "card",
  matchReasons: customReasons,
  clinicName = "",
  location = "",
  priceRange = "",
  insurance = [],
  rating = 0,
  isVerified = false,
}: AIMatchBadgeProps) => {
  // Generate match reasons from clinic data if not provided
  const getMatchReasons = (): MatchReason[] => {
    if (customReasons) return customReasons;

    const reasons: MatchReason[] = [];
    
    if (location) {
      reasons.push({ icon: MapPin, text: `Located in ${location}` });
    }
    if (priceRange) {
      reasons.push({ icon: DollarSign, text: `Budget: ${priceRange}` });
    }
    if (insurance.length > 0) {
      reasons.push({ icon: Shield, text: `Accepts ${insurance.slice(0, 2).join(", ")}${insurance.length > 2 ? " +more" : ""}` });
    }
    if (rating >= 4.5) {
      reasons.push({ icon: Star, text: `${rating.toFixed(1)} rating` });
    }
    if (isVerified) {
      reasons.push({ icon: Check, text: "Verified profile" });
    }

    return reasons;
  };

  const matchReasons = getMatchReasons();

  if (variant === "inline") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1",
        className
      )}>
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-xs font-bold text-primary">AI Match</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-gradient-to-br from-primary/5 to-emerald/5 border border-primary/20 rounded-xl p-4",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-wide">Why this is a good match</span>
        </div>
      </div>

      {/* Match Reasons */}
      {matchReasons.length > 0 ? (
        <div className="space-y-2">
          {matchReasons.slice(0, 4).map((reason, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <reason.icon className="h-3 w-3 text-primary" />
              </div>
              <span className="text-foreground">{reason.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This clinic matches common patient preferences for location, services, and quality.
        </p>
      )}

      {/* Transparency Note */}
      <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        Match based on profile data. Pricing set by clinic.
      </p>
    </div>
  );
};
