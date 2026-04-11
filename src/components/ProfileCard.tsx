import { Star, MapPin, CheckCircle, Clock, Building2, ChevronRight, Calendar, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Profile } from "@/hooks/useProfiles";
import { useState } from "react";
import { MultiStepBookingModal } from "./MultiStepBookingModal";
import { Badge } from "@/components/ui/badge";
import { optimizeImageUrl } from "@/lib/imageUtils";

interface ProfileCardProps {
  profile: Profile;
  variant?: "list" | "compact" | "elite";
}

// Generate letter avatar with first letter of clinic/dentist name
function getLetterAvatar(name: string): string {
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0f766e&color=fff&size=200&font-size=0.4&bold=true`;
}

export function ProfileCard({ profile, variant = "list" }: ProfileCardProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  
  const profileLink = profile.type === 'clinic' 
    ? `/clinic/${profile.slug}` 
    : `/dentist/${profile.slug}`;

  // Use letter avatar if no image available - shows first letter of name
  const displayImage = profile.image || getLetterAvatar(profile.name);
  const hasRealImage = !!profile.image;

  // List variant - horizontal card for search results (mobile-optimized)
  if (variant === "list") {
    return (
      <>
        {/* Mobile: Compact stacked card */}
        <div className="doctor-list-card group md:hidden">
          <div className="flex items-start gap-3">
            {/* Photo - smaller on mobile */}
            <div className="relative shrink-0">
              <img
                src={displayImage?.includes('images.unsplash.com') ? optimizeImageUrl(displayImage, { width: 128, quality: 80 }) : displayImage}
                alt={profile.name}
                width={64}
                height={64}
                loading="lazy"
                className="h-16 w-16 rounded-xl object-cover border-2 border-card shadow-md bg-muted"
              />
              {profile.isVerified && (
                <div className="absolute -bottom-1 -right-1 bg-card text-primary p-1 rounded-full shadow-md border border-border">
                  <CheckCircle className="h-3.5 w-3.5 fill-primary/20" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {profile.isPinned && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
                    <Pin className="h-2.5 w-2.5 mr-0.5" />
                    Featured
                  </Badge>
                )}
                <span className="text-xs font-bold text-primary uppercase tracking-wide">{profile.specialty}</span>
                <div className="flex items-center gap-0.5 text-gold">
                  <Star className="h-3 w-3 fill-current" />
                  <span className="text-xs font-bold">{profile.rating.toFixed(1)}</span>
                </div>
              </div>
              
              <h3 className="font-bold text-foreground text-base leading-tight mb-1 line-clamp-1">{profile.name}</h3>
              
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <MapPin className="h-3 w-3 text-primary/50" />
                <span className="truncate">{profile.location}</span>
              </div>
            </div>
          </div>
          
          {/* Mobile action buttons - full width */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold text-xs h-9" asChild>
              <Link to={profileLink}>
                View Profile
              </Link>
            </Button>
            <Button 
              size="sm" 
              className="flex-1 rounded-xl font-bold text-xs h-9 bg-foreground text-background hover:bg-primary"
              onClick={() => setBookingOpen(true)}
            >
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Book
            </Button>
          </div>
        </div>

        {/* Desktop: Full horizontal card */}
        <div className="doctor-list-card group hidden md:flex">
          {/* Photo */}
          <div className="relative shrink-0">
            <img
              src={displayImage?.includes('images.unsplash.com') ? optimizeImageUrl(displayImage, { width: 192, quality: 80 }) : displayImage}
              alt={profile.name}
              width={112}
              height={112}
              loading="lazy"
              className="h-24 w-24 md:h-28 md:w-28 rounded-[1.5rem] object-cover border-4 border-card shadow-lg bg-muted"
            />
            {profile.isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-card text-primary p-1.5 rounded-full shadow-lg border border-border">
                <CheckCircle className="h-5 w-5 fill-primary/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              {profile.isPinned && (
                <Badge variant="outline" className="text-xs py-0.5 px-2 bg-primary/10 text-primary border-primary/30">
                  <Pin className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              )}
              <span className="badge-brand">{profile.specialty}</span>
              <div className="badge-amber">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="text-data">{profile.rating.toFixed(1)}</span>
                {profile.reviewCount > 0 && (
                  <span className="font-medium">({profile.reviewCount} reviews)</span>
                )}
              </div>
            </div>
            
            <h3 className="text-data text-xl md:text-2xl text-foreground mb-2 tracking-tight">{profile.name}</h3>
            
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {profile.clinicName && profile.type === 'dentist' && (
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-primary/50" />
                  {profile.clinicName}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4 text-primary/50" />
                {profile.location}
              </span>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="flex flex-col items-end gap-4 shrink-0 border-l border-border pl-6 ml-2">
            <div className="grid grid-cols-2 gap-4 text-right">
              <div>
                <p className="text-micro mb-1">Next Available</p>
                <p className="text-data text-foreground">Today</p>
              </div>
              <div>
                <p className="text-micro mb-1">Type</p>
                <p className="text-data text-primary capitalize">{profile.type}</p>
              </div>
            </div>
            
            {profile.languages && profile.languages.length > 0 && (
              <div>
                <p className="text-micro mb-1">Languages</p>
                <p className="text-sm font-bold text-foreground">{profile.languages.slice(0, 3).join(', ')}</p>
              </div>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" className="rounded-xl font-bold" asChild>
                <Link to={profileLink}>
                  Profile <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button 
                size="sm" 
                className="rounded-xl font-bold bg-foreground text-background hover:bg-primary"
                onClick={() => setBookingOpen(true)}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Book Now
              </Button>
            </div>
          </div>
        </div>

        <MultiStepBookingModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          profileId={profile.id}
          profileName={profile.name}
          profileType={profile.type}
          clinicId={profile.clinicId}
        />
      </>
    );
  }

  // Elite variant - for dark background carousel
  if (variant === "elite") {
    return (
      <>
        <div className="relative bg-card rounded-[2rem] overflow-hidden min-w-[260px] max-w-[260px] card-hover group border border-border/50">
          {/* Image */}
          <div className="relative aspect-[3/4] overflow-hidden bg-muted">
            <img
              src={displayImage}
              alt={profile.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <div className="badge-amber">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="text-data text-sm">{profile.rating.toFixed(1)}</span>
              </div>
              {profile.isVerified && (
                <div className="badge-verified">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </div>
              )}
            </div>
            {/* Specialty badge */}
            <div className="absolute bottom-3 left-3">
              <span className="badge-brand">
                {profile.specialty}
              </span>
            </div>
          </div>
          {/* Content */}
          <div className="p-5">
            <h3 className="text-data text-lg text-foreground mb-1 truncate">{profile.name}</h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
              <MapPin className="h-4 w-4 text-primary/50" />
              <span className="font-medium">{profile.location}</span>
            </div>
            <div className="flex gap-2">
              <Link to={profileLink} className="flex-1">
                <Button variant="outline" size="sm" className="w-full rounded-xl font-bold">
                  View Profile
                </Button>
              </Link>
              <Button 
                size="sm" 
                className="rounded-xl font-bold"
                onClick={() => setBookingOpen(true)}
              >
                Book
              </Button>
            </div>
          </div>
        </div>

        <MultiStepBookingModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          profileId={profile.id}
          profileName={profile.name}
          profileType={profile.type}
          clinicId={profile.clinicId}
        />
      </>
    );
  }

  // Compact variant (default) - for grid displays
  return (
    <>
      <div className="group bg-card rounded-[2rem] border border-border overflow-hidden card-hover">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={displayImage}
            alt={profile.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="badge-amber">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-data text-sm">{profile.rating.toFixed(1)}</span>
            </div>
            {profile.isVerified && (
              <div className="badge-verified">
                <CheckCircle className="h-3 w-3" />
                Verified
              </div>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <span className="badge-brand">
              {profile.specialty}
            </span>
          </div>
        </div>
        <div className="p-5">
          <h3 className="text-data text-lg text-foreground mb-1">{profile.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <MapPin className="h-4 w-4 text-primary/50" />
            <span className="font-medium">{profile.location}</span>
          </div>
          <div className="flex gap-2">
            <Link to={profileLink} className="flex-1">
              <Button variant="outline" size="sm" className="w-full rounded-xl font-bold">
                View Profile
              </Button>
            </Link>
            <Button 
              size="sm" 
              className="rounded-xl font-bold"
              onClick={() => setBookingOpen(true)}
            >
              Book
            </Button>
          </div>
        </div>
      </div>

      <MultiStepBookingModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        profileId={profile.id}
        profileName={profile.name}
        profileType={profile.type}
        clinicId={profile.clinicId}
      />
    </>
  );
}
