/**
 * GeographicLinkBlock - SEO authority distribution with big-company styling
 * Creates internal link graphs for ranking reinforcement
 */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Stethoscope, 
  ArrowRight,
  Building2,
  Navigation,
  ChevronRight,
  Globe,
  Landmark
} from "lucide-react";

const NEIGHBORING_STATES: Record<string, { name: string; slug: string }[]> = {
  ca: [],
  nj: [
    { name: "Connecticut", slug: "ct" },
    { name: "Massachusetts", slug: "ma" },
  ],
  ma: [
    { name: "Connecticut", slug: "ct" },
    { name: "New Jersey", slug: "nj" },
  ],
  ct: [
    { name: "New Jersey", slug: "nj" },
    { name: "Massachusetts", slug: "ma" },
  ],
};

const RELATED_SERVICES: Record<string, string[]> = {
  "dental-implants": ["dental-crowns", "dental-veneers", "teeth-whitening"],
  "teeth-whitening": ["dental-veneers", "teeth-cleaning", "invisalign"],
  "root-canal": ["dental-crowns", "teeth-cleaning", "dental-implants"],
  "dental-crowns": ["dental-veneers", "root-canal", "dental-implants"],
  "invisalign": ["braces", "teeth-whitening", "dental-veneers"],
  "dental-veneers": ["teeth-whitening", "dental-crowns", "invisalign"],
  "teeth-cleaning": ["teeth-whitening", "root-canal", "dental-crowns"],
  "braces": ["invisalign", "teeth-cleaning", "teeth-whitening"],
};

interface GeographicLinkBlockProps {
  pageType: "state" | "city" | "service-location";
  stateSlug: string;
  stateName: string;
  citySlug?: string;
  cityName?: string;
  serviceSlug?: string;
  serviceName?: string;
  topCities?: { name: string; slug: string }[];
  nearbyCities?: { name: string; slug: string }[];
  services?: { name: string; slug: string }[];
}

