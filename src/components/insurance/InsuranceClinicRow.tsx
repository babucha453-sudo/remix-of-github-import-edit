import { Link } from "react-router-dom";
import { 
  Star, 
  MapPin, 
  BadgeCheck, 
  Building2, 
  ArrowRight,
  Shield 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildClinicProfileUrl } from "@/lib/url/buildProfileUrl";

interface ClinicData {
  id: string;
  name: string;
  slug: string;
  rating: number | null;
  review_count: number | null;
  cover_image_url: string | null;
  verification_status: string | null;
  city: {
    name: string;
    slug: string;
    state: {
      abbreviation: string;
    } | null;
  } | null;
  area: {
    name: string;
  } | null;
}

interface InsuranceClinicRowProps {
  clinic: ClinicData;
  insuranceName: string;
}

export function InsuranceClinicRow({ clinic, insuranceName }: InsuranceClinicRowProps) {
  const rating = Number(clinic.rating) || 0;
  const reviewCount = clinic.review_count || 0;
  const location = clinic.area?.name || clinic.city?.name || "";
  const stateAbbr = clinic.city?.state?.abbreviation || "";
  const fullLocation = stateAbbr ? `${location}, ${stateAbbr}` : location;

  return (
    <Link
      to={buildClinicProfileUrl(clinic)}
      className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
    >
      {/* Image */}
      <div className="shrink-0 w-16 h-16 rounded-lg bg-muted overflow-hidden">
        {clinic.cover_image_url ? (
          <img
            src={clinic.cover_image_url}
            alt={clinic.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-teal/10">
            <Building2 className="h-6 w-6 text-primary/40" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {clinic.name}
          </h3>
          {clinic.verification_status === "verified" && (
            <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" />
              <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
              <span>({reviewCount})</span>
            </div>
          )}
          {fullLocation && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{fullLocation}</span>
            </div>
          )}
        </div>
      </div>

      {/* Insurance Badge + Arrow */}
      <div className="shrink-0 flex items-center gap-3">
        <Badge variant="secondary" className="hidden sm:flex rounded-full text-xs">
          <Shield className="h-3 w-3 mr-1" />
          {insuranceName}
        </Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}
