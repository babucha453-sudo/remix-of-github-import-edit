import { useState, useCallback, useMemo } from "react";
import { Filter, Star, DollarSign, Stethoscope, X, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface FilterState {
  minRating: number;
  maxBudget: number | null;
  services: string[];
  verifiedOnly: boolean;
}

interface SearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableServices?: { id: string; name: string; slug: string }[];
  className?: string;
  variant?: "light" | "dark";
}

const BUDGET_OPTIONS = [
  { label: "Any", value: null },
  { label: "Under $500", value: 500 },
  { label: "Under $1,000", value: 1000 },
  { label: "Under $2,500", value: 2500 },
  { label: "Under $5,000", value: 5000 },
];

const RATING_OPTIONS = [
  { label: "Any Rating", value: 0 },
  { label: "3+ Stars", value: 3 },
  { label: "4+ Stars", value: 4 },
  { label: "4.5+ Stars", value: 4.5 },
];

export function SearchFilters({
  filters,
  onFiltersChange,
  availableServices = [],
  className,
  variant = "light",
}: SearchFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minRating > 0) count++;
    if (filters.maxBudget !== null) count++;
    if (filters.services.length > 0) count++;
    if (filters.verifiedOnly) count++;
    return count;
  }, [filters]);

  const handleRatingChange = useCallback(
    (value: number) => {
      onFiltersChange({ ...filters, minRating: value });
    },
    [filters, onFiltersChange]
  );

  const handleBudgetChange = useCallback(
    (value: number | null) => {
      onFiltersChange({ ...filters, maxBudget: value });
    },
    [filters, onFiltersChange]
  );

  const handleServiceToggle = useCallback(
    (serviceSlug: string) => {
      const newServices = filters.services.includes(serviceSlug)
        ? filters.services.filter((s) => s !== serviceSlug)
        : [...filters.services, serviceSlug];
      onFiltersChange({ ...filters, services: newServices });
    },
    [filters, onFiltersChange]
  );

  const handleVerifiedToggle = useCallback(() => {
    onFiltersChange({ ...filters, verifiedOnly: !filters.verifiedOnly });
  }, [filters, onFiltersChange]);

  const clearFilters = useCallback(() => {
    onFiltersChange({
      minRating: 0,
      maxBudget: null,
      services: [],
      verifiedOnly: false,
    });
  }, [onFiltersChange]);

  const isDark = variant === "dark";
  const baseBtn = isDark
    ? "border-white/20 text-white hover:bg-white/10 bg-white/5"
    : "border-border text-foreground hover:bg-muted bg-card";

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Rating Filter */}
      <div>
        <label className={cn("text-sm font-bold mb-3 block", isDark ? "text-white" : "text-foreground")}>
          Minimum Rating
        </label>
        <div className="flex flex-wrap gap-2">
          {RATING_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={filters.minRating === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleRatingChange(option.value)}
              className={cn(
                "rounded-full",
                filters.minRating !== option.value && baseBtn
              )}
            >
              {option.value > 0 && <Star className="h-3 w-3 mr-1 fill-current" />}
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Budget Filter */}
      <div>
        <label className={cn("text-sm font-bold mb-3 block", isDark ? "text-white" : "text-foreground")}>
          Budget Range
        </label>
        <div className="flex flex-wrap gap-2">
          {BUDGET_OPTIONS.map((option) => (
            <Button
              key={option.value ?? "any"}
              variant={filters.maxBudget === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleBudgetChange(option.value)}
              className={cn(
                "rounded-full",
                filters.maxBudget !== option.value && baseBtn
              )}
            >
              <DollarSign className="h-3 w-3 mr-1" />
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Services Filter */}
      {availableServices.length > 0 && (
        <div>
          <label className={cn("text-sm font-bold mb-3 block", isDark ? "text-white" : "text-foreground")}>
            Services
          </label>
          <div className="flex flex-wrap gap-2">
            {availableServices.slice(0, 8).map((service) => (
              <Button
                key={service.id}
                variant={filters.services.includes(service.slug) ? "default" : "outline"}
                size="sm"
                onClick={() => handleServiceToggle(service.slug)}
                className={cn(
                  "rounded-full",
                  !filters.services.includes(service.slug) && baseBtn
                )}
              >
                {service.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Verified Only Toggle */}
      <div>
        <Button
          variant={filters.verifiedOnly ? "default" : "outline"}
          size="sm"
          onClick={handleVerifiedToggle}
          className={cn("rounded-full", !filters.verifiedOnly && baseBtn)}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Verified Practices Only
        </Button>
      </div>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className={cn("w-full", isDark ? "text-white/60 hover:text-white" : "text-muted-foreground")}
        >
          <X className="h-4 w-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Mobile: Sheet */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className={cn("rounded-2xl font-bold", baseBtn)}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
            <SheetHeader className="text-left">
              <SheetTitle>Filter Results</SheetTitle>
              <SheetDescription>Narrow down your search</SheetDescription>
            </SheetHeader>
            <div className="mt-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Inline Dropdowns */}
      <div className="hidden md:flex items-center gap-3">
        {/* Rating Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={cn("rounded-2xl font-bold", baseBtn)}>
              <Star className="h-4 w-4 mr-2" />
              {filters.minRating > 0 ? `${filters.minRating}+ Stars` : "Rating"}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Minimum Rating</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {RATING_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={filters.minRating === option.value}
                onCheckedChange={() => handleRatingChange(option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Budget Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={cn("rounded-2xl font-bold", baseBtn)}>
              <DollarSign className="h-4 w-4 mr-2" />
              {filters.maxBudget ? `Under $${filters.maxBudget.toLocaleString()}` : "Budget"}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Max Budget</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {BUDGET_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value ?? "any"}
                checked={filters.maxBudget === option.value}
                onCheckedChange={() => handleBudgetChange(option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Services Dropdown */}
        {availableServices.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("rounded-2xl font-bold", baseBtn)}>
                <Stethoscope className="h-4 w-4 mr-2" />
                Services
                {filters.services.length > 0 && (
                  <Badge variant="default" className="ml-2 h-5 min-w-5 p-0 px-1 flex items-center justify-center text-xs">
                    {filters.services.length}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Select Services</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableServices.map((service) => (
                <DropdownMenuCheckboxItem
                  key={service.id}
                  checked={filters.services.includes(service.slug)}
                  onCheckedChange={() => handleServiceToggle(service.slug)}
                >
                  {service.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Verified Toggle */}
        <Button
          variant={filters.verifiedOnly ? "default" : "outline"}
          className={cn("rounded-2xl font-bold", !filters.verifiedOnly && baseBtn)}
          onClick={handleVerifiedToggle}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Verified
        </Button>

        {/* Clear */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className={cn(isDark ? "text-white/60 hover:text-white" : "text-muted-foreground")}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export function useSearchFilters(initialFilters?: Partial<FilterState>) {
  const [filters, setFilters] = useState<FilterState>({
    minRating: 0,
    maxBudget: null,
    services: [],
    verifiedOnly: false,
    ...initialFilters,
  });

  const applyFilters = useCallback(
    <T extends { rating?: number; isVerified?: boolean }>(items: T[]): T[] => {
      return items.filter((item) => {
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
