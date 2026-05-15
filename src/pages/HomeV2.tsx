import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowRight, Shield, Star, MapPin,
  TrendingUp, Zap, Search, Building2, Stethoscope, Calendar,
  BadgeCheck, Timer, Globe, Target, Quote, ChevronDown,
  CreditCard, Lock, ArrowUpRight, PhoneCall,
  Sparkles, Shirt, Baby
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/seo/SEOHead";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { useStatesWithClinics } from "@/hooks/useLocations";
import { useRealCounts } from "@/hooks/useRealCounts";
import { useTreatments } from "@/hooks/useTreatments";
import { useTopDentistsPerLocation } from "@/hooks/useProfiles";
import { AutoScrollCarousel } from "@/components/AutoScrollCarousel";
import { EmailCapture } from "@/components/EmailCapture";
import { supabase } from "@/integrations/supabase/client";

interface CityData {
  id: string;
  name: string;
  slug: string;
  abbreviation?: string;
  state_id?: string;
}

interface ZipCodeData {
  zip_code: string;
  city_id: string;
  city_name?: string;
  state_abbreviation?: string;
}

interface SearchLocation {
  type: 'city' | 'zip';
  value: string;
  label: string;
  citySlug?: string;
  stateSlug?: string;
}

// Fetch cities - simplified
function useTargetCities() {
  return useQuery({
    queryKey: ['target-cities'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('cities')
          .select('id, name, slug, state_id')
          .eq('is_active', true)
          .order('dentist_count', { ascending: false })
          .limit(200);
        
        if (error) {
          console.error('Error fetching cities:', error);
          return getDefaultCities();
        }
        return (data || []) as CityData[];
      } catch (err) {
        console.error('Error:', err);
        return getDefaultCities();
      }
    },
    staleTime: 60 * 60 * 1000,
  });
}

function getDefaultCities(): CityData[] {
  return [
    { id: '1', name: 'Los Angeles', slug: 'los-angeles' },
    { id: '2', name: 'San Francisco', slug: 'san-francisco' },
    { id: '3', name: 'San Diego', slug: 'san-diego' },
    { id: '4', name: 'San Jose', slug: 'san-jose' },
    { id: '5', name: 'Boston', slug: 'boston' },
    { id: '6', name: 'Worcester', slug: 'worcester' },
    { id: '7', name: 'Springfield', slug: 'springfield' },
    { id: '8', name: 'Cambridge', slug: 'cambridge' },
    { id: '9', name: 'Hartford', slug: 'hartford' },
    { id: '10', name: 'New Haven', slug: 'new-haven' },
    { id: '11', name: 'Stamford', slug: 'stamford' },
    { id: '12', name: 'Bridgeport', slug: 'bridgeport' },
    { id: '13', name: 'Newark', slug: 'newark' },
    { id: '14', name: 'Jersey City', slug: 'jersey-city' },
    { id: '15', name: 'Trenton', slug: 'trenton' },
    { id: '16', name: 'Edison', slug: 'edison' },
  ];
}

// Fetch zip codes - simplified
function useServedZipCodes() {
  return useQuery({
    queryKey: ['served-zip-codes'],
    queryFn: async () => {
      // Return hardcoded zip codes for major cities
      return getHardcodedZipCodes();
    },
    staleTime: 60 * 60 * 1000,
  });
}