export const GeographicLinkBlock = ({
  pageType,
  stateSlug,
  stateName,
  citySlug,
  cityName,
  serviceSlug,
  serviceName,
  topCities = [],
  nearbyCities = [],
  services = [],
}: GeographicLinkBlockProps) => {
  const neighboringStates = NEIGHBORING_STATES[stateSlug] || [];
  const relatedServiceSlugs = serviceSlug ? RELATED_SERVICES[serviceSlug] || [] : [];
  const relatedServices = services.filter(s => relatedServiceSlugs.includes(s.slug)).slice(0, 4);

  if (pageType === "state") {
    return (
      <section className="py-8 bg-slate-50" aria-label="Explore more locations">
        <div className="container px-4">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Navigation className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-800">Explore Dental Care in {stateName}</h3>
                  <p className="text-sm text-slate-500">Find dentists in nearby cities</p>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Top Cities */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-blue-600" />
                  </div>
                  Top Cities
                </h4>
                <nav className="space-y-2">
                  {topCities.slice(0, 6).map((city) => (
                    <Link
                      key={city.slug}
                      to={`/${stateSlug}/${city.slug}/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-700 transition-all group"
                    >
                      <span>{city.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Popular Services */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                  </div>
                  Popular Services
                </h4>
                <nav className="space-y-2">
                  {services.slice(0, 6).map((service) => (
                    <Link
                      key={service.slug}
                      to={`/services/${service.slug}/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-lg text-sm font-medium text-slate-700 hover:text-emerald-700 transition-all group"
                    >
                      <span>{service.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Neighboring States */}
              {neighboringStates.length > 0 ? (
                <div className="p-6">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Landmark className="h-4 w-4 text-purple-600" />
                    </div>
                    Nearby States
                  </h4>
                  <nav className="space-y-2">
                    {neighboringStates.map((state) => (
                      <Link
                        key={state.slug}
                        to={`/${state.slug}/`}
                        className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 rounded-lg text-sm font-medium text-slate-700 hover:text-purple-700 transition-all group"
                      >
                        <span>Dentists in {state.name}</span>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </nav>
                </div>
              ) : (
                <div className="p-6">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Globe className="h-4 w-4 text-orange-600" />
                    </div>
                    All States
                  </h4>
                  <nav className="space-y-2">
                    <Link
                      to={`/search/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-orange-50 border border-slate-100 hover:border-orange-200 rounded-lg text-sm font-medium text-slate-700 hover:text-orange-700 transition-all group"
                    >
                      <span>Browse All States</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (pageType === "city" && citySlug && cityName) {
    return (
      <section className="py-8 bg-slate-50" aria-label="Explore dental services">
        <div className="container px-4">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Navigation className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-800">Dental Services in {cityName}</h3>
                  <p className="text-sm text-slate-500">Browse by treatment type</p>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Services in City */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                  </div>
                  Services in {cityName}
                </h4>
                <nav className="space-y-2">
                  {services.slice(0, 6).map((service) => (
                    <Link
                      key={service.slug}
                      to={`/${stateSlug}/${citySlug}/${service.slug}/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-lg text-sm font-medium text-slate-700 hover:text-emerald-700 transition-all group"
                    >
                      <span>{service.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Nearby Cities */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-blue-600" />
                  </div>
                  Nearby Cities
                </h4>
                <nav className="space-y-2">
                  {nearbyCities.slice(0, 6).map((city) => (
                    <Link
                      key={city.slug}
                      to={`/${stateSlug}/${city.slug}/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-700 transition-all group"
                    >
                      <span>{city.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Parent State */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-purple-600" />
                  </div>
                  Browse State
                </h4>
                <nav className="space-y-2">
                  <Link
                    to={`/${stateSlug}/`}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 rounded-lg text-sm font-medium text-slate-700 hover:text-purple-700 transition-all group"
                  >
                    <span>All cities in {stateName}</span>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  {neighboringStates.slice(0, 2).map((state) => (
                    <Link
                      key={state.slug}
                      to={`/${state.slug}/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 rounded-lg text-sm font-medium text-slate-700 hover:text-purple-700 transition-all group"
                    >
                      <span>{state.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (pageType === "service-location" && citySlug && cityName && serviceSlug && serviceName) {
    return (
      <section className="py-8 bg-slate-50" aria-label="Related dental services">
        <div className="container px-4">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Navigation className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-800">More {serviceName} Options</h3>
                  <p className="text-sm text-slate-500">Find related treatments</p>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Same Service Nearby */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-blue-600" />
                  </div>
                  {serviceName} Nearby
                </h4>
                <nav className="space-y-2">
                  {nearbyCities.slice(0, 5).map((city) => (
                    <Link
                      key={city.slug}
                      to={`/${stateSlug}/${city.slug}/${serviceSlug}/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-700 transition-all group"
                    >
                      <span>{city.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Related Services */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                  </div>
                  Related Services
                </h4>
                <nav className="space-y-2">
                  {relatedServices.map((service) => (
                    <Link
                      key={service.slug}
                      to={`/${stateSlug}/${citySlug}/${service.slug}/`}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-lg text-sm font-medium text-slate-700 hover:text-emerald-700 transition-all group"
                    >
                      <span>{service.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                  <Link
                    to={`/${stateSlug}/${citySlug}/`}
                    className="flex items-center justify-between px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-700 transition-all group"
                  >
                    <span>All services in {cityName}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </nav>
              </div>

              {/* Browse More */}
              <div className="p-6">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Globe className="h-4 w-4 text-purple-600" />
                  </div>
                  Browse More
                </h4>
                <nav className="space-y-2">
                  <Link
                    to={`/${stateSlug}/${citySlug}/`}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 rounded-lg text-sm font-medium text-slate-700 hover:text-purple-700 transition-all group"
                  >
                    <span>All dentists in {cityName}</span>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link
                    to={`/${stateSlug}/`}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 rounded-lg text-sm font-medium text-slate-700 hover:text-purple-700 transition-all group"
                  >
                    <span>All cities in {stateName}</span>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link
                    to={`/services/${serviceSlug}/`}
                    className="flex items-center justify-between px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-sm font-semibold text-purple-700 transition-all group"
                  >
                    <span>{serviceName} nationwide</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return null;
};

export default GeographicLinkBlock;
