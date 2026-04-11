import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isTomorrow } from 'date-fns';
import {
  Calendar,
  Users,
  Star,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Phone,
  Mail,
  Zap,
  Shield,
  Globe,
  QrCode,
  Send,
  Plus,
  Activity,
  Target,
  BarChart3,
  Eye,
} from 'lucide-react';
import { NoPracticeLinked } from './NoPracticeLinked';

interface DashboardOverviewProps {
  onNavigate: (tab: string) => void;
}

export default function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  // Fetch clinic - skip for admins who don't need a clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dashboard-clinic', user?.id],
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
    enabled: !!user?.id && !isAdmin && !isSuperAdmin,
  });

  // Fetch today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['dashboard-today-appointments', clinic?.id],
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

  // Fetch recent funnel events
  const { data: funnelEvents = [] } = useQuery({
    queryKey: ['dashboard-funnel-events', clinic?.id],
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

  // Fetch patients count
  const { data: patientStats } = useQuery({
    queryKey: ['dashboard-patient-stats', clinic?.id],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id)
        .or('is_deleted_by_dentist.is.null,is_deleted_by_dentist.eq.false');
      
      const { count: newThisMonth } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic?.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
      
      return { total: total || 0, newThisMonth: newThisMonth || 0 };
    },
    enabled: !!clinic?.id,
  });

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 bg-white/5" />
          <Skeleton className="h-10 w-32 bg-white/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Admins can proceed without a clinic
  if (!clinic && !isAdmin && !isSuperAdmin) {
    return <NoPracticeLinked />;
  }

  // Calculate stats
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

  // AI Suggestions
  const suggestions = [
    thumbsDown > thumbsUp && {
      icon: AlertCircle,
      type: 'warning',
      title: 'High negative feedback',
      action: 'Review private feedback and address concerns',
    },
    !clinic.google_place_id && {
      icon: Globe,
      type: 'action',
      title: 'Connect Google Business',
      action: 'Link GMB to boost visibility',
    },
    profileCompleteness < 80 && {
      icon: Shield,
      type: 'action',
      title: 'Complete your profile',
      action: `Profile is ${profileCompleteness}% complete`,
    },
    clinic.verification_status !== 'verified' && {
      icon: CheckCircle,
      type: 'action',
      title: 'Get verified',
      action: 'Verified clinics get 3x more bookings',
    },
    pendingAppts > 0 && {
      icon: Clock,
      type: 'urgent',
      title: `${pendingAppts} pending appointments`,
      action: 'Review and confirm appointments',
    },
  ].filter(Boolean).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
            Welcome back! 👋
          </h1>
          <p className="text-white/60 mt-1">
            Here's what's happening at {clinic.name}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => onNavigate('my-reputation')}
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
          <Button
            className="gap-2 bg-gradient-to-r from-primary to-teal text-white shadow-lg shadow-primary/25"
            onClick={() => onNavigate('my-patients')}
          >
            <Send className="h-4 w-4" />
            Send Request
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Appointments */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20 overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-primary/10 transition-all"
          onClick={() => onNavigate('my-appointments')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-primary transition-colors" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-white">{todayAppointments.length}</p>
              <p className="text-sm text-white/60">Today's Appointments</p>
            </div>
            <div className="flex gap-2 mt-3">
              <Badge className="bg-gold/20 text-gold border-0 text-[10px]">
                {pendingAppts} pending
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                {confirmedAppts} confirmed
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Patients */}
        <Card className="bg-gradient-to-br from-teal/20 to-teal/5 border-teal/20 overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-teal/10 transition-all"
          onClick={() => onNavigate('my-patients')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-teal/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-teal" />
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-teal transition-colors" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-white">{patientStats?.total || 0}</p>
              <p className="text-sm text-white/60">Total Patients</p>
            </div>
            {(patientStats?.newThisMonth || 0) > 0 && (
              <div className="flex items-center gap-1 mt-3 text-teal text-sm">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+{patientStats?.newThisMonth} this month</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rating */}
        <Card className="bg-gradient-to-br from-gold/20 to-gold/5 border-gold/20 overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-gold/10 transition-all"
          onClick={() => onNavigate('my-reputation')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-gold/20 flex items-center justify-center">
                <Star className="h-6 w-6 text-gold fill-gold" />
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-gold transition-colors" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-white">
                {clinic.rating ? Number(clinic.rating).toFixed(1) : 'N/A'}
              </p>
              <p className="text-sm text-white/60">Average Rating</p>
            </div>
            <p className="text-sm text-white/40 mt-3">{clinic.review_count || 0} reviews</p>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className="bg-gradient-to-br from-purple/20 to-purple/5 border-purple/20 overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-purple/10 transition-all"
          onClick={() => onNavigate('my-reputation')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-purple/20 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple" />
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-purple transition-colors" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-white">{conversionRate}%</p>
              <p className="text-sm text-white/60">Positive Rate</p>
            </div>
            <div className="flex gap-3 mt-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-400">
                <ThumbsUp className="h-3 w-3" /> {thumbsUp}
              </span>
              <span className="flex items-center gap-1 text-coral">
                <ThumbsDown className="h-3 w-3" /> {thumbsDown}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Appointments & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule */}
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary via-teal to-purple" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Today's Schedule
                </CardTitle>
                <p className="text-sm text-white/50">{format(new Date(), 'EEEE, MMMM d')}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => onNavigate('my-appointments')}
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="h-6 w-6 text-white/30" />
                  </div>
                  <p className="text-white/50">No appointments scheduled for today</p>
                  <Button
                    variant="link"
                    className="text-primary mt-2"
                    onClick={() => onNavigate('my-availability')}
                  >
                    Set up your availability
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.slice(0, 4).map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{appt.patient_name}</p>
                        <p className="text-sm text-white/50">
                          {appt.preferred_time || 'Time TBD'} • {appt.treatment?.name || 'General'}
                        </p>
                      </div>
                      <Badge
                        className={
                          appt.status === 'confirmed'
                            ? 'bg-emerald-500/20 text-emerald-400 border-0'
                            : appt.status === 'pending'
                            ? 'bg-gold/20 text-gold border-0'
                            : 'bg-white/10 text-white/60 border-0'
                        }
                      >
                        {appt.status || 'pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-gold" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Send, label: 'Send Request', tab: 'my-reputation', color: 'from-primary to-teal' },
                  { icon: Plus, label: 'Add Patient', tab: 'my-patients', color: 'from-teal to-emerald-500' },
                  { icon: Calendar, label: 'Appointments', tab: 'my-appointments', color: 'from-purple to-indigo' },
                  { icon: Eye, label: 'View Profile', tab: 'my-profile', color: 'from-gold to-amber-500' },
                ].map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className={`h-auto flex-col gap-2 py-4 border-white/10 bg-white/5 hover:bg-white/10 text-white`}
                    onClick={() => onNavigate(action.tab)}
                  >
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                      <action.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-medium">{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Profile & AI */}
        <div className="space-y-6">
          {/* Profile Health */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                Profile Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{profileCompleteness}%</span>
                <Badge
                  className={
                    profileCompleteness >= 80
                      ? 'bg-emerald-500/20 text-emerald-400 border-0'
                      : 'bg-gold/20 text-gold border-0'
                  }
                >
                  {profileCompleteness >= 80 ? 'Good' : 'Needs Work'}
                </Badge>
              </div>
              <Progress value={profileCompleteness} className="h-2 bg-white/10" />
              <div className="flex flex-wrap gap-2">
                {clinic.verification_status === 'verified' ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" /> Verified
                  </Badge>
                ) : (
                  <Badge className="bg-white/10 text-white/50 border-0 text-xs">Unverified</Badge>
                )}
                {clinic.google_place_id ? (
                  <Badge className="bg-primary/20 text-primary border-0 text-xs">
                    <Globe className="h-3 w-3 mr-1" /> GMB
                  </Badge>
                ) : (
                  <Badge className="bg-white/10 text-white/50 border-0 text-xs">No GMB</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-white/10 text-white hover:bg-white/10"
                onClick={() => onNavigate('my-profile')}
              >
                Edit Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          <Card className="bg-gradient-to-br from-primary/10 to-teal/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestions.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-white/60 text-sm">All looking good!</p>
                </div>
              ) : (
                suggestions.map((suggestion: any, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-xl border transition-colors ${
                      suggestion.type === 'warning'
                        ? 'bg-coral/10 border-coral/20 hover:bg-coral/15'
                        : suggestion.type === 'urgent'
                        ? 'bg-gold/10 border-gold/20 hover:bg-gold/15'
                        : 'bg-primary/10 border-primary/20 hover:bg-primary/15'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          suggestion.type === 'warning'
                            ? 'bg-coral/20'
                            : suggestion.type === 'urgent'
                            ? 'bg-gold/20'
                            : 'bg-primary/20'
                        }`}
                      >
                        <suggestion.icon
                          className={`h-4 w-4 ${
                            suggestion.type === 'warning'
                              ? 'text-coral'
                              : suggestion.type === 'urgent'
                              ? 'text-gold'
                              : 'text-primary'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{suggestion.title}</p>
                        <p className="text-xs text-white/50">{suggestion.action}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
