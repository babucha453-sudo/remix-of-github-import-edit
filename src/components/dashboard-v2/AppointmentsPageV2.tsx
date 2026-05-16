/**
 * Appointments Page v2
 * Calendar view with appointment management
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek, addDays, isToday, isTomorrow, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Printer,
  Plus,
  Search,
  User,
  Phone,
  Mail,
  MoreVertical,
  CheckCircle,
  XCircle,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PremiumCard,
  PageHeader,
  StatusBadge,
  EmptyState,
  SkeletonList,
  PremiumButton,
} from './DesignSystem';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AppointmentsPageV2Props {
  onNavigate: (tab: string) => void;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', status: 'warning' as const, color: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', status: 'info' as const, color: 'bg-blue-500' },
  completed: { label: 'Completed', status: 'success' as const, color: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', status: 'error' as const, color: 'bg-red-500' },
  no_show: { label: 'No Show', status: 'neutral' as const, color: 'bg-slate-400' },
};

export default function AppointmentsPageV2({ onNavigate }: AppointmentsPageV2Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rescheduleModal, setRescheduleModal] = useState<{open: boolean, appointment: any}>({open: false, appointment: null});
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  // Fetch clinic
  const { data: clinic } = useQuery({
    queryKey: ['appointments-v2-clinic', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch appointments
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments-v2', clinic?.id, format(selectedDate, 'yyyy-MM-dd'), statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('*, treatment:treatments(name)')
        .eq('clinic_id', clinic?.id)
        .order('preferred_time', { ascending: true });

      // Date filter based on view mode
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      if (viewMode === 'day') {
        query = query.eq('preferred_date', dateStr);
      } else {
        const weekStart = format(startOfWeek(selectedDate), 'yyyy-MM-dd');
        const weekEnd = format(addDays(startOfWeek(selectedDate), 6), 'yyyy-MM-dd');
        query = query.gte('preferred_date', weekStart).lte('preferred_date', weekEnd);
      }

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Update appointment status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-v2'] });
      toast.success('Appointment updated');
    },
    onError: () => {
      toast.error('Failed to update appointment');
    },
  });

  // Reschedule appointment
  const rescheduleAppointment = useMutation({
    mutationFn: async ({ id, preferredDate, preferredTime }: { id: string; preferredDate: string; preferredTime: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ preferred_date: preferredDate, preferred_time: preferredTime })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-v2'] });
      toast.success('Appointment rescheduled');
      setRescheduleModal({open: false, appointment: null});
    },
    onError: () => {
      toast.error('Failed to reschedule appointment');
    },
  });

  // Filter appointments by search
  const filteredAppointments = appointments.filter((apt) =>
    apt.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    apt.patient_phone?.includes(searchQuery)
  );

  // Group by date for week view
  const groupedByDate = filteredAppointments.reduce((acc, apt) => {
    const date = apt.preferred_date || format(new Date(apt.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(apt);
    return acc;
  }, {} as Record<string, typeof appointments>);

  // Navigation
  const goToToday = () => setSelectedDate(new Date());
  const goPrev = () => setSelectedDate(d => addDays(d, viewMode === 'day' ? -1 : -7));
  const goNext = () => setSelectedDate(d => addDays(d, viewMode === 'day' ? 1 : 7));

  // Stats
  const stats = {
    total: filteredAppointments.length,
    pending: filteredAppointments.filter(a => a.status === 'pending').length,
    confirmed: filteredAppointments.filter(a => a.status === 'confirmed').length,
    completed: filteredAppointments.filter(a => a.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle="Manage your schedule and patient bookings"
        primaryAction={
          <PremiumButton icon={Plus}>
            Create Appointment
          </PremiumButton>
        }
        secondaryActions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-xl">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Controls Bar */}
      <PremiumCard padding="sm">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Date Navigation */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="rounded-xl" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="rounded-xl px-4" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold text-foreground">
              {viewMode === 'day'
                ? format(selectedDate, 'EEEE, MMMM d, yyyy')
                : `Week of ${format(startOfWeek(selectedDate), 'MMM d')}`}
            </div>
          </div>

          {/* View Toggle & Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-48 rounded-xl"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 rounded-xl">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-xl border overflow-hidden">
              <Button
                variant={viewMode === 'day' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-700' },
          { label: 'Pending', value: stats.pending, color: 'bg-amber-50 text-amber-700' },
          { label: 'Confirmed', value: stats.confirmed, color: 'bg-blue-50 text-blue-700' },
          { label: 'Completed', value: stats.completed, color: 'bg-emerald-50 text-emerald-700' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-xl p-4 text-center', stat.color)}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Appointments List */}
      <PremiumCard padding="none">
        <div className="h-1 bg-gradient-to-r from-primary via-teal to-emerald-500" />
        
        <div className="p-6">
          {isLoading ? (
            <SkeletonList count={5} />
          ) : filteredAppointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No appointments"
              description={`No appointments scheduled for ${format(selectedDate, 'MMMM d, yyyy')}`}
              action={
                <Button onClick={() => onNavigate('my-availability')}>Set Availability</Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((apt) => {
                const config = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                
                return (
                  <div
                    key={apt.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/20 hover:shadow-md transition-all group"
                  >
                    {/* Time indicator */}
                    <div className="flex flex-col items-center w-16 flex-shrink-0">
                      <div className={cn('h-3 w-3 rounded-full mb-1', config.color)} />
                      <span className="text-sm font-semibold text-foreground">
                        {apt.preferred_time || 'TBD'}
                      </span>
                    </div>

                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold text-foreground truncate">{apt.patient_name}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {apt.patient_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {apt.patient_phone}
                          </span>
                        )}
                        {apt.treatment?.name && (
                          <span>{apt.treatment.name}</span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <StatusBadge status={config.status} label={config.label} />

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl">
                        <DropdownMenuItem className="gap-2">
                          <User className="h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Message Patient
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {apt.status === 'pending' && (
                          <DropdownMenuItem
                            className="gap-2 text-emerald-600"
                            onClick={() => updateStatus.mutate({ id: apt.id, status: 'confirmed' })}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                        {apt.status === 'confirmed' && (
                          <DropdownMenuItem
                            className="gap-2 text-blue-600"
                            onClick={() => updateStatus.mutate({ id: apt.id, status: 'completed' })}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => {
                              setRescheduleModal({open: true, appointment: apt});
                              setNewDate(apt.preferred_date || '');
                              setNewTime(apt.preferred_time || '');
                            }}
                          >
                          <RefreshCw className="h-4 w-4" />
                          Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive"
                          onClick={() => updateStatus.mutate({ id: apt.id, status: 'cancelled' })}
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PremiumCard>

      {/* Reschedule Modal */}
      <Dialog open={rescheduleModal.open} onOpenChange={(open) => !open && setRescheduleModal({open: false, appointment: null})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <p className="font-medium">{rescheduleModal.appointment?.patient_name}</p>
            </div>
            <div className="space-y-2">
              <Label>New Date</Label>
              <Input 
                type="date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>New Time</Label>
              <Input 
                type="time" 
                value={newTime} 
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleModal({open: false, appointment: null})}>
              Cancel
            </Button>
            <Button 
              onClick={() => rescheduleAppointment.mutate({
                id: rescheduleModal.appointment?.id,
                preferredDate: newDate,
                preferredTime: newTime
              })}
              disabled={!newDate || !newTime || rescheduleAppointment.isPending}
            >
              {rescheduleAppointment.isPending ? 'Saving...' : 'Confirm Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
