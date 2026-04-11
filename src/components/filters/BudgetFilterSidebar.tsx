import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign, Star, Shield, Sparkles, Filter, ChevronDown, ChevronUp, X, Stethoscope, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface BudgetFilters {
  maxBudget: number | null;
  minRating: number;
  verifiedOnly: boolean;
  selectedServices: string[];
}

interface BudgetFilterSidebarProps {
  filters: BudgetFilters;
  onFiltersChange: (filters: BudgetFilters) => void;
  availableServices?: { id: string; name: string; slug: string }[];
  locationName?: string;
  treatmentName?: string;
  totalResults?: number;
  className?: string;
}

const BUDGET_PRESETS = [
  { label: "Under $100", value: 100, icon: "💵" },
  { label: "Under $500", value: 500, icon: "💰" },
  { label: "Under $1,000", value: 1000, icon: "💎" },
  { label: "Under $2,500", value: 2500, icon: "🏆" },
  { label: "Under $5,000", value: 5000, icon: "⭐" },
  { label: "Any Budget", value: null, icon: "🎯" },
];

const RATING_OPTIONS = [
  { label: "Any", value: 0 },
  { label: "3+ ⭐", value: 3 },
  { label: "4+ ⭐", value: 4 },
  { label: "4.5+ ⭐", value: 4.5 },
];

export function BudgetFilterSidebar({
  filters,
  onFiltersChange,
  availableServices = [],
  locationName,
  treatmentName,
  totalResults = 0,
  className,
}: BudgetFilterSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllServices, setShowAllServices] = useState(false);

  const activeFilterCount = 
    (filters.maxBudget !== null ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0) +
    filters.selectedServices.length;

  const handleBudgetChange = useCallback((value: number | null) => {
    onFiltersChange({ ...filters, maxBudget: value });
  }, [filters, onFiltersChange]);

  const handleRatingChange = useCallback((value: number) => {
    onFiltersChange({ ...filters, minRating: value });
  }, [filters, onFiltersChange]);

  const handleServiceToggle = useCallback((serviceSlug: string) => {
    const newServices = filters.selectedServices.includes(serviceSlug)
      ? filters.selectedServices.filter(s => s !== serviceSlug)
      : [...filters.selectedServices, serviceSlug];
    onFiltersChange({ ...filters, selectedServices: newServices });
  }, [filters, onFiltersChange]);

  const handleVerifiedToggle = useCallback(() => {
    onFiltersChange({ ...filters, verifiedOnly: !filters.verifiedOnly });
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      maxBudget: null,
      minRating: 0,
      verifiedOnly: false,
      selectedServices: [],
    });
  }, [onFiltersChange]);

  const displayedServices = showAllServices ? availableServices : availableServices.slice(0, 6);

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "bg-card border border-border rounded-3xl overflow-hidden shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Smart Filters</h3>
              <p className="text-xs text-muted-foreground">AI-Powered Matching</p>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <Badge className="bg-primary text-primary-foreground text-xs">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        
        {/* Results summary */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>
            <strong className="text-foreground">{totalResults}</strong> clinics
            {locationName && <> in <strong className="text-foreground">{locationName}</strong></>}
            {treatmentName && <> for <strong className="text-primary">{treatmentName}</strong></>}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Budget Filter - Primary Focus */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm text-foreground">Budget Range</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BUDGET_PRESETS.map((preset) => (
              <button
                key={preset.value ?? "any"}
                onClick={() => handleBudgetChange(preset.value)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border",
                  filters.maxBudget === preset.value
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                    : "bg-muted/50 text-foreground border-transparent hover:border-primary/30 hover:bg-muted"
                )}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rating Filter */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-gold fill-gold" />
            <h4 className="font-bold text-sm text-foreground">Minimum Rating</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {RATING_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleRatingChange(option.value)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-bold transition-all border",
                  filters.minRating === option.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-foreground border-transparent hover:border-primary/30"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Verified Only Toggle */}
        <div>
          <button
            onClick={handleVerifiedToggle}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
              filters.verifiedOnly
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/50 border-transparent hover:border-primary/30 text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="font-bold text-sm">Verified Only</span>
            </div>
            <div className={cn(
              "h-5 w-9 rounded-full transition-colors relative",
              filters.verifiedOnly ? "bg-primary" : "bg-muted"
            )}>
              <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                filters.verifiedOnly ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
          </button>
        </div>

        {/* Services Filter */}
        {availableServices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-sm text-foreground">Services</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceToggle(service.slug)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                    filters.selectedServices.includes(service.slug)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-foreground border-transparent hover:border-primary/30"
                  )}
                >
                  {service.name}
                </button>
              ))}
            </div>
            {availableServices.length > 6 && (
              <button
                onClick={() => setShowAllServices(!showAllServices)}
                className="mt-2 text-xs text-primary font-bold flex items-center gap-1 hover:underline"
              >
                {showAllServices ? (
                  <>Show Less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Show All ({availableServices.length}) <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </div>
        )}

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Clear All Filters
          </Button>
        )}
      </div>
    </motion.aside>
  );
}

export function useBudgetFilters(initialFilters?: Partial<BudgetFilters>) {
  const [filters, setFilters] = useState<BudgetFilters>({
    maxBudget: null,
    minRating: 0,
    verifiedOnly: false,
    selectedServices: [],
    ...initialFilters,
  });

  const applyFilters = useCallback(
    <T extends { rating?: number; isVerified?: boolean; price_from?: number; price_to?: number }>(items: T[]): T[] => {
      return items.filter((item) => {
        // Budget filter
        if (filters.maxBudget !== null && item.price_from && item.price_from > filters.maxBudget) {
          return false;
        }
        // Rating filter
        if (filters.minRating > 0 && (item.rating || 0) < filters.minRating) {
          return false;
        }
        // Verified filter
        if (filters.verifiedOnly && !item.isVerified) {
          return false;
        }
        return true;
      });
    },
    [filters]
  );

  return { filters, setFilters, applyFilters };
}
