import { Link } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  MapPin,
  Star,
  Shield,
  Award,
  HeartPulse,
  Building2,
  Clock,
  CreditCard,
  Stethoscope,
} from "lucide-react";
import { parseMarkdownToHtml, stripMarkdown } from "@/lib/utils/parseMarkdown";
import { sanitizeHtml } from "@/lib/utils";

interface UniqueSEOContentSectionProps {
  variant: "state" | "city" | "service-location" | "service";
  // Primary identifiers - used for unique content generation
  locationName: string;
  stateName?: string;
  stateAbbr?: string;
  stateSlug?: string;
  citySlug?: string;
  treatmentName?: string;
  treatmentSlug?: string;
  // Dynamic data
  clinicCount?: number;
  cityCount?: number;
  // Parsed SEO content from seo_pages table (if available)
  parsedContent?: {
    intro: string;
    sections: { heading: string; content: string; level: number }[];
  } | null;
  // Links for interlinking
  popularTreatments?: { name: string; slug: string }[];
  nearbyLocations?: { name: string; slug: string }[];
  // Loading state - when true, show nothing (prevents flash of fallback content)
  isLoading?: boolean;
}

/**
 * UNIFIED SEO Content Section
 * Renders unique, location/service-specific content to avoid duplicate content penalties.
 * Priority: 1) seo_pages optimized content, 2) LocationSEOContent fallback with unique text
 */
export const UniqueSEOContentSection = ({
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
}: UniqueSEOContentSectionProps) => {
  // If still loading SEO content, show nothing to prevent flash of fallback content
  if (isLoading) {
    return null;
  }

  // If we have optimized content from seo_pages, use that (guaranteed unique)
  // NOTE: Some generated markdown starts with a heading (no intro paragraph).
  // We still want to render the optimized content as long as we have ANY content.
  const hasOptimizedContent =
    !!parsedContent &&
    (parsedContent.intro.trim().length > 0 || (parsedContent.sections?.length ?? 0) > 0);

  if (hasOptimizedContent) {
    return (
      <OptimizedContent 
        parsedContent={parsedContent} 
        variant={variant}
        locationName={locationName}
        stateName={stateName}
        treatmentName={treatmentName}
      />
    );
  }

  // Fallback: Generate unique content based on variant
  switch (variant) {
    case "state":
      return (
        <StateFallbackContent
          stateName={locationName}
          stateAbbr={stateAbbr}
          stateSlug={stateSlug}
          clinicCount={clinicCount}
          cityCount={cityCount}
          popularTreatments={popularTreatments}
        />
      );
    case "city":
      return (
        <CityFallbackContent
          cityName={locationName}
          stateName={stateName}
          stateAbbr={stateAbbr}
          stateSlug={stateSlug}
          citySlug={citySlug}
          clinicCount={clinicCount}
          popularTreatments={popularTreatments}
          nearbyLocations={nearbyLocations}
        />
      );
    case "service-location":
      return (
        <ServiceLocationFallbackContent
          cityName={locationName}
          stateName={stateName}
          stateAbbr={stateAbbr}
          stateSlug={stateSlug}
          citySlug={citySlug}
          treatmentName={treatmentName}
          treatmentSlug={treatmentSlug}
          clinicCount={clinicCount}
          nearbyLocations={nearbyLocations}
        />
      );
    case "service":
      return (
        <ServiceFallbackContent
          treatmentName={treatmentName}
          clinicCount={clinicCount}
        />
      );
    default:
      return null;
  }
};

