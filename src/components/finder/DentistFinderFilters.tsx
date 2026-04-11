import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  MapPin,
  Star,
  Users,
  Clock,
  Accessibility,
  Baby,
  Shield,
  CheckCircle
} from "lucide-react";

export interface FinderFilters {
  // Core filters
  sortBy: 'distance' | 'rating' | 'reviews' | 'name' | 'recommended';
  radius: number;
  
  // Patient choice filters
  acceptingNewPatients: boolean;
  availableToday: boolean;
  availableThisWeek: boolean;
  gender: 'any' | 'male' | 'female';
  languages: string[];
  accessibility: boolean;
  childFriendly: boolean;
  emergencyCare: boolean;
  openNow: boolean;
  weekendHours: boolean;
  
  // Platform-specific filters
  verified: boolean;
  bookNow: boolean;
  priceRange: [number, number];
  insurance: string[];
}

interface DentistFinderFiltersProps {
  filters: FinderFilters;
  onFiltersChange: (filters: Partial<FinderFilters>) => void;
  className?: string;
  variant?: 'sidebar' | 'sheet';
}

const DEFAULT_FILTERS: FinderFilters = {
  sortBy: 'rating',
  radius: 25,
  acceptingNewPatients: false,
  availableToday: false,
  availableThisWeek: false,
  gender: 'any',
  languages: [],
  accessibility: false,
  childFriendly: false,
  emergencyCare: false,
  openNow: false,
  weekendHours: false,
  verified: false,
  bookNow: false,
  priceRange: [0, 500],
  insurance: []
};

export function useFinderFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FinderFilters>(() => {
    // Parse from URL params
    const sortBy = searchParams.get('sort') as FinderFilters['sortBy'] || 'rating';
    const radius = parseInt(searchParams.get('radius') || '25');
    const acceptingNewPatients = searchParams.get('newPatients') === 'true';
    const verified = searchParams.get('verified') === 'true';
    const bookNow = searchParams.get('bookNow') === 'true';
    
    return {
      ...DEFAULT_FILTERS,
      sortBy,
      radius,
      acceptingNewPatients,
      verified,
      bookNow
    };
  });

  const updateFilters = (newFilters: Partial<FinderFilters>) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      
      // Update URL params
      const params = new URLSearchParams();
      if (updated.sortBy !== 'rating') params.set('sort', updated.sortBy);
      if (updated.radius !== 25) params.set('radius', updated.radius.toString());
      if (updated.acceptingNewPatients) params.set('newPatients', 'true');
      if (updated.verified) params.set('verified', 'true');
      if (updated.bookNow) params.set('bookNow', 'true');
      
      setSearchParams(params, { replace: true });
      return updated;
    });
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchParams({}, { replace: true });
  };

  const activeFilterCount = () => {
    let count = 0;
    if (filters.acceptingNewPatients) count++;
    if (filters.availableToday) count++;
    if (filters.availableThisWeek) count++;
    if (filters.gender !== 'any') count++;
    if (filters.languages.length > 0) count++;
    if (filters.accessibility) count++;
    if (filters.childFriendly) count++;
    if (filters.emergencyCare) count++;
    if (filters.openNow) count++;
    if (filters.weekendHours) count++;
    if (filters.verified) count++;
    if (filters.bookNow) count++;
    if (filters.insurance.length > 0) count++;
    return count;
  };

  return { filters, updateFilters, clearFilters, activeFilterCount };
}

// Hardcoded common languages (to avoid needing languages table)
const COMMON_LANGUAGES = [
  { id: '1', name: 'English' },
  { id: '2', name: 'Arabic' },
  { id: '3', name: 'Hindi' },
  { id: '4', name: 'Urdu' },
  { id: '5', name: 'Tagalog' },
  { id: '6', name: 'French' },
  { id: '7', name: 'Spanish' },
  { id: '8', name: 'German' },
];

// Hardcoded common insurances (to avoid needing insurances table)
const COMMON_INSURANCES = [
  { id: '1', name: 'Premium' },
  { id: '2', name: 'Standard' },
  { id: '3', name: 'Basic' },
  { id: '4', name: 'DNATA' },
  { id: '5', name: 'Almadallah' },
  { id: '6', name: 'MSH' },
  { id: '7', name: 'AXA' },
  { id: '8', name: 'Cigna' },
  { id: '9', name: 'Bupa' },
  { id: '10', name: 'MetLife' },
];

// Use hardcoded data instead of dynamic queries
function useLanguages() {
  return { data: COMMON_LANGUAGES, isLoading: false };
}

// Use hardcoded data instead of dynamic queries
function useInsurances() {
  return { data: COMMON_INSURANCES, isLoading: false };
}

function FilterContent({
  filters,
  onFiltersChange
}: {
  filters: FinderFilters;
  onFiltersChange: (filters: Partial<FinderFilters>) => void;
}) {
  const { data: languages } = useLanguages();
  const { data: insurances } = useInsurances();
  
  const sortOptions = [
    { value: 'rating', label: 'Highest Rated', icon: Star },
    { value: 'reviews', label: 'Most Reviewed', icon: Users },
    { value: 'distance', label: 'Nearest', icon: MapPin },
    { value: 'name', label: 'Name (A-Z)', icon: CheckCircle },
    { value: 'recommended', label: 'Recommended', icon: Star },
  ];

  return (
    <div className="space-y-6">
      {/* Sort By */}
      <div>
        <h4 className="font-semibold text-slate-800 mb-3">Sort By</h4>
        <div className="space-y-2">
          {sortOptions.map((option) => {
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                  filters.sortBy === option.value
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                )}
              >
                <input
                  type="radio"
                  name="sortBy"
                  value={option.value}
                  checked={filters.sortBy === option.value}
                  onChange={() => onFiltersChange({ sortBy: option.value as any })}
                  className="sr-only"
                />
                <Icon className={cn(
                  "h-4 w-4",
                  filters.sortBy === option.value ? "text-emerald-600" : "text-slate-400"
                )} />
                <span className={cn(
                  "font-medium",
                  filters.sortBy === option.value ? "text-emerald-700" : "text-slate-700"
                )}>
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Distance Radius */}
      <div>
        <h4 className="font-semibold text-slate-800 mb-3">Distance: {filters.radius} km</h4>
        <Slider
          value={[filters.radius]}
          onValueChange={([value]) => onFiltersChange({ radius: value })}
          min={5}
          max={100}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>5 km</span>
          <span>100 km</span>
        </div>
      </div>

      {/* Core Filters */}
      <Accordion type="multiple" className="space-y-4">
        {/* Availability */}
        <AccordionItem value="availability" className="border-slate-200">
          <AccordionTrigger className="text-slate-800 font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Availability
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.acceptingNewPatients}
                onCheckedChange={(checked) => onFiltersChange({ acceptingNewPatients: !!checked })}
              />
              <span className="text-sm font-medium">Accepting New Patients</span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.availableToday}
                onCheckedChange={(checked) => onFiltersChange({ availableToday: !!checked })}
              />
              <span className="text-sm font-medium">Available Today</span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.availableThisWeek}
                onCheckedChange={(checked) => onFiltersChange({ availableThisWeek: !!checked })}
              />
              <span className="text-sm font-medium">Available This Week</span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.openNow}
                onCheckedChange={(checked) => onFiltersChange({ openNow: !!checked })}
              />
              <span className="text-sm font-medium">Open Now</span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.weekendHours}
                onCheckedChange={(checked) => onFiltersChange({ weekendHours: !!checked })}
              />
              <span className="text-sm font-medium">Weekend Hours</span>
            </label>
          </AccordionContent>
        </AccordionItem>

        {/* Provider Preference */}
        <AccordionItem value="provider" className="border-slate-200">
          <AccordionTrigger className="text-slate-800 font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Provider Preference
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="flex gap-2">
              {[
                { value: 'any', label: 'Any' },
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => onFiltersChange({ gender: option.value as any })}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all border",
                    filters.gender === option.value
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            {/* Languages */}
            {languages && languages.length > 0 && (
              <div className="mt-3">
                <Label className="text-sm font-medium text-slate-700 mb-2 block">Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {languages.slice(0, 10).map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => {
                        const newLanguages = filters.languages.includes(lang.name)
                          ? filters.languages.filter(l => l !== lang.name)
                          : [...filters.languages, lang.name];
                        onFiltersChange({ languages: newLanguages });
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                        filters.languages.includes(lang.name)
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Convenience Features */}
        <AccordionItem value="convenience" className="border-slate-200">
          <AccordionTrigger className="text-slate-800 font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Convenience
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.accessibility}
                onCheckedChange={(checked) => onFiltersChange({ accessibility: !!checked })}
              />
              <span className="flex items-center gap-2 text-sm font-medium">
                <Accessibility className="h-4 w-4" />
                Wheelchair Accessible
              </span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.childFriendly}
                onCheckedChange={(checked) => onFiltersChange({ childFriendly: !!checked })}
              />
              <span className="flex items-center gap-2 text-sm font-medium">
                <Baby className="h-4 w-4" />
                Child-Friendly / Family Dentistry
              </span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.emergencyCare}
                onCheckedChange={(checked) => onFiltersChange({ emergencyCare: !!checked })}
              />
              <span className="text-sm font-medium">Emergency Care Available</span>
            </label>
          </AccordionContent>
        </AccordionItem>

        {/* Platform Filters */}
        <AccordionItem value="platform" className="border-slate-200">
          <AccordionTrigger className="text-slate-800 font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Platform
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.verified}
                onCheckedChange={(checked) => onFiltersChange({ verified: !!checked })}
              />
              <span className="text-sm font-medium">Verified Profile</span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={filters.bookNow}
                onCheckedChange={(checked) => onFiltersChange({ bookNow: !!checked })}
              />
              <span className="text-sm font-medium">Book Now Available</span>
            </label>
          </AccordionContent>
        </AccordionItem>

        {/* Insurance */}
        <AccordionItem value="insurance" className="border-slate-200">
          <AccordionTrigger className="text-slate-800 font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Insurance Accepted
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            {insurances && insurances.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {insurances.slice(0, 15).map((ins) => (
                  <button
                    key={ins.id}
                    onClick={() => {
                      const newInsurance = filters.insurance.includes(ins.name)
                        ? filters.insurance.filter(i => i !== ins.name)
                        : [...filters.insurance, ins.name];
                      onFiltersChange({ insurance: newInsurance });
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      filters.insurance.includes(ins.name)
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {ins.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading insurances...</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function DentistFinderFilters({
  filters,
  onFiltersChange,
  className,
  variant = 'sidebar'
}: DentistFinderFiltersProps) {
  const activeCount = [
    filters.acceptingNewPatients,
    filters.availableToday,
    filters.availableThisWeek,
    filters.gender !== 'any',
    filters.languages.length > 0,
    filters.accessibility,
    filters.childFriendly,
    filters.emergencyCare,
    filters.openNow,
    filters.weekendHours,
    filters.verified,
    filters.bookNow,
    filters.insurance.length > 0
  ].filter(Boolean).length;

  const content = (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-800">Filters</h3>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            Clear All ({activeCount})
          </Button>
        )}
      </div>
      
      {/* Active Filters Chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {filters.acceptingNewPatients && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              New Patients
              <button onClick={() => onFiltersChange({ acceptingNewPatients: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.verified && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              Verified
              <button onClick={() => onFiltersChange({ verified: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.bookNow && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              Book Now
              <button onClick={() => onFiltersChange({ bookNow: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.openNow && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              Open Now
              <button onClick={() => onFiltersChange({ openNow: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.weekendHours && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              Weekend Hours
              <button onClick={() => onFiltersChange({ weekendHours: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.accessibility && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              Accessible
              <button onClick={() => onFiltersChange({ accessibility: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.childFriendly && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              Family Dentist
              <button onClick={() => onFiltersChange({ childFriendly: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.emergencyCare && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              Emergency Care
              <button onClick={() => onFiltersChange({ emergencyCare: false })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.gender !== 'any' && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              {filters.gender === 'male' ? 'Male Doctor' : 'Female Doctor'}
              <button onClick={() => onFiltersChange({ gender: 'any' })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.insurance.map(ins => (
            <Badge key={ins} variant="secondary" className="bg-emerald-100 text-emerald-700 px-3 py-1">
              {ins}
              <button onClick={() => onFiltersChange({ 
                insurance: filters.insurance.filter(i => i !== ins) 
              })} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      <FilterContent filters={filters} onFiltersChange={onFiltersChange} />
    </>
  );

  if (variant === 'sheet') {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2 border-slate-200">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="bg-emerald-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filter Results</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className={cn("bg-white rounded-2xl p-6 border border-slate-200", className)}>
      {content}
    </div>
  );
}