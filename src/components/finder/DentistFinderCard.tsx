import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { optimizeImageUrl } from "@/lib/imageUtils";
import { BookingModal } from "@/components/BookingModal";
import {
  Star,
  MapPin,
  CheckCircle,
  Clock,
  Phone,
  Calendar,
  Shield,
  Accessibility,
  Baby,
  Languages,
  ChevronDown,
  ChevronUp,
  Navigation,
  MoreHorizontal
} from "lucide-react";

export interface DentistFinderProfile {
  id: string;
  name: string;
  slug: string;
  type: 'clinic' | 'dentist';
  specialty: string;
  description?: string;
  location: string;
  address?: string;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  reviewCount: number;
  image?: string;
  isVerified: boolean;
  isClaimed: boolean;
  isPinned?: boolean;
  
  // Badges
  acceptsNewPatients?: boolean;
  openNow?: boolean;
  weekendHours?: boolean;
  emergencyCare?: boolean;
  wheelchairAccessible?: boolean;
  childFriendly?: boolean;
  hasBookNow?: boolean;
  
  // Additional
  languages?: string[];
  specialties?: string[];
  insuranceAccepted?: string[];
  gender?: 'male' | 'female';
}

interface DentistFinderCardProps {
  profile: DentistFinderProfile;
  onMarkerClick?: () => void;
  isHighlighted?: boolean;
  className?: string;
}

function getLetterAvatar(name: string): string {
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=10b981&color=fff&size=200&font-size=0.4&bold=true`;
}

export function DentistFinderCard({
  profile,
  onMarkerClick,
  isHighlighted,
  className
}: DentistFinderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  
  const profileLink = profile.type === 'clinic' 
    ? `/clinic/${profile.slug}` 
    : `/dentist/${profile.slug}`;
  
  const displayImage = profile.image || getLetterAvatar(profile.name);
  
  const getDirectionsUrl = () => {
    if (profile.latitude && profile.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${profile.latitude},${profile.longitude}`;
    }
    if (profile.address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(profile.address)}`;
    }
    return null;
  };

  return (
    <>
      <div 
        className={cn(
          "bg-white rounded-2xl border-2 transition-all duration-200 hover:shadow-lg",
          isHighlighted 
            ? "border-emerald-500 shadow-lg ring-2 ring-emerald-100" 
            : "border-slate-200 hover:border-slate-300",
          className
        )}
        onMouseEnter={onMarkerClick}
      >
        <div className="p-4 sm:p-5">
          {/* Header Row */}
          <div className="flex gap-4">
            {/* Image */}
            <div className="relative shrink-0">
              <img
                src={displayImage?.includes('images.unsplash.com') 
                  ? optimizeImageUrl(displayImage, { width: 120, quality: 80 }) 
                  : displayImage}
                alt={profile.name}
                width={96}
                height={96}
                loading="lazy"
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border-2 border-slate-100 shadow-sm"
              />
              {profile.isVerified && (
                <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                  <CheckCircle className="h-3.5 w-3.5" />
                </div>
              )}
              {profile.isPinned && (
                <div className="absolute -top-1.5 -left-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-md">
                  Featured
                </div>
              )}
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              {/* Specialties */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                  {profile.specialty}
                </span>
                {profile.hasBookNow && (
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0">
                    Book Now
                  </Badge>
                )}
              </div>

              {/* Name */}
              <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">
                <Link 
                  to={profileLink} 
                  className="hover:text-emerald-600 transition-colors"
                >
                  {profile.name}
                </Link>
              </h3>

              {/* Location & Rating & Price Estimate */}
              <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="line-clamp-1">{profile.location}</span>
                </div>
                {profile.rating > 0 && (
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span className="font-semibold text-slate-700">{profile.rating.toFixed(1)}</span>
                    {profile.reviewCount > 0 && (
                      <span className="text-slate-400">({profile.reviewCount})</span>
                    )}
                  </div>
                )}
                {/* UX FIX: Add price estimate for transparency */}
                {(profile as any).hasBookNow && (
                  <span className="ml-auto text-emerald-600 font-medium text-xs">
                    From $75
                  </span>
                )}
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap gap-1.5">
                {profile.acceptsNewPatients && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                    <UsersIcon className="h-3 w-3" />
                    New Patients
                  </span>
                )}
                {profile.openNow && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
                    <Clock className="h-3 w-3" />
                    Open Now
                  </span>
                )}
                {profile.weekendHours && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-100">
                    Weekend Hours
                  </span>
                )}
                {profile.emergencyCare && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">
                    Emergency
                  </span>
                )}
                {profile.wheelchairAccessible && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-700 text-xs font-medium rounded-full border border-slate-200">
                    <Accessibility className="h-3 w-3" />
                    Accessible
                  </span>
                )}
                {profile.childFriendly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-50 text-pink-700 text-xs font-medium rounded-full border border-pink-100">
                    <Baby className="h-3 w-3" />
                    Kids
                  </span>
                )}
                {profile.languages && profile.languages.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                    <Languages className="h-3 w-3" />
                    {profile.languages[0]}
                    {profile.languages.length > 1 && `+${profile.languages.length - 1}`}
                  </span>
                )}
                {/* SEO FIX: Add insurance badges - previously missing */}
                {profile.insuranceAccepted && profile.insuranceAccepted.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">
                    <Shield className="h-3 w-3" />
                    {profile.insuranceAccepted.slice(0, 2).join(', ')}
                    {profile.insuranceAccepted.length > 2 && ` +${profile.insuranceAccepted.length - 2}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
              {profile.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                  {profile.description}
                </p>
              )}
              
              {profile.insuranceAccepted && profile.insuranceAccepted.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-slate-500 mb-1 block">Insurance</span>
                  <div className="flex flex-wrap gap-1">
                    {profile.insuranceAccepted.slice(0, 4).map((ins, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-slate-50">
                        {ins}
                      </Badge>
                    ))}
                    {profile.insuranceAccepted.length > 4 && (
                      <Badge variant="outline" className="text-xs bg-slate-50">
                        +{profile.insuranceAccepted.length - 4}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {profile.specialties && profile.specialties.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-slate-500 mb-1 block">Services</span>
                  <div className="flex flex-wrap gap-1">
                    {profile.specialties.slice(0, 4).map((spec, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-100">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-2 text-sm">
                {profile.address && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{profile.address}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <a href={`tel:${profile.phone}`} className="hover:text-emerald-600">
                      {profile.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 pt-3 flex items-center gap-2 border-t border-slate-100">
            <Button
              asChild
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold"
            >
              <Link to={profileLink}>View Profile</Link>
            </Button>
            
            {profile.hasBookNow && (
              <Button
                onClick={() => setShowBooking(true)}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book Now
              </Button>
            )}

            {getDirectionsUrl() && (
              <a
                href={getDirectionsUrl()!}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <Navigation className="h-4 w-4" />
              </a>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBooking && (
        <BookingModal
          open={showBooking}
          onOpenChange={setShowBooking}
          profileId={profile.id}
          profileName={profile.name}
          profileType={profile.type}
        />
      )}
    </>
  );
}

// Simple Users icon to avoid import issues
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}