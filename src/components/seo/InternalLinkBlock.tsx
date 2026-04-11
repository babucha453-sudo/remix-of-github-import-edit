/**
 * InternalLinkBlock - Contextual internal links for SEO with big-company styling
 * 8-15 contextual links for crawlability and ranking reinforcement
 */

import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  ArrowRight, 
  ChevronRight,
  MapPin,
  Stethoscope,
  Building2,
  Sparkles
} from "lucide-react";

interface InternalLink {
  label: string;
  href: string;
  description?: string;
}

interface InternalLinkBlockProps {
  title?: string;
  links: InternalLink[];
  variant?: 'grid' | 'list' | 'inline';
  className?: string;
  showDescriptions?: boolean;
}

export const InternalLinkBlock = ({
  title,
  links,
  variant = 'grid',
  className,
  showDescriptions = false,
}: InternalLinkBlockProps) => {
  if (!links.length) return null;

  return (
    <section className={cn("py-8 bg-slate-50", className)} aria-label={title || "Related pages"}>
      <div className="container px-4">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                {title && (
                  <h3 className="font-bold text-lg text-slate-800">
                    {title}
                  </h3>
                )}
                <p className="text-sm text-slate-500">Explore related pages</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {variant === 'grid' ? (
              <nav className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" aria-label={title}>
                {links.map((link, index) => (
                  <Link
                    key={`${link.href}-${index}`}
                    to={link.href}
                    className="group flex flex-col p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-xl transition-all"
                  >
                    <span className="font-semibold text-slate-800 group-hover:text-emerald-700 flex items-center gap-2">
                      {link.label}
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    {showDescriptions && link.description && (
                      <span className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {link.description}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            ) : variant === 'list' ? (
              <nav className="space-y-2" aria-label={title}>
                {links.map((link, index) => (
                  <Link
                    key={`${link.href}-${index}`}
                    to={link.href}
                    className="group flex items-start gap-3 p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-lg transition-all"
                  >
                    <ArrowRight className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                    <div>
                      <span className="font-medium text-slate-800 group-hover:text-emerald-700">
                        {link.label}
                      </span>
                      {showDescriptions && link.description && (
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {link.description}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </nav>
            ) : (
              <nav className="flex flex-wrap gap-2" aria-label={title}>
                {links.map((link, index) => (
                  <Link
                    key={`${link.href}-${index}`}
                    to={link.href}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-full text-sm font-medium transition-colors"
                  >
                    {link.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export const generateCityInternalLinks = (
  stateSlug: string,
  citySlug: string,
  cityName: string,
  stateName: string,
  treatments: { name: string; slug: string }[],
  nearbyCities: { name: string; slug: string }[],
): InternalLink[] => {
  const links: InternalLink[] = [];
  
  treatments.slice(0, 4).forEach((t) => {
    links.push({
      label: `${t.name} in ${cityName}`,
      href: `/${stateSlug}/${citySlug}/${t.slug}/`,
      description: `Find ${t.name.toLowerCase()} specialists in ${cityName}`,
    });
  });
  
  nearbyCities.slice(0, 4).forEach((c) => {
    links.push({
      label: `Dentists in ${c.name}`,
      href: `/${stateSlug}/${c.slug}/`,
      description: `Browse dental clinics in ${c.name}`,
    });
  });
  
  links.push({
    label: `All ${stateName} Dentists`,
    href: `/${stateSlug}/`,
    description: `View all dental clinics across ${stateName}`,
  });
  
  links.push({
    label: 'Dental Services',
    href: '/services/',
    description: 'Browse all dental treatment categories',
  });
  
  return links;
};

export const generateServiceLocationInternalLinks = (
  stateSlug: string,
  citySlug: string,
  cityName: string,
  stateName: string,
  serviceName: string,
  serviceSlug: string,
  relatedServices: { name: string; slug: string }[],
  nearbyCities: { name: string; slug: string }[],
): InternalLink[] => {
  const links: InternalLink[] = [];
  
  links.push({
    label: `All Dentists in ${cityName}`,
    href: `/${stateSlug}/${citySlug}/`,
    description: `View all dental clinics in ${cityName}`,
  });

  relatedServices.slice(0, 4).forEach((s) => {
    if (s.slug !== serviceSlug) {
      links.push({
        label: `${s.name} in ${cityName}`,
        href: `/${stateSlug}/${citySlug}/${s.slug}/`,
        description: `Find ${s.name.toLowerCase()} specialists locally`,
      });
    }
  });
  
  nearbyCities.slice(0, 3).forEach((c) => {
    links.push({
      label: `${serviceName} in ${c.name}`,
      href: `/${stateSlug}/${c.slug}/${serviceSlug}/`,
      description: `${serviceName} providers in ${c.name}`,
    });
  });
  
  links.push({
    label: `${serviceName} Overview`,
    href: `/services/${serviceSlug}/`,
    description: `Learn about ${serviceName.toLowerCase()} procedures`,
  });
  
  links.push({
    label: `${stateName} Dentists`,
    href: `/${stateSlug}/`,
    description: `Browse all dentists in ${stateName}`,
  });
  
  return links;
};

export const generateClinicInternalLinks = (
  clinic: { 
    slug: string; 
    city?: { slug: string; name: string; state?: { abbreviation: string; name?: string } } | null;
  },
  services: { name: string; slug: string }[],
  nearbyClinics: { name: string; slug: string }[],
): InternalLink[] => {
  const links: InternalLink[] = [];
  const citySlug = clinic.city?.slug;
  const cityName = clinic.city?.name;
  const stateSlug = clinic.city?.state?.abbreviation?.toLowerCase();
  
  if (citySlug && stateSlug && cityName) {
    links.push({
      label: `Dentists in ${cityName}`,
      href: `/${stateSlug}/${citySlug}/`,
      description: `View all dental clinics in ${cityName}`,
    });
    
    services.slice(0, 4).forEach((s) => {
      links.push({
        label: `${s.name} in ${cityName}`,
        href: `/${stateSlug}/${citySlug}/${s.slug}/`,
        description: `Find ${s.name.toLowerCase()} specialists`,
      });
    });
  }
  
  nearbyClinics.slice(0, 4).forEach((c) => {
    links.push({
      label: c.name,
      href: `/clinic/${c.slug}/`,
      description: 'View clinic profile',
    });
  });
  
  links.push({
    label: 'All Dental Services',
    href: '/services/',
    description: 'Browse dental treatment categories',
  });
  
  return links;
};

export default InternalLinkBlock;
