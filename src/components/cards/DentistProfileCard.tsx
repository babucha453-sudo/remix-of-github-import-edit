import { memo } from "react";
import { Link } from "react-router-dom";
import { Star, MapPin, Briefcase, BadgeCheck, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildDentistProfileUrl, buildClinicProfileUrl } from "@/lib/url/buildProfileUrl";

interface DentistProfileCardProps {
  id: string;
  name: string;
  slug: string;
  title?: string;
  photo?: string;
  clinicName?: string;
  clinicSlug?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  experience?: number;
  specialties?: string[];
  isVerified?: boolean;
  isFeatured?: boolean;
  className?: string;
}

export const DentistProfileCard = ({
  name,
  slug,
  title,
  photo,
  clinicName,
  clinicSlug,
  location,
  rating = 0,
  reviewCount = 0,
  experience,
  specialties = [],
  isVerified = false,
  isFeatured = false,
  className
}: DentistProfileCardProps) => {
  const dentistUrl = buildDentistProfileUrl({ slug });
  const clinicUrl = clinicSlug ? buildClinicProfileUrl({ slug: clinicSlug }) : null;

  return (
    <div className={cn(
      "card-modern card-hover group",
      isFeatured && "ring-2 ring-gold/30",
      className
    )}>
      <div className="p-6">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted">
              {photo ? (
                <img 
                  src={photo} 
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple/20 flex items-center justify-center">
                  <span className="text-2xl font-display font-bold text-primary/50">
                    {name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              )}
            </div>
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <BadgeCheck className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link to={dentistUrl}>
                  <h3 className="font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {name}
                  </h3>
                </Link>
                {title && (
                  <p className="text-sm text-muted-foreground font-medium">{title}</p>
                )}
              </div>
              {isFeatured && (
                <Badge className="bg-gold/10 text-gold border-gold/30 rounded-full text-xs font-bold flex-shrink-0">
                  Featured
                </Badge>
              )}
            </div>

            {/* Rating */}
            {rating > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-gold">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-bold text-sm">{rating.toFixed(1)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ({reviewCount} reviews)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 space-y-2">
          {clinicName && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {clinicUrl ? (
                <Link 
                  to={clinicUrl} 
                  className="text-foreground hover:text-primary transition-colors font-medium line-clamp-1"
                >
                  {clinicName}
                </Link>
              ) : (
                <span className="text-foreground font-medium line-clamp-1">{clinicName}</span>
              )}
            </div>
          )}
          
          {location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="line-clamp-1">{location}</span>
            </div>
          )}

          {experience && (
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{experience}+ years</span> experience
            </div>
          )}
        </div>

        {/* Specialties */}
        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {specialties.slice(0, 3).map((spec) => (
              <Badge 
                key={spec} 
                variant="secondary" 
                className="rounded-full text-xs font-medium"
              >
                {spec}
              </Badge>
            ))}
            {specialties.length > 3 && (
              <Badge variant="outline" className="rounded-full text-xs">
                +{specialties.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <Button asChild className="flex-1 rounded-xl font-bold">
            <Link to={dentistUrl}>
              View Profile
            </Link>
          </Button>
          <Button 
            variant="outline" 
            className="rounded-xl font-bold"
            asChild
          >
            <Link to={`${dentistUrl}#book`}>
              <Calendar className="h-4 w-4 mr-2" />
              Book
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export const DentistProfileCardMemo = memo(DentistProfileCard);
