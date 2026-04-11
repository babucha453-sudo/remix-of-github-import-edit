import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Clock,
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  CheckCircle,
  AlertCircle,
  Globe,
  Activity,
} from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';

interface TodaySnapshotProps {
  clinicId: string;
}

export default function TodaySnapshot({ clinicId }: TodaySnapshotProps) {
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['today-snapshot', clinicId],
    queryFn: async () => {
      const [
        appointmentsResult,
        funnelResult,
        messagesResult,
        clinicResult,
        oauthTokensResult,
      ] = await Promise.all([
        // Today's appointments
        supabase
          .from('appointments')
          .select('id, status')
          .eq('clinic_id', clinicId)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        // Today's review funnel events
        supabase
          .from('review_funnel_events')
          .select('id, event_type')
          .eq('clinic_id', clinicId)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        // Today's messages
        supabase
          .from('clinic_messages')
          .select('id, status')
          .eq('clinic_id', clinicId)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        // Clinic basic info
        supabase
          .from('clinics')
          .select('gmb_connected, rating, review_count')
          .eq('id', clinicId)
          .single(),
        // Clinic OAuth tokens (for gmb_last_sync_at)
        supabase
          .from('clinic_oauth_tokens')
          .select('gmb_connected, gmb_last_sync_at')
          .eq('clinic_id', clinicId)
          .single(),
      ]);

      const appointments = appointmentsResult.data || [];
      const funnelEvents = funnelResult.data || [];
      const messages = messagesResult.data || [];
      const clinic = clinicResult.data;
      const oauthTokens = oauthTokensResult.data;

      return {
        newAppointments: appointments.length,
        pendingAppointments: appointments.filter(a => a.status === 'pending').length,
        confirmedAppointments: appointments.filter(a => a.status === 'confirmed').length,
        thumbsUp: funnelEvents.filter(e => e.event_type === 'thumbs_up').length,
        thumbsDown: funnelEvents.filter(e => e.event_type === 'thumbs_down').length,
        messagesSent: messages.filter(m => m.status === 'sent' || m.status === 'delivered').length,
        messagesFailed: messages.filter(m => m.status === 'failed').length,
        gmbConnected: oauthTokens?.gmb_connected || clinic?.gmb_connected || false,
        gmbLastSync: oauthTokens?.gmb_last_sync_at,
        rating: clinic?.rating || 0,
        reviewCount: clinic?.review_count || 0,
      };
    },
    enabled: !!clinicId,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="card-modern">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Today's Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const positiveRate = (snapshot?.thumbsUp || 0) + (snapshot?.thumbsDown || 0) > 0
    ? Math.round(((snapshot?.thumbsUp || 0) / ((snapshot?.thumbsUp || 0) + (snapshot?.thumbsDown || 0))) * 100)
    : 100;

  return (
    <Card className="card-modern border-primary/10 bg-gradient-to-br from-primary/5 via-card to-teal/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Today's Snapshot
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Live
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Appointments */}
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Appointments</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{snapshot?.newAppointments || 0}</span>
              <span className="text-xs text-muted-foreground">new</span>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="bg-gold/10 border-gold/20 text-gold">
                <Clock className="h-2.5 w-2.5 mr-1" />
                {snapshot?.pendingAppointments || 0}
              </Badge>
              <Badge variant="outline" className="bg-teal/10 border-teal/20 text-teal">
                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                {snapshot?.confirmedAppointments || 0}
              </Badge>
            </div>
          </div>

          {/* Reviews Collected */}
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gold" />
              <span className="text-xs font-medium text-muted-foreground">Reviews</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {(snapshot?.thumbsUp || 0) + (snapshot?.thumbsDown || 0)}
              </span>
              <span className="text-xs text-muted-foreground">collected</span>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="bg-teal/10 border-teal/20 text-teal">
                <ThumbsUp className="h-2.5 w-2.5 mr-1" />
                {snapshot?.thumbsUp || 0}
              </Badge>
              <Badge variant="outline" className="bg-coral/10 border-coral/20 text-coral">
                <ThumbsDown className="h-2.5 w-2.5 mr-1" />
                {snapshot?.thumbsDown || 0}
              </Badge>
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-purple" />
              <span className="text-xs font-medium text-muted-foreground">Messages</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{snapshot?.messagesSent || 0}</span>
              <span className="text-xs text-muted-foreground">sent</span>
            </div>
            {(snapshot?.messagesFailed || 0) > 0 && (
              <Badge variant="outline" className="bg-coral/10 border-coral/20 text-coral text-xs">
                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                {snapshot.messagesFailed} failed
              </Badge>
            )}
          </div>

          {/* GMB Status */}
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-custom" />
              <span className="text-xs font-medium text-muted-foreground">GMB Status</span>
            </div>
            <div className="flex items-center gap-2">
              {snapshot?.gmbConnected ? (
                <Badge className="bg-teal/10 border-teal/20 text-teal border">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not Connected
                </Badge>
              )}
            </div>
            {snapshot?.gmbConnected && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 text-gold fill-gold" />
                <span className="font-medium">{Number(snapshot.rating).toFixed(1)}</span>
                <span>({snapshot.reviewCount})</span>
              </div>
            )}
          </div>
        </div>

        {/* Response Rate Bar */}
        <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Positive Review Rate</span>
            <span className="text-xs font-bold text-primary">{positiveRate}%</span>
          </div>
          <Progress value={positiveRate} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}