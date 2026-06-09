import { useState } from "react";
import {
  ArrowRight, Shield, Star, MapPin,
  TrendingUp, Zap, Building2, Stethoscope, Calendar,
  BadgeCheck, Globe, Target, Quote,
  CreditCard, Lock, ArrowUpRight, Search,
  Shirt, Baby, Sparkles, Clock, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { useStatesWithClinics } from "@/hooks/useLocations";
import { useRealCounts } from "@/hooks/useRealCounts";
import { useTreatments } from "@/hooks/useTreatments";
import { useTopDentistsPerLocation } from "@/hooks/useProfiles";
import { AutoScrollCarousel } from "@/components/AutoScrollCarousel";
import { EmailCapture } from "@/components/EmailCapture";
import { AppointPandaHero } from "@/components/ui/appointpanda-hero";

const GlowOrbs = ({ colors = ["teal", "cyan"], className = "" }: { colors?: string[]; className?: string }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
    <motion.div
      className="absolute top-[-8%] left-[5%] w-[600px] h-[600px] rounded-full max-md:hidden"
      style={{ background: `radial-gradient(circle, rgba(13, 148, 136, 0.2) 0%, transparent 70%)` }}
      animate={{ scale: [1, 1.15, 1], x: [0, 40, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-[-5%] right-[5%] w-[500px] h-[500px] rounded-full max-md:hidden"
      style={{ background: `radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)` }}
      animate={{ scale: [1.1, 1, 1.1], y: [0, -30, 0] }}
      transition={{ duration: 10, repeat: Infinity, delay: 1, ease: "easeInOut" }}
    />
    <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
  </div>
);

const fadeUp = (shouldReduceMotion: boolean, delay = 0) =>
  shouldReduceMotion ? {} : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay, duration: 0.6 } };

const SectionHeader = ({ title, highlight, subtitle, shouldReduceMotion, delay = 0 }: {
  title: string; highlight: string; subtitle?: string; shouldReduceMotion: boolean; delay?: number;
}) => (
  <motion.div {...fadeUp(shouldReduceMotion, delay)} className="text-center mb-14">
    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
      {title} <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300">{highlight}</span>
    </h2>
    {subtitle && <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto">{subtitle}</p>}
  </motion.div>
);

const HomeV2 = () => {
  const shouldReduceMotion = useReducedMotion();
  const { data: states } = useStatesWithClinics();
  const { data: realCounts } = useRealCounts();
  const { data: treatments } = useTreatments();
  const { data: profiles } = useTopDentistsPerLocation(20);
  const { data: seoContent } = useSeoPageContent("/");
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const features = [
    { icon: Shield, title: "Verified Dentists", desc: "License & credentials checked" },
    { icon: Zap, title: "Instant Booking", desc: "Book in under 60 seconds" },
    { icon: Star, title: "Real Reviews", desc: "Authentic patient feedback" },
    { icon: CreditCard, title: "Insurance Accepted", desc: "Filter by your plan" },
  ];

  const howItWorks = [
    { num: "1", title: "Search", desc: "Enter your location & treatment", icon: Search },
    { num: "2", title: "Compare", desc: "View ratings, reviews & prices", icon: Target },
    { num: "3", title: "Book", desc: "Schedule instantly online", icon: Calendar },
  ];

  const testimonials = [
    { name: "Sarah M.", location: "Los Angeles, CA", text: "Found an amazing cosmetic dentist within my budget. The whole process took less than 5 minutes!", rating: 5 },
    { name: "Michael R.", location: "Boston, MA", text: "I was nervous about finding a new dentist after moving. AppointPanda made it so easy to compare options.", rating: 5 },
    { name: "Emily K.", location: "Hartford, CT", text: "The reviews were super helpful. Found a great pediatric dentist for my kids!", rating: 5 },
  ];

  const dentistBenefits = [
    { icon: TrendingUp, title: "Get More Patients", desc: "Reach thousands searching for dentists" },
    { icon: Calendar, title: "Smart Scheduling", desc: "Reduce no-shows automatically" },
    { icon: Star, title: "Build Reputation", desc: "Collect & showcase reviews" },
    { icon: Globe, title: "Local SEO", desc: "Get found in your area" },
  ];

  const popularTreatments = treatments?.slice(0, 12) || [];

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
        title={seoContent?.meta_title || "Find the Best Dentists Near You - Book Online in 60 Seconds"}
        description={seoContent?.meta_description || "AppointPanda helps you find and book appointments with top-rated, verified dentists near you. Compare reviews, check insurance, and book instantly."}
        canonical="/"
      />
      <SyncStructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'AppointPanda',
          url: 'https://www.appointpanda.com',
          description: 'Find and book appointments with verified dental professionals. Browse by location, treatment, or insurance.',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: 'https://www.appointpanda.com/search?q={search_term_string}',
            },
            'query-input': 'required name=search_term_string',
          },
        }}
        id="homepage-website-schema"
      />
      <Navbar />

      <AppointPandaHero />

      {/* TRUST SIGNALS */}
      <section className="relative py-4 bg-slate-900/50 border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div {...fadeUp(shouldReduceMotion)} className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            {[
              { icon: Shield, text: "HIPAA Compliant" },
              { icon: BadgeCheck, text: "Verified Dentists" },
              { icon: Lock, text: "Secure Booking" },
              { icon: Clock, text: "Instant Confirmation" },
              { icon: Star, text: "4.9 Avg Rating" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-medium text-slate-400">
                <item.icon className="h-4 w-4 text-teal-400" />
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0a1628] to-slate-950 overflow-hidden">
        <GlowOrbs />
        <div className="container mx-auto px-4 relative z-10">
          <SectionHeader title="Book in" highlight="3 Easy Steps" subtitle="No phone calls. No waiting. Just book." shouldReduceMotion={shouldReduceMotion} />

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {howItWorks.map((step, i) => (
              <motion.div
                key={i}
                {...fadeUp(shouldReduceMotion, 0.1 + i * 0.15)}
                className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center hover:bg-white/[0.07] hover:border-teal-500/30 transition-all duration-500"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/25">
                  <step.icon className="h-9 w-9 text-white" />
                </div>
                <div className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-300 text-xs font-bold px-3 py-1 rounded-full mb-4 border border-teal-500/20">
                  <Sparkles className="h-3 w-3" />
                  Step {step.num}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0d1b2a] to-slate-950 overflow-hidden">
        <GlowOrbs colors={["cyan", "teal"]} />
        <div className="container mx-auto px-4 relative z-10">
          <SectionHeader title="Why Patients Choose" highlight="AppointPanda" subtitle="We make finding the right dentist simple, transparent, and fast." shouldReduceMotion={shouldReduceMotion} />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                {...fadeUp(shouldReduceMotion, 0.1 + i * 0.1)}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-teal-500/30 transition-all duration-300"
              >
                <div className="h-14 w-14 rounded-xl bg-teal-500/10 flex items-center justify-center mb-4 border border-teal-500/20">
                  <feature.icon className="h-7 w-7 text-teal-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TOP RATED DENTISTS */}
      {carouselProfiles.length > 0 && (
        <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0a1628] to-slate-950 overflow-hidden">
          <GlowOrbs />
          <div className="container mx-auto px-4 relative z-10">
            <SectionHeader title="Top-Rated" highlight="Dentists" subtitle="Verified professionals with excellent patient reviews" shouldReduceMotion={shouldReduceMotion} />

            <motion.div {...fadeUp(shouldReduceMotion, 0.2)} className="relative">
              <AutoScrollCarousel doctors={carouselProfiles} />
            </motion.div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0d1b2a] to-slate-950 overflow-hidden">
        <GlowOrbs colors={["cyan", "teal"]} />
        <div className="container mx-auto px-4 relative z-10">
          <SectionHeader title="Comprehensive" highlight="Dental Services" subtitle="From routine cleanings to advanced cosmetic procedures, find dentists for all your dental needs." shouldReduceMotion={shouldReduceMotion} />

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {popularTreatments.slice(0, 12).map((treatment, i) => (
              <motion.div
                key={treatment.id}
                {...fadeUp(shouldReduceMotion, 0.05 + i * 0.04)}
              >
                <Link
                  to={`/services/${treatment.slug}`}
                  className="group flex items-center justify-between bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] hover:border-teal-500/30 transition-all duration-300"
                >
                  <span className="font-medium text-slate-200 group-hover:text-teal-300 transition-colors">{treatment.name}</span>
                  <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-teal-400 transition-colors" />
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(shouldReduceMotion, 0.4)} className="text-center mt-10">
            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-teal-400 font-semibold hover:text-teal-300 transition-colors group"
            >
              View All Services <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* BROWSE BY STATE */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0a1628] to-slate-950 overflow-hidden">
        <GlowOrbs />
        <div className="container mx-auto px-4 relative z-10">
          <SectionHeader title="Find Dentists in Your" highlight="State" subtitle="We serve dentists across California, Massachusetts, Connecticut, and New Jersey" shouldReduceMotion={shouldReduceMotion} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { name: 'California', slug: 'ca', abbr: 'CA', cities: ['Los Angeles', 'San Francisco', 'San Diego'] },
              { name: 'Massachusetts', slug: 'ma', abbr: 'MA', cities: ['Boston', 'Worcester', 'Cambridge'] },
              { name: 'Connecticut', slug: 'ct', abbr: 'CT', cities: ['Hartford', 'New Haven', 'Stamford'] },
              { name: 'New Jersey', slug: 'nj', abbr: 'NJ', cities: ['Newark', 'Jersey City', 'Trenton'] },
            ].map((state, i) => (
              <motion.div
                key={state.slug}
                {...fadeUp(shouldReduceMotion, 0.1 + i * 0.1)}
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-teal-500/30 transition-all duration-300"
              >
                <Link to={`/${state.slug}`} className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                    <MapPin className="h-5 w-5 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{state.name}</h3>
                    <p className="text-sm text-slate-500">{state.abbr}</p>
                  </div>
                </Link>
                <div className="space-y-1.5">
                  {state.cities.map((city) => (
                    <Link
                      key={city}
                      to={`/${state.slug}/${city.toLowerCase().replace(/ /g, '-')}`}
                      className="block text-sm text-slate-400 hover:text-teal-300 transition-colors"
                    >
                      {city}
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0d1b2a] to-slate-950 overflow-hidden">
        <GlowOrbs colors={["cyan", "teal"]} />
        <div className="container mx-auto px-4 relative z-10">
          <SectionHeader title="What Patients" highlight="Say" subtitle="Hear from people who found their perfect dentist through AppointPanda" shouldReduceMotion={shouldReduceMotion} />

          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-10"
              >
                <Quote className="h-8 w-8 text-teal-400/40 mb-4" />
                <p className="text-lg text-slate-200 font-medium leading-relaxed mb-6">
                  "{testimonials[activeTestimonial].text}"
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{testimonials[activeTestimonial].name}</div>
                    <div className="text-slate-400 text-sm">{testimonials[activeTestimonial].location}</div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(testimonials[activeTestimonial].rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-3 mt-8">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeTestimonial
                      ? 'bg-gradient-to-r from-teal-400 to-emerald-400 w-10 h-2.5'
                      : 'bg-white/20 w-2.5 h-2.5 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOR DENTISTS */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0a1628] to-slate-950 overflow-hidden">
        <GlowOrbs />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div {...fadeUp(shouldReduceMotion)} className="max-w-5xl mx-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <motion.div {...fadeUp(shouldReduceMotion, 0.1)}>
                <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-300 px-3 py-1.5 rounded-full text-xs font-bold mb-4 border border-teal-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  For Dental Professionals
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  Grow Your Practice with <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-300">AppointPanda</span>
                </h2>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  Join thousands of dental professionals growing their practice. Get more patients, reduce no-shows, and build your reputation online.
                </p>
                <Link to="/list-your-practice">
                  <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold rounded-full px-8 h-12 text-base shadow-lg shadow-teal-500/25">
                    List Your Practice Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dentistBenefits.map((item, i) => (
                  <motion.div
                    key={i}
                    {...fadeUp(shouldReduceMotion, 0.15 + i * 0.1)}
                    className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/[0.07] hover:border-teal-500/30 transition-all duration-300"
                  >
                    <item.icon className="h-6 w-6 text-teal-400 mb-2" />
                    <div className="font-bold text-white text-sm">{item.title}</div>
                    <div className="text-sm text-slate-400">{item.desc}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* BESPOKE GARMENTS */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-slate-950 via-[#0d1b2a] to-slate-950 text-white overflow-hidden">
        <GlowOrbs colors={["cyan", "teal"]} />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <motion.div {...fadeUp(shouldReduceMotion)}>
                <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-300 px-3 py-1.5 rounded-full text-xs font-bold mb-4 border border-teal-500/20">
                  <Shirt className="h-3.5 w-3.5" />
                  Custom Manufacturing
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  Bespoke Garments for <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-300">Dental & Professional Teams</span>
                </h2>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  We manufacture custom dresses, uniforms, and garments tailored for dental practices, nurseries, and professional staff. Premium quality, perfect fit.
                </p>
                <Link to="/garments">
                  <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 font-bold rounded-full shadow-lg shadow-teal-500/25">
                    Explore Garments
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Stethoscope, title: "Dental & Medical", desc: "Lab coats & scrubs" },
                  { icon: Baby, title: "Nursery & Childcare", desc: "Durable, easy-care attire" },
                  { icon: Building2, title: "Corporate & Admin", desc: "Polished business wear" },
                  { icon: Shirt, title: "Specialized Roles", desc: "Custom for every role" },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    {...fadeUp(shouldReduceMotion, 0.1 + i * 0.1)}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] hover:border-teal-500/30 transition-all duration-300"
                  >
                    <item.icon className="h-6 w-6 text-teal-400 mb-2" />
                    <div className="font-bold text-white text-sm">{item.title}</div>
                    <div className="text-sm text-slate-400">{item.desc}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-20 md:py-28 bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950 overflow-hidden">
        <GlowOrbs />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div {...fadeUp(shouldReduceMotion)} className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9 }}
              whileInView={shouldReduceMotion ? {} : { opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-300 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-teal-500/20"
            >
              <CheckCircle2 className="h-4 w-4" />
              Trusted by thousands of patients
            </motion.div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Ready to Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300">Perfect Dentist</span>?
            </h2>
            <p className="text-slate-400 mb-10 text-lg leading-relaxed max-w-xl mx-auto">
              Join thousands of happy patients who've found exceptional dental care.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/search">
                <Button size="lg" className="h-14 px-10 font-bold rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-lg shadow-xl shadow-teal-500/25">
                  Find a Dentist Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/list-your-practice">
                <Button size="lg" variant="outline" className="h-14 px-10 font-bold rounded-full border-slate-600 text-white hover:bg-white/10 text-lg">
                  I'm a Dentist
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* EMAIL CAPTURE */}
      <section className="relative py-16 md:py-20 bg-gradient-to-b from-slate-950 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto">
            <EmailCapture
              headline="Get Dental Tips & Exclusive Offers"
              subtext="Join 10,000+ patients who get weekly dental care tips and special offers"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomeV2;
