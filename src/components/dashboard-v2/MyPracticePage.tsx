/**
 * My Practice Page v2
 * Clinic identity, performance snapshot, and integrations status
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Users,
  Star,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Edit,
  ArrowRight,
  Shield,
  Calendar,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PremiumCard,
  SectionHeader,
  StatusBadge,
  SkeletonCard,
  EmptyState,
  PageHeader,
} from './DesignSystem';
import { cn } from '@/lib/utils';

interface MyPracticePageProps {
  onNavigate: (tab: string) => void;
}

// Day name mapping
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function MyPracticePage({ onNavigate }: MyPracticePageProps) {
  const { user } = useAuth();

  // Fetch clinic with all details
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['my-practice-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select(`
          *,
          clinic_hours(*),
          clinic_images(*),
          clinic_insurances(*, insurance:insurances(*)),
          city:cities(name, state:states(name, abbreviation))
        `)
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch team count
  const { data: teamCount = 0 } = useQuery({
    queryKey: ['my-practice-team-count', clinic?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('dentists')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id);
      return count || 0;
    },
    enabled: !!clinic?.id,
  });

  // Fetch services count
  const { data: servicesCount = 0 } = useQuery({
    queryKey: ['my-practice-services-count', clinic?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('clinic_treatments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id);
      return count || 0;
    },
    enabled: !!clinic?.id,
  });

  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonCard className="h-64" />
        </div>
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <EmptyState
        icon={Building2}
        title="No Practice Found"
        description="Your account is not linked to any practice. Claim your profile or add a new practice."
        action={
          <Button onClick={() => onNavigate('claim-profile')}>Claim Profile</Button>
        }
      />
    );
  }

  // Format hours for display
  const formattedHours = DAY_NAMES.map((day, index) => {
    const hourEntry = clinic.clinic_hours?.find((h: any) => h.day_of_week === index);
    if (!hourEntry || hourEntry.is_closed) {
      return { day, hours: 'Closed' };
    }
    return {
      day,
      hours: `${hourEntry.open_time} - ${hourEntry.close_time}`,
    };
  });

  // Integration status
  const integrations = [
    {
      name: 'Google Business',
      connected: !!clinic.google_place_id,
      icon: Globe,
      action: 'Connect GMB',
    },
    {
      name: 'Online Booking',
      connected: true, // Always enabled in our system
      icon: Calendar,
      action: 'Configure',
    },
    {
      name: 'Review Automation',
      connected: !!clinic.google_place_id,
      icon: Zap,
      action: 'Setup',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Practice"
        subtitle="Clinic details and performance snapshot"
        primaryAction={
          <Button className="rounded-xl gap-2" onClick={() => onNavigate('my-profile')}>
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Clinic Card */}
          <PremiumCard>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Logo/Image */}
              <div className="flex-shrink-0">
                {clinic.cover_image_url ? (
                  <img
                    src={clinic.cover_image_url}
                    alt={clinic.name}
                    className="h-32 w-32 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="h-32 w-32 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-primary" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{clinic.name}</h2>
                    {clinic.city && (
                      <p className="text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4" />
                        {clinic.city.name}, {clinic.city.state?.abbreviation}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {clinic.verification_status === 'verified' ? (
                      <StatusBadge status="success" label="Verified" />
                    ) : (
                      <StatusBadge status="warning" label="Unverified" />
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  {clinic.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{clinic.address}</span>
                    </div>
                  )}
                  {clinic.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{clinic.phone}</span>
                    </div>
                  )}
                  {clinic.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{clinic.email}</span>
                    </div>
                  )}
                  {clinic.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={clinic.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Website <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PremiumCard>

          {/* Operating Hours */}
          <PremiumCard>
            <SectionHeader
              title="Operating Hours"
              icon={Clock}
              action={
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => onNavigate('my-availability')}>
                  Update Hours
                </Button>
              }
            />
            
            {clinic.clinic_hours?.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {formattedHours.map(({ day, hours }) => (
                  <div
                    key={day}
                    className={cn(
                      'p-3 rounded-xl border',
                      hours === 'Closed' ? 'bg-muted/30 border-border/50' : 'bg-primary/5 border-primary/20'
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground">{day}</p>
                    <p className={cn('text-sm font-semibold', hours === 'Closed' ? 'text-muted-foreground' : 'text-foreground')}>
                      {hours}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="No hours set"
                description="Add your operating hours to help patients find you"
                action={
                  <Button size="sm" variant="outline" onClick={() => onNavigate('my-availability')}>
                    Add Hours
                  </Button>
                }
              />
            )}
          </PremiumCard>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <PremiumCard hover onClick={() => onNavigate('my-team')} className="text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{teamCount}</p>
              <p className="text-sm text-muted-foreground">Team Members</p>
            </PremiumCard>
            
            <PremiumCard hover onClick={() => onNavigate('my-services')} className="text-center">
              <Zap className="h-8 w-8 text-teal mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{servicesCount}</p>
              <p className="text-sm text-muted-foreground">Services</p>
            </PremiumCard>
            
            <PremiumCard hover onClick={() => onNavigate('my-insurance')} className="text-center">
              <Shield className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{clinic.clinic_insurances?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Insurances</p>
            </PremiumCard>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Rating Card */}
          <PremiumCard variant="gradient">
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-amber-500 fill-amber-500" />
              </div>
              <p className="text-4xl font-bold text-foreground">
                {clinic.rating ? Number(clinic.rating).toFixed(1) : '—'}
              </p>
              <p className="text-muted-foreground mt-1">
                {clinic.review_count || 0} reviews
              </p>
              <Button
                className="w-full mt-4 rounded-xl"
                onClick={() => onNavigate('my-reputation')}
              >
                Manage Reviews
              </Button>
            </div>
          </PremiumCard>

          {/* Integrations */}
          <PremiumCard>
            <SectionHeader
              title="Integrations"
              icon={Zap}
              action={
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => onNavigate('my-settings')}>
                  Open Setup
                </Button>
              }
            />
            
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center',
                      integration.connected ? 'bg-emerald-50' : 'bg-muted'
                    )}>
                      <integration.icon className={cn(
                        'h-4 w-4',
                        integration.connected ? 'text-emerald-600' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {integration.connected ? 'Connected' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                  {integration.connected ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Button size="sm" variant="ghost" className="text-primary text-xs">
                      {integration.action}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