function getHardcodedZipCodes(): ZipCodeData[] {
  const zipCodes: ZipCodeData[] = [];
  
  // Los Angeles zips
  ['90001', '90002', '90003', '90004', '90005', '90006', '90007', '90008', '90010', '90011', '90012', '90013', '90014', '90015', '90016', '90017', '90018', '90019', '90020', '90021', '90210', '90212'].forEach(z => {
    zipCodes.push({ zip_code: z, city_id: 'los-angeles', city_name: 'Los Angeles' });
  });
  
  // San Francisco
  ['94102', '94103', '94104', '94105', '94107', '94108', '94109', '94110', '94111', '94114', '94115', '94116', '94117', '94118', '94121', '94122', '94123', '94124', '94131', '94132', '94133', '94134'].forEach(z => {
    zipCodes.push({ zip_code: z, city_id: 'san-francisco', city_name: 'San Francisco' });
  });
  
  // San Diego
  ['91901', '91910', '91911', '91913', '91914', '91915', '91921', '91932', '91941', '91942', '91945', '91950', '92004', '92007', '92008', '92009', '92010', '92014', '92019', '92020', '92021', '92024', '92101', '92102', '92103', '92104', '92105', '92106', '92107', '92108', '92109', '92110', '92111', '92115', '92116', '92117', '92120', '92121', '92122', '92123', '92126', '92127', '92128', '92129', '92130', '92131'].forEach(z => {
    zipCodes.push({ zip_code: z, city_id: 'san-diego', city_name: 'San Diego' });
  });
  
  // Boston
  ['02108', '02109', '02110', '02111', '02113', '02114', '02115', '02116', '02118', '02119', '02120', '02121', '02122', '02124', '02125', '02126', '02127', '02128', '02129', '02130', '02134', '02135', '02136', '02139', '02140', '02141', '02142', '02143', '02144', '02145'].forEach(z => {
    zipCodes.push({ zip_code: z, city_id: 'boston', city_name: 'Boston' });
  });
  
  // Hartford
  ['06101', '06102', '06103', '06104', '06105', '06106', '06107', '06108', '06109', '06110', '06111', '06112', '06114', '06115', '06117', '06118', '06119', '06120'].forEach(z => {
    zipCodes.push({ zip_code: z, city_id: 'hartford', city_name: 'Hartford' });
  });
  
  // New Haven
  ['06510', '06511', '06512', '06513', '06514', '06515', '06516', '06517', '06518', '06519'].forEach(z => {
    zipCodes.push({ zip_code: z, city_id: 'new-haven', city_name: 'New Haven' });
  });
  
  // Newark
  ['07102', '07103', '07104', '07105', '07106', '07107', '07108', '07112', '07114'].forEach(z => {
    zipCodes.push({ zip_code: z, city_id: 'newark', city_name: 'Newark' });
  });
  
  return zipCodes;
}

