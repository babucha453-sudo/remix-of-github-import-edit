import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  Trash2,
  Crown,
  Stethoscope,
  UserCheck,
  GraduationCap,
  Phone,
  Award,
  Building2,
  Users,
  Star,
} from 'lucide-react';

const PROFESSIONAL_TYPES_CONFIG = [
  { value: 'dentist', label: 'Dentist', icon: Stethoscope, color: 'bg-primary/10 text-primary' },
  { value: 'orthodontist', label: 'Orthodontist', icon: Award, color: 'bg-purple-light text-purple' },
  { value: 'endodontist', label: 'Endodontist', icon: Award, color: 'bg-coral-light text-coral' },
  { value: 'periodontist', label: 'Periodontist', icon: Award, color: 'bg-blue-light text-blue-custom' },
  { value: 'prosthodontist', label: 'Prosthodontist', icon: Award, color: 'bg-gold-light text-gold' },
  { value: 'oral_surgeon', label: 'Oral Surgeon', icon: Award, color: 'bg-teal-light text-teal' },
  { value: 'pediatric_dentist', label: 'Pediatric Dentist', icon: Award, color: 'bg-pink-100 text-pink-600' },
  { value: 'hygienist', label: 'Dental Hygienist', icon: UserCheck, color: 'bg-teal-light text-teal' },
  { value: 'assistant', label: 'Dental Assistant', icon: Users, color: 'bg-blue-light text-blue-custom' },
  { value: 'receptionist', label: 'Receptionist', icon: Phone, color: 'bg-gold-light text-gold' },
  { value: 'practice_manager', label: 'Practice Manager', icon: Building2, color: 'bg-purple-light text-purple' },
];

export interface TeamMember {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  professional_type: string;
  is_primary: boolean;
  license_number: string | null;
  department: string | null;
  image_url: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  specializations: string[] | null;
  languages: string[] | null;
  years_experience: number | null;
  rating: number | null;
  review_count: number | null;
  is_active: boolean;
}

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (id: string) => void;
}

export function TeamMemberCard({ member, onEdit, onDelete }: TeamMemberCardProps) {
  const getTypeInfo = (type: string) => {
    return PROFESSIONAL_TYPES_CONFIG.find(t => t.value === type) || PROFESSIONAL_TYPES_CONFIG[0];
  };

  const typeInfo = getTypeInfo(member.professional_type);
  const TypeIcon = typeInfo.icon;
  
  return (
    <Card className="card-modern overflow-hidden group">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={member.image_url || undefined} alt={member.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            {member.is_primary && (
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gold flex items-center justify-center">
                <Crown className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground truncate">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.title || typeInfo.label}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(member)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(member.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`${typeInfo.color} border-0 text-xs`}>
                <TypeIcon className="h-3 w-3 mr-1" />
                {typeInfo.label}
              </Badge>
              {member.years_experience && (
                <Badge variant="secondary" className="text-xs">
                  <GraduationCap className="h-3 w-3 mr-1" />
                  {member.years_experience}y exp
                </Badge>
              )}
            </div>
            
            {(member.rating || 0) > 0 && (
              <div className="flex items-center gap-1 mt-2 text-sm">
                <Star className="h-3.5 w-3.5 text-gold fill-gold" />
                <span className="font-medium">{Number(member.rating).toFixed(1)}</span>
                <span className="text-muted-foreground">({member.review_count || 0})</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
