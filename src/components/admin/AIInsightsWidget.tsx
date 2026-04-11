import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { subDays } from 'date-fns';

interface AIInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'recommendation';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric?: string;
  action?: string;
}

export default function AIInsightsWidget() {
  // Generate AI-style insights from real data
  const { data: insights, isLoading } = useQuery({
    queryKey: ['ai-founder-insights'],
    queryFn: async (): Promise<AIInsight[]> => {
      const today = new Date();
      const weekAgo = subDays(today, 7);
      const insights: AIInsight[] = [];

      // Check unclaimed vs claimed ratio
      const [
        { count: totalClinics },
        { count: claimedClinics },
        { count: pendingClaims },
        { count: negativeReviews },
        { count: appointmentsThisWeek },
        { count: appointmentsLastWeek },
      ] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('claim_status', 'claimed'),
        supabase.from('claim_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('review_funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'thumbs_down').gte('created_at', weekAgo.toISOString()),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', subDays(weekAgo, 7).toISOString()).lt('created_at', weekAgo.toISOString()),
      ]);

      const claimRate = totalClinics ? Math.round(((claimedClinics || 0) / totalClinics) * 100) : 0;
      const appointmentGrowth = appointmentsLastWeek ? Math.round((((appointmentsThisWeek || 0) - appointmentsLastWeek) / appointmentsLastWeek) * 100) : 0;

      // Generate insights based on data
      if (claimRate < 30) {
        insights.push({
          id: 'claim-opportunity',
          type: 'opportunity',
          priority: 'high',
          title: 'Untapped Claim Potential',
          description: `Only ${claimRate}% of clinics are claimed. Focus outreach on high-rating unclaimed profiles.`,
          metric: `${(totalClinics || 0) - (claimedClinics || 0)} unclaimed`,
          action: 'Launch outreach campaign',
        });
      }

      if ((pendingClaims || 0) > 0) {
        insights.push({
          id: 'pending-claims',
          type: 'recommendation',
          priority: (pendingClaims || 0) > 5 ? 'high' : 'medium',
          title: 'Claims Awaiting Review',
          description: `${pendingClaims} claim requests need your attention. Quick approval improves conversion.`,
          metric: `${pendingClaims} pending`,
          action: 'Review claims now',
        });
      }

      if ((negativeReviews || 0) > 5) {
        insights.push({
          id: 'negative-reviews',
          type: 'risk',
          priority: 'high',
          title: 'Negative Feedback Spike',
          description: 'Increased negative feedback this week. Review common themes and alert affected clinics.',
          metric: `${negativeReviews} this week`,
          action: 'Analyze feedback',
        });
      }

      if (appointmentGrowth > 10) {
        insights.push({
          id: 'appointment-growth',
          type: 'opportunity',
          priority: 'low',
          title: 'Strong Booking Growth',
          description: `Appointments up ${appointmentGrowth}% week-over-week. Consider promoting success stories.`,
          metric: `+${appointmentGrowth}%`,
          action: 'Share metrics',
        });
      } else if (appointmentGrowth < -10) {
        insights.push({
          id: 'appointment-decline',
          type: 'risk',
          priority: 'medium',
          title: 'Booking Decline Alert',
          description: `Appointments down ${Math.abs(appointmentGrowth)}% this week. Investigate causes.`,
          metric: `${appointmentGrowth}%`,
          action: 'Investigate',
        });
      }

      // Always show at least one insight
      if (insights.length === 0) {
        insights.push({
          id: 'health-check',
          type: 'recommendation',
          priority: 'low',
          title: 'Platform Running Smoothly',
          description: 'No critical issues detected. Consider proactive growth initiatives.',
          action: 'View weekly report',
        });
      }

      return insights.slice(0, 4); // Max 4 insights
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-teal" />;
      case 'risk': return <AlertTriangle className="h-4 w-4 text-coral" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4 text-gold" />;
    }
  };

  const getPriorityColor = (priority: AIInsight['priority']) => {
    switch (priority) {
      case 'high': return 'bg-coral/10 border-coral/20';
      case 'medium': return 'bg-gold/10 border-gold/20';
      case 'low': return 'bg-teal/10 border-teal/20';
    }
  };

  if (isLoading) {
    return (
      <Card className="card-modern">
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-modern overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          AI-Powered Insights
          <Badge variant="outline" className="ml-auto text-xs">
            <Brain className="h-3 w-3 mr-1" />
            Live Analysis
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {insights?.map((insight) => (
          <div 
            key={insight.id} 
            className={`border rounded-xl p-3 transition-all hover:shadow-md ${getPriorityColor(insight.priority)}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{insight.title}</h4>
                  {insight.metric && (
                    <Badge variant="secondary" className="text-xs">
                      {insight.metric}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
              {insight.action && (
                <Button variant="ghost" size="sm" className="shrink-0 text-xs">
                  {insight.action}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
