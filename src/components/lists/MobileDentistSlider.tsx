import { Link } from "react-router-dom";
import { Star, MapPin, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Profile } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";

interface MobileDentistSliderProps {
  profiles: Profile[];
  className?: string;
}

export function MobileDentistSlider({ profiles, className }: MobileDentistSliderProps) {
  if (!profiles || profiles.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mobile: Vertical stacked list */}
      <div className="md:hidden space-y-3">
        {profiles.map((profile, index) => (
          <MobileProfileRow 
            key={profile.id} 
            profile={profile} 
            style={{ animationDelay: `${index * 0.03}s` }}
          />
        ))}
      </div>

      {/* Desktop: Stacked list */}
      <div className="hidden md:block space-y-4">
        {profiles.map((profile) => (
          <DesktopProfileCard key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  );
}

function MobileProfileRow({ profile, style }: { profile: Profile; style?: React.CSSProperties }) {
  const profileLink = profile.type === "clinic" ? `/clinic/${profile.slug}` : `/dentist/${profile.slug}`;
  const displayImage = profile.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=0f766e&color=fff&size=100&font-size=0.35&bold=true`;

  return (
    <Link
      to={profileLink}
      className="flex items-center gap-3 bg-muted/50 border border-border rounded-2xl p-3 hover:border-primary/50 transition-all group animate-fade-in-up"
      style={style}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <img
          src={displayImage}
          alt={profile.name}
          className="w-14 h-14 rounded-xl object-cover border-2 border-border"
        />
        {profile.isVerified && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-0.5 rounded-full">
            <CheckCircle className="h-3 w-3" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
          {profile.name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1 text-amber-400">
            <Star className="h-3 w-3 fill-current" />
            <span className="text-xs font-bold">{profile.rating.toFixed(1)}</span>
          </div>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground truncate">{profile.specialty}</span>
        </div>
        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="text-xs truncate">{profile.location}</span>
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </Link>
  );
}

function DesktopProfileCard({ profile }: { profile: Profile }) {
  const profileLink = profile.type === "clinic" ? `/clinic/${profile.slug}` : `/dentist/${profile.slug}`;
  const displayImage = profile.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=0f766e&color=fff&size=200&font-size=0.35&bold=true`;

  return (
    <div className="flex items-center gap-5 bg-muted/50 border border-border rounded-2xl p-4 hover:border-primary/50 transition-all group">
      {/* Photo */}
      <div className="relative shrink-0">
        <img
          src={displayImage}
          alt={profile.name}
          className="h-20 w-20 rounded-2xl object-cover border-3 border-border"
        />
        {profile.isVerified && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1 rounded-full">
            <CheckCircle className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-bold text-primary uppercase tracking-wide">{profile.specialty}</span>
          <div className="flex items-center gap-1 text-amber-400">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="text-sm font-bold">{profile.rating.toFixed(1)}</span>
            {profile.reviewCount > 0 && (
              <span className="text-muted-foreground text-sm">({profile.reviewCount})</span>
            )}
          </div>
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
          {profile.name}
        </h3>
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">{profile.location}</span>
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
          <Link to={profileLink}>
            View Profile
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