// Render optimized content from seo_pages table with enhanced visual design
const OptimizedContent = ({
  parsedContent,
  variant,
  locationName,
  stateName,
  treatmentName,
}: {
  parsedContent: { intro: string; sections: { heading: string; content: string; level: number }[] };
  variant: string;
  locationName: string;
  stateName?: string;
  treatmentName?: string;
}) => {
  const getDefaultHeading = () => {
    switch (variant) {
      case "state":
        return `About Dental Care in ${locationName}`;
      case "city":
        return `Dental Services in ${locationName}, ${stateName}`;
      case "service-location":
        return `${treatmentName} Services in ${locationName}`;
      case "service":
        return `About ${treatmentName}`;
      default:
        return `About ${locationName}`;
    }
  };

  // Filter out FAQ sections as they're rendered separately
  const contentSections = parsedContent.sections.filter(
    s => !s.heading.toLowerCase().includes('frequently asked') && !s.heading.toLowerCase().includes('faq')
  );

  return (
    <div className="space-y-8">
      {/* Main intro card */}
      <div className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-3xl p-8 md:p-12 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Expert Information</span>
            <p className="text-sm text-muted-foreground">Verified dental guidance</p>
          </div>
        </div>
        
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          {stripMarkdown(contentSections[0]?.heading || getDefaultHeading())}
        </h2>

        {parsedContent.intro && (
          <div
            className="text-muted-foreground leading-relaxed text-lg prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseMarkdownToHtml(parsedContent.intro)) }}
          />
        )}

        {/* First section content if it exists */}
        {contentSections[0]?.content && (
          <div
            className="text-muted-foreground leading-relaxed prose prose-lg max-w-none mt-6"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseMarkdownToHtml(contentSections[0].content)) }}
          />
        )}
      </div>
      
      {/* Additional sections with alternating layouts */}
      {contentSections.slice(1, 5).map((section, idx) => (
        <div 
          key={idx} 
          className={`bg-card border border-border rounded-2xl p-6 md:p-8 ${
            idx % 2 === 0 ? 'md:ml-8' : 'md:mr-8'
          }`}
        >
          {section.level === 2 ? (
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
              <span className="h-8 w-1 bg-primary rounded-full" />
              {stripMarkdown(section.heading)}
            </h2>
          ) : (
            <h3 className="text-lg md:text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="h-6 w-1 bg-primary/50 rounded-full" />
              {stripMarkdown(section.heading)}
            </h3>
          )}
          <div
            className="text-muted-foreground leading-relaxed prose prose-base max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseMarkdownToHtml(section.content)) }}
          />
        </div>
      ))}
    </div>
  );
};

