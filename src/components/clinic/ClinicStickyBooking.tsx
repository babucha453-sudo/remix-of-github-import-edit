import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronDown, ChevronUp, Phone, Star, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineBookingCalendar } from "@/components/booking/InlineBookingCalendar";
import { useAnalytics } from "@/hooks/useAnalytics";

interface TeamMember {
  id: string;
  name: string;
  title: string | null;
  professional_type: string;
  image_url: string | null;
  rating: number | null;
  is_primary: boolean;
}

interface ClinicHour {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

interface ClinicStickyBookingProps {
  clinicId: string;
  clinicName: string;
  clinicPhone?: string | null;
  clinicRating?: number | null;
  clinicReviewCount?: number;
  clinicArea?: string | null;
  clinicLatitude?: number;
  clinicLongitude?: number;
  clinicAddress?: string;
  hours?: ClinicHour[];
  teamMembers?: TeamMember[];
  onBookClick?: (dentistId?: string) => void;
  isClaimed?: boolean;
  className?: string;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ClinicStickyBooking({
  clinicId,
  clinicName,
  clinicPhone,
  clinicRating,
  clinicReviewCount = 0,
  clinicArea,
  clinicLatitude,
  clinicLongitude,
  clinicAddress,
  hours = [],
  teamMembers = [],
  isClaimed = false,
  className,
}: ClinicStickyBookingProps) {
  const [showHours, setShowHours] = useState(false);
  const [selectedDentist, setSelectedDentist] = useState<string | undefined>();
  const { trackPhoneClick } = useAnalytics();
  
  const today = new Date().getDay();
  const todayHours = hours.find(h => h.day_of_week === today);
  
  const dentists = teamMembers.filter(m => 
    ['dentist', 'orthodontist', 'endodontist', 'periodontist', 'prosthodontist', 'oral_surgeon', 'pediatric_dentist'].includes(m.professional_type)
  );

  const isOpenNow = () => {
    if (!todayHours || todayHours.is_closed) return false;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return todayHours.open_time && todayHours.close_time && 
           currentTime >= todayHours.open_time && 
           currentTime <= todayHours.close_time;
  };

  const openStatus = isOpenNow();

  return (
    <div className={cn("space-y-4 max-w-full overflow-hidden", className)}>
      {/* Clinic Info Card */}
      <div className="card-modern overflow-hidden max-w-full">
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="font-display font-bold text-base truncate flex-1 min-w-0">📍 {clinicName}</h3>
          </div>
          
          {/* Quick Info */}
          <div className="flex flex-wrap gap-2">
            {clinicRating && clinicRating > 0 && (
              <Badge variant="secondary" className="rounded-full text-xs">
                <Star className="h-3 w-3 mr-1 fill-gold text-gold" />
                {clinicRating.toFixed(1)} ({clinicReviewCount})
              </Badge>
            )}
            {clinicArea && (
              <Badge variant="secondary" className="rounded-full text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                {clinicArea}
              </Badge>
            )}
            {todayHours && (
              <Badge 
                variant={openStatus ? "default" : "secondary"} 
                className={cn(
                  "rounded-full text-xs",
                  openStatus ? "bg-emerald text-white" : ""
                )}
              >
                <Clock className="h-3 w-3 mr-1" />
                {todayHours.is_closed 
                  ? "Closed today" 
                  : openStatus 
                    ? "Open now" 
                    : `Opens ${todayHours.open_time}`
                }
              </Badge>
            )}
          </div>
        </div>

        {/* Select Dentist (if claimed and has team) */}
        {isClaimed && dentists.length > 0 && (
          <div className="p-4 border-b border-border/50">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Choose dentist (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedDentist(undefined)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all",
                  !selectedDentist 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                Any available
              </button>
              
              {dentists.slice(0, 4).map(dentist => (
                <button
                  key={dentist.id}
                  onClick={() => setSelectedDentist(dentist.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all",
                    selectedDentist === dentist.id 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  {dentist.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Call Button */}
        {clinicPhone && isClaimed && (
          <div className="p-4">
            <Button 
              variant="outline"
              className="w-full rounded-xl font-bold"
              asChild
              onClick={() => trackPhoneClick({ clinic_id: clinicId, clinic_name: clinicName, phone_number: clinicPhone })}
            >
              <a href={`tel:${clinicPhone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call Clinic
              </a>
            </Button>
          </div>
        )}

        {/* Hours Accordion */}
        {hours.length > 0 && (
          <div className="border-t border-border/50">
            <button
              onClick={() => setShowHours(!showHours)}
              className="w-full p-3 flex items-center justify-between text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium text-xs">View all hours</span>
              {showHours ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {showHours && (
              <div className="px-4 pb-4 space-y-1 animate-fade-in-up">
                {hours.map((h) => (
                  <div 
                    key={h.day_of_week} 
                    className={cn(
                      "flex justify-between text-xs py-1 px-2 rounded-lg",
                      h.day_of_week === today && "bg-primary/5 font-medium"
                    )}
                  >
                    <span>{dayNames[h.day_of_week]}</span>
                    <span className={h.is_closed ? "text-muted-foreground" : ""}>
                      {h.is_closed ? 'Closed' : `${h.open_time} - ${h.close_time}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline Booking Calendar */}
      <InlineBookingCalendar
        profileId={selectedDentist || clinicId}
        profileName={selectedDentist 
          ? dentists.find(d => d.id === selectedDentist)?.name || clinicName
          : clinicName
        }
        profileType={selectedDentist ? "dentist" : "clinic"}
        clinicId={clinicId}
        clinicLatitude={clinicLatitude}
        clinicLongitude={clinicLongitude}
        clinicAddress={clinicAddress}
      />
    </div>
  );
}
