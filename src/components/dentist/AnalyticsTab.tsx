import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MousePointerClick,
  Users,
  Calendar,
  Star,
  Download,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Globe,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useState } from 'react';
import { format, subDays } from 'date-fns';

const StatCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'neutral',
  icon: Icon,
  description 
}: {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: any;
  description?: string;
}) => (
  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              changeType === 'positive' ? 'text-emerald-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {changeType === 'positive' ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : changeType === 'negative' ? (
                <ArrowDownRight className="h-4 w-4" />
              ) : null}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
          {description && (
            <p className="text-xs text-gray-400 mt-2">{description}</p>
          )}
        </div>
        <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Icon className="h-6 w-6 text-emerald-600" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function AnalyticsTab() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState('30');

  // Fetch clinic
  const { data: clinic } = useQuery({
    queryKey: ['analytics-clinic', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch profile views
  const { data: profileViews = [] } = useQuery({
    queryKey: ['profile-views', clinic?.id, dateRange],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const daysAgo = parseInt(dateRange);
      const startDate = subDays(new Date(), daysAgo).toISOString();
      
      const { data } = await supabase
        .from('profile_views')
        .select('*')
        .eq('clinic_id', clinic.id)
        .gte('viewed_at', startDate);
      
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ['analytics-appointments', clinic?.id, dateRange],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const daysAgo = parseInt(dateRange);
      const startDate = subDays(new Date(), daysAgo).toISOString();
      
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', clinic.id)
        .gte('created_at', startDate);
      
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['analytics-reviews', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Calculate metrics
  const totalViews = profileViews.length;
  const totalClicks = profileViews.filter(v => v.action_type === 'click').length;
  const totalBookings = appointments.filter(a => a.status === 'confirmed').length;
  const conversionRate = totalViews > 0 ? ((totalBookings / totalViews) * 100).toFixed(1) : '0';
  
  const avgRating = reviews.length 
    ? (reviews.reduce((sum: number, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : 'N/A';

  // Views by day
  const viewsByDay = profileViews.reduce((acc: Record<string, number>, v) => {
    const date = format(new Date(v.viewed_at), 'MMM dd');
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(viewsByDay).map(([name, views]) => ({ name, views: views as number }));

  // Appointments by status
  const appointmentsByStatus = appointments.reduce((acc: Record<string, number>, a) => {
    const status = a.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Top referrers
  const topReferrers = profileViews.reduce((acc: Record<string, number>, v) => {
    const source = v.referrer || 'Direct';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const referrerData = Object.entries(topReferrers)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
    .map(([name, value]) => ({ name, value: value as number }));

  // Top locations
  const topLocations = profileViews.reduce((acc: Record<string, number>, v) => {
    const loc = v.city || v.state || 'Unknown';
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {});
  const locationData = Object.entries(topLocations)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
    .map(([name, value]) => ({ name, value: value as number }));

  if (!clinic) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No clinic linked to your account</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Performance</h1>
          <p className="text-gray-500 mt-1">Track your practice growth and patient engagement</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Profile Views"
          value={totalViews.toLocaleString()}
          change={12}
          changeType="positive"
          icon={Eye}
          description="Unique visitors"
        />
        <StatCard
          title="Profile Clicks"
          value={totalClicks.toLocaleString()}
          change={8}
          changeType="positive"
          icon={MousePointerClick}
          description="Phone, directions clicks"
        />
        <StatCard
          title="Total Bookings"
          value={totalBookings}
          change={-3}
          changeType="negative"
          icon={Calendar}
          description="Confirmed appointments"
        />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          change={2}
          changeType="positive"
          icon={Target}
          description="Views to bookings"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Chart */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Profile Views</CardTitle>
            <CardDescription>Daily visitor count</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="space-y-2">
                {chartData.slice(-7).map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-16">{item.name}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded"
                        style={{ width: `${(item.views / (Math.max(...chartData.map((d: { views: number }) => d.views)) || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{item.views as number}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400">
                No views data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointments Chart */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Appointments</CardTitle>
            <CardDescription>By status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(appointmentsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700 capitalize">{status}</span>
                  <Badge variant="outline" className="bg-white">{count as number}</Badge>
                </div>
              ))}
              {Object.keys(appointmentsByStatus).length === 0 && (
                <p className="text-gray-400 text-center py-4">No appointments yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Referrers */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Traffic Sources</CardTitle>
            <CardDescription>Where patients found you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrerData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.name}</span>
<div className="flex items-center gap-2">
                     <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-emerald-500 rounded-full"
                         style={{ width: `${(item.value / (referrerData[0]?.value || 1)) * 100}%` }}
                       />
                     </div>
                     <span className="text-sm font-medium text-gray-900 w-6 text-right">{item.value as number}</span>
                   </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Locations */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top Locations</CardTitle>
            <CardDescription>Search locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {locationData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    {item.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{item.value as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rating */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Review Summary</CardTitle>
            <CardDescription>Your reputation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-gray-900">{avgRating}</div>
              <div className="flex items-center justify-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i} 
                    className={`h-5 w-5 ${i < Math.floor(Number(avgRating) || 0) ? 'text-amber-400 fill-current' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">{reviews.length} reviews</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Positive (4-5★)</span>
                <span className="font-medium text-emerald-600">{reviews.filter(r => r.rating >= 4).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Negative (1-2★)</span>
                <span className="font-medium text-red-600">{reviews.filter(r => r.rating <= 2).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {totalViews === 0 && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">No profile views yet</p>
                  <p className="text-sm text-gray-500">Complete your profile to attract patients</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Top performing day: Thursday</p>
                <p className="text-sm text-gray-500">Consider blocking less time on Thursdays</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Profile completion: 85%</p>
                <p className="text-sm text-gray-500">Add more photos to reach 100%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}