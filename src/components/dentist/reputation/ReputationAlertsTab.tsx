import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  TrendingDown,
  MessageSquare,
  Star,
  Bell,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  Sparkles,
  ThumbsDown,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ReputationAlertsTabProps {
  clinicId: string;
  rating?: number;
}

interface Alert {
  id: string;
  type: 'rating_drop' | 'unreplied' | 'negative_surge' | 'low_velocity' | 'recommendation';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  timestamp: Date;
  actionable: boolean;
}

export default function ReputationAlertsTab({ clinicId, rating }: ReputationAlertsTabProps) {
  // Fetch data for alert generation
  const { data: funnelEvents = [], isLoading: funnelLoading } = useQuery({
    queryKey: ['alerts-funnel', clinicId],
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

  const { data: googleReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['alerts-reviews', clinicId],
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

  // Generate alerts based on data
  const alerts = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const alertList: Alert[] = [];

    // Unreplied reviews alert
    const unreplied = googleReviews.filter((r: any) => r.reply_status !== 'posted');
    if (unreplied.length > 3) {
      alertList.push({
        id: 'unreplied',
        type: 'unreplied',
        severity: unreplied.length > 10 ? 'high' : 'medium',
        title: `${unreplied.length} Unreplied Reviews`,
        description: 'Responding to reviews quickly improves your reputation and shows patients you care.',
        timestamp: now,
        actionable: true,
      });
    }

    // Low rating alert
    if (rating && rating < 4.0) {
      alertList.push({
        id: 'low_rating',
        type: 'rating_drop',
        severity: rating < 3.5 ? 'high' : 'medium',
        title: 'Rating Below 4.0',
        description: `Your current rating is ${rating.toFixed(1)}. Focus on improving patient experience and collecting positive reviews.`,
        timestamp: now,
        actionable: true,
      });
    }

    // Negative feedback surge
    const recentNegative = funnelEvents.filter((e: any) => 
      e.event_type === 'thumbs_down' && new Date(e.created_at) >= sevenDaysAgo
    );
    if (recentNegative.length >= 5) {
      alertList.push({
        id: 'negative_surge',
        type: 'negative_surge',
        severity: 'high',
        title: 'Spike in Negative Feedback',
        description: `${recentNegative.length} patients gave negative feedback in the last 7 days. Review the feedback to identify issues.`,
        timestamp: now,
        actionable: true,
      });
    }

    // Low review velocity
    const last30Positive = funnelEvents.filter((e: any) => 
      e.event_type === 'thumbs_up' && new Date(e.created_at) >= thirtyDaysAgo
    );
    if (last30Positive.length < 5 && funnelEvents.length > 10) {
      alertList.push({
        id: 'low_velocity',
        type: 'low_velocity',
        severity: 'medium',
        title: 'Low Review Collection',
        description: 'Only a few patients have been directed to leave reviews recently. Consider sending more review requests.',
        timestamp: now,
        actionable: true,
      });
    }

    // AI Recommendations
    if (alertList.length === 0) {
      alertList.push({
        id: 'all_good',
        type: 'recommendation',
        severity: 'low',
        title: 'Your Reputation Looks Great!',
        description: 'Keep up the good work. Continue collecting reviews and responding to feedback promptly.',
        timestamp: now,
        actionable: false,
      });
    }

    return alertList;
  }, [funnelEvents, googleReviews, rating]);

  if (funnelLoading || reviewsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-500/50 bg-red-50';
      case 'medium': return 'border-amber-500/50 bg-amber-50';
      default: return 'border-emerald-500/50 bg-emerald-50';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return <Badge variant="destructive">High Priority</Badge>;
      case 'medium': return <Badge className="bg-amber-100 text-amber-700">Medium</Badge>;
      default: return <Badge className="bg-emerald-100 text-emerald-700">Info</Badge>;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'rating_drop': return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'unreplied': return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'negative_surge': return <ThumbsDown className="h-5 w-5 text-red-500" />;
      case 'low_velocity': return <Clock className="h-5 w-5 text-amber-500" />;
      default: return <Sparkles className="h-5 w-5 text-emerald-500" />;
    }
  };

  const highPriority = alerts.filter(a => a.severity === 'high');
  const mediumPriority = alerts.filter(a => a.severity === 'medium');
  const lowPriority = alerts.filter(a => a.severity === 'low');

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className={highPriority.length > 0 ? 'border-red-500/50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${highPriority.length > 0 ? 'bg-red-100' : 'bg-muted'}`}>
                <AlertTriangle className={`h-6 w-6 ${highPriority.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{highPriority.length}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Bell className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mediumPriority.length}</p>
                <p className="text-sm text-muted-foreground">Medium Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowPriority.length}</p>
                <p className="text-sm text-muted-foreground">Recommendations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alerts & Insights
          </CardTitle>
          <CardDescription>Actionable recommendations for your reputation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)}`}>
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{alert.title}</span>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                  {alert.actionable && (
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
