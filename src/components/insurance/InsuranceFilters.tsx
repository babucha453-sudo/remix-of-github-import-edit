import { useState } from "react";
import { 
  SlidersHorizontal, 
  Star, 
  MapPin, 
  X, 
  ChevronDown 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CityOption {
  id: string;
  name: string;
  slug: string;
  stateSlug: string;
  stateAbbreviation: string;
}

interface InsuranceFiltersProps {
  totalCount: number;
  cities: CityOption[];
  selectedCity: string | null;
  selectedState: string | null;
  sortBy: "rating" | "reviews" | "name";
  minRating: number | undefined;
  onCityChange: (citySlug: string | null, stateSlug: string | null) => void;
  onSortChange: (sort: "rating" | "reviews" | "name") => void;
  onRatingChange: (rating: number | undefined) => void;
  onClearFilters: () => void;
}

export function InsuranceFilters({
  totalCount,
  cities,
  selectedCity,
  selectedState,
  sortBy,
  minRating,
  onCityChange,
  onSortChange,
  onRatingChange,
  onClearFilters,
}: InsuranceFiltersProps) {
  const [cityPopoverOpen, setCityPopoverOpen] = useState(false);

  const hasActiveFilters = selectedCity || minRating;
  const selectedCityData = cities.find(
    (c) => c.slug === selectedCity && c.stateSlug === selectedState
  );

  const sortLabels = {
    rating: "Highest Rated",
    reviews: "Most Reviewed",
    name: "A-Z",
  };

  const ratingOptions = [
    { value: undefined, label: "Any Rating" },
    { value: 4.5, label: "4.5+ Stars" },
    { value: 4.0, label: "4.0+ Stars" },
    { value: 3.5, label: "3.5+ Stars" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 py-4 border-b border-border">
      {/* Result Count */}
      <div className="text-sm text-muted-foreground mr-auto">
        <span className="font-bold text-foreground">{totalCount}</span> clinics found
      </div>

      {/* City Filter */}
      <Popover open={cityPopoverOpen} onOpenChange={setCityPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedCity ? "default" : "outline"}
            size="sm"
            className="gap-2 rounded-full"
          >
            <MapPin className="h-3.5 w-3.5" />
            {selectedCityData
              ? `${selectedCityData.name}, ${selectedCityData.stateAbbreviation}`
              : "All Cities"}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="end">
          <div className="p-2 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm"
              onClick={() => {
                onCityChange(null, null);
                setCityPopoverOpen(false);
              }}
            >
              All Cities
            </Button>
          </div>
          <ScrollArea className="h-64">
            <div className="p-2 space-y-1">
              {cities.map((city) => (
                <Button
                  key={city.id}
                  variant={selectedCity === city.slug ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => {
                    onCityChange(city.slug, city.stateSlug);
                    setCityPopoverOpen(false);
                  }}
                >
                  {city.name}, {city.stateAbbreviation}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Rating Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={minRating ? "default" : "outline"}
            size="sm"
            className="gap-2 rounded-full"
          >
            <Star className="h-3.5 w-3.5" />
            {minRating ? `${minRating}+ Stars` : "Rating"}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ratingOptions.map((option) => (
            <DropdownMenuItem
              key={option.label}
              onClick={() => onRatingChange(option.value)}
              className={minRating === option.value ? "bg-muted" : ""}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 rounded-full">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {sortLabels[sortBy]}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSortChange("rating")}>
            Highest Rated
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("reviews")}>
            Most Reviewed
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("name")}>
            A-Z
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
