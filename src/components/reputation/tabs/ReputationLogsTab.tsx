import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, User, Sparkles, Settings, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationLogsTab({ clinicId, isAdmin }: Props) {
  // Fetch audit logs related to reputation actions
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['rep-audit-logs', clinicId],
    queryFn: async () => {
      const reputationActions = [
        'update_review_status',
        'flag_fake_review',
        'save_reply',
        'mark_reply_posted',
        'update_funnel_settings',
        'create_survey',
        'update_survey',
        'enable_ai_module',
        'disable_ai_module',
      ];

      let query = supabase
        .from('audit_logs')
        .select('*')
        .in('action', reputationActions)
        .order('created_at', { ascending: false });

      const { data, error } = await query.limit(200);
      if (error) return [];
      return data || [];
    },
    enabled: isAdmin,
  });

  // For dentist view, fetch their own actions
  const { data: dentistLogs = [] } = useQuery({
    queryKey: ['rep-dentist-logs', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !isAdmin && !!clinicId,
  });

  const displayLogs = isAdmin ? logs : dentistLogs;

  const getActionBadge = (action: string) => {
    if (action.includes('ai')) return <Badge className="bg-purple-100 text-purple-700">AI</Badge>;
    if (action.includes('reply')) return <Badge className="bg-blue-100 text-blue-700">Reply</Badge>;
    if (action.includes('review')) return <Badge className="bg-amber-100 text-amber-700">Review</Badge>;
    if (action.includes('funnel')) return <Badge className="bg-primary/10 text-primary">Funnel</Badge>;
    return <Badge variant="outline">{action}</Badge>;
  };

  const getActionIcon = (action: string) => {
    if (action.includes('ai')) return <Sparkles className="h-4 w-4 text-purple-500" />;
    if (action.includes('settings')) return <Settings className="h-4 w-4 text-muted-foreground" />;
    return <User className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Audit Logs
          </CardTitle>
          <CardDescription>
            {isAdmin ? 'All reputation-related actions across the platform' : 'Your recent actions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {displayLogs.map((log: any) => (
                  <div key={log.id} className="p-3 rounded-lg bg-muted/50 flex items-start gap-3">
                    {getActionIcon(log.action)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm">{log.action.replace(/_/g, ' ')}</span>
                        {getActionBadge(log.action)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {log.user_email || 'System'} • {log.entity_type}
                        {log.entity_id && ` (${log.entity_id.slice(0, 8)}...)`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </span>
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
