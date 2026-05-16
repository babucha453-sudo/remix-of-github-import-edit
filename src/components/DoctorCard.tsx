import { useState, forwardRef } from "react";
import { Star, MapPin, CheckCircle, Clock, Building2, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LazyImage } from "@/components/common/LazyImage";
import { buildDentistProfileUrl, buildClinicProfileUrl } from "@/lib/url/buildProfileUrl";
import dynamic from "next/dynamic";

const MultiStepBookingModal = dynamic(() => import("@/components/MultiStepBookingModal").then(mod => mod.MultiStepBookingModal));

interface DoctorCardProps {
  id?: string;
  name: string;
  specialty: string;
  clinic?: string;
  clinicId?: string;
  location: string;
  rating: number;
  image: string;
  verified?: boolean;
  languages?: string[];
  price?: number;
  variant?: "compact" | "mini" | "full" | "elite" | "list" | "homepage";
  slug?: string;
  type?: 'dentist' | 'clinic';
  nextAvailable?: string;
  reviewCount?: number;
}

export const DoctorCard = forwardRef<HTMLDivElement, DoctorCardProps>(({
  id,
  name,
  specialty,
  clinic,
  clinicId,
  location,
  rating,
  image,
  verified = false,
  languages = ["English"],
  price,
  variant = "compact",
  slug,
  type = 'dentist',
  nextAvailable = "Today",
  reviewCount = 0,
}, ref) => {
  const [bookingOpen, setBookingOpen] = useState(false);

  // Use centralized URL builders
  const profileLink = slug
    ? (type === 'clinic' ? buildClinicProfileUrl({ slug }) : buildDentistProfileUrl({ slug }))
    : "/search/";

  const handleBookNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBookingOpen(true);
  };

  // Homepage variant - immersive larger cards for carousel
  if (variant === "homepage") {
    return (
      <div className="relative bg-card rounded-[2.5rem] overflow-hidden min-w-[280px] max-w-[280px] card-hover group border border-border/50 shadow-md">
        <Link to={profileLink} className="block relative aspect-[3/4] overflow-hidden">
          <LazyImage
            src={image}
            alt={name}
            className="h-full w-full object-cover"
            width={280}
            height={373}
            priority
          />

          {/* Top Badges */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="badge-amber bg-white border-none shadow-sm">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-sm font-bold">{rating}</span>
            </div>
            {verified && (
              <div className="bg-primary p-1.5 rounded-full shadow-sm">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
            )}
          </div>

          {/* Bottom Info Overlay */}
          <div className="absolute inset-x-0 bottom-0 p-4 pt-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
            <div className="bg-black/50 rounded-2xl p-4 border border-white/10">
              <h3 className="text-base font-bold text-white truncate mb-0.5">{name}</h3>
              <p className="text-xs text-primary-foreground font-bold truncate opacity-90 mb-2">{specialty}</p>

              <div className="flex items-center justify-between gap-2 mt-auto">
                <div className="flex items-center gap-1.5 text-xs text-white/70 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{location}</span>
                </div>
                <div className="shrink-0 bg-primary/20 p-1.5 rounded-lg border border-primary/30">
                  <ArrowRight className="h-3.5 w-3.5 text-primary group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }


  // Elite variant - for dark background carousel
  if (variant === "elite") {
    return (
      <>
        <div className="relative bg-card rounded-[2rem] overflow-hidden min-w-[260px] max-w-[260px] card-hover group border border-border/50">
          {/* Image */}
          <div className="relative aspect-[3/4] overflow-hidden bg-muted">
            <LazyImage
              src={image}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              width={260}
              height={347}
            />
            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <div className="badge-amber">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="text-data text-sm">{rating}</span>
              </div>
              {verified && (
                <div className="badge-verified">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </div>
              )}
            </div>
            {/* Specialty badge */}
            <div className="absolute bottom-3 left-3">
              <span className="badge-brand">
                {specialty}
              </span>
            </div>
          </div>
          {/* Content */}
          <div className="p-5">
            <h3 className="text-data text-lg text-foreground mb-1 truncate">{name}</h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
              <MapPin className="h-4 w-4 text-primary/50" />
              <span className="font-medium">{location}</span>
            </div>
            <div className="flex gap-2">
              <Link to={profileLink} className="flex-1">
                <Button variant="outline" size="sm" className="w-full rounded-xl font-bold">
                  View Profile
                </Button>
              </Link>
              <Button size="sm" className="rounded-xl font-bold" onClick={handleBookNow}>
                Book
              </Button>
            </div>
          </div>
        </div>

        {id && (
          <MultiStepBookingModal
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            profileId={id}
            profileName={name}
            profileType={type}
            clinicId={clinicId}
          />
        )}
      </>
    );
  }

  // List variant - horizontal card for search results
  if (variant === "list" || variant === "full") {
    return (
      <>
        <div className="doctor-list-card group">
          <div className="relative shrink-0 bg-muted rounded-[1.5rem]">
            <LazyImage
              src={image}
              alt={name}
              className="h-24 w-24 md:h-28 md:w-28 rounded-[1.5rem] object-cover border-4 border-white shadow-lg"
              width={112}
              height={112}
            />
            {verified && (
              <div className="absolute -bottom-1 -right-1 bg-white text-primary p-1.5 rounded-full shadow-lg border border-border">
                <CheckCircle className="h-5 w-5 fill-primary/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="badge-brand">{specialty}</span>
              <div className="badge-amber">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="text-data">{rating}</span>
                {reviewCount > 0 && (
                  <span className="font-medium">({reviewCount} verified reviews)</span>
                )}
              </div>
            </div>

            <h3 className="text-data text-xl md:text-2xl text-foreground mb-2 tracking-tight">{name}</h3>

            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {clinic && (
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-primary/50" />
                  {clinic}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4 text-primary/50" />
                {location}
              </span>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="flex flex-col items-end gap-4 shrink-0 border-l border-border pl-6 ml-2">
            <div className="grid grid-cols-2 gap-4 text-right">
              <div>
                <p className="text-micro mb-1">Next Available</p>
                <p className="text-data text-foreground">{nextAvailable}</p>
              </div>
              {price && (
                <div>
                  <p className="text-micro mb-1">Consultation Fee</p>
                  <p className="text-data text-primary">${price}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-micro mb-1">Fluent Languages</p>
              <p className="text-sm font-bold text-foreground">{languages.join(', ')}</p>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" className="rounded-xl font-bold" asChild>
                <Link to={profileLink}>
                  Profile <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button size="sm" className="rounded-xl font-bold bg-foreground text-background hover:bg-primary" onClick={handleBookNow}>
                Book Now
              </Button>
            </div>
          </div>
        </div>

        {id && (
          <MultiStepBookingModal
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            profileId={id}
            profileName={name}
            profileType={type}
            clinicId={clinicId}
          />
        )}
      </>
    );
  }

  // Mini variant for carousel
  if (variant === "mini") {
    return (
      <Link
        to={profileLink}
        className="group flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:shadow-lg hover:border-primary/30 transition-all duration-300 min-w-[260px]"
      >
        <div className="relative shrink-0 bg-muted rounded-lg">
          <LazyImage
            src={image}
            alt={name}
            className="h-12 w-12 rounded-lg object-cover ring-2 ring-border group-hover:ring-primary/40 transition-all"
            width={48}
            height={48}
          />
          {verified && (
            <CheckCircle className="absolute -bottom-1 -right-1 h-4 w-4 text-primary fill-card" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-data text-sm text-foreground truncate">{name}</h4>
          <p className="text-micro text-primary truncate">{specialty}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="text-data text-xs">{rating}</span>
            </div>
            <span className="text-xs text-muted-foreground truncate">{location}</span>
          </div>
        </div>
      </Link>
    );
  }

  // Compact variant (default) - for grid displays
  return (
    <>
      <div className="group bg-card rounded-[2rem] border border-border overflow-hidden card-hover">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <LazyImage
            src={image}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            width={320}
            height={240}
          />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="badge-amber">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-data text-sm">{rating}</span>
            </div>
            {verified && (
              <div className="badge-verified">
                <CheckCircle className="h-3 w-3" />
                Verified
              </div>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <span className="badge-brand">
              {specialty}
            </span>
          </div>
        </div>
        <div className="p-5">
          <h3 className="text-data text-lg text-foreground mb-1">{name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <MapPin className="h-4 w-4 text-primary/50" />
            <span className="font-medium">{location}</span>
          </div>
          <div className="flex gap-2">
            <Link to={profileLink} className="flex-1">
              <Button variant="outline" size="sm" className="w-full rounded-xl font-bold">
                View Profile
              </Button>
            </Link>
            <Button size="sm" className="rounded-xl font-bold" onClick={handleBookNow}>
              Book
            </Button>
          </div>
        </div>
      </div>

      {id && (
        <MultiStepBookingModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          profileId={id}
          profileName={name}
          profileType={type}
          clinicId={clinicId}
        />
      )}
    </>
  );
});

DoctorCard.displayName = 'DoctorCard';
