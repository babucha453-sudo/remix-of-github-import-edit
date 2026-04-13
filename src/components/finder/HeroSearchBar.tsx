import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  MapPin, 
  X, 
  Loader2,
  Stethoscope,
  ChevronDown,
  Check
} from "lucide-react";

interface SearchSuggestion {
  id: string;
  type: 'service' | 'location' | 'clinic';
  name: string;
  subtitle?: string;
  slug?: string;
  stateSlug?: string;
}

interface HeroSearchBarProps {
  onSearch?: (service: string, location: string, state: string, city: string) => void;
  className?: string;
  initialService?: string;
  initialLocation?: string;
  initialState?: string;
  initialCity?: string;
}

export function HeroSearchBar({
  onSearch,
  className,
  initialService = "",
  initialLocation = "",
  initialState = "",
  initialCity = ""
}: HeroSearchBarProps) {
  const navigate = useNavigate();
  
  // Form state
  const [serviceInput, setServiceInput] = useState(initialService);
  const [locationInput, setLocationInput] = useState(initialLocation);
  const [selectedState, setSelectedState] = useState(initialState);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  
  // Suggestions
  const [serviceSuggestions, setServiceSuggestions] = useState<SearchSuggestion[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<SearchSuggestion[]>([]);
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  
  const debouncedService = useDebounce(serviceInput, 300);
  const debouncedLocation = useDebounce(locationInput, 300);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fetch states
  const { data: statesData = [] } = useQuery({
    queryKey: ['states-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('states')
        .select('id, name, slug, abbreviation')
        .eq('is_active', true)
        .order('name');
      return data || [];
    }
  });
  
  // Fetch cities based on selected state
  const { data: citiesData = [] } = useQuery({
    queryKey: ['cities-by-state', selectedState],
    queryFn: async () => {
      const state = statesData.find(s => s.slug === selectedState);
      if (!state) return [];
      const { data } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('state_id', state.id)
        .eq('is_active', true)
        .order('name')
        .limit(50);
      return data || [];
    },
    enabled: !!selectedState
  });
  
  // Search services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['search-services', debouncedService],
    queryFn: async () => {
      if (!debouncedService || debouncedService.length < 2) return [];
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .ilike('name', `%${debouncedService}%`)
        .order('name')
        .limit(8);
      return data || [];
    },
    enabled: debouncedService.length >= 2
  });
  
  // Search locations
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['search-locations', debouncedLocation],
    queryFn: async () => {
      if (!debouncedLocation || debouncedLocation.length < 2) return [];
      
      // Search cities
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name, slug, states!inner(slug, name)')
        .ilike('name', `%${debouncedLocation}%`)
        .eq('is_active', true)
        .order('name')
        .limit(5);
      
      return (cities || []).map((c: any) => ({
        id: c.id,
        type: 'location' as const,
        name: `${c.name}, ${c.states?.abbreviation || c.states?.name}`,
        subtitle: c.states?.name,
        slug: c.slug,
        stateSlug: c.states?.slug
      }));
    },
    enabled: debouncedLocation.length >= 2
  });
  
  // Update suggestions
  useEffect(() => {
    if (servicesData?.length) {
      setServiceSuggestions(servicesData.map(s => ({
        id: s.id,
        type: 'service' as const,
        name: s.name,
        slug: s.slug
      })));
    }
  }, [servicesData]);
  
  useEffect(() => {
    if (locationsData?.length) {
      setLocationSuggestions(locationsData);
    }
  }, [locationsData]);
  
  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowServiceSuggestions(false);
        setShowLocationSuggestions(false);
        setShowStateDropdown(false);
        setShowCityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSearch = () => {
    const location = selectedState ? `${locationInput}${selectedState ? `, ${selectedState}` : ''}` : locationInput;
    if (onSearch) {
      onSearch(serviceInput, location, selectedState, selectedCity);
    } else {
      const params = new URLSearchParams();
      if (serviceInput) params.set('service', serviceInput);
      if (location) params.set('location', location);
      if (selectedState) params.set('state', selectedState);
      if (selectedCity) params.set('city', selectedCity);
      navigate(`/search?${params.toString()}`);
    }
  };
  
  const handleServiceSelect = (service: SearchSuggestion) => {
    setServiceInput(service.name);
    setShowServiceSuggestions(false);
  };
  
  const handleLocationSelect = (location: SearchSuggestion) => {
    setLocationInput(location.subtitle || location.name);
    if (location.stateSlug) setSelectedState(location.stateSlug);
    setShowLocationSuggestions(false);
  };
  
  const handleStateSelect = (state: any) => {
    setSelectedState(state.slug);
    setSelectedCity('');
    setShowStateDropdown(false);
  };
  
  const handleCitySelect = (city: any) => {
    setSelectedCity(city.slug);
    setShowCityDropdown(false);
  };
  
  const clearService = () => {
    setServiceInput('');
    setServiceSuggestions([]);
  };
  
  const clearLocation = () => {
    setLocationInput('');
    setSelectedState('');
    setSelectedCity('');
    setLocationSuggestions([]);
  };

  return (
    <div ref={containerRef} className={className}>
      <div className="bg-white rounded-2xl shadow-2xl shadow-emerald-900/20 p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Service Input */}
          <div className="flex-1 relative">
            <div className="relative">
              <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={serviceInput}
                onChange={(e) => {
                  setServiceInput(e.target.value);
                  setShowServiceSuggestions(true);
                }}
                onFocus={() => setShowServiceSuggestions(true)}
                placeholder="Search dentist, service, or treatment"
                className="w-full h-14 pl-12 pr-10 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-700 placeholder:text-slate-400 text-base"
              />
              {serviceInput && (
                <button
                  onClick={clearService}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X className="h-3 w-3 text-slate-500" />
                </button>
              )}
            </div>
            
            {/* Service Suggestions */}
            {showServiceSuggestions && serviceSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                {serviceSuggestions.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                  >
                    <Stethoscope className="h-4 w-4 text-emerald-500" />
                    <span className="text-slate-700">{service.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Location Input / State-City Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* State Dropdown */}
            <div className="relative w-full sm:w-44">
              <button
                onClick={() => setShowStateDropdown(!showStateDropdown)}
                className="w-full h-14 px-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 text-left"
              >
                <span className={selectedState ? "text-slate-700" : "text-slate-400"}>
                  {selectedState 
                    ? statesData.find(s => s.slug === selectedState)?.name || 'Select State'
                    : 'Select State'}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              
              {showStateDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-60 overflow-y-auto">
                  {statesData.map((state) => (
                    <button
                      key={state.id}
                      onClick={() => handleStateSelect(state)}
                      className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 flex items-center justify-between transition-colors"
                    >
                      <span className="text-slate-700">{state.name}</span>
                      {selectedState === state.slug && (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* City Dropdown */}
            <div className="relative w-full sm:w-44">
              <button
                onClick={() => setShowCityDropdown(!showCityDropdown)}
                disabled={!selectedState}
                className="w-full h-14 px-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={selectedCity ? "text-slate-700" : "text-slate-400"}>
                  {selectedCity 
                    ? citiesData.find(c => c.slug === selectedCity)?.name || 'Select City'
                    : 'Select City'}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              
              {showCityDropdown && selectedState && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-60 overflow-y-auto">
                  {citiesData.map((city) => (
                    <button
                      key={city.id}
                      onClick={() => handleCitySelect(city)}
                      className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 flex items-center justify-between transition-colors"
                    >
                      <span className="text-slate-700">{city.name}</span>
                      {selectedCity === city.slug && (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Search Button */}
          <Button 
            onClick={handleSearch}
            className="h-14 px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl text-white font-semibold text-base shadow-lg shadow-emerald-600/25"
          >
            <Search className="h-5 w-5 mr-2" />
            <span className="hidden sm:inline">Find Dentist</span>
            <span className="sm:hidden">Search</span>
          </Button>
        </div>
      </div>
    </div>
  );
}