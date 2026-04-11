import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Star,
  MessageSquare,
  UserPlus,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  clinicId: string;
  maxItems?: number;
}

interface ActivityItem {
  id: string;
  type: 'appointment' | 'review' | 'message' | 'lead' | 'funnel';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export default function ActivityFeed({ clinicId, maxItems = 10 }: ActivityFeedProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity-feed', clinicId],
    queryFn: async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [appointments, funnelEvents, messages] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, patient_name, status, created_at')
          .eq('clinic_id', clinicId)
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('review_funnel_events')
          .select('id, event_type, rating, created_at')
          .eq('clinic_id', clinicId)
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('clinic_messages')
          .select('id, recipient_phone, status, channel, created_at')
          .eq('clinic_id', clinicId)
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const activities: ActivityItem[] = [];

      // Map appointments
      (appointments.data || []).forEach(apt => {
        activities.push({
          id: `apt-${apt.id}`,
          type: 'appointment',
          title: 'New Appointment',
          description: `${apt.patient_name} requested a booking`,
          timestamp: apt.created_at,
          status: apt.status,
        });
      });

      // Map funnel events
      (funnelEvents.data || []).forEach(evt => {
        activities.push({
          id: `funnel-${evt.id}`,
          type: 'funnel',
          title: evt.event_type === 'thumbs_up' ? 'Positive Feedback' : 'Feedback Received',
          description: evt.event_type === 'thumbs_up' 
            ? 'Patient redirected to Google Reviews'
            : `Patient left ${evt.rating || 'N/A'}-star private feedback`,
          timestamp: evt.created_at,
          metadata: { event_type: evt.event_type, rating: evt.rating },
        });
      });

      // Map messages
      (messages.data || []).forEach(msg => {
        activities.push({
          id: `msg-${msg.id}`,
          type: 'message',
          title: `${msg.channel?.toUpperCase() || 'SMS'} Sent`,
          description: `Message to ${msg.recipient_phone.slice(-4).padStart(msg.recipient_phone.length, '*')}`,
          timestamp: msg.created_at,
          status: msg.status,
        });
      });

      // Sort by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities.slice(0, maxItems);
    },
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  const getIcon = (type: ActivityItem['type'], metadata?: Record<string, unknown>) => {
    switch (type) {
      case 'appointment':
        return <Calendar className="h-4 w-4 text-primary" />;
      case 'funnel':
        return metadata?.event_type === 'thumbs_up' 
          ? <ThumbsUp className="h-4 w-4 text-teal" />
          : <ThumbsDown className="h-4 w-4 text-coral" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-purple" />;
      case 'lead':
        return <UserPlus className="h-4 w-4 text-gold" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-gold/10 text-gold border-gold/20 text-xs">Pending</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="bg-teal/10 text-teal border-teal/20 text-xs">Confirmed</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Completed</Badge>;
      case 'sent':
      case 'delivered':
        return <Badge variant="outline" className="bg-teal/10 text-teal border-teal/20 text-xs">Sent</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-coral/10 text-coral border-coral/20 text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="card-modern">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {activities && activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map(activity => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-card border flex items-center justify-center flex-shrink-0">
                    {getIcon(activity.type, activity.metadata)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                      </div>
                      {getStatusBadge(activity.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
