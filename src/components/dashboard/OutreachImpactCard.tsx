import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Send, 
  Users, 
  MessageSquare, 
  CheckCircle,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { startOfMonth } from 'date-fns';

interface OutreachImpactCardProps {
  clinicId: string;
}

export default function OutreachImpactCard({ clinicId }: OutreachImpactCardProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['outreach-impact', clinicId],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      
      const [patientsResult, requestsResult, messagesResult, automationResult] = await Promise.all([
        // Patients added this month
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', clinicId)
          .gte('created_at', monthStart),
        // Review requests
        supabase
          .from('review_requests')
          .select('id, status')
          .eq('clinic_id', clinicId)
          .gte('created_at', monthStart),
        // Messages sent
        supabase
          .from('clinic_messages')
          .select('id, status')
          .eq('clinic_id', clinicId)
          .gte('created_at', monthStart),
        // Automation settings
        supabase
          .from('clinic_automation_settings')
          .select('*')
          .eq('clinic_id', clinicId)
          .single(),
      ]);

      const requests = requestsResult.data || [];
      const messages = messagesResult.data || [];
      
      const sentRequests = requests.filter(r => r.status === 'sent' || r.status === 'delivered').length;
      const completedRequests = requests.filter(r => r.status === 'completed').length;
      
      return {
        patientsThisMonth: patientsResult.count || 0,
        reviewRequestsSent: sentRequests,
        reviewsReceived: completedRequests,
        conversionRate: sentRequests > 0 ? Math.round((completedRequests / sentRequests) * 100) : 0,
        messagesSent: messages.filter(m => m.status === 'sent' || m.status === 'delivered').length,
        messagesFailed: messages.filter(m => m.status === 'failed').length,
        automationEnabled: automationResult.data?.is_messaging_enabled || false,
        reminderEnabled: automationResult.data?.reminder_1_day || false,
      };
    },
    enabled: !!clinicId,
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-48 w-full bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg overflow-hidden">
      {/* Purple accent bar */}
      <div className="h-1 bg-purple" />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <div className="h-8 w-8 rounded-lg bg-purple/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple" />
            </div>
            Outreach Impact
          </CardTitle>
          <Badge variant="outline" className="text-[10px] bg-purple/20 border-purple/30 text-purple">This Month</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-0">
        {/* Main stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-slate-700/40 border border-slate-600/30">
            <Users className="h-4 w-4 text-purple mb-1" />
            <p className="text-xl font-extrabold text-white">{stats?.patientsThisMonth || 0}</p>
            <p className="text-[10px] text-white/50">New patients</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-700/40 border border-slate-600/30">
            <Send className="h-4 w-4 text-purple mb-1" />
            <p className="text-xl font-extrabold text-white">{stats?.reviewRequestsSent || 0}</p>
            <p className="text-[10px] text-white/50">Review requests</p>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="p-3 rounded-xl bg-slate-700/40 border border-slate-600/30 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-white">Review Conversion</span>
            <span className="font-bold text-purple">{stats?.conversionRate || 0}%</span>
          </div>
          <Progress value={stats?.conversionRate || 0} className="h-1.5 bg-slate-600/50" />
          <div className="flex justify-between text-[10px] text-white/50">
            <span>{stats?.reviewRequestsSent || 0} sent</span>
            <span>{stats?.reviewsReceived || 0} completed</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-700/40 border border-slate-600/30">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple" />
            <div>
              <p className="text-sm font-semibold text-white">{stats?.messagesSent || 0}</p>
              <p className="text-[10px] text-white/50">Messages sent</p>
            </div>
          </div>
          {(stats?.messagesFailed || 0) > 0 && (
            <Badge className="bg-coral/20 text-coral border-coral/30 border text-[10px]">
              {stats.messagesFailed} failed
            </Badge>
          )}
        </div>

        {/* Automation status */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/40 border border-slate-600/30">
          <Zap className={cn(
            'h-4 w-4',
            stats?.automationEnabled ? 'text-gold' : 'text-white/40'
          )} />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Automation</p>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              'text-[10px] border',
              stats?.automationEnabled 
                ? 'bg-gold/20 text-gold border-gold/30' 
                : 'bg-slate-700/30 text-white/50 border-slate-600/30'
            )}
          >
            {stats?.automationEnabled ? (
              <>
                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                ON
              </>
            ) : (
              'OFF'
            )}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}