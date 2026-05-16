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

  const cityName = locationName;
  const faqs = seoFaqs.length > 0 ? seoFaqs.map(f => ({ q: f.question, a: f.answer })) : [
    {
      q: `Where can I find ${treatmentName} specialists in ${cityName}?`,
      a: `Finding qualified ${treatmentName.toLowerCase()} specialists in ${cityName} is easy with our verified directory. We feature ${profiles?.length || 0}+ dental professionals offering ${treatmentName.toLowerCase()} services across the ${cityName} area. Each provider is licensed and many have completed our additional verification process. Browse profiles, compare experience, read patient reviews, and book appointments directly online through our secure booking system.`,
    },
    {
      q: `How much does ${treatmentName} cost in ${cityName}?`,
      a: `${treatmentName} costs in ${cityName} vary significantly based on the complexity of your case, the dentist's experience, and the specific materials or technology used. On average, basic ${treatmentName.toLowerCase()} procedures start around $500, while more complex cases can range from $2,000 to $15,000 or more. Many dental offices in ${cityName} offer payment plans, and we recommend scheduling a consultation to get an accurate quote tailored to your specific needs.`,
    },
    {
      q: `Are the ${treatmentName} dentists in ${cityName} verified?`,
      a: `All dentists on our AppointPanda platform in ${cityName} are licensed dental professionals who have passed basic credential verification. Many profiles display a "Verified" badge, which indicates they have completed our additional verification process including license confirmation, business verification, and identity verification. We continuously monitor credentials and encourage patients to share their experiences through verified reviews.`,
    },
    {
      q: `How do I book a ${treatmentName} appointment in ${cityName}?`,
      a: `Booking a ${treatmentName.toLowerCase()} appointment in ${cityName} is simple with AppointPanda. Browse our directory of verified providers, read patient reviews, compare ratings and experience, then click "Book Now" on any profile. You'll see available time slots directly from the clinic's schedule, select your preferred date and time, and complete your booking online. The clinic will send a confirmation email with all the details including preparation instructions.`,
    },
    {
      q: `What should I look for when choosing a ${treatmentName} dentist in ${cityName}?`,
      a: `When selecting a ${treatmentName.toLowerCase()} provider in ${cityName}, consider several important factors: years of experience and specialized training, patient reviews and overall ratings, before-and-after photos of their work, the technology and materials they use, their communication style and consultation approach, accepted insurance plans and payment options, and office location and hours. Our directory makes it easy to compare these factors across multiple providers in ${cityName}.`,
    },
    {
      q: `Does insurance cover ${treatmentName} in ${cityName}?`,
      a: `Dental insurance coverage for ${treatmentName.toLowerCase()} in ${cityName} depends on your specific plan and the medical necessity of the procedure. Preventive ${treatmentName.toLowerCase()} is often covered at 100%, while major procedures may be covered at 50-80%. Many insurance plans have annual maximums and deductibles. We recommend checking with your insurance provider about specific coverage for ${treatmentName} procedures, and our directory shows which clinics accept various insurance plans.`,
    },
    {
      q: `How long does ${treatmentName} take in ${cityName}?`,
      a: `The duration of ${treatmentName.toLowerCase()} treatment in ${cityName} varies based on the procedure type and individual case complexity. Simple consultations and examinations take 30-60 minutes, while basic procedures typically require 1-2 hours. More complex ${treatmentName.toLowerCase()} cases may need multiple appointments spanning several weeks. During your initial consultation in ${cityName}, your dentist will provide a personalized timeline based on your specific treatment plan.`,
    },
    {
      q: `What is the recovery time after ${treatmentName} in ${cityName}?`,
      a: `Recovery time after ${treatmentName.toLowerCase()} in ${cityName} depends on the procedure type. Most patients return to normal activities within 1-3 days for basic procedures, while more complex treatments may require 1-2 weeks of recovery. Your dentist in ${cityName} will provide specific post-procedure instructions including pain management, diet restrictions, activity limitations, and follow-up appointment scheduling to ensure optimal healing.`,
    },
    {
      q: `Are there specialists for ${treatmentName} in ${cityName}, ${stateAbbr}?`,
      a: `Yes, ${cityName}, ${stateAbbr} has several dental specialists who focus specifically on ${treatmentName.toLowerCase()} procedures. These may include endodontists for root-related treatments, periodontists for gum and bone procedures, oral surgeons for surgical extractions, and prosthodontists for complex restorative work. General dentists in ${cityName} also perform many ${treatmentName.toLowerCase()} procedures. Our directory allows you to filter by specialty and specific services.`,
    },
    {
      q: `What questions should I ask during my ${treatmentName} consultation in ${cityName}?`,
      a: `During your ${treatmentName.toLowerCase()} consultation in ${cityName}, ask about: the dentist's experience and success rate with your specific procedure, available anesthesia and pain management options, expected outcomes and potential risks, number of appointments needed, total cost and payment plans, insurance coverage and pre-authorization requirements, alternative treatment options, and post-procedure care instructions. A thorough consultation in ${cityName} ensures you have all the information needed to make an informed decision.`,
    },
    {
      q: `How do I prepare for my ${treatmentName} appointment in ${cityName}?`,
      a: `To prepare for your ${treatmentName.toLowerCase()} appointment in ${cityName}: gather your dental records and X-rays if available, verify your insurance coverage and benefits, list any medications you're taking, note any allergies or health conditions, write down questions for your dentist, and arrive 15-20 minutes early to complete paperwork. If you're anxious about the procedure, discuss sedation options during your consultation. Your ${cityName} dental office will provide specific preparation instructions based on your planned treatment.`,
    },
    {
      q: `What happens if I need to cancel or reschedule my ${treatmentName} appointment in ${cityName}?`,
      a: `If you need to cancel or reschedule your ${treatmentName.toLowerCase()} appointment in ${cityName}, contact the dental office as soon as possible—ideally 24-48 hours in advance. Most ${cityName} dental practices have cancellation policies and may charge a fee for last-minute cancellations or no-shows. When rescheduling, ask about available alternative times that work with your schedule. Our online booking system also allows you to manage your appointments easily through the confirmation email or your patient portal.`,
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
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-3 px-2 text-balance"
              style={{ fontFamily: "'Figtree', sans-serif", textWrap: 'balance' }}
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

      {/* Quick Answer */}
      <Section size="lg">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <h3 className="font-bold text-slate-800 mb-2">Quick Answer</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Finding {treatmentName} specialists in {cityName} is easy with our verified directory. Browse qualified providers, compare experience and ratings, read patient reviews, and book appointments directly online. Our network includes general dentists and specialists offering {treatmentName} services in the {cityName} area.
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ Section */}
      <Section size="lg" className="bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-bold text-primary uppercase tracking-widest mb-2">Have Questions?</span>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
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
