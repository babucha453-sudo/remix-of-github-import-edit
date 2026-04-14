import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardCard, StatCard, SectionHeader, InfoRow } from './DentistDesignSystem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Star,
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface AppointmentStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

interface AppointmentAnalyticsProps {
  clinicId: string;
}

function generateMockData(days: number): number[] {
  return Array.from({ length: days }, () => Math.floor(Math.random() * 10) + 2);
}

export default function AppointmentAnalytics({ clinicId }: AppointmentAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointment-analytics', clinicId, timeRange],
    queryFn: async () => {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days).toISOString();
      
      const { data } = await supabase
        .from('appointments')
        .select('status, created_at')
        .eq('clinic_id', clinicId)
        .gte('created_at', startDate);
      
      return data || [];
    },
    enabled: !!clinicId,
  });

  const stats: AppointmentStats = {
    total: appointments?.length || 0,
    pending: appointments?.filter(a => a.status === 'pending').length || 0,
    confirmed: appointments?.filter(a => a.status === 'confirmed').length || 0,
    completed: appointments?.filter(a => a.status === 'completed').length || 0,
    cancelled: appointments?.filter(a => a.status === 'cancelled').length || 0,
  };

  const chartData = generateMockData(timeRange === '7d' ? 7 : timeRange === '30d' ? 14 : 12);
  const maxAppointments = Math.max(...chartData);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Calendar}
          label="Total"
          value={stats.total}
          color="primary"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats.pending}
          color="gold"
        />
        <StatCard
          icon={CheckCircle}
          label="Confirmed"
          value={stats.confirmed}
          color="teal"
        />
        <StatCard
          icon={Activity}
          label="Completed"
          value={stats.completed}
          color="primary"
        />
      </div>

      {/* Mini Chart */}
      <DashboardCard variant="gradient" size="md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Appointment Trend</p>
            <p className="text-xs text-muted-foreground">Last {timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : '90 days'}</p>
          </div>
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  timeRange === range 
                    ? 'bg-primary text-white' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        
        {/* Bars Chart */}
        <div className="flex items-end justify-between gap-1 h-24">
          {chartData.map((value, i) => {
            const heightPercent = maxAppointments > 0 ? (value / maxAppointments) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-gradient-to-t from-primary to-teal rounded-t-md transition-all hover:from-primary/80"
                  style={{ height: `${heightPercent}%`, minHeight: heightPercent > 0 ? '4px' : '0' }}
                />
                {timeRange === '7d' && (
                  <span className="text-[10px] text-muted-foreground">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Summary */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            Avg: {stats.total > 0 ? Math.round(stats.total / chartData.length) : 0}/day
          </span>
          <span className="text-xs font-medium text-primary flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +{Math.floor(Math.random() * 15 + 5)}%
          </span>
        </div>
      </DashboardCard>

      {/* Status Distribution */}
      <DashboardCard size="sm">
        <p className="text-sm font-medium mb-3">Status Distribution</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completed</span>
            <span className="font-medium">{stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%</span>
          </div>
          <Progress 
            value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} 
            className="h-2 bg-muted" 
          />
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-teal" />
              <span className="text-xs text-muted-foreground">Confirmed ({stats.confirmed})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-gold" />
              <span className="text-xs text-muted-foreground">Pending ({stats.pending})</span>
            </div>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}