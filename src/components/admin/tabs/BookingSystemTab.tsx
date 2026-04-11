import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Settings2,
  CheckCircle,
  Search,
  Building2,
  Clock,
  CalendarDays,
  RefreshCw,
  ExternalLink,
  Globe,
  Zap,
  Users,
  TrendingUp,
  Mail,
  XCircle,
  Timer,
  MousePointer,
  FormInput,
  LogOut,
  Activity,
  BarChart3,
  Filter,
  Power,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface ClinicWithSettings {
  id: string;
  name: string;
  slug: string;
  claim_status: string | null;
  is_active: boolean | null;
  city: { name: string; state?: { abbreviation: string } } | null;
  gmb_connected: boolean;
  dentist_settings?: {
    booking_enabled: boolean;
    allow_same_day_booking: boolean | null;
    min_advance_booking_hours: number | null;
    max_advance_booking_days: number | null;
    confirmation_email_enabled: boolean | null;
    reminder_sms_enabled: boolean | null;
  } | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--teal))', 'hsl(var(--gold))', 'hsl(var(--coral))'];

// Helper function to fetch ALL clinics with batch fetching
async function fetchAllClinics(): Promise<ClinicWithSettings[]> {
  const allClinics: ClinicWithSettings[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('clinics')
      .select(`
        id, name, slug, claim_status, is_active, gmb_connected,
        city:cities(name, state:states(abbreviation)),
        dentist_settings(
          booking_enabled,
          allow_same_day_booking,
          min_advance_booking_hours,
          max_advance_booking_days,
          confirmation_email_enabled,
          reminder_sms_enabled
        )
      `)
      .eq('is_active', true)
      .order('name')
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    
    if (data && data.length > 0) {
      allClinics.push(...(data as ClinicWithSettings[]));
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allClinics;
}

export default function BookingSystemTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithSettings | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch booking stats
  const { data: bookingStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['booking-system-stats'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const week = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const month = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const [totalRes, pendingRes, confirmedRes, todayRes, weekRes, cancelledRes, noShowRes, monthRes] = await Promise.all([
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('preferred_date', today),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', week),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'no_show'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', month),
      ]);

      return {
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        confirmed: confirmedRes.count || 0,
        today: todayRes.count || 0,
        thisWeek: weekRes.count || 0,
        thisMonth: monthRes.count || 0,
        cancelled: cancelledRes.count || 0,
        noShow: noShowRes.count || 0,
      };
    },
  });

  // Fetch booking funnel analytics (sessions, form starts, completions)
  const { data: funnelStats } = useQuery({
    queryKey: ['booking-funnel-stats'],
    queryFn: async () => {
      const week = subDays(new Date(), 7).toISOString();
      
      // Get visitor events related to booking
      const [
        bookingStartsRes,
        bookingCompletesRes,
        formDropoffsRes,
        profileViewsRes,
      ] = await Promise.all([
        supabase.from('visitor_events').select('*', { count: 'exact', head: true })
          .eq('event_type', 'booking_start').gte('created_at', week),
        supabase.from('visitor_events').select('*', { count: 'exact', head: true })
          .eq('event_type', 'booking_complete').gte('created_at', week),
        supabase.from('visitor_events').select('*', { count: 'exact', head: true })
          .eq('event_type', 'booking_abandoned').gte('created_at', week),
        supabase.from('profile_analytics').select('*', { count: 'exact', head: true })
          .eq('event_type', 'view').gte('created_at', week),
      ]);

      const bookingStarts = bookingStartsRes.count || 0;
      const bookingCompletes = bookingCompletesRes.count || 0;
      const formDropoffs = formDropoffsRes.count || bookingStarts - bookingCompletes;
      const profileViews = profileViewsRes.count || 0;

      return {
        profileViews,
        bookingStarts,
        bookingCompletes,
        formDropoffs: Math.max(0, formDropoffs),
        conversionRate: bookingStarts > 0 ? Math.round((bookingCompletes / bookingStarts) * 100) : 0,
        viewToBookingRate: profileViews > 0 ? Math.round((bookingStarts / profileViews) * 100) : 0,
      };
    },
  });

  // Fetch trend data for charts
  const { data: trendData = [] } = useQuery({
    queryKey: ['booking-trend-data'],
    queryFn: async () => {
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const { count } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());

        data.push({
          day: format(dayStart, 'EEE'),
          bookings: count || 0,
        });
      }
      return data;
    },
  });

  // Fetch ALL clinics with their booking settings (no limit)
  const { data: clinicsData, isLoading: clinicsLoading, refetch: refetchClinics } = useQuery({
    queryKey: ['booking-clinics-with-settings-all'],
    queryFn: fetchAllClinics,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent appointments
  const { data: recentAppointments, refetch: refetchAppointments } = useQuery({
    queryKey: ['recent-appointments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, patient_name, status, preferred_date, preferred_time, created_at, source, clinic:clinics(name)')
        .order('created_at', { ascending: false })
        .limit(25);
      return data || [];
    },
  });

  // Filter clinics based on search and status
  const filteredClinics = useMemo(() => {
    if (!clinicsData) return [];
    
    return clinicsData.filter(clinic => {
      // Search filter
      const matchesSearch = !searchTerm || 
        clinic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clinic.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clinic.city?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const bookingEnabled = clinic.dentist_settings?.booking_enabled ?? true;
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'enabled' && bookingEnabled) ||
        (statusFilter === 'disabled' && !bookingEnabled);
      
      return matchesSearch && matchesStatus;
    });
  }, [clinicsData, searchTerm, statusFilter]);

  // Update clinic booking settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (params: { clinicId: string; settings: Record<string, any> }) => {
      const { error } = await supabase
        .from('dentist_settings')
        .upsert({
          clinic_id: params.clinicId,
          ...params.settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clinic_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-clinics-with-settings-all'] });
      toast.success('Settings updated successfully');
      setShowSettingsDialog(false);
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  // Bulk enable booking for all clinics
  const bulkEnableBookingMutation = useMutation({
    mutationFn: async () => {
      if (!clinicsData) return;
      
      // Get clinics without settings
      const clinicsWithoutSettings = clinicsData.filter(c => !c.dentist_settings);
      
      for (const clinic of clinicsWithoutSettings) {
        await supabase
          .from('dentist_settings')
          .upsert({
            clinic_id: clinic.id,
            booking_enabled: true,
            allow_same_day_booking: true,
            min_advance_booking_hours: 2,
            max_advance_booking_days: 60,
            confirmation_email_enabled: true,
            reminder_sms_enabled: false,
          }, { onConflict: 'clinic_id' });
      }
      
      // Also update existing settings to enable booking
      const { error } = await supabase
        .from('dentist_settings')
        .update({ booking_enabled: true })
        .eq('booking_enabled', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-clinics-with-settings-all'] });
      toast.success('Booking enabled for all clinics!');
    },
    onError: (error) => {
      toast.error(`Failed to enable booking: ${error.message}`);
    },
  });

  const handleEditSettings = (clinic: ClinicWithSettings) => {
    setSelectedClinic(clinic);
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = (settings: Record<string, any>) => {
    if (!selectedClinic) return;
    updateSettingsMutation.mutate({ clinicId: selectedClinic.id, settings });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchClinics(),
      refetchAppointments(),
      queryClient.invalidateQueries({ queryKey: ['booking-funnel-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['booking-trend-data'] }),
    ]);
    setIsRefreshing(false);
    toast.success('Data refreshed!');
  };

  const clinicsWithBookingEnabled = clinicsData?.filter(c => c.dentist_settings?.booking_enabled).length || 0;
  const claimedClinics = clinicsData?.filter(c => c.claim_status === 'claimed').length || 0;
  const totalClinics = clinicsData?.length || 0;

  // Status distribution for pie chart
  const statusDistribution = [
    { name: 'Enabled', value: clinicsWithBookingEnabled, color: 'hsl(var(--teal))' },
    { name: 'Disabled', value: totalClinics - clinicsWithBookingEnabled, color: 'hsl(var(--muted))' },
  ];

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-teal/10 to-primary/5 p-6 border border-primary/20">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-teal blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-primary-foreground" />
              </div>
              Booking System Control
            </h1>
            <p className="text-muted-foreground mt-2">
              Full control over platform-wide booking settings • {totalClinics.toLocaleString()} clinics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => bulkEnableBookingMutation.mutate()}
              disabled={bulkEnableBookingMutation.isPending}
              className="bg-teal hover:bg-teal/90"
            >
              <Power className="h-4 w-4 mr-2" />
              Enable All
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-primary/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid - Row 1: Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{bookingStats?.total?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-500">{bookingStats?.pending || 0}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal/10 to-teal/5 border-teal/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-teal/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-3xl font-bold text-teal">{bookingStats?.confirmed || 0}</p>
                <p className="text-sm text-muted-foreground">Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-coral/10 to-coral/5 border-coral/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-coral/20 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-coral" />
              </div>
              <div>
                <p className="text-3xl font-bold text-coral">{bookingStats?.cancelled || 0}</p>
                <p className="text-sm text-muted-foreground">Cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid - Row 2: Advanced Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple" />
              </div>
              <div>
                <p className="text-2xl font-bold">{funnelStats?.profileViews?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Profile Views (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <MousePointer className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{funnelStats?.bookingStarts || 0}</p>
                <p className="text-xs text-muted-foreground">Booking Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-coral/10 flex items-center justify-center">
                <LogOut className="h-5 w-5 text-coral" />
              </div>
              <div>
                <p className="text-2xl font-bold">{funnelStats?.formDropoffs || 0}</p>
                <p className="text-xs text-muted-foreground">Form Dropoffs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{funnelStats?.conversionRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <FormInput className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bookingStats?.noShow || 0}</p>
                <p className="text-xs text-muted-foreground">No-Shows</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 h-12">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="clinics" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Clinic Settings ({totalClinics.toLocaleString()})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Recent Bookings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  System Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-muted-foreground">Clinics with Booking Enabled</span>
                  <Badge className="bg-teal text-white text-lg px-3">{clinicsWithBookingEnabled.toLocaleString()}</Badge>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-muted-foreground">Claimed Clinics</span>
                  <Badge variant="outline" className="text-lg px-3">{claimedClinics.toLocaleString()}</Badge>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-muted-foreground">This Week</span>
                  <Badge className="bg-blue-500 text-white text-lg px-3">{bookingStats?.thisWeek || 0}</Badge>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-muted-foreground">This Month</span>
                  <Badge className="bg-purple text-white text-lg px-3">{bookingStats?.thisMonth || 0}</Badge>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-muted-foreground">Today</span>
                  <Badge className="bg-gold text-white text-lg px-3">{bookingStats?.today || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Booking Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-teal" />
                  7-Day Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-foreground text-background px-3 py-1.5 rounded-lg text-sm font-bold shadow-lg">
                                {payload[0].value} bookings
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-purple" />
                  Booking Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-4">
                  {statusDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-muted-foreground">{item.name}: {item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features Info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Platform Booking Features
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-teal mt-0.5" />
                  <span>Inline calendar booking on clinic & dentist profiles</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-teal mt-0.5" />
                  <span>GMB-synced clinic hours for accurate time slots</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-teal mt-0.5" />
                  <span>Email confirmations & SMS reminders</span>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-teal mt-0.5" />
                  <span>Returning patient detection</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-teal mt-0.5" />
                  <span>Per-clinic booking settings control</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-teal mt-0.5" />
                  <span>Real-time slot locking to prevent double-booking</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clinics Settings Tab */}
        <TabsContent value="clinics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                All Clinic Booking Settings
              </CardTitle>
              <CardDescription>
                Showing {filteredClinics.length.toLocaleString()} of {totalClinics.toLocaleString()} clinics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, slug, or city..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clinics</SelectItem>
                    <SelectItem value="enabled">Booking Enabled</SelectItem>
                    <SelectItem value="disabled">Booking Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => refetchClinics()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="h-[500px] border rounded-xl">
                {clinicsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading all clinics...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Clinic</TableHead>
                        <TableHead className="font-bold">Location</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold">Booking</TableHead>
                        <TableHead className="font-bold">GMB</TableHead>
                        <TableHead className="text-right font-bold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClinics.map((clinic) => (
                        <TableRow key={clinic.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{clinic.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {clinic.city?.name}{clinic.city?.state?.abbreviation ? `, ${clinic.city.state.abbreviation}` : ''}
                          </TableCell>
                          <TableCell>
                            {clinic.claim_status === 'claimed' ? (
                              <Badge className="bg-teal text-white">Claimed</Badge>
                            ) : (
                              <Badge variant="outline">Unclaimed</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {clinic.dentist_settings?.booking_enabled ? (
                              <Badge className="bg-green-500 text-white">Enabled</Badge>
                            ) : (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {clinic.gmb_connected ? (
                              <Globe className="h-4 w-4 text-teal" />
                            ) : (
                              <Globe className="h-4 w-4 text-muted-foreground/30" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditSettings(clinic)}
                              >
                                <Settings2 className="h-3 w-3 mr-1" />
                                Settings
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/clinic/${clinic.slug}`} target="_blank">
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Booking Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Booking Funnel (7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Profile Views</span>
                      <span className="text-sm text-muted-foreground">{funnelStats?.profileViews?.toLocaleString() || 0}</span>
                    </div>
                    <Progress value={100} className="h-3" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Booking Started</span>
                      <span className="text-sm text-muted-foreground">{funnelStats?.bookingStarts || 0} ({funnelStats?.viewToBookingRate || 0}%)</span>
                    </div>
                    <Progress value={funnelStats?.viewToBookingRate || 0} className="h-3 [&>div]:bg-blue-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Booking Completed</span>
                      <span className="text-sm text-muted-foreground">{funnelStats?.bookingCompletes || 0} ({funnelStats?.conversionRate || 0}%)</span>
                    </div>
                    <Progress value={funnelStats?.conversionRate || 0} className="h-3 [&>div]:bg-teal" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-coral">Form Dropoffs</span>
                      <span className="text-sm text-coral">{funnelStats?.formDropoffs || 0}</span>
                    </div>
                    <Progress 
                      value={funnelStats?.bookingStarts ? ((funnelStats?.formDropoffs || 0) / funnelStats.bookingStarts) * 100 : 0} 
                      className="h-3 [&>div]:bg-coral" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-teal" />
                  Conversion Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-xl text-center">
                    <p className="text-4xl font-bold text-primary">{funnelStats?.viewToBookingRate || 0}%</p>
                    <p className="text-sm text-muted-foreground mt-1">View → Booking Rate</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl text-center">
                    <p className="text-4xl font-bold text-teal">{funnelStats?.conversionRate || 0}%</p>
                    <p className="text-sm text-muted-foreground mt-1">Completion Rate</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl text-center">
                    <p className="text-4xl font-bold text-coral">
                      {bookingStats?.total ? Math.round((bookingStats.cancelled / bookingStats.total) * 100) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Cancellation Rate</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl text-center">
                    <p className="text-4xl font-bold text-gold">
                      {bookingStats?.total ? Math.round((bookingStats.noShow / bookingStats.total) * 100) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">No-Show Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Recent Bookings Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-primary" />
                  Recent Booking Requests
                </CardTitle>
                <CardDescription>Latest 25 booking requests</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchAppointments()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Patient</TableHead>
                      <TableHead className="font-bold">Clinic</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Time</TableHead>
                      <TableHead className="font-bold">Source</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAppointments?.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">{apt.patient_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {(apt.clinic as any)?.name || '-'}
                        </TableCell>
                        <TableCell>{apt.preferred_date || '-'}</TableCell>
                        <TableCell>{apt.preferred_time || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {apt.source || 'direct'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              apt.status === 'confirmed' ? 'bg-teal text-white' :
                              apt.status === 'cancelled' ? 'bg-coral text-white' :
                              apt.status === 'no_show' ? 'bg-gold text-white' :
                              ''
                            }
                            variant={apt.status === 'pending' ? 'secondary' : 'default'}
                          >
                            {apt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(apt.created_at), 'MMM d, h:mm a')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Settings</DialogTitle>
            <DialogDescription>
              Configure booking settings for {selectedClinic?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedClinic && (
            <ClinicSettingsForm
              clinic={selectedClinic}
              onSave={handleSaveSettings}
              onCancel={() => setShowSettingsDialog(false)}
              isLoading={updateSettingsMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Settings Form Component
function ClinicSettingsForm({ 
  clinic, 
  onSave, 
  onCancel, 
  isLoading 
}: { 
  clinic: ClinicWithSettings;
  onSave: (settings: Record<string, any>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const settings = clinic.dentist_settings;
  
  const [bookingEnabled, setBookingEnabled] = useState(settings?.booking_enabled ?? true);
  const [allowSameDay, setAllowSameDay] = useState(settings?.allow_same_day_booking ?? true);
  const [minAdvanceHours, setMinAdvanceHours] = useState(settings?.min_advance_booking_hours ?? 2);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(settings?.max_advance_booking_days ?? 60);
  const [emailEnabled, setEmailEnabled] = useState(settings?.confirmation_email_enabled ?? true);
  const [smsEnabled, setSmsEnabled] = useState(settings?.reminder_sms_enabled ?? false);

  const handleSubmit = () => {
    onSave({
      booking_enabled: bookingEnabled,
      allow_same_day_booking: allowSameDay,
      min_advance_booking_hours: minAdvanceHours,
      max_advance_booking_days: maxAdvanceDays,
      confirmation_email_enabled: emailEnabled,
      reminder_sms_enabled: smsEnabled,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
        <Label htmlFor="booking-enabled" className="font-medium">Enable Booking</Label>
        <Switch
          id="booking-enabled"
          checked={bookingEnabled}
          onCheckedChange={setBookingEnabled}
        />
      </div>

      <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
        <Label htmlFor="same-day" className="font-medium">Allow Same-Day Booking</Label>
        <Switch
          id="same-day"
          checked={allowSameDay}
          onCheckedChange={setAllowSameDay}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="min-hours">Minimum Advance Hours</Label>
        <Select 
          value={String(minAdvanceHours)} 
          onValueChange={(v) => setMinAdvanceHours(Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 4, 6, 12, 24, 48].map(h => (
              <SelectItem key={h} value={String(h)}>{h} hours</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-days">Maximum Advance Days</Label>
        <Select 
          value={String(maxAdvanceDays)} 
          onValueChange={(v) => setMaxAdvanceDays(Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[7, 14, 30, 60, 90, 120].map(d => (
              <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="email-enabled">Email Confirmations</Label>
        </div>
        <Switch
          id="email-enabled"
          checked={emailEnabled}
          onCheckedChange={setEmailEnabled}
        />
      </div>

      <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="sms-enabled">SMS Reminders</Label>
        </div>
        <Switch
          id="sms-enabled"
          checked={smsEnabled}
          onCheckedChange={setSmsEnabled}
        />
      </div>

      <DialogFooter className="pt-4">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading} className="bg-primary">
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogFooter>
    </div>
  );
}