// State page fallback content - UNIQUE per state
const StateFallbackContent = ({
  stateName,
  stateAbbr,
  stateSlug,
  clinicCount,
  cityCount,
  popularTreatments,
}: {
  stateName: string;
  stateAbbr: string;
  stateSlug: string;
  clinicCount: number;
  cityCount: number;
  popularTreatments: { name: string; slug: string }[];
}) => (
  <div className="space-y-10">
    <div className="bg-card border border-border rounded-3xl p-8 md:p-12">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-xs font-bold text-primary uppercase tracking-widest">About {stateAbbr}</span>
      </div>
      
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        Dental Care in {stateName}
      </h2>
      
      <p className="text-lg text-muted-foreground leading-relaxed mb-6">
        {stateName} offers access to {clinicCount > 0 ? `${clinicCount}+` : 'numerous'} dental clinics 
        across {cityCount > 0 ? cityCount : 'multiple'} cities. The {stateAbbr} Board of Dental Examiners 
        ensures all practicing dentists meet rigorous licensing standards, giving residents confidence 
        in their oral healthcare providers.
      </p>
      
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Award className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">{stateAbbr} Licensed Dentists</h3>
            <p className="text-muted-foreground text-sm">
              All dentists practicing in {stateName} hold valid licenses from the state dental board.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Advanced Technology</h3>
            <p className="text-muted-foreground text-sm">
              {stateName} clinics utilize modern equipment including digital imaging and laser dentistry.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Insurance & Payment</h3>
            <p className="text-muted-foreground text-sm">
              Most {stateAbbr} dental offices accept major insurance plans and offer flexible payment options.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Convenient Hours</h3>
            <p className="text-muted-foreground text-sm">
              Many {stateName} dentists offer extended hours including evenings and weekends.
            </p>
          </div>
        </div>
      </div>
      
      {popularTreatments.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="font-bold text-foreground mb-4">Popular Services in {stateName}:</h3>
          <div className="flex flex-wrap gap-2">
            {popularTreatments.slice(0, 8).map((t) => (
              <Link
                key={t.slug}
                to={`/services/${t.slug}`}
                className="bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// City page fallback content - UNIQUE per city
const CityFallbackContent = ({
  cityName,
  stateName,
  stateAbbr,
  stateSlug,
  citySlug,
  clinicCount,
  popularTreatments,
  nearbyLocations,
}: {
  cityName: string;
  stateName: string;
  stateAbbr: string;
  stateSlug: string;
  citySlug: string;
  clinicCount: number;
  popularTreatments: { name: string; slug: string }[];
  nearbyLocations: { name: string; slug: string }[];
}) => (
  <div className="space-y-10">
    <div className="bg-card border border-border rounded-3xl p-8 md:p-12">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-xs font-bold text-primary uppercase tracking-widest">{cityName} Dental Guide</span>
      </div>
      
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        Finding a Dentist in {cityName}, {stateAbbr}
      </h2>
      
      <p className="text-lg text-muted-foreground leading-relaxed mb-6">
        {cityName} is home to {clinicCount > 0 ? `${clinicCount}+` : 'several'} dental practices serving 
        the local community. Whether you need a family dentist for routine checkups, an orthodontist for 
        braces, or a specialist for dental implants, {cityName} has qualified professionals ready to help.
      </p>
      
      <p className="text-muted-foreground leading-relaxed mb-6">
        {cityName}, {stateName} dental offices offer comprehensive services ranging from preventive care 
        like cleanings and exams to advanced treatments including cosmetic dentistry, periodontics, and 
        oral surgery. Many clinics serve patients from surrounding {stateAbbr} communities as well.
      </p>
      
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">{clinicCount > 0 ? `${clinicCount}+` : '—'}</div>
          <div className="text-sm text-muted-foreground">Clinics</div>
        </div>
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <Star className="h-8 w-8 text-gold mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">4.8</div>
          <div className="text-sm text-muted-foreground">Avg Rating</div>
        </div>
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <Shield className="h-8 w-8 text-emerald mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">100%</div>
          <div className="text-sm text-muted-foreground">Licensed</div>
        </div>
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">60s</div>
          <div className="text-sm text-muted-foreground">Book Online</div>
        </div>
      </div>
    </div>
    
    {/* Treatment Links */}
    {popularTreatments.length > 0 && (
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
          Dental Treatments in {cityName}
        </h2>
        <p className="text-muted-foreground mb-4">
          Find specialists for specific treatments in {cityName}, {stateAbbr}:
        </p>
        <div className="flex flex-wrap gap-2">
          {popularTreatments.slice(0, 8).map((t) => (
            <Link
              key={t.slug}
              to={`/${stateSlug}/${citySlug}/${t.slug}`}
              className="bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              {t.name} in {cityName}
            </Link>
          ))}
        </div>
      </div>
    )}
    
    {/* Nearby Locations */}
    {nearbyLocations.length > 0 && (
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
          Dentists Near {cityName}
        </h2>
        <p className="text-muted-foreground mb-4">
          Explore dental clinics in nearby {stateAbbr} cities:
        </p>
        <div className="flex flex-wrap gap-2">
          {nearbyLocations.map((loc) => (
            <Link
              key={loc.slug}
              to={`/${stateSlug}/${loc.slug}`}
              className="flex items-center gap-1 bg-muted hover:bg-muted/80 rounded-full px-4 py-2 text-sm font-medium transition-colors"
            >
              <MapPin className="h-3 w-3" />
              {loc.name}
            </Link>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Service-Location page fallback content - UNIQUE per treatment+city combo
const ServiceLocationFallbackContent = ({
  cityName,
  stateName,
  stateAbbr,
  stateSlug,
  citySlug,
  treatmentName,
  treatmentSlug,
  clinicCount,
  nearbyLocations,
}: {
  cityName: string;
  stateName: string;
  stateAbbr: string;
  stateSlug: string;
  citySlug: string;
  treatmentName: string;
  treatmentSlug: string;
  clinicCount: number;
  nearbyLocations: { name: string; slug: string }[];
}) => (
  <div className="space-y-10">
    <div className="bg-card border border-border rounded-3xl p-8 md:p-12">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-xs font-bold text-primary uppercase tracking-widest">{treatmentName} Guide</span>
      </div>
      
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        {treatmentName} in {cityName}, {stateAbbr}
      </h2>
      
      <p className="text-lg text-muted-foreground leading-relaxed mb-6">
        Looking for {treatmentName.toLowerCase()} specialists in {cityName}? Our directory features 
        {clinicCount > 0 ? ` ${clinicCount}+` : ''} verified dental professionals in the {cityName}, {stateName} 
        area who offer {treatmentName.toLowerCase()} services. Compare ratings, read patient reviews, 
        and book your appointment online.
      </p>
      
      <p className="text-muted-foreground leading-relaxed mb-6">
        {treatmentName} is a dental procedure that can significantly improve your oral health and smile. 
        {cityName} dentists use the latest techniques and technology to ensure comfortable, effective treatment. 
        Many {cityName} practices accept major dental insurance plans and offer financing options to make 
        {treatmentName.toLowerCase()} affordable.
      </p>
      
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <div className="flex gap-4 items-start">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Experienced Specialists</h3>
            <p className="text-muted-foreground text-sm">
              {cityName} {treatmentName.toLowerCase()} providers have years of specialized training.
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Quality Guaranteed</h3>
            <p className="text-muted-foreground text-sm">
              All {stateAbbr} dentists are licensed and verified for your safety.
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Flexible Payment</h3>
            <p className="text-muted-foreground text-sm">
              Insurance accepted. Payment plans available at most {cityName} clinics.
            </p>
          </div>
        </div>
      </div>
    </div>
    
    {/* Find in nearby cities */}
    {nearbyLocations.length > 0 && (
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
          {treatmentName} in Nearby Cities
        </h2>
        <p className="text-muted-foreground mb-4">
          Find {treatmentName.toLowerCase()} specialists in other {stateAbbr} locations:
        </p>
        <div className="flex flex-wrap gap-2">
          {nearbyLocations.map((loc) => (
            <Link
              key={loc.slug}
              to={`/${stateSlug}/${loc.slug}/${treatmentSlug}`}
              className="flex items-center gap-1 bg-muted hover:bg-muted/80 rounded-full px-4 py-2 text-sm font-medium transition-colors"
            >
              <MapPin className="h-3 w-3" />
              {treatmentName} in {loc.name}
            </Link>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Service page fallback content - UNIQUE per treatment
const ServiceFallbackContent = ({
  treatmentName,
  clinicCount,
}: {
  treatmentName: string;
  clinicCount: number;
}) => (
  <div className="bg-card border border-border rounded-3xl p-8 md:p-12">
    <div className="flex items-center gap-3 mb-6">
      <Sparkles className="h-6 w-6 text-primary" />
      <span className="text-xs font-bold text-primary uppercase tracking-widest">Treatment Info</span>
    </div>
    
    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
      About {treatmentName}
    </h2>
    
    <p className="text-lg text-muted-foreground leading-relaxed mb-6">
      {treatmentName} is a dental procedure designed to improve oral health, function, and aesthetics. 
      Our network includes {clinicCount > 0 ? `${clinicCount}+` : 'numerous'} verified dental professionals 
      across the United States who offer {treatmentName.toLowerCase()} services.
    </p>
    
    <p className="text-muted-foreground leading-relaxed mb-6">
      When considering {treatmentName.toLowerCase()}, it's important to consult with a qualified dental 
      professional who can evaluate your specific needs and recommend the best treatment approach. 
      Costs, duration, and outcomes vary depending on individual circumstances.
    </p>
    
    <div className="grid md:grid-cols-2 gap-6 mt-8">
      <div className="flex gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground mb-1">Benefits</h3>
          <p className="text-muted-foreground text-sm">
            Improved oral health, enhanced smile aesthetics, and long-lasting results with proper care.
          </p>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <HeartPulse className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground mb-1">Safety</h3>
          <p className="text-muted-foreground text-sm">
            Modern techniques and anesthesia ensure comfortable, safe treatment experiences.
          </p>
        </div>
      </div>
    </div>
  </div>
);
