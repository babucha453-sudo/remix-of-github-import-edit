import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  MapPin, 
  X, 
  Navigation,
  Loader2,
  Stethoscope
} from "lucide-react";

interface SearchSuggestion {
  id: string;
  type: 'service' | 'location' | 'clinic';
  name: string;
  subtitle?: string;
  slug?: string;
  stateSlug?: string;
  citySlug?: string;
}

interface DentistFinderSearchProps {
  initialService?: string;
  initialLocation?: string;
  onSearch?: (service: string, location: string) => void;
  className?: string;
}

export function DentistFinderSearch({
  initialService = "",
  initialLocation = "",
  onSearch,
  className
}: DentistFinderSearchProps) {
  const navigate = useNavigate();
  const [serviceQuery, setServiceQuery] = useState(initialService);
  const [locationQuery, setLocationQuery] = useState(initialLocation);
  const [serviceSuggestions, setServiceSuggestions] = useState<SearchSuggestion[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<SearchSuggestion[]>([]);
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  
  const debouncedService = useDebounce(serviceQuery, 300);
  const debouncedLocation = useDebounce(locationQuery, 300);
  
  const serviceInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Search treatments/services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['search-services', debouncedService],
    queryFn: async () => {
      if (!debouncedService || debouncedService.length < 2) return [];
      
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .ilike('name', `%${debouncedService}%`)
        .eq('is_active', true)
        .order('display_order')
        .limit(8);
      
      return (data || []).map(t => ({
        id: t.id,
        type: 'service' as const,
        name: t.name,
        slug: t.slug
      }));
    },
    enabled: debouncedService.length >= 2
  });

  // Search locations (cities + states)
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['search-locations', debouncedLocation],
    queryFn: async () => {
      if (!debouncedLocation || debouncedLocation.length < 2) return [];
      
      const [citiesRes, statesRes] = await Promise.all([
        supabase
          .from('cities')
          .select('id, name, slug, state:states(slug, abbreviation)')
          .ilike('name', `%${debouncedLocation}%`)
          .eq('is_active', true)
          .limit(5),
        supabase
          .from('states')
          .select('id, name, slug, abbreviation')
          .ilike('name', `%${debouncedLocation}%`)
          .eq('is_active', true)
          .limit(3)
      ]);
      
      const suggestions: SearchSuggestion[] = [];
      
      (citiesRes.data || []).forEach(city => {
        suggestions.push({
          id: city.id,
          type: 'location',
          name: city.name,
          subtitle: city.state ? `${city.state.abbreviation}` : undefined,
          slug: city.slug,
          stateSlug: (city.state as any)?.slug
        });
      });
      
      (statesRes.data || []).forEach(state => {
        suggestions.push({
          id: state.id,
          type: 'location',
          name: state.name,
          subtitle: state.abbreviation,
          slug: state.slug
        });
      });
      
      return suggestions;
    },
    enabled: debouncedLocation.length >= 2
  });

  useEffect(() => {
    if (servicesData) {
      setServiceSuggestions(servicesData);
    }
  }, [servicesData]);

  useEffect(() => {
    if (locationsData) {
      setLocationSuggestions(locationsData);
    }
  }, [locationsData]);

  const handleSearch = () => {
    const searchService = serviceQuery.trim();
    const searchLocation = locationQuery.trim();
    
    if (onSearch) {
      onSearch(searchService, searchLocation);
      return;
    }

    // Build URL based on search params
    if (searchService && searchLocation) {
      // Service + Location search
      navigate(`/search?service=${encodeURIComponent(searchService)}&location=${encodeURIComponent(searchLocation)}`);
    } else if (searchService) {
      // Service only
      navigate(`/search?service=${encodeURIComponent(searchService)}`);
    } else if (searchLocation) {
      // Location only
      navigate(`/search?location=${encodeURIComponent(searchLocation)}`);
    }
  };

  const handleServiceSelect = (service: SearchSuggestion) => {
    setServiceQuery(service.name);
    setShowServiceSuggestions(false);
  };

  const handleLocationSelect = (location: SearchSuggestion) => {
    setLocationQuery(location.name);
    setShowLocationSuggestions(false);
    
    // Navigate to location page
    if (location.type === 'location' && location.stateSlug && location.slug) {
      navigate(`/${location.stateSlug}/${location.slug}`);
    } else if (location.type === 'location' && location.slug) {
      navigate(`/${location.slug}`);
    }
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) return;
    
    setUseCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // For now, just show a message - we'd need to reverse geocode
        setLocationQuery("Near Me");
        setUseCurrentLocation(false);
      },
      () => {
        setUseCurrentLocation(false);
      }
    );
  };

  const clearService = () => {
    setServiceQuery("");
    setServiceSuggestions([]);
  };

  const clearLocation = () => {
    setLocationQuery("");
    setLocationSuggestions([]);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Service Input */}
        <div className="relative flex-1">
          <div className="relative">
            <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600" />
            <Input
              ref={serviceInputRef}
              type="text"
              placeholder="Search by service..."
              value={serviceQuery}
              onChange={(e) => {
                setServiceQuery(e.target.value);
                setShowServiceSuggestions(true);
              }}
              onFocus={() => setShowServiceSuggestions(true)}
              onBlur={() => setTimeout(() => setShowServiceSuggestions(false), 200)}
              className="pl-12 pr-10 h-14 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-200 text-base"
            />
            {serviceQuery && (
              <button
                onClick={clearService}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>
          
          {/* Service Suggestions Dropdown */}
          {showServiceSuggestions && (serviceSuggestions.length > 0 || servicesLoading) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-64 overflow-y-auto">
              {servicesLoading ? (
                <div className="p-4 flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : (
                serviceSuggestions.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                  >
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-medium text-slate-800">{service.name}</div>
                      {service.subtitle && (
                        <div className="text-sm text-slate-500">{service.subtitle}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Location Input */}
        <div className="relative flex-1">
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600" />
            <Input
              ref={locationInputRef}
              type="text"
              placeholder="Location (city, area)"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-12 pr-24 h-14 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-200 text-base"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {locationQuery && (
                <button
                  onClick={clearLocation}
                  className="p-1.5 hover:bg-slate-100 rounded-full"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNearMe}
                disabled={useCurrentLocation}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-1.5"
              >
                {useCurrentLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Location Suggestions Dropdown */}
          {showLocationSuggestions && (locationSuggestions.length > 0 || locationsLoading) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-64 overflow-y-auto">
              {locationsLoading ? (
                <div className="p-4 flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : locationSuggestions.length > 0 ? (
                locationSuggestions.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => handleLocationSelect(location)}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                  >
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-medium text-slate-800">{location.name}</div>
                      {location.subtitle && (
                        <div className="text-sm text-slate-500">{location.subtitle}</div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-slate-500 text-sm">No locations found</div>
              )}
            </div>
          )}
        </div>

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          className="h-14 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-base"
        >
          <Search className="h-5 w-5 mr-2" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>
    </div>
  );
}