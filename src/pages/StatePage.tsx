import { useMemo, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { AISmartSearch } from "@/components/ai";
import { DentistListFrame, LocationQuickLinks } from "@/components/location";
import { SEOContentBlock } from "@/components/seo/SEOContentBlock";
import { PageIntroSection } from "@/components/seo/PageIntroSection";
import { GeographicLinkBlock } from "@/components/seo/GeographicLinkBlock";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useState as useStateData, useCitiesByStateSlug } from "@/hooks/useLocations";
import { useSeoPageContent, parseMarkdownContent, parseFaqFromContent } from "@/hooks/useSeoPageContent";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { usePinnedProfiles, sortWithPinnedFirst, useTopDentists } from "@/hooks/usePinnedProfiles";
import { normalizeStateSlug } from "@/lib/slug/normalizeStateSlug";
import { DentistFinderMap } from "@/components/finder";
import NotFound from "./NotFound";
import {
  MapPin,
  Star,
  Shield,
  Clock,
  Building2,
  ArrowRight,
  Search,
  Users,
  ChevronRight,
  Phone,
  CheckCircle2,
  Stethoscope
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface StatePageProps {
  initialState?: any;
  initialCities?: any[];
}

const StatePage = ({ initialState, initialCities }: StatePageProps) => {
  const { stateSlug } = useParams();
  const navigate = useNavigate();
  const [visibleCityCount, setVisibleCityCount] = useState(10);
  const [searchLocation, setSearchLocation] = useState("");
  const [searchTreatment, setSearchTreatment] = useState("");

  const normalizedStateSlug = normalizeStateSlug(stateSlug);

  // Check if this is actually a static page route or reserved path
  const staticRoutes = [
    'about', 'contact', 'faq', 'how-it-works', 'privacy', 'terms',
    'auth', 'admin', 'dashboard', 'search', 'services', 'insurance',
    'blog', 'claim-profile', 'list-your-practice', 'onboarding',
    'gmb-select', 'find-dentist', 'clinic', 'dentist', 'sitemap',
    'pricing', 'appointment', 'review', 'rq'
  ];

  const isInvalidSlug = !stateSlug || staticRoutes.includes(stateSlug) || stateSlug.includes('/');

  // All hooks must be called before any conditional returns
  const { data: state, isLoading: stateLoading } = useStateData(normalizedStateSlug || '', initialState);
  const { data: cities, isLoading: citiesLoading } = useCitiesByStateSlug(normalizedStateSlug || '', initialCities);

  // Fetch SEO content from seo_pages table
  const { data: seoContent, isLoading: seoContentLoading, isFetching: seoContentFetching } = useSeoPageContent(normalizedStateSlug || '');

  // IMPORTANT: Don't hide content during background refetches - only show loading state when no data exists
  const isSeoContentPending = !seoContent && (seoContentLoading || seoContentFetching);

  // Fetch pinned profiles for this state page
  const { data: pinnedProfiles } = usePinnedProfiles('state', normalizedStateSlug);

  // City-level clinic counts (fallback when dentist_count is 0)
  const cityIds = (cities || []).map((c) => c.id);
  const { data: cityClinicCounts } = useQuery({
    queryKey: ["city-clinic-counts", stateSlug, cityIds.join(",")],
    queryFn: async () => {
      if (!cityIds.length) return {} as Record<string, number>;

      const { data, error } = await supabase
        .from("clinics")
        .select("city_id")
        .in("city_id", cityIds)
        .eq("is_active", true);

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const id = row.city_id as string | null;
        if (!id) continue;
        counts[id] = (counts[id] || 0) + 1;
      }
      return counts;
    },
    enabled: cityIds.length > 0,
  });

  // Fetch profiles for this state - includes pinned clinics explicitly
  const { data: rawProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['state-profiles', stateSlug, pinnedProfiles?.map(p => p.id).join(',')],
    queryFn: async () => {
      if (!state) return [];

      // Get IDs of pinned clinics
      const pinnedIds = (pinnedProfiles || []).map(p => p.id);

      // Get city IDs for this state
      const { data: stateCities } = await supabase
        .from('cities')
        .select('id')
        .eq('state_id', state.id);

      if (!stateCities?.length) return [];

      const stateCityIds = stateCities.map(c => c.id);

      // Get clinics in these cities
      const { data: clinics } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, description, cover_image_url, rating, review_count,
          address, phone, verification_status, claim_status, latitude, longitude,
          city:cities(name, slug, state:states(name, abbreviation))
        `)
        .in('city_id', stateCityIds)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(12);

      // If there are pinned IDs not in the result, fetch them separately
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

      // Combine and dedupe
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
    enabled: !!state,
  });

  // Sort profiles with pinned ones first
  const profiles = useMemo(() => {
    if (!rawProfiles) return [];
    const sorted = sortWithPinnedFirst(rawProfiles, pinnedProfiles || []);
    const pinnedIds = new Set((pinnedProfiles || []).map(p => p.id));
    return sorted.map(p => ({ ...p, isPinned: pinnedIds.has(p.id) }));
  }, [rawProfiles, pinnedProfiles]);

  // Fetch treatments for service links
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

  // Signal prerender when ALL data is ready (including SEO content)
  const isDataReady = !stateLoading && !citiesLoading && !profilesLoading && !treatmentsLoading && !seoContentLoading && !seoContentFetching && !!state;
  usePrerenderReady(isDataReady);

  // Now check for invalid slug after all hooks
  if (isInvalidSlug) {
    return <NotFound />;
  }

  // Redirect legacy full-name state slugs to canonical abbreviation slugs
  // e.g., /california -> /ca
  if (stateSlug && normalizedStateSlug && stateSlug === normalizedStateSlug && stateSlug.length > 2) {
    const abbrev = Object.entries({
      california: "ca",
      massachusetts: "ma",
      connecticut: "ct",
      "new-jersey": "nj",
    }).find(([full]) => full === stateSlug)?.[1];
    
    if (abbrev) {
      return <Navigate to={`/${abbrev}/`} replace />;
    }
  }

  if (stateLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96" />
        </div>
      </PageLayout>
    );
  }

  if (!state) {
    return <NotFound />;
  }

  const stateName = state.name;
  const stateAbbr = state.abbreviation;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: stateName },
  ];

  // Parse SEO content if available
  const parsedContent = seoContent?.content ? parseMarkdownContent(seoContent.content) : null;
  // Use dedicated faqs column first, fallback to parsing from content for legacy pages
  const seoFaqs = seoContent?.faqs && Array.isArray(seoContent.faqs) && seoContent.faqs.length > 0
    ? seoContent.faqs
    : seoContent?.content ? parseFaqFromContent(seoContent.content) : [];

  // Calculate total clinic count for title/description
  const totalClinicCount = Object.values(cityClinicCounts || {}).reduce((a, b) => a + b, 0) || profiles?.length || 0;

  // Use SEO content if optimized, otherwise use defaults
  const pageTitle = seoContent?.meta_title || `Top ${totalClinicCount}+ Dentists in ${stateName} (${stateAbbr}) — Book Online Today | AppointPanda`;
  const pageDescription = seoContent?.meta_description || `Compare ${totalClinicCount}+ verified dental clinics across ${cities?.length || 0}+ cities in ${stateName}. Read reviews and book appointments online today.`;
  const pageH1 = seoContent?.h1 || `Find Dentists in ${stateName}`;

  // Use SEO FAQs if available, otherwise use unique defaults (10+ variants)
  const faqVariants = [
    [
      { q: `What should I look for when choosing a dentist in ${stateName}?`, a: `Look for verified credentials, patient reviews, years of experience, and services that match your needs. Our directory lets you compare all these factors side-by-side.` },
      { q: `Are the dentists in ${stateName} really verified?`, a: `Yes. Every dentist on AppointPanda passes license verification. Look for the blue checkmark - it means we've confirmed their credentials.` },
      { q: `What's the average cost of dental work in ${stateName}?`, a: `Costs vary by procedure and location within ${stateName}. Cleanings typically run $75-150, while complex procedures like implants can be $3000-6000. Get quotes from multiple dentists.` },
      { q: `How do I book an appointment in ${stateName}?`, a: `Simply browse dentists, read reviews, and click "Book" - no phone calls needed. Many clinics offer same-week appointments.` },
      { q: `Does dental insurance work in ${stateName}?`, a: `Most PPO and HMO plans are accepted. Filter by your insurance on the search results to find in-network dentists.` },
    ],
    [
      { q: `Emergency dentist in ${stateName} - what are my options?`, a: `Several clinics in ${stateName} offer emergency dental services. Search for same-day availability or call your nearest dental office directly.` },
      { q: `Best neighborhoods for dentists in ${stateName}?`, a: `Dental care quality varies by clinic, not neighborhood. Use our ratings and reviews to find the best dentists regardless of location.` },
      { q: `How often should I visit a dentist in ${stateName}?`, a: `Most dentists recommend checkups every 6 months. If you have gum disease or cavities, more frequent visits may be needed.` },
      { q: `Can I get braces or Invisalign in ${stateName}?`, a: `Yes! Many orthodontists in ${stateName} offer traditional braces and clear aligners like Invisalign. Search for orthodontic specialists.` },
      { q: `What if I don't have dental insurance in ${stateName}?`, a: `Many clinics offer payment plans or in-house membership programs. Some also provide discounts for cash payments.` },
    ],
    [
      { q: `Finding a pediatric dentist in ${stateName}?`, a: `Look for dentists who specialize in pediatric care or family dentistry. They have extra training for children's unique needs.` },
      { q: `Cosmetic dentistry options in ${stateName}?`, a: `Most major cities in ${stateName} have cosmetic dentists offering veneers, whitening, and smile makeovers. Compare prices and before/after photos.` },
      { q: `How long does it take to get a dental implant in ${stateName}?`, a: `The process typically takes 3-6 months over multiple visits. This includes consultation, surgery, healing, and placing the crown.` },
      { q: `Sedation dentistry in ${stateName} - is it available?`, a: `Many dental offices offer sedation options for anxious patients - from nitrous oxide to IV sedation. Ask during booking.` },
      { q: `What dental issues need immediate attention in ${stateName}?`, a: `Severe pain, bleeding, swelling, or knocked-out teeth are dental emergencies. Don't wait - call a dentist or visit an ER.` },
    ],
    [
      { q: `What dental services are available across ${stateName}?`, a: `Dental clinics throughout ${stateName} offer general dentistry, cosmetic procedures, orthodontics, oral surgery, and emergency care.` },
      { q: `How do I find affordable dental care in ${stateName}?`, a: `Compare prices on our platform, look for clinics offering payment plans, or search for dental schools that provide discounted services.` },
      { q: `Can I get second opinions from dentists in ${stateName}?`, a: `Absolutely. Browse multiple dentist profiles, read reviews, and schedule consultations to get different perspectives on your treatment options.` },
      { q: `What are the dental licensing requirements in ${stateName}?`, a: `All dentists in ${stateName} must be licensed by the state dental board. We verify each dentist's license before listing them.` },
      { q: `Are there dental walk-in clinics in ${stateName}?`, a: `Many clinics accept walk-in patients, though appointments are recommended. Search for clinics with same-day availability.` },
    ],
    [
      { q: `What's the tooth fairy tradition in ${stateName}?`, a: `Tooth fairy rates vary by region, but average $3-5 per tooth in ${stateName}. Some families use the occasion to teach about dental health!` },
      { q: `Do dental offices in ${stateName} offer weekend appointments?`, a: `Some dental offices in ${stateName} offer weekend hours. Filter by "available weekends" in your search to find convenient options.` },
      { q: `How do I know if a dentist in ${stateName} is good?`, a: `Check their rating, review count, verification status, years of experience, and any specialized certifications. Our platform aggregates all this information.` },
      { q: `What政府部门 dental programs exist in ${stateName}?`, a: `${stateName} offers various dental assistance programs for seniors, children, and low-income residents. Contact local health departments for eligibility.` },
      { q: `Can I find specialists like oral surgeons in ${stateName}?`, a: `Yes, ${stateName} has oral surgeons, periodontists, endodontists, and other dental specialists. Use our filter to find specific specialist types.` },
    ],
    [
      { q: `What should I expect at my first dental visit in ${stateName}?`, a: `Your first visit typically includes X-rays, examination, cleaning discussion, and treatment recommendations. Expect to be there 45-60 minutes.` },
      { q: `How do I prepare for a dental procedure in ${stateName}?`, a: `Follow pre-procedure instructions provided by your dentist, which may include fasting or arranging transportation. Ask about sedation options if you're anxious.` },
      { q: `What's the best way to whiten teeth in ${stateName}?`, a: `Professional in-office whitening offers fastest results. At-home kits from your dentist are more affordable. Over-the-counter options are least expensive but take longer.` },
      { q: `Are dental lasers common in ${stateName} clinics?`, a: `Many modern dental offices in ${stateName} use lasers for procedures like gum reshaping, cavity treatment, and teeth whitening. Ask about technology during booking.` },
      { q: `How do I handle dental anxiety in ${stateName}?`, a: `Look for dentists specializing in sedation dentistry, ask about calming techniques, bring headphones for music, and schedule morning appointments when you're fresh.` },
    ],
    [
      { q: `What's the average wait time for dentist appointments in ${stateName}?`, a: `Wait times vary by location and procedure. Routine checkups may be available within a few days, while specialists can take 2-4 weeks.` },
      { q: `Do ${stateName} dentists treat patients without insurance?`, a: `Yes, many dentists offer membership plans or payment plans for uninsured patients. Some also provide discounts for cash payments.` },
      { q: `Can I get emergency dental care at hospitals in ${stateName}?`, a: `Hospital ERs can provide emergency dental care, but dental schools and urgent dental clinics are often better equipped for dental emergencies.` },
      { q: `What dental technologies are available in ${stateName}?`, a: `Many ${stateName} dental offices offer digital X-rays, 3D imaging, laser dentistry, same-day crowns, and teledentistry consultations.` },
      { q: `How do I find a dentist who specializes in my specific need in ${stateName}?`, a: `Use our search filters to find dentists by specialty - cosmetic, orthodontic, pediatric, periodontics, oral surgery, etc.` },
    ],
    [
      { q: `What's the dental health ranking of ${stateName}?`, a: `${stateName} has numerous top-rated dental providers. Use our ratings and reviews to find the best care regardless of state rankings.` },
      { q: `Are there dental clinical trials in ${stateName}?`, a: `Dental schools and research institutions in ${stateName} sometimes conduct clinical trials. Contact local dental schools for information.` },
      { q: `How do I report a problem with a dentist in ${stateName}?`, a: `Contact the state dental board to file complaints. You can also leave reviews on our platform to warn other patients.` },
      { q: `Can I get dental care while visiting ${stateName}?`, a: `Yes, tourists and visitors can access dental care in ${stateName}. Search for clinics that accept new patients and offer flexible scheduling.` },
      { q: `What's the best season to book dental appointments in ${stateName}?`, a: `Fall and winter typically have more availability. Summer and around holidays are busier. Plan ahead for major procedures.` },
    ],
    [
      { q: `Do dental insurance premiums vary in ${stateName}?`, a: `Yes, dental insurance costs in ${stateName} depend on coverage level, provider, and whether you choose PPO or HMO plans.` },
      { q: `Are there affordable dental clinics in rural areas of ${stateName}?`, a: `Rural areas may have fewer options, but community health centers and dental schools often provide affordable care. Teledentistry is also expanding access.` },
      { q: `What dental research is happening in ${stateName}?`, a: `Major universities in ${stateName} conduct ongoing dental research on topics like implant technology, cavity prevention, and minimally invasive procedures.` },
      { q: `How do I find a dentist who speaks my language in ${stateName}?`, a: `Search for dentists with language filters or call clinics directly to ask about multilingual staff. Many offices have bilingual team members.` },
      { q: `What's the best way to compare dental prices in ${stateName}?`, a: `Use our platform to compare prices, ask for itemized quotes, and check if clinics offer price matching or bundled service packages.` },
    ],
    [
      { q: `Are there holistic or biological dentists in ${stateName}?`, a: `Some ${stateName} dentists offer holistic approaches. Search for "biological dentist" or "mercury-free dentist" to find practitioners.` },
      { q: `Do dental offices in ${stateName} offer payment plans?`, a: `Many ${stateName} dental offices partner with financing companies like CareCredit or offer in-house payment plans. Ask about options during consultation.` },
      { q: `What's the connection between oral health and overall health in ${stateName}?`, a: `Research shows links between gum disease and heart disease, diabetes, and pregnancy complications. Regular dental visits in ${stateName} help maintain overall health.` },
      { q: `Can I get dental treatment for special needs patients in ${stateName}?`, a: `Some ${stateName} dentists specialize in treating patients with special needs. Look for dentists with specific training or ask for referrals.` },
      { q: `How do I find a dentist who accepts my specific insurance in ${stateName}?`, a: `Use our insurance filter to find in-network dentists, or call your insurance provider for a list of participating dentists in ${stateName}.` },
    ],
  ];
  
  const faqIndex = Math.abs(stateName?.length || 0) % faqVariants.length;
  const defaultFaqs = faqVariants[faqIndex];
  const faqs = seoFaqs.length > 0 ? seoFaqs.map(f => ({ q: f.question, a: f.answer })) : defaultFaqs;

  const popularTreatments = (treatments || []).map(t => ({ name: t.name, slug: t.slug }));

  return (
    <PageLayout>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonical={`/${stateSlug}/`}
        keywords={[`dentists ${stateName}`, `dental clinics ${stateAbbr}`, `find dentist ${stateName}`, 'book dental appointment']}
      />
      <SyncStructuredData
        data={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: stateName, url: `/${stateSlug}/` },
            ],
          },
          {
            type: 'faq',
            questions: faqs.map(f => ({ question: f.q, answer: f.a })),
          },
        ]}
        id="state-page-schema"
      />

      {/* SECTION 1: Hero - Redesigned to match HomeV2 emerald theme */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 min-h-[70vh] flex items-center">
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

        <div className="container mx-auto px-4 relative z-10 py-16">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mb-8"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-5 py-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-100">Licensed Dental Professionals</span>
              </div>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight"
            >
              Find the Best Dentists in <br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">{stateName}</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl mx-auto"
            >
              Browse {cities?.length || 0} cities across {stateName}. Compare top-rated dentists, read real reviews, and book your appointment instantly.
            </motion.p>

            {/* Search Bar - Matching HomeV2 style */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-3xl mx-auto mb-10"
            >
              <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
                <div className="grid md:grid-cols-12">
                  {/* Location Input */}
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
                  {/* Treatment Select */}
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
                  {/* Search Button */}
                  <div className="md:col-span-2 bg-emerald-500 hover:bg-emerald-600 transition-colors">
                    <Button 
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (searchLocation) params.set('city', searchLocation.toLowerCase().replace(/ /g, '-'));
                        if (searchTreatment) params.set('treatment', searchTreatment);
                        navigate(`/search?${params.toString()}`);
                      }}
                      className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-none text-lg"
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats - Matching HomeV2 style */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-4"
            >
              {[
                { icon: Building2, value: cities?.length || 0, label: "Cities" },
                { icon: Star, value: "4.9", label: "Avg Rating" },
                { icon: Clock, value: "60s", label: "Book Time" },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                  <stat.icon className="h-5 w-5 text-emerald-400" />
                  <span className="font-bold text-white text-lg">{stat.value}</span>
                  <span className="text-slate-300 text-sm">{stat.label}</span>
                </div>
              ))}
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

      {/* Page Intro Section - Redesigned */}
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
                    About Dental Care in {stateName}
                  </h2>
                  <p className="text-slate-500 text-sm">Your guide to finding the best dentists</p>
                </div>
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="text-lg text-slate-600 leading-relaxed">
                  {parsedContent?.sections?.[0]?.content || `Discover top-rated dental professionals across ${stateName}. Browse by city, compare reviews, and book your appointment online.`}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {popularTreatments.slice(0, 4).map((treatment, i) => (
                  <a
                    key={i}
                    href={`/services/${treatment.slug}`}
                    className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium hover:bg-emerald-100 transition-colors"
                  >
                    {treatment.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Dentists */}
      <Section size="lg">
        <div className="container px-4">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Featured Dentists in {stateName}
                </h2>
                <p className="text-slate-500 mt-1">
                  {totalClinicCount} verified dental clinics across {cities?.length || 0} cities
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Sort by:</span>
                <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
                  <option>Top Rated</option>
                  <option>Most Reviews</option>
                  <option>Most Clinics</option>
                </select>
              </div>
            </div>

            {/* Dentist List Frame */}
            <DentistListFrame
              profiles={profiles}
              isLoading={profilesLoading}
              locationName={stateName}
              emptyMessage={`We're adding dentists in ${stateName}. Check back soon!`}
              maxHeight={600}
              initialCount={6}
            />

            {/* Full Width Interactive Map - Like Google Maps */}
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
                
                {/* Full Map with Sidebar - Google Maps Style */}
                <div className="flex flex-col lg:flex-row">
                  {/* Map - Takes most of the space */}
                  <div className="lg:flex-[2]">
                    <DentistFinderMap
                      className="h-[400px] lg:h-[550px]"
                      markers={profiles
                        .filter((p: any) => p.latitude && p.longitude)
                        .map((p: any) => ({
                          id: p.id,
                          name: p.name,
                          slug: p.slug,
                          latitude: p.latitude,
                          longitude: p.longitude,
                          address: p.address,
                          rating: p.rating,
                          isVerified: p.isVerified,
                          hasBookNow: p.claim_status === 'claimed'
                        }))}
                    />
                  </div>
                  
                  {/* Dentist List Sidebar - Right side */}
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
                            className="block p-4 text-left transition-all hover:bg-slate-50"
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
          </div>
        </div>
      </Section>

      {/* SECTION: Cities Grid - Matching HomeV2 dark section theme */}
      <section className="py-16 md:py-24 bg-slate-900">
        <div className="container">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Browse by City</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Cities in <span className="text-emerald-400">{stateName}</span>
            </h2>
          </div>

          {citiesLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : cities && cities.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-w-6xl mx-auto">
                {cities.slice(0, visibleCityCount).map((city, i) => {
                  const dentistCount = (city.dentist_count || 0) > 0 ? city.dentist_count : (cityClinicCounts?.[city.id] || 0);
                  return (
                    <Link
                      key={city.id}
                      to={`/${stateSlug}/${city.slug}/`}
                      className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:border-emerald-500/50 hover:bg-white/10 transition-all flex flex-col"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <h3 className="font-semibold text-white text-sm truncate group-hover:text-emerald-400 transition-colors">
                          {city.name}
                        </h3>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          {dentistCount > 0 ? `${dentistCount}+` : '0'}
                        </span>
                        <ArrowRight className="h-3 w-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
              
              {/* Load More Button - Compact */}
              {cities.length > visibleCityCount && (
                <div className="text-center mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCityCount(prev => Math.min(prev + 12, cities.length))}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-transparent hover:bg-white/10 text-white font-medium rounded-xl border border-white/20 hover:border-emerald-500/50 transition-all text-sm"
                  >
                    Load More ({cities.length - visibleCityCount} more)
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-white/5 border border-white/10 rounded-3xl">
              <MapPin className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No cities found</h3>
              <p className="text-white/60">We're still adding cities in this state.</p>
            </div>
          )}
        </div>
      </section>

      {/* SEO Content Section */}
      <Section size="lg">
        <div className="max-w-5xl mx-auto">
          <SEOContentBlock
            variant="state"
            locationName={stateName}
            stateAbbr={stateAbbr}
            stateSlug={stateSlug}
            clinicCount={totalClinicCount}
            cityCount={cities?.length || 0}
            parsedContent={parsedContent}
            popularTreatments={popularTreatments}
            isLoading={seoContentLoading || seoContentFetching}
          />
        </div>
      </Section>

      {/* SECTION 5: FAQ - Redesigned */}
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
              Find answers about finding and booking dental appointments in {stateName}
            </p>
          </div>

          {/* Quick Answer for Featured Snippets */}
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <h3 className="font-bold text-slate-800 mb-2">Quick Answer</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Finding a quality dentist in {stateName} is easy with our verified directory. Browse by city, compare ratings, read reviews, and book appointments directly online. Our network includes general dentists and specialists for all your dental care needs.
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
                    <span className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 text-sm font-bold">
                      {i + 1}
                    </span>
                    {faq.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-300 pb-6 px-6 pl-14">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* SECTION 6: Geographic Link Block - SEO Authority Distribution */}
      <Section size="md">
        <div className="max-w-5xl mx-auto">
          <GeographicLinkBlock
            pageType="state"
            stateSlug={stateSlug || ''}
            stateName={stateName}
            topCities={(cities || []).slice(0, 8).map(c => ({ name: c.name, slug: c.slug }))}
            services={popularTreatments}
          />
        </div>
      </Section>

      {/* SECTION 7: Services Links - Enhanced */}
      {treatments && treatments.length > 0 && (
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="container px-4">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-4">
                  <Stethoscope className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">Dental Services</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                  Browse Treatments in <span className="text-emerald-600">{stateName}</span>
                </h2>
                <p className="text-slate-500 max-w-xl mx-auto">
                  Find the right dental service for your needs
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {treatments.slice(0, 12).map((treatment, i) => (
                  <Link
                    key={treatment.id}
                    to={`/services/${treatment.slug}`}
                    className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all"
                  >
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-500 transition-colors">
                      <Stethoscope className="h-6 w-6 text-emerald-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {treatment.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-2 text-sm text-slate-500 group-hover:text-emerald-600">
                      <span>Learn more</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </PageLayout>
  );
};

export default StatePage;
