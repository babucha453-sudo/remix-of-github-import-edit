import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History,
  Send,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  QrCode,
  Settings,
  Bot,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Calendar,
  User,
  Star,
  CheckCircle,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ReputationLogsHistoryTabProps {
  clinicId: string;
}

type LogType = 'all' | 'request' | 'funnel' | 'reply' | 'setting';

export default function ReputationLogsHistoryTab({ clinicId }: ReputationLogsHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<LogType>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Fetch review requests
  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['logs-requests', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_requests')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Fetch funnel events
  const { data: funnelEvents = [], isLoading: funnelLoading } = useQuery({
    queryKey: ['logs-funnel', clinicId],
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

  // Fetch Google reviews (replies)
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['logs-reviews', clinicId],
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

  // Fetch audit logs for this clinic
  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['logs-audit', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', clinicId)
        .or(`entity_type.eq.clinic,entity_type.eq.dentist_settings`)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Combine all logs into unified timeline
  const allLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      type: 'request' | 'funnel' | 'reply' | 'setting';
      title: string;
      description: string;
      timestamp: Date;
      status?: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // Add review requests
    requests.forEach((req: any) => {
      logs.push({
        id: `req-${req.id}`,
        type: 'request',
        title: `Review request sent to ${req.recipient_name}`,
        description: `Via ${req.channel}: ${req.recipient_email || req.recipient_phone}`,
        timestamp: new Date(req.created_at),
        status: req.status,
      });
    });

    // Add funnel events
    funnelEvents.forEach((event: any) => {
      logs.push({
        id: `funnel-${event.id}`,
        type: 'funnel',
        title: event.event_type === 'thumbs_up' ? 'Positive feedback received' : 'Private feedback captured',
        description: event.comment || `Rating: ${event.rating || 'N/A'} via ${event.source || 'link'}`,
        timestamp: new Date(event.created_at),
        status: event.event_type,
      });
    });

    // Add replies
    reviews
      .filter((r: any) => r.reply_status === 'posted')
      .forEach((review: any) => {
        logs.push({
          id: `reply-${review.id}`,
          type: 'reply',
          title: `Reply posted to ${review.author_name}`,
          description: `${review.rating}★ review replied`,
          timestamp: new Date(review.reply_posted_at || review.review_time),
          status: 'posted',
        });
      });

    // Add setting changes from audit
    auditLogs.forEach((log: any) => {
      if (log.action?.includes('reputation') || log.action?.includes('review') || log.action?.includes('funnel')) {
        logs.push({
          id: `audit-${log.id}`,
          type: 'setting',
          title: `Settings updated: ${log.action}`,
          description: log.user_email || 'System',
          timestamp: new Date(log.created_at),
        });
      }
    });

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return logs;
  }, [requests, funnelEvents, reviews, auditLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;

    if (dateRange === '7d') cutoff = subDays(now, 7);
    else if (dateRange === '30d') cutoff = subDays(now, 30);
    else if (dateRange === '90d') cutoff = subDays(now, 90);

    let result = allLogs;

    if (cutoff) {
      result = result.filter((log) => log.timestamp >= cutoff!);
    }

    if (typeFilter !== 'all') {
      result = result.filter((log) => log.type === typeFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (log) =>
          log.title.toLowerCase().includes(term) || log.description.toLowerCase().includes(term)
      );
    }

    return result;
  }, [allLogs, dateRange, typeFilter, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const last30 = allLogs.filter((l) => l.timestamp >= thirtyDaysAgo);

    return {
      total: allLogs.length,
      last30: last30.length,
      requests: allLogs.filter((l) => l.type === 'request').length,
      funnelEvents: allLogs.filter((l) => l.type === 'funnel').length,
      replies: allLogs.filter((l) => l.type === 'reply').length,
      settings: allLogs.filter((l) => l.type === 'setting').length,
    };
  }, [allLogs]);

  const isLoading = reqLoading || funnelLoading || reviewsLoading || auditLoading;

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'request':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'funnel':
        return <ThumbsUp className="h-4 w-4 text-emerald-500" />;
      case 'reply':
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case 'setting':
        return <Settings className="h-4 w-4 text-amber-500" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case 'sent':
      case 'thumbs_up':
      case 'posted':
        return <Badge className="bg-emerald-100 text-emerald-700">Success</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case 'failed':
      case 'thumbs_down':
        return <Badge className="bg-red-100 text-red-700">Private</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.requests}</p>
                <p className="text-sm text-muted-foreground">Requests Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.funnelEvents}</p>
                <p className="text-sm text-muted-foreground">Funnel Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-purple-100 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.replies}</p>
                <p className="text-sm text-muted-foreground">Replies Posted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Activity Log
              </CardTitle>
              <CardDescription>Complete history of reputation events</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as LogType)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="request">Requests</SelectItem>
                <SelectItem value="funnel">Funnel</SelectItem>
                <SelectItem value="reply">Replies</SelectItem>
                <SelectItem value="setting">Settings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timeline */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No activity found</p>
                  <p className="text-sm">Events will appear here as they happen</p>
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="flex gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors relative"
                  >
                    {/* Timeline line */}
                    {index < filteredLogs.length - 1 && (
                      <div className="absolute left-[27px] top-12 w-0.5 h-[calc(100%-24px)] bg-border" />
                    )}

                    {/* Icon */}
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 relative z-10">
                      {getLogIcon(log.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{log.title}</p>
                        {getStatusBadge(log.status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{log.description}</p>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">
                        {format(log.timestamp, 'MMM d')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(log.timestamp, 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
