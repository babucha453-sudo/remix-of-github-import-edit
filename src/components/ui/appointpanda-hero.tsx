import { useState, useRef, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, MapPin, Shield, Star, BadgeCheck,
  CreditCard, DollarSign, ChevronDown, Sparkles,
  Clock, ArrowRight, Stethoscope, Building2,
  Phone, Calendar, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface CityData {
  id: string; name: string; slug: string; state_id?: string;
}

const INSURANCE_OPTIONS = [
  "Aetna", "Cigna", "Delta Dental", "MetLife", "Humana",
  "UnitedHealthcare", "Blue Cross Blue Shield", "Guardian", "Principal", "Other"
];

const BUDGET_RANGES = [
  { label: "Any Budget", value: "" },
  { label: "$ (Affordable)", value: "low" },
  { label: "$$ (Moderate)", value: "medium" },
  { label: "$$$ (Premium)", value: "high" },
];

const FEATURED_DENTISTS = [
  {
    name: "Bright Smile Dental",
    rating: 4.9,
    reviews: 128,
    location: "Los Angeles, CA",
    priceRange: "$$",
    insurance: ["Aetna", "Cigna", "Delta Dental"],
    available: "Today",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=200&h=200",
  },
  {
    name: "Elite Dental Care",
    rating: 4.8,
    reviews: 94,
    location: "San Francisco, CA",
    priceRange: "$$$",
    insurance: ["MetLife", "Delta Dental", "Guardian"],
    available: "Tomorrow",
    image: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&q=80&w=200&h=200",
  },
];

export function AppointPandaHero() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [searchTreatment, setSearchTreatment] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [insuranceInput, setInsuranceInput] = useState("");
  const [budget, setBudget] = useState("");
  const [searchLocation, setSearchLocation] = useState<CityData | null>(null);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [insuranceSuggestions, setInsuranceSuggestions] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  const { data: targetCities } = useQuery({
    queryKey: ["hero-cities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cities")
        .select("id, name, slug, state_id")
        .eq("is_active", true)
        .order("dentist_count", { ascending: false })
        .limit(200);
      return (data || []) as CityData[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const filteredCities = useMemo(() => {
    if (!targetCities || !locationInput) return [];
    return targetCities
      .filter(c => c.name?.toLowerCase().includes(locationInput.toLowerCase()))
      .slice(0, 10);
  }, [targetCities, locationInput]);

  const filteredInsurance = useMemo(() => {
    if (!insuranceInput) return INSURANCE_OPTIONS;
    return INSURANCE_OPTIONS.filter(i =>
      i.toLowerCase().includes(insuranceInput.toLowerCase())
    );
  }, [insuranceInput]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchLocation) {
      const match = targetCities?.find(c => c.slug === searchLocation.slug);
      if (match?.state_id) {
        const stateSlug = match.state_id;
        if (searchTreatment) {
          navigate(`/${stateSlug}/${searchLocation.slug}/${searchTreatment}/`);
          return;
        }
        navigate(`/${stateSlug}/${searchLocation.slug}/`);
        return;
      }
      params.set("city", searchLocation.slug);
    }
    if (searchTreatment) params.set("treatment", searchTreatment);
    if (insuranceInput) params.set("insurance", insuranceInput);
    if (budget) params.set("budget", budget);
    navigate(`/search?${params.toString()}`);
  };

  const fadeUp = (delay = 0) => shouldReduceMotion ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.6 } };

  return (
    <section className="relative min-h-[90vh] md:min-h-[85vh] flex items-center bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-8%] left-[5%] w-[600px] h-[600px] rounded-full max-md:hidden"
          style={{ background: "radial-gradient(circle, rgba(13, 148, 136, 0.25) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], x: [0, 40, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-5%] right-[5%] w-[500px] h-[500px] rounded-full max-md:hidden"
          style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)" }}
          animate={{ scale: [1.1, 1, 1.1], y: [0, -30, 0] }}
          transition={{ duration: 10, repeat: Infinity, delay: 1, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
      </div>

      <div className="container mx-auto px-4 relative z-10 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          {/* Badge */}
          <motion.div {...fadeUp(0)} className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-500/25 rounded-full px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-sm font-medium text-teal-100">Find trusted dentists near you</span>
            </div>
          </motion.div>

          {/* H1 */}
          <motion.h1 {...fadeUp(0.1)} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white text-center mb-5 leading-[1.1] max-w-4xl mx-auto">
            Find the right dentist for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300">
              your care, budget, and insurance
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p {...fadeUp(0.2)} className="text-base md:text-lg text-slate-400 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            Search dentists by location, treatment, insurance, and price range. Compare verified profiles and request appointments with confidence.
          </motion.p>

          {/* Search Bar */}
          <motion.div {...fadeUp(0.3)} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden mb-6">
            <div className="grid md:grid-cols-12">
              {/* Service/Treatment */}
              <div className="md:col-span-4 relative border-b md:border-b-0 md:border-r border-white/10">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Stethoscope className="h-5 w-5 text-teal-400/70" />
                </div>
                <select
                  value={searchTreatment}
                  onChange={(e) => setSearchTreatment(e.target.value)}
                  className="w-full h-14 pl-11 pr-10 text-sm text-white bg-transparent border-0 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                  style={{ color: searchTreatment ? "white" : "rgba(255,255,255,0.4)" }}
                >
                  <option value="" className="bg-slate-800 text-white/60">Search treatment, service, or dentist</option>
                  <option value="teeth-cleaning" className="bg-slate-800 text-white">Teeth Cleaning</option>
                  <option value="teeth-whitening" className="bg-slate-800 text-white">Teeth Whitening</option>
                  <option value="dental-implants" className="bg-slate-800 text-white">Dental Implants</option>
                  <option value="invisalign" className="bg-slate-800 text-white">Invisalign</option>
                  <option value="braces" className="bg-slate-800 text-white">Braces</option>
                  <option value="veneers" className="bg-slate-800 text-white">Veneers</option>
                  <option value="root-canal" className="bg-slate-800 text-white">Root Canal</option>
                  <option value="crowns" className="bg-slate-800 text-white">Crowns</option>
                  <option value="dentures" className="bg-slate-800 text-white">Dentures</option>
                  <option value="emergency-dentist" className="bg-slate-800 text-white">Emergency Dentist</option>
                  <option value="pediatric-dentistry" className="bg-slate-800 text-white">Pediatric Dentistry</option>
                  <option value="oral-surgery" className="bg-slate-800 text-white">Oral Surgery</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
              </div>

              {/* Location */}
              <div className="md:col-span-3 relative border-b md:border-b-0 md:border-r border-white/10" ref={locationDropdownRef}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <MapPin className="h-5 w-5 text-teal-400/70" />
                </div>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => { setLocationInput(e.target.value); setSearchLocation(null); setShowLocationDropdown(true); }}
                  onFocus={() => setShowLocationDropdown(true)}
                  placeholder="City, state, or near me"
                  className="w-full h-14 pl-11 pr-4 text-sm bg-transparent border-0 focus:ring-0 focus:outline-none text-white placeholder:text-white/40"
                />
                {showLocationDropdown && filteredCities.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto"
                  >
                    {filteredCities.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => { setSearchLocation(city); setLocationInput(city.name); setShowLocationDropdown(false); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 transition-colors text-sm text-white"
                      >
                        <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                        {city.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Insurance */}
              <div className="md:col-span-2 relative border-b md:border-b-0 md:border-r border-white/10">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Shield className="h-4 w-4 text-teal-400/70" />
                </div>
                <input
                  type="text"
                  value={insuranceInput}
                  onChange={(e) => { setInsuranceInput(e.target.value); setInsuranceSuggestions(true); }}
                  onFocus={() => setInsuranceSuggestions(true)}
                  placeholder="Insurance provider"
                  className="w-full h-14 pl-9 pr-3 text-sm bg-transparent border-0 focus:ring-0 focus:outline-none text-white placeholder:text-white/40"
                />
                {insuranceSuggestions && insuranceInput && filteredInsurance.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto"
                  >
                    {filteredInsurance.map((ins) => (
                      <button
                        key={ins}
                        onClick={() => { setInsuranceInput(ins); setInsuranceSuggestions(false); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors text-sm text-white"
                      >
                        {ins}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Budget */}
              <div className="md:col-span-1 relative border-b md:border-b-0 md:border-r border-white/10">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <DollarSign className="h-4 w-4 text-teal-400/70" />
                </div>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full h-14 pl-8 pr-8 text-sm bg-transparent border-0 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                  style={{ color: budget ? "white" : "rgba(255,255,255,0.4)" }}
                >
                  {BUDGET_RANGES.map((r) => (
                    <option key={r.value} value={r.value} className="bg-slate-800 text-white">{r.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              </div>

              {/* Search Button */}
              <div className="md:col-span-2">
                <Button
                  onClick={handleSearch}
                  className="w-full h-14 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold rounded-none text-base gap-2"
                >
                  <Search className="h-5 w-5" />
                  Search
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div {...fadeUp(0.4)} className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-12">
            {[
              { icon: BadgeCheck, text: "Verified profiles" },
              { icon: Shield, text: "Insurance-aware" },
              { icon: DollarSign, text: "Price range filters" },
              { icon: Calendar, text: "Online booking" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-1.5 text-xs text-slate-500">
                <item.icon className="h-3.5 w-3.5 text-teal-500" />
                {item.text}
              </div>
            ))}
          </motion.div>

          {/* Visual Cards */}
          <motion.div {...fadeUp(0.5)} className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {FEATURED_DENTISTS.map((dentist) => (
              <div key={dentist.name} className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 hover:border-teal-500/30 transition-all duration-300">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-700">
                    <img src={dentist.image} alt={dentist.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white text-sm">{dentist.name}</h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          <span className="text-amber-400 text-xs font-medium">{dentist.rating}</span>
                          <span className="text-slate-500 text-xs">({dentist.reviews} reviews)</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-white/80 text-xs font-medium">{dentist.priceRange}</div>
                        <div className="flex items-center gap-1 text-emerald-400 text-xs mt-0.5">
                          <Clock className="h-3 w-3" />
                          {dentist.available}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                      <MapPin className="h-3 w-3" />
                      {dentist.location}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {dentist.insurance.slice(0, 2).map((ins) => (
                        <span key={ins} className="inline-flex items-center gap-1 bg-teal-500/10 text-teal-300 text-[10px] px-2 py-0.5 rounded-full border border-teal-500/20">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {ins}
                        </span>
                      ))}
                      {dentist.insurance.length > 2 && (
                        <span className="text-[10px] text-slate-500">+{dentist.insurance.length - 2}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div {...fadeUp(0.6)} className="mt-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {[
                { value: "6,600+", label: "Verified Dentists", icon: Building2 },
                { value: "500+", label: "Cities", icon: MapPin },
                { value: "4.9★", label: "Average Rating", icon: Star },
                { value: "60s", label: "Book Time", icon: Clock },
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center group hover:bg-white/[0.07] transition-colors">
                  <stat.icon className="h-5 w-5 mx-auto text-teal-400 mb-1.5" />
                  <div className="text-lg md:text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-[11px] text-slate-400 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Curved divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 100" fill="none" className="w-full h-16 md:h-20" preserveAspectRatio="none">
          <path d="M0 100 C 480 20 960 0 1440 80 L 1440 100 L 0 100 Z" className="fill-background" />
        </svg>
      </div>
    </section>
  );
}
