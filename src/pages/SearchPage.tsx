import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { 
  Search, MapPin, Star, Shield, Clock, ArrowRight, 
  Filter, ChevronDown, Phone, Globe, Calendar, Loader2,
  AlertCircle, CheckCircle, X, SlidersHorizontal, Grid, List,
  DollarSign, CalendarDays, Check
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SEOHead } from "@/components/seo/SEOHead";
import { useTreatments } from "@/hooks/useTreatments";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Clinic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  phone: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  city?: { name: string; slug: string } | null;
  state?: { name: string; slug: string; abbreviation: string } | null;
}

interface City {
  id: string;
  name: string;
  slug: string;
  state_abbreviation?: string;
}

interface State {
  id: string;
  name: string;
  abbreviation: string;
}

const RATING_OPTIONS = [4.5, 4.0, 3.5, 3.0];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: treatments } = useTreatments();
  
  // All clinics data
  const [allClinics, setAllClinics] = useState<Clinic[]>([]);
  const [allCities, setAllCities] = useState<City[]>([]);
  const [allStates, setAllStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Pagination - Show 100 dentists at a time
  const [displayCount, setDisplayCount] = useState(100);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreToLoad, setHasMoreToLoad] = useState(true);
  
  // State to store total count
  const [totalClinicCount, setTotalClinicCount] = useState(0);
  
  // Autocomplete
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<City[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  
  // Load initial clinics on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Get total count first (lightweight query)
        const { count: totalCount } = await supabase
          .from('clinics')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('is_duplicate', false);
        
        console.log("Total clinics count:", totalCount);
        setTotalClinicCount(totalCount || 0);
        
        // Fetch only 100 clinics initially - much faster
        const { data: clinicsData } = await supabase
          .from('clinics')
          .select(`
            id, name, slug, description, cover_image_url, phone, address, rating, review_count,
            city:cities(id, name, slug)
          `)
          .eq('is_active', true)
          .eq('is_duplicate', false)
          .order('rating', { ascending: false })
          .order('review_count', { ascending: false })
          .limit(100);
        
        console.log("Initial clinics loaded:", clinicsData?.length);
        setAllClinics((clinicsData || []) as any);
        
        // Fetch all cities (small dataset - ~500)
        const { data: citiesData } = await supabase
          .from('cities')
          .select('id, name, slug')
          .order('name')
          .limit(500);
        
        // Fetch all states
        const { data: statesData } = await supabase
          .from('states')
          .select('id, name, abbreviation')
          .order('name');
        
        setAllCities(citiesData || []);
        setAllStates(statesData || []);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Filter clinics based on selected filters
  const filteredClinics = useMemo(() => {
    let result = allClinics;
    
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name?.toLowerCase().includes(query) ||
        c.city?.name?.toLowerCase().includes(query) ||
        c.address?.toLowerCase().includes(query)
      );
    }
    
    // State filter
    if (selectedState) {
      result = result.filter(c => c.state?.abbreviation === selectedState);
    }
    
    // City filter
    if (selectedCity) {
      result = result.filter(c => c.city?.slug === selectedCity);
    }
    
    // Rating filter
    if (minRating > 0) {
      result = result.filter(c => (c.rating || 0) >= minRating);
    }
    
    // Treatment filter (would need clinic_treatments join - simplified for now)
    
    return result;
  }, [allClinics, searchQuery, selectedState, selectedCity, minRating]);
  
  // Get displayed clinics (with limit) - must be after filteredClinics
  const displayedClinics = useMemo(() => {
    return filteredClinics.slice(0, displayCount);
  }, [filteredClinics, displayCount]);
  
  const hasMore = displayCount < filteredClinics.length;
  const totalCount = filteredClinics.length;
  const totalAllClinics = allClinics.length;
  
  // Debug log
  console.log("allClinics length:", allClinics.length, "filteredClinics length:", filteredClinics.length, "totalClinicCount:", totalClinicCount);
  
  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(100);
  }, [searchQuery, selectedState, selectedCity, minRating, selectedTreatments]);
  
  // City autocomplete - filter cities based on input
  const filteredCitySuggestions = useMemo(() => {
    if (!citySearch) return allCities.slice(0, 10);
    const query = citySearch.toLowerCase();
    return allCities
      .filter(c => c.name.toLowerCase().includes(query) || c.slug.toLowerCase().includes(query))
      .slice(0, 10);
  }, [citySearch, allCities]);
  
  // Handle city selection
  const handleCitySelect = (city: City) => {
    setSelectedCity(city.slug);
    setCitySearch(city.name);
    setShowCitySuggestions(false);
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedState("");
    setSelectedCity("");
    setSelectedTreatments([]);
    setMinRating(0);
    setCitySearch("");
  };
  
  // Load more clinics from server
  const loadMoreClinics = async () => {
    if (loadingMore || !hasMoreToLoad) return;
    setLoadingMore(true);
    
    try {
      const offset = allClinics.length;
      const { data: moreClinics } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, description, cover_image_url, phone, address, rating, review_count,
          city:cities(id, name, slug)
        `)
        .eq('is_active', true)
        .eq('is_duplicate', false)
        .order('rating', { ascending: false })
        .order('review_count', { ascending: false })
        .range(offset, offset + 99);
      
      if (moreClinics && moreClinics.length > 0) {
        setAllClinics(prev => [...prev, ...(moreClinics as any)]);
      } else {
        setHasMoreToLoad(false);
      }
    } catch (error) {
      console.error("Error loading more clinics:", error);
    } finally {
      setLoadingMore(false);
    }
  };
  
  // Get unique states from clinics
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    allClinics.forEach(c => {
      if (c.state?.abbreviation) states.add(c.state.abbreviation);
    });
    return Array.from(states).sort();
  }, [allClinics]);
  
  // Get cities for selected state
  const availableCities = useMemo(() => {
    if (!selectedState) return [];
    const cities = new Set<string>();
    allClinics
      .filter(c => c.state?.abbreviation === selectedState && c.city?.slug)
      .forEach(c => cities.add(c.city!.slug));
    return Array.from(cities).sort();
  }, [allClinics, selectedState]);
  
  // Handle treatment toggle
  const toggleTreatment = (slug: string) => {
    setSelectedTreatments(prev => 
      prev.includes(slug) 
        ? prev.filter(t => t !== slug)
        : [...prev, slug]
    );
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      <SEOHead
        title="Find a Dentist Near You | Appoint Panda"
        description="Search and book appointments with top-rated dentists in your area. Compare reviews, check insurance, and book instantly."
        canonical="/search"
      />
      
      {/* SEO: Static content for search page - visible in HTML for Google */}
      <div className="sr-only" aria-hidden="true">
        <h2>Search for Dentists</h2>
        <p>Find top-rated dentists in your area. Search by city, state, or ZIP code. Filter by service type including general dentistry, cosmetic dentistry, orthodontics, dental implants, teeth cleaning, and more. Read patient reviews and book your appointment online.</p>
        <h3>Popular Locations</h3>
        <ul>
          <li>Los Angeles, California dentists</li>
          <li>New York City dentists</li>
          <li>Houston, Texas dentists</li>
          <li>Miami, Florida dentists</li>
        </ul>
        <h3>Popular Services</h3>
        <ul>
          <li>Teeth cleaning and checkups</li>
          <li>Dental implants</li>
          <li>Teeth whitening</li>
          <li>Invisalign and braces</li>
          <li>Root canal treatment</li>
          <li>Dental crowns</li>
        </ul>
      </div>
      <Navbar />
      
      {/* Hero Search Section - Emerald Theme */}
      <section className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2 text-center">
            Find Your Perfect Dentist
          </h1>
          <p className="text-emerald-100 text-center mb-8 max-w-2xl mx-auto">
            Browse {totalClinicCount > 0 ? totalClinicCount.toLocaleString() : allClinics.length}+ verified dentists. Read reviews, check insurance, book instantly.
          </p>
          
          {/* Main Search Bar */}
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-2">
            <div className="grid md:grid-cols-4 gap-2">
              {/* Location Search with Autocomplete */}
              <div className="md:col-span-2 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <MapPin className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  type="text"
                  value={citySearch}
                  onChange={(e) => {
                    setCitySearch(e.target.value);
                    setShowCitySuggestions(true);
                    setSelectedCity("");
                  }}
                  onFocus={() => setShowCitySuggestions(true)}
                  placeholder="Search city or ZIP code..."
                  className="h-14 pl-12 pr-4 text-base border-0 focus:ring-2 focus:ring-emerald-500"
                />
                {/* City Suggestions Dropdown */}
                {showCitySuggestions && filteredCitySuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-64 overflow-y-auto">
                    {filteredCitySuggestions.map(city => (
                      <button
                        key={city.id}
                        onClick={() => handleCitySelect(city)}
                        className="w-full px-4 py-3 text-left hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                      >
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{city.name}</span>
                        {city.state_abbreviation && (
                          <Badge variant="secondary" className="text-xs">{city.state_abbreviation}</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Treatment Search */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <select 
                  value={selectedTreatments[0] || ""}
                  onChange={(e) => setSelectedTreatments(e.target.value ? [e.target.value] : [])}
                  className="w-full h-14 pl-12 pr-10 rounded-xl border border-slate-200 appearance-none cursor-pointer bg-white text-slate-900"
                >
                  <option value="">Any Treatment</option>
                  {treatments?.map((treatment) => (
                    <option key={treatment.id} value={treatment.slug}>
                      {treatment.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>
              
              {/* Search Button */}
              <Button 
                className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-emerald-100">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span>{totalClinicCount > 0 ? totalClinicCount.toLocaleString() : allClinics.length}+ Verified Dentists</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              <span>Real Reviews</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>Instant Booking</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Main Content */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Filters */}
            <aside className={cn("lg:w-72 shrink-0", !showFilters && "hidden lg:block")}>
              <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-24">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-emerald-600 hover:text-emerald-700">
                    Clear All
                  </Button>
                </div>
                
                {/* State Filter */}
                <div className="mb-5">
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">State</Label>
                  <select 
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedCity("");
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                  >
                    <option value="">All States</option>
                    {availableStates.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                
                {/* City Filter */}
                <div className="mb-5">
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">City</Label>
                  <select 
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                    disabled={!selectedState}
                  >
                    <option value="">All Cities</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city.replace(/-/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                
                {/* Rating Filter */}
                <div className="mb-5">
                  <Label className="text-sm font-semibold text-slate-700 mb-3 block">Minimum Rating</Label>
                  <div className="space-y-2">
                    {RATING_OPTIONS.map(rating => (
                      <label key={rating} className="flex items-center gap-3 cursor-pointer">
                        <Checkbox 
                          checked={minRating === rating}
                          onCheckedChange={(checked) => setMinRating(checked ? rating : 0)}
                        />
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={cn(
                                "h-4 w-4", 
                                i < Math.floor(rating) 
                                  ? "fill-amber-400 text-amber-400" 
                                  : "text-slate-300"
                              )} 
                            />
                          ))}
                          <span className="text-sm text-slate-600 ml-1">& up</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Treatments Filter */}
                <div className="mb-5">
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">Treatments</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {treatments?.slice(0, 15).map(treatment => (
                      <label key={treatment.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox 
                          checked={selectedTreatments.includes(treatment.slug)}
                          onCheckedChange={() => toggleTreatment(treatment.slug)}
                        />
                        <span className="text-sm text-slate-600">{treatment.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Results Count */}
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    Showing <span className="font-bold text-slate-900">{displayedClinics.length}</span> of <span className="font-bold text-emerald-600">{totalAllClinics.toLocaleString()}</span> dentists
                  </p>
                </div>
              </div>
            </aside>
            
            {/* Results */}
            <div className="flex-1">
              {/* Results Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {totalAllClinics > 0 ? totalAllClinics.toLocaleString() : totalCount} Dentists Found
                  </h2>
                  {(selectedState || selectedCity) && (
                    <p className="text-slate-500 text-sm">
                      in {selectedCity.replace(/-/g, ' ')}{selectedState && `, ${selectedState}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="lg:hidden"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                    <Button 
                      variant={viewMode === "grid" ? "secondary" : "ghost"} 
                      size="icon"
                      className="rounded-none"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={viewMode === "list" ? "secondary" : "ghost"} 
                      size="icon"
                      className="rounded-none"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <span className="ml-3 text-slate-500">Loading dentists...</span>
                </div>
              )}
              
              {/* Empty State */}
              {!loading && filteredClinics.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Search className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No Dentists Found</h3>
                  <p className="text-slate-500 max-w-md mx-auto mb-6">
                    Try adjusting your filters or search in a different area.
                  </p>
                  <Button onClick={clearFilters} variant="outline">
                    Clear Filters
                  </Button>
                </div>
              )}
              
              {/* Grid View */}
              {!loading && viewMode === "grid" && displayedClinics.length > 0 && (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayedClinics.map(clinic => (
                    <Link
                      key={clinic.id}
                      to={`/clinic/${clinic.slug}`}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-lg transition-all group"
                    >
                      {/* Clinic Image */}
                      <div className="h-40 bg-slate-100 relative overflow-hidden">
                        {clinic.cover_image_url ? (
                          <img src={clinic.cover_image_url} alt={clinic.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Shield className="h-12 w-12 text-slate-300" />
                          </div>
                        )}
                        {clinic.rating && (
                          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-sm font-bold text-slate-900">{clinic.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Clinic Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-slate-900 mb-1 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                          {clinic.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-slate-500 mb-2">
                          <MapPin className="h-3 w-3" />
                          {clinic.city?.name || "Location TBD"}
                        </div>
                        {clinic.review_count && (
                          <p className="text-sm text-slate-500">
                            {clinic.review_count} reviews
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              
              {/* List View */}
              {!loading && viewMode === "list" && displayedClinics.length > 0 && (
                <div className="space-y-3">
                  {displayedClinics.map(clinic => (
                    <Link
                      key={clinic.id}
                      to={`/clinic/${clinic.slug}`}
                      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all flex gap-4 group"
                    >
                      {/* Clinic Image */}
                      <div className="w-24 h-24 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {clinic.cover_image_url ? (
                          <img src={clinic.cover_image_url} alt={clinic.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Shield className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                      
                      {/* Clinic Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                              {clinic.name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                              <MapPin className="h-3 w-3" />
                              {clinic.city?.name}, {clinic.state?.abbreviation}
                            </div>
                          </div>
                          {clinic.rating && (
                            <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              <span className="text-sm font-bold text-amber-700">{clinic.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        {clinic.review_count && (
                          <p className="text-sm text-slate-500 mt-1">
                            {clinic.review_count} reviews
                          </p>
                        )}
                        {clinic.address && (
                          <p className="text-sm text-slate-400 mt-1 truncate">
                            {clinic.address}
                          </p>
                        )}
                      </div>
                      
                      {/* Arrow */}
                      <div className="self-center">
                        <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              
              {/* Show More Button */}
              {(hasMore || hasMoreToLoad) && !loading && (
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={loadMoreClinics}
                    disabled={loadingMore}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Show More Dentists
                        <span className="ml-2 opacity-80">
                          ({totalClinicCount - allClinics.length} more)
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
