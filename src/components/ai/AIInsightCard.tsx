import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, DollarSign, Shield, MapPin, Stethoscope, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Insight {
  icon: typeof Sparkles;
  label: string;
  value: string;
}

interface AIInsightCardProps {
  className?: string;
  variant?: "city" | "service" | "service-location";
  locationName?: string;
  treatmentName?: string;
  stateSlug?: string;
  citySlug?: string;
  insights?: Insight[];
}

export const AIInsightCard = ({
  className,
  variant = "city",
  locationName = "",
  treatmentName = "",
  stateSlug = "",
  citySlug = "",
  insights: customInsights,
}: AIInsightCardProps) => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real recent searches from the database
  useEffect(() => {
    async function fetchRecentSearches() {
      setLoading(true);
      try {
        const { data: searchLogs } = await supabase
          .from('ai_search_logs')
          .select('original_query')
          .order('created_at', { ascending: false })
          .limit(20);

        if (searchLogs && searchLogs.length > 0) {
          // Get unique queries
          const uniqueQueries = [...new Set(searchLogs.map(log => String(log.original_query)))].slice(0, 4) as string[];
          setRecentSearches(uniqueQueries);
        } else {
          // Fallback to context-aware examples
          setRecentSearches(getContextExamples());
        }
      } catch (error) {
        console.error("Failed to fetch recent searches:", error);
        setRecentSearches(getContextExamples());
      } finally {
        setLoading(false);
      }
    }

    fetchRecentSearches();
  }, [variant, locationName, treatmentName]);

  // Generate context-aware example searches as fallback
  const getContextExamples = (): string[] => {
    if (variant === "city" && locationName) {
      return [
        `Affordable dentist in ${locationName}`,
        `Teeth whitening ${locationName}`,
        `Emergency dental care`,
        `Best implant specialist`,
      ];
    } else if (variant === "service" && treatmentName) {
      return [
        `${treatmentName} cost`,
        `Best ${treatmentName.toLowerCase()} near me`,
        `${treatmentName} financing options`,
        `Affordable ${treatmentName.toLowerCase()}`,
      ];
    } else if (variant === "service-location" && locationName && treatmentName) {
      return [
        `${treatmentName} in ${locationName}`,
        `Affordable ${treatmentName.toLowerCase()}`,
        `Best specialist ${locationName}`,
        `${treatmentName} with insurance`,
      ];
    }
    return [
      "Affordable dentist near me",
      "Emergency dental care",
      "Teeth whitening cost",
      "Best implant specialist",
    ];
  };

  // Default insights based on variant
  const getDefaultInsights = (): Insight[] => {
    switch (variant) {
      case "city":
        return [
          { icon: Stethoscope, label: "Popular", value: "Cleanings, Implants, Invisalign" },
          { icon: DollarSign, label: "Avg. Budget", value: "$150 - $3,500" },
          { icon: Shield, label: "Insurance", value: "Most accept major plans" },
        ];
      case "service":
        return [
          { icon: TrendingUp, label: "Demand", value: "High search volume" },
          { icon: DollarSign, label: "Price Range", value: "$500 - $6,000" },
          { icon: Shield, label: "Coverage", value: "Often covered by insurance" },
        ];
      case "service-location":
        return [
          { icon: MapPin, label: "Area", value: `${locationName} specialists` },
          { icon: DollarSign, label: "Local Range", value: "$400 - $5,000" },
          { icon: TrendingUp, label: "Trending", value: "Growing demand" },
        ];
      default:
        return [];
    }
  };

  const insights = customInsights || getDefaultInsights();

  const getTitle = () => {
    switch (variant) {
      case "city":
        return `What patients look for in ${locationName}`;
      case "service":
        return `${treatmentName} insights`;
      case "service-location":
        return `${treatmentName} trends in ${locationName}`;
      default:
        return "AI Insights";
    }
  };

  const getSubtitle = () => {
    switch (variant) {
      case "city":
        return "Based on recent patient searches";
      case "service":
        return "Common patient considerations";
      case "service-location":
        return "Local market data";
      default:
        return "";
    }
  };

  return (
    <div className={cn(
      "bg-gradient-to-br from-primary/5 via-card to-accent/10 border border-primary/20 rounded-2xl p-6",
      className
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">{getTitle()}</h3>
          <p className="text-sm text-muted-foreground">{getSubtitle()}</p>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <insight.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{insight.label}</span>
              <p className="text-sm font-medium text-foreground truncate">{insight.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Searches - Real Data */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
          <TrendingUp className="h-3 w-3" />
          Recent Patient Searches
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : (
          <ul className="space-y-1">
            {recentSearches.slice(0, 3).map((search, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary">•</span>
                <span className="truncate">"{search}"</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CTA */}
      {variant !== "service-location" && stateSlug && citySlug && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">
            Not sure what treatment fits your budget?
          </p>
          <Link
            to={`/${stateSlug}/${citySlug}`}
            className="text-sm font-bold text-primary hover:underline inline-flex items-center gap-1"
          >
            Try AI Search for personalized results
            <Sparkles className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default AIInsightCard;