import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SearchBox } from "@/components/SearchBox";
import { DentistListFrame, LocationQuickLinks } from "@/components/location";
import { SEOContentBlock } from "@/components/seo/SEOContentBlock";
import { PageIntroSection } from "@/components/seo/PageIntroSection";
import { GeographicLinkBlock } from "@/components/seo/GeographicLinkBlock";
import { useProfiles } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { InternalLinkBlock, generateServiceLocationInternalLinks } from "@/components/seo/InternalLinkBlock";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useState as useStateData, useCity, useCitiesByStateSlug } from "@/hooks/useLocations";
import { useSeoPageContent, parseMarkdownContent, parseFaqFromContent } from "@/hooks/useSeoPageContent";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { normalizeStateSlug } from "@/lib/slug/normalizeStateSlug";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users,
  Shield,
  Clock,
  Star,
  Stethoscope
} from "lucide-react";

const MIN_PROFILE_COUNT = 2; // noindex pages with fewer than 2 providers

const ServiceLocationPage = () => {
  const { stateSlug, citySlug, serviceSlug } = useParams();
  const normalizedStateSlug = normalizeStateSlug(stateSlug);
  const service = serviceSlug || "";

  const { data: state } = useStateData(normalizedStateSlug || '');
  const { data: city } = useCity(citySlug || '', normalizedStateSlug || '');

  // Fetch SEO content
  const seoSlug = `${normalizedStateSlug || ""}/${citySlug || ""}/${serviceSlug || ""}`;
  const {
    data: seoContent,
    isLoading: seoContentLoading,
    isFetching: seoContentFetching,
  } = useSeoPageContent(seoSlug);

  // IMPORTANT: react-query's `isFetching` can be true during background refetches
  // even when we already have content. We must not hide SEO content during those
  // refetches (it looks like “content disappeared”).
  const isSeoContentPending = !seoContent && (seoContentLoading || seoContentFetching);

  // Fetch treatment data
  const { data: treatment, isLoading: treatmentLoading, isFetching: treatmentFetching } = useQuery({
    queryKey: ["treatment", service],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("*")
        .eq("slug", service)
        .maybeSingle();
      return data;
    },
    enabled: !!service,
  });

  // Fetch profiles
  const { data: profiles, isLoading: profilesLoading } = useProfiles({
    cityId: city?.id,
    treatmentId: treatment?.id,
    limit: 50,
  });

  // Fetch related services
  const { data: relatedServices, isLoading: relatedServicesLoading } = useQuery({
    queryKey: ["related-services", service],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("*")
        .eq("is_active", true)
        .neq("slug", service)
        .order("display_order")
        .limit(6);
      return data || [];
    },
  });

  // Fetch nearby cities
  const { data: nearbyCities, isLoading: nearbyCitiesLoading } = useCitiesByStateSlug(normalizedStateSlug || '');

  // Signal prerender when ALL SEO-critical data is ready
  // Includes: location, profiles (for listings), related services (internal links), nearby cities, treatment info, and SEO content
  const isDataReady =
    !!state &&
    !!city &&
    !profilesLoading &&
    !relatedServicesLoading &&
    !nearbyCitiesLoading &&
    !treatmentLoading &&
    !treatmentFetching &&
    !seoContentLoading &&
    !seoContentFetching;
  usePrerenderReady(isDataReady, { delay: 600 });

  const locationName = city?.name || citySlug?.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || '';
  const stateName = state?.name || '';
  const stateAbbr = state?.abbreviation || '';
  const treatmentName = treatment?.name || service.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  const locationDisplay = stateAbbr ? `${locationName}, ${stateAbbr}` : locationName;

  // Redirect legacy full-name state slugs to canonical abbreviation slugs
  // e.g., /california/los-angeles/cosmetic-dentist -> /ca/los-angeles/cosmetic-dentist
  const stateAbbrev = Object.entries({
    california: "ca",
    massachusetts: "ma",
    connecticut: "ct",
    "new-jersey": "nj",
  }).find(([full]) => full === stateSlug)?.[1];

  if (stateSlug && normalizedStateSlug && stateSlug === normalizedStateSlug && stateAbbrev && citySlug && serviceSlug) {
    return <Navigate to={`/${stateAbbrev}/${citySlug}/${serviceSlug}/`} replace />;
  }

  const breadcrumbs = [
    { label: "Home", href: "/" },
    ...(stateSlug && stateName ? [{ label: stateName, href: `/${stateSlug}/` }] : []),
    ...(citySlug && stateSlug ? [{ label: locationName, href: `/${stateSlug}/${citySlug}/` }] : []),
    { label: treatmentName },
  ];

  // Parse SEO content
  const parsedContent = seoContent?.content ? parseMarkdownContent(seoContent.content) : null;
  // Use dedicated faqs column first, fallback to parsing from content for legacy pages
  const seoFaqs = seoContent?.faqs && Array.isArray(seoContent.faqs) && seoContent.faqs.length > 0
    ? seoContent.faqs
    : seoContent?.content ? parseFaqFromContent(seoContent.content) : [];

  const profileCountDisplay = profiles?.length || 0;
  const pageTitle = seoContent?.meta_title || `Best ${treatmentName} in ${locationDisplay} — Compare ${profileCountDisplay}+ Dentists | AppointPanda`;
  const pageDescription = seoContent?.meta_description || `Find the best ${treatmentName.toLowerCase()} specialists in ${locationDisplay}. Compare ${profileCountDisplay}+ verified clinics, read reviews, and book online today.`;
  const pageH1 = seoContent?.h1 || `${treatmentName} in ${locationDisplay}`;

  const faqs = seoFaqs.length > 0 ? seoFaqs.map(f => ({ q: f.question, a: f.answer })) : [
    {
      q: `Where can I find ${treatmentName} specialists in ${locationName}?`,
      a: `We have ${profiles?.length || 0}+ verified ${treatmentName.toLowerCase()} specialists in ${locationName}. Browse our directory above to compare ratings and book appointments.`,
    },
    {
      q: `How much does ${treatmentName} cost in ${locationName}?`,
      a: `${treatmentName} costs in ${locationName} vary by clinic. A typical range is $500-15,000. We recommend booking a consultation for an accurate quote.`,
    },
    {
      q: `Are the ${treatmentName} dentists in ${locationName} verified?`,
      a: `All dentists on our platform are licensed. Profiles with the "Verified" badge have completed our additional verification process.`,
    },
    {
      q: `How do I book a ${treatmentName} appointment in ${locationName}?`,
      a: `Browse the specialists above, click "Book Now" on any profile, and follow the easy booking process. The clinic will confirm your appointment.`,
    },
  ];

  const shouldNoIndex = !profilesLoading && (!profiles || profiles.length < MIN_PROFILE_COUNT);

  const nearbyLocations = (nearbyCities || [])
    .filter(c => c.slug !== citySlug)
    .slice(0, 5)
    .map(c => ({ name: c.name, slug: c.slug }));

  const relatedTreatments = (relatedServices || []).map(t => ({ name: t.name, slug: t.slug }));

  return (
    <PageLayout>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonical={`/${stateSlug}/${citySlug}/${service}/`}
        keywords={[`${treatmentName} ${locationName}`, `${treatmentName} specialist`, `best ${treatmentName} clinic`]}
        noindex={shouldNoIndex}
      />
      {/* Synchronous JSON-LD structured data for SEO */}
      <SyncStructuredData
        data={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              ...(stateSlug && stateName ? [{ name: stateName, url: `/${stateSlug}/` }] : []),
              ...(citySlug && stateSlug ? [{ name: locationName, url: `/${stateSlug}/${citySlug}/` }] : []),
              { name: treatmentName, url: `/${stateSlug}/${citySlug}/${service}/` },
            ],
          },
          {
            type: 'faq',
            questions: faqs.map(f => ({ question: f.q, answer: f.a })),
          },
          {
            type: 'medicalProcedure',
            name: treatmentName,
            description: `${treatmentName} dental services in ${locationName}`,
            url: `/${stateSlug}/${citySlug}/${service}/`,
            bodyLocation: 'Oral cavity',
            procedureType: 'Dental procedure',
          },
          {
            type: 'itemList',
            name: `${treatmentName} Providers in ${locationName}`,
            description: `Top-rated ${treatmentName.toLowerCase()} specialists in ${locationName}`,
            items: (profiles || []).slice(0, 10).map((p, i) => ({
              name: p.name,
              url: `/clinic/${p.slug}/`,
              position: i + 1,
              image: p.image,
            })),
          },
        ]}
        id="service-location-schema"
      />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/8 via-background to-accent/30 pt-6 pb-8 md:pb-10 overflow-hidden">
        <motion.div
          className="absolute top-0 right-0 w-64 md:w-[400px] h-64 md:h-[400px] bg-primary/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4"
          animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        <div className="container relative px-4">
          <div className="flex justify-center mb-4">
            <Breadcrumbs items={breadcrumbs} />
          </div>

          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Badge variant="secondary" className="rounded-full px-4 py-1.5 text-xs md:text-sm font-bold mb-4 bg-primary/10 text-primary border-primary/20">
                <Stethoscope className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                Licensed Specialists
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-foreground tracking-tight mb-3 px-2 text-balance"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", textWrap: 'balance' }}
            >
              {pageH1.includes(locationName) ? (
                <>
                  {pageH1.split(locationName)[0]}
                  <span className="block text-primary mt-1">{locationName}{pageH1.split(locationName)[1] || ''}</span>
                </>
              ) : (
                <>{pageH1}</>
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm md:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto mb-5 px-2"
            >
              Find and book appointments with top-rated {treatmentName.toLowerCase()} specialists in {locationName}.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-xl md:max-w-2xl mx-auto mb-5"
            >
              <SearchBox variant="hero" stateSlug={stateSlug} defaultCity={`${citySlug}|${stateSlug}`} defaultTreatment={service} />
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-2"
            >
              <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">{profiles?.length || 0}+ Specialists</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-sm">
                <Star className="h-4 w-4 text-gold fill-gold" />
                <span className="font-bold text-sm">4.8 Avg. Rating</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">Book in 60s</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Page Intro Section - CMS Content */}
      <PageIntroSection
        title={parsedContent?.sections?.[0]?.heading || `${treatmentName} Services in ${locationName}`}
        content={(seoContent as any)?.page_intro || parsedContent?.intro || parsedContent?.sections?.[0]?.content || `Find the best ${treatmentName.toLowerCase()} specialists in ${locationDisplay}. Our directory features verified dental professionals with proven expertise in ${treatmentName.toLowerCase()} procedures.`}
        isLoading={isSeoContentPending}
      />

      {/* Main Content */}
      <Section size="lg">
        <div className="container px-4">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Dentist List Frame */}
            <DentistListFrame
              profiles={profiles || []}
              isLoading={profilesLoading}
              locationName={locationName}
              emptyMessage={`We're still adding ${treatmentName.toLowerCase()} specialists in ${locationName}.`}
              maxHeight={700}
              initialCount={6}
            />

            {/* SEO Content Block */}
            <SEOContentBlock
              variant="service-location"
              locationName={locationName}
              stateName={stateName}
              stateAbbr={stateAbbr}
              stateSlug={stateSlug || ''}
              citySlug={citySlug || ''}
              treatmentName={treatmentName}
              treatmentSlug={service}
              clinicCount={profiles?.length || 0}
              parsedContent={parsedContent}
              nearbyLocations={nearbyLocations}
              isLoading={isSeoContentPending}
            />

            {/* Geographic Link Block - SEO Authority Distribution */}
            <GeographicLinkBlock
              pageType="service-location"
              stateSlug={stateSlug || ''}
              stateName={stateName}
              citySlug={citySlug}
              cityName={locationName}
              serviceSlug={service}
              serviceName={treatmentName}
              nearbyCities={nearbyLocations}
              services={relatedTreatments}
            />

            {/* Nearby Cities */}
            {nearbyLocations.length > 0 && (
              <LocationQuickLinks
                variant="nearby"
                stateSlug={stateSlug || ''}
                items={nearbyLocations}
                title={`${treatmentName} in Nearby Cities`}
              />
            )}
          </div>
        </div>
      </Section>

      {/* FAQ Section */}
      <Section size="lg" className="bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-bold text-primary uppercase tracking-widest mb-2">Have Questions?</span>
            <h2 className="text-2xl md:text-3xl font-black text-foreground">
              Frequently Asked <span className="text-primary">Questions</span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-card border border-border rounded-2xl px-5 data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-left font-bold hover:no-underline py-4 text-sm md:text-base">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 text-sm">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>
    </PageLayout>
  );
};

export default ServiceLocationPage;
