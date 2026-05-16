import { forwardRef } from "react";
import { Link } from "react-router-dom";
import {
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Mail,
  Phone,
  MapPin,
  Heart,
  ChevronRight,
  Shield,
  Award,
  Clock,
  Search,
  Stethoscope,
  Calendar,
  CheckCircle,
  ArrowRight,
  Send,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ACTIVE_STATES } from "@/lib/constants/activeStates";

const TOP_SERVICES = [
  { name: "Dental Implants", slug: "dental-implants" },
  { name: "Teeth Whitening", slug: "teeth-whitening" },
  { name: "Root Canal", slug: "root-canal" },
  { name: "Dental Crowns", slug: "dental-crowns" },
  { name: "Invisalign", slug: "invisalign" },
  { name: "Dental Veneers", slug: "dental-veneers" },
  { name: "Wisdom Teeth", slug: "wisdom-teeth-removal" },
  { name: "Braces", slug: "braces" },
  { name: "Emergency Dentist", slug: "emergency-dentist" },
  { name: "Teeth Cleaning", slug: "teeth-cleaning" },
];

const company = [
  { name: "About Us", path: "/about/", description: "Learn about our mission" },
  { name: "How It Works", path: "/how-it-works/", description: "Book in minutes" },
  { name: "Pricing", path: "/pricing/", description: "Transparent pricing" },
  { name: "Contact Us", path: "/contact/", description: "We're here to help" },
  { name: "FAQs", path: "/faq/", description: "Common questions" },
  { name: "Blog", path: "/blog/", description: "Dental health tips" },
];

const resources = [
  { name: "Find a Dentist", path: "/search/", description: "Browse 11,000+ dentists" },
  { name: "Insurance", path: "/insurance/", description: "Accepted plans" },
  { name: "List Your Practice", path: "/list-your-practice/", description: "For dentists" },
  { name: "Claim Profile", path: "/claim-profile/", description: "Manage your listing" },
  { name: "Sitemap", path: "/sitemap/", description: "All pages" },
  { name: "All Services", path: "/services/", description: "Browse treatments" },
];

const legal = [
  { name: "Privacy Policy", path: "/privacy/" },
  { name: "Terms of Service", path: "/terms/" },
  { name: "Cookie Policy", path: "/cookie-policy/" },
];

interface CityData {
  name: string;
  slug: string;
  dentist_count: number;
}

