import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Filter, ThumbsUp, ThumbsDown, TrendingUp, AlertTriangle, Settings, BarChart3 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { createAuditLog } from '@/lib/audit';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationFunnelTab({ clinicId, isAdmin }: Props) {
  const queryClient = useQueryClient();

  // Fetch funnel events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['funnel-events', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('review_funnel_events')
        .select('*, clinic:clinics(id, name)')
        .order('created_at', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch funnel settings (from global_settings or dentist_settings)
  const { data: settings } = useQuery({
    queryKey: ['funnel-settings', clinicId],
    queryFn: async () => {
      if (clinicId) {
        const { data } = await supabase
          .from('dentist_settings')
          .select('funnel_enabled, funnel_threshold')
          .eq('clinic_id', clinicId)
          .maybeSingle();
        return data || { funnel_enabled: true, funnel_threshold: 4 };
      }
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'review_funnel_config')
        .maybeSingle();
      return data?.value || { enabled: true, threshold: 4 };
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sevenDaysAgo = subDays(now, 7);

    const total = events.length;
    const thumbsUp = events.filter((e: any) => e.event_type === 'thumbs_up').length;
    const thumbsDown = events.filter((e: any) => e.event_type === 'thumbs_down').length;
    const conversionRate = total > 0 ? (thumbsUp / total) * 100 : 0;

    const last30 = events.filter((e: any) => new Date(e.created_at) >= thirtyDaysAgo);
    const last7 = events.filter((e: any) => new Date(e.created_at) >= sevenDaysAgo);

    const last30Up = last30.filter((e: any) => e.event_type === 'thumbs_up').length;
    const last30Down = last30.filter((e: any) => e.event_type === 'thumbs_down').length;
    const last7Up = last7.filter((e: any) => e.event_type === 'thumbs_up').length;
    const last7Down = last7.filter((e: any) => e.event_type === 'thumbs_down').length;

    // Abuse signals
    const ipCounts = new Map();
    events.forEach((e: any) => {
      if (e.visitor_id) {
        ipCounts.set(e.visitor_id, (ipCounts.get(e.visitor_id) || 0) + 1);
      }
    });
    const suspiciousIps = Array.from(ipCounts.entries()).filter(([_, count]) => count > 10);

    return {
      total,
      thumbsUp,
      thumbsDown,
      conversionRate,
      last30Total: last30.length,
      last30Up,
      last30Down,
      last7Total: last7.length,
      last7Up,
      last7Down,
      suspiciousActivity: suspiciousIps.length,
    };
  }, [events]);

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async (newSettings: any) => {
      if (clinicId) {
        const { error } = await supabase
          .from('dentist_settings')
          .upsert({
            clinic_id: clinicId,
            ...newSettings,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .upsert({
            key: 'review_funnel_config',
            value: newSettings,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      await createAuditLog({
        action: 'update_funnel_settings',
        entityType: 'funnel_settings',
        entityId: clinicId || 'global',
        newValues: newSettings,
      });
    },
    onSuccess: () => {
      toast.success('Settings updated');
      queryClient.invalidateQueries({ queryKey: ['funnel-settings'] });
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Responses</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days: {stats.last30Total}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thumbsUp}</p>
                <p className="text-sm text-muted-foreground">Redirected to Google</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days: +{stats.last7Up}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                <ThumbsDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thumbsDown}</p>
                <p className="text-sm text-muted-foreground">Private Feedback</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days: {stats.last7Down}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
            <Progress value={stats.conversionRate} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Settings & Abuse Detection */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Funnel Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Funnel Configuration
            </CardTitle>
            <CardDescription>Control review gating behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Review Funnel</Label>
                <p className="text-sm text-muted-foreground">
                  Route patients through satisfaction check
                </p>
              </div>
              <Switch
                checked={(settings as any)?.funnel_enabled ?? (settings as any)?.enabled ?? true}
                onCheckedChange={(checked) =>
                  updateSettings.mutate(
                    clinicId
                      ? { funnel_enabled: checked }
                      : { enabled: checked }
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Positive Threshold</Label>
              <p className="text-sm text-muted-foreground">
                Ratings at or above this redirect to Google
              </p>
              <Input
                type="number"
                min={1}
                max={5}
                value={(settings as any)?.funnel_threshold ?? (settings as any)?.threshold ?? 4}
                onChange={(e) =>
                  updateSettings.mutate(
                    clinicId
                      ? { funnel_threshold: parseInt(e.target.value) }
                      : { threshold: parseInt(e.target.value) }
                  )
                }
                className="w-24"
              />
            </div>
          </CardContent>
        </Card>

        {/* Abuse Detection */}
        <Card className={stats.suspiciousActivity > 0 ? 'border-amber-500/50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${stats.suspiciousActivity > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              Abuse Detection
            </CardTitle>
            <CardDescription>Monitor for suspicious activity</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.suspiciousActivity > 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="font-medium text-amber-800 mb-2">
                  {stats.suspiciousActivity} suspicious patterns detected
                </p>
                <p className="text-sm text-amber-700">
                  Multiple submissions from same source detected. Review manually.
                </p>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="mt-3">
                    View Details
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="font-medium text-emerald-800">No abuse detected</p>
                <p className="text-sm text-emerald-700">
                  All funnel activity appears legitimate
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Recent Funnel Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {events.slice(0, 20).map((event: any) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {event.event_type === 'thumbs_up' ? (
                    <ThumbsUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {event.source}
                    </Badge>
                    {event.comment && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {event.comment}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(event.created_at), 'MMM d, HH:mm')}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No funnel activity yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
