import { Link } from "react-router-dom";
import { 
  Stethoscope, 
  Users, 
  Clock, 
  CreditCard, 
  CheckCircle2,
  MapPin,
  Star,
  Shield,
  Award,
  HeartPulse,
  Building2
} from "lucide-react";

interface LocationSEOContentProps {
  variant: "state" | "city" | "service-location";
  locationName: string;
  stateName?: string;
  stateAbbr?: string;
  stateSlug?: string;
  treatmentName?: string;
  clinicCount?: number;
  cityCount?: number;
  popularTreatments?: { name: string; slug: string }[];
  nearbyLocations?: { name: string; slug: string }[];
}

/**
 * Deep SEO content component for location pages
 * Provides unique, human-written content to help pages rank
 */
export const LocationSEOContent = ({
  variant,
  locationName,
  stateName = "",
  stateAbbr = "",
  stateSlug = "",
  treatmentName = "",
  clinicCount = 0,
  cityCount = 0,
  popularTreatments = [],
  nearbyLocations = [],
}: LocationSEOContentProps) => {
  if (variant === "state") {
    return <StateSEOContent 
      stateName={locationName} 
      stateAbbr={stateAbbr}
      stateSlug={stateSlug}
      clinicCount={clinicCount}
      cityCount={cityCount}
      popularTreatments={popularTreatments}
    />;
  }

  if (variant === "city") {
    return <CitySEOContent 
      cityName={locationName}
      stateName={stateName}
      stateAbbr={stateAbbr}
      stateSlug={stateSlug}
      clinicCount={clinicCount}
      popularTreatments={popularTreatments}
      nearbyLocations={nearbyLocations}
    />;
  }

  return <ServiceLocationSEOContent 
    locationName={locationName}
    stateName={stateName}
    stateAbbr={stateAbbr}
    stateSlug={stateSlug}
    treatmentName={treatmentName}
    clinicCount={clinicCount}
    nearbyLocations={nearbyLocations}
  />;
};

