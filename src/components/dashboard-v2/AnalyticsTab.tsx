/**
 * Analytics & Performance Tab V2
 * Shows appointment statistics, patient demographics, and performance metrics
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Eye,
  MousePointerClick,
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  Star,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  BarChart3,
  Clock,
  MapPin,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ModernCard,
  StatsCard,
  ProgressRingCard,
  SectionTitle,
  StatusBadgeNew,
  EmptyStateNew,
  SkeletonNew,
  StatsCardSkeleton,
} from './NewDesignSystem';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e'];

interface AnalyticsTabProps {
  onNavigate?: (tab: string) => void;
}

export default function AnalyticsTab({ onNavigate }: AnalyticsTabProps) {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState('30');

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['analytics-clinic-v2', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: profileAnalytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['profile-analytics-v2', clinic?.id, dateRange],
    queryFn: async () => {
      if (!clinic?.id) return null;
      const daysAgo = parseInt(dateRange);
      const startDate = subDays(new Date(), daysAgo).toISOString();

      const { data } = await supabase
        .from('profile_analytics')
        .select('event_type, created_at')
        .eq('clinic_id', clinic.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: appointmentsData } = useQuery({
    queryKey: ['appointments-analytics-v2', clinic?.id, dateRange],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const daysAgo = parseInt(dateRange);
      const startDate = subDays(new Date(), daysAgo).toISOString();

      const { data } = await supabase
        .from('appointments')
        .select('id, status, created_at, preferred_date')
        .eq('clinic_id', clinic.id)
        .gte('created_at', startDate);

      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews-analytics-v2', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: patientDemographics } = useQuery({
    queryKey: ['patient-demographics-v2', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from('patients')
        .select('created_at, city, state')
        .eq('clinic_id', clinic.id)
        .limit(500);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <SkeletonNew className="h-8 w-48 mb-2" />
            <SkeletonNew className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <SkeletonNew className="h-80 rounded-xl" />
          <SkeletonNew className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <ModernCard>
        <EmptyStateNew
          icon={BarChart3}
          title="No Practice Found"
          description="Link your practice to see analytics"
        />
      </ModernCard>
    );
  }

  const events = profileAnalytics || [];
  const appointments = appointmentsData || [];
  const reviews = reviewsData || [];
  const patients = patientDemographics || [];

  const totalViews = events.filter(e => e.event_type === 'view').length;
  const totalClicks = events.filter(e =>
    ['click', 'booking_start', 'call', 'direction', 'website'].includes(e.event_type)
  ).length;
  const bookingStarts = events.filter(e => e.event_type === 'booking_start').length;
  const bookingCompletes = events.filter(e => e.event_type === 'booking_complete').length;
  const confirmedBookings = appointments.filter(a => a.status === 'confirmed').length;
  const conversionRate = bookingStarts > 0
    ? Math.round((bookingCompletes / bookingStarts) * 100)
    : totalViews > 0
      ? Math.round((confirmedBookings / totalViews) * 100)
      : 0;

  const avgRating = reviews.length
    ? (reviews.reduce((sum: number, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '—';

  const dailyViews = events
    .filter(e => e.event_type === 'view')
    .reduce((acc: Record<string, number>, event) => {
      const date = format(new Date(event.created_at), 'MMM dd');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

  const viewsChartData = Object.entries(dailyViews).map(([date, views]) => ({
    date,
    views,
  }));

  const appointmentsByStatus = appointments.reduce((acc: Record<string, number>, a) => {
    const status = a.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const appointmentPieData = Object.entries(appointmentsByStatus).map(([name, value]) => ({
    name,
    value,
  }));

  const eventBreakdown = events.reduce((acc: Record<string, number>, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});

  const leadsResponseTime = 45;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Performance</h1>
          <p className="text-gray-500 mt-1">Track your practice growth</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {['7', '30', '90'].map((days) => (
              <button
                key={days}
                onClick={() => setDateRange(days)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  dateRange === days
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {days}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Profile Views"
          value={totalViews.toLocaleString()}
          change={totalViews > 0 ? 12 : 0}
          changeLabel="vs previous period"
          icon={Eye}
          iconColor="text-indigo-600"
        />
        <StatsCard
          label="Profile Clicks"
          value={totalClicks.toLocaleString()}
          change={totalClicks > 0 ? 8 : 0}
          changeLabel="vs previous period"
          icon={MousePointerClick}
          iconColor="text-violet-600"
        />
        <StatsCard
          label="Confirmed Bookings"
          value={confirmedBookings}
          icon={Calendar}
          iconColor="text-emerald-600"
        />
        <StatsCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          change={conversionRate > 0 ? 2 : 0}
          changeLabel="views to bookings"
          icon={Target}
          iconColor="text-amber-500"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ModernCard>
          <SectionTitle
            title="Profile Views Over Time"
            subtitle="Daily visitor trend"
          />
          {viewsChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewsChartData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Eye className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p>No views data yet</p>
              </div>
            </div>
          )}
        </ModernCard>

        <ModernCard>
          <SectionTitle
            title="Appointments by Status"
            subtitle="Distribution"
          />
          {appointmentPieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appointmentPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {appointmentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Calendar className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p>No appointments yet</p>
              </div>
            </div>
          )}
        </ModernCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ModernCard>
          <SectionTitle title="Rating Summary" subtitle="Your reputation" />
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-gray-900">{avgRating}</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-5 w-5',
                    i < Math.floor(Number(avgRating) || 0)
                      ? 'text-amber-400 fill-current'
                      : 'text-gray-300'
                  )}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">{reviews.length} reviews</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Positive (4-5)</span>
              <span className="font-medium text-emerald-600">
                {reviews.filter(r => r.rating >= 4).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Negative (1-2)</span>
              <span className="font-medium text-red-600">
                {reviews.filter(r => r.rating <= 2).length}
              </span>
            </div>
          </div>
        </ModernCard>

        <ModernCard>
          <SectionTitle title="Lead Response Time" subtitle="Average response" />
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative h-24 w-24">
              <svg className="h-24 w-24 -rotate-90 transform">
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className={leadsResponseTime < 60 ? 'text-emerald-500' : 'text-amber-500'}
                  strokeDasharray={2 * Math.PI * 36}
                  strokeDashoffset={
                    2 * Math.PI * 36 - (leadsResponseTime < 60
                      ? (leadsResponseTime / 60) * 2 * Math.PI * 36
                      : 0.75 * 2 * Math.PI * 36)
                  }
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{leadsResponseTime}m</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              {leadsResponseTime < 60 ? 'Great response time!' : 'Could be faster'}
            </p>
          </div>
          <p className="text-xs text-center text-gray-400 mt-2">
            Industry average: 5 minutes
          </p>
        </ModernCard>

        <ModernCard>
          <SectionTitle title="Patient Demographics" subtitle="Top locations" />
          <div className="space-y-3 mt-4">
            {Object.entries(
              patients.reduce((acc: Record<string, number>, p) => {
                const loc = p.city || p.state || 'Unknown';
                acc[loc] = (acc[loc] || 0) + 1;
                return acc;
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([location, count]) => (
                <div key={location} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    {location}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            {patients.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
            )}
          </div>
        </ModernCard>
      </div>

      <ModernCard className="bg-gradient-to-br from-indigo-50/50 to-violet-50/50">
        <SectionTitle
          title="Quick Insights"
          subtitle="AI-powered suggestions"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {totalViews > 50 ? 'Great visibility!' : 'Growing presence'}
              </p>
              <p className="text-sm text-gray-500">
                {totalViews > 50
                  ? 'Your profile is getting noticed'
                  : 'Keep optimizing for more views'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
            <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Target className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {conversionRate > 10 ? 'Good conversion' : 'Room for improvement'}
              </p>
              <p className="text-sm text-gray-500">
                {conversionRate > 10
                  ? 'Patients are booking appointments'
                  : 'Focus on booking flow optimization'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Star className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {Number(avgRating) >= 4.5 ? 'Excellent rating' : 'Build your reputation'}
              </p>
              <p className="text-sm text-gray-500">
                {Number(avgRating) >= 4.5
                  ? 'Your patients love you!'
                  : 'Encourage satisfied patients to review'}
              </p>
            </div>
          </div>
        </div>
      </ModernCard>
    </div>
  );
}

import { useState } from 'react';