import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  X,
  ChevronDown,
  Star,
  Clock,
  Shield,
  MapPin,
  DollarSign,
  Wrench,
  Filter,
  RotateCcw
} from "lucide-react";

export interface FilterState {
  // Location
  state: string;
  city: string;
  area: string;
  
  // Services
  services: string[];
  
  // Pricing
  priceMin: number;
  priceMax: number;
  
  // Ratings
  minRating: number;
  
  // Availability
  availableToday: boolean;
  availableThisWeek: boolean;
  openNow: boolean;
  weekendHours: boolean;
  
  // Insurance
  insurance: string[];
  
  // Clinic type
  clinicType: 'all' | 'general' | 'specialist';
  
  // Verified/Claimed
  verified: boolean;
  claimed: boolean;
  
  // Sort
  sortBy: 'rating' | 'reviews' | 'price-low' | 'price-high' | 'distance';
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onClearAll: () => void;
  resultCount?: number;
  className?: string;
}

const DEFAULT_FILTERS: FilterState = {
  state: '',
  city: '',
  area: '',
  services: [],
  priceMin: 0,
  priceMax: 500,
  minRating: 0,
  availableToday: false,
  availableThisWeek: false,
  openNow: false,
  weekendHours: false,
  insurance: [],
  clinicType: 'all',
  verified: false,
  claimed: false,
  sortBy: 'rating'
};

const PRICE_RANGES = [
  { label: 'Under $100', min: 0, max: 100 },
  { label: '$100 - $200', min: 100, max: 200 },
  { label: '$200 - $300', min: 200, max: 300 },
  { label: '$300 - $500', min: 300, max: 500 },
  { label: 'Premium', min: 500, max: 1000 },
];

const POPULAR_SERVICES = [
  'Teeth Cleaning',
  'Teeth Whitening',
  'Dental Implants',
  'Braces',
  'Root Canal',
  'Crowns & Bridges',
  'Wisdom Teeth',
  'Veneers'
];

const INSURANCE_PROVIDERS = [
  'Delta Dental',
  'Cigna Dental',
  'Aetna Dental',
  'MetLife Dental',
  'United Healthcare',
  'Guardian Dental'
];

