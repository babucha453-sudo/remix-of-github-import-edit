import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, MapPin, List, Grid3X3, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

import { DentistFinderSearch } from "./DentistFinderSearch";
import { HeroSearchBar } from "./HeroSearchBar";
import { DentistFinderFilters, useFinderFilters, FinderFilters } from "./DentistFinderFilters";
import { FilterPanel, FilterState } from "./FilterPanel";
import { DentistFinderCard, DentistFinderProfile } from "./DentistFinderCard";
import { DentistFinderMap, DentistMapMarker } from "./DentistFinderMap";

interface DentistFinderLayoutProps {
  title?: string;
  description?: string;
  initialLocation?: string;
  initialCityId?: string;
  initialStateId?: string;
  showFilters?: boolean;
  className?: string;
}

export function DentistFinderLayout({
  title = "Find Dentists",
  description = "Search for dentists and dental clinics near you",
  initialLocation,
  initialCityId,
  initialStateId,
  showFilters = true,
  className
}: DentistFinderLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, updateFilters, clearFilters, activeFilterCount } = useFinderFilters();
  
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'split'>('list');
  const [highlightedProfileId, setHighlightedProfileId] = useState<string | null>(null);
  
  // Pagination
  const [displayCount, setDisplayCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Get search params
  const searchService = searchParams.get('service') || '';
  const searchLocation = searchParams.get('location') || '';

  // Fetch clinics/dentists based on location and filters
  const { data: rawClinics, isLoading, error, refetch } = useQuery({
    queryKey: ['finder-profiles', initialCityId, initialStateId],
    queryFn: async () => {
      // If we have a city or state, filter by that
      if (initialCityId) {
        const { data, error } = await supabase
          .from('clinics')
          .select('*, cities(name, slug, state:states(name, abbreviation))')
          .eq('city_id', initialCityId)
          .eq('is_active', true)
          .limit(100);
        if (error) throw error;
        return data;
      }
      
      // Otherwise fetch all active clinics (fallback)
      const { data, error } = await supabase
        .from('clinics')
        .select('*, cities(name, slug, state:states(name, abbreviation))')
        .eq('is_active', true)
        .limit(100);
      if (error) throw error;
      return data;
    },
    // Always fetch - no conditional enabled
  });

  // Transform raw clinic data to profile format
  const profiles = useMemo((): DentistFinderProfile[] => {
    if (!rawClinics) return [];
    return rawClinics.map((clinic: any): DentistFinderProfile => ({
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      type: 'clinic',
      specialty: 'Dental Clinic',
      description: clinic.description || undefined,
      location: clinic.city ? `${clinic.city.name}, ${clinic.state?.abbreviation || ''}` : clinic.state?.name || '',
      address: clinic.address || undefined,
      phone: clinic.phone || undefined,
      latitude: clinic.latitude || undefined,
      longitude: clinic.longitude || undefined,
      rating: clinic.rating || 0,
      reviewCount: clinic.review_count || 0,
      image: clinic.cover_image_url || undefined,
      isVerified: clinic.verification_status === 'verified',
      isClaimed: clinic.claim_status === 'claimed',
      acceptsNewPatients: clinic.claim_status === 'claimed',
      hasBookNow: clinic.claim_status === 'claimed',
    }));
  }, [rawClinics]);

  // Map markers from profiles
  const mapMarkers = useMemo((): DentistMapMarker[] => {
    if (!profiles) return [];
    return profiles
      .filter(p => p.latitude && p.longitude)
      .map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        latitude: p.latitude!,
        longitude: p.longitude!,
        address: p.address,
        rating: p.rating,
        isVerified: p.isVerified,
        hasBookNow: p.hasBookNow
      }));
  }, [profiles]);

  // Displayed profiles (paginated)
  const displayedProfiles = useMemo(() => {
    if (!profiles) return [];
    return profiles.slice(0, displayCount);
  }, [profiles, displayCount]);

  const hasMore = profiles && displayCount < profiles.length;

  // Load more profiles
  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    
    // Simulate loading delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    setDisplayCount(prev => prev + 20);
    setIsLoadingMore(false);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayCount(20);
  }, [filters.sortBy, filters.verified, filters.acceptingNewPatients]);

  const handleSearch = (service: string, location: string) => {
    const params = new URLSearchParams();
    if (service) params.set('service', service);
    if (location) params.set('location', location);
    setSearchParams(params);
  };

  const handleMarkerClick = (marker: DentistMapMarker) => {
    setHighlightedProfileId(marker.id);
    // Scroll to the profile card
    const element = document.getElementById(`profile-${marker.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className={cn("min-h-screen bg-slate-50 flex flex-col", className)}>
      <Navbar />
      
      {/* Hero / Search Section - Professional Dark Theme */}
      <div className="relative bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 px-4 py-12 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Accent */}
        <div className="absolute inset-0 opacity-15">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-teal-500 via-transparent to-transparent" />
        </div>
        
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3">
              {title}
            </h1>
            {description && (
              <p className="text-emerald-300 text-base sm:text-lg max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </div>
          
          {/* Search Bar */}
          <div className="max-w-5xl mx-auto">
            <HeroSearchBar
              initialService={searchService}
              initialLocation={searchLocation || initialLocation}
              onSearch={(service, location, state, city) => handleSearch(service, location)}
            />
          </div>
          
          {/* Quick Filters Strip */}
          <div className="max-w-4xl mx-auto mt-6">
            <div className="flex flex-wrap justify-center gap-2">
              {['Teeth Cleaning', 'Teeth Whitening', 'Dental Implants', 'Braces'].map((service) => (
                <button
                  key={service}
                  onClick={() => handleSearch(service, '')}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20 hover:border-white/40"
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          {/* Active Filters Summary */}
          {activeFilterCount() > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-emerald-300 text-sm">Active filters:</span>
              {filters.acceptingNewPatients && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  New Patients
                </Badge>
              )}
              {filters.verified && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified
                </Badge>
              )}
              {filters.bookNow && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Book Now
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-emerald-400 hover:text-white hover:bg-emerald-500/20"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Professional White Section */}
      <div className="relative">
        {/* Top Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            {/* Results Count */}
            <div className="flex items-center gap-3">
              {isLoading ? (
                <Skeleton className="h-6 w-32" />
              ) : (
                <p className="text-slate-600">
                  <span className="font-bold text-slate-900 text-lg">
                    {profiles?.length || 0}
                  </span>
                  <span className="text-slate-500 ml-1">dentists found</span>
                </p>
              )}
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-3">
              {/* Sort Dropdown */}
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilters({ sortBy: e.target.value as any })}
                className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="rating">Highest Rated</option>
                <option value="reviews">Most Reviewed</option>
                <option value="name">Name (A-Z)</option>
                <option value="distance">Nearest</option>
              </select>

              {/* Filter Button (mobile) */}
              {showFilters && (
                <Button
                  variant="outline"
                  className="lg:hidden gap-2 border-slate-200"
                  onClick={() => {
                    // This would open a sheet in mobile
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount() > 0 && (
                    <span className="bg-emerald-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {activeFilterCount()}
                    </span>
                  )}
                </Button>
              )}

              {/* View Mode Toggle (desktop) */}
              <div className="hidden lg:flex bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2.5 rounded-lg transition-all",
                    viewMode === 'list' 
                      ? "bg-white shadow-sm text-emerald-600" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={cn(
                    "p-2.5 rounded-lg transition-all",
                    viewMode === 'map' 
                      ? "bg-white shadow-sm text-emerald-600" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <MapPin className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={cn(
                    "p-2.5 rounded-lg transition-all",
                    viewMode === 'split' 
                      ? "bg-white shadow-sm text-emerald-600" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content Grid - Wider Sidebar */}
          <div className="flex gap-8">
            {/* Filters Sidebar (desktop) - Wider */}
            {showFilters && (
              <div className="hidden lg:block w-80 shrink-0">
                <div className="sticky top-6">
                  <DentistFinderFilters
                    filters={filters}
                    onFiltersChange={updateFilters}
                    variant="sidebar"
                  />
                </div>
              </div>
            )}

            {/* Results */}
            <div className="flex-1 min-w-0">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                  <p className="text-red-700 font-medium">Failed to load dentists</p>
                  <p className="text-red-500 text-sm mt-1">{error.message}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => refetch()}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {isLoading && !profiles && (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200">
                      <div className="flex gap-4">
                        <Skeleton className="h-20 w-20 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && !error && profiles && profiles.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">No dentists found</h3>
                  <p className="text-slate-500 mb-4">
                    Try adjusting your filters or search in a different location
                  </p>
                  <Button onClick={clearFilters} className="bg-emerald-600 hover:bg-emerald-700">
                    Clear Filters
                  </Button>
                </div>
              )}

              {/* Results List */}
              {!isLoading && !error && displayedProfiles.length > 0 && (
                <div className={cn(
                  "space-y-4",
                  viewMode === 'map' ? "hidden lg:grid lg:grid-cols-2 lg:gap-4" : ""
                )}>
                  {displayedProfiles.map((profile) => (
                    <div key={profile.id} id={`profile-${profile.id}`}>
                      <DentistFinderCard
                        profile={profile}
                        isHighlighted={highlightedProfileId === profile.id}
                        onMarkerClick={() => {
                          setHighlightedProfileId(profile.id);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {profiles && profiles.length > 0 && (
                <div className="mt-8 flex justify-center items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={displayCount <= 20}
                    onClick={() => setDisplayCount(20)}
                    className="rounded-lg"
                  >
                    1
                  </Button>
                  {profiles.length > 20 && (
                    <Button
                      variant={displayCount > 20 ? "default" : "outline"}
                      size="sm"
                      disabled={displayCount > profiles.length}
                      onClick={() => setDisplayCount(40)}
                      className={displayCount > 20 ? "bg-emerald-600" : "rounded-lg"}
                    >
                      2
                    </Button>
                  )}
                  {profiles.length > 40 && (
                    <Button
                      variant={displayCount > 40 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDisplayCount(60)}
                      className={displayCount > 40 ? "bg-emerald-600" : "rounded-lg"}
                    >
                      3
                    </Button>
                  )}
                  {hasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="rounded-lg"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              
              <p className="text-center text-sm text-slate-500 mt-4">
                Showing {displayedProfiles.length} of {profiles?.length || 0} dentists
              </p>
            </div>

            {/* Map (split view) */}
            {(viewMode === 'map' || viewMode === 'split') && (
              <div className={cn(
                "shrink-0",
                viewMode === 'split' ? "w-[400px] hidden lg:block" : "flex-1"
              )}>
                <div className="sticky top-6">
                  <DentistFinderMap
                    markers={mapMarkers}
                    highlightedId={highlightedProfileId || undefined}
                    onMarkerClick={handleMarkerClick}
                    className="h-[600px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}