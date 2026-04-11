import { Sparkles, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AISearchHintProps {
  className?: string;
  variant?: "inline" | "card" | "banner";
  treatmentName?: string;
  locationName?: string;
  searchPath?: string;
}

export const AISearchHint = ({
  className,
  variant = "card",
  treatmentName = "",
  locationName = "",
  searchPath = "/",
}: AISearchHintProps) => {
  const getMessage = () => {
    if (treatmentName && locationName) {
      return `Looking for affordable ${treatmentName.toLowerCase()} in ${locationName}? Our AI search can help you find options within your budget.`;
    }
    if (treatmentName) {
      return `Not sure if ${treatmentName.toLowerCase()} fits your budget? Try AI search to find affordable options nearby.`;
    }
    if (locationName) {
      return `Find the right dentist in ${locationName} with our AI-powered search. Just describe what you need.`;
    }
    return "Describe what you're looking for — treatment, budget, insurance — and let AI find your perfect match.";
  };

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span>{getMessage()}</span>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={cn(
        "bg-gradient-to-r from-primary/10 via-primary/5 to-emerald/10 border border-primary/20 rounded-2xl p-5",
        className
      )}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-foreground mb-1">Try AI-Powered Search</h4>
            <p className="text-sm text-muted-foreground">{getMessage()}</p>
          </div>
          <Button asChild className="rounded-xl font-bold shrink-0">
            <Link to={searchPath}>
              <Search className="h-4 w-4 mr-2" />
              Search Now
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-foreground mb-1">AI Search Tip</h4>
          <p className="text-sm text-muted-foreground mb-3">{getMessage()}</p>
          <Link
            to={searchPath}
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            Try AI Search
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