export function FilterPanel({
  filters,
  onFiltersChange,
  onClearAll,
  resultCount = 0,
  className
}: FilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['sort', 'location', 'price', 'rating']);
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };
  
  const activeFilterCount = () => {
    let count = 0;
    if (filters.state) count++;
    if (filters.city) count++;
    if (filters.services.length) count += filters.services.length;
    if (filters.priceMin > 0 || filters.priceMax < 500) count++;
    if (filters.minRating > 0) count++;
    if (filters.availableToday || filters.availableThisWeek || filters.openNow) count++;
    if (filters.insurance.length) count += filters.insurance.length;
    if (filters.clinicType !== 'all') count++;
    if (filters.verified || filters.claimed) count++;
    return count;
  };
  
  const handleServiceToggle = (service: string) => {
    const newServices = filters.services.includes(service)
      ? filters.services.filter(s => s !== service)
      : [...filters.services, service];
    onFiltersChange({ services: newServices });
  };
  
  const handleInsuranceToggle = (insurance: string) => {
    const newInsurance = filters.insurance.includes(insurance)
      ? filters.insurance.filter(i => i !== insurance)
      : [...filters.insurance, insurance];
    onFiltersChange({ insurance: newInsurance });
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Filters</h2>
            {activeFilterCount() > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700">{activeFilterCount()}</Badge>
            )}
          </div>
          {activeFilterCount() > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClearAll}
              className="text-slate-500 hover:text-red-600 hover:bg-red-50"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
        {resultCount > 0 && (
          <p className="text-sm text-slate-500 mt-2">
            {resultCount} dentists found
          </p>
        )}
      </div>
      
      <div className="max-h-[70vh] overflow-y-auto">
        {/* Sort By */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('sort')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700">Sort By</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('sort') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('sort') && (
            <div className="px-4 pb-4 space-y-2">
              {[
                { value: 'rating', label: 'Highest Rated' },
                { value: 'reviews', label: 'Most Reviewed' },
                { value: 'price-low', label: 'Lowest Price' },
                { value: 'price-high', label: 'Highest Price' },
                { value: 'distance', label: 'Nearest' }
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="sortBy"
                    checked={filters.sortBy === option.value}
                    onChange={() => onFiltersChange({ sortBy: option.value as any })}
                    className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-600">{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        
        {/* Location Filters */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('location')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              Location
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('location') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('location') && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">State</Label>
                <select
                  value={filters.state}
                  onChange={(e) => onFiltersChange({ state: e.target.value, city: '' })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All States</option>
                  <option value="ca">California</option>
                  <option value="ny">New York</option>
                  <option value="tx">Texas</option>
                  <option value="fl">Florida</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">City</Label>
                <select
                  value={filters.city}
                  onChange={(e) => onFiltersChange({ city: e.target.value })}
                  disabled={!filters.state}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">All Cities</option>
                  {filters.state === 'ca' && (
                    <>
                      <option value="los-angeles">Los Angeles</option>
                      <option value="san-francisco">San Francisco</option>
                      <option value="san-diego">San Diego</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>
        
        {/* Services */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('services')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-400" />
              Services
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('services') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('services') && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {POPULAR_SERVICES.map((service) => (
                  <button
                    key={service}
                    onClick={() => handleServiceToggle(service)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      filters.services.includes(service)
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Price Range */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('price')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-slate-400" />
              Price Range
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('price') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('price') && (
            <div className="px-4 pb-4 space-y-3">
              <Slider
                value={[filters.priceMin, filters.priceMax]}
                onValueChange={([min, max]) => onFiltersChange({ priceMin: min, priceMax: max })}
                max={500}
                step={50}
                className="py-2"
              />
              <div className="flex justify-between text-sm text-slate-500">
                <span>${filters.priceMin}</span>
                <span>${filters.priceMax}+</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRICE_RANGES.map((range) => (
                  <button
                    key={range.label}
                    onClick={() => onFiltersChange({ priceMin: range.min, priceMax: range.max })}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      filters.priceMin === range.min && filters.priceMax === range.max
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Ratings */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('rating')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <Star className="h-4 w-4 text-slate-400" />
              Rating
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('rating') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('rating') && (
            <div className="px-4 pb-4 space-y-2">
              {[5, 4, 3].map((rating) => (
                <label key={rating} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="minRating"
                    checked={filters.minRating === rating}
                    onChange={() => onFiltersChange({ minRating: rating })}
                    className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i} 
                        className={`h-4 w-4 ${i < rating ? 'text-amber-400 fill-current' : 'text-slate-200'}`} 
                      />
                    ))}
                    <span className="text-sm text-slate-500 ml-1">& up</span>
                  </div>
                </label>
              ))}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="minRating"
                  checked={filters.minRating === 0}
                  onChange={() => onFiltersChange({ minRating: 0 })}
                  className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600">Any rating</span>
              </label>
            </div>
          )}
        </div>
        
        {/* Availability */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('availability')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              Availability
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('availability') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('availability') && (
            <div className="px-4 pb-4 space-y-2">
              {[
                { key: 'availableToday', label: 'Available Today' },
                { key: 'availableThisWeek', label: 'Available This Week' },
                { key: 'openNow', label: 'Open Now' },
                { key: 'weekendHours', label: 'Weekend Hours' }
              ].map((option) => (
                <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters[option.key as keyof FilterState] as boolean}
                    onChange={(e) => onFiltersChange({ [option.key]: e.target.checked } as any)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-600">{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        
        {/* Insurance */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('insurance')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              Insurance
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('insurance') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('insurance') && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {INSURANCE_PROVIDERS.map((insurance) => (
                  <button
                    key={insurance}
                    onClick={() => handleInsuranceToggle(insurance)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      filters.insurance.includes(insurance)
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {insurance}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Verified/Claimed */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => toggleSection('verification')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="font-medium text-slate-700">Verification</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSections.includes('verification') ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.includes('verification') && (
            <div className="px-4 pb-4 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verified}
                  onChange={(e) => onFiltersChange({ verified: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600">Verified</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.claimed}
                  onChange={(e) => onFiltersChange({ claimed: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600">Claimed Profile</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}