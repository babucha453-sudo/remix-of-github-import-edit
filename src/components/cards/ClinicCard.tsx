import { memo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Star, BadgeCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LazyImage } from "@/components/common/LazyImage";

interface ClinicCardProps {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  isFeatured?: boolean;
  coverImage?: string;
  services?: string[];
  className?: string;
}

export const ClinicCard = ({
  name,
  slug,
  address,
  phone,
  rating = 0,
  reviewCount = 0,
  isVerified = false,
  isFeatured = false,
  coverImage,
  services = [],
  className
}: ClinicCardProps) => {
  return (
    <div className={cn(
      "card-modern card-hover group",
      isFeatured && "ring-2 ring-primary/30",
      className
    )}>
      <div className="relative h-48 bg-muted overflow-hidden">
        {coverImage ? (
          <LazyImage 
            src={coverImage} 
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            width={400}
            height={192}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple/20 flex items-center justify-center">
            <span className="text-4xl font-display font-bold text-primary/50">
              {name.charAt(0)}
            </span>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isVerified && (
            <Badge className="bg-primary text-primary-foreground rounded-full px-3 py-1 font-bold">
              <BadgeCheck className="h-3.5 w-3.5 mr-1" />
              Verified
            </Badge>
          )}
          {isFeatured && (
            <Badge className="bg-gold text-gold-foreground rounded-full px-3 py-1 font-bold">
              Featured
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <Link to={`/clinic/${slug}`}>
          <h3 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {name}
          </h3>
        </Link>

        {/* Rating */}
        {rating > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-gold">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-bold">{rating.toFixed(1)}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              ({reviewCount} reviews)
            </span>
          </div>
        )}

        {/* Address */}
        {address && (
          <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{address}</span>
          </div>
        )}

        {/* Services */}
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {services.slice(0, 3).map((service) => (
              <Badge 
                key={service} 
                variant="secondary" 
                className="rounded-full text-xs font-medium"
              >
                {service}
              </Badge>
            ))}
            {services.length > 3 && (
              <Badge variant="outline" className="rounded-full text-xs">
                +{services.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <Button asChild className="flex-1 rounded-xl font-bold">
            <Link to={`/clinic/${slug}`}>
              View Clinic
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ClinicCardMemo = memo(ClinicCard);
