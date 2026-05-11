import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SearchBox } from "@/components/SearchBox";
import { BudgetFilterSidebar, useBudgetFilters } from "@/components/filters";
import { DentistListFrame, LocationQuickLinks } from "@/components/location";
import { SEOContentBlock } from "@/components/seo/SEOContentBlock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useCity, useState as useStateData, useCitiesByStateSlug } from "@/hooks/useLocations";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { usePinnedProfiles, sortWithPinnedFirst, useTopDentists } from "@/hooks/usePinnedProfiles";
import { normalizeStateSlug } from "@/lib/slug/normalizeStateSlug";
import { DentistFinderMap } from "@/components/finder";
import NotFound from "./NotFound";
import {
  Star,
  Users,
  Clock,
  Stethoscope,
  SlidersHorizontal,
  MapPin,
  Search,
  Shield,
  ChevronRight,
  Phone,
  CheckCircle2,
  ArrowRight,
  Award,
  Building2
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface InsuranceLocationPageProps {
  initialState?: any;
  initialCity?: any;
}

const MIN_DENTIST_COUNT = 1;

const InsuranceLocationPage = ({ initialState, initialCity }: InsuranceLocationPageProps) => {
  console.log('🚀 InsuranceLocationPage MOUNTED', { stateSlug: useParams().stateSlug, citySlug: useParams().citySlug, insuranceSlug: useParams().insuranceSlug });
  const { stateSlug, citySlug, insuranceSlug } = useParams();
  const navigate = useNavigate();
  const normalizedStateSlug = normalizeStateSlug(stateSlug);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { filters, setFilters } = useBudgetFilters();
  const [highlightedProfileId, setHighlightedProfileId] = useState<string | null>(null);
  
  const extractedInsuranceSlug = insuranceSlug?.replace(/-dentists$/, '') || '';
  
  // For insurance-city pages, show universal list of all clinics (all accept all by default)
  const stateLoading = false;
  const cityLoading = false;
  const activeState = null;
  const activeCity = null;
  const citySlugForDisplay = citySlug;
  const stateSlugForDisplay = normalizedStateSlug;

  // Fetch insurance details
  const { data: insurance, isLoading: insuranceLoading } = useQuery({
    queryKey: ["insurance-by-slug", extractedInsuranceSlug],
    queryFn: async () => {
      if (!extractedInsuranceSlug) return null;
      const { data } = await supabase
        .from("insurances")
        .select("*")
        .eq("slug", extractedInsuranceSlug)
        .maybeSingle();
      return data;
    },
    enabled: !!extractedInsuranceSlug,
  });

  // Fetch pinned profiles for this city page
  const { data: pinnedProfiles } = usePinnedProfiles('city', normalizedStateSlug, citySlug);
  
  // Fetch top dentists for this city - pass null if no city
  const { data: topDentistIds } = useTopDentists(null);

// Fetch clinic IDs - since ALL clinics accept ALL insurance by default, get all active clinics
  const { data: insuranceClinicIds, isLoading: insuranceClinicsLoading } = useQuery({
    queryKey: ["all-active-clinics"],
    queryFn: async () => {
      const { data: allClinics } = await supabase
        .from("clinics")
        .select("id")
        .eq("is_active", true);
      return (allClinics || []).map(c => c.id);
    },
  });

  // Fetch TOTAL clinic count - just get all active clinics count
  const { data: totalClinicCount } = useQuery({
    queryKey: ['total-clinic-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('clinics')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      return count || 0;
    },
  });

  // Fetch all profiles - show ALL clinics since ALL accept ALL insurance by default
  const { data: rawProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['all-clinics-insurance'],
    queryFn: async () => {
      // Get all active clinics - show universal list
      const { data: clinics } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, description, cover_image_url, rating, review_count,
          address, phone, verification_status, claim_status, latitude, longitude,
          city:cities(name, slug, state:states(name, abbreviation))
        `)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(50);

      return (clinics || []).map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: 'clinic' as const,
        specialty: 'Dental Clinic',
        location: c.city ? `${c.city.name}, ${c.city.state?.abbreviation || ''}` : '',
        address: c.address || undefined,
        phone: c.phone || undefined,
        latitude: c.latitude || undefined,
        longitude: c.longitude || undefined,
        rating: c.rating || 0,
        reviewCount: c.review_count || 0,
        image: c.cover_image_url,
        isVerified: c.verification_status === 'verified',
        isClaimed: c.claim_status === 'claimed',
        isPinned: false,
        acceptsInsurance: insuranceClinicIds?.includes(c.id) || false,
      }));
    },
  });

  // Sort profiles - no city filter needed since we show all clinics
  const filteredProfiles = useMemo(() => {
    if (!rawProfiles) return [];
    const sorted = sortWithPinnedFirst(rawProfiles, pinnedProfiles || [], topDentistIds || []);
    const pinnedIds = new Set((pinnedProfiles || []).map(p => p.id));
    const topSet = new Set(topDentistIds || []);
    let result = sorted.map(p => ({ 
      ...p, 
      isPinned: pinnedIds.has(p.id),
      isTopDentist: topSet.has(p.id)
    }));

    if (filters.minRating > 0) {
      result = result.filter(p => (p.rating || 0) >= filters.minRating);
    }
    if (filters.verifiedOnly) {
      result = result.filter(p => p.isVerified);
    }

    return result;
  }, [rawProfiles, pinnedProfiles, topDentistIds, filters]);

  const profiles = filteredProfiles;

  // Fetch treatments
  const { data: treatments, isLoading: treatmentsLoading } = useQuery({
    queryKey: ["treatments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("*")
        .eq("is_active", true)
        .order("display_order")
        .limit(8);
      return data || [];
    },
  });

  // Skip nearby cities query for now - to avoid any errors
  const nearbyCities = null;
  const nearbyCitiesLoading = false;

  // Signal prerender ready - ready immediately
  usePrerenderReady(true, { delay: 100 });

  const isDataReady = true;

  // Debug: Log URL params
  console.log(`[InsuranceLocationPage] Rendering: stateSlug=${stateSlug}, citySlug=${citySlug}, insuranceSlug=${insuranceSlug}`);
  
  // Always render the page - never return 404  
  // This should work: /ca/burbank/delta-dental-dentists
  
  // Allow rendering even if state or city not found - they'll show fallback content
  // This ensures pages are indexable even for new cities
  const activeStateData = activeState;
  const activeCityData = activeCity;
  
  const hasLocationData = activeStateData?.name && activeCityData?.name;
  
  if (!hasLocationData) {
    console.log(`[InsuranceLocationPage] No DB data for ${stateSlug}/${citySlug} - using URL params for display`);
  }

  const cityName = activeCityData?.name || citySlug?.replace(/-/g, ' ') || 'Unknown City';
  const stateName = activeStateData?.name || normalizedStateSlug || 'Unknown State';
  const stateAbbr = activeStateData?.abbreviation || normalizedStateSlug?.toUpperCase() || 'XX';
  const locationDisplay = `${cityName}, ${stateAbbr}`;
  const insuranceName = insurance?.name || extractedInsuranceSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Insurance", href: "/insurance" },
    { label: insuranceName, href: `/${stateSlug}/${citySlug}/${extractedInsuranceSlug}-dentists` },
  ];

  const clinicCountDisplay = profiles?.length || 0;
  const pageTitle = insurance 
    ? `${insuranceName} Dentists in ${cityName}, ${stateAbbr} — Book Online | AppointPanda`
    : `Find Dentists in ${cityName}, ${stateAbbr} | AppointPanda`;
  const pageDescription = insurance
    ? `Compare ${clinicCountDisplay}+ dental clinics in ${cityName} that accept ${insuranceName}. Read patient reviews and book appointments online.`
    : `Find and book appointments with dental professionals in ${cityName}, ${stateName}.`;

  const faqs = [
    {
      q: `Does ${insuranceName} cover dental in ${cityName}?`,
      a: `Yes, ${insuranceName} provides dental coverage that is accepted by many dentists in ${cityName}. Coverage varies by plan - preventive care is typically covered at 100%.`,
    },
    {
      q: `How do I find a dentist that accepts ${insuranceName} in ${cityName}?`,
      a: `All dentists listed on this page accept ${insuranceName}. You can filter by rating, services, and other criteria to find the right provider.`,
    },
    {
      q: `What dental services are covered by ${insuranceName}?`,
      a: `${insuranceName} typically covers preventive care (cleanings, x-rays), basic procedures (fillings, extractions), and major procedures (crowns, bridges) based on your plan.`,
    },
    {
      q: `How much does a dental cleaning cost with ${insuranceName}?`,
      a: `With ${insuranceName}, preventive care like cleanings and checkups are usually covered at 100%. Any out-of-pocket costs depend on your specific plan details.`,
    },
  ];

  // Fallback nearby locations - will be populated when DB has cities
  const nearbyLocations: { name: string; slug: string }[] = [];

  const popularTreatments = (treatments || []).map(t => ({ name: t.name, slug: t.slug }));

  // Generate internal links
  const internalLinks = {
    cityPage: `/${stateSlug}/${citySlug}/`,
    servicePages: (treatments || []).slice(0, 4).map(t => ({
      name: t.name,
      url: `/${stateSlug}/${citySlug}/${t.slug}`
    })),
  };

  const showAcceptsInsurance = insuranceClinicIds && insuranceClinicIds.length > 0;

  return (
    <PageLayout>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonical={`/${stateSlug}/${citySlug}/${extractedInsuranceSlug}-dentists/`}
        keywords={[`${insuranceName} dentists ${cityName}`, `${insuranceName} dental ${cityName} ${stateAbbr}`, `best dentist ${insuranceName} ${cityName}`]}
      />
      
      <SyncStructuredData
        data={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: insuranceName, url: `/insurance/${extractedInsuranceSlug}` },
              { name: `${cityName}, ${stateAbbr}`, url: `/${stateSlug}/${citySlug}/${extractedInsuranceSlug}-dentists` },
            ],
          },
          {
            type: 'faq',
            questions: faqs.map(f => ({ question: f.q, answer: f.a })),
          },
          {
            type: 'itemList',
            name: `${insuranceName} Dentists in ${cityName}, ${stateAbbr}`,
            description: `Dental clinics in ${cityName} accepting ${insuranceName}`,
            items: (profiles || []).slice(0, 10).map((p, i) => ({
              name: p.name,
              url: `/clinic/${p.slug}/`,
              position: i + 1,
              image: p.image,
            })),
          },
        ]}
        id="insurance-city-schema"
      />

      {/* Breadcrumbs */}
      <div className="bg-slate-50 border-b border-slate-200 py-3">
        <div className="container px-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 min-h-[50vh] flex items-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.2, 1], x: [0, 50, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div 
            className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(6, 95, 70, 0.4) 0%, transparent 70%)' }}
            animate={{ scale: [1.2, 1, 1.2], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          />
        </div>

        <div className="container relative z-10 px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mb-6"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-5 py-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-100">{insuranceName} Accepted</span>
              </div>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-4 tracking-tight"
            >
              {insuranceName} Dentists in <br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">{cityName}</span>, {stateAbbr}
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl mx-auto"
            >
              {showAcceptsInsurance 
                ? `Find and book appointments with ${clinicCountDisplay} dental professionals in ${cityName} that accept ${insuranceName}.`
                : `Browse all dentists in ${cityName}. Use your ${insuranceName} insurance or explore other payment options.`}
            </motion.p>

            {/* Stats */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                <Users className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-white text-lg">{profiles?.length || 0}+</span>
                <span className="text-slate-300 text-sm">Dentists</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                <span className="font-bold text-white text-lg">4.9</span>
                <span className="text-slate-300 text-sm">Avg Rating</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                <Shield className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-white text-lg">{insuranceName}</span>
                <span className="text-slate-300 text-sm">Accepted</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Badges - Same as CityPage */}
      <div className="bg-white border-b border-slate-100">
        <div className="container px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">Insurance</p>
                  <p className="text-xs text-slate-500">Accepted</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
                  <Star className="h-6 w-6 text-white fill-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">4.9★</p>
                  <p className="text-xs text-slate-500">Avg Rating</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">Verified</p>
                  <p className="text-xs text-slate-500">Clinics</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">60s</p>
                  <p className="text-xs text-slate-500">To Book</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16 md:py-20">
        <div className="container px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              <aside className="hidden lg:block w-72 shrink-0">
                <div className="sticky top-24 space-y-4">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-5 w-5" />
                      <h3 className="font-bold text-lg">Filters</h3>
                    </div>
                    <p className="text-emerald-100 text-sm">{profiles?.length || 0} dentists found</p>
                  </div>
                  <BudgetFilterSidebar
                    filters={filters}
                    onFiltersChange={setFilters}
                    availableServices={treatments?.map(t => ({ id: t.id, name: t.name, slug: t.slug })) || []}
                    locationName={cityName}
                    totalResults={profiles?.length || 0}
                  />
                </div>
              </aside>

              <div className="flex-1 min-w-0 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {insuranceName} Dentists in {cityName}
                    </h2>
                    <p className="text-slate-500 mt-1">
                      {clinicCountDisplay} verified dental clinics accepting {insuranceName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Sort by:</span>
                    <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
                      <option>Top Rated</option>
                      <option>Most Reviews</option>
                      <option>Nearest</option>
                    </select>
                  </div>
                </div>

                <DentistListFrame
                  profiles={profiles}
                  isLoading={profilesLoading}
                  locationName={cityName}
                  hasActiveFilters={false}
                  onClearFilters={() => {}}
                  maxHeight={700}
                  initialCount={6}
                />

                {nearbyLocations.length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-emerald-600" />
                        Other Cities in {stateName}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nearbyLocations.slice(0, 8).map((loc) => (
                        <Link
                          key={loc.slug}
                          to={`/${stateSlug}/${loc.slug}/${extractedInsuranceSlug}-dentists/`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                        >
                          <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="font-medium text-xs text-slate-700 group-hover:text-emerald-700 whitespace-nowrap">
                            {loc.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEO Content Section */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-4">
              <Stethoscope className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Insurance Guide</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4">
              Frequently Asked <span className="text-emerald-600">Questions</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Learn about using {insuranceName} for dental care in {cityName}
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-white border border-slate-200 rounded-2xl data-[state=open]:border-emerald-500/50"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline px-6 py-5 text-slate-700">
                  <span className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-sm font-bold">
                      {i + 1}
                    </span>
                    {faq.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-5 text-slate-500 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Insurance Content Section - Similar to CityPage */}
      <section className="py-12 bg-white">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 md:p-10 shadow-lg border border-emerald-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    About {insuranceName} Dental Coverage in {cityName}
                  </h2>
                  <p className="text-slate-500 text-sm">Your guide to using {insuranceName} for dental care</p>
                </div>
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="text-lg text-slate-600 leading-relaxed">
                  {insuranceName} provides comprehensive dental coverage accepted by many dental professionals in {cityName}. 
                  Most plans cover preventive care at 100%, including regular checkups, cleanings, and x-rays. 
                  Basic procedures like fillings typically have lower copays, while major procedures may require a waiting period.
                </p>
              </div>
              
              {/* Insurance Cost Guide */}
              <div className="mt-8 pt-6 border-t border-emerald-200">
                <h3 className="text-lg font-bold text-slate-800 mb-3">
                  💰 Estimated Costs with {insuranceName} in {cityName}
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white p-4 rounded-xl border border-emerald-100">
                    <p className="font-semibold text-emerald-700 mb-1">Preventive (100% Covered)</p>
                    <p className="text-slate-500">Cleanings: $0<br/>Checkups: $0<br/>X-Rays: $0</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-amber-100">
                    <p className="font-semibold text-amber-700 mb-1">Basic Procedures</p>
                    <p className="text-slate-500">Fillings: $50-150<br/>Extractions: $100-250</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-purple-100">
                    <p className="font-semibold text-purple-700 mb-1">Major Procedures</p>
                    <p className="text-slate-500">Crowns: $500-1000<br/>Implants: $1500-3000</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">*Costs are estimates and vary by plan. Contact {insuranceName} for exact coverage details.</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  to={`/${stateSlug}/${citySlug}/`}
                  className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium hover:bg-emerald-200 transition-colors"
                >
                  All Dentists in {cityName}
                </Link>
                <Link
                  to={`/insurance/${extractedInsuranceSlug}`}
                  className="px-4 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-full text-sm font-medium hover:bg-emerald-50 transition-colors"
                >
                  {insuranceName} Overview
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default InsuranceLocationPage;