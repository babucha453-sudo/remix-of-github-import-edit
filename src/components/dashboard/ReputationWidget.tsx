import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  ThumbsUp, 
  ThumbsDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { subDays, startOfDay } from 'date-fns';

interface ReputationWidgetProps {
  clinicId: string;
  rating?: number;
  reviewCount?: number;
  onViewDetails?: () => void;
}

export default function ReputationWidget({ 
  clinicId, 
  rating = 0, 
  reviewCount = 0,
  onViewDetails 
}: ReputationWidgetProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['reputation-widget', clinicId],
    queryFn: async () => {
      const thirtyDaysAgo = startOfDay(subDays(new Date(), 30)).toISOString();
      const sevenDaysAgo = startOfDay(subDays(new Date(), 7)).toISOString();
      
      const [allTimeResult, last30Result, last7Result] = await Promise.all([
        supabase
          .from('review_funnel_events')
          .select('event_type')
          .eq('clinic_id', clinicId),
        supabase
          .from('review_funnel_events')
          .select('event_type')
          .eq('clinic_id', clinicId)
          .gte('created_at', thirtyDaysAgo),
        supabase
          .from('review_funnel_events')
          .select('event_type')
          .eq('clinic_id', clinicId)
          .gte('created_at', sevenDaysAgo),
      ]);

      const allTime = allTimeResult.data || [];
      const last30 = last30Result.data || [];
      const last7 = last7Result.data || [];

      return {
        allTime: {
          thumbsUp: allTime.filter(e => e.event_type === 'thumbs_up').length,
          thumbsDown: allTime.filter(e => e.event_type === 'thumbs_down').length,
          total: allTime.length,
        },
        last30: {
          thumbsUp: last30.filter(e => e.event_type === 'thumbs_up').length,
          thumbsDown: last30.filter(e => e.event_type === 'thumbs_down').length,
          total: last30.length,
        },
        last7: {
          thumbsUp: last7.filter(e => e.event_type === 'thumbs_up').length,
          thumbsDown: last7.filter(e => e.event_type === 'thumbs_down').length,
          total: last7.length,
        },
      };
    },
    enabled: !!clinicId,
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full bg-slate-700/50" />
        </CardContent>
      </Card>
    );
  }

  const positiveRate = stats?.allTime.total 
    ? Math.round((stats.allTime.thumbsUp / stats.allTime.total) * 100) 
    : 100;

  const ratingHealth = rating >= 4.5 ? 'excellent' : rating >= 4 ? 'good' : rating >= 3 ? 'fair' : 'needs_attention';
  
  const healthConfig = {
    excellent: { label: 'Excellent', color: 'text-teal bg-teal/20 border-teal/30', icon: TrendingUp },
    good: { label: 'Good', color: 'text-teal bg-teal/15 border-teal/25', icon: TrendingUp },
    fair: { label: 'Fair', color: 'text-gold bg-gold/20 border-gold/30', icon: TrendingDown },
    needs_attention: { label: 'Needs Work', color: 'text-coral bg-coral/20 border-coral/30', icon: TrendingDown },
  };

  const config = healthConfig[ratingHealth];
  const HealthIcon = config.icon;

  return (
    <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg overflow-hidden">
      {/* Teal accent bar */}
      <div className="h-1 bg-gradient-to-r from-teal to-primary" />
      
      {/* Header */}
      <div className="relative p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-teal" />
            </div>
            <CardTitle className="text-lg text-white">Reputation Score</CardTitle>
          </div>
          <Badge className={cn("border", config.color)}>
            <HealthIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        
        {/* Main rating display */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-extrabold text-white">{rating.toFixed(1)}</span>
              <Star className="h-8 w-8 text-gold fill-gold" />
            </div>
            <p className="text-sm text-white/60 mt-1">
              {reviewCount} Google reviews
            </p>
          </div>
          
          {/* Positive rate ring */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative h-24 w-24">
              <svg className="h-24 w-24 -rotate-90">
                <circle
                  className="text-white/10"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="48"
                  cy="48"
                />
                <circle
                  className="text-teal transition-all duration-500"
                  strokeWidth="8"
                  strokeDasharray={`${positiveRate * 2.51} 251`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="48"
                  cy="48"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{positiveRate}%</span>
                <span className="text-[10px] text-white/50">Positive</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4 pt-3 bg-slate-900/50 border-t border-slate-700/50">
        {/* Stats breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 rounded-xl bg-slate-700/40 border border-slate-600/50">
            <p className="text-xs text-white/50 mb-1">All Time</p>
            <div className="flex items-center justify-center gap-2">
              <span className="flex items-center gap-0.5 text-sm font-bold text-teal">
                <ThumbsUp className="h-3 w-3" /> {stats?.allTime.thumbsUp || 0}
              </span>
              <span className="text-white/30">/</span>
              <span className="flex items-center gap-0.5 text-sm font-bold text-coral">
                <ThumbsDown className="h-3 w-3" /> {stats?.allTime.thumbsDown || 0}
              </span>
            </div>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-700/40 border border-slate-600/50">
            <p className="text-xs text-white/50 mb-1">Last 30 Days</p>
            <p className="text-lg font-bold text-white">{stats?.last30.total || 0}</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-700/40 border border-slate-600/50">
            <p className="text-xs text-white/50 mb-1">Last 7 Days</p>
            <p className="text-lg font-bold text-white">{stats?.last7.total || 0}</p>
          </div>
        </div>

        {onViewDetails && (
          <Button 
            variant="outline" 
            className="w-full justify-between text-sm font-semibold bg-transparent border-teal/30 text-teal hover:bg-teal/10 hover:border-teal/50"
            onClick={onViewDetails}
          >
            View Full Analytics
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
