import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Star,
  CheckCircle,
  Building2,
  Shield,
  CreditCard,
  Award,
  Loader2,
  MapPin,
  AlertTriangle,
  Send,
  QrCode,
  Users,
  Zap,
  Settings,
  Edit,
  Globe,
  ThumbsUp,
  RefreshCw,
  Plus,
  Eye,
} from 'lucide-react';
import { LocationSelectionModal } from '@/components/LocationSelectionModal';
import { AddPracticeModal } from '@/components/dentist/AddPracticeModal';
import {
  HeroStatsGrid,
  CommandStrip,
  ReputationWidget,
  AppointmentsTimeline,
  ProfileHealthCard,
  OutreachImpactCard,
  ActivityFeed,
} from '@/components/dashboard';
import NotificationSettingsCard from '@/components/dentist/NotificationSettingsCard';
import AIInsightsCard from '@/components/dentist/AIInsightsCard';
import DashboardWidgets from '@/components/dentist/DashboardWidgets';

function VerificationPaymentButton({ clinicId }: { clinicId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-verification-payment', {
        body: { clinicId },
      });
      if (error) throw error;
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePayment} 
      disabled={isLoading} 
      className="w-full bg-teal hover:bg-teal/90 text-white font-bold"
    >
      {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
      Get Verified - $99/month
    </Button>
  );
}

interface ClinicProfile {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  verification_status?: string;
  claim_status?: string;
  location_verified?: boolean;
  location_pending_approval?: boolean;
  city_id?: string;
  gmb_connected?: boolean;
  google_place_id?: string;
  city?: { name: string };
  area?: { name: string };
}

