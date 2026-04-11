import { Link } from "react-router-dom";
import { MapPin, Stethoscope, ArrowRight } from "lucide-react";
import { 
  buildServiceLocationUrl, 
  buildCityUrl, 
  buildServiceUrl, 
  buildDentistProfileUrl 
} from "@/lib/url/buildProfileUrl";

interface InterlinkingSectionProps {
  variant: 'location' | 'service' | 'service-location' | 'dentist' | 'clinic';
  stateSlug?: string;
  currentLocationName?: string;
  currentLocationSlug?: string;
  currentServiceName?: string;
  currentServiceSlug?: string;
  citySlug?: string;
  relatedLocations?: Array<{ name: string; slug: string; parentSlug?: string; stateSlug?: string }>;
  relatedServices?: Array<{ name: string; slug: string }>;
  nearbyDentists?: Array<{ name: string; slug: string }>;
  className?: string;
}

export function InterlinkingSection({
  variant,
  stateSlug = "",
  currentLocationName,
  currentLocationSlug,
  currentServiceName,
  currentServiceSlug,
  citySlug = "",
  relatedLocations = [],
  relatedServices = [],
  nearbyDentists = [],
  className = "",
}: InterlinkingSectionProps) {
  // Use stateSlug if provided, fallback to citySlug for legacy compat
  const effectiveStateSlug = stateSlug || citySlug;

  const renderLocationLinks = () => (
    <>
      {/* Service + Location Links */}
      {relatedServices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Popular Services in {currentLocationName}
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedServices.slice(0, 8).map((service) => (
              <Link
                key={service.slug}
                to={buildServiceLocationUrl(effectiveStateSlug, currentLocationSlug || citySlug, service.slug)}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                {service.name} in {currentLocationName}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Nearby Location Links */}
      {relatedLocations.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Dentists in Nearby Areas
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedLocations.slice(0, 8).map((location) => (
              <Link
                key={location.slug}
                to={buildCityUrl(location.stateSlug || location.parentSlug || effectiveStateSlug, location.slug)}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                Dentist in {location.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderServiceLinks = () => (
    <>
      {/* Service in Locations */}
      {relatedLocations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {currentServiceName} by Location
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedLocations.slice(0, 8).map((location) => (
              <Link
                key={location.slug}
                to={buildServiceLocationUrl(
                  location.stateSlug || location.parentSlug || effectiveStateSlug,
                  location.slug,
                  currentServiceSlug || ""
                )}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                {currentServiceName} in {location.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Related Services */}
      {relatedServices.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Related Dental Services
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedServices.slice(0, 8).map((service) => (
              <Link
                key={service.slug}
                to={buildServiceUrl(service.slug)}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                {service.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderServiceLocationLinks = () => (
    <>
      {/* Other Services in this Location */}
      {relatedServices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            More Services in {currentLocationName}
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedServices.slice(0, 6).map((service) => (
              <Link
                key={service.slug}
                to={buildServiceLocationUrl(effectiveStateSlug, currentLocationSlug || citySlug, service.slug)}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                {service.name} in {currentLocationName}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Same Service in Other Locations */}
      {relatedLocations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {currentServiceName} in Nearby Areas
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedLocations.slice(0, 6).map((location) => (
              <Link
                key={location.slug}
                to={buildServiceLocationUrl(
                  location.stateSlug || location.parentSlug || effectiveStateSlug,
                  location.slug,
                  currentServiceSlug || ""
                )}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                {currentServiceName} in {location.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Parent Links */}
      <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
        <Link
          to={buildServiceUrl(currentServiceSlug || "")}
          className="text-sm font-bold text-primary hover:underline inline-flex items-center gap-1"
        >
          All {currentServiceName} Clinics <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          to={buildCityUrl(effectiveStateSlug, currentLocationSlug || "")}
          className="text-sm font-bold text-primary hover:underline inline-flex items-center gap-1"
        >
          All Dentists in {currentLocationName} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </>
  );

  const renderDentistLinks = () => (
    <>
      {/* Services offered */}
      {relatedServices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Services Offered
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedServices.slice(0, 6).map((service) => (
              <Link
                key={service.slug}
                to={buildServiceUrl(service.slug)}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                {service.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Location link */}
      {currentLocationName && currentLocationSlug && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Location
          </h3>
          <Link
            to={buildCityUrl(effectiveStateSlug, currentLocationSlug)}
            className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all inline-block"
          >
            View all Dentists in {currentLocationName}
          </Link>
        </div>
      )}

      {/* Nearby Dentists */}
      {nearbyDentists.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4">Similar Dentists Nearby</h3>
          <div className="flex flex-wrap gap-2">
            {nearbyDentists.slice(0, 4).map((dentist) => (
              <Link
                key={dentist.slug}
                to={buildDentistProfileUrl(dentist)}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-all"
              >
                {dentist.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={`card-modern p-8 ${className}`}>
      <h2 className="text-xl font-bold text-foreground mb-6">Explore More</h2>
      {variant === 'location' && renderLocationLinks()}
      {variant === 'service' && renderServiceLinks()}
      {variant === 'service-location' && renderServiceLocationLinks()}
      {(variant === 'dentist' || variant === 'clinic') && renderDentistLinks()}
    </div>
  );
}

export default InterlinkingSection;
