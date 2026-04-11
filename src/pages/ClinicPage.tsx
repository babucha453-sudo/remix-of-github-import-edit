import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { InternalLinkBlock, generateClinicInternalLinks } from "@/components/seo/InternalLinkBlock";
import { SmartBookingModal } from "@/components/booking/SmartBookingModal";
import { useSeoPageContent, parseMarkdownContent, parseFaqFromContent } from "@/hooks/useSeoPageContent";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { PromotionBanner } from "@/components/subscription/PromotionBanner";
import { optimizeImageUrl } from "@/lib/imageUtils";
import { sanitizeHtml } from "@/lib/utils";
import {
  ClinicStickyBooking,
  ClinicTeamSection,
  ClaimProfileCTA,
  ClinicGallery,
  ClinicReviewsSection,
  InsuranceTab,
  BeforeAfterGallery,
} from "@/components/clinic";
import {
  Star,
  BadgeCheck,
  Calendar,
  Share2,
  Heart,
  Shield,
  Award,
  Users,
  MapPin,
  Phone,
  Globe,
  Clock,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Percent
} from "lucide-react";
import { AIMatchBadge } from "@/components/ai";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const ClinicPage = () => {
  const { clinicSlug } = useParams();
  const slug = clinicSlug || "";
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedDentistId, setSelectedDentistId] = useState<string | undefined>();
  const { trackProfileView } = useAnalytics();

  // Fetch SEO content from seo_pages table
  const seoSlug = `clinic/${slug}`;
  const { data: seoContent } = useSeoPageContent(seoSlug);
  const parsedContent = seoContent?.content ? parseMarkdownContent(seoContent.content) : null;
  // Use dedicated faqs column first, fallback to parsing from content for legacy pages
  const seoFaqs = seoContent?.faqs && Array.isArray(seoContent.faqs) && seoContent.faqs.length > 0
    ? seoContent.faqs
    : seoContent?.content ? parseFaqFromContent(seoContent.content) : [];

  // Fetch clinic data - only exact slug match
  const { data: clinic, isLoading, error } = useQuery({
    queryKey: ["clinic", slug],
    queryFn: async () => {
      if (!slug || slug.includes('/')) return null; // Prevent path traversal
      const { data, error } = await supabase
        .from("clinics")
        .select("*, city:cities(name, slug, state:states(name, slug, abbreviation)), area:areas(name, slug)")
        .eq("slug", slug)
        .maybeSingle(); // Use maybeSingle to return null instead of error for no match
      if (error) throw error;
      return data;
    },
    enabled: !!slug && !slug.includes('/'),
  });

  // Fetch dentists/team members
  const { data: dentists } = useQuery({
    queryKey: ["clinic-dentists", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from("dentists")
        .select("*")
        .eq("clinic_id", clinic.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("name");
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch treatments
  const { data: treatments } = useQuery({
    queryKey: ["clinic-treatments", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from("clinic_treatments")
        .select("*, treatment:treatments(*)")
        .eq("clinic_id", clinic.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch internal reviews from review_funnel_events
  const { data: reviews } = useQuery({
    queryKey: ["clinic-reviews", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from("review_funnel_events")
        .select("*")
        .eq("clinic_id", clinic.id)
        .eq("event_type", "rating_submitted")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []).map((r: any) => ({
        id: r.id,
        patient_name: r.visitor_id || 'Anonymous',
        rating: r.rating || 5,
        content: r.comment || '',
        created_at: r.created_at,
        source: 'internal' as const,
      }));
    },
    enabled: !!clinic?.id,
  });

  // Fetch Google reviews
  const { data: googleReviews } = useQuery({
    queryKey: ["clinic-google-reviews", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from("google_reviews")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("review_time", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!clinic?.id && clinic?.gmb_connected,
  });

  // Fetch gallery images
  const { data: galleryImages } = useQuery({
    queryKey: ["clinic-gallery", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from("clinic_images")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("display_order");
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch hours
  const { data: hours } = useQuery({
    queryKey: ["clinic-hours", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from("clinic_hours")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("day_of_week");
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Handle booking
  const handleBookClick = (dentistId?: string) => {
    setSelectedDentistId(dentistId);
    setBookingOpen(true);
  };

  // Track profile view in GA4 when clinic data is available
  useEffect(() => {
    if (clinic?.id && clinic?.name) {
      trackProfileView({
        profile_type: 'clinic',
        profile_id: clinic.id,
        profile_name: clinic.name,
        city: clinic.city?.name,
        state: clinic.city?.state?.abbreviation,
      });
    }
  }, [clinic?.id, clinic?.name, clinic?.city?.name, clinic?.city?.state?.abbreviation, trackProfileView]);

  // Signal prerender when ALL SEO-critical data is ready
  // This includes clinic data, treatments (for services list), and SEO content
  const isDataReady = !isLoading && !!clinic &&
    !!treatments && // Services list is SEO-critical
    (!!seoContent || !seoSlug); // SEO content loaded or not expected
  usePrerenderReady(isDataReady, { delay: 600 });

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container py-8">
          <Skeleton className="h-80 rounded-3xl mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div>
              <Skeleton className="h-64 rounded-3xl" />
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!clinic) {
    return (
      <PageLayout>
        <Section>
          <div className="text-center py-20">
            <h1 className="font-display text-3xl font-bold mb-4">Clinic Not Found</h1>
            <p className="text-muted-foreground mb-8">
              The clinic you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild className="rounded-xl font-bold">
              <Link to="/search">Browse Clinics</Link>
            </Button>
          </div>
        </Section>
      </PageLayout>
    );
  }

  // Determine profile state
  const isClaimed = clinic.claim_status === "claimed";
  const isVerified = clinic.verification_status === "verified" && isClaimed;
  const isGmbConnected = clinic.gmb_connected === true;

  // Get state slug from city data
  const stateSlug = clinic.city?.state?.slug || '';

  const breadcrumbs = [
    { label: "Clinics", href: "/search" },
    ...(clinic.city?.state ? [{ label: clinic.city.state.name, href: `/${clinic.city.state.slug}` }] : []),
    ...(clinic.city ? [{ label: clinic.city.name, href: `/${stateSlug}/${clinic.city.slug}` }] : []),
    { label: clinic.name },
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || (
          `${Number(clinic.rating) > 0 ? `★${Number(clinic.rating).toFixed(1)} ` : ''}${clinic.name}, ${clinic.city?.name || 'United States'}${clinic.review_count ? ` — ${clinic.review_count} Reviews` : ''} | Book Online | AppointPanda`
        )}
        description={seoContent?.meta_description || clinic.description || `Book an appointment at ${clinic.name}. ${isVerified ? 'Verified ' : ''}dental clinic in ${clinic.city?.name || 'United States'} with ${dentists?.length || 0} specialists. Read ${clinic.review_count || 0} patient reviews.`}
        canonical={`/clinic/${clinic.slug}/`}
        keywords={[clinic.name, `dental clinic ${clinic.city?.name}`, `dentist ${clinic.city?.state?.abbreviation || 'US'}`]}
      />
      {/* Synchronous JSON-LD structured data for SEO */}
      <SyncStructuredData
        data={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              ...(clinic.city?.state?.abbreviation ? [{ name: clinic.city?.state?.name || '', url: `/${clinic.city?.state?.abbreviation.toLowerCase()}/` }] : []),
              ...(clinic.city ? [{ name: clinic.city.name, url: `/${clinic.city?.state?.abbreviation?.toLowerCase() || ''}/${clinic.city.slug}/` }] : []),
              { name: clinic.name },
            ],
          },
          {
            type: 'localBusiness',
            name: clinic.name,
            description: clinic.description || `Professional dental clinic in ${clinic.city?.name || 'United States'}`,
            address: clinic.address || '',
            city: clinic.city?.name || '',
            state: clinic.city?.state?.abbreviation || '',
            country: 'United States',
            phone: clinic.phone || '',
            url: `/clinic/${clinic.slug}/`,
            geo: clinic.latitude && clinic.longitude ? { lat: Number(clinic.latitude), lng: Number(clinic.longitude) } : undefined,
            rating: clinic.rating ? Number(clinic.rating) : undefined,
            reviewCount: clinic.review_count || undefined,
            priceRange: '$75 - $6,000',
            services: (treatments || []).slice(0, 10).map(t => t.treatment?.name).filter(Boolean) as string[],
            openingHours: (hours || []).map((h: any) => {
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              return {
                day: dayNames[h.day_of_week] || 'Monday',
                open: h.open_time || '09:00',
                close: h.close_time || '17:00',
              };
            }),
          },
        ]}
        id="clinic-schema"
      />

      {/* Hero Cover */}
      <div className="relative h-40 md:h-56 bg-gradient-to-br from-emerald-50 via-white to-white overflow-hidden">
        {clinic.cover_image_url ? (
          <img
            src={clinic.cover_image_url?.includes('images.unsplash.com') 
              ? optimizeImageUrl(clinic.cover_image_url, { width: 1200, quality: 80 })
              : clinic.cover_image_url}
            alt={clinic.name}
            width={1200}
            height={600}
            loading="eager"
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0">
            <div className="absolute top-0 left-[-10%] w-[300px] h-[300px] rounded-full bg-emerald-200/30 blur-[80px]" />
            <div className="absolute bottom-0 right-[-10%] w-[250px] h-[250px] rounded-full bg-teal-200/30 blur-[60px]" />
            <div className="absolute inset-0 opacity-5" style={{ 
              backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
              backgroundSize: '30px 30px' 
            }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent" />

        {/* Breadcrumbs */}
        <div className="absolute top-4 left-0 right-0">
          <div className="container">
            <Breadcrumbs items={breadcrumbs} className="text-white/80" />
          </div>
        </div>
      </div>

      {/* Clinic Header Card */}
      <Section size="sm" className="-mt-14 relative z-10">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-xl shadow-black/5 p-5 md:p-6">
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Logo */}
            <div className="shrink-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden border-2 border-gray-100 shadow-md">
                {clinic.cover_image_url ? (
                  <img
                    src={clinic.cover_image_url?.includes('images.unsplash.com')
                      ? optimizeImageUrl(clinic.cover_image_url, { width: 200, quality: 80 })
                      : clinic.cover_image_url}
                    alt={clinic.name}
                    width={96}
                    height={96}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                    <span className="text-2xl font-display font-bold text-emerald-600">
                      {clinic.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {isVerified && (
                  <Badge className="bg-primary text-primary-foreground rounded-full px-3 py-1 font-bold">
                    <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                    Verified
                  </Badge>
                )}
                {isClaimed && !isVerified && (
                  <Badge className="bg-gold/10 text-gold border border-gold/20 rounded-full px-3 py-1 font-bold">
                    <Award className="h-3.5 w-3.5 mr-1" />
                    Claimed
                  </Badge>
                )}
                {isGmbConnected && (
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    <img
                      src="https://www.google.com/favicon.ico"
                      alt="Google"
                      className="h-3 w-3 mr-1"
                    />
                    GMB Synced
                  </Badge>
                )}
                {!isClaimed && (
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs text-amber-600 border-amber-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Unclaimed
                  </Badge>
                )}
              </div>

              <h1 className="font-display text-2xl md:text-3xl font-bold mb-2 truncate">
                {clinic.name}
              </h1>

              {/* Rating & Location Row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {(Number(clinic.rating) || 0) > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 text-gold">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-bold">{Number(clinic.rating).toFixed(1)}</span>
                    </div>
                    <span className="text-muted-foreground">
                      ({clinic.review_count || 0})
                    </span>
                  </div>
                )}
                {(clinic.area || clinic.city) && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{clinic.area?.name || clinic.city?.name}</span>
                  </div>
                )}
                {dentists && dentists.length > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{dentists.length} Dentists</span>
                  </div>
                )}
              </div>

              {/* Quick Links - Only for claimed */}
              {isClaimed && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {clinic.phone && (
                    <a
                      href={`tel:${clinic.phone}`}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {clinic.phone}
                    </a>
                  )}
                  {clinic.website && (
                    <a
                      href={clinic.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Website
                    </a>
                  )}
                </div>
              )}

              {/* GMB sync info is now shown in the dedicated GMB dashboard */}
            </div>

            {/* Action Buttons - Desktop */}
            <div className="hidden lg:flex flex-col gap-2 shrink-0">
              <Button
                size="lg"
                className="rounded-xl font-bold"
                onClick={() => handleBookClick()}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book Appointment
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="rounded-xl flex-1">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-xl flex-1">
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Promotion Banner - For Dentists */}
      <Section size="sm" className="pt-0">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 p-[2px]">
          <div className="relative rounded-2xl bg-background/95 backdrop-blur-sm px-6 py-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <Percent className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-lg">
                      🎉 50% OFF All Plans
                    </h3>
                    <Badge className="bg-red-500 text-white border-0 animate-pulse">
                      Limited Time
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Claim this profile & get 50% off your first month. Verified badge + instant bookings.
                  </p>
                </div>
              </div>
              <Button asChild className="bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 hover:from-red-600 hover:to-orange-600">
                <Link to="/pricing">
                  View Plans
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Unclaimed Notice Banner */}
      {!isClaimed && (
        <Section size="sm" className="pt-0">
          <ClaimProfileCTA
            clinicId={clinic.id}
            clinicName={clinic.name}
            variant="banner"
          />
        </Section>
      )}

      {/* Main Content Grid */}
      <Section size="md" className="overflow-x-hidden">
        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Content */}
          <div className="lg:col-span-2 min-w-0 overflow-hidden">
            <Tabs defaultValue="overview" className="w-full">
              {/* Mobile-optimized scrollable tabs - touch-friendly */}
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide touch-manipulation pb-1">
                <TabsList className="inline-flex w-max md:w-full justify-start bg-muted/50 rounded-2xl p-1 mb-4 md:mb-6">
                  <TabsTrigger value="overview" className="rounded-xl font-bold text-xs px-2.5 py-2 md:text-sm md:px-4 whitespace-nowrap touch-manipulation">Overview</TabsTrigger>
                  <TabsTrigger value="team" className="rounded-xl font-bold text-xs px-2.5 py-2 md:text-sm md:px-4 whitespace-nowrap touch-manipulation">Team</TabsTrigger>
                  <TabsTrigger value="services" className="rounded-xl font-bold text-xs px-2.5 py-2 md:text-sm md:px-4 whitespace-nowrap touch-manipulation">Services</TabsTrigger>
                  <TabsTrigger value="reviews" className="rounded-xl font-bold text-xs px-2.5 py-2 md:text-sm md:px-4 whitespace-nowrap touch-manipulation">Reviews</TabsTrigger>
                  <TabsTrigger value="insurance" className="rounded-xl font-bold text-xs px-2.5 py-2 md:text-sm md:px-4 whitespace-nowrap touch-manipulation">Insurance</TabsTrigger>
                  <TabsTrigger value="before-after" className="rounded-xl font-bold text-xs px-2.5 py-2 md:text-sm md:px-4 whitespace-nowrap touch-manipulation">Before & After</TabsTrigger>
                  {galleryImages && galleryImages.length > 0 && (
                    <TabsTrigger value="photos" className="rounded-xl font-bold text-xs px-2.5 py-2 md:text-sm md:px-4 whitespace-nowrap touch-manipulation">Photos</TabsTrigger>
                  )}
                </TabsList>
              </div>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 animate-fade-in-up">
                {/* AI Match Badge - Shows why this clinic is a good match */}
                <AIMatchBadge
                  clinicName={clinic.name}
                  location={clinic.city?.name || ''}
                  rating={Number(clinic.rating) || 0}
                  isVerified={isVerified}
                />

                {/* Description - Show optimized SEO content if available */}
                <div className="card-modern p-4 md:p-6 overflow-hidden">
                  <h2 className="font-display text-lg md:text-xl font-bold mb-4">About This Clinic</h2>

                  {/* Use optimized SEO content if available */}
                  {parsedContent && parsedContent.intro ? (
                    <div className="space-y-4 overflow-hidden">
                      <p className="text-muted-foreground leading-relaxed text-sm md:text-base break-words">
                        {parsedContent.intro}
                      </p>

                      {/* Render H2/H3 sections from optimized content */}
                      {parsedContent.sections.filter(s => !s.heading.toLowerCase().includes('faq')).slice(0, 3).map((section, idx) => (
                        <div key={idx} className="mt-6 overflow-hidden">
                          {section.level === 2 ? (
                            <h3 className="font-display text-base md:text-lg font-bold text-foreground mb-3">{section.heading}</h3>
                          ) : (
                            <h4 className="font-semibold text-foreground mb-2 text-sm md:text-base">{section.heading}</h4>
                          )}
                          <div
                            className="text-muted-foreground leading-relaxed prose prose-sm max-w-none text-sm md:text-base break-words overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content.replace(/\n/g, '<br/>')) }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground leading-relaxed text-sm md:text-base break-words">
                      {clinic.description || `${clinic.name} is a dental clinic in ${clinic.area?.name || clinic.city?.name || 'Dubai'}${isClaimed ? ', offering comprehensive dental services with a focus on patient comfort and quality care.' : '. More details will be available once the clinic claims their profile.'}`}
                    </p>
                  )}

                  {!isClaimed && (
                    <div className="mt-4">
                      <ClaimProfileCTA
                        clinicId={clinic.id}
                        clinicName={clinic.name}
                        variant="inline"
                      />
                    </div>
                  )}
                </div>

                {/* SEO FAQs Section - Show if available */}
                {seoFaqs && seoFaqs.length > 0 && (
                  <div className="card-modern p-4 md:p-6 overflow-hidden">
                    <h2 className="font-display text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                      Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                      {seoFaqs.slice(0, 5).map((faq, idx) => (
                        <div key={idx} className="border-b border-border pb-4 last:border-0 last:pb-0 overflow-hidden">
                          <h3 className="font-semibold text-foreground mb-2 text-sm md:text-base break-words">{faq.question}</h3>
                          <p className="text-muted-foreground text-xs md:text-sm break-words">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Gallery Preview */}
                {galleryImages && galleryImages.length > 0 && (
                  <div className="card-modern p-4 md:p-6 overflow-hidden">
                    <h2 className="font-display text-lg md:text-xl font-bold mb-4">Photos</h2>
                    <ClinicGallery images={galleryImages.slice(0, 4)} clinicName={clinic.name} />
                  </div>
                )}

                {/* Services Preview */}
                {treatments && treatments.length > 0 && (
                  <div className="card-modern p-4 md:p-6 overflow-hidden">
                    <h2 className="font-display text-lg md:text-xl font-bold mb-4">Popular Services</h2>
                    <div className="flex flex-wrap gap-2">
                      {treatments.slice(0, 8).map((ct: any) => {
                        // Build service URL with clinic's city for local relevance
                        // Route: /:stateSlug/:citySlug/:serviceSlug
                        const serviceUrl = clinic.city?.state?.slug && clinic.city?.slug
                          ? `/${clinic.city.state.slug}/${clinic.city.slug}/${ct.treatment?.slug}`
                          : `/services/${ct.treatment?.slug}`;
                        return (
                          <Link
                            key={ct.id}
                            to={serviceUrl}
                            className="px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted hover:text-primary transition-colors max-w-full"
                          >
                            <span className="text-sm font-medium truncate">{ct.treatment?.name}</span>
                          </Link>
                        );
                      })}
                      {treatments.length > 8 && (
                        <Badge variant="secondary" className="rounded-xl">
                          +{treatments.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="animate-fade-in-up">
                <div className="card-modern p-4 md:p-6 overflow-hidden">
                  <h2 className="font-display text-lg md:text-xl font-bold mb-4 md:mb-6">Our Dental Team</h2>
                  <ClinicTeamSection
                    teamMembers={dentists || []}
                    clinicName={clinic.name}
                    onBookWithDentist={(dentistId) => handleBookClick(dentistId)}
                  />
                </div>
              </TabsContent>

              {/* Services Tab */}
              <TabsContent value="services" className="animate-fade-in-up">
                <div className="card-modern p-4 md:p-6 overflow-hidden">
                  <h2 className="font-display text-lg md:text-xl font-bold mb-4">Services Offered</h2>
                  {treatments && treatments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                      {treatments.map((ct: any) => {
                        // Build service URL with clinic's city for local relevance
                        const serviceUrl = clinic.city?.state?.slug && clinic.city?.slug
                          ? `/services/${ct.treatment?.slug}/${clinic.city.state.slug}/${clinic.city.slug}`
                          : `/services/${ct.treatment?.slug}`;
                        return (
                          <Link
                            key={ct.id}
                            to={serviceUrl}
                            className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group overflow-hidden"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-bold group-hover:text-primary transition-colors text-sm md:text-base truncate">{ct.treatment?.name}</p>
                              {(ct.price_from || ct.price_to) && (
                                <p className="text-xs md:text-sm text-muted-foreground">
                                  {ct.price_from && `From $${ct.price_from}`}
                                  {ct.price_to && ` - $${ct.price_to}`}
                                </p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm md:text-base">
                      {isClaimed
                        ? "Contact the clinic for available services."
                        : "Services will be listed once the clinic claims their profile."}
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="animate-fade-in-up">
                <div className="card-modern p-4 md:p-6 overflow-hidden">
                  <h2 className="font-display text-lg md:text-xl font-bold mb-4 md:mb-6">Patient Reviews</h2>
                  <ClinicReviewsSection
                    reviews={reviews || []}
                    googleReviews={googleReviews || []}
                    clinicRating={clinic.rating ? Number(clinic.rating) : undefined}
                    clinicReviewCount={clinic.review_count || 0}
                    gmbConnected={isGmbConnected}
                    clinicSlug={clinic.slug}
                    clinicId={clinic.id}
                  />
                </div>
              </TabsContent>

              {/* Insurance Tab */}
              <TabsContent value="insurance" className="animate-fade-in-up">
                <div className="card-modern p-4 md:p-6 overflow-hidden">
                  <h2 className="font-display text-lg md:text-xl font-bold mb-4 md:mb-6">Insurance & Payment</h2>
                  <InsuranceTab clinicId={clinic.id} isClaimed={isClaimed} />
                </div>
              </TabsContent>

              {/* Before & After Tab */}
              <TabsContent value="before-after" className="animate-fade-in-up">
                <div className="card-modern p-4 md:p-6 overflow-hidden">
                  <h2 className="font-display text-lg md:text-xl font-bold mb-4 md:mb-6">Treatment Results</h2>
                  <BeforeAfterGallery clinicId={clinic.id} isClaimed={isClaimed} />
                </div>
              </TabsContent>

              {/* Photos Tab */}
              {galleryImages && galleryImages.length > 0 && (
                <TabsContent value="photos" className="animate-fade-in-up">
                  <div className="card-modern p-4 md:p-6 overflow-hidden">
                    <h2 className="font-display text-lg md:text-xl font-bold mb-4">
                      Gallery ({galleryImages.length} photos)
                    </h2>
                    <ClinicGallery images={galleryImages} clinicName={clinic.name} />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Right Column - Sticky Sidebar */}
          <div className="space-y-6">
            {/* Sticky Booking Widget */}
            <div className="lg:sticky lg:top-24">
              <ClinicStickyBooking
                clinicId={clinic.id}
                clinicName={clinic.name}
                clinicPhone={clinic.phone}
                clinicRating={clinic.rating ? Number(clinic.rating) : undefined}
                clinicReviewCount={clinic.review_count || 0}
                clinicArea={clinic.area?.name || clinic.city?.name}
                clinicLatitude={clinic.latitude ? Number(clinic.latitude) : undefined}
                clinicLongitude={clinic.longitude ? Number(clinic.longitude) : undefined}
                clinicAddress={clinic.address || undefined}
                hours={hours || []}
                teamMembers={dentists || []}
                isClaimed={isClaimed}
              />

              {/* Claim CTA in sidebar for unclaimed */}
              {!isClaimed && (
                <div className="mt-6">
                  <ClaimProfileCTA
                    clinicId={clinic.id}
                    clinicName={clinic.name}
                    variant="sidebar"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Sticky Book Button */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-gray-100 z-50">
          <Button
            className="w-full rounded-xl font-bold h-12 shadow-lg shadow-black/10"
            size="lg"
            onClick={() => handleBookClick()}
          >
            <Calendar className="h-5 w-5 mr-2" />
            Book Appointment
          </Button>
        </div>
      </Section>

      {/* Smart Booking Modal - Dark Theme */}
      <SmartBookingModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        clinicId={clinic.id}
        clinicName={clinic.name}
        clinicAddress={clinic.address || undefined}
        dentistId={selectedDentistId}
        dentistName={selectedDentistId
          ? dentists?.find(d => d.id === selectedDentistId)?.name
          : undefined
        }
        clinicRating={clinic.rating ? Number(clinic.rating) : undefined}
      />
    </PageLayout>
  );
};

export default ClinicPage;
