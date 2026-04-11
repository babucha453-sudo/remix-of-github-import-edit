import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ArrowRight,
  User,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

interface AppointmentsTimelineProps {
  clinicId: string;
  onViewAll?: () => void;
}

const statusConfig = {
  pending: { 
    label: 'Pending', 
    color: 'bg-gold/10 text-gold border-gold/20',
    icon: Clock,
    dotColor: 'bg-gold'
  },
  confirmed: { 
    label: 'Confirmed', 
    color: 'bg-blue-custom/10 text-blue-custom border-blue-custom/20',
    icon: CheckCircle,
    dotColor: 'bg-blue-custom'
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-teal/10 text-teal border-teal/20',
    icon: CheckCircle,
    dotColor: 'bg-teal'
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-coral/10 text-coral border-coral/20',
    icon: XCircle,
    dotColor: 'bg-coral'
  },
  no_show: { 
    label: 'No Show', 
    color: 'bg-muted text-muted-foreground border-border',
    icon: AlertCircle,
    dotColor: 'bg-muted-foreground'
  },
};

export default function AppointmentsTimeline({ clinicId, onViewAll }: AppointmentsTimelineProps) {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments-timeline', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(8);
      return data || [];
    },
    enabled: !!clinicId,
  });

  const { data: todayStats } = useQuery({
    queryKey: ['today-appointments-stats', clinicId],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      
      const { data } = await supabase
        .from('appointments')
        .select('status')
        .eq('clinic_id', clinicId)
        .gte('created_at', startOfDay)
        .lt('created_at', endOfDay);

      const appts = data || [];
      return {
        total: appts.length,
        pending: appts.filter(a => a.status === 'pending').length,
        confirmed: appts.filter(a => a.status === 'confirmed').length,
        completed: appts.filter(a => a.status === 'completed').length,
      };
    },
    enabled: !!clinicId,
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full bg-slate-700/50" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg h-full overflow-hidden">
      {/* Blue accent bar */}
      <div className="h-1 bg-primary" />
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            Appointments
          </CardTitle>
          <Badge className="font-semibold bg-primary/20 border-primary/30 text-primary border">
            {todayStats?.total || 0} today
          </Badge>
        </div>
        
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/40 border border-slate-600/50">
            <div className="h-2 w-2 rounded-full bg-gold" />
            <span className="text-xs font-medium text-white">{todayStats?.pending || 0} Pending</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/40 border border-slate-600/50">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-white">{todayStats?.confirmed || 0} Confirmed</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/40 border border-slate-600/50">
            <div className="h-2 w-2 rounded-full bg-teal" />
            <span className="text-xs font-medium text-white">{todayStats?.completed || 0} Done</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 border-t border-slate-700/50 bg-slate-900/50">
        <ScrollArea className="h-[280px] pr-4">
          {appointments && appointments.length > 0 ? (
            <div className="space-y-3 pt-4">
              {appointments.map((apt, index) => {
                const status = apt.status as keyof typeof statusConfig || 'pending';
                const config = statusConfig[status] || statusConfig.pending;
                const StatusIcon = config.icon;
                const aptDate = apt.preferred_date ? parseISO(apt.preferred_date) : new Date(apt.created_at);
                
                return (
                  <div
                    key={apt.id}
                    className="group relative flex gap-3 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className={cn('h-3 w-3 rounded-full', config.dotColor)} />
                      {index < (appointments?.length || 0) - 1 && (
                        <div className="w-px h-full bg-slate-600/50 flex-1 mt-1" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-white/50" />
                            <p className="font-semibold text-sm text-white">{apt.patient_name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                            <Phone className="h-3 w-3" />
                            <span>{apt.patient_phone}</span>
                          </div>
                        </div>
                        <Badge className={cn('border text-[10px]', config.color)}>
                          <StatusIcon className="h-2.5 w-2.5 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      
                      <div className="mt-2 text-xs text-white/50">
                        {isToday(aptDate) ? (
                          <span className="text-gold font-medium">Today</span>
                        ) : isTomorrow(aptDate) ? (
                          <span className="text-primary font-medium">Tomorrow</span>
                        ) : (
                          format(aptDate, 'MMM d, yyyy')
                        )}
                        {apt.preferred_time && ` at ${apt.preferred_time}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Calendar className="h-12 w-12 text-white/30 mb-3" />
              <p className="text-sm font-medium text-white">No appointments yet</p>
              <p className="text-xs text-white/50">New bookings will appear here</p>
            </div>
          )}
        </ScrollArea>

        {onViewAll && appointments && appointments.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full mt-3 justify-between text-sm font-semibold bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
            onClick={onViewAll}
          >
            View All Appointments
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
