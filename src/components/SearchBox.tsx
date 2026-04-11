import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Search, ArrowRight, Stethoscope, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCitiesByStateSlug, useCities } from "@/hooks/useLocations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SearchBoxProps {
  variant?: "default" | "compact" | "hero";
  defaultCity?: string;
  defaultTreatment?: string;
  stateSlug?: string;
  showInsurance?: boolean;
}

interface SearchOption {
  value: string;
  label: string;
  slug?: string;
  stateSlug?: string;
}

function DynamicSearchInput({
  placeholder,
  options,
  value,
  onChange,
  icon: Icon,
  className = "",
}: {
  placeholder: string;
  options: SearchOption[];
  value: string;
  onChange: (value: string, label: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find display label for current value
  useEffect(() => {
    if (value) {
      const option = options.find(o => o.value === value);
      setDisplayValue(option?.label || value);
      setQuery(option?.label || value);
    } else {
      setDisplayValue("");
      setQuery("");
    }
  }, [value, options]);

  // Filter options based on query with fuzzy matching for typos
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options.slice(0, 20);
    const lowerQuery = query.toLowerCase();
    
    // Calculate similarity score for fuzzy matching
    const calculateSimilarity = (str: string): number => {
      const lowerStr = str.toLowerCase();
      // Exact match
      if (lowerStr.includes(lowerQuery)) return 100;
      
      // Calculate Levenshtein-like score for typos
      let matches = 0;
      for (let i = 0; i < lowerQuery.length; i++) {
        if (lowerStr.includes(lowerQuery[i])) matches++;
      }
      
      // Start with match score
      let score = (matches / lowerQuery.length) * 50;
      
      // Bonus for matching at start
      if (lowerStr.startsWith(lowerQuery)) score += 30;
      
      // Bonus for exact substring
      if (lowerStr.includes(lowerQuery)) score += 20;
      
      return score;
    };
    
    return options
      .map(o => ({ ...o, _score: calculateSimilarity(o.label) }))
      .filter(o => o._score > 30)
      .sort((a, b) => b._score - a._score)
      .slice(0, 20)
      .map(({ _score, ...o }) => o);
  }, [query, options]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery(displayValue);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [displayValue]);

  const handleSelect = (option: SearchOption) => {
    onChange(option.value, option.label);
    setQuery(option.label);
    setDisplayValue(option.label);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("", "");
    setQuery("");
    setDisplayValue("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        {Icon && <Icon className="absolute left-3 h-4 w-4 text-primary pointer-events-none" />}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`${Icon ? 'pl-10' : ''} pr-8 h-12 rounded-xl border-border bg-muted/30 text-base font-semibold focus-visible:ring-primary`}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-xl max-h-[280px] overflow-auto animate-in fade-in-0 zoom-in-95">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option)}
              className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors first:rounded-t-xl last:rounded-b-xl font-semibold text-foreground"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchBox({
  variant = "default",
  defaultCity,
  defaultTreatment,
  stateSlug: propStateSlug,
  showInsurance = true,
}: SearchBoxProps) {
  const navigate = useNavigate();
  const { stateSlug: routeStateSlug, citySlug: routeCitySlug } = useParams();
  const [city, setCity] = useState<string>(defaultCity ?? "");
  const [cityLabel, setCityLabel] = useState<string>("");
  const [treatment, setTreatment] = useState<string>(defaultTreatment ?? "");
  const [treatmentLabel, setTreatmentLabel] = useState<string>("");
  const [insurance, setInsurance] = useState<string>("");
  const [insuranceLabel, setInsuranceLabel] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("city");

  const stateContext = propStateSlug || routeStateSlug;

  const { data: stateCitiesData } = useCitiesByStateSlug(stateContext || '');
  const { data: allCitiesData } = useCities();
  const citiesData = stateContext && stateCitiesData?.length ? stateCitiesData : allCitiesData;

  const { data: treatmentsData } = useQuery({
    queryKey: ['search-treatments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
  });

  const { data: insurancesData } = useQuery({
    queryKey: ['search-insurances'],
    queryFn: async () => {
      const { data } = await supabase
        .from('insurances')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: showInsurance,
  });

  useEffect(() => {
    if (routeCitySlug && stateContext && citiesData?.length && !city) {
      const matchingCity = citiesData.find(c => c.slug === routeCitySlug);
      if (matchingCity) {
        const value = `${matchingCity.slug}|${stateContext}`;
        setCity(value);
        setCityLabel(`${matchingCity.name}${(matchingCity as any).state?.abbreviation ? `, ${(matchingCity as any).state?.abbreviation}` : ''}`);
      }
    }
  }, [routeCitySlug, stateContext, citiesData, city]);

  useEffect(() => {
    if (defaultCity && !city) setCity(defaultCity);
  }, [defaultCity, city]);

  useEffect(() => {
    if (defaultTreatment && !treatment) setTreatment(defaultTreatment);
  }, [defaultTreatment, treatment]);

  // Build options
  const cityOptions: SearchOption[] = useMemo(() => 
    citiesData?.map(c => ({
      value: `${c.slug}|${(c as any).state?.slug || ''}`,
      label: `${c.name}${(c as any).state?.abbreviation ? `, ${(c as any).state?.abbreviation}` : ''}`,
      slug: c.slug,
      stateSlug: (c as any).state?.slug || '',
    })) || [], 
  [citiesData]);

  const treatmentOptions: SearchOption[] = useMemo(() => 
    treatmentsData?.map(t => ({
      value: t.slug,
      label: t.name,
      slug: t.slug,
    })) || [], 
  [treatmentsData]);

  const insuranceOptions: SearchOption[] = useMemo(() => 
    insurancesData?.map(ins => ({
      value: ins.slug,
      label: ins.name,
      slug: ins.slug,
    })) || [], 
  [insurancesData]);

  const handleSearch = () => {
    if (city) {
      const [citySlug, targetStateSlug] = city.split('|');
      
      if (insurance) {
        const params = new URLSearchParams();
        params.set('city', citySlug);
        params.set('state', targetStateSlug);
        if (treatment) {
          params.set('treatment', treatment);
        }
        navigate(`/insurance/${insurance}?${params.toString()}`);
        return;
      }
      
      if (treatment) {
        navigate(`/${targetStateSlug}/${citySlug}/${treatment}`);
      } else {
        navigate(`/${targetStateSlug}/${citySlug}`);
      }
    } else if (insurance) {
      navigate(`/insurance/${insurance}`);
    } else if (stateContext) {
      navigate(`/${stateContext}`);
    } else {
      navigate('/search');
    }
  };

  if (variant === "hero") {
    return (
      <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl md:rounded-full p-3 md:p-2 shadow-2xl shadow-primary/5">
        {/* Mobile: Tabs Layout */}
        <div className="md:hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-3 bg-muted/50 rounded-2xl h-auto p-1">
              <TabsTrigger value="city" className="rounded-xl font-bold text-xs py-2 gap-1 data-[state=active]:bg-background">
                <MapPin className="h-3.5 w-3.5" />
                City
              </TabsTrigger>
              <TabsTrigger value="treatment" className="rounded-xl font-bold text-xs py-2 gap-1 data-[state=active]:bg-background">
                <Stethoscope className="h-3.5 w-3.5" />
                Service
              </TabsTrigger>
              {showInsurance && (
                <TabsTrigger value="insurance" className="rounded-xl font-bold text-xs py-2 gap-1 data-[state=active]:bg-background">
                  <Shield className="h-3.5 w-3.5" />
                  Insurance
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="city" className="mt-0">
              <DynamicSearchInput
                placeholder={stateContext ? "Search city..." : "Search any city..."}
                options={cityOptions}
                value={city}
                onChange={(val, label) => { setCity(val); setCityLabel(label); }}
                icon={MapPin}
              />
            </TabsContent>
            
            <TabsContent value="treatment" className="mt-0">
              <DynamicSearchInput
                placeholder="Search treatment or service..."
                options={treatmentOptions}
                value={treatment}
                onChange={(val, label) => { setTreatment(val); setTreatmentLabel(label); }}
                icon={Stethoscope}
              />
            </TabsContent>

            {showInsurance && (
              <TabsContent value="insurance" className="mt-0">
                <DynamicSearchInput
                  placeholder="Search insurance provider..."
                  options={insuranceOptions}
                  value={insurance}
                  onChange={(val, label) => { setInsurance(val); setInsuranceLabel(label); }}
                  icon={Shield}
                />
              </TabsContent>
            )}
          </Tabs>
          
          <Button
            onClick={handleSearch}
            size="lg"
            className="w-full h-12 mt-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-lg shadow-primary/25"
          >
            <Search className="h-5 w-5" />
            Search
          </Button>
        </div>

        {/* Desktop: Horizontal Layout */}
        <div className="hidden md:flex items-center gap-2">
          {/* Location */}
          <div className="flex-1 min-w-0">
            <DynamicSearchInput
              placeholder={stateContext ? "Search city..." : "All Cities"}
              options={cityOptions}
              value={city}
              onChange={(val, label) => { setCity(val); setCityLabel(label); }}
              icon={MapPin}
              className="[&_input]:rounded-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:hover:bg-muted/50"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-border/50" />

          {/* Treatment */}
          <div className="flex-1 min-w-0">
            <DynamicSearchInput
              placeholder="All Treatments"
              options={treatmentOptions}
              value={treatment}
              onChange={(val, label) => { setTreatment(val); setTreatmentLabel(label); }}
              className="[&_input]:rounded-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:hover:bg-muted/50"
            />
          </div>

          {/* Insurance - Desktop */}
          {showInsurance && (
            <>
              <div className="w-px h-8 bg-border/50" />
              <div className="flex-1 min-w-0">
                <DynamicSearchInput
                  placeholder="Insurance"
                  options={insuranceOptions}
                  value={insurance}
                  onChange={(val, label) => { setInsurance(val); setInsuranceLabel(label); }}
                  icon={Shield}
                  className="[&_input]:rounded-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:hover:bg-muted/50"
                />
              </div>
            </>
          )}

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            size="lg"
            className="h-12 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shrink-0 shadow-lg shadow-primary/25"
          >
            <Search className="h-5 w-5" />
            Search
          </Button>
        </div>
      </div>
    );
  }

  // Default/Compact variant
  return (
    <div className="search-box p-2 flex flex-col lg:flex-row items-stretch gap-2">
      {/* City Search */}
      <div className="flex-1">
        <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 px-1">
          SELECT CITY
        </div>
        <DynamicSearchInput
          placeholder="Search any city..."
          options={cityOptions}
          value={city}
          onChange={(val, label) => { setCity(val); setCityLabel(label); }}
          icon={MapPin}
        />
      </div>

      {/* Treatment Search */}
      <div className="flex-1">
        <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 px-1">
          TREATMENT
        </div>
        <DynamicSearchInput
          placeholder="Search treatment..."
          options={treatmentOptions}
          value={treatment}
          onChange={(val, label) => { setTreatment(val); setTreatmentLabel(label); }}
          icon={Stethoscope}
        />
      </div>

      {/* Insurance Search */}
      {showInsurance && (
        <div className="flex-1">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 px-1">
            INSURANCE
          </div>
          <DynamicSearchInput
            placeholder="Search insurance..."
            options={insuranceOptions}
            value={insurance}
            onChange={(val, label) => { setInsurance(val); setInsuranceLabel(label); }}
            icon={Shield}
          />
        </div>
      )}

      {/* Search Button */}
      <div className="flex items-end">
        <Button
          onClick={handleSearch}
          size="lg"
          className="h-12 px-8 rounded-xl text-sm font-bold uppercase tracking-wide gap-2 bg-foreground text-card hover:bg-foreground/90"
        >
          START SEARCH
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
