import { useState, useMemo } from "react";
import { MapPin, ShieldCheck, ArrowRight, Building2, Search as SearchIcon, ChevronDown, X, Stethoscope, Star, Calculator, Shield, Zap } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useRealCounts } from "@/hooks/useRealCounts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/seo/SEOHead";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

const Search = () => {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllCities, setShowAllCities] = useState(false);

  const { data: realCounts } = useRealCounts();
  const { data: seoContent } = useSeoPageContent("search");

  // Fetch treatments
  const { data: treatments } = useQuery({
    queryKey: ["treatments-directory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch states
  const { data: states, isLoading: statesLoading } = useQuery({
    queryKey: ["states-directory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("states")
        .select("id, name, slug, abbreviation")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch cities for selected state (or all top cities)
  const { data: cities, isLoading: citiesLoading } = useQuery({
    queryKey: ["directory-cities", selectedState],
    queryFn: async () => {
      let query = supabase
        .from("cities")
        .select(`id, name, slug, dentist_count, state:states(id, name, slug, abbreviation)`)
        .eq("is_active", true)
        .order("dentist_count", { ascending: false });

      if (selectedState) {
        query = query.eq("state_id", selectedState);
      }
      
      const { data } = await query.limit(200);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter cities by search
  const filteredCities = useMemo(() => {
    if (!cities) return [];
    if (!searchQuery.trim()) return cities;
    const q = searchQuery.toLowerCase();
    return cities.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.state as any)?.name?.toLowerCase().includes(q) ||
      (c.state as any)?.abbreviation?.toLowerCase().includes(q)
    );
  }, [cities, searchQuery]);

  const displayCities = showAllCities ? filteredCities : filteredCities.slice(0, 24);
  const selectedStateName = states?.find(s => s.id === selectedState)?.name;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Dental Directory" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoContent?.meta_title || "Dental Directory | Find Dentists by State & City"}
        description={seoContent?.meta_description || "Browse our comprehensive directory of verified dentists across the United States. Filter by state, city, and treatment to find the perfect dental professional."}
        canonical="/search/"
        keywords={["dental directory", "find dentist USA", "dentist directory", "dental clinics by state"]}
      />
      <Navbar />

      {/* Clean Hero */}
      <section className="border-b border-border bg-gradient-to-b from-background to-muted/30 pt-4 pb-10 md:pb-14">
        <div className="container px-4">
          <div className="flex justify-center mb-4">
            <Breadcrumbs items={breadcrumbs} />
          </div>
          
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 font-bold text-xs border-primary/30 text-primary">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              {realCounts?.clinics?.toLocaleString() || 0}+ Verified Providers
            </Badge>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-foreground tracking-tight mb-3">
              US Dental <span className="text-primary">Directory</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mb-6 max-w-xl mx-auto">
              Find top-rated dentists across {realCounts?.states || 4} states and {realCounts?.cities?.toLocaleString() || 0}+ cities. Browse by location or specialty.
            </p>

            {/* Quick stats */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3">
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 shadow-sm">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">{realCounts?.clinics?.toLocaleString() || 0}</span>
                <span className="text-xs text-muted-foreground">Clinics</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 shadow-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">{realCounts?.cities?.toLocaleString() || 0}</span>
                <span className="text-xs text-muted-foreground">Cities</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 shadow-sm">
                <Star className="h-4 w-4 text-gold fill-gold" />
                <span className="font-bold text-sm">4.8</span>
                <span className="text-xs text-muted-foreground">Avg Rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="sticky top-16 z-30 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-10 font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* State filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => { setSelectedState(null); setShowAllCities(false); }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  !selectedState 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All States
              </button>
              {states?.map(state => (
                <button
                  key={state.id}
                  onClick={() => { setSelectedState(state.id); setShowAllCities(false); }}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedState === state.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {state.abbreviation}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* State Cards (when no state selected) */}
      {!selectedState && (
        <section className="py-8 md:py-12">
          <div className="container px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg md:text-2xl font-black text-foreground">
                  Browse by <span className="text-primary">State</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Select a state to see all cities</p>
              </div>
            </div>
            
            {statesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {states?.map(state => (
                  <button
                    key={state.id}
                    onClick={() => setSelectedState(state.id)}
                    className="group bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {state.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{state.abbreviation}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Cities Grid */}
      <section className={`py-8 md:py-12 ${!selectedState ? 'bg-muted/30' : ''}`}>
        <div className="container px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg md:text-2xl font-black text-foreground">
                {selectedState ? (
                  <>Dentists in <span className="text-primary">{selectedStateName}</span></>
                ) : (
                  <>Top Cities by <span className="text-primary">Dentist Count</span></>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {filteredCities.length} {filteredCities.length === 1 ? 'city' : 'cities'} found
                {searchQuery && ` for "${searchQuery}"`}
              </p>
            </div>
            {selectedState && (
              <Link to={`/${states?.find(s => s.id === selectedState)?.slug || ''}/`}>
                <Button variant="outline" size="sm" className="rounded-xl font-bold gap-1">
                  View State Page <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>

          {citiesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
          ) : displayCities.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayCities.map(city => (
                  <Link
                    key={city.id}
                    to={`/${(city.state as any)?.slug || ''}/${city.slug}/`}
                    className="group bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors text-sm truncate">
                          {city.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(city.state as any)?.abbreviation} • {city.dentist_count || 0} Dentists
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {(city.dentist_count || 0) > 20 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 rounded-lg font-bold">
                            Popular
                          </Badge>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              
              {!showAllCities && filteredCities.length > 24 && (
                <div className="text-center mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAllCities(true)}
                    className="rounded-xl font-bold gap-2"
                  >
                    Show All {filteredCities.length} Cities
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-card border border-border rounded-3xl">
              <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-1">No cities found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Select a state to browse cities'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Services Section */}
      <section className="py-8 md:py-12 border-t border-border">
        <div className="container px-4">
          <div className="text-center mb-6">
            <h2 className="text-lg md:text-2xl font-black text-foreground">
              Browse by <span className="text-primary">Treatment</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Find specialists for specific dental services</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
            {treatments?.map(treatment => (
              <Link
                key={treatment.id}
                to={`/services/${treatment.slug}/`}
                className="bg-card border border-border rounded-2xl px-4 py-2.5 font-bold text-foreground hover:border-primary hover:text-primary transition-all text-sm"
              >
                {treatment.name}
              </Link>
            ))}
          </div>
          
          <div className="text-center mt-6">
            <Button asChild variant="outline" className="rounded-xl font-bold gap-1">
              <Link to="/services/">
                View All Services <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Free Tools Section */}
      <section className="py-8 md:py-12 border-t border-border">
        <div className="container px-4">
          <div className="text-center mb-6">
            <h2 className="text-lg md:text-2xl font-black text-foreground">
              Free Dental <span className="text-primary">Tools</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Compare costs, check insurance, and find emergency care</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <Link
              to="/tools/dental-cost-calculator"
              className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all text-center"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">Dental Cost Calculator</h3>
              <p className="text-xs text-muted-foreground">Compare real prices from verified dentists</p>
            </Link>
            
            <Link
              to="/tools/insurance-checker"
              className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all text-center"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">Insurance Checker</h3>
              <p className="text-xs text-muted-foreground">Find dentists who accept your plan</p>
            </Link>
            
            <Link
              to="/emergency-dentist"
              className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all text-center"
            >
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-destructive/20 transition-colors">
                <Zap className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">Emergency Dentist</h3>
              <p className="text-xs text-muted-foreground">Find dentists open now near you</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-8 border-t border-border bg-muted/20">
        <div className="container px-4">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-3xl mx-auto border-l-4 border-l-primary">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">All Providers Are Licensed</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every dental professional listed in our directory is a licensed practitioner. Browse by state or city, compare patient reviews, and book appointments directly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Search;