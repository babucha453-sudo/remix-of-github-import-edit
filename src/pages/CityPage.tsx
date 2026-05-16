import { useState as useReactState, useMemo } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SearchBox } from "@/components/SearchBox";
import { BudgetFilterSidebar, useBudgetFilters } from "@/components/filters";
import { DentistListFrame, LocationQuickLinks } from "@/components/location";
import { SEOContentBlock } from "@/components/seo/SEOContentBlock";
import { PageIntroSection } from "@/components/seo/PageIntroSection";
import { GeographicLinkBlock } from "@/components/seo/GeographicLinkBlock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { InternalLinkBlock, generateCityInternalLinks } from "@/components/seo/InternalLinkBlock";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useCity, useState as useStateData, useCitiesByStateSlug } from "@/hooks/useLocations";
import { useSeoPageContent, parseMarkdownContent, parseFaqFromContent } from "@/hooks/useSeoPageContent";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { usePinnedProfiles, sortWithPinnedFirst, useTopDentists } from "@/hooks/usePinnedProfiles";
import { normalizeStateSlug } from "@/lib/slug/normalizeStateSlug";
import { DentistFinderMap, DentistFinderCard, DentistFinderProfile } from "@/components/finder";
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
  ArrowRight
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const MIN_DENTIST_COUNT = 2; // noindex pages with fewer than 2 dentists

interface CityPageProps {
  initialState?: any;
  initialCity?: any;
}

