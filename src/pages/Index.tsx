import { CheckCircle, ArrowRight, Shield, Clock, Users, Award, Star, MapPin, TrendingUp, Zap, Heart, Search, Phone, Building2, Stethoscope, Calendar, CheckCheck, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SearchBox } from "@/components/SearchBox";
import { MobileHeroBackground, AnimatedHeroHeadlines, FloatingDot, FloatingCross, SparkleIcon, ToothIcon } from "@/components/hero";
import { TypewriterText } from "@/components/TypewriterText";
import dynamic from "next/dynamic";

const Footer = dynamic(() => import("@/components/Footer").then(mod => mod.Footer), { ssr: false });
const AIExplainerSection = dynamic(() => import("@/components/ai").then(mod => mod.AIExplainerSection), { ssr: false });
const ForDentistsAISection = dynamic(() => import("@/components/ai").then(mod => mod.ForDentistsAISection), { ssr: false });
const AutoScrollCarousel = dynamic(() => import("@/components/AutoScrollCarousel").then(mod => mod.AutoScrollCarousel), { ssr: false });

import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/seo/SEOHead";
import { StructuredData } from "@/components/seo/StructuredData";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useRef } from "react";
import { useTopDentistsPerLocation } from "@/hooks/useProfiles";
import { useStatesWithClinics } from "@/hooks/useLocations";
import { useRealCounts } from "@/hooks/useRealCounts";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";

const heroTexts = [
  "Teeth Whitening",
  "Dental Implants",
  "Invisalign",
  "Cosmetic Dentistry",
  "Root Canal",
  "Veneers",
];

const animatedHeadlines = [
  "Patient-First Care",
  "Within Your Budget",
  "AI-Matched Dentists",
  "Book in Seconds",
];

const benefits = [
  {
    icon: Shield,
    title: "100% Verified Dentists",
    description: "Every dentist is licensed and credential-verified. We perform continuous background checks to ensure quality.",
    gradient: "from-primary/20 to-teal/10",
  },
  {
    icon: Clock,
    title: "Book in 60 Seconds",
    description: "Our streamlined booking system connects you with available specialists instantly. No phone calls needed.",
    gradient: "from-emerald/20 to-teal/10",
  },
  {
    icon: Star,
    title: "Real Patient Reviews",
    description: "Read authentic reviews from real patients. Make informed decisions based on genuine experiences.",
    gradient: "from-gold/20 to-amber-500/10",
  },
  {
    icon: Heart,
    title: "Patient-First Approach",
    description: "We prioritize your comfort and care. Find dentists who match your specific needs and preferences.",
    gradient: "from-coral/20 to-pink/10",
  },
];

const forDentists = [
  {
    icon: TrendingUp,
    title: "Grow Your Practice",
    description: "Reach thousands of patients actively searching for dental care in your area.",
  },
  {
    icon: Zap,
    title: "Streamlined Booking",
    description: "Automated appointment scheduling reduces no-shows and saves your staff time.",
  },
  {
    icon: Award,
    title: "Build Your Reputation",
    description: "Collect and showcase patient reviews to build trust and attract more patients.",
  },
];

const howItWorks = [
  { step: "1", title: "Search", description: "Enter your location and the type of dental care you need", icon: Search },
  { step: "2", title: "Compare", description: "Browse verified dentists, read reviews, and compare options", icon: Star },
  { step: "3", title: "Book", description: "Schedule your appointment online in just 60 seconds", icon: Phone },
];

