import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Bell, AlertTriangle, Check, Clock, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { createAuditLog } from '@/lib/audit';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationAlertsTab({ clinicId, isAdmin }: Props) {
  const queryClient = useQueryClient();

  // Derive alerts from review data (since reputation_alerts table may not exist)
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['rep-alerts-derived', clinicId],
    queryFn: async () => {
      const derivedAlerts: any[] = [];

      // Check for unreplied reviews > 7 days
      let query = supabase
        .from('google_reviews')
        .select('id, clinic_id, author_name, rating, created_at, clinic:clinics(name)')
        .neq('reply_status', 'posted')
        .order('created_at', { ascending: true });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data: unreplied } = await query.limit(20);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      unreplied?.forEach((r: any) => {
        if (new Date(r.created_at) < sevenDaysAgo) {
          derivedAlerts.push({
            id: `unreplied-${r.id}`,
            type: 'slow_reply',
            severity: 'high',
            title: 'Unreplied Review',
            description: `Review from ${r.author_name} (${r.rating}★) needs reply`,
            clinic_name: r.clinic?.name,
            created_at: r.created_at,
            status: 'active',
          });
        }
      });

      // Check for low ratings
      let lowQuery = supabase
        .from('google_reviews')
        .select('id, clinic_id, author_name, rating, created_at, clinic:clinics(name)')
        .lte('rating', 2)
        .order('created_at', { ascending: false });
      if (clinicId) lowQuery = lowQuery.eq('clinic_id', clinicId);
      const { data: lowRatings } = await lowQuery.limit(10);

      lowRatings?.forEach((r: any) => {
        derivedAlerts.push({
          id: `low-${r.id}`,
          type: 'low_rating',
          severity: 'medium',
          title: 'Low Rating Alert',
          description: `${r.rating}★ review from ${r.author_name}`,
          clinic_name: r.clinic?.name,
          created_at: r.created_at,
          status: 'active',
        });
      });

      return derivedAlerts.slice(0, 50);
    },
  });

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, string> = {
      high: 'bg-destructive/10 text-destructive',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-blue-100 text-blue-700',
    };
    return <Badge className={config[severity] || 'bg-muted'}>{severity}</Badge>;
  };

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Active Alerts ({alerts.filter((a: any) => a.status === 'active').length})
          </CardTitle>
          <CardDescription>Reputation incidents requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
              <p className="font-medium text-emerald-600">No active alerts</p>
              <p className="text-sm">Your reputation is healthy</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {alerts.map((alert: any) => (
                  <div key={alert.id} className="p-4 rounded-xl border bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                          alert.severity === 'high' ? 'text-destructive' : 'text-amber-500'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{alert.title}</span>
                            {getSeverityBadge(alert.severity)}
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                          {isAdmin && alert.clinic_name && (
                            <Badge variant="outline" className="mt-2 text-xs gap-1">
                              <Building2 className="h-3 w-3" />
                              {alert.clinic_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(alert.created_at), 'MMM d')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
