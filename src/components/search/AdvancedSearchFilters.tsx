/**
 * Advanced Search Filters - Phase 4 Sprint 4.2
 * 
 * Enhanced filtering system with:
 * - Availability filters (today, weekend, evening)
 * - Accessibility filters (languages, wheelchair, pediatric)
 * - Quality filters (ratings, experience, verified)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Calendar, 
  Clock, 
  Moon, 
  Sun,
  Users, 
  Globe, 
  Accessibility, 
  Baby, 
  Shield,
  Star,
  CheckCircle2,
  Filter,
  X,
  RotateCcw
} from 'lucide-react';

export interface SearchFilters {
  // Availability
  availableToday: boolean;
  availableThisWeek: boolean;
  weekendHours: boolean;
  eveningHours: boolean;
  acceptsNewPatients: boolean;
  
  // Accessibility
  languages: string[];
  wheelchairAccessible: boolean;
  pediatricFriendly: boolean;
  sedationOptions: boolean;
  
  // Quality
  minimumRating: number;
  yearsInPractice: number;
  genderPreference: 'any' | 'male' | 'female';
  verifiedReviewsOnly: boolean;
}

interface AdvancedSearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApply: () => void;
  onReset: () => void;
  resultCount?: number;
}

const AVAILABLE_LANGUAGES = [
  'Spanish', 'Mandarin', 'Cantonese', 'Vietnamese', 'Korean', 
  'Tagalog', 'Russian', 'Arabic', 'Portuguese', 'French',
  'Hindi', 'Japanese', 'German', 'Italian', 'Polish'
];

export default function AdvancedSearchFilters({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  resultCount
}: AdvancedSearchFiltersProps) {
  const [expandedSections, setExpandedSections] = useState(['availability', 'quality']);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleLanguage = (language: string) => {
    const current = filters.languages || [];
    const updated = current.includes(language)
      ? current.filter(l => l !== language)
      : [...current, language];
    updateFilter('languages', updated);
  };

  const activeFilterCount = [
    filters.availableToday,
    filters.availableThisWeek,
    filters.weekendHours,
    filters.eveningHours,
    filters.acceptsNewPatients,
    filters.wheelchairAccessible,
    filters.pediatricFriendly,
    filters.sedationOptions,
    filters.verifiedReviewsOnly,
    filters.minimumRating > 0,
    filters.yearsInPractice > 0,
    filters.genderPreference !== 'any',
    (filters.languages?.length || 0) > 0
  ].filter(Boolean).length;

  return (
    <Card className="h-fit sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} active
              </Badge>
            )}
          </CardTitle>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <Accordion 
            type="multiple" 
            value={expandedSections}
            onValueChange={setExpandedSections}
            className="space-y-2"
          >
            {/* Availability Filters */}
            <AccordionItem value="availability" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-medium py-3">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Availability
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="availableToday"
                    checked={filters.availableToday}
                    onCheckedChange={(checked) => updateFilter('availableToday', !!checked)}
                  />
                  <Label htmlFor="availableToday" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Clock className="h-3 w-3" />
                    Available Today
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="availableThisWeek"
                    checked={filters.availableThisWeek}
                    onCheckedChange={(checked) => updateFilter('availableThisWeek', !!checked)}
                  />
                  <Label htmlFor="availableThisWeek" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Calendar className="h-3 w-3" />
                    Available This Week
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="weekendHours"
                    checked={filters.weekendHours}
                    onCheckedChange={(checked) => updateFilter('weekendHours', !!checked)}
                  />
                  <Label htmlFor="weekendHours" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Sun className="h-3 w-3" />
                    Weekend Hours
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="eveningHours"
                    checked={filters.eveningHours}
                    onCheckedChange={(checked) => updateFilter('eveningHours', !!checked)}
                  />
                  <Label htmlFor="eveningHours" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Moon className="h-3 w-3" />
                    Evening Hours (After 6pm)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="acceptsNewPatients"
                    checked={filters.acceptsNewPatients}
                    onCheckedChange={(checked) => updateFilter('acceptsNewPatients', !!checked)}
                  />
                  <Label htmlFor="acceptsNewPatients" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Users className="h-3 w-3" />
                    Accepts New Patients
                  </Label>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Accessibility Filters */}
            <AccordionItem value="accessibility" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-medium py-3">
                <span className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-primary" />
                  Accessibility
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="wheelchairAccessible"
                    checked={filters.wheelchairAccessible}
                    onCheckedChange={(checked) => updateFilter('wheelchairAccessible', !!checked)}
                  />
                  <Label htmlFor="wheelchairAccessible" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Accessibility className="h-3 w-3" />
                    Wheelchair Accessible
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="pediatricFriendly"
                    checked={filters.pediatricFriendly}
                    onCheckedChange={(checked) => updateFilter('pediatricFriendly', !!checked)}
                  />
                  <Label htmlFor="pediatricFriendly" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Baby className="h-3 w-3" />
                    Pediatric Friendly
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sedationOptions"
                    checked={filters.sedationOptions}
                    onCheckedChange={(checked) => updateFilter('sedationOptions', !!checked)}
                  />
                  <Label htmlFor="sedationOptions" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Shield className="h-3 w-3" />
                    Sedation Options Available
                  </Label>
                </div>

                <Separator className="my-2" />
                
                <div>
                  <Label className="text-sm flex items-center gap-2 mb-2">
                    <Globe className="h-3 w-3" />
                    Languages Spoken
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_LANGUAGES.slice(0, 10).map((language) => (
                      <Badge
                        key={language}
                        variant={filters.languages?.includes(language) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleLanguage(language)}
                      >
                        {language}
                        {filters.languages?.includes(language) && (
                          <X className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Quality Filters */}
            <AccordionItem value="quality" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-medium py-3">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  Quality & Experience
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                <div>
                  <Label className="text-sm flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2">
                      <Star className="h-3 w-3" />
                      Minimum Rating
                    </span>
                    <span className="font-medium">
                      {filters.minimumRating > 0 ? `${filters.minimumRating}+ stars` : 'Any'}
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    {[0, 3, 3.5, 4, 4.5].map((rating) => (
                      <Button
                        key={rating}
                        variant={filters.minimumRating === rating ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => updateFilter('minimumRating', rating)}
                      >
                        {rating === 0 ? 'Any' : `${rating}+`}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Years in Practice
                    </span>
                    <span className="font-medium">
                      {filters.yearsInPractice > 0 ? `${filters.yearsInPractice}+ years` : 'Any'}
                    </span>
                  </Label>
                  <Slider
                    value={[filters.yearsInPractice]}
                    onValueChange={([value]) => updateFilter('yearsInPractice', value)}
                    max={30}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Any</span>
                    <span>30+ years</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm flex items-center gap-2 mb-2">
                    <Users className="h-3 w-3" />
                    Dentist Gender
                  </Label>
                  <div className="flex gap-2">
                    {(['any', 'male', 'female'] as const).map((gender) => (
                      <Button
                        key={gender}
                        variant={filters.genderPreference === gender ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 capitalize"
                        onClick={() => updateFilter('genderPreference', gender)}
                      >
                        {gender === 'any' ? 'No Preference' : gender}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="verifiedReviewsOnly"
                    checked={filters.verifiedReviewsOnly}
                    onCheckedChange={(checked) => updateFilter('verifiedReviewsOnly', !!checked)}
                  />
                  <Label htmlFor="verifiedReviewsOnly" className="text-sm flex items-center gap-2 cursor-pointer">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Reviews Only
                  </Label>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>

        <Separator className="my-4" />

        <div className="space-y-2">
          <Button className="w-full" onClick={onApply}>
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
            {resultCount !== undefined && (
              <Badge variant="secondary" className="ml-2">
                {resultCount} results
              </Badge>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for managing filter state
export function useAdvancedSearchFilters() {
  const [filters, setFilters] = useState<SearchFilters>({
    availableToday: false,
    availableThisWeek: false,
    weekendHours: false,
    eveningHours: false,
    acceptsNewPatients: false,
    languages: [],
    wheelchairAccessible: false,
    pediatricFriendly: false,
    sedationOptions: false,
    minimumRating: 0,
    yearsInPractice: 0,
    genderPreference: 'any',
    verifiedReviewsOnly: false
  });

  const resetFilters = () => {
    setFilters({
      availableToday: false,
      availableThisWeek: false,
      weekendHours: false,
      eveningHours: false,
      acceptsNewPatients: false,
      languages: [],
      wheelchairAccessible: false,
      pediatricFriendly: false,
      sedationOptions: false,
      minimumRating: 0,
      yearsInPractice: 0,
      genderPreference: 'any',
      verifiedReviewsOnly: false
    });
  };

  return { filters, setFilters, resetFilters };
}
