import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, Search, User, BookOpen, HelpCircle, Phone, DollarSign, Wrench, Calculator, Shield, Zap, MapPin, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const treatments = [
  { name: "Teeth Whitening", slug: "teeth-whitening" },
  { name: "Veneers", slug: "veneers" },
  { name: "Dental Implants", slug: "dental-implants" },
  { name: "Invisalign", slug: "invisalign" },
  { name: "Braces", slug: "braces" },
  { name: "Root Canal", slug: "root-canal" },
];

// Hardcoded locations - no API calls needed
const LOCATIONS = [
  {
    id: "ca",
    slug: "ca",
    name: "California",
    cities: [
      { slug: "los-angeles", name: "Los Angeles" },
      { slug: "san-francisco", name: "San Francisco" },
      { slug: "san-diego", name: "San Diego" },
      { slug: "san-jose", name: "San Jose" },
      { slug: "sacramento", name: "Sacramento" },
    ],
  },
  {
    id: "ma",
    slug: "ma",
    name: "Massachusetts",
    cities: [
      { slug: "boston", name: "Boston" },
      { slug: "cambridge", name: "Cambridge" },
      { slug: "worcester", name: "Worcester" },
      { slug: "springfield", name: "Springfield" },
      { slug: "lowell", name: "Lowell" },
    ],
  },
  {
    id: "ct",
    slug: "ct",
    name: "Connecticut",
    cities: [
      { slug: "bridgeport", name: "Bridgeport" },
      { slug: "new-haven", name: "New Haven" },
      { slug: "stamford", name: "Stamford" },
      { slug: "hartford", name: "Hartford" },
      { slug: "waterbury", name: "Waterbury" },
    ],
  },
  {
    id: "nj",
    slug: "nj",
    name: "New Jersey",
    cities: [
      { slug: "newark", name: "Newark" },
      { slug: "jersey-city", name: "Jersey City" },
      { slug: "paterson", name: "Paterson" },
      { slug: "elizabeth", name: "Elizabeth" },
      { slug: "edison", name: "Edison" },
    ],
  },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const { data: siteSettings } = useSiteSettings();

  // Get logo from site settings
  const logoUrl = siteSettings?.branding?.logo_url;

  // Track scroll for navbar styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <>
      {/* Top Bar - Links */}
      <div className="bg-slate-900 text-white py-2 hidden lg:block">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-6 text-xs">
            <Link to="/blog" className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Blog & Guides</span>
            </Link>
            <Link to="/faq" className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>FAQ</span>
            </Link>
            <Link to="/garments" className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors">
              <Shirt className="h-3.5 w-3.5" />
              <span>Garments</span>
            </Link>
            <Link to="/pricing" className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Pricing</span>
            </Link>
            <Link to="/contact" className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors">
              <Phone className="h-3.5 w-3.5" />
              <span>Contact Us</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">Serving California, Massachusetts, Connecticut & New Jersey</span>
            <Link to="/list-your-practice" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              Are you a dentist? List your practice →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-lg border-b border-slate-200 shadow-sm' 
          : 'bg-white border-b border-slate-100'
      }`}>
        <div className="container">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Use branding from settings or fallback to text */}
            <Link to="/" className="flex items-center gap-2" aria-label="AppointPanda - Find Dentists Near You">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={siteSettings?.siteName || 'AppointPanda - Find Dentists Near You'} 
                  className="h-9 w-auto max-w-[180px] object-contain"
                  width={180}
                  height={36}
                />
              ) : (
                <>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md" role="img" aria-label="AppointPanda Logo">
                    <span className="text-sm font-black">AP</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-black tracking-tight text-slate-900 leading-none">
                      Appoint<span className="text-emerald-600">Panda</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
                      {siteSettings?.siteTagline || 'US Dental Directory'}
                    </span>
                  </div>
                </>
              )}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1" role="navigation" aria-label="Main navigation">
              <Link 
                to="/search" 
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50"
              >
                <Search className="h-4 w-4" />
                Search
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50">
                  Treatments
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-xl p-2 bg-white border border-slate-200 shadow-lg z-50">
                  <DropdownMenuItem asChild className="rounded-lg font-bold text-slate-900">
                    <Link to="/services">All Services</Link>
                  </DropdownMenuItem>
                  {treatments.map((item) => (
                    <DropdownMenuItem key={item.slug} asChild className="rounded-lg font-medium text-slate-700">
                      <Link to={`/services/${item.slug}`}>{item.name}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Locations Dropdown with Hardcoded States */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50">
                  <MapPin className="h-4 w-4" />
                  Locations
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 rounded-xl p-2 bg-white border border-slate-200 shadow-lg z-50">
                  {LOCATIONS.map((state) => (
                    <DropdownMenuSub key={state.slug}>
                      <DropdownMenuSubTrigger className="rounded-lg font-bold text-slate-900 hover:bg-slate-900 hover:text-white cursor-pointer transition-colors">
                        <Link to={`/${state.slug}`} className="flex items-center justify-between w-full">
                          {state.name}
                        </Link>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56 rounded-xl p-2 bg-white border border-slate-200 shadow-lg z-50">
                        <DropdownMenuItem asChild className="rounded-lg font-semibold text-emerald">
                          <Link to={`/${state.slug}`}>All {state.name}</Link>
                        </DropdownMenuItem>
                        <div className="border-t border-slate-100 my-1" />
                        {state.cities.map((city) => (
                          <DropdownMenuItem key={city.slug} asChild className="rounded-lg font-medium text-slate-700">
                            <Link to={`/${state.slug}/${city.slug}`}>{city.name}</Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                  
                  {/* View All States Link */}
                  <div className="border-t border-slate-200 my-2" />
                  <DropdownMenuItem asChild className="rounded-lg font-bold text-emerald">
                    <Link to="/search">View All States</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg text-slate-600">
                    <Link to="/services">All Services</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald transition-colors rounded-lg hover:bg-emerald/5">
                  <Wrench className="h-4 w-4" />
                  Tools
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-xl p-2 bg-white border border-slate-200 shadow-lg z-50">
                  <DropdownMenuItem asChild className="rounded-lg font-medium text-slate-700">
                    <Link to="/tools/dental-cost-calculator">
                      <Calculator className="h-4 w-4 mr-2" />
                      Dental Cost Calculator
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg font-medium text-slate-700">
                    <Link to="/tools/insurance-checker">
                      <Shield className="h-4 w-4 mr-2" />
                      Insurance Checker
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg font-medium text-slate-700">
                    <Link to="/emergency-dentist">
                      <Zap className="h-4 w-4 mr-2" />
                      Emergency Dentist
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link 
                to="/insurance" 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald transition-colors rounded-lg hover:bg-emerald/5"
              >
                Insurance
              </Link>

              <Link 
                to="/pricing" 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald transition-colors rounded-lg hover:bg-emerald/5"
              >
                Pricing
              </Link>

              <Link 
                to="/garments" 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald transition-colors rounded-lg hover:bg-emerald/5"
              >
                Garments
              </Link>
            </div>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-3">
              <Button variant="ghost" size="sm" className="text-sm font-medium text-slate-600 hover:text-emerald" asChild>
                <Link to="/list-your-practice">List Practice</Link>
              </Button>
              <Button variant="ghost" size="icon" className="rounded-xl text-slate-600 hover:text-emerald" asChild>
                <Link to="/auth"><User className="h-5 w-5" /></Link>
              </Button>
              <Button 
                size="sm" 
                className="rounded-xl bg-emerald text-white hover:bg-emerald/90 font-bold shadow-md shadow-emerald/25"
                onClick={() => navigate("/search")}
              >
                Find Dentist
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-6 border-t border-slate-200 animate-fade-in-up bg-white">
              <div className="space-y-1">
                <Link to="/search" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>
                  <Search className="h-4 w-4" /> Search
                </Link>
                <Link to="/services" className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>Treatments</Link>
                
                {/* Mobile: States */}
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Locations</div>
                {LOCATIONS.map((state) => (
                  <div key={state.slug}>
                    <Link 
                      to={`/${state.slug}`} 
                      className="block px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100 rounded-xl" 
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {state.name}
                    </Link>
                    {state.cities.map((city) => (
                      <Link 
                        key={city.slug}
                        to={`/${state.slug}/${city.slug}`} 
                        className="block px-8 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl" 
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {city.name}
                      </Link>
                    ))}
                  </div>
                ))}
                
                <Link to="/insurance" className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>Insurance</Link>
                <Link to="/pricing" className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
                <Link to="/blog" className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
                <Link to="/faq" className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>FAQ</Link>
                <Link to="/garments" className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>Garments</Link>
                <Link to="/contact" className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-200 px-4">
                <Button 
                  className="w-full rounded-xl bg-emerald text-white hover:bg-emerald/90 font-bold"
                  onClick={() => {
                    navigate("/search");
                    setMobileMenuOpen(false);
                  }}
                >
                  Find Dentist
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full mt-2 rounded-xl"
                  onClick={() => {
                    navigate("/list-your-practice");
                    setMobileMenuOpen(false);
                  }}
                >
                  List Your Practice
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