export default function DentistDashboardTab() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAddPracticeModal, setShowAddPracticeModal] = useState(false);

  // Check for subscription success/cancelled from URL
  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');
    if (subscriptionStatus === 'success') {
      toast.success('🎉 Subscription activated successfully! Welcome to your new plan.', {
        duration: 5000,
      });
      // Remove the param from URL
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
      // Refresh subscription data
      queryClient.invalidateQueries({ queryKey: ['clinic-subscription'] });
    } else if (subscriptionStatus === 'cancelled') {
      toast.info('Checkout was cancelled. You can upgrade anytime from your dashboard.');
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const navigateTo = (tab: string) => {
    setSearchParams({ tab });
  };

  // Fetch dentist's clinic - skip for admins
  const { data: clinic, isLoading: profileLoading } = useQuery({
    queryKey: ['dentist-profile', user?.id],
    queryFn: async (): Promise<ClinicProfile | null> => {
      const { data: clinics } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, address, phone, email, website, rating, review_count,
          verification_status, claim_status, location_verified, location_pending_approval, 
          city_id, gmb_connected, google_place_id,
          city:cities(name),
          area:areas(name)
        `)
        .eq('claimed_by', user?.id)
        .limit(1);
      
      if (clinics && clinics.length > 0) {
        const c = clinics[0];
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          address: c.address || undefined,
          phone: c.phone || undefined,
          email: c.email || undefined,
          website: c.website || undefined,
          rating: c.rating ? Number(c.rating) : undefined,
          review_count: c.review_count || undefined,
          verification_status: c.verification_status || undefined,
          claim_status: c.claim_status || undefined,
          location_verified: c.location_verified ?? undefined,
          location_pending_approval: c.location_pending_approval ?? undefined,
          city_id: c.city_id || undefined,
          gmb_connected: c.gmb_connected || false,
          google_place_id: c.google_place_id || undefined,
          city: c.city as { name: string } | undefined,
          area: c.area as { name: string } | undefined,
        };
      }
      return null;
    },
    enabled: !!user?.id && !isAdmin && !isSuperAdmin,
  });

  // Fetch subscription plan
  const { data: subscription } = useQuery({
    queryKey: ['clinic-subscription', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return null;
      const { data } = await supabase
        .from('clinic_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('clinic_id', clinic.id)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
    enabled: !!clinic?.id,
  });

  // Fetch appointments stats
  const { data: appointmentStats } = useQuery({
    queryKey: ['dentist-appointments-stats', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return { total: 0, pending: 0, confirmed: 0, completed: 0 };
      
      const { data } = await supabase
        .from('appointments')
        .select('status')
        .eq('clinic_id', clinic.id);
      
      const appointments = data || [];
      return {
        total: appointments.length,
        pending: appointments.filter(a => a.status === 'pending').length,
        confirmed: appointments.filter(a => a.status === 'confirmed').length,
        completed: appointments.filter(a => a.status === 'completed').length,
      };
    },
    enabled: !!clinic?.id,
  });

  // Fetch funnel stats
  const { data: funnelStats } = useQuery({
    queryKey: ['dentist-funnel-stats', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return { thumbsUp: 0, thumbsDown: 0, total: 0 };
      
      const { data } = await supabase
        .from('review_funnel_events')
        .select('event_type')
        .eq('clinic_id', clinic.id);
      
      const events = data || [];
      return {
        thumbsUp: events.filter(e => e.event_type === 'thumbs_up').length,
        thumbsDown: events.filter(e => e.event_type === 'thumbs_down').length,
        total: events.length,
      };
    },
    enabled: !!clinic?.id,
  });

  // Fetch patients count
  const { data: patientsCount } = useQuery({
    queryKey: ['dentist-patients-count', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return 0;
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinic.id);
      return count || 0;
    },
    enabled: !!clinic?.id,
  });

  const isVerified = clinic?.verification_status === 'verified' && clinic?.claim_status === 'claimed';
  const locationNeedsConfirmation = clinic && !clinic.location_verified && !clinic.location_pending_approval;
  const locationPendingApproval = clinic?.location_pending_approval;

  const positiveRate = funnelStats?.total && funnelStats.total > 0
    ? Math.round((funnelStats.thumbsUp / funnelStats.total) * 100)
    : 100;

  if (profileLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Allow admins/super_admins to proceed without a clinic
  if (!clinic && !isAdmin && !isSuperAdmin) {
    return (
      <>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
          <div className="h-24 w-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 animate-bounce-gentle border border-primary/20">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-3xl font-extrabold mb-3 text-foreground">No Practice Linked</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Your account is not linked to any clinic yet. You can claim an existing profile or add your practice to the directory.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" className="rounded-2xl px-8 bg-primary hover:bg-primary/90">
              <Link to="/claim-profile">
                <Shield className="h-5 w-5 mr-2" />
                Claim Existing Profile
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-2xl px-8"
              onClick={() => setShowAddPracticeModal(true)}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your Practice
            </Button>
          </div>
        </div>
        
        <AddPracticeModal 
          open={showAddPracticeModal} 
          onOpenChange={setShowAddPracticeModal} 
        />
      </>
    );
  }
  
  // Admins without a clinic should not see this tab - skip rendering
  // They should use admin-specific tabs like Overview, Clinics, etc.
  if (!clinic && (isAdmin || isSuperAdmin)) {
    return null;
  }

  // Hero stats data
  const heroStats = [
    {
      label: 'Profile',
      value: isVerified ? 'Verified' : 'Pending',
      icon: Shield,
      color: isVerified ? 'emerald' as const : 'gold' as const,
      progress: isVerified ? 100 : 60,
      onClick: () => navigateTo('my-profile'),
    },
    {
      label: 'Total Reviews',
      value: clinic.review_count || 0,
      icon: Star,
      color: 'gold' as const,
      onClick: () => navigateTo('my-reputation'),
    },
    {
      label: 'Avg Rating',
      value: clinic.rating?.toFixed(1) || 'N/A',
      icon: Star,
      color: 'gold' as const,
      subtitle: 'Google',
    },
    {
      label: 'New Reviews',
      value: funnelStats?.total || 0,
      subtitle: 'Last 30 days',
      icon: ThumbsUp,
      color: 'teal' as const,
      onClick: () => navigateTo('my-reputation'),
    },
    {
      label: 'Appointments',
      value: appointmentStats?.total || 0,
      subtitle: `${appointmentStats?.pending || 0} pending`,
      icon: Calendar,
      color: 'primary' as const,
      onClick: () => navigateTo('my-appointments'),
    },
    {
      label: 'Today',
      value: appointmentStats?.confirmed || 0,
      subtitle: 'Confirmed',
      icon: CheckCircle,
      color: 'blue' as const,
    },
    {
      label: 'GMB Status',
      value: clinic.gmb_connected ? 'Connected' : 'Not Set',
      icon: Globe,
      color: clinic.gmb_connected ? 'teal' as const : 'coral' as const,
      onClick: () => navigateTo('my-settings'),
    },
  ];

  // Command strip actions
  const commandActions = [
    {
      icon: Send,
      label: 'Request Review',
      onClick: () => navigateTo('my-reputation'),
      variant: 'teal' as const,
    },
    {
      icon: Plus,
      label: 'Add Patient',
      onClick: () => navigateTo('my-patients'),
      variant: 'primary' as const,
    },
    {
      icon: Calendar,
      label: 'Add Appointment',
      onClick: () => navigateTo('my-appointments'),
      variant: 'primary' as const,
    },
    {
      icon: RefreshCw,
      label: 'Sync Google',
      onClick: () => navigateTo('my-settings'),
      variant: 'gold' as const,
      disabled: !clinic.gmb_connected,
    },
    {
      icon: Edit,
      label: 'Edit Profile',
      onClick: () => navigateTo('my-profile'),
    },
    {
      icon: QrCode,
      label: 'QR Code',
      onClick: () => navigateTo('my-reputation'),
    },
    {
      icon: Users,
      label: 'Patients',
      onClick: () => navigateTo('my-patients'),
      badge: patientsCount ? String(patientsCount) : undefined,
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => navigateTo('my-settings'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Location Warning Banner */}
      {locationNeedsConfirmation && (
        <Card className="border-coral/40 bg-gradient-to-r from-coral/15 via-coral/10 to-coral/15 overflow-hidden animate-fade-in shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-coral/20 flex items-center justify-center flex-shrink-0 shadow-md">
                <AlertTriangle className="h-6 w-6 text-coral" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-coral text-lg">Action Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your clinic is not publicly listed because your location hasn't been confirmed. Select your location to go live.
                </p>
                <Button
                  onClick={() => setShowLocationModal(true)}
                  className="bg-coral hover:bg-coral/90 shadow-lg shadow-coral/20"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Select Your Location
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Pending Approval Banner */}
      {locationPendingApproval && (
        <Card className="border-gold/40 bg-gradient-to-r from-gold/15 via-gold/10 to-gold/15 animate-fade-in shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gold/20 flex items-center justify-center flex-shrink-0 shadow-md">
                <Clock className="h-6 w-6 text-gold" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gold text-lg">Location Pending</h3>
                <p className="text-sm text-muted-foreground">
                  Your area request is pending admin approval. Your clinic will go live once approved (usually within 24 hours).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header Section - Dark Modern Design with Graphics */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl">
        {/* Background Graphics */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-teal/15 rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-gold/10 rounded-full blur-xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
          {/* Decorative shapes */}
          <svg className="absolute top-4 right-8 w-20 h-20 text-white/5" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
          <svg className="absolute bottom-4 left-8 w-16 h-16 text-primary/20" viewBox="0 0 100 100">
            <polygon points="50,10 90,90 10,90" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 ring-2 ring-white/10">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-white">{clinic.name}</h1>
                {isVerified ? (
                  <Badge className="bg-teal/20 text-teal border border-teal/30 text-[10px] shadow-lg shadow-teal/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge className="bg-white/10 text-white/60 border border-white/20 text-[10px]">Unverified</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-white/70">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-sm">{clinic.city?.name || 'Location not set'}{clinic.area?.name ? ` • ${clinic.area.name}` : ''}</span>
                </div>
                {subscription?.plan && (
                  <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px]">
                    {subscription.plan.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Stats Pills */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
                <Star className="h-3.5 w-3.5 text-gold" />
                <span className="text-sm font-medium text-white">{clinic.rating?.toFixed(1) || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
                <Users className="h-3.5 w-3.5 text-teal" />
                <span className="text-sm font-medium text-white">{clinic.review_count || 0} reviews</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="rounded-xl bg-white/10 border-white/20 text-white hover:bg-white hover:text-slate-900 transition-all"
              onClick={() => window.open(`/clinic/${clinic.slug}`, "_blank")}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Profile
            </Button>
          </div>
        </div>
        
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-teal to-gold" />
      </div>

      {/* Location Selection Modal */}
      <LocationSelectionModal
        open={showLocationModal}
        onOpenChange={setShowLocationModal}
        clinicId={clinic.id}
        detectedCity={clinic.city?.name}
        detectedCityId={clinic.city_id}
        onLocationSelected={() => {
          queryClient.invalidateQueries({ queryKey: ['dentist-profile'] });
        }}
      />

      {/* Command Strip */}
      <CommandStrip actions={commandActions} />

      {/* Hero Stats Grid */}
      <HeroStatsGrid stats={heroStats} />

      {/* Dashboard Widgets (Reputation, Funnel, Today's Appointments) */}
      <DashboardWidgets
        clinicId={clinic.id}
        clinicName={clinic.name}
        clinicSlug={clinic.slug}
        googlePlaceId={clinic.google_place_id}
        verificationStatus={clinic.verification_status}
        rating={clinic.rating}
        reviewCount={clinic.review_count}
        onNavigate={navigateTo}
      />

      {/* Main Dashboard Grid - Compact Layout */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Column 1: Reputation Widget + Plan Cards + Notifications */}
        <div className="space-y-3">
          <ReputationWidget 
            clinicId={clinic.id}
            rating={clinic.rating || 0}
            reviewCount={clinic.review_count || 0}
            onViewDetails={() => navigateTo('my-reputation')}
          />
          
          {/* Plan & Verification Cards - Clean Modern Design */}
          {subscription?.plan ? (
            <Card className="bg-card border border-border/50 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-teal/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-teal" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground text-sm">{subscription.plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {subscription.plan.price_monthly > 0 ? `$${subscription.plan.price_monthly}/mo` : 'Free tier'}
                    </p>
                  </div>
                  {subscription.plan.slug !== 'autopilot_growth' && (
                    <Button variant="ghost" size="sm" className="text-teal hover:bg-teal/10 h-8" onClick={() => navigateTo('my-settings')}>
                      <Zap className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border border-primary/20 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground text-sm">Free Listing</p>
                    <p className="text-xs text-muted-foreground">Upgrade to unlock</p>
                  </div>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-8" onClick={() => navigateTo('my-settings')}>
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Upgrade
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isVerified && (
            <Card className="bg-card border border-gold/20 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gold/10 flex items-center justify-center">
                    <Award className="h-4 w-4 text-gold" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground text-sm">Get Verified</p>
                    <p className="text-xs text-muted-foreground">3x more bookings</p>
                  </div>
                </div>
                <VerificationPaymentButton clinicId={clinic.id} />
              </CardContent>
            </Card>
          )}
          
          {/* Notification Settings */}
          <NotificationSettingsCard clinicId={clinic.id} />
        </div>

        {/* Column 2: Appointments + Profile Health */}
        <div className="space-y-3">
          <AppointmentsTimeline 
            clinicId={clinic.id}
            onViewAll={() => navigateTo('my-appointments')}
          />
          
          <ProfileHealthCard 
            clinicId={clinic.id}
            verificationStatus={clinic.verification_status}
            gmbConnected={clinic.gmb_connected}
            onImprove={() => navigateTo('my-profile')}
          />
        </div>

        {/* Column 3: AI Insights + Outreach */}
        <div className="space-y-3">
          <AIInsightsCard 
            clinicId={clinic.id}
            clinicName={clinic.name}
            onNavigate={navigateTo}
          />
          
          <OutreachImpactCard clinicId={clinic.id} />
        </div>
      </div>

      {/* Activity Feed - Compact */}
      <ActivityFeed clinicId={clinic.id} maxItems={5} />
    </div>
  );
}
