import { useProfileAnalytics } from '@/hooks/useProfileAnalytics';
import { useLeadQuota } from '@/hooks/useLeadQuota';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  MousePointerClick, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Phone,
  MapPin,
  Globe,
  Users,
  Target,
  BarChart3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';

interface AnalyticsDashboardProps {
  clinicId: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AnalyticsDashboard({ clinicId }: AnalyticsDashboardProps) {
  const { data: analytics, isLoading: analyticsLoading } = useProfileAnalytics(clinicId);
  const { data: quota, isLoading: quotaLoading } = useLeadQuota(clinicId);

  if (analyticsLoading || quotaLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const quotaPercentage = quota 
    ? Math.round((quota.leads_used / quota.quota_limit) * 100) 
    : 0;

  const eventLabels: Record<string, string> = {
    view: 'Profile Views',
    click: 'Clicks',
    booking_start: 'Booking Started',
    booking_complete: 'Bookings Complete',
    call: 'Phone Clicks',
    direction: 'Direction Clicks',
    website: 'Website Clicks'
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Profile Views</p>
                <p className="text-3xl font-bold">{analytics?.totalViews || 0}</p>
              </div>
              <div className={`flex items-center gap-1 text-sm ${analytics?.viewsTrend && analytics.viewsTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {analytics?.viewsTrend && analytics.viewsTrend >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{Math.abs(analytics?.viewsTrend || 0)}%</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-400" />
              <span className="text-xs text-slate-400">vs last 30 days</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Engagement Clicks</p>
                <p className="text-3xl font-bold">{analytics?.totalClicks || 0}</p>
              </div>
              <div className={`flex items-center gap-1 text-sm ${analytics?.clicksTrend && analytics.clicksTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {analytics?.clicksTrend && analytics.clicksTrend >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{Math.abs(analytics?.clicksTrend || 0)}%</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <MousePointerClick className="h-5 w-5 text-teal-400" />
              <span className="text-xs text-slate-400">vs last 30 days</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Booking Conversion</p>
                <p className="text-3xl font-bold">{analytics?.conversionRate || 0}%</p>
              </div>
              <Badge className="bg-primary/20 text-primary">
                {analytics?.bookingCompletes || 0} bookings
              </Badge>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gold" />
              <span className="text-xs text-slate-400">{analytics?.bookingStarts || 0} started</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Lead Quota</p>
                <p className="text-3xl font-bold">
                  {quota?.leads_used || 0}/{quota?.quota_limit || 0}
                </p>
              </div>
              <Target className={`h-6 w-6 ${quotaPercentage >= 80 ? 'text-red-400' : 'text-emerald-400'}`} />
            </div>
            <Progress 
              value={quotaPercentage} 
              className="mt-4 h-2"
            />
            <p className="text-xs text-slate-400 mt-2">
              {quotaPercentage >= 80 ? 'Nearing limit - consider upgrading' : 'Leads remaining this period'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Views Over Time */}
        <Card className="lg:col-span-2 bg-slate-900 border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Profile Views (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.dailyViews || []}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelFormatter={(date) => format(new Date(date), 'MMMM d, yyyy')}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#3b82f6" 
                    fill="url(#viewsGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Event Breakdown */}
        <Card className="bg-slate-900 border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Engagement Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.eventBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="type"
                  >
                    {analytics?.eventBreakdown?.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value, name) => [value, eventLabels[name as string] || name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {analytics?.eventBreakdown?.slice(0, 4).map((event, index) => (
                <div key={event.type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                    />
                    <span className="text-slate-400">{eventLabels[event.type] || event.type}</span>
                  </div>
                  <span className="text-white font-medium">{event.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Phone className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{analytics?.calls || 0}</p>
              <p className="text-xs text-slate-400">Phone Clicks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{analytics?.directions || 0}</p>
              <p className="text-xs text-slate-400">Direction Clicks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{analytics?.websiteClicks || 0}</p>
              <p className="text-xs text-slate-400">Website Clicks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{analytics?.bookingCompletes || 0}</p>
              <p className="text-xs text-slate-400">Bookings</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
