import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  MapPin,
  Star,
  Shield,
  Award,
  Clock,
  CreditCard,
  Stethoscope,
  Building2,
  HeartPulse,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Grid3X3,
  Navigation
} from "lucide-react";
import { withTrailingSlash } from "@/lib/url/withTrailingSlash";
import { parseMarkdownToHtml, stripMarkdown } from "@/lib/utils/parseMarkdown";
import { sanitizeHtml } from "@/lib/utils";

interface ParsedSection {
  heading: string;
  content: string;
  level: number;
}

interface SEOContentBlockProps {
  variant: "state" | "city" | "service-location" | "service";
  locationName: string;
  stateName?: string;
  stateAbbr?: string;
  stateSlug?: string;
  citySlug?: string;
  treatmentName?: string;
  treatmentSlug?: string;
  clinicCount?: number;
  cityCount?: number;
  parsedContent?: {
    intro: string;
    sections: ParsedSection[];
  } | null;
  popularTreatments?: { name: string; slug: string }[];
  nearbyLocations?: { name: string; slug: string }[];
  isLoading?: boolean;
}

export const SEOContentBlock = ({
  variant,
  locationName,
  stateName = "",
  stateAbbr = "",
  stateSlug = "",
  citySlug = "",
  treatmentName = "",
  treatmentSlug = "",
  clinicCount = 0,
  cityCount = 0,
  parsedContent,
  popularTreatments = [],
  nearbyLocations = [],
  isLoading = false,
}: SEOContentBlockProps) => {
  if (isLoading) {
    return (
      <article className="space-y-6" aria-busy="true">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg animate-pulse">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-24 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
          <div className="p-6 md:p-8 space-y-4">
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-5/6 bg-slate-200 rounded" />
            <div className="h-4 w-4/5 bg-slate-200 rounded" />
          </div>
        </div>
      </article>
    );
  }

  const hasOptimizedContent =
    !!parsedContent &&
    (parsedContent.intro.trim().length > 0 || (parsedContent.sections?.length ?? 0) > 0);

  if (hasOptimizedContent) {
    return (
      <OptimizedContentLayout 
        parsedContent={parsedContent} 
        variant={variant}
        locationName={locationName}
        stateName={stateName}
        treatmentName={treatmentName}
        stateSlug={stateSlug}
        citySlug={citySlug}
        treatmentSlug={treatmentSlug}
        popularTreatments={popularTreatments}
        nearbyLocations={nearbyLocations}
      />
    );
  }

  const defaultContentVariants = {
    'service-location': [
      `Looking for quality ${treatmentName?.toLowerCase()} care in ${locationName}? Our directory features verified dental professionals specializing in ${treatmentName?.toLowerCase()} procedures with proven patient satisfaction.`,
      `${treatmentName} specialists in ${locationName} - browse ratings, compare experience, and book directly with top-rated providers in your area.`,
      `Find experienced ${treatmentName?.toLowerCase()} dentists near you. Verified credentials, real patient reviews, and easy online booking.`,
    ],
    'city': [
      `Quality dental care starts here in ${locationName}. Browse verified dentists, compare treatment options, and book appointments with confidence.`,
      `Your smile matters - find trusted dentists in ${locationName} who prioritize patient care. Read reviews, compare services, and book online.`,
      `Looking for a great dentist in ${locationName}? Our verified directory helps you find the right dental professional for your needs.`,
    ],
    'service': [
      `Explore ${treatmentName} options across the United States. Compare qualified providers, read patient experiences, and book consultations.`,
      `Learn about ${treatmentName} procedures and find experienced dental specialists. Quality care starts with informed decisions.`,
      `${treatmentName} - find qualified dentists specializing in this treatment. Compare providers and book your appointment today.`,
    ],
    'state': [
      `Quality dental care across ${locationName}. Browse verified dentists, compare services, and find the right provider for your needs.`,
      `Find trusted dental professionals in ${locationName}. Our directory features verified clinics with real patient reviews and easy booking.`,
      `Your perfect smile awaits in ${locationName}. Discover top-rated dentists and book your dental care today.`,
    ],
  };

  // Use hash-based selection for consistent but varied content
  const variantKey = variant as keyof typeof defaultContentVariants;
  const contentOptions = defaultContentVariants[variantKey] || defaultContentVariants['city'];
  const contentIndex = Math.abs((locationName?.length || 0) + (treatmentName?.length || 0)) % contentOptions.length;
  const defaultContent = contentOptions[contentIndex];

  const titleVariants = {
    'service-location': [
      `About ${treatmentName} in ${locationName}`,
      `${treatmentName} Specialists in ${locationName}`,
      `Quality ${treatmentName} Care in ${locationName}`,
    ],
    'city': [
      `Dental Care in ${locationName}`,
      `Quality Dentistry in ${locationName}`,
      `Your Smile Experts in ${locationName}`,
    ],
    'service': [
      `About ${treatmentName}`,
      `${treatmentName} Information`,
      `Learn About ${treatmentName}`,
    ],
    'state': [
      `Dental Services in ${locationName}`,
      `Quality Dental Care in ${locationName}`,
      `Find Dentists in ${locationName}`,
    ],
  };

  const titleKey = variant as keyof typeof titleVariants;
  const titleOptions = titleVariants[titleKey] || titleVariants['city'];
  const titleIndex = Math.abs((locationName?.length || 0) * 7) % titleOptions.length;
  const defaultTitle = titleOptions[titleIndex];

  return (
    <article className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        <div className="p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            {defaultTitle}
          </h2>
          <p className="text-slate-600 leading-relaxed">
            {defaultContent}
          </p>
        </div>
      </div>
    </article>
  );
};

