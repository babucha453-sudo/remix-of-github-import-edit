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
      `Finding the right ${treatmentName?.toLowerCase()} specialist in ${locationName} is essential for your dental health. Our comprehensive directory features verified ${treatmentName?.toLowerCase()} providers with proven track records of patient satisfaction. Browse detailed profiles, compare credentials, read authentic patient reviews, and book your appointment directly online. Each dentist in our network has been vetted for quality standards, ensuring you receive expert care from qualified professionals in your area. Whether you need routine preventive care or specialized treatment, our directory connects you with top-rated ${treatmentName?.toLowerCase()} experts who prioritize patient comfort and excellent outcomes.`,
      `${treatmentName} specialists in ${locationName} offer comprehensive dental care through our verified network. Our directory makes it easy to research providers, compare treatment options, read patient experiences, and find the perfect match for your dental needs. All listed ${treatmentName?.toLowerCase()} dentists have verified credentials, current licenses, and demonstrated expertise in their field. Booking through our platform is simple, secure, and often available with same-day appointments. Take control of your dental health by choosing from verified ${treatmentName?.toLowerCase()} providers in ${locationName} who are committed to delivering exceptional care.`,
      `When searching for ${treatmentName?.toLowerCase()} services in ${locationName}, our directory provides the most comprehensive and up-to-date listings of qualified dental professionals. We verify each provider's credentials, licensure status, and patient satisfaction ratings so you can make informed decisions about your dental care. Our platform allows you to compare multiple ${treatmentName?.toLowerCase()} specialists side-by-side, review their experience and specializations, check availability, and book appointments without phone calls. Quality dental care is within reach - our verified network of ${treatmentName?.toLowerCase()} experts in ${locationName} is ready to serve you with compassionate, professional treatment.`,
    ],
    'city': [
      `${locationName} residents have access to exceptional dental care through our verified network of dental professionals. Our directory features comprehensive listings of general dentists, specialists, and multi-specialty practices throughout the ${locationName} area. Each provider has been vetted for licensure, credentials, and patient satisfaction to ensure you receive quality care. Browse by specialty, compare office hours and accepted insurance plans, read verified patient reviews, and book appointments directly online. Our platform makes finding a trusted dentist in ${locationName} simple and convenient, with detailed profiles covering qualifications, services offered, and patient experiences. Your dental health journey starts here - connect with top-rated providers committed to your care.`,
      `Finding quality dental care in ${locationName} is easier than ever with our comprehensive dentist directory. We feature verified dental professionals offering everything from routine cleanings to advanced cosmetic and restorative procedures. Each listing includes detailed information about provider qualifications, specialties, office locations, accepted insurance plans, and patient ratings. Our platform enables side-by-side comparisons so you can evaluate dentists based on what matters most to you - whether that's experience, proximity, or patient reviews. Book appointments online, read authentic patient testimonials, and discover why ${locationName} is home to some of the most dedicated dental professionals in the region. Your perfect dentist awaits in our verified network.`,
      `Our dentist directory for ${locationName} connects you with verified dental professionals serving communities throughout the area. Whether you need preventive care, cosmetic treatments, or specialized procedures, our network includes qualified providers for every dental need. Each dentist has been thoroughly vetted for current licensure, professional credentials, and positive patient outcomes. Browse detailed profiles to find providers who match your specific requirements - from general dentistry to oral surgery, orthodontics to periodontics. Our platform provides transparent information about services, pricing, insurance acceptance, and availability, enabling confident decisions about your dental care. Start your search today and discover why ${locationName} residents trust our directory to find exceptional dental providers.`,
    ],
    'service': [
      `Our dental service directory provides comprehensive information about ${treatmentName} procedures, helping you understand your treatment options and find qualified providers. Each listing includes details about the procedure, what to expect during treatment, recovery timelines, and cost considerations. We feature verified dentists and specialists with proven expertise in ${treatmentName} techniques, ensuring you receive care from qualified professionals. Our platform allows you to research providers, compare qualifications, read patient experiences, and book consultations with ease. Whether you're exploring ${treatmentName} for the first time or seeking a second opinion, our directory connects you with experts committed to delivering excellent outcomes. Understanding your options is the first step toward making informed decisions about your dental health.`,
      `Discover qualified dental professionals specializing in ${treatmentName} through our comprehensive provider directory. We feature verified dentists with demonstrated expertise in ${treatmentName} procedures, ensuring you have access to qualified care in your area. Each provider profile includes information about their training, certifications, years of experience, and patient satisfaction ratings. Our platform enables you to research treatment options, understand procedure details, compare provider qualifications, and book appointments directly. Whether you need preventive ${treatmentName} care or more complex procedures, our network of verified specialists is ready to serve you. Take the next step toward optimal dental health by exploring our directory of qualified ${treatmentName} providers.`,
      `Finding expert ${treatmentName} dental care is straightforward with our verified provider directory. We connect patients with qualified dentists and specialists offering comprehensive ${treatmentName} services backed by proven credentials and positive patient outcomes. Each provider in our network has been thoroughly vetted for licensure, professional standing, and clinical expertise in ${treatmentName} procedures. Our directory provides detailed profiles covering qualifications, treatment approaches, patient reviews, and availability - everything you need to make confident decisions about your dental care. Whether you're seeking routine ${treatmentName} services or specialized treatment, our verified network offers access to top-quality dental professionals. Begin your search today and discover why patients trust our directory to find exceptional ${treatmentName} care.`,
    ],
    'state': [
      `${locationName} offers a comprehensive network of verified dental professionals serving communities throughout the state. Our directory features qualified general dentists and specialists providing full-service dental care, from routine preventive treatments to advanced cosmetic and restorative procedures. Each provider in our ${locationName} network has been vetted for licensure, professional credentials, and demonstrated patient satisfaction. Our platform enables you to search by city, specialty, insurance acceptance, and available appointment times - making it simple to find the right dentist for your needs. Browse detailed provider profiles, read verified patient reviews, compare office hours and locations, and book appointments directly online. Quality dental care is accessible throughout ${locationName} - discover why patients trust our directory to connect them with exceptional dental professionals.`,
      `Finding quality dental care in ${locationName} is streamlined through our comprehensive dentist directory featuring verified providers across the state. Our network includes general dentists, specialists, and multi-specialty practices offering full-service dental care for patients of all ages. Each listing includes detailed information about provider qualifications, specialties, accepted insurance, patient ratings, and appointment availability. We make it easy to compare dentists side-by-side, research treatment options, read authentic patient reviews, and book appointments directly without phone calls. Whether you need preventive care, cosmetic treatments, or specialized procedures, our ${locationName} network connects you with qualified professionals committed to excellent patient outcomes. Start your search today and discover the difference our verified dental network can make in your dental health journey.`,
      `Our ${locationName} dentist directory provides access to a wide network of verified dental professionals serving communities statewide. From routine cleanings to advanced procedures, our featured providers offer comprehensive dental services tailored to patient needs. Each dentist has been thoroughly vetted for current licensure, professional credentials, and positive treatment outcomes. Our platform enables easy searching by location, specialty, insurance plan, and availability - helping you find the perfect dental match quickly. Browse provider profiles, compare qualifications, read patient testimonials, and book appointments online in just a few clicks. Quality dental care is available throughout ${locationName} through our network of dedicated professionals. Discover trusted dentists committed to delivering exceptional care and building long-term patient relationships.`,
    ],
  };

  // Use hash-based selection for consistent but varied content
  const variantKey = variant as keyof typeof defaultContentVariants;
  const contentOptions = defaultContentVariants[variantKey] || defaultContentVariants['city'];
  const contentIndex = Math.abs((locationName?.length || 0) + (treatmentName?.length || 0)) % contentOptions.length;
  const defaultContent = contentOptions[contentIndex];

  const titleVariants = {
    'service-location': [
      `Complete Guide to ${treatmentName} in ${locationName}`,
      `${treatmentName} Dental Care in ${locationName}`,
      `Find ${treatmentName} Specialists Near You in ${locationName}`,
    ],
    'city': [
      `Dental Care Services in ${locationName}`,
      `Find Quality Dentists in ${locationName}`,
      `Your Complete Dental Directory for ${locationName}`,
    ],
    'service': [
      `Everything You Need to Know About ${treatmentName}`,
      `Complete Guide to ${treatmentName} Procedures`,
      `Understanding ${treatmentName} - Expert Dental Insights`,
    ],
    'state': [
      `Dental Care Across ${locationName} - Complete Directory`,
      `Find the Best Dentists Throughout ${locationName}`,
      `${locationName} Dental Services - Your Complete Guide`,
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
