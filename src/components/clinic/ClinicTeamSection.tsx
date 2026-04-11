import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Star, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Award,
  GraduationCap,
  Languages,
  Stethoscope
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  professional_type: string;
  bio: string | null;
  image_url: string | null;
  years_experience: number | null;
  languages: string[] | null;
  specializations: string[] | null;
  rating: number | null;
  review_count: number | null;
  is_primary: boolean;
}

interface ClinicTeamSectionProps {
  teamMembers: TeamMember[];
  clinicName: string;
  onBookWithDentist: (dentistId: string) => void;
}

const PROFESSIONAL_LABELS: Record<string, string> = {
  dentist: 'General Dentist',
  orthodontist: 'Orthodontist',
  endodontist: 'Endodontist',
  periodontist: 'Periodontist',
  prosthodontist: 'Prosthodontist',
  oral_surgeon: 'Oral Surgeon',
  pediatric_dentist: 'Pediatric Dentist',
  hygienist: 'Dental Hygienist',
  assistant: 'Dental Assistant',
  receptionist: 'Receptionist',
  practice_manager: 'Practice Manager',
};

const SPECIALIST_TYPES = ['dentist', 'orthodontist', 'endodontist', 'periodontist', 'prosthodontist', 'oral_surgeon', 'pediatric_dentist'];

function TeamMemberRow({ 
  member, 
  onBook 
}: { 
  member: TeamMember; 
  onBook: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSpecialist = SPECIALIST_TYPES.includes(member.professional_type);
  
  return (
    <div className="group">
      <div 
        className={cn(
          "flex items-center gap-4 p-4 rounded-xl transition-all",
          expanded ? "bg-muted" : "hover:bg-muted/50"
        )}
      >
        {/* Avatar */}
        <Avatar className="h-14 w-14 border-2 border-background shadow-sm shrink-0">
          <AvatarImage src={member.image_url || undefined} alt={member.name} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-foreground">{member.name}</h4>
            {member.is_primary && (
              <Badge className="bg-gold/10 text-gold border-gold/20 text-xs">
                <Award className="h-3 w-3 mr-1" />
                Lead
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {member.title || PROFESSIONAL_LABELS[member.professional_type] || 'Dentist'}
          </p>
          
          {/* Quick stats row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {member.years_experience && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {member.years_experience}+ yrs
              </span>
            )}
            {member.rating && member.rating > 0 && (
              <span className="text-xs flex items-center gap-1 text-gold">
                <Star className="h-3 w-3 fill-current" />
                {member.rating.toFixed(1)}
              </span>
            )}
            {member.languages && member.languages.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Languages className="h-3 w-3" />
                {member.languages.slice(0, 2).join(', ')}
                {member.languages.length > 2 && '...'}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isSpecialist && (
            <Button 
              size="sm" 
              className="rounded-lg font-medium hidden sm:flex"
              onClick={(e) => {
                e.stopPropagation();
                onBook();
              }}
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              Book
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Expanded Bio */}
      {expanded && (
        <div className="px-4 pb-4 animate-fade-in-up">
          <div className="ml-[4.5rem] space-y-3">
            {member.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {member.bio}
              </p>
            )}
            
            {member.specializations && member.specializations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Specializations</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.specializations.map((spec, i) => (
                    <Badge key={i} variant="secondary" className="text-xs rounded-full">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {isSpecialist && (
              <Button 
                size="sm" 
                className="rounded-lg font-medium sm:hidden w-full"
                onClick={onBook}
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                Book with {member.name.split(' ')[0]}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClinicTeamSection({ 
  teamMembers, 
  clinicName,
  onBookWithDentist 
}: ClinicTeamSectionProps) {
  const specialists = teamMembers.filter(m => SPECIALIST_TYPES.includes(m.professional_type));
  const support = teamMembers.filter(m => !SPECIALIST_TYPES.includes(m.professional_type));

  if (teamMembers.length === 0) {
    return (
      <div className="text-center py-8">
        <Stethoscope className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">
          Team information will be available once the clinic claims their profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Specialists */}
      {specialists.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Dentists & Specialists ({specialists.length})
          </h3>
          <div className="space-y-1">
            {specialists.map(member => (
              <TeamMemberRow 
                key={member.id} 
                member={member}
                onBook={() => onBookWithDentist(member.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Support Staff */}
      {support.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Support Staff ({support.length})
          </h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {support.map(member => (
              <div 
                key={member.id} 
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.image_url || undefined} alt={member.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {PROFESSIONAL_LABELS[member.professional_type] || member.professional_type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
