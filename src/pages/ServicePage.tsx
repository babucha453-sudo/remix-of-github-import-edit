import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { AISmartSearch } from "@/components/ai";
import { DentistListFrame, LocationQuickLinks } from "@/components/location";
import { SEOContentBlock } from "@/components/seo/SEOContentBlock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { StructuredData } from "@/components/seo/StructuredData";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useProfiles } from "@/hooks/useProfiles";
import { useSeoPageContent, parseMarkdownContent, parseFaqFromContent } from "@/hooks/useSeoPageContent";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Users,
  Star,
  Shield,
  MapPin,
  Stethoscope
} from "lucide-react";

const MIN_PROFILE_COUNT = 2; // noindex pages with fewer than 2 providers

const ServicePage = () => {
  const { serviceSlug: serviceSlugParam } = useParams();
  const serviceSlug = serviceSlugParam || "";

  // Fetch SEO content
  const seoSlug = `services/${serviceSlug}`;
  const { data: seoContent, isLoading: seoContentLoading, isFetching: seoContentFetching } = useSeoPageContent(seoSlug);

  // IMPORTANT: Don't hide content during background refetches - only show loading state when no data exists
  const isSeoContentPending = !seoContent && (seoContentLoading || seoContentFetching);

  // Fetch treatment data
  const { data: treatment, isLoading: treatmentLoading } = useQuery({
    queryKey: ["treatment", serviceSlug],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("*")
        .eq("slug", serviceSlug)
        .maybeSingle();
      return data;
    },
  });

  // Fetch related treatments
  const { data: relatedTreatments } = useQuery({
    queryKey: ["related-treatments", serviceSlug],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("*")
        .eq("is_active", true)
        .neq("slug", serviceSlug)
        .order("display_order")
        .limit(6);
      return data || [];
    },
  });

  // Fetch profiles - all dentists/clinics
  const { data: profiles, isLoading: profilesLoading } = useProfiles({
    limit: 50,
  });

  // Fetch states for interlinking
  const { data: states } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      const { data } = await supabase
        .from("states")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  const treatmentName = treatment?.name || serviceSlug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  // Parse SEO content
  const parsedContent = seoContent?.content ? parseMarkdownContent(seoContent.content) : null;
  // Use dedicated faqs column first, fallback to parsing from content for legacy pages
  const seoFaqs = seoContent?.faqs && Array.isArray(seoContent.faqs) && seoContent.faqs.length > 0
    ? seoContent.faqs
    : seoContent?.content ? parseFaqFromContent(seoContent.content) : [];

  // Signal prerender
  const isDataReady = !treatmentLoading && !profilesLoading;
  usePrerenderReady(isDataReady);

  const shouldNoIndex = !profilesLoading && (!profiles || profiles.length < MIN_PROFILE_COUNT);

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Dental Services", href: "/services" },
    { label: treatmentName },
  ];

  const serviceFaqSets = [
    [
      {
        q: `What is ${treatmentName}?`,
        a: treatment?.description || `${treatmentName} is a professional dental procedure designed to improve your oral health and smile. Our qualified dentists use the latest techniques.`,
      },
      {
        q: `How long does ${treatmentName} take?`,
        a: `Duration varies depending on individual needs. A typical ${treatmentName.toLowerCase()} session can take 30 minutes to 2 hours. Your dentist will provide an accurate estimate.`,
      },
      {
        q: `Is ${treatmentName} painful?`,
        a: `Modern dental techniques and anesthesia make most procedures comfortable. Your dentist will discuss pain management options.`,
      },
      {
        q: `How much does ${treatmentName} cost?`,
        a: `Costs vary by clinic and treatment needs. We recommend booking a consultation. Many clinics accept insurance and offer payment plans.`,
      },
    ],
    [
      {
        q: `Who is a good candidate for ${treatmentName}?`,
        a: `${treatmentName} is suitable for patients seeking to improve their dental health and appearance. A consultation with a qualified dentist will determine if this treatment is right for you.`,
      },
      {
        q: `How long do results from ${treatmentName} last?`,
        a: `With proper care and maintenance, results from ${treatmentName.toLowerCase()} can last for many years. Your dentist will provide specific aftercare instructions.`,
      },
      {
        q: `What is the recovery time for ${treatmentName}?`,
        a: `Recovery time varies by individual and treatment complexity. Most patients can return to normal activities within a few days to a week after the procedure.`,
      },
      {
        q: `Are there alternatives to ${treatmentName}?`,
        a: `Yes, there may be alternative treatments available depending on your specific dental needs. Discuss all options with your dentist during your consultation.`,
      },
    ],
    [
      {
        q: `What happens during a ${treatmentName} procedure?`,
        a: `During the ${treatmentName.toLowerCase()} procedure, your dentist will evaluate your needs, prepare the treatment area, and perform the procedure using modern dental techniques.`,
      },
      {
        q: `How do I prepare for ${treatmentName}?`,
        a: `Your dentist will provide specific pre-treatment instructions. This may include avoiding certain foods, medications, or arrangements for transportation.`,
      },
      {
        q: `What aftercare is needed for ${treatmentName}?`,
        a: `After ${treatmentName.toLowerCase()}, follow your dentist's aftercare instructions which may include avoiding certain foods, maintaining oral hygiene, and scheduling follow-up visits.`,
      },
      {
        q: `Does insurance cover ${treatmentName}?`,
        a: `Many dental insurance plans provide coverage for ${treatmentName.toLowerCase()}. Contact your insurance provider to understand your specific benefits and coverage.`,
      },
    ],
  ];
  const faqSetIndex = Math.abs((serviceSlug?.length || 0) * 11 + (treatmentName?.length || 0) * 3) % serviceFaqSets.length;
  const faqs = seoFaqs.length > 0 ? seoFaqs.map(f => ({ q: f.question, a: f.answer })) : serviceFaqSets[faqSetIndex];

  const relatedServices = (relatedTreatments || []).map(t => ({ name: t.name, slug: t.slug }));

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || `${treatmentName} - Find Specialists & Clinics`}
        description={seoContent?.meta_description || `Find the best ${treatmentName.toLowerCase()} specialists. Compare verified clinics, read reviews, and book your appointment today.`}
        canonical={`/services/${serviceSlug}/`}
        keywords={[`${treatmentName}`, `${treatmentName} cost`, `best ${treatmentName} clinic`, 'dental treatment']}
        noindex={shouldNoIndex}
      />
      <StructuredData
        type="breadcrumb"
        items={[
          { name: "Home", url: "/" },
          { name: "Dental Services", url: "/services" },
          { name: treatmentName },
        ]}
      />
      <StructuredData
        type="service"
        name={treatmentName}
        description={treatment?.description || `Professional ${treatmentName} services`}
        url={`/services/${serviceSlug}/`}
        provider="AppointPanda Partner Clinics"
        areaServed="United States"
      />
      <StructuredData
        type="faq"
        questions={faqs.map(f => ({ question: f.q, answer: f.a }))}
      />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-emerald-light/30 to-background pt-6 pb-10">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-20 left-[10%] w-48 md:w-64 h-48 md:h-64 bg-foreground/5 rounded-full blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <motion.div 
            className="absolute bottom-10 right-[15%] w-56 md:w-80 h-56 md:h-80 bg-primary/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.15, 0.1] }}
            transition={{ duration: 8, repeat: Infinity, delay: 2 }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground)/0.02)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>
        
        <div className="container relative z-10 px-4">
          <div className="flex justify-center mb-4">
            <Breadcrumbs items={breadcrumbs} />
          </div>
          
          <div className="max-w-3xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-full px-4 py-2 mb-4"
            >
              <Stethoscope className="h-4 w-4 text-emerald" />
              <span className="text-xs md:text-sm font-bold text-foreground/80">Dental Service</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground mb-3 px-2" 
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {treatmentName}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-base md:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto px-2"
            >
              {treatment?.description || `Find the best ${treatmentName.toLowerCase()} specialists. Compare verified clinics, read reviews, and book your appointment today.`}
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-xl md:max-w-2xl mx-auto mb-6"
            >
              <AISmartSearch variant="hero" />
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
                <Shield className="h-4 w-4 text-emerald" />
                <span className="font-bold text-sm">Verified</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Related Services Quick Links */}
      {relatedServices.length > 0 && (
        <section className="py-4 bg-muted/30 border-y border-border">
          <div className="container px-4">
            <LocationQuickLinks
              variant="services"
              items={relatedServices}
              title="Related Dental Treatments"
            />
          </div>
        </section>
      )}

      {/* Main Content */}
      <Section size="lg">
        <div className="container px-4">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Dentist List Frame */}
            <DentistListFrame
              profiles={profiles || []}
              isLoading={profilesLoading}
              locationName="United States"
              emptyMessage="We're still adding specialists for this service."
              maxHeight={700}
              initialCount={6}
            />

            {/* SEO Content Block */}
            <SEOContentBlock
              variant="service"
              locationName="United States"
              treatmentName={treatmentName}
              clinicCount={profiles?.length || 0}
              parsedContent={parsedContent}
              isLoading={isSeoContentPending}
            />
          </div>
        </div>
      </Section>

      {/* Find by State */}
      {states && states.length > 0 && (
        <Section size="lg" className="bg-muted/30">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block text-xs font-bold text-emerald uppercase tracking-widest mb-2">By Location</span>
            <h2 className="text-2xl md:text-3xl font-black text-foreground mb-6">
              {treatmentName} Specialists <span className="text-primary">By State</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {states.slice(0, 9).map((state) => (
                <Link
                  key={state.id}
                  to={`/${state.slug}`}
                  className="group bg-card border border-border rounded-2xl p-5 hover:border-primary hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                      {state.name}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {treatmentName} in {state.abbreviation}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* FAQ Section */}
      <Section size="lg">
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

export default ServicePage;