const Index = () => {
  const router = useRouter();
  const legacyPostId = router.query.p as string | undefined;

  // All hooks must be called before any early returns
  // These queries load data for homepage - optimized with caching
  const { data: profiles } = useTopDentistsPerLocation(30);
  const { data: states } = useStatesWithClinics();
  const { data: realCounts } = useRealCounts();
  const { data: seoContent } = useSeoPageContent("/");

  // Fetch treatments from database
  const { data: treatments } = useQuery({
    queryKey: ['homepage-treatments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('display_order')
        .limit(12);
      return data || [];
    },
  });

  // Early return after all hooks
  if (legacyPostId) {
    router.push('/blog');
    return null;
  }

  // Dynamic stats using real counts - showing practices, cities, rating, and booking time
  const stats = [
    { icon: Building2, value: realCounts?.clinics?.toLocaleString() || "0", label: "Dental Practices" },
    { icon: MapPin, value: realCounts?.cities?.toLocaleString() || "0", label: "Cities Covered" },
    { icon: Award, value: "4.9", label: "Average Rating" },
    { icon: Clock, value: "60s", label: "Booking Time" },
  ];

  const carouselProfiles = profiles?.map(p => ({
    name: p.name,
    specialty: p.specialty || 'Dental Professional',
    location: p.location || 'United States',
    rating: p.rating,
    image: p.image || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400',
    slug: p.slug,
    type: p.type,
  })) || [];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoContent?.meta_title || "Find the Best Dentists Near You"}
        description={seoContent?.meta_description || "Search our directory of verified dentists. Read reviews & book appointments online. Find the perfect dentist today!"}
        canonical="/"
        keywords={['dentists near me', 'dental clinics USA', 'find dentist', 'book dental appointment', 'best dentists America']}
      />
      <StructuredData type="organization" />
      <Navbar />

      {/* Hero Section - Mobile-First with Patient-First Focus */}
      <section className="relative overflow-hidden min-h-[85vh] md:min-h-[80vh] flex items-center">
        <MobileHeroBackground />

        {/* Additional decorative floating elements */}
        <SparkleIcon className="w-6 h-6 top-[15%] right-[5%] md:right-[8%]" delay={0.5} />
        <SparkleIcon className="w-5 h-5 bottom-[25%] left-[8%]" delay={1.5} />
        <ToothIcon className="w-10 h-10 md:w-14 md:h-14 bottom-[35%] right-[5%] opacity-15" delay={2} />
        <FloatingCross className="text-gold/20 text-3xl top-[40%] left-[3%]" delay={1} />
        <FloatingDot className="w-2 h-2 bg-coral top-[30%] left-[15%] shadow-lg shadow-coral/50" delay={1.2} />
        <FloatingDot className="w-3 h-3 bg-primary bottom-[20%] right-[20%] shadow-lg shadow-primary/50" delay={0.8} />

        <div className="container py-10 md:py-16 lg:py-20 relative z-10 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 rounded-full px-5 py-2.5 mb-5 md:mb-6 shadow-xl shadow-primary/15">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-black text-primary uppercase tracking-widest leading-none">AI-Powered Dental Matching</span>
            </div>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Find Your Perfect <br className="hidden sm:block" />
              <span className="text-primary tracking-tight">Dentist</span> in Seconds
            </h1>

            <div className="flex justify-center mb-5 min-h-[1.3em]">
              <AnimatedHeroHeadlines
                headlines={animatedHeadlines}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black"
              />
            </div>

            <div className="mb-5 md:mb-6">
              <span className="text-base md:text-lg font-semibold text-white/70">
                Specializing in <TypewriterText texts={heroTexts} className="text-primary font-bold" />
              </span>
            </div>

            <p className="text-sm md:text-base lg:text-lg text-white/60 max-w-2xl mx-auto mb-7 md:mb-8 font-medium leading-relaxed">
              Tell us your budget and what you need. We'll match you with verified dentists who fit your criteria — all in seconds.
            </p>

            <div className="max-w-2xl mx-auto mb-8">
              <SearchBox variant="hero" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 bg-white/8 rounded-2xl px-4 py-3 border border-white/15 hover:bg-white/12 transition-all duration-300 cursor-default group"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center transition-all shrink-0">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-base md:text-lg font-black text-white">{stat.value}</div>
                    <p className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-wider truncate">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" className="w-full h-16 md:h-24" preserveAspectRatio="none">
            <path d="M0 120V60C360 20 720 0 1080 30C1260 45 1350 60 1440 60V120H0Z" className="fill-muted/50" />
          </svg>
        </div>
      </section>

      <section className="py-12 md:py-20 bg-muted/50 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-primary/5 rounded-full blur-3xl opacity-40" />
          <div className="absolute bottom-0 left-0 w-56 md:w-80 h-56 md:h-80 bg-teal/5 rounded-full blur-3xl opacity-30" />
        </div>

        <div className="container relative z-10 px-4">
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold text-primary">Browse by State</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-foreground">
              Find Dentists in Your <span className="text-primary">State</span>
            </h2>
            <p className="text-muted-foreground mt-2 md:mt-3 max-w-lg mx-auto text-sm md:text-base">
              Select your state to discover top-rated dental professionals near you.
            </p>
          </div>

          <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-3 min-w-max">
              {states?.map((state, i) => (
                <Link
                  key={state.id}
                  to={`/${state.slug}`}
                  className="group relative bg-card border border-border rounded-3xl p-5 text-center hover:border-primary/50 hover:shadow-lg transition-all w-44 flex-shrink-0"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-md shadow-primary/10">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {state.name}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      {state.abbreviation}
                    </p>
                    <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-3 py-1.5 font-bold text-xs group-hover:shadow-lg group-hover:shadow-primary/25 transition-all">
                      Explore
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5 max-w-5xl mx-auto">
            {states?.map((state, i) => (
              <div
                key={state.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <Link
                  to={`/${state.slug}`}
                  className="group relative bg-card border border-border rounded-3xl p-5 lg:p-6 text-center hover:border-primary/50 hover:shadow-lg transition-all block"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="h-12 w-12 lg:h-14 lg:w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-3 lg:mb-4 group-hover:scale-110 transition-transform shadow-md shadow-primary/10">
                      <MapPin className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
                    </div>
                    <h3 className="text-lg lg:text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {state.name}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-3 lg:mb-4">
                      {state.abbreviation}
                    </p>
                    <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-4 lg:px-5 py-2 lg:py-2.5 font-bold text-xs lg:text-sm group-hover:shadow-lg group-hover:shadow-primary/25 transition-all">
                      Explore Dentists
                      <ArrowRight className="h-3.5 w-3.5 lg:h-4 lg:w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

          <div className="text-center mt-8 md:mt-10">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary font-bold transition-colors text-sm md:text-base"
            >
              View All States
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-slate-950 relative overflow-hidden rounded-t-[2rem] md:rounded-t-[3rem]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-[10%] w-40 md:w-48 h-40 md:h-48 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-[5%] w-32 md:w-40 h-32 md:h-40 bg-teal/5 rounded-full blur-3xl" />
        </div>

        <div className="container relative z-10 max-w-6xl px-4">
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold text-primary">Why Choose Us</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
              The Smart Way to Find <span className="text-primary">Dental Care</span>
            </h2>
            <p className="text-white/60 mt-2 md:mt-3 max-w-xl mx-auto text-sm md:text-base">
              We've helped thousands find the right dentist. Here's why they trust us.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {benefits.map((benefit, i) => (
              <div
                key={i}
                className="group relative bg-white/5 rounded-3xl p-4 md:p-6 text-center border border-white/10 hover:border-primary/40 hover:bg-white/10 transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/20 mb-3 md:mb-4 group-hover:scale-105 transition-transform duration-300">
                  <benefit.icon className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
                <h3 className="text-sm md:text-base lg:text-lg font-bold mb-1 md:mb-2 text-white group-hover:text-primary transition-colors">{benefit.title}</h3>
                <p className="text-white/50 text-xs md:text-sm leading-relaxed line-clamp-3 md:line-clamp-none">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Explainer Section */}
      < AIExplainerSection />

      {/* Elite Selection - Featured Dentists */}
      {
        carouselProfiles.length > 0 && (
          <section className="py-24 bg-muted/50 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-[20%] w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-[15%] w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="container relative z-10">
              <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-2 bg-gold/10 rounded-full px-4 py-2 mb-4">
                  <Star className="h-4 w-4 text-gold fill-gold" />
                  <span className="text-sm font-bold text-gold">Elite Selection</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-foreground">
                  The <span className="italic text-primary">Top Rated</span> Dentists
                </h2>
                <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
                  Browse our highest-rated dental professionals across all states.
                </p>
              </div>

              <AutoScrollCarousel doctors={carouselProfiles} autoScrollSpeed={25} />

              <div className="mt-10 text-center">
                <Button asChild size="lg" className="rounded-2xl font-bold px-8">
                  <Link to="/search">
                    View Full Directory
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        )
      }

      {/* Treatment Catalog - Curved, brighter panel (no dark backgrounds) */}
      <section className="py-24 bg-background relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s', animationDelay: '2s' }} />
        </div>

        <div className="container relative z-10">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-8 md:p-12">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div className="animate-fade-in">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/20 to-emerald/10 rounded-full px-5 py-2.5 mb-5 border border-primary/20">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary tracking-wide">Comprehensive Care</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-foreground">
                  Dental <span className="text-primary relative">
                    Services
                    <svg className="absolute -bottom-1 left-0 w-full h-2 text-primary/30" viewBox="0 0 100 8" preserveAspectRatio="none">
                      <path d="M0,4 Q25,0 50,4 T100,4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                  </span>
                </h2>
                <p className="text-muted-foreground mt-3 text-lg max-w-lg">
                  Find specialists for every dental need. Select a service to browse by location.
                </p>
              </div>
              <Link
                to="/services"
                className="group inline-flex items-center gap-2 text-primary hover:text-primary/80 font-bold transition-all animate-fade-in"
                style={{ animationDelay: '0.2s' }}
              >
                View All Services
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="relative grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {treatments?.map((treatment, i) => (
                <Link
                  key={treatment.id}
                  to={`/services/${treatment.slug}`}
                  className="group relative bg-background/60 border border-border rounded-3xl p-5 md:p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 animate-fade-in-up overflow-hidden hover:-translate-y-1"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-all duration-500" />

                  {/* Animated border glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-transparent to-primary/20 blur-sm" />
                  </div>

                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-1">{treatment.name}</span>
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                      <ArrowRight className="h-4 w-4 text-primary group-hover:text-primary-foreground group-hover:translate-x-0.5 transition-all duration-300" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* For Dentists Section - AI-Powered */}
      <ForDentistsAISection />

      {/* How It Works - Premium Step-wise Design */}
      <section className="py-24 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-[10%] w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-[10%] w-64 h-64 bg-teal/5 rounded-full blur-3xl" />
        </div>

        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-5 py-2.5 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary tracking-wide">Simple 3-Step Process</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-foreground mb-4">
              How It <span className="text-primary">Works</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Finding your perfect dentist has never been easier. We've simplified the entire process.
            </p>
          </div>

          {/* Steps with connecting line */}
          <div className="max-w-5xl mx-auto relative">
            {/* Desktop connecting line */}
            <div className="hidden lg:block absolute top-24 left-[16%] right-[16%] h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 rounded-full" />

            <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
              {/* Step 1 */}
              <div className="group relative animate-fade-in-up" style={{ animationDelay: '0s' }}>
                <div className="relative bg-card rounded-3xl p-8 border border-border hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 h-full">
                  {/* Step number */}
                  <div className="relative z-20 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto -mt-12 mb-6 text-2xl font-black shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform duration-300 border-4 border-background">
                    1
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform">
                    <Search className="h-8 w-8 text-primary" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground text-center mb-3">Search Your Location</h3>
                  <p className="text-muted-foreground text-center leading-relaxed">
                    Enter your city or zip code and tell us what dental care you need. Our smart search finds the best matches instantly.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="group relative animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
                <div className="relative bg-card rounded-3xl p-8 border border-border hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 h-full">
                  <div className="relative z-20 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto -mt-12 mb-6 text-2xl font-black shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform duration-300 border-4 border-background">
                    2
                  </div>

                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform">
                    <CheckCheck className="h-8 w-8 text-primary" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground text-center mb-3">Compare & Choose</h3>
                  <p className="text-muted-foreground text-center leading-relaxed">
                    Browse verified profiles, read real patient reviews, compare services, and find the dentist that's perfect for you.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="group relative animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="relative bg-card rounded-3xl p-8 border border-border hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 h-full">
                  <div className="relative z-20 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto -mt-12 mb-6 text-2xl font-black shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform duration-300 border-4 border-background">
                    3
                  </div>

                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform">
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground text-center mb-3">Book in Seconds</h3>
                  <p className="text-muted-foreground text-center leading-relaxed">
                    Schedule your appointment instantly online. No waiting, no phone calls. Get confirmation and reminders automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-14">
            <Button asChild size="lg" className="rounded-2xl font-bold px-10 shadow-lg shadow-primary/20">
              <Link to="/search">
                Start Your Search
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section - Premium Redesigned */}
      <section className="py-24 relative overflow-hidden">
        {/* Dark gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-teal/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }} />

        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2.5 mb-8 border border-primary/30">
              <Heart className="h-4 w-4 text-primary fill-primary animate-pulse" />
              <span className="text-sm font-bold text-primary">Your Smile Matters</span>
            </div>

            {/* Heading */}
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
              Ready to Find Your
              <span className="block text-primary mt-2">Perfect Dentist?</span>
            </h2>

            {/* Description */}
            <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
              Join thousands of happy patients who've discovered exceptional dental care through our platform. Your journey to a healthier smile starts here.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap justify-center gap-8 mb-12">
              <div className="text-center">
                <div className="text-3xl font-black text-primary mb-1">{realCounts?.clinics?.toLocaleString() || '0'}+</div>
                <div className="text-sm text-white/50 font-semibold">Verified Practices</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-primary mb-1">4.9★</div>
                <div className="text-sm text-white/50 font-semibold">Average Rating</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-primary mb-1">60s</div>
                <div className="text-sm text-white/50 font-semibold">To Book</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="rounded-2xl font-bold px-10 h-14 text-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/30">
                <Link to="/search">
                  Find a Dentist
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl font-bold px-10 h-14 text-lg border-2 border-white/20 text-white bg-white/5 hover:bg-white/10 hover:border-white/30">
                <Link to="/list-your-practice">
                  <Stethoscope className="mr-2 h-5 w-5" />
                  I'm a Dentist
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div >
  );
};

export default Index;
