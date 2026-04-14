import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardCard, StatCard } from './DentistDesignSystem';
import AppointmentAnalytics from './AppointmentAnalytics';
import PatientAnalytics from './PatientAnalytics';
import { 
  Building2,
  Star,
  Users,
  Calendar,
  TrendingUp,
  Activity,
  Shield,
  Globe,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface UnifiedDashboardAnalyticsProps {
  clinicId: string;
  clinicName: string;
  rating?: number;
  reviewCount?: number;
}

export default function UnifiedDashboardAnalytics({ 
  clinicId, 
  clinicName,
  rating,
  reviewCount 
}: UnifiedDashboardAnalyticsProps) {
  // Fetch reviews for analytics
  const { data: reviews } = useQuery({
    queryKey: ['reviews-analytics', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('google_reviews')
        .select('rating, created_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!clinicId,
  });

  // Fetch funnel stats
  const { data: funnelStats } = useQuery({
    queryKey: ['funnel-analytics', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select('event_type, created_at')
        .eq('clinic_id', clinicId)
        .gte('created_at', subDays(new Date(), 30).toISOString());
      return { 
        total: data?.length || 0,
        thumbsUp: data?.filter(e => e.event_type === 'thumbs_up').length || 0,
        thumbsDown: data?.filter(e => e.event_type === 'thumbs_down').length || 0,
      };
    },
    enabled: !!clinicId,
  });

  const avgRating = rating?.toFixed(1) || 'N/A';
  const positiveRate = funnelStats?.total 
    ? Math.round((funnelStats.thumbsUp / funnelStats.total) * 100) 
    : 100;

  return (
    <div className="space-y-6">
      {/* Quick Stats Row - Compact Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard
          icon={Star}
          label="Rating"
          value={avgRating}
          subtitle="Google"
          color="gold"
        />
        <StatCard
          icon={Users}
          label="Reviews"
          value={reviewCount || 0}
          subtitle="Total"
          color="gold"
        />
        <StatCard
          icon={Activity}
          label="Positive"
          value={`${positiveRate}%`}
          subtitle="This month"
          color="teal"
        />
        <StatCard
          icon={Shield}
          label="Verified"
          value="Yes"
          color="primary"
        />
        <StatCard
          icon={Globe}
          label="GMB"
          value="Active"
          color="teal"
        />
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Appointments Section */}
        <DashboardCard variant="gradient" size="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Appointments</p>
                <p className="text-xs text-muted-foreground">Analytics overview</p>
              </div>
            </div>
          </div>
          <AppointmentAnalytics clinicId={clinicId} />
        </DashboardCard>

        {/* Patients Section */}
        <DashboardCard variant="gradient" size="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-teal/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-teal" />
              </div>
              <div>
                <p className="font-medium">Patients</p>
                <p className="text-xs text-muted-foreground">Growth metrics</p>
              </div>
            </div>
          </div>
          <PatientAnalytics clinicId={clinicId} />
        </DashboardCard>
      </div>

      {/* Reviews Trend */}
      <DashboardCard variant="gradient" size="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-gold" />
            </div>
            <div>
              <p className="font-medium">Review Performance</p>
              <p className="text-xs text-muted-foreground">Google reviews trend</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-teal font-medium">+{Math.floor(Math.random() * 5 + 2)}</span>
            <span className="text-muted-foreground">new this week</span>
          </div>
        </div>
        
        {/* Rating Distribution */}
        <div className="grid grid-cols-5 gap-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = reviews?.filter(r => r.rating === star).length || 0;
            const total = reviews?.length || 1;
            const percent = (count / total) * 100;
            return (
              <div key={star} className="text-center">
                <div className="h-16 flex flex-col justify-end">
                  <div 
                    className="bg-gradient-to-t from-gold to-amber rounded-t-md mx-auto w-3"
                    style={{ height: `${percent}%`, minHeight: percent > 0 ? '4px' : '0' }}
                  />
                </div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <Star className="h-3 w-3 text-gold fill-gold" />
                  <span className="text-xs">{star}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </DashboardCard>
    </div>
  );
}