export const Footer = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (props, ref) => {
    const { data: siteSettings } = useSiteSettings();

    const { data: citiesByState } = useQuery({
      queryKey: ["footer-cities"],
      queryFn: async () => {
        const result: Record<string, CityData[]> = {};
        for (const state of ACTIVE_STATES) {
          const { data } = await supabase
            .from("cities")
            .select("name, slug, dentist_count, states!inner(slug)")
            .eq("is_active", true)
            .eq("states.slug", state.slug)
            .order("dentist_count", { ascending: false })
            .limit(5);
          result[state.slug] = (data || []).map((c) => ({
            name: c.name,
            slug: c.slug,
            dentist_count: c.dentist_count || 0,
          }));
        }
        return result;
      },
      staleTime: 1000 * 60 * 30,
    });

    const contactEmail = siteSettings?.contactDetails?.support_email || '';
    const contactPhone = siteSettings?.contactDetails?.support_phone || siteSettings?.contactDetails?.booking_phone || '';
    const copyrightText = siteSettings?.copyrightText || `© ${new Date().getFullYear()} AppointPanda. All rights reserved.`;

    const socialLinks = siteSettings?.socialLinks || {};
    const socialIcons = [
      { icon: Facebook, url: socialLinks.facebook, label: 'Facebook' },
      { icon: Instagram, url: socialLinks.instagram, label: 'Instagram' },
      { icon: Twitter, url: socialLinks.twitter, label: 'Twitter' },
      { icon: Linkedin, url: socialLinks.linkedin, label: 'LinkedIn' },
      { icon: Youtube, url: socialLinks.youtube, label: 'YouTube' },
    ].filter((s) => s.url && s.url.trim() !== '');

    return (
      <footer ref={ref} {...props} className="bg-slate-900 text-white relative overflow-hidden" role="contentinfo">
        {/* SEO: Organization Schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "AppointPanda",
          "url": "https://appointpanda.com",
          "description": "America's premier patient-first dental directory. Find trusted dentists with transparent pricing and real reviews.",
          "sameAs": Object.values(socialLinks).filter(Boolean),
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": contactPhone,
            "contactType": "customer service",
            "email": contactEmail
          }
        })}} />

        {/* Top emerald gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

        {/* Newsletter CTA Section */}
        <div className="border-b border-white/10 bg-gradient-to-r from-emerald-900/50 to-slate-900">
          <div className="container py-8 px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
                  <Send className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Stay Updated</h3>
                  <p className="text-slate-400 text-sm">Get dental tips and practice updates</p>
                </div>
              </div>
              <form className="flex w-full md:w-auto gap-2" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full md:w-64 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors">
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="container py-12 px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">

            {/* Brand & About Column */}
            <div className="lg:col-span-3">
              <Link to="/" className="inline-flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-medium text-lg">AP</span>
                </div>
                <span className="text-xl font-medium tracking-tight text-white">
                  Appoint<span className="text-emerald-400">Panda</span>
                </span>
              </Link>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                America's #1 dental directory. Find verified dentists, read real reviews, and book appointments in under 60 seconds.
              </p>

              {/* Trust Badges */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm text-slate-300">11,000+ Verified Dentists</span>
                </div>
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-amber-400" />
                  <span className="text-sm text-slate-300">4.9 Average Rating</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm text-slate-300">Instant Online Booking</span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {contactPhone && (
                  <a href={`tel:${contactPhone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                    <Phone className="h-4 w-4" />
                    <span>{contactPhone}</span>
                  </a>
                )}
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                    <Mail className="h-4 w-4" />
                    <span>{contactEmail}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Company Links */}
            <div className="lg:col-span-2">
              <h4 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">Company</h4>
              <ul className="space-y-3">
                {company.map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2 group">
                      <ChevronRight className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources Links */}
            <div className="lg:col-span-2">
              <h4 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">Resources</h4>
              <ul className="space-y-3">
                {resources.map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2 group">
                      <ChevronRight className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Popular Services */}
            <div className="lg:col-span-2">
              <h4 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">Popular Services</h4>
              <ul className="space-y-3">
                {TOP_SERVICES.slice(0, 6).map((service) => (
                  <li key={service.slug}>
                    <Link to={`/services/${service.slug}/`} className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2 group">
                      <Stethoscope className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {service.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Top Cities */}
            <div className="lg:col-span-3">
              <h4 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">Top Cities</h4>
              <div className="space-y-4">
                {ACTIVE_STATES.slice(0, 4).map((state) => (
                  <div key={state.slug}>
                    <Link to={`/${state.slug}/`} className="text-sm font-medium text-white hover:text-emerald-400 transition-colors flex items-center gap-1 mb-2">
                      {state.name}
                      <ChevronRight className="h-3 w-3 text-emerald-400" />
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      {(citiesByState?.[state.slug] || []).slice(0, 3).map((city) => (
                        <Link
                          key={city.slug}
                          to={`/${state.slug}/${city.slug}/`}
                          className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                        >
                          {city.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Services Row */}
          <div className="border-t border-white/10 mt-10 pt-8">
            <nav aria-label="Dental Services" className="flex flex-wrap gap-x-4 gap-y-2 items-center">
              <span className="text-xs font-medium text-slate-500 uppercase mr-2">Services:</span>
              {TOP_SERVICES.map((service, idx) => (
                <Link
                  key={service.slug}
                  to={`/services/${service.slug}/`}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  {service.name}
                  {idx < TOP_SERVICES.length - 1 && <span className="text-slate-600 ml-4">•</span>}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 bg-black/50">
          <div className="container py-6 px-4">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap justify-center lg:justify-start items-center gap-4 text-sm text-slate-500">
                <span>{copyrightText}</span>
                {legal.map((item, idx) => (
                  <span key={item.path} className="flex items-center gap-4">
                    <Link to={item.path} className="hover:text-slate-300 transition-colors">
                      {item.name}
                    </Link>
                    {idx < legal.length - 1 && <span className="text-slate-700">|</span>}
                  </span>
                ))}
              </div>

              {/* Social Icons */}
              <div className="flex gap-3">
                {socialIcons.length > 0 ? (
                  socialIcons.map((social, i) => (
                    <a
                      key={i}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald/20 hover:border-emerald/50 hover:text-emerald transition-all"
                    >
                      <social.icon className="h-4 w-4" />
                    </a>
                  ))
                ) : (
                  [Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
                    <span key={i} className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center opacity-30">
                      <Icon className="h-4 w-4" />
                    </span>
                  ))
                )}
              </div>

              {/* For Dentists CTA */}
              <Link
                to="/list-your-practice/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/25"
              >
                <Shield className="h-4 w-4" />
                List Your Practice
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    );
  });

Footer.displayName = 'Footer';

export default Footer;
