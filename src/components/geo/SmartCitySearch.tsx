import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Search, Plus, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartCitySearchProps {
  value: { stateId: string; cityId: string; stateName?: string; cityName?: string } | null;
  onChange: (value: { stateId: string; cityId: string; stateName: string; cityName: string; isNewCity?: boolean } | null) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface CityResult {
  id: string;
  name: string;
  slug: string;
  seo_status?: string;
  state: {
    id: string;
    name: string;
    abbreviation: string;
    slug: string;
  };
  isNew?: boolean;
}

export function SmartCitySearch({
  value,
  onChange,
  error,
  disabled,
  placeholder = "Search city, e.g. 'Austin, TX'",
  className,
}: SmartCitySearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Search cities from database
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ["city-search", searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];

      // Parse search term for state abbreviation
      const parts = searchTerm.split(",").map((p) => p.trim());
      const citySearch = parts[0];
      const stateSearch = parts[1]?.toUpperCase();

      // Search ALL cities regardless of seo_status - users should be able to list in any city
      let query = supabase
        .from("cities")
        .select(`
          id, name, slug, seo_status,
          state:states!inner(id, name, abbreviation, slug)
        `)
        .ilike("name", `%${citySearch}%`)
        .limit(30);

      if (stateSearch) {
        query = query.or(`abbreviation.ilike.%${stateSearch}%,name.ilike.%${stateSearch}%`, { foreignTable: "states" });
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((city: any) => ({
        id: city.id,
        name: city.name,
        slug: city.slug,
        seo_status: city.seo_status,
        state: city.state,
      })) as CityResult[];
    },
    enabled: searchTerm.length >= 2,
  });

  // Get all states for new city creation - include all states
  const { data: states = [] } = useQuery({
    queryKey: ["states-for-search"],
    queryFn: async () => {
      const { data } = await supabase
        .from("states")
        .select("id, name, abbreviation, slug")
        .order("name");
      return data || [];
    },
  });

  // Mutation to add new city
  const addCityMutation = useMutation({
    mutationFn: async ({ cityName, stateId }: { cityName: string; stateId: string }) => {
      const state = states.find((s: any) => s.id === stateId);
      if (!state) throw new Error("State not found");

      // Generate slug
      const slug = cityName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      // Check if city already exists
      const { data: existing } = await supabase
        .from("cities")
        .select("id")
        .eq("slug", slug)
        .eq("state_id", stateId)
        .maybeSingle();

      if (existing) {
        throw new Error("City already exists");
      }

      // Create new city (inactive by default, flagged for review)
      const { data: newCity, error } = await supabase
        .from("cities")
        .insert({
          name: cityName,
          slug,
          state_id: stateId,
          is_active: true,
          auto_created: true,
          seo_status: "inactive",
          page_exists: false,
        })
        .select(`
          id, name, slug,
          state:states!inner(id, name, abbreviation, slug)
        `)
        .single();

      if (error) throw error;

      // Enqueue page generation for the new city
      try {
        await supabase.functions.invoke("geo-expansion", {
          body: {
            action: "enqueue_page",
            entityType: "city",
            entityId: newCity.id,
          },
        });
      } catch (e) {
        console.error("Failed to enqueue page generation:", e);
      }

      return newCity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city-search"] });
      queryClient.invalidateQueries({ queryKey: ["cities"] });
    },
  });

  // Check if we should show "add new city" option
  const showAddOption =
    searchTerm.length >= 2 &&
    !isLoading &&
    searchResults.length === 0 &&
    searchTerm.includes(",");

  const parsedNewCity = showAddOption
    ? (() => {
        const parts = searchTerm.split(",").map((p) => p.trim());
        const cityName = parts[0];
        const stateSearch = parts[1]?.toUpperCase();
        const matchedState = states.find(
          (s: any) =>
            s.abbreviation.toUpperCase() === stateSearch ||
            s.name.toUpperCase() === stateSearch
        );
        return matchedState ? { cityName, state: matchedState } : null;
      })()
    : null;

  // Handle selection
  const handleSelect = (city: CityResult, isNew = false) => {
    setSelectedDisplay(`${city.name}, ${city.state.abbreviation}`);
    setSearchTerm("");
    setIsOpen(false);
    onChange({
      stateId: city.state.id,
      cityId: city.id,
      stateName: city.state.name,
      cityName: city.name,
      isNewCity: isNew,
    });
  };

  // Handle adding new city
  const handleAddNewCity = async () => {
    if (!parsedNewCity) return;

    try {
      const newCity = await addCityMutation.mutateAsync({
        cityName: parsedNewCity.cityName,
        stateId: parsedNewCity.state.id,
      });

      handleSelect(
        {
          id: newCity.id,
          name: newCity.name,
          slug: newCity.slug,
          state: newCity.state as any,
        },
        true
      );
    } catch (error: any) {
      console.error("Failed to add city:", error);
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update display when value changes externally
  useEffect(() => {
    if (value?.cityName && value?.stateName) {
      const state = states.find((s: any) => s.id === value.stateId);
      setSelectedDisplay(`${value.cityName}, ${state?.abbreviation || ""}`);
    } else if (!value) {
      setSelectedDisplay("");
    }
  }, [value, states]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Label className="font-bold">City *</Label>
      <div className="relative mt-2">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          value={isOpen ? searchTerm : selectedDisplay}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            if (selectedDisplay) {
              setSearchTerm("");
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pl-12 pr-10 h-12 rounded-xl",
            error && "border-destructive"
          )}
        />
        {isLoading ? (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {error && <p className="text-sm text-destructive mt-1">{error}</p>}

      {/* Dropdown */}
      {isOpen && (searchTerm.length >= 2 || selectedDisplay) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-lg overflow-hidden">
          {isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Searching...
            </div>
          )}

          {!isLoading && searchResults.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {searchResults.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleSelect(city)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {city.name}, {city.state.abbreviation}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {city.state.name}
                    </div>
                  </div>
                  {value?.cityId === city.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Add new city option */}
          {parsedNewCity && (
            <div className="border-t">
              <button
                type="button"
                onClick={handleAddNewCity}
                disabled={addCityMutation.isPending}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left bg-primary/5"
              >
                {addCityMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                ) : (
                  <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-primary">
                    Add "{parsedNewCity.cityName}, {parsedNewCity.state.abbreviation}"
                  </div>
                  <div className="text-xs text-muted-foreground">
                    This city will be added to our database
                  </div>
                </div>
                <Badge variant="outline" className="flex-shrink-0 text-xs">
                  New
                </Badge>
              </button>
            </div>
          )}

          {/* No results message */}
          {!isLoading && searchResults.length === 0 && !parsedNewCity && searchTerm.length >= 2 && (
            <div className="p-4 text-center">
              <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No cities found. Try "City, State" format
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                e.g., "Austin, TX" or "Miami, Florida"
              </p>
            </div>
          )}

          {/* Hint for short searches */}
          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
}
