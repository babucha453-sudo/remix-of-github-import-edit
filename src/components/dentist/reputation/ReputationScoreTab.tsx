import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  Star,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { subDays } from 'date-fns';

interface ReputationScoreTabProps {
  clinicId: string;
  rating?: number;
  reviewCount?: number;
}

export default function ReputationScoreTab({
  clinicId,
  rating,
  reviewCount,
}: ReputationScoreTabProps) {
  // Fetch funnel events
  const { data: funnelEvents = [], isLoading: funnelLoading } = useQuery({
    queryKey: ['reputation-score-funnel', clinicId],
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
    queryKey: ['reputation-score-reviews', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('google_reviews')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('review_time', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Calculate detailed score breakdown
  const scoreData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const total = funnelEvents.length;
    const thumbsUp = funnelEvents.filter((e: any) => e.event_type === 'thumbs_up').length;
    const thumbsDown = funnelEvents.filter((e: any) => e.event_type === 'thumbs_down').length;

    const last30 = funnelEvents.filter((e: any) => new Date(e.created_at) >= thirtyDaysAgo);
    const last30Up = last30.filter((e: any) => e.event_type === 'thumbs_up').length;

    const unreplied = googleReviews.filter((r: any) => r.reply_status !== 'posted').length;

    // Score breakdown (out of 100)
    const avgRating = rating || 0;
    const ratingScore = Math.round((avgRating / 5) * 40); // Max 40 points
    const velocityScore = Math.round(Math.min(last30Up / 10, 1) * 25); // Max 25 points
    const responseScore = googleReviews.length > 0 
      ? Math.round(((googleReviews.length - unreplied) / googleReviews.length) * 20)
      : 10; // Max 20 points
    const sentimentScore = total > 0 
      ? Math.round((thumbsUp / total) * 15)
      : 8; // Max 15 points

    const totalScore = ratingScore + velocityScore + responseScore + sentimentScore;

    // Trend (compare to previous 30 days)
    const sixtyDaysAgo = subDays(now, 60);
    const prev30 = funnelEvents.filter((e: any) => {
      const date = new Date(e.created_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });
    const prev30Up = prev30.filter((e: any) => e.event_type === 'thumbs_up').length;
    const trend = last30Up - prev30Up;

    return {
      totalScore,
      ratingScore,
      velocityScore,
      responseScore,
      sentimentScore,
      avgRating,
      thumbsUp,
      thumbsDown,
      unreplied,
      last30Up,
      trend,
      totalReviews: reviewCount || googleReviews.length,
    };
  }, [funnelEvents, googleReviews, rating, reviewCount]);

  if (funnelLoading || reviewsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-teal-500';
    if (score >= 60) return 'from-primary to-teal';
    if (score >= 40) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <Card className={`bg-gradient-to-br ${getScoreGradient(scoreData.totalScore)} text-white`}>
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-lg mb-2">Your Reputation Score</p>
              <p className="text-7xl font-bold mb-2">{scoreData.totalScore}</p>
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-0">
                  {getScoreLabel(scoreData.totalScore)}
                </Badge>
                {scoreData.trend !== 0 && (
                  <Badge className={`border-0 ${scoreData.trend > 0 ? 'bg-white/20' : 'bg-red-500/30'}`}>
                    {scoreData.trend > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                    {Math.abs(scoreData.trend)} this month
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="h-32 w-32 rounded-full border-8 border-white/30 flex items-center justify-center">
                <Activity className="h-16 w-16 text-white/80" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Score Breakdown</CardTitle>
          <CardDescription>How your reputation score is calculated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rating Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                <span className="font-medium">Average Rating</span>
              </div>
              <span className="font-bold text-lg">{scoreData.ratingScore}/40</span>
            </div>
            <Progress value={(scoreData.ratingScore / 40) * 100} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              {scoreData.avgRating.toFixed(1)} stars from {scoreData.totalReviews} reviews
            </p>
          </div>

          {/* Velocity Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <span className="font-medium">Review Velocity</span>
              </div>
              <span className="font-bold text-lg">{scoreData.velocityScore}/25</span>
            </div>
            <Progress value={(scoreData.velocityScore / 25) * 100} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              {scoreData.last30Up} new positive reviews in the last 30 days
            </p>
          </div>

          {/* Response Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Response Rate</span>
              </div>
              <span className="font-bold text-lg">{scoreData.responseScore}/20</span>
            </div>
            <Progress value={(scoreData.responseScore / 20) * 100} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              {scoreData.unreplied} reviews awaiting response
            </p>
          </div>

          {/* Sentiment Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-5 w-5 text-primary" />
                <span className="font-medium">Patient Sentiment</span>
              </div>
              <span className="font-bold text-lg">{scoreData.sentimentScore}/15</span>
            </div>
            <Progress value={(scoreData.sentimentScore / 15) * 100} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              {scoreData.thumbsUp} positive vs {scoreData.thumbsDown} private feedback
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Star className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{scoreData.avgRating.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">Average Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <ThumbsUp className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{scoreData.thumbsUp}</p>
            <p className="text-sm text-muted-foreground">Positive Funnel</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <ThumbsDown className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{scoreData.thumbsDown}</p>
            <p className="text-sm text-muted-foreground">Private Feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <MessageSquare className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{scoreData.totalReviews}</p>
            <p className="text-sm text-muted-foreground">Total Reviews</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
