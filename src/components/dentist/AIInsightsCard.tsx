import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  ArrowRight,
  Loader2,
  Zap,
  Star,
  Calendar,
  MessageSquare,
} from 'lucide-react';

interface AIInsightsCardProps {
  clinicId: string;
  clinicName: string;
  onNavigate: (tab: string) => void;
}

interface AIInsight {
  type: 'success' | 'warning' | 'action' | 'tip';
  icon: any;
  title: string;
  description: string;
  action?: {
    label: string;
    tab: string;
  };
}

export default function AIInsightsCard({ clinicId, clinicName, onNavigate }: AIInsightsCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch clinic stats for AI analysis
  const { data: stats, isLoading } = useQuery({
    queryKey: ['ai-insights-stats', clinicId],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('status, created_at')
        .eq('clinic_id', clinicId);

      // Get review funnel events
      const { data: funnelEvents } = await supabase
        .from('review_funnel_events')
        .select('event_type, created_at')
        .eq('clinic_id', clinicId);

      // Get clinic info
      const { data: clinic } = await supabase
        .from('clinics')
        .select('rating, review_count, verification_status, google_place_id, description')
        .eq('id', clinicId)
        .single();

      // Get profile images
      const { data: images } = await supabase
        .from('clinic_images')
        .select('id')
        .eq('clinic_id', clinicId);

      const appts = appointments || [];
      const events = funnelEvents || [];
      
      const recentAppts = appts.filter(a => new Date(a.created_at) >= thirtyDaysAgo);
      const pendingAppts = appts.filter(a => a.status === 'pending').length;
      const completedAppts = appts.filter(a => a.status === 'completed').length;

      const thumbsUp = events.filter(e => e.event_type === 'thumbs_up').length;
      const thumbsDown = events.filter(e => e.event_type === 'thumbs_down').length;
      const positiveRate = events.length > 0 ? (thumbsUp / events.length) * 100 : 100;

      return {
        totalAppointments: appts.length,
        recentAppointments: recentAppts.length,
        pendingAppointments: pendingAppts,
        completedAppointments: completedAppts,
        thumbsUp,
        thumbsDown,
        positiveRate,
        rating: clinic?.rating || 0,
        reviewCount: clinic?.review_count || 0,
        isVerified: clinic?.verification_status === 'verified',
        hasGmb: !!clinic?.google_place_id,
        hasDescription: !!clinic?.description,
        imageCount: images?.length || 0,
      };
    },
    enabled: !!clinicId,
  });

  // Generate AI insights based on stats
  const generateInsights = (): AIInsight[] => {
    if (!stats) return [];

    const insights: AIInsight[] = [];

    // Rating insights
    if (stats.rating >= 4.5) {
      insights.push({
        type: 'success',
        icon: Star,
        title: 'Excellent Rating',
        description: `Your ${stats.rating.toFixed(1)}★ rating is above average!`,
      });
    } else if (stats.rating < 4.0 && stats.reviewCount > 0) {
      insights.push({
        type: 'warning',
        icon: TrendingDown,
        title: 'Rating Needs Attention',
        description: 'Focus on patient experience to improve.',
        action: { label: 'View Reviews', tab: 'my-reputation' },
      });
    }

    // Negative feedback
    if (stats.thumbsDown > stats.thumbsUp) {
      insights.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'High Negative Feedback',
        description: 'Address patient concerns privately.',
        action: { label: 'View Feedback', tab: 'my-reputation' },
      });
    } else if (stats.positiveRate >= 80 && stats.thumbsUp > 5) {
      insights.push({
        type: 'success',
        icon: TrendingUp,
        title: 'Great Satisfaction',
        description: `${Math.round(stats.positiveRate)}% of patients are happy!`,
      });
    }

    // GMB connection
    if (!stats.hasGmb) {
      insights.push({
        type: 'action',
        icon: MessageSquare,
        title: 'Connect Google Business',
        description: 'Redirect happy patients to Google.',
        action: { label: 'Connect', tab: 'my-settings' },
      });
    }

    // Verification
    if (!stats.isVerified) {
      insights.push({
        type: 'action',
        icon: CheckCircle,
        title: 'Get Verified',
        description: 'Verified clinics get 3x more bookings.',
        action: { label: 'Verify', tab: 'my-settings' },
      });
    }

    // Profile completeness
    if (!stats.hasDescription || stats.imageCount < 3) {
      insights.push({
        type: 'action',
        icon: Lightbulb,
        title: 'Complete Your Profile',
        description: stats.imageCount < 3 
          ? 'Add more photos to boost engagement.'
          : 'Add a compelling description.',
        action: { label: 'Edit', tab: 'my-profile' },
      });
    }

    // Pending appointments
    if (stats.pendingAppointments > 3) {
      insights.push({
        type: 'warning',
        icon: Calendar,
        title: 'Pending Appointments',
        description: `${stats.pendingAppointments} awaiting confirmation.`,
        action: { label: 'View', tab: 'my-appointments' },
      });
    }

    // Growth tip
    if (stats.reviewCount < 10) {
      insights.push({
        type: 'tip',
        icon: Zap,
        title: 'Boost Your Reviews',
        description: 'Clinics with 10+ reviews get 2x bookings.',
        action: { label: 'Send Requests', tab: 'my-reputation' },
      });
    }

    return insights.slice(0, 4);
  };

  const insights = generateInsights();

  const getInsightStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-teal/15 border-teal/30 hover:bg-teal/20';
      case 'warning':
        return 'bg-coral/15 border-coral/30 hover:bg-coral/20';
      case 'action':
        return 'bg-primary/15 border-primary/30 hover:bg-primary/20';
      case 'tip':
        return 'bg-gold/15 border-gold/30 hover:bg-gold/20';
      default:
        return 'bg-slate-700/30 border-slate-600/30';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-teal';
      case 'warning': return 'text-coral';
      case 'action': return 'text-primary';
      case 'tip': return 'text-gold';
      default: return 'text-white/60';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40 bg-slate-700" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 bg-slate-700" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg overflow-hidden">
      {/* Gradient accent */}
      <div className="h-1 bg-gradient-to-r from-primary via-teal to-primary" />
      
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            AI Insights
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white hover:bg-slate-700/50"
            onClick={() => setIsGenerating(true)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {insights.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="h-10 w-10 text-teal mx-auto mb-2" />
            <p className="text-white font-medium">You're doing great!</p>
            <p className="text-white/50 text-sm">No urgent actions needed.</p>
          </div>
        ) : (
          insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div
                key={index}
                className={`p-3 rounded-xl border transition-all ${getInsightStyles(insight.type)}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    insight.type === 'success' ? 'bg-teal/20' :
                    insight.type === 'warning' ? 'bg-coral/20' :
                    insight.type === 'action' ? 'bg-primary/20' :
                    'bg-gold/20'
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${getIconColor(insight.type)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{insight.title}</p>
                    <p className="text-white/60 text-xs mt-0.5">{insight.description}</p>
                    {insight.action && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1.5 h-6 text-xs text-teal hover:text-teal hover:bg-teal/10 -ml-2 px-2"
                        onClick={() => onNavigate(insight.action!.tab)}
                      >
                        {insight.action.label}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}