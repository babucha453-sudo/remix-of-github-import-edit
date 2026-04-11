import { memo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildStateUrl, buildCityUrl } from "@/lib/url/buildProfileUrl";

interface LocationCardProps {
  name: string;
  slug: string;
  image?: string;
  dentistCount?: number;
  clinicCount?: number;
  type?: "city" | "area" | "state";
  parentSlug?: string;
  stateSlug?: string;
  stateName?: string;
  stateAbbreviation?: string;
  className?: string;
}

export const LocationCard = ({
  name,
  slug,
  image,
  dentistCount,
  clinicCount,
  type = "city",
  parentSlug,
  stateSlug,
  stateName,
  stateAbbreviation,
  className
}: LocationCardProps) => {
  // Build URL based on type
  const effectiveStateSlug = stateSlug || parentSlug || "";
  const href = type === "state" 
    ? buildStateUrl(slug)
    : buildCityUrl(effectiveStateSlug, slug);
  
  // Display location label
  const locationLabel = type === "state" 
    ? "United States"
    : stateName || stateAbbreviation?.toUpperCase() || "";

  return (
    <Link 
      to={href}
      className={cn(
        "group relative h-64 rounded-3xl overflow-hidden card-hover",
        className
      )}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        {image ? (
          <img 
            src={image} 
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-purple/30" />
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-6 flex flex-col justify-end">
        {locationLabel && (
          <div className="flex items-center gap-2 text-card/80 text-sm mb-2">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">{locationLabel}</span>
          </div>
        )}
        
        <h3 className="font-display text-2xl font-bold text-card group-hover:text-primary transition-colors">
          {name}
        </h3>
        
        <div className="flex items-center gap-4 mt-3">
          {dentistCount !== undefined && (
            <div className="flex items-center gap-1.5 text-card/90 text-sm">
              <Users className="h-4 w-4" />
              <span className="font-medium">{dentistCount} Dentists</span>
            </div>
          )}
          {clinicCount !== undefined && (
            <div className="text-card/90 text-sm font-medium">
              {clinicCount} Clinics
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 mt-4 text-primary font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
          {type === "state" ? "Explore State" : "Explore Area"}
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
};

export const LocationCardMemo = memo(LocationCard);
