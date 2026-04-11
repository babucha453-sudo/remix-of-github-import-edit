import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Activity,
  Star,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  QrCode,
  Clock,
  Eye,
  Send,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import NegativeFeedbackPanel from './NegativeFeedbackPanel';

interface ReputationOverviewTabProps {
  clinicId: string;
  clinicName: string;
  googlePlaceId?: string | null;
  rating?: number;
  reviewCount?: number;
  onSendRequest: () => void;
  onOpenQR: () => void;
  onSync: () => void;
}

export default function ReputationOverviewTab({
  clinicId,
  clinicName,
  googlePlaceId,
  rating,
  reviewCount,
  onSendRequest,
  onOpenQR,
  onSync,
}: ReputationOverviewTabProps) {
  // Fetch funnel events
  const { data: funnelEvents = [], isLoading: funnelLoading } = useQuery({
    queryKey: ['reputation-funnel-overview', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  // Fetch Google reviews
  const { data: googleReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['google-reviews-overview', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('google_reviews')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('review_time', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sevenDaysAgo = subDays(now, 7);

    const total = funnelEvents.length;
    const thumbsUp = funnelEvents.filter((e: any) => e.event_type === 'thumbs_up').length;
    const thumbsDown = funnelEvents.filter((e: any) => e.event_type === 'thumbs_down').length;
    const conversionRate = total > 0 ? (thumbsUp / total) * 100 : 0;

    const last30 = funnelEvents.filter((e: any) => new Date(e.created_at) >= thirtyDaysAgo);
    const last7 = funnelEvents.filter((e: any) => new Date(e.created_at) >= sevenDaysAgo);
    const last30Up = last30.filter((e: any) => e.event_type === 'thumbs_up').length;
    const last7Up = last7.filter((e: any) => e.event_type === 'thumbs_up').length;

    // Unreplied reviews
    const unreplied = googleReviews.filter((r: any) => r.reply_status !== 'posted').length;

    // Calculate reputation score
    const avgRating = rating || 0;
    const ratingScore = (avgRating / 5) * 40;
    const velocityScore = Math.min(last30Up / 10, 1) * 25;
    const responseScore = googleReviews.length > 0 
      ? ((googleReviews.length - unreplied) / googleReviews.length) * 20 
      : 10;
    const sentimentScore = total > 0 ? (thumbsUp / total) * 15 : 7.5;
    const reputationScore = Math.round(ratingScore + velocityScore + responseScore + sentimentScore);

    return {
      reputationScore,
      avgRating,
      totalReviews: reviewCount || googleReviews.length,
      thumbsUp,
      thumbsDown,
      conversionRate,
      unreplied,
      last30Up,
      last7Up,
      last30Total: last30.length,
    };
  }, [funnelEvents, googleReviews, rating, reviewCount]);

  const isLoading = funnelLoading || reviewsLoading;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Stats - Compact Cards with Animation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Reputation Score - Dark Gradient */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 shadow-lg overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <Badge className={kpis.reputationScore >= 60 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}>
                {getScoreLabel(kpis.reputationScore)}
              </Badge>
            </div>
            <p className="text-4xl font-bold tracking-tight">{kpis.reputationScore}</p>
            <p className="text-sm text-white/60 mt-1">Reputation Score</p>
            <Progress value={kpis.reputationScore} className="mt-3 h-1.5 bg-white/10" />
          </CardContent>
        </Card>

        {/* Average Rating - Compact */}
        <Card className="border shadow-sm hover:shadow-md transition-all group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              </div>
              <Badge variant="outline" className="text-xs">Google</Badge>
            </div>
            <p className="text-3xl font-bold">{kpis.avgRating ? kpis.avgRating.toFixed(1) : 'N/A'}</p>
            <p className="text-sm text-muted-foreground">{kpis.totalReviews} reviews</p>
            <div className="flex gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(kpis.avgRating) ? 'text-amber-500 fill-amber-500' : 'text-muted/30'}`} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Funnel Stats - Compact */}
        <Card className="border shadow-sm hover:shadow-md transition-all group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 text-xs">+{kpis.last7Up} week</Badge>
            </div>
            <p className="text-3xl font-bold">{kpis.thumbsUp}</p>
            <p className="text-sm text-muted-foreground">Sent to Google</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {kpis.conversionRate.toFixed(0)}% conversion rate
            </p>
          </CardContent>
        </Card>

        {/* Needs Attention - Compact */}
        <Card className={cn('border shadow-sm hover:shadow-md transition-all', kpis.unreplied > 3 && 'border-red-300 bg-red-50/30')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              {kpis.unreplied > 3 && (
                <Badge variant="destructive" className="text-xs">Action Needed</Badge>
              )}
            </div>
            <p className="text-3xl font-bold">{kpis.unreplied}</p>
            <p className="text-sm text-muted-foreground">Unreplied Reviews</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {kpis.thumbsDown} negative feedback
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Manage your reputation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={onSendRequest} className="w-full justify-start gap-3 h-12 rounded-xl bg-gradient-to-r from-primary to-teal text-white shadow-md hover:shadow-lg transition-all">
              <Send className="h-5 w-5" />
              Send Review Request
              <ArrowUpRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button onClick={onOpenQR} variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl">
              <QrCode className="h-5 w-5" />
              Generate QR Code
              <ArrowUpRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button onClick={onSync} variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl">
              <RefreshCw className="h-5 w-5" />
              Sync Google Reviews
              <ArrowUpRight className="h-4 w-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest reviews and feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px]">
              <div className="space-y-3">
                {googleReviews.slice(0, 5).map((review: any) => (
                  <div key={review.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex gap-0.5 pt-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className={`h-3 w-3 ${i <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-muted/50'}`} />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{review.author_name}</span>
                        {review.reply_status !== 'posted' && (
                          <Badge variant="destructive" className="text-[10px] h-4">Needs Reply</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{review.text_content || 'No comment'}</p>
                    </div>
                  </div>
                ))}
                {googleReviews.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No reviews yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Negative Feedback Panel */}
      {kpis.thumbsDown > 0 && (
        <NegativeFeedbackPanel clinicId={clinicId} limit={10} />
      )}

      {/* AI Insights */}
      {(kpis.unreplied > 5 || kpis.reputationScore < 60) && (
        <Card className="border-2 border-amber-300 bg-amber-50/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              AI Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-amber-800">
              {kpis.unreplied > 5 && (
                <li className="flex items-start gap-3 p-3 rounded-lg bg-white/60">
                  <MessageSquare className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>You have <strong>{kpis.unreplied} unreplied reviews</strong>. Responding quickly improves your reputation score and shows patients you care.</span>
                </li>
              )}
              {kpis.reputationScore < 60 && (
                <li className="flex items-start gap-3 p-3 rounded-lg bg-white/60">
                  <Activity className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>Your reputation score is <strong>below 60</strong>. Focus on collecting more positive reviews and responding to feedback promptly.</span>
                </li>
              )}
              {kpis.thumbsDown > kpis.thumbsUp && (
                <li className="flex items-start gap-3 p-3 rounded-lg bg-white/60">
                  <ThumbsDown className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>More patients are leaving <strong>private feedback</strong> than public reviews. Review the feedback to identify improvement areas.</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