const OptimizedContentLayout = ({
  parsedContent,
  variant,
  locationName,
  stateName,
  treatmentName,
  stateSlug,
  citySlug,
  treatmentSlug,
  popularTreatments,
  nearbyLocations,
}: {
  parsedContent: { intro: string; sections: ParsedSection[] };
  variant: string;
  locationName: string;
  stateName?: string;
  treatmentName?: string;
  stateSlug?: string;
  citySlug?: string;
  treatmentSlug?: string;
  popularTreatments?: { name: string; slug: string }[];
  nearbyLocations?: { name: string; slug: string }[];
}) => {
  const contentSections = parsedContent.sections
    .slice(1)
    .filter(
      s => !s.heading.toLowerCase().includes('frequently asked') && 
           !s.heading.toLowerCase().includes('faq')
    );

  return (
    <article className="space-y-8">
      {/* Main Content Card */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                {variant === 'city' ? `${locationName} Dental Guide` :
                 variant === 'state' ? `${locationName} Dental Guide` :
                 variant === 'service-location' ? `${treatmentName} in ${locationName}` :
                 `About ${treatmentName}`}
              </span>
              <p className="text-sm text-slate-500">Expert information & tips</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8">
          <div className="space-y-8">
            {contentSections.slice(0, 4).map((section, idx) => (
              <section key={idx} className="border-l-4 border-emerald-100 pl-6 py-2">
                {section.level === 2 ? (
                  <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <ChevronRight className="h-5 w-5 text-emerald-500" />
                    {stripMarkdown(section.heading)}
                  </h2>
                ) : (
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    {stripMarkdown(section.heading)}
                  </h3>
                )}
                <div 
                  className="text-slate-600 leading-relaxed prose prose-sm max-w-none [&_table]:my-4 [&_th]:text-left [&_td]:align-top"
                  dangerouslySetInnerHTML={{ 
                    __html: sanitizeHtml(parseMarkdownToHtml(section.content))
                  }}
                />
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Internal Links - Big Company Style */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Popular Treatments */}
        {popularTreatments && popularTreatments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Stethoscope className="h-4 w-4 text-emerald-600" />
              </div>
              Popular Treatments
              <ArrowRight className="h-4 w-4 text-slate-400 ml-auto" />
            </h3>
            <nav className="grid grid-cols-2 gap-2" aria-label="Related treatments">
              {popularTreatments.slice(0, 6).map((t) => (
                <Link
                  key={t.slug}
                  to={withTrailingSlash(citySlug ? `/${stateSlug}/${citySlug}/${t.slug}` : `/services/${t.slug}`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-xl text-sm font-medium text-slate-700 hover:text-emerald-700 transition-all group"
                >
                  <span>{t.name}</span>
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Nearby Locations */}
        {nearbyLocations && nearbyLocations.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <MapPin className="h-4 w-4 text-blue-600" />
              </div>
              Nearby Cities
              <ArrowRight className="h-4 w-4 text-slate-400 ml-auto" />
            </h3>
            <nav className="grid grid-cols-2 gap-2" aria-label="Nearby locations">
              {nearbyLocations.slice(0, 6).map((loc) => (
                <Link
                  key={loc.slug}
                  to={withTrailingSlash(`/${stateSlug}/${loc.slug}`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl text-sm font-medium text-slate-700 hover:text-blue-700 transition-all group"
                >
                  <MapPin className="h-3 w-3" />
                  <span>{loc.name}</span>
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </article>
  );
};

export default SEOContentBlock;
