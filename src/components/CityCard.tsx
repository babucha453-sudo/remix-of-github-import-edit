import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, Users } from "lucide-react";
import { optimizeImageUrl } from "@/lib/imageUtils";

interface CityCardProps {
  name: string;
  image: string;
  slug: string;
  dentistCount?: number;
  clinicCount?: number;
  stateSlug?: string;
}

export const CityCard = forwardRef<HTMLAnchorElement, CityCardProps>(
  ({ name, image, slug, dentistCount = 0, clinicCount = 0, stateSlug = '' }, ref) => {
    // Show clinic count if no dentists, otherwise show dentist count
    const showClinicCount = dentistCount === 0 && clinicCount > 0;
    const displayCount = showClinicCount ? clinicCount : dentistCount;
    const countLabel = showClinicCount ? 'Clinics' : 'Dentists';

    return (
      <Link
        ref={ref}
        to={stateSlug ? `/${stateSlug}/${slug}` : `/${slug}`}
        className="group relative aspect-[4/3] rounded-2xl overflow-hidden block card-hover"
      >
        <img
          src={image?.includes('images.unsplash.com') ? optimizeImageUrl(image, { width: 600, quality: 80 }) : image}
          alt={name}
          width={600}
          height={450}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
        
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="font-display text-xl font-bold text-card mb-1">{name}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-card/80 group-hover:text-primary transition-colors font-semibold">
              Explore City
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            {displayCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-card/80 font-medium">
                {showClinicCount ? <Building2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                {displayCount} {countLabel}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }
);

CityCard.displayName = 'CityCard';