const StateSEOContent = ({
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
  <div className="space-y-12">
    {/* Why Choose Section */}
    <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        Why Choose a Dentist in {stateName}?
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed mb-6">
        {stateName} is home to some of the nation's finest dental professionals. With {clinicCount}+ dental clinics 
        spread across {cityCount} cities, residents have access to world-class oral healthcare. From routine 
        cleanings to advanced cosmetic procedures, {stateName} dentists combine cutting-edge technology with 
        compassionate patient care.
      </p>
      
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Award className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Licensed Professionals</h3>
            <p className="text-muted-foreground text-sm">All dentists are licensed by the {stateName} Board of Dental Examiners and meet strict educational requirements.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Modern Technology</h3>
            <p className="text-muted-foreground text-sm">Access to digital X-rays, 3D imaging, laser dentistry, and same-day crown technology.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Insurance Accepted</h3>
            <p className="text-muted-foreground text-sm">Most clinics accept major dental insurance plans including Delta Dental, Cigna, MetLife, and Aetna.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Flexible Hours</h3>
            <p className="text-muted-foreground text-sm">Evening and weekend appointments available at many locations for your convenience.</p>
          </div>
        </div>
      </div>
    </div>

    {/* Dental Services Section */}
    <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        Dental Services Available in {stateName}
      </h2>
      <p className="text-muted-foreground mb-6">
        {stateName} dental clinics offer comprehensive oral healthcare services for patients of all ages. 
        Whether you need preventive care, restorative treatments, or cosmetic enhancements, you'll find 
        experienced specialists throughout the state.
      </p>
      
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="bg-muted/50 rounded-2xl p-5">
          <HeartPulse className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-bold text-foreground mb-2">Preventive Care</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Regular checkups & cleanings</li>
            <li>• Dental X-rays & exams</li>
            <li>• Fluoride treatments</li>
            <li>• Sealants for children</li>
          </ul>
        </div>
        <div className="bg-muted/50 rounded-2xl p-5">
          <Stethoscope className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-bold text-foreground mb-2">Restorative Dentistry</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Dental fillings & crowns</li>
            <li>• Root canal treatment</li>
            <li>• Dental bridges & implants</li>
            <li>• Dentures & partials</li>
          </ul>
        </div>
        <div className="bg-muted/50 rounded-2xl p-5">
          <Star className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-bold text-foreground mb-2">Cosmetic Dentistry</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Teeth whitening</li>
            <li>• Porcelain veneers</li>
            <li>• Invisalign & braces</li>
            <li>• Smile makeovers</li>
          </ul>
        </div>
      </div>
      
      {popularTreatments.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-foreground mb-4">Popular Treatments in {stateName}:</h3>
          <div className="flex flex-wrap gap-2">
            {popularTreatments.map((treatment) => (
              <Link
                key={treatment.slug}
                to={`/services/${treatment.slug}`}
                className="bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                {treatment.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Tips Section */}
    <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        How to Find the Right Dentist in {stateName}
      </h2>
      <p className="text-muted-foreground mb-6">
        Choosing the right dental provider is an important decision for your oral health. Here are key 
        factors to consider when selecting a dentist in {stateName}:
      </p>
      
      <div className="space-y-4">
        {[
          {
            title: "1. Check Credentials & Experience",
            desc: `Verify that the dentist is licensed in ${stateName} and has experience with the treatments you need. Look for additional certifications in specialty areas like orthodontics or oral surgery.`
          },
          {
            title: "2. Read Patient Reviews",
            desc: "Patient reviews provide valuable insights into the dental experience. Look for consistent positive feedback about bedside manner, wait times, and treatment outcomes."
          },
          {
            title: "3. Consider Location & Hours",
            desc: "Choose a dental office that's convenient to your home or workplace. Many clinics now offer early morning, evening, and Saturday appointments for busy schedules."
          },
          {
            title: "4. Verify Insurance & Payment Options",
            desc: "Confirm that the dentist accepts your insurance plan. Many offices also offer payment plans, membership programs for uninsured patients, and accept CareCredit."
          },
          {
            title: "5. Visit for a Consultation",
            desc: "Schedule an initial consultation to meet the dentist, tour the facility, and discuss your oral health goals. This helps ensure you feel comfortable with your choice."
          }
        ].map((item, i) => (
          <div key={i} className="flex gap-4 items-start">
            <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
              <p className="text-muted-foreground text-sm">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CitySEOContent = ({
  cityName,
  stateName,
  stateAbbr,
  stateSlug,
  clinicCount,
  popularTreatments,
  nearbyLocations,
}: {
  cityName: string;
  stateName: string;
  stateAbbr: string;
  stateSlug: string;
  clinicCount: number;
  popularTreatments: { name: string; slug: string }[];
  nearbyLocations: { name: string; slug: string }[];
}) => (
  <div className="space-y-10">
    {/* Main Content */}
    <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        About Dental Care in {cityName}, {stateAbbr}
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed mb-6">
        {cityName} residents have access to {clinicCount}+ dental clinics offering comprehensive oral healthcare 
        services. From family dentistry to specialized treatments, {cityName}'s dental professionals are 
        committed to helping you achieve and maintain a healthy smile.
      </p>
      <p className="text-muted-foreground leading-relaxed mb-6">
        Whether you're looking for routine preventive care, emergency dental services, or cosmetic 
        enhancements, you'll find qualified professionals in {cityName} ready to meet your needs. Many 
        local clinics use the latest dental technology including digital X-rays, intraoral cameras, 
        and CAD/CAM systems for same-day restorations.
      </p>
      
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">{clinicCount}+</div>
          <div className="text-sm text-muted-foreground">Dental Clinics</div>
        </div>
        <div className="bg-muted/50 rounded-2xl p-4 text-center">
          <Star className="h-8 w-8 text-gold mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">4.8</div>
          <div className="text-sm text-muted-foreground">Avg. Rating</div>
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

    {/* Services Section */}
    <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        Dental Services in {cityName}
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            General & Preventive
          </h3>
          <ul className="text-muted-foreground space-y-2 ml-7">
            <li>• Comprehensive dental exams</li>
            <li>• Professional teeth cleaning</li>
            <li>• Dental fillings & sealants</li>
            <li>• Gum disease treatment</li>
            <li>• Oral cancer screenings</li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Cosmetic & Specialty
          </h3>
          <ul className="text-muted-foreground space-y-2 ml-7">
            <li>• Teeth whitening treatments</li>
            <li>• Porcelain veneers & bonding</li>
            <li>• Invisalign & orthodontics</li>
            <li>• Dental implants & crowns</li>
            <li>• Full smile makeovers</li>
          </ul>
        </div>
      </div>
      
      {popularTreatments.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="font-bold text-foreground mb-4">Find Specialists by Treatment:</h3>
          <div className="flex flex-wrap gap-2">
            {popularTreatments.slice(0, 8).map((treatment) => (
              <Link
                key={treatment.slug}
                to={stateSlug ? `/${stateSlug}/${treatment.slug}` : `/services/${treatment.slug}`}
                className="bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                {treatment.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* What to Expect Section */}
    <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        What to Expect at a {cityName} Dental Visit
      </h2>
      <p className="text-muted-foreground mb-6">
        First-time patients can expect a welcoming experience at {cityName} dental offices. Here's what 
        typically happens during your visit:
      </p>
      
      <div className="space-y-4">
        <div className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">1</div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Check-in & Paperwork</h3>
            <p className="text-muted-foreground text-sm">Complete your medical history forms and provide insurance information. Many offices offer online pre-registration.</p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">2</div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Comprehensive Examination</h3>
            <p className="text-muted-foreground text-sm">Your dentist will perform a thorough oral exam, take X-rays if needed, and check for any signs of decay or disease.</p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">3</div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Discuss Treatment Options</h3>
            <p className="text-muted-foreground text-sm">Your dentist will explain findings, discuss treatment options, and answer any questions you have about your oral health.</p>
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">4</div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Schedule Follow-Up</h3>
            <p className="text-muted-foreground text-sm">Book your next appointment and any necessary treatments before you leave. Most offices send appointment reminders.</p>
          </div>
        </div>
      </div>
    </div>

    {/* Nearby Locations */}
    {nearbyLocations.length > 0 && (
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
          Nearby Locations
        </h2>
        <p className="text-muted-foreground mb-4">
          Can't find what you're looking for in {cityName}? Browse dentists in nearby cities:
        </p>
        <div className="flex flex-wrap gap-2">
          {nearbyLocations.map((location) => (
            <Link
              key={location.slug}
              to={`/${stateSlug}/${location.slug}`}
              className="bg-muted hover:bg-muted/80 text-foreground rounded-full px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1"
            >
              <MapPin className="h-3 w-3" />
              {location.name}
            </Link>
          ))}
        </div>
      </div>
    )}
  </div>
);

const ServiceLocationSEOContent = ({
  locationName,
  stateName,
  stateAbbr,
  stateSlug,
  treatmentName,
  clinicCount,
  nearbyLocations,
}: {
  locationName: string;
  stateName: string;
  stateAbbr: string;
  stateSlug: string;
  treatmentName: string;
  clinicCount: number;
  nearbyLocations: { name: string; slug: string }[];
}) => {
  const treatmentLower = treatmentName.toLowerCase();
  
  return (
    <div className="space-y-10">
      {/* Treatment Details */}
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          About {treatmentName} in {locationName}, {stateAbbr}
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed mb-6">
          Looking for {treatmentLower} services in {locationName}? Our network of {clinicCount}+ 
          verified dental clinics includes specialists who excel in providing top-quality {treatmentLower} 
          treatments. Whether you're a new patient or seeking a second opinion, you'll find experienced 
          professionals dedicated to your oral health.
        </p>
        
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <div className="bg-muted/50 rounded-2xl p-5">
            <Users className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-bold text-foreground mb-2">Experienced Specialists</h3>
            <p className="text-sm text-muted-foreground">
              Our {treatmentLower} specialists have years of experience and stay current with the latest 
              techniques and technology in dental care.
            </p>
          </div>
          <div className="bg-muted/50 rounded-2xl p-5">
            <Shield className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-bold text-foreground mb-2">Quality Guaranteed</h3>
            <p className="text-sm text-muted-foreground">
              All dentists are licensed in {stateName} and verified on our platform. Many offer 
              satisfaction guarantees on their work.
            </p>
          </div>
        </div>
      </div>

      {/* What to Know Section */}
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          What to Know Before Getting {treatmentName}
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-foreground mb-2">Consultation Process</h3>
            <p className="text-muted-foreground">
              Most {treatmentLower} treatments begin with a thorough consultation. Your dentist will 
              examine your teeth, discuss your goals, and create a personalized treatment plan. Many 
              clinics in {locationName} offer free or low-cost initial consultations.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-2">Treatment Timeline</h3>
            <p className="text-muted-foreground">
              The duration of {treatmentLower} treatment varies based on your specific needs. Some 
              procedures can be completed in a single visit, while others may require multiple 
              appointments over several weeks or months.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-2">Cost & Payment Options</h3>
            <p className="text-muted-foreground">
              {treatmentName} costs in {locationName} depend on the complexity of your case and the 
              dentist you choose. Many practices accept dental insurance, offer payment plans, or 
              accept financing options like CareCredit to make treatment affordable.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-2">Aftercare & Maintenance</h3>
            <p className="text-muted-foreground">
              Proper aftercare is essential for long-lasting results. Your dentist will provide specific 
              instructions and schedule follow-up appointments to ensure your treatment is successful.
            </p>
          </div>
        </div>
      </div>

      {/* Why Choose Local Section */}
      <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          Why Choose a {locationName} {treatmentName} Specialist?
        </h2>
        <ul className="space-y-3">
          {[
            `Convenient location for follow-up appointments and ongoing care`,
            `Familiarity with local dental insurance networks and coverage`,
            `Strong community reputation and accessible patient reviews`,
            `Emergency availability when you need urgent care`,
            `Personalized care from professionals who know your dental history`
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Nearby Locations */}
      {nearbyLocations.length > 0 && (
        <div className="bg-card border border-border rounded-3xl p-8 md:p-10">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
            {treatmentName} in Nearby Cities
          </h2>
          <p className="text-muted-foreground mb-4">
            Explore {treatmentLower} specialists in other {stateName} cities:
          </p>
          <div className="flex flex-wrap gap-2">
            {nearbyLocations.map((location) => (
              <Link
                key={location.slug}
                to={`/${stateSlug}/${location.slug}/${treatmentName.toLowerCase().replace(/\s+/g, '-')}`}
                className="bg-muted hover:bg-muted/80 text-foreground rounded-full px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1"
              >
                <MapPin className="h-3 w-3" />
                {treatmentName} in {location.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSEOContent;