const HomeV2 = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: states } = useStatesWithClinics();
  const { data: realCounts } = useRealCounts();
  const { data: treatments } = useTreatments();
  const { data: targetCities } = useTargetCities();
  const { data: servedZipCodes } = useServedZipCodes();
  const { data: profiles } = useTopDentistsPerLocation(20);
  const { data: seoContent } = useSeoPageContent("/");
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);
  const [searchTreatment, setSearchTreatment] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [zipError, setZipError] = useState("");
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Filter cities based on input
  const filteredCities = useMemo(() => {
    if (!targetCities || !locationInput) return [];
    const input = locationInput.toLowerCase();
    return targetCities
      .filter(city => city.name?.toLowerCase().includes(input) || city.slug?.toLowerCase().includes(input))
      .slice(0, 15);
  }, [targetCities, locationInput]);

  // Check if zip code is served
  const checkZipCode = (input: string): boolean => {
    const zipMatch = input.match(/^\d{5}$/);
    if (zipMatch) {
      const isServed = servedZipCodes?.some(z => z.zip_code === input);
      return isServed || false;
    }
    return true; // If not a zip code, allow it
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocationSelect = (city: CityData) => {
    setSearchLocation({
      type: 'city',
      value: city.slug,
      label: city.name,
      citySlug: city.slug
    });
    setLocationInput(city.name);
    setShowLocationDropdown(false);
    setZipError("");
  };

  const handleSearch = () => {
    // Validate zip code if entered
    if (locationInput && !checkZipCode(locationInput)) {
      setZipError("We don't serve this zip code yet. Try searching by city name instead.");
      return;
    }
    
    setZipError("");
    
    // Try to find matching city with state info for SEO URL
    const city = targetCities?.find(c => 
      c.name.toLowerCase() === locationInput.toLowerCase() ||
      c.slug.toLowerCase() === locationInput.toLowerCase().replace(/ /g, '-')
    );
    
    // If we found a city, try to get its state for SEO URL
    if (city) {
      // Build SEO URL: /state/city/ or /state/city/service/
      let seoUrl = '';
      
      // Get state from states data (we need to fetch state info for the city)
      const cityState = states?.find(s => s.id === city.state_id);
      
      if (searchTreatment && cityState) {
        // Format: /california/los-angeles/teeth-cleaning/
        const treatmentSlug = searchTreatment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
        seoUrl = `/${cityState.slug}/${city.slug}/${treatmentSlug}/`;
      } else if (cityState) {
        // Format: /california/los-angeles/
        seoUrl = `/${cityState.slug}/${city.slug}/`;
      }
      
      if (seoUrl) {
        navigate(seoUrl);
        return;
      }
    }
    
    // Fallback to /search page if no SEO URL could be built
    const params = new URLSearchParams();
    const zipMatch = locationInput.match(/^(\d{5})/);
    if (zipMatch) {
      params.set('zip', zipMatch[1]);
    } else if (locationInput) {
      params.set('city', locationInput.toLowerCase().replace(/ /g, '-'));
    }
    if (searchTreatment) {
      params.set('treatment', searchTreatment);
    }
    navigate(`/search?${params.toString()}`);
  };

  const stats = [
    { value: realCounts?.clinics?.toLocaleString() || "6,600+", label: "Verified Dentists", icon: Building2 },
    { value: realCounts?.cities?.toLocaleString() || "500+", label: "Cities", icon: MapPin },
    { value: "4.9★", label: "Average Rating", icon: Star },
    { value: "60s", label: "Book Time", icon: Timer },
  ];

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
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] md:min-h-[85vh] flex items-center bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 overflow-hidden">
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

        <div className="container mx-auto px-4 relative z-10 py-16 md:py-20">
          <div className="max-w-5xl mx-auto">
            
            {/* Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mb-8"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-5 py-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-100">America's #1 Dental Directory</span>
              </div>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white text-center mb-6 leading-[1.1]"
            >
              Find Your Perfect <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">
                Dentist Today
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-slate-300 text-center mb-10 max-w-2xl mx-auto"
            >
              Compare verified dentists, read real reviews, and book your appointment — 
              <span className="text-white font-semibold"> all in under 60 seconds</span>.
            </motion.p>

            {/* SEARCH BOX */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden mb-4"
            >
              <div className="grid md:grid-cols-12">
                {/* Location */}
                <div className="md:col-span-5 relative border-b md:border-b-0 md:border-r border-gray-100" ref={locationDropdownRef}>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <MapPin className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="text"
                    value={locationInput}
                    onChange={(e) => {
                      setLocationInput(e.target.value);
                      setSearchLocation(null);
                      setShowLocationDropdown(true);
                      setZipError("");
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    placeholder="City or Zip Code"
                    className="w-full h-16 pl-12 pr-4 text-base text-gray-900 placeholder:text-gray-400 border-0 focus:ring-0 focus:outline-none bg-transparent"
                  />
                  
                  <AnimatePresence>
                    {showLocationDropdown && filteredCities.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto"
                      >
                        {filteredCities.map((city) => (
                          <button
                            key={city.id}
                            onClick={() => handleLocationSelect(city)}
                            className="w-full px-4 py-3 text-left hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                          >
                            <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span className="font-medium text-gray-900">{city.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Treatment */}
                <div className="md:col-span-5 relative border-b md:border-b-0 border-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <select 
                    value={searchTreatment}
                    onChange={(e) => setSearchTreatment(e.target.value)}
                    className="w-full h-16 pl-12 pr-12 text-base text-gray-900 border-0 focus:ring-0 focus:outline-none bg-transparent appearance-none cursor-pointer"
                  >
                    <option value="">Any Treatment</option>
                    {treatments?.map((treatment) => (
                      <option key={treatment.id} value={treatment.slug}>
                        {treatment.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                </div>

                {/* Search Button */}
                <div className="md:col-span-2 bg-emerald-500 hover:bg-emerald-600 transition-colors">
                  <Button 
                    onClick={handleSearch}
                    className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-none text-lg"
                  >
                    <Search className="h-6 w-6" />
                    <span className="ml-2 hidden lg:inline">Search</span>
                  </Button>
                </div>
              </div>
              
              {/* Error Message */}
              {zipError && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-red-600 text-sm">
                  {zipError}
                </div>
              )}
            </motion.div>

            {/* Quick Links */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-3"
            >
              <span className="text-slate-400 text-sm">Popular:</span>
              <Link to="/search?treatment=teeth-cleaning" className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Teeth Cleaning</Link>
              <span className="text-slate-600">•</span>
              <Link to="/search?treatment=teeth-whitening" className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Whitening</Link>
              <span className="text-slate-600">•</span>
              <Link to="/search?treatment=invisalign" className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Invisalign</Link>
              <span className="text-slate-600">•</span>
              <Link to="/search?treatment=dental-implants" className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Implants</Link>
              <span className="text-slate-600">•</span>
              <Link to="/search?treatment=emergency-dentist" className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Emergency</Link>
            </motion.div>
          </div>

          {/* Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-16"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                  <stat.icon className="h-6 w-6 mx-auto text-emerald-400 mb-2" />
                  <div className="text-2xl md:text-3xl font-black text-white">{stat.value}</div>
                  <div className="text-sm text-slate-300 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Curved bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" className="w-full h-20" preserveAspectRatio="none">
            <path d="M0 100 C 480 20 960 0 1440 80 L 1440 100 L 0 100 Z" className="fill-background" />
          </svg>
        </div>
      </section>

      {/* TRUST SIGNALS */}
      <section className="py-5 bg-card border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {[
              { icon: Shield, text: "HIPAA Compliant" },
              { icon: BadgeCheck, text: "Verified Dentists" },
              { icon: Lock, text: "Secure Booking" },
              { icon: Star, text: "4.9 Avg Rating" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <item.icon className="h-4 w-4 text-emerald-500" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">
              Book in <span className="text-emerald-500">3 Easy Steps</span>
            </h2>
            <p className="text-muted-foreground">No phone calls. No waiting. Just book.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {howItWorks.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25">
                  <step.icon className="h-10 w-10 text-white" />
                </div>
                <div className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
                  Step {step.num}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">
              Why Patients Choose <span className="text-emerald-500">AppointPanda</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:border-emerald-200 transition-all"
              >
                <div className="h-14 w-14 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                  <feature.icon className="h-7 w-7 text-emerald-500" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TOP RATED DENTISTS */}
      {carouselProfiles.length > 0 && (
        <section className="py-16 md:py-24 bg-slate-900">
          <div className="container mx-auto px-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                Top-Rated <span className="text-emerald-400">Dentists</span>
              </h2>
              <p className="text-slate-400">Verified professionals with excellent patient reviews</p>
            </motion.div>

            <div className="relative">
              <AutoScrollCarousel doctors={carouselProfiles} autoScrollSpeed={25} />
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">
              Comprehensive <span className="text-emerald-500">Dental Services</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From routine cleanings to advanced cosmetic procedures, find dentists for all your dental needs.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {popularTreatments.slice(0, 12).map((treatment, i) => (
              <motion.div
                key={treatment.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/services/${treatment.slug}`}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-4 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                >
                  <span className="font-medium text-gray-900 group-hover:text-emerald-700">{treatment.name}</span>
                  <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/services" className="inline-flex items-center gap-2 text-emerald-600 font-semibold hover:underline">
              View All Services <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* BROWSE BY STATE */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">
              Find Dentists in Your <span className="text-emerald-500">State</span>
            </h2>
            <p className="text-muted-foreground">
              We serve dentists across California, Massachusetts, Connecticut, and New Jersey
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10">
            {[
              { name: 'California', slug: 'ca', abbr: 'CA', cities: ['Los Angeles', 'San Francisco', 'San Diego'] },
              { name: 'Massachusetts', slug: 'ma', abbr: 'MA', cities: ['Boston', 'Worcester', 'Cambridge'] },
              { name: 'Connecticut', slug: 'ct', abbr: 'CT', cities: ['Hartford', 'New Haven', 'Stamford'] },
              { name: 'New Jersey', slug: 'nj', abbr: 'NJ', cities: ['Newark', 'Jersey City', 'Trenton'] },
            ].map((state, i) => (
              <motion.div
                key={state.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="block bg-white border border-gray-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-lg transition-all"
              >
                <Link
                  to={`/${state.slug}`}
                  className="flex items-center gap-3 mb-3"
                >
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{state.name}</h3>
                    <p className="text-sm text-gray-500">{state.abbr}</p>
                  </div>
                </Link>
                <div className="space-y-1">
                  {state.cities.map((city) => (
                    <Link
                      key={city}
                      to={`/${state.slug}/${city.toLowerCase().replace(/ /g, '-')}`}
                      className="block text-sm text-gray-500 hover:text-emerald-600 transition-colors"
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
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">
              What Patients <span className="text-emerald-500">Say</span>
            </h2>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-gray-100 rounded-2xl p-8 md:p-10"
              >
                <Quote className="h-10 w-10 text-emerald-200 mb-4" />
                <p className="text-lg text-gray-700 font-medium leading-relaxed mb-6">
                  "{testimonials[activeTestimonial].text}"
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{testimonials[activeTestimonial].name}</div>
                    <div className="text-gray-500 text-sm">{testimonials[activeTestimonial].location}</div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(testimonials[activeTestimonial].rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`h-2 rounded-full transition-all ${i === activeTestimonial ? 'bg-emerald-500 w-8' : 'bg-gray-200 w-2 hover:bg-gray-300'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOR DENTISTS */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto bg-white border border-emerald-100 rounded-2xl p-8 md:p-12 shadow-xl shadow-emerald-500/5">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-4">
                  Are You a <span className="text-emerald-500">Dentist</span>?
                </h2>
                <p className="text-gray-600 mb-6">
                  Join thousands of dental professionals growing their practice with AppointPanda.
                </p>
                <Link to="/list-your-practice">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 font-bold rounded-full px-8">
                    List Your Practice Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>

              <div className="grid grid-cols-2 gap-3">
                {dentistBenefits.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                  >
                    <item.icon className="h-6 w-6 text-emerald-500 mb-2" />
                    <div className="font-bold text-gray-900 text-sm">{item.title}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BESPOKE GARMENTS */}
      <section className="py-16 md:py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold mb-4">
                  <Shirt className="h-3.5 w-3.5" />
                  Custom Manufacturing
                </div>
                <h2 className="text-2xl md:text-3xl font-black mb-4">
                  Bespoke Garments for <span className="text-emerald-400">Dental & Professional Teams</span>
                </h2>
                <p className="text-slate-300 mb-6">
                  We manufacture custom dresses, uniforms, and garments tailored for dental practices, nurseries, and professional staff. Premium quality, perfect fit.
                </p>
                <Link to="/garments">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 font-bold rounded-full">
                    Explore Garments
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Stethoscope, title: "Dental & Medical", desc: "Lab coats & scrubs" },
                  { icon: Baby, title: "Nursery & Childcare", desc: "Durable, easy-care attire" },
                  { icon: Building2, title: "Corporate & Admin", desc: "Polished business wear" },
                  { icon: Shirt, title: "Specialized Roles", desc: "Custom for every role" },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4"
                  >
                    <item.icon className="h-6 w-6 text-emerald-400 mb-2" />
                    <div className="font-bold text-white text-sm">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-6">
              Ready to Find Your <span className="text-emerald-400">Perfect Dentist</span>?
            </h2>
            <p className="text-slate-300 mb-10 text-lg">
              Join thousands of happy patients who've found exceptional dental care.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/search">
                <Button size="lg" className="h-14 px-10 font-bold rounded-full bg-emerald-500 hover:bg-emerald-600 text-lg">
                  Find a Dentist Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/list-your-practice">
                <Button size="lg" variant="outline" className="h-14 px-10 font-bold rounded-full border-slate-600 text-white hover:bg-slate-800 text-lg">
                  I'm a Dentist
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* EMAIL CAPTURE */}
      <section className="py-16 md:py-20 bg-slate-50">
        <div className="container mx-auto px-4">
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
