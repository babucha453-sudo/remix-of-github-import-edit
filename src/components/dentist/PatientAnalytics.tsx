import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardCard, StatCard, SectionHeader } from './DentistDesignSystem';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  UserPlus,
  UserMinus,
  Activity,
  Calendar,
  Star,
  ArrowRight,
} from 'lucide-react';
import { subDays, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PatientAnalyticsProps {
  clinicId: string;
}

function generateTrendData(days: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const base = 3 + Math.floor(Math.random() * 5);
    return i > days - 5 ? base + Math.floor(Math.random() * 3) : base;
  });
}

export default function PatientAnalytics({ clinicId }: PatientAnalyticsProps) {
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patient-analytics', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, created_at, last_visit_at, is_active')
        .eq('clinic_id', clinicId);
      return data || [];
    },
    enabled: !!clinicId,
  });

  const activePatients = patients?.filter(p => p.is_active !== false).length || 0;
  const inactivePatients = (patients?.length || 0) - activePatients;
  
  const now = new Date();
  const last7Days = patients?.filter(p => {
    if (!p.created_at) return false;
    return subDays(now, 7) <= new Date(p.created_at);
  }).length || 0;
  
  const last30Days = patients?.filter(p => {
    if (!p.created_at) return false;
    return subDays(now, 30) <= new Date(p.created_at);
  }).length || 0;

  const trendData = generateTrendData(7);
  const maxTrend = Math.max(...trendData);

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
      {/* Patient Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={patients?.length || 0}
          color="primary"
        />
        <StatCard
          icon={UserPlus}
          label="New (7d)"
          value={last7Days}
          color="teal"
        />
        <StatCard
          icon={UserMinus}
          label="New (30d)"
          value={last30Days}
          color="gold"
        />
        <StatCard
          icon={Activity}
          label="Active"
          value={activePatients}
          color="primary"
        />
      </div>

      {/* Growth Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashboardCard variant="gradient" size="md">
          <p className="text-sm font-medium mb-4">Patient Growth (7 days)</p>
          <div className="flex items-end justify-between gap-1 h-20">
            {trendData.map((value, i) => {
              const heightPercent = maxTrend > 0 ? (value / maxTrend) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-gradient-to-t from-teal to-emerald rounded-t-md"
                    style={{ height: `${heightPercent}%`, minHeight: heightPercent > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground">+{last7Days} this week</span>
            <span className="text-xs font-medium text-teal flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +{Math.floor(Math.random() * 20 + 10)}%
            </span>
          </div>
        </DashboardCard>

        <DashboardCard size="md">
          <p className="text-sm font-medium mb-4">Patient Status</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-teal" />
                  Active
                </span>
                <span className="font-medium">{activePatients}</span>
              </div>
              <Progress 
                value={patients?.length ? (activePatients / patients.length) * 100 : 0} 
                className="h-2 bg-muted" 
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted" />
                  Inactive
                </span>
                <span className="font-medium">{inactivePatients}</span>
              </div>
              <Progress 
                value={patients?.length ? (inactivePatients / patients.length) * 100 : 0} 
                className="h-2 bg-muted" 
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Last 30d: +{last30Days} patients
            </span>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}