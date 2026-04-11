import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SEOHead } from "@/components/seo/SEOHead";
import { ArrowRight, Sparkles, Shield, Clock, Building2 } from "lucide-react";
import { useRealCounts } from "@/hooks/useRealCounts";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";

const ServicesPage = () => {
  const { data: treatments, isLoading } = useQuery({
    queryKey: ["all-treatments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  // Fetch states for interlinking
  const { data: states } = useQuery({
    queryKey: ["states-for-services"],
    queryFn: async () => {
      const { data } = await supabase
        .from("states")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  const popularTreatments = treatments?.slice(0, 8) || [];
  const allTreatments = treatments || [];
  
  // Get real clinic count
  const { data: realCounts } = useRealCounts();
  const { data: seoContent } = useSeoPageContent("services");

  const breadcrumbs = [{ label: "Home", href: "/" }, { label: "Dental Services" }];

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || "Dental Services - All Treatments"}
        description={seoContent?.meta_description || "Explore our comprehensive range of dental treatments. Find teeth whitening, veneers, dental implants, Invisalign, and more from verified specialists across the United States."}
        canonical="/services/"
        keywords={['dental services', 'dental treatments', 'teeth whitening', 'dental implants', 'Invisalign', 'cosmetic dentistry']}
      />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-primary/5 to-background pt-8 pb-20">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[10%] w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-[15%] w-80 h-80 bg-emerald/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container relative z-10">
          <Breadcrumbs items={breadcrumbs} className="mb-6" />
          
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="rounded-full px-4 py-2 text-sm font-bold mb-6 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-4 w-4 mr-2" />
              Verified Specialists
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight mb-4">
              Dental
              <span className="block text-primary">Services</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Explore our comprehensive range of dental treatments. Find the right service for your needs and connect with verified specialists across the United States.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-2xl px-5 py-3">
                <span className="font-bold">{allTreatments.length}+ Treatments</span>
              </div>
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-2xl px-5 py-3">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-bold">{realCounts?.clinics?.toLocaleString() || '6,000'}+ Clinics</span>
              </div>
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-2xl px-5 py-3">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-bold">Top Specialists</span>
              </div>
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-2xl px-5 py-3">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-bold">Book in 60s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <Section size="lg">
        <SectionHeader
          label="Most Searched"
          title="Popular Dental"
          highlight="Treatments"
        />

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularTreatments.map((treatment, i) => (
              <Link
                key={treatment.id}
                to={`/services/${treatment.slug}`}
                className="group bg-card border border-border rounded-2xl p-6 hover:border-primary hover:shadow-xl transition-all animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors mb-2">
                  {treatment.name}
                </h3>
                {treatment.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {treatment.description}
                  </p>
                )}
                <span className="text-sm font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn More <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* All Services - Dark Section */}
      <section className="section-dark py-20">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-micro text-primary mb-2">Full Directory</p>
            <h2 className="text-section text-3xl md:text-4xl text-white">
              All Dental <span className="text-primary">Services</span>
            </h2>
          </div>

          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {allTreatments.map((treatment, i) => (
              <Link
                key={treatment.id}
                to={`/services/${treatment.slug}`}
                className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 font-bold text-white hover:border-primary hover:text-primary hover:bg-white/10 transition-all animate-fade-in-up"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                {treatment.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Services by State - Interlinking */}
      <Section size="lg">
        <SectionHeader
          label="By Location"
          title="Find Treatments"
          highlight="By State"
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {states?.map((state, i) => (
            <Link
              key={state.id}
              to={`/${state.slug}`}
              className="group bg-card border border-border rounded-2xl p-6 hover:border-primary hover:shadow-lg transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors mb-1">
                {state.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Browse dental services in {state.abbreviation}
              </p>
              <span className="text-sm font-bold text-primary flex items-center gap-1">
                Explore <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-primary py-16 md:py-20">
        <div className="container text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-primary-foreground">
            Not sure what you need?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Book a consultation with a general dentist who can assess your needs and recommend the right treatment.
          </p>
          <Button asChild size="lg" variant="secondary" className="rounded-2xl font-bold">
            <Link to="/search">
              Find a Dentist
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </PageLayout>
  );
};

export default ServicesPage;
