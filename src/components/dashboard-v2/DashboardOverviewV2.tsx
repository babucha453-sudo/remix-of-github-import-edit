/**
 * Premium Dashboard Overview v2
 * Widget-based command center with animated KPIs, circular progress, and AI suggestions
 * Professional UX design with glassmorphism, smooth animations, and data visualization
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { 
  Calendar, 
  Users, 
  Star, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Globe,
  QrCode,
  Send,
  Plus,
  Eye,
  Zap,
  Shield,
  Activity,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Target,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  PremiumCard, 
  SectionHeader, 
  QuickAction, 
  EmptyState,
  SkeletonCard,
  StatusBadge,
  MetricCard,
} from './DesignSystem';
import { AnimatedKPICard } from './AnimatedKPICard';
import { NoPracticeLinked } from '@/components/dentist/NoPracticeLinked';

interface DashboardOverviewV2Props {
  onNavigate: (tab: string) => void;
}

export default function DashboardOverviewV2({ onNavigate }: DashboardOverviewV2Props) {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  // Fetch clinic - for admins/super_admins, skip the clinic requirement
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dashboard-v2-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*, clinic_hours(*), clinic_images(*)')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    // Admins don't need a clinic to access dashboard
    enabled: !!user?.id && !isAdmin && !isSuperAdmin,
  });

  // Fetch today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['dashboard-v2-today-appointments', clinic?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('appointments')
        .select('*, treatment:treatments(name)')
        .eq('clinic_id', clinic?.id)
        .gte('preferred_date', today)
        .lte('preferred_date', today)
        .order('preferred_time');
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch funnel events for conversion metrics
  const { data: funnelEvents = [] } = useQuery({
    queryKey: ['dashboard-v2-funnel-events', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch patient stats
  const { data: patientStats } = useQuery({
    queryKey: ['dashboard-v2-patient-stats', clinic?.id],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id)
        .or('is_deleted_by_dentist.is.null,is_deleted_by_dentist.eq.false');
      
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count: newThisMonth } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id)
        .gte('created_at', thisMonth);
      
      return { total: total || 0, newThisMonth: newThisMonth || 0 };
    },
    enabled: !!clinic?.id,
  });

  // Loading state
  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // No clinic state - but admins/super_admins should never see this
  if (!clinic && !isAdmin && !isSuperAdmin) {
    return <NoPracticeLinked />;
  }

  // Calculate metrics
  const pendingAppts = todayAppointments.filter(a => a.status === 'pending').length;
  const confirmedAppts = todayAppointments.filter(a => a.status === 'confirmed').length;
  const completedAppts = todayAppointments.filter(a => a.status === 'completed').length;
  const thumbsUp = funnelEvents.filter(e => e.event_type === 'thumbs_up').length;
  const thumbsDown = funnelEvents.filter(e => e.event_type === 'thumbs_down').length;
  const conversionRate = funnelEvents.length > 0 ? Math.round((thumbsUp / funnelEvents.length) * 100) : 0;

  // Profile completeness
  const profileFields = [
    clinic.name,
    clinic.description,
    clinic.address,
    clinic.phone,
    clinic.email,
    clinic.website,
    clinic.cover_image_url,
    clinic.google_place_id,
    (clinic.clinic_hours?.length || 0) > 0,
    (clinic.clinic_images?.length || 0) > 0,
  ];
  const profileCompleteness = Math.round((profileFields.filter(Boolean).length / 10) * 100);

  // Generate AI suggestions
  const suggestions = [
    pendingAppts > 0 && {
      icon: Clock,
      type: 'urgent' as const,
      title: `${pendingAppts} pending appointments`,
      action: 'Review and confirm appointments',
      onClick: () => onNavigate('my-appointments'),
    },
    thumbsDown > thumbsUp && {
      icon: AlertCircle,
      type: 'warning' as const,
      title: 'High negative feedback',
      action: 'Review private feedback and address concerns',
      onClick: () => onNavigate('my-reputation'),
    },
    !clinic.google_place_id && {
      icon: Globe,
      type: 'action' as const,
      title: 'Connect Google Business',
      action: 'Link GMB to boost visibility and reviews',
      onClick: () => onNavigate('my-reputation'),
    },
    profileCompleteness < 80 && {
      icon: Shield,
      type: 'action' as const,
      title: `Profile ${profileCompleteness}% complete`,
      action: 'Complete your profile for better visibility',
      onClick: () => onNavigate('my-profile'),
    },
    clinic.verification_status !== 'verified' && {
      icon: CheckCircle,
      type: 'action' as const,
      title: 'Get verified',
      action: 'Verified clinics get 3x more bookings',
      onClick: () => onNavigate('my-profile'),
    },
  ].filter(Boolean).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            Welcome back! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening at <span className="font-medium text-foreground">{clinic.name}</span> today
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => onNavigate('my-reputation')}
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
          <Button
            className="gap-2 rounded-xl shadow-lg shadow-primary/20"
            onClick={() => onNavigate('my-patients')}
          >
            <Send className="h-4 w-4" />
            Send Review Request
          </Button>
        </div>
      </div>

      {/* Animated KPI Stats Row - Professional Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Appointments - Circular Progress */}
        <AnimatedKPICard
          label="Today's Appointments"
          value={todayAppointments.length}
          icon={Calendar}
          variant="circular"
          maxValue={Math.max(10, todayAppointments.length)}
          onClick={() => onNavigate('my-appointments')}
          action={{ label: 'View schedule', onClick: () => onNavigate('my-appointments') }}
          delay={0}
        />
        
        {/* Total Patients - Dark Gradient */}
        <AnimatedKPICard
          label="Total Patients"
          value={patientStats?.total || 0}
          icon={Users}
          variant="dark"
          trend={patientStats?.newThisMonth ? 'up' : 'neutral'}
          trendValue={patientStats?.newThisMonth ? `+${patientStats.newThisMonth}` : undefined}
          onClick={() => onNavigate('my-patients')}
          delay={100}
        />
        
        {/* Average Rating - Circular */}
        <AnimatedKPICard
          label="Average Rating"
          value={clinic.rating ? Number(clinic.rating).toFixed(1) : 0}
          icon={Star}
          variant="circular"
          maxValue={5}
          onClick={() => onNavigate('my-reputation')}
          action={{ label: 'View reviews', onClick: () => onNavigate('my-reputation') }}
          delay={200}
        />
        
        {/* Positive Rate - Gradient */}
        <AnimatedKPICard
          label="Positive Rate"
          value={conversionRate}
          icon={ThumbsUp}
          variant="gradient"
          suffix="%"
          trend={conversionRate >= 70 ? 'up' : conversionRate >= 50 ? 'neutral' : 'down'}
          trendValue={conversionRate >= 70 ? 'Great!' : conversionRate >= 50 ? 'Good' : 'Improve'}
          onClick={() => onNavigate('my-reputation')}
          delay={300}
        />
      </div>

      {/* Secondary Metrics Row - Revenue & Performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Pending"
          value={pendingAppts}
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
          onClick={() => onNavigate('my-appointments')}
        />
        <MetricCard
          label="Confirmed"
          value={confirmedAppts}
          icon={CheckCircle}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
          onClick={() => onNavigate('my-appointments')}
        />
        <MetricCard
          label="Completed"
          value={completedAppts}
          icon={Activity}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-50"
          onClick={() => onNavigate('my-appointments')}
        />
        <MetricCard
          label="This Month"
          value={patientStats?.newThisMonth || 0}
          icon={TrendingUp}
          iconColor="text-purple-500"
          iconBg="bg-purple-50"
          trend={{ value: 12 }}
          onClick={() => onNavigate('my-patients')}
        />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Schedule & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule */}
          <PremiumCard padding="none" className="overflow-hidden">
            {/* Gradient top accent */}
            <div className="h-1 bg-gradient-to-r from-primary via-teal to-emerald-500" />
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  title="Today's Schedule"
                  description={format(new Date(), 'EEEE, MMMM d, yyyy')}
                  icon={Calendar}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
                  onClick={() => onNavigate('my-appointments')}
                >
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {todayAppointments.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No appointments today"
                  description="Your schedule is clear. Set up your availability to start receiving bookings."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => onNavigate('my-availability')}
                    >
                      Set Availability
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {todayAppointments.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => onNavigate('my-appointments')}
                    >
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{appt.patient_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {appt.preferred_time || 'Time TBD'} • {appt.treatment?.name || 'General'}
                        </p>
                      </div>
                      <StatusBadge
                        status={
                          appt.status === 'confirmed' ? 'success' :
                          appt.status === 'pending' ? 'warning' :
                          appt.status === 'completed' ? 'info' : 'neutral'
                        }
                        label={appt.status || 'pending'}
                      />
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PremiumCard>

          {/* Quick Actions - Professional Grid */}
          <PremiumCard variant="premium">
            <SectionHeader
              title="Quick Actions"
              description="Common tasks at your fingertips"
              icon={Zap}
              iconColor="text-amber-500"
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QuickAction
                icon={Send}
                label="Send Request"
                description="Review request"
                onClick={() => onNavigate('my-reputation')}
                color="from-primary to-teal"
              />
              <QuickAction
                icon={Plus}
                label="Add Patient"
                description="New patient"
                onClick={() => onNavigate('my-patients')}
                color="from-teal to-emerald-500"
              />
              <QuickAction
                icon={Calendar}
                label="Appointments"
                description="View schedule"
                onClick={() => onNavigate('my-appointments')}
                color="from-purple-500 to-indigo-500"
              />
              <QuickAction
                icon={Eye}
                label="View Profile"
                description="Public profile"
                onClick={() => onNavigate('my-profile')}
                color="from-amber-500 to-orange-500"
              />
              <QuickAction
                icon={Star}
                label="Reputation"
                description="Manage reviews"
                onClick={() => onNavigate('my-reputation')}
                color="from-pink-500 to-rose-500"
              />
              <QuickAction
                icon={Users}
                label="Patients"
                description="Patient records"
                onClick={() => onNavigate('my-patients')}
                color="from-blue-500 to-cyan-500"
              />
              <QuickAction
                icon={Shield}
                label="Insurance"
                description="Accepted plans"
                onClick={() => onNavigate('my-insurance')}
                color="from-emerald-500 to-teal-500"
              />
              <QuickAction
                icon={MessageSquare}
                label="Messages"
                description="Patient chats"
                onClick={() => onNavigate('my-messages')}
                color="from-violet-500 to-purple-500"
              />
            </div>
          </PremiumCard>
        </div>

        {/* Right Column - Profile Health & AI */}
        <div className="space-y-6">
          {/* Profile Health */}
          <PremiumCard>
            <SectionHeader
              title="Profile Health"
              icon={Shield}
              iconColor="text-emerald-500"
            />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-foreground">{profileCompleteness}%</span>
                <StatusBadge
                  status={profileCompleteness >= 80 ? 'success' : profileCompleteness >= 50 ? 'warning' : 'error'}
                  label={profileCompleteness >= 80 ? 'Good' : profileCompleteness >= 50 ? 'Fair' : 'Needs work'}
                />
              </div>
              
              <Progress value={profileCompleteness} className="h-2" />
              
              <div className="flex flex-wrap gap-2">
                {clinic.verification_status === 'verified' ? (
                  <StatusBadge status="success" label="Verified" />
                ) : (
                  <StatusBadge status="neutral" label="Unverified" />
                )}
                {clinic.google_place_id ? (
                  <StatusBadge status="success" label="GMB Connected" />
                ) : (
                  <StatusBadge status="neutral" label="No GMB" />
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
                onClick={() => onNavigate('my-profile')}
              >
                Edit Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </PremiumCard>

          {/* AI Suggestions */}
          <PremiumCard variant="gradient">
            <SectionHeader
              title="AI Suggestions"
              icon={Sparkles}
              iconColor="text-primary"
            />
            
            <div className="space-y-3">
              {suggestions.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All looking good! No suggestions at this time.</p>
                </div>
              ) : (
                suggestions.map((suggestion: any, index) => (
                  <button
                    key={index}
                    onClick={suggestion.onClick}
                    className={cn(
                      'w-full p-4 rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
                      suggestion.type === 'warning'
                        ? 'bg-red-50 border-red-200 hover:border-red-300'
                        : suggestion.type === 'urgent'
                        ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                        : 'bg-primary/5 border-primary/20 hover:border-primary/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                          suggestion.type === 'warning'
                            ? 'bg-red-100'
                            : suggestion.type === 'urgent'
                            ? 'bg-amber-100'
                            : 'bg-primary/10'
                        )}
                      >
                        <suggestion.icon
                          className={cn(
                            'h-5 w-5',
                            suggestion.type === 'warning'
                              ? 'text-red-600'
                              : suggestion.type === 'urgent'
                              ? 'text-amber-600'
                              : 'text-primary'
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{suggestion.title}</p>
                        <p className="text-sm text-muted-foreground">{suggestion.action}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </PremiumCard>

          {/* Reputation Summary */}
          <PremiumCard>
            <SectionHeader
              title="Reputation"
              icon={Star}
              iconColor="text-amber-500"
            />
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Star className="h-7 w-7 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {clinic.rating ? Number(clinic.rating).toFixed(1) : '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {clinic.review_count || 0} reviews
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between py-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-foreground">{thumbsUp}</span>
                  <span className="text-sm text-muted-foreground">positive</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-foreground">{thumbsDown}</span>
                  <span className="text-sm text-muted-foreground">negative</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
                onClick={() => onNavigate('my-reputation')}
              >
                Open Reputation Suite
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
