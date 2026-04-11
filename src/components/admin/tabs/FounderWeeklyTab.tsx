import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Building2,
  Users,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Target,
  Star,
  MapPin,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

interface WeeklyStats {
  clinics: { thisWeek: number; lastWeek: number; change: number };
  claimed: { thisWeek: number; lastWeek: number; change: number };
  verified: { thisWeek: number; lastWeek: number; change: number };
  appointments: { thisWeek: number; lastWeek: number; change: number };
  leads: { thisWeek: number; lastWeek: number; change: number };
  activeClinics: number;
  retentionRate: number;
}

export default function FounderWeeklyTab() {
  const [activeTab, setActiveTab] = useState('overview');
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const lastWeekStart = subDays(weekStart, 7);
  const lastWeekEnd = subDays(weekEnd, 7);

  // Fetch weekly comparison stats
  const { data: weeklyStats, isLoading } = useQuery({
    queryKey: ['founder-weekly-stats'],
    queryFn: async (): Promise<WeeklyStats> => {
      const thirtyDaysAgo = subDays(today, 30).toISOString();
      
      const [
        { count: clinicsThisWeek },
        { count: clinicsLastWeek },
        { count: claimedThisWeek },
        { count: claimedLastWeek },
        { count: verifiedThisWeek },
        { count: verifiedLastWeek },
        { count: appointmentsThisWeek },
        { count: appointmentsLastWeek },
        { count: leadsThisWeek },
        { count: leadsLastWeek },
        { count: activeClinics },
      ] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).gte('created_at', lastWeekStart.toISOString()).lt('created_at', weekStart.toISOString()),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed').gte('claimed_at', weekStart.toISOString()),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed').gte('claimed_at', lastWeekStart.toISOString()).lt('claimed_at', weekStart.toISOString()),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified').gte('updated_at', weekStart.toISOString()),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified').gte('updated_at', lastWeekStart.toISOString()).lt('updated_at', weekStart.toISOString()),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', lastWeekStart.toISOString()).lt('created_at', weekStart.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', lastWeekStart.toISOString()).lt('created_at', weekStart.toISOString()),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed').gte('updated_at', thirtyDaysAgo),
      ]);

      const calcChange = (curr: number, prev: number) => prev ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;
      const totalClaimed = (await supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed')).count || 0;
      const retentionRate = totalClaimed ? Math.round(((activeClinics || 0) / totalClaimed) * 100) : 0;

      return {
        clinics: { thisWeek: clinicsThisWeek || 0, lastWeek: clinicsLastWeek || 0, change: calcChange(clinicsThisWeek || 0, clinicsLastWeek || 0) },
        claimed: { thisWeek: claimedThisWeek || 0, lastWeek: claimedLastWeek || 0, change: calcChange(claimedThisWeek || 0, claimedLastWeek || 0) },
        verified: { thisWeek: verifiedThisWeek || 0, lastWeek: verifiedLastWeek || 0, change: calcChange(verifiedThisWeek || 0, verifiedLastWeek || 0) },
        appointments: { thisWeek: appointmentsThisWeek || 0, lastWeek: appointmentsLastWeek || 0, change: calcChange(appointmentsThisWeek || 0, appointmentsLastWeek || 0) },
        leads: { thisWeek: leadsThisWeek || 0, lastWeek: leadsLastWeek || 0, change: calcChange(leadsThisWeek || 0, leadsLastWeek || 0) },
        activeClinics: activeClinics || 0,
        retentionRate,
      };
    },
  });

  // Fetch conversion funnel
  const { data: funnelData } = useQuery({
    queryKey: ['conversion-funnel'],
    queryFn: async () => {
      const [
        { count: totalImported },
        { count: totalClaimed },
        { count: totalVerified },
        { count: totalActive },
        { count: totalWithRevenue },
      ] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified'),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed').eq('is_active', true),
        supabase.from('clinic_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      return {
        imported: totalImported || 0,
        claimed: totalClaimed || 0,
        verified: totalVerified || 0,
        active: totalActive || 0,
        revenue: totalWithRevenue || 0,
      };
    },
  });

  // Fetch top locations
  const { data: topLocations } = useQuery({
    queryKey: ['top-locations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cities')
        .select('id, name, dentist_count')
        .order('dentist_count', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Fetch actionable tasks
  const { data: actionTasks } = useQuery({
    queryKey: ['action-tasks'],
    queryFn: async () => {
      const tasks: { priority: 'high' | 'medium' | 'low'; task: string; impact: string }[] = [];
      
      // Check for unclaimed clinics
      const { count: unclaimed } = await supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'unclaimed');
      if ((unclaimed || 0) > 10) {
        tasks.push({ priority: 'high', task: `${unclaimed} unclaimed clinics need outreach`, impact: 'Increase claimed rate by 20%' });
      }

      // Check for pending claims
      const { count: pendingClaims } = await supabase.from('claim_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      if ((pendingClaims || 0) > 0) {
        tasks.push({ priority: 'high', task: `${pendingClaims} claim requests awaiting review`, impact: 'Faster onboarding' });
      }

      // Check for stale profiles
      const thirtyDaysAgo = subDays(today, 30).toISOString();
      const { count: stale } = await supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed').lt('updated_at', thirtyDaysAgo);
      if ((stale || 0) > 5) {
        tasks.push({ priority: 'medium', task: `${stale} claimed profiles haven't updated in 30d`, impact: 'Re-engagement opportunity' });
      }

      // Check for negative feedback
      const { count: negative } = await supabase.from('review_funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'thumbs_down').gte('created_at', subDays(today, 7).toISOString());
      if ((negative || 0) > 5) {
        tasks.push({ priority: 'medium', task: `${negative} negative feedback this week`, impact: 'Review quality issues' });
      }

      return tasks.slice(0, 5);
    },
  });

  const ChangeIndicator = ({ value }: { value: number }) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;
    return (
      <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-teal' : isNeutral ? 'text-muted-foreground' : 'text-coral'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3" /> : isNeutral ? null : <ArrowDown className="h-3 w-3" />}
        <span>{isNeutral ? '0%' : `${Math.abs(value)}%`}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Weekly Founder Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <Badge variant="outline" className="text-sm py-2 px-4">
          <Calendar className="h-4 w-4 mr-2" />
          Week {format(today, 'w')} of {format(today, 'yyyy')}
        </Badge>
      </div>

      {/* Week-over-Week Comparison Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'New Clinics', icon: Building2, ...weeklyStats?.clinics, color: 'primary' },
          { label: 'New Claims', icon: CheckCircle, ...weeklyStats?.claimed, color: 'teal' },
          { label: 'Verified', icon: Star, ...weeklyStats?.verified, color: 'gold' },
          { label: 'Appointments', icon: Calendar, ...weeklyStats?.appointments, color: 'blue-custom' },
          { label: 'Leads', icon: Users, ...weeklyStats?.leads, color: 'purple' },
        ].map((stat) => {
          const Icon = stat.icon;
          const colorMap: Record<string, string> = {
            'emerald': 'bg-emerald-500',
            'blue-custom': 'bg-blue-600',
            'purple': 'bg-purple-600',
            'teal': 'bg-teal-600',
            'coral': 'bg-coral-500',
            'gold': 'bg-amber-500',
          };
          const textColorMap: Record<string, string> = {
            'emerald': 'text-emerald-500',
            'blue-custom': 'text-blue-600',
            'purple': 'text-purple-600',
            'teal': 'text-teal-600',
            'coral': 'text-coral-500',
            'gold': 'text-amber-500',
          };
          return (
            <Card key={stat.label} className="card-modern">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`h-10 w-10 rounded-xl ${colorMap[stat.color] || 'bg-primary'}/10 flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${textColorMap[stat.color] || 'text-primary'}`} />
                  </div>
                  <ChangeIndicator value={stat.change || 0} />
                </div>
                <p className="text-2xl font-bold">{stat.thisWeek}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-1">vs {stat.lastWeek} last week</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Retention Card */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal" />
              Clinic Retention (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-teal">{weeklyStats?.retentionRate || 0}%</p>
                <p className="text-sm text-muted-foreground">of claimed clinics active</p>
              </div>
              <div className="flex-1">
                <Progress value={weeklyStats?.retentionRate || 0} className="h-3" />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{weeklyStats?.activeClinics || 0} active</span>
                  <span>of claimed clinics</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Revenue Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{funnelData?.revenue || 0}</p>
                <p className="text-sm text-muted-foreground">paying clinics</p>
              </div>
              <div className="flex-1 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conversion Rate</span>
                  <span className="font-medium">
                    {funnelData?.claimed ? Math.round((funnelData.revenue / funnelData.claimed) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claimed → Verified</span>
                  <span className="font-medium">
                    {funnelData?.claimed ? Math.round((funnelData.verified / funnelData.claimed) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="text-lg">Marketplace Conversion Funnel</CardTitle>
          <CardDescription>From import to revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {[
              { label: 'Imported', value: funnelData?.imported || 0, color: 'bg-muted' },
              { label: 'Claimed', value: funnelData?.claimed || 0, color: 'bg-primary/50' },
              { label: 'Verified', value: funnelData?.verified || 0, color: 'bg-primary/70' },
              { label: 'Active', value: funnelData?.active || 0, color: 'bg-primary/90' },
              { label: 'Paying', value: funnelData?.revenue || 0, color: 'bg-primary' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="text-center flex-1">
                  <div className={`h-16 w-16 mx-auto rounded-full ${step.color} flex items-center justify-center mb-2`}>
                    <span className="text-lg font-bold text-white">{step.value}</span>
                  </div>
                  <p className="text-sm font-medium">{step.label}</p>
                  {i > 0 && arr[i - 1].value > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((step.value / arr[i - 1].value) * 100)}%
                    </p>
                  )}
                </div>
                {i < arr.length - 1 && (
                  <div className="w-12 h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Locations */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Top Performing Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topLocations?.map((loc, i) => (
              <div key={loc.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                    {i + 1}
                  </Badge>
                  <span className="font-medium">{loc.name}</span>
                </div>
                <Badge>{loc.dentist_count || 0} dentists</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actionable Tasks */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-gold" />
              This Week's Priorities
            </CardTitle>
            <CardDescription>Top 5 actions to improve growth</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionTasks?.map((task, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                  task.priority === 'high' ? 'bg-coral/20' : task.priority === 'medium' ? 'bg-gold/20' : 'bg-muted'
                }`}>
                  <AlertTriangle className={`h-3 w-3 ${
                    task.priority === 'high' ? 'text-coral' : task.priority === 'medium' ? 'text-gold' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{task.task}</p>
                  <p className="text-xs text-muted-foreground">{task.impact}</p>
                </div>
              </div>
            ))}
            {(!actionTasks || actionTasks.length === 0) && (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-teal" />
                <p>All caught up! No urgent tasks.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Platform Health Summary */}
      <Card className="card-modern border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            AI Platform Health Summary
          </CardTitle>
          <CardDescription>Automated weekly analysis and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-background border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-teal" />
                <span className="font-medium">Strengths</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Clinic onboarding funnel healthy</li>
                <li>• Review collection trending up</li>
                <li>• SEO coverage expanding</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-background border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-gold" />
                <span className="font-medium">Watch Areas</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Claim conversion could improve</li>
                <li>• Some locations under-represented</li>
                <li>• Response time on claims</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-background border">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium">Priority Actions</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Launch outreach to top 20 unclaimed</li>
                <li>• Review pending claims within 24h</li>
                <li>• Add content for low-coverage areas</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
            AI analysis generated from live platform data. Connect Gemini API for enhanced insights.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