const CityPage = ({ initialState, initialCity }: CityPageProps) => {
  const { stateSlug, citySlug } = useParams();
  const navigate = useNavigate();
  const normalizedStateSlug = normalizeStateSlug(stateSlug);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useReactState(false);
  const { filters, setFilters } = useBudgetFilters();
  const [highlightedProfileId, setHighlightedProfileId] = useReactState<string | null>(null);
  
  // Hero search state
  const [searchLocation, setSearchLocation] = useReactState("");
  const [searchTreatment, setSearchTreatment] = useReactState("");

  // Use initial data from SSR if available, otherwise fetch client-side
  const { data: state, isLoading: stateLoading } = useStateData(normalizedStateSlug || '', initialState);
  const { data: city, isLoading: cityLoading } = useCity(citySlug || '', normalizedStateSlug || '', initialCity);

  // Fetch SEO content from seo_pages table
  const seoSlug = `${normalizedStateSlug || ''}/${citySlug || ''}`;
  const { data: seoContent, isLoading: seoContentLoading, isFetching: seoContentFetching } = useSeoPageContent(seoSlug);

  // IMPORTANT: Don't hide content during background refetches - only show loading state when no data exists
  const isSeoContentPending = !seoContent && (seoContentLoading || seoContentFetching);

  // Fetch pinned profiles for this city page
  const { data: pinnedProfiles } = usePinnedProfiles('city', normalizedStateSlug, citySlug);
  
  // Fetch top dentists for this city
  const { data: topDentistIds } = useTopDentists(city?.id);

  // Fetch TOTAL clinic count for this city (for SEO content - not limited)
  const { data: totalClinicCount } = useQuery({
    queryKey: ['city-clinic-count', city?.id],
    queryFn: async () => {
      if (!city) return 0;
      const { count, error } = await supabase
        .from('clinics')
        .select('id', { count: 'exact', head: true })
        .eq('city_id', city.id)
        .eq('is_active', true);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!city,
  });

  // Fetch profiles for this city (limited for display)
  const { data: rawProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['city-profiles', citySlug, pinnedProfiles?.map(p => p.id).join(',')],
    queryFn: async () => {
      if (!city) return [];

      const pinnedIds = (pinnedProfiles || []).map(p => p.id);

      const { data: clinics } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, description, cover_image_url, rating, review_count,
          address, phone, verification_status, claim_status, latitude, longitude,
          city:cities(name, slug, state:states(name, abbreviation))
        `)
        .eq('city_id', city.id)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(50);

      const resultIds = new Set((clinics || []).map(c => c.id));
      const missingPinnedIds = pinnedIds.filter(id => !resultIds.has(id));

      let pinnedClinics: any[] = [];
      if (missingPinnedIds.length > 0) {
        const { data: extraPinned } = await supabase
          .from('clinics')
          .select(`
            id, name, slug, description, cover_image_url, rating, review_count,
            address, phone, verification_status, claim_status,
            city:cities(name, slug, state:states(name, abbreviation))
          `)
          .in('id', missingPinnedIds)
          .eq('is_active', true);
        pinnedClinics = extraPinned || [];
      }

      const seenIds = new Set<string>();
      const allClinics = [...(clinics || []), ...pinnedClinics].filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      });

      return allClinics.map(c => ({
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
      }));
    },
    enabled: !!city,
  });

  // Sort profiles with pinned ones first and apply filters
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

  // Fetch nearby cities for internal linking
  const { data: nearbyCities, isLoading: nearbyCitiesLoading } = useCitiesByStateSlug(normalizedStateSlug || '');

  // Signal prerender when ALL SEO-critical data loads
  // Includes: location data, profiles (for listings), treatments, nearby cities (internal links), and SEO content
  const isDataReady = !stateLoading && !cityLoading && !profilesLoading && !treatmentsLoading && !nearbyCitiesLoading && !seoContentLoading && !seoContentFetching;
  usePrerenderReady(isDataReady, { delay: 600 });

  if (!stateSlug || !citySlug) {
    return <NotFound />;
  }

  // Redirect legacy full-name state slugs to canonical abbreviation slugs
  // e.g., /california/los-angeles -> /ca/los-angeles
  const stateAbbrev = Object.entries({
    california: "ca",
    massachusetts: "ma",
    connecticut: "ct",
    "new-jersey": "nj",
  }).find(([full]) => full === stateSlug)?.[1];

  if (stateSlug && stateAbbrev && stateSlug === normalizedStateSlug) {
    return <Navigate to={`/${stateAbbrev}/${citySlug}/`} replace />;
  }

  if (stateSlug === "clinic") {
    return <Navigate to={`/clinic/${citySlug}/`} replace />;
  }
  if (stateSlug === "dentist") {
    return <Navigate to={`/dentist/${citySlug}/`} replace />;
  }

  if (stateLoading || cityLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96" />
        </div>
      </PageLayout>
    );
  }

  if (!state || !city) {
    return <NotFound />;
  }

  const cityName = city.name;
  const stateName = state.name;
  const stateAbbr = state.abbreviation;
  const locationDisplay = `${cityName}, ${stateAbbr}`;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: stateName, href: `/${stateSlug}/` },
    { label: cityName },
  ];

  // Parse SEO content
  const parsedContent = seoContent?.content ? parseMarkdownContent(seoContent.content) : null;
  // Use dedicated faqs column first, fallback to parsing from content for legacy pages
  const seoFaqs = seoContent?.faqs && Array.isArray(seoContent.faqs) && seoContent.faqs.length > 0
    ? seoContent.faqs
    : seoContent?.content ? parseFaqFromContent(seoContent.content) : [];

  const clinicCountDisplay = totalClinicCount || profiles?.length || 0;
  const pageTitle = seoContent?.meta_title || `Top ${clinicCountDisplay}+ Dentists in ${cityName}, ${stateAbbr} — Book Online Today | AppointPanda`;
  const pageDescription = seoContent?.meta_description || `Compare ${clinicCountDisplay}+ verified dental clinics in ${cityName}, ${stateName}. Read patient reviews, check insurance, and book appointments online today.`;
  const pageH1 = seoContent?.h1 || `Best Dentists in ${locationDisplay}`;

  const cityFaqSets = [
    [
      { q: `How do I find a good dentist in ${cityName}?`, a: `Browse our verified list of dentists in ${cityName}. Look for verified badges, patient reviews, and specializations that match your needs.` },
      { q: `Are the dentists in ${cityName} verified?`, a: `All dentists on our platform are licensed professionals. Profiles with the "Verified" badge have claimed and completed our verification process.` },
      { q: `How much does dental treatment cost in ${cityName}?`, a: `Dental costs vary by treatment. A basic checkup typically ranges from $75-200, while specialized treatments can range from $3,000-6,000.` },
      { q: `Can I book emergency dental appointments in ${cityName}?`, a: `Yes, many clinics in ${cityName} offer same-day emergency appointments. Use our search to find clinics with emergency availability.` },
    ],
    [
      { q: `What dental services are available in ${cityName}?`, a: `${cityName} dental clinics offer comprehensive services including preventive care, cosmetic dentistry, orthodontics, and emergency treatments.` },
      { q: `Does dental insurance cover treatments in ${cityName}?`, a: `Most major dental insurance plans are accepted by clinics in ${cityName}. We recommend checking with your provider for specific coverage details.` },
      { q: `What is the average cost of a dental cleaning in ${cityName}?`, a: `Professional teeth cleaning in ${cityName} typically costs between $75-150, depending on the clinic and your insurance coverage.` },
      { q: `How do I choose the right dentist in ${cityName}?`, a: `Consider factors like verified credentials, patient reviews, services offered, and convenient booking. Our platform makes it easy to compare dentists in ${cityName}.` },
    ],
    [
      { q: `What should I expect during my first dental visit in ${cityName}?`, a: `Your first visit typically includes an examination, X-rays if needed, and a discussion of your oral health goals with a qualified dentist in ${cityName}.` },
      { q: `Are there affordable dental options in ${cityName}?`, a: `Yes, many ${cityName} clinics offer payment plans, accept various insurance plans, and provide options for patients without insurance.` },
      { q: `How often should I visit a dentist in ${cityName}?`, a: `The American Dental Association recommends visiting your dentist at least twice a year for preventive care and cleanings.` },
      { q: `What makes ${cityName} dentists unique?`, a: `${cityName} dental professionals are known for their commitment to patient care and use of modern dental technology and techniques.` },
    ],
    [
      { q: `What's the best way to compare dentists in ${cityName}?`, a: `Use our platform to compare ratings, reviews, services, pricing, and availability. The verified badge ensures the dentist's credentials are confirmed.` },
      { q: `Do dentists in ${cityName} offer Saturday appointments?`, a: `Some dental offices in ${cityName} offer weekend hours. Search for "available weekends" or call clinics directly to check their hours.` },
      { q: `How do I find a dentist who accepts my insurance in ${cityName}?`, a: `Use our insurance filter to see in-network dentists, or contact your insurance provider for a list of participating dental offices in ${cityName}.` },
      { q: `What are the most popular dental treatments in ${cityName}?`, a: `Common treatments in ${cityName} include teeth cleaning, whitening, fillings, crowns, braces, and dental implants.` },
    ],
    [
      { q: `Can I get a second opinion from another dentist in ${cityName}?`, a: `Absolutely. Browse multiple dentist profiles and schedule consultations to compare diagnoses and treatment recommendations in ${cityName}.` },
      { q: `What's the average wait time for dental appointments in ${cityName}?`, a: `Wait times vary by clinic and procedure. Routine checkups may be available within a few days, while specialists may have 2-4 week waits.` },
      { q: `Are there dental schools in ${cityName} that offer affordable care?`, a: `${cityName} may have dental schools that provide treatment at reduced costs by supervised students. Contact local dental schools for options.` },
      { q: `How do I find a pediatric dentist for my child in ${cityName}?`, a: `Search for dentists with pediatric specialization or family dentistry. Look for those who create a comfortable environment for children.` },
    ],
    [
      { q: `Do dental offices in ${cityName} offer payment plans?`, a: `Many ${cityName} dental offices offer flexible payment plans or partner with financing companies like CareCredit.` },
      { q: `What's the process for booking a dental appointment in ${cityName}?`, a: `Simply browse dentist profiles, read reviews, select a time slot that works for you, and confirm your booking - all online.` },
      { q: `Are there emergency dental clinics in ${cityName}?`, a: `Yes, ${cityName} has emergency dental clinics and many regular dental offices that accept emergency cases.` },
      { q: `How do I know if a dentist in ${cityName} is experienced?`, a: `Check their years of practice, patient reviews, before/after photos for cosmetic procedures, and any specialized certifications.` },
    ],
    [
      { q: `Can I find cosmetic dentists in ${cityName}?`, a: `Yes, many ${cityName} dental offices specialize in cosmetic procedures like veneers, whitening, and smile makeovers.` },
      { q: `What's the cost of dental implants in ${cityName}?`, a: `Dental implants in ${cityName} typically cost $3,000-6,000 per implant, depending on the clinic and specific requirements.` },
      { q: `Do orthodontists in ${cityName} offer Invisalign?`, a: `Many orthodontists and dentists in ${cityName} provide Invisalign and other clear aligner treatments.` },
      { q: `How do I find a dentist who specializes in sedation dentistry in ${cityName}?`, a: `Search for "sedation dentist" or call dental offices to ask about their anxiety management options.` },
    ],
    [
      { q: `What should I look for in reviews of dentists in ${cityName}?`, a: `Focus on comments about staff friendliness, wait times, treatment outcomes, pricing transparency, and overall experience.` },
      { q: `Are there multilingual dentists in ${cityName}?`, a: `Some ${cityName} dental offices have multilingual staff. Use our search or call clinics to check language capabilities.` },
      { q: `How do I schedule a consultation in ${cityName}?`, a: `Most dentists in ${cityName} offer free initial consultations. Use our platform to book one online or call the office directly.` },
      { q: `What questions should I ask during my dental consultation in ${cityName}?`, a: `Ask about their experience with your specific needs, treatment options, costs, payment plans, and expected outcomes.` },
    ],
    [
      { q: `Can I get my teeth whitened at any dental office in ${cityName}?`, a: `Most ${cityName} dental offices offer professional whitening services. In-office treatment provides faster results than at-home kits.` },
      { q: `How do I find an oral surgeon in ${cityName}?`, a: `Search for oral surgeons or use our filter to find dental specialists. Your general dentist can also provide a referral.` },
      { q: `What's the difference between a dentist and orthodontist in ${cityName}?`, a: `Dentists handle general and cosmetic care. Orthodontists specialize in teeth alignment and bite correction, including braces and aligners.` },
      { q: `Do dental offices in ${cityName} use modern technology?`, a: `Many ${cityName} dental offices use digital X-rays, 3D imaging, laser dentistry, and same-day crown technology.` },
    ],
    [
      { q: `How do I handle dental anxiety when visiting a dentist in ${cityName}?`, a: `Look for dentists who offer sedation options, bring music or a friend, schedule morning appointments, and communicate your fears upfront.` },
      { q: `Can I get a dental cleaning without insurance in ${cityName}?`, a: `Yes, many ${cityName} dental offices offer affordable cleaning for uninsured patients, with some offering membership plans.` },
      { q: `What's the best way to maintain my dental health between visits to ${cityName}?`, a: `Brush twice daily, floss daily, limit sugary foods, avoid tobacco, and follow any specific care instructions from your ${cityName} dentist.` },
      { q: `How do I know if I need to see a dentist urgently in ${cityName}?`, a: `Seek immediate care for severe pain, bleeding, swelling, knocked-out teeth, or signs of infection. Otherwise, schedule a regular visit.` },
    ],
  ];
  const faqSetIndex = Math.abs((citySlug?.length || 0) * 13 + (normalizedStateSlug?.length || 0) * 7) % cityFaqSets.length;
  const faqs = seoFaqs.length > 0 ? seoFaqs.map(f => ({ q: f.question, a: f.answer })) : cityFaqSets[faqSetIndex];

  const shouldNoIndex = !profilesLoading && (!profiles || profiles.length < MIN_DENTIST_COUNT);

  const popularTreatments = (treatments || []).map(t => ({ name: t.name, slug: t.slug }));
  const nearbyLocations = (nearbyCities || [])
    .filter(c => c.slug !== citySlug)
    .slice(0, 6)
    .map(c => ({ name: c.name, slug: c.slug }));

  const hasActiveFilters = filters.maxBudget !== null || filters.minRating > 0 || filters.verifiedOnly;

  return (
    <PageLayout>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonical={`/${stateSlug}/${citySlug}/`}
        keywords={[`dentists ${cityName}`, `dental clinics ${cityName} ${stateAbbr}`, `best dentist ${cityName}`]}
        noindex={shouldNoIndex}
      />
      {/* Synchronous JSON-LD structured data for SEO */}
      <SyncStructuredData
        data={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: stateName, url: `/${stateSlug}/` },
              { name: cityName, url: `/${stateSlug}/${citySlug}/` },
            ],
          },
          {
            type: 'faq',
            questions: faqs.map(f => ({ question: f.q, answer: f.a })),
          },
          {
            type: 'itemList',
            name: `Dentists in ${cityName}, ${stateAbbr}`,
            description: `Top-rated dental clinics and dentists in ${cityName}`,
            items: (profiles || []).slice(0, 10).map((p, i) => ({
              name: p.name,
              url: `/clinic/${p.slug}/`,
              position: i + 1,
              image: p.image,
            })),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: `${cityName}, ${stateAbbr}`,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: city?.latitude || 34.0522,
              longitude: city?.longitude || -118.2437,
            },
            address: {
              '@type': 'PostalAddress',
              addressLocality: cityName,
              addressRegion: stateAbbr,
              addressCountry: 'US',
            },
          },
        ]}
        id="city-page-schema"
      />

      {/* Hero Section - Redesigned to match HomeV2 emerald theme */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 min-h-[60vh] flex items-center">
        {/* Dynamic Background */}
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
          <div className="absolute inset-0 opacity-[0.02]" style={{ 
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '50px 50px' 
          }} />
        </div>

        <div className="container relative z-10 px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mb-8"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-5 py-2">
                <Stethoscope className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-100">Licensed Dental Specialists</span>
              </div>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight"
            >
              Find the Best Dentists in <br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">{cityName}</span>, {stateAbbr}
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl mx-auto"
            >
              Find and book appointments with top-rated dental professionals in {cityName}. Compare verified clinics and read patient reviews.
            </motion.p>

            {/* Search Bar - Matching HomeV2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-3xl mx-auto mb-8"
            >
              <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
                <div className="grid md:grid-cols-12">
                  <div className="md:col-span-5 relative border-b md:border-b-0 md:border-r border-gray-100">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <MapPin className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      placeholder="City or Zip Code"
                      className="w-full h-16 pl-12 pr-4 text-base text-gray-900 placeholder:text-gray-400 border-0 focus:ring-0 focus:outline-none bg-transparent"
                    />
                  </div>
                  <div className="md:col-span-5 relative border-b md:border-b-0 border-gray-100">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <select 
                      value={searchTreatment}
                      onChange={(e) => setSearchTreatment(e.target.value)}
                      className="w-full h-16 pl-12 pr-10 text-base text-gray-900 border-0 focus:ring-0 focus:outline-none bg-transparent appearance-none cursor-pointer"
                    >
                      <option value="">Any Treatment</option>
                      {treatments?.map((t) => (
                        <option key={t.id} value={t.slug}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 bg-emerald-500 hover:bg-emerald-600 transition-colors">
                    <Button 
                      onClick={() => {
                        if (searchTreatment) {
                          navigate(`/${stateSlug}/${citySlug}/${searchTreatment}`);
                        } else if (searchLocation) {
                          navigate(`/${stateSlug}/${searchLocation}`);
                        } else {
                          navigate(`/${stateSlug}/${citySlug}/`);
                        }
                      }}
                      className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-none text-lg"
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats - Matching HomeV2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                <Users className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-white text-lg">{profiles?.length || 0}+</span>
                <span className="text-slate-300 text-sm">Specialists</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                <span className="font-bold text-white text-lg">4.9</span>
                <span className="text-slate-300 text-sm">Avg Rating</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                <Clock className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-white text-lg">60s</span>
                <span className="text-slate-300 text-sm">to Book</span>
              </div>
            </motion.div>

            {/* Quick Links */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-3 mt-6"
            >
              <span className="text-slate-400 text-sm">Popular in {cityName}:</span>
              <a href={`/search?city=${citySlug}&treatment=teeth-cleaning`} className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Teeth Cleaning</a>
              <span className="text-slate-600">•</span>
              <a href={`/search?city=${citySlug}&treatment=teeth-whitening`} className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Whitening</a>
              <span className="text-slate-600">•</span>
              <a href={`/search?city=${citySlug}&treatment=invisalign`} className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Invisalign</a>
              <span className="text-slate-600">•</span>
              <a href={`/search?city=${citySlug}&treatment=dental-implants`} className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Implants</a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Signals - Redesigned */}
      <section className="py-8 bg-white border-b border-slate-100">
        <div className="container px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">HIPAA</p>
                <p className="text-xs text-slate-500">Compliant</p>
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
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">Verified</p>
                <p className="text-xs text-slate-500">Dentists</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">Instant</p>
                <p className="text-xs text-slate-500">Booking</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Page Intro Section - CMS Content */}
      <section className="py-12 bg-slate-50">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl p-8 md:p-10 shadow-lg border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Stethoscope className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    About Dental Care in {cityName}
                  </h2>
                  <p className="text-slate-500 text-sm">Your guide to finding the best dentists</p>
                </div>
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="text-lg text-slate-600 leading-relaxed">
                  {parsedContent?.sections?.[0]?.content || `Discover top-rated dental professionals in ${cityName}. Our verified network includes specialists in general dentistry, cosmetic procedures, orthodontics, and more.`}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {popularTreatments.slice(0, 4).map((treatment, i) => (
                  <a
                    key={i}
                    href={`/${stateSlug}/${citySlug}/${treatment.slug}`}
                    className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium hover:bg-emerald-100 transition-colors"
                  >
                    {treatment.name}
                  </a>
                ))}
              </div>

              {/* Quick Answer for Featured Snippets */}
              <div className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <h3 className="font-bold text-slate-800 mb-2">Quick Answer</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Finding quality dental care in {cityName} is simple with our verified dentist directory. Browse verified providers by specialty, compare ratings and reviews, check accepted insurance, and book appointments directly online — all from trusted, vetted dental professionals serving the {cityName} area.
                </p>
              </div>
              
              {/* TRANSFORMATION: Price Decision Content - SEO Gold */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-3">
                  💰 Understanding Dental Costs in {cityName}
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="font-semibold text-slate-700 mb-1">Budget-Friendly</p>
                    <p className="text-slate-500">Cleanings: $75-150<br/>Checkups: $50-125</p>
                    <a href={`/${stateSlug}/${citySlug}?budget=under-200`} className="text-emerald-600 text-xs mt-2 block hover:underline">
                      Find affordable options →
                    </a>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="font-semibold text-slate-700 mb-1">Mid-Range</p>
                    <p className="text-slate-500">Fillings: $150-300<br/>Crowns: $800-1500</p>
                    <a href={`/${stateSlug}/${citySlug}?budget=200-500`} className="text-emerald-600 text-xs mt-2 block hover:underline">
                      Browse mid-range →
                    </a>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="font-semibold text-slate-700 mb-1">Premium</p>
                    <p className="text-slate-500">Implants: $3000-6000<br/>Veneers: $1500-3000</p>
                    <a href={`/${stateSlug}/${citySlug}?budget=over-1000`} className="text-emerald-600 text-xs mt-2 block hover:underline">
                      View specialists →
                    </a>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  💡 Prices are estimates. Use our dental cost calculator for personalized quotes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Dentists + SEO Content */}
      <div className="py-16 md:py-20">
        <div className="container px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              <div className="lg:hidden">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full rounded-xl font-bold gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[320px] p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle>Filter Results</SheetTitle>
                    </SheetHeader>
                    <div className="overflow-y-auto max-h-[calc(100vh-80px)]">
                      <BudgetFilterSidebar
                        filters={filters}
                        onFiltersChange={setFilters}
                        availableServices={treatments?.map(t => ({ id: t.id, name: t.name, slug: t.slug })) || []}
                        locationName={cityName}
                        totalResults={profiles?.length || 0}
                        className="border-0 rounded-none shadow-none"
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <aside className="hidden lg:block w-72 shrink-0">
                <div className="sticky top-24 space-y-4">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <SlidersHorizontal className="h-5 w-5" />
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
                      Top Dentists in {cityName}
                    </h2>
                    <p className="text-slate-500 mt-1">
                      {totalClinicCount || profiles?.length || 0} verified dental clinics available
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
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={() => setFilters({ maxBudget: null, minRating: 0, verifiedOnly: false, selectedServices: [] })}
                  maxHeight={700}
                  initialCount={6}
                />

                {profiles && profiles.filter((p: any) => p.latitude && p.longitude).length > 0 && (
                  <div className="mt-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-lg font-bold text-slate-800">Interactive Map</h3>
                        <span className="text-sm font-normal text-slate-500">
                          ({profiles.filter((p: any) => p.latitude && p.longitude).length} dentists)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>Verified clinics</span>
                      </div>
                    </div>
                    <div className="flex flex-col lg:flex-row">
                      <div className="lg:flex-[2]">
                        <DentistFinderMap
                          className="h-[400px] lg:h-[550px]"
                          markers={profiles
                            .filter((p: any) => p.latitude != null && p.longitude != null)
                            .map((p: any) => ({
                              id: p.id,
                              name: p.name,
                              slug: p.slug,
                              latitude: Number(p.latitude),
                              longitude: Number(p.longitude),
                              address: p.address,
                              rating: p.rating,
                              isVerified: p.isVerified,
                              hasBookNow: p.claim_status === 'claimed'
                            }))}
                          highlightedId={highlightedProfileId || undefined}
                          onMarkerClick={(marker) => setHighlightedProfileId(marker.id)}
                        />
                      </div>
                      <div className="lg:w-[380px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 max-h-[400px] lg:max-h-[550px] overflow-y-auto">
                        <div className="sticky top-0 p-3 border-b border-slate-100 bg-white z-10">
                          <p className="font-semibold text-slate-800 text-sm">
                            {profiles.filter((p: any) => p.latitude && p.longitude).length} dentists with location
                          </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {profiles
                            .filter((p: any) => p.latitude && p.longitude)
                            .map((profile: any) => (
                              <a
                                key={profile.id}
                                href={`/clinic/${profile.slug}`}
                                className={`block p-4 text-left transition-all hover:bg-slate-50 ${
                                  highlightedProfileId === profile.id ? "bg-emerald-50" : ""
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    profile.isVerified ? "bg-emerald-100" : "bg-slate-100"
                                  }`}>
                                    <MapPin className={`h-5 w-5 ${
                                      profile.isVerified ? "text-emerald-600" : "text-slate-400"
                                    }`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-slate-800 text-sm truncate">{profile.name}</p>
                                      {profile.isVerified && (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{profile.address || profile.location}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                      {profile.rating > 0 && (
                                        <div className="flex items-center gap-1 text-amber-500">
                                          <Star className="h-3 w-3 fill-current" />
                                          <span className="text-xs font-semibold">{profile.rating.toFixed(1)}</span>
                                        </div>
                                      )}
                                      {profile.phone && (
                                        <div className="flex items-center gap-1 text-slate-400">
                                          <Phone className="h-3 w-3" />
                                          <span className="text-xs">Call</span>
                                        </div>
                                      )}
                                      <span className="text-xs text-emerald-600 flex items-center gap-1 ml-auto">
                                        View Profile
                                        <ChevronRight className="h-3 w-3" />
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </a>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {nearbyLocations.length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-emerald-600" />
                        Nearby Cities
                      </h3>
                      <a href={`/${stateSlug}/`} className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1">
                        View all cities in {stateName}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nearbyLocations.slice(0, 8).map((city) => (
                        <a
                          key={city.slug}
                          href={`/${stateSlug}/${city.slug}/`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                        >
                          <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="font-medium text-xs text-slate-700 group-hover:text-emerald-700 whitespace-nowrap">
                            {city.name}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="py-16 md:py-24 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-4">
              <Stethoscope className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Need Help?</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently Asked <span className="text-emerald-400">Questions</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Find answers about finding and booking dental appointments in {cityName}
            </p>
          </div>

          {/* Quick Answer for Featured Snippets */}
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <h3 className="font-bold text-slate-800 mb-2">Quick Answer</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Finding quality dental care in {cityName} is simple with our verified dentist directory. Browse verified providers, compare treatments and pricing, read patient reviews, and book appointments online.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-white/5 border border-white/10 rounded-2xl data-[state=open]:border-emerald-500/50 data-[state=open]:bg-white/10"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline px-6 py-5 text-slate-100 hover:text-white">
                  <span className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold">
                      {i + 1}
                    </span>
                    {faq.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-5 text-slate-300 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </PageLayout>
  );
};

export default CityPage;

