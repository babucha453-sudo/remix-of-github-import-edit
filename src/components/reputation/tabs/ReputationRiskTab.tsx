import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertTriangle, TrendingDown, Clock, MessageSquare, Activity, RefreshCw, Eye, Shield } from 'lucide-react';
import { subDays } from 'date-fns';
import { createAuditLog } from '@/lib/audit';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationRiskTab({ clinicId, isAdmin }: Props) {
  const queryClient = useQueryClient();

  // Fetch Google reviews
  const { data: googleReviews = [], isLoading: googleLoading } = useQuery({
    queryKey: ['risk-google', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('google_reviews')
        .select('rating, review_time, reply_status, created_at')
        .order('review_time', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch funnel events
  const { data: funnelEvents = [], isLoading: funnelLoading } = useQuery({
    queryKey: ['risk-funnel', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('review_funnel_events')
        .select('event_type, created_at')
        .order('created_at', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate risk factors
  const riskAnalysis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sevenDaysAgo = subDays(now, 7);

    // Rating analysis
    const avgRating = googleReviews.length
      ? googleReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / googleReviews.length
      : 0;
    const recentReviews = googleReviews.filter(
      (r: any) => new Date(r.review_time || r.created_at) >= thirtyDaysAgo
    );
    const recentAvg = recentReviews.length
      ? recentReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / recentReviews.length
      : avgRating;
    const ratingDrop = avgRating - recentAvg;

    // Reply delays
    const unreplied = googleReviews.filter((r: any) => r.reply_status !== 'posted');
    const oldUnreplied = unreplied.filter(
      (r: any) => new Date(r.review_time || r.created_at) < sevenDaysAgo
    );

    // Funnel sentiment
    const last30Funnel = funnelEvents.filter((e: any) => new Date(e.created_at) >= thirtyDaysAgo);
    const negativeCount = last30Funnel.filter((e: any) => e.event_type === 'thumbs_down').length;
    const positiveCount = last30Funnel.filter((e: any) => e.event_type === 'thumbs_up').length;
    const negativeTrend = negativeCount > positiveCount;

    // Volume drop
    const last7Reviews = googleReviews.filter(
      (r: any) => new Date(r.review_time || r.created_at) >= sevenDaysAgo
    );
    const volumeDrop = last7Reviews.length < 1;

    // Risk factors
    const factors = [];
    let riskScore = 0;

    if (ratingDrop > 0.5) {
      factors.push({
        id: 'rating_drop',
        label: 'Rating Decline',
        description: `Average rating dropped by ${ratingDrop.toFixed(1)} stars in the last 30 days`,
        severity: 'high',
        score: 30,
      });
      riskScore += 30;
    } else if (avgRating < 4.0) {
      factors.push({
        id: 'low_rating',
        label: 'Low Rating',
        description: `Current average rating is ${avgRating.toFixed(1)} stars`,
        severity: 'medium',
        score: 20,
      });
      riskScore += 20;
    }

    if (oldUnreplied.length > 5) {
      factors.push({
        id: 'slow_replies',
        label: 'Slow Reply Time',
        description: `${oldUnreplied.length} reviews over 7 days old without replies`,
        severity: 'high',
        score: 25,
      });
      riskScore += 25;
    } else if (unreplied.length > 10) {
      factors.push({
        id: 'unreplied',
        label: 'Unreplied Reviews',
        description: `${unreplied.length} reviews pending replies`,
        severity: 'medium',
        score: 15,
      });
      riskScore += 15;
    }

    if (negativeTrend) {
      factors.push({
        id: 'negative_trend',
        label: 'Negative Sentiment Trend',
        description: `More negative feedback (${negativeCount}) than positive (${positiveCount}) in 30 days`,
        severity: 'medium',
        score: 20,
      });
      riskScore += 20;
    }

    if (volumeDrop && googleReviews.length > 10) {
      factors.push({
        id: 'volume_drop',
        label: 'Review Volume Drop',
        description: 'No new reviews in the last 7 days',
        severity: 'low',
        score: 10,
      });
      riskScore += 10;
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    return {
      riskScore,
      factors,
      avgRating,
      recentAvg,
      unrepliedCount: unreplied.length,
      negativeCount,
      positiveCount,
    };
  }, [googleReviews, funnelEvents]);

  const recalculate = () => {
    queryClient.invalidateQueries({ queryKey: ['risk-google'] });
    queryClient.invalidateQueries({ queryKey: ['risk-funnel'] });
    toast.success('Risk score recalculated');
  };

  const isLoading = googleLoading || funnelLoading;

  const getRiskLevel = (score: number) => {
    if (score >= 60) return { label: 'High Risk', color: 'text-red-500', bg: 'bg-red-100' };
    if (score >= 30) return { label: 'Medium Risk', color: 'text-amber-500', bg: 'bg-amber-100' };
    return { label: 'Low Risk', color: 'text-emerald-500', bg: 'bg-emerald-100' };
  };

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, string> = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-blue-100 text-blue-700',
    };
    return <Badge className={config[severity] || 'bg-muted'}>{severity}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const risk = getRiskLevel(riskAnalysis.riskScore);

  return (
    <div className="space-y-6">
      {/* Risk Score Hero */}
      <Card className={`border-2 ${riskAnalysis.riskScore >= 60 ? 'border-red-500/50' : riskAnalysis.riskScore >= 30 ? 'border-amber-500/50' : 'border-emerald-500/50'}`}>
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className={`h-24 w-24 rounded-2xl ${risk.bg} flex items-center justify-center`}>
                <span className={`text-4xl font-bold ${risk.color}`}>
                  {riskAnalysis.riskScore}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{risk.label}</h2>
                <p className="text-muted-foreground">
                  {riskAnalysis.factors.length} risk factor{riskAnalysis.factors.length !== 1 ? 's' : ''} detected
                </p>
                <div className="flex gap-4 mt-3 text-sm">
                  <span>Avg Rating: <strong>{riskAnalysis.avgRating.toFixed(1)}</strong></span>
                  <span>Unreplied: <strong>{riskAnalysis.unrepliedCount}</strong></span>
                  <span>Negative (30d): <strong>{riskAnalysis.negativeCount}</strong></span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={recalculate} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recalculate
              </Button>
              {isAdmin && (
                <Button variant="outline" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Watchlist
                </Button>
              )}
            </div>
          </div>
          <Progress value={riskAnalysis.riskScore} className="mt-6 h-3" />
        </CardContent>
      </Card>

      {/* Risk Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Risk Factors
          </CardTitle>
          <CardDescription>Issues contributing to your risk score</CardDescription>
        </CardHeader>
        <CardContent>
          {riskAnalysis.factors.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
              <p className="font-medium text-emerald-600">No risk factors detected</p>
              <p className="text-sm text-muted-foreground">Your reputation is healthy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {riskAnalysis.factors.map((factor) => (
                <div
                  key={factor.id}
                  className="p-4 rounded-xl border bg-card flex items-start gap-4"
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    factor.severity === 'high' ? 'bg-red-100' :
                    factor.severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'
                  }`}>
                    <AlertTriangle className={`h-5 w-5 ${
                      factor.severity === 'high' ? 'text-red-600' :
                      factor.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{factor.label}</span>
                      {getSeverityBadge(factor.severity)}
                      <Badge variant="outline">+{factor.score} pts</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{factor.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Actions Toggle */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Automated Risk Actions</CardTitle>
            <CardDescription>Configure automatic responses to risk events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <Label>Auto-alert on high risk</Label>
                <p className="text-sm text-muted-foreground">
                  Send email notification when risk score exceeds 60
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <Label>Auto-escalate rating drops</Label>
                <p className="text-sm text-muted-foreground">
                  Flag clinics with sudden rating decline for review
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <Label>Weekly risk digest</Label>
                <p className="text-sm text-muted-foreground">
                  Send weekly summary of all high-risk profiles
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
