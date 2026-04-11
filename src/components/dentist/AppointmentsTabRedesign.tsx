import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Search,
  ArrowUpDown,
  Filter,
  MoreHorizontal,
  AlertCircle,
  Loader2,
  CalendarDays,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NoPracticeLinked } from './NoPracticeLinked';

interface Appointment {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  confirmed_date: string | null;
  confirmed_time: string | null;
  status: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  source: string | null;
  treatment?: { id: string; name: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-gold', bgColor: 'bg-gold/20' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  completed: { label: 'Completed', color: 'text-primary', bgColor: 'bg-primary/20' },
  cancelled: { label: 'Cancelled', color: 'text-coral', bgColor: 'bg-coral/20' },
  no_show: { label: 'No Show', color: 'text-white/50', bgColor: 'bg-white/10' },
};

export default function AppointmentsTabRedesign() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dateFilter, setDateFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-appts-v2', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch appointments
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['dentist-appointments-v2', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, treatment:treatments(id, name)')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!clinic?.id,
  });

  // Update appointment
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Appointment> }) => {
      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id);
      if (error) throw error;

      // Send notification email
      if (updates.status) {
        await supabase.functions.invoke('send-booking-email', {
          body: { appointmentId: id, action: updates.status },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dentist-appointments-v2'] });
      toast.success('Appointment updated!');
      setSelectedAppointment(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update');
    },
  });

  // Filter and sort
  const filteredAppointments = appointments
    .filter((appt) => {
      if (activeTab !== 'all' && appt.status !== activeTab) return false;
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        if (
          !appt.patient_name.toLowerCase().includes(search) &&
          !appt.patient_phone.includes(search)
        )
          return false;
      }
      if (dateFilter === 'today' && appt.preferred_date) {
        if (!isToday(parseISO(appt.preferred_date))) return false;
      }
      if (dateFilter === 'tomorrow' && appt.preferred_date) {
        if (!isTomorrow(parseISO(appt.preferred_date))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  // Stats
  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => a.status === 'pending').length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!clinic) return <NoPracticeLinked />;

  const getStatusConfig = (status: string | null) =>
    STATUS_CONFIG[status || 'pending'] || STATUS_CONFIG.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Appointments</h1>
          <p className="text-white/60 mt-1">Manage your patient bookings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/20 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-white/60">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gold/20 to-gold/5 border-gold/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gold/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.pending}</p>
                <p className="text-xs text-white/60">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.confirmed}</p>
                <p className="text-xs text-white/60">Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal/20 to-teal/5 border-teal/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-teal/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.completed}</p>
                <p className="text-xs text-white/60">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search by name or phone..."
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-white hover:bg-white/10">All Dates</SelectItem>
                  <SelectItem value="today" className="text-white hover:bg-white/10">Today</SelectItem>
                  <SelectItem value="tomorrow" className="text-white hover:bg-white/10">Tomorrow</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
              </Button>
            </div>

            {/* Status Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
              <TabsList className="bg-white/5 border border-white/10 p-1 h-auto">
                <TabsTrigger
                  value="all"
                  className="text-white/60 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="text-white/60 data-[state=active]:bg-gold data-[state=active]:text-white"
                >
                  Pending
                </TabsTrigger>
                <TabsTrigger
                  value="confirmed"
                  className="text-white/60 data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
                >
                  Confirmed
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="text-white/60 data-[state=active]:bg-teal data-[state=active]:text-white"
                >
                  Completed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-teal to-purple" />
        <CardContent className="p-0">
          {appointmentsLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 bg-white/5 rounded-xl" />
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-white/30" />
              </div>
              <p className="text-white/50 text-lg">No appointments found</p>
              <p className="text-white/30 text-sm mt-1">
                {searchQuery ? 'Try a different search term' : 'Appointments will appear here'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-white/5">
                {filteredAppointments.map((appt) => {
                  const statusConfig = getStatusConfig(appt.status);
                  return (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setSelectedAppointment(appt)}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-white/10">
                          <AvatarFallback className="bg-primary/20 text-primary font-bold">
                            {appt.patient_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white truncate">{appt.patient_name}</p>
                            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0 text-[10px]`}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-white/50">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {appt.preferred_date
                                ? format(parseISO(appt.preferred_date), 'MMM d, yyyy')
                                : 'TBD'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {appt.preferred_time || 'TBD'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {appt.patient_phone}
                            </span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-white/40 hover:text-white hover:bg-white/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            {appt.status === 'pending' && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateMutation.mutate({ id: appt.id, updates: { status: 'confirmed' } });
                                }}
                                className="text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirm
                              </DropdownMenuItem>
                            )}
                            {(appt.status === 'pending' || appt.status === 'confirmed') && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateMutation.mutate({ id: appt.id, updates: { status: 'completed' } });
                                }}
                                className="text-teal hover:bg-teal/10 cursor-pointer"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Complete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMutation.mutate({ id: appt.id, updates: { status: 'cancelled' } });
                              }}
                              className="text-coral hover:bg-coral/10 cursor-pointer"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-700">
          {selectedAppointment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {selectedAppointment.patient_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/50 mb-1">Date</p>
                    <p className="text-white font-medium">
                      {selectedAppointment.preferred_date
                        ? format(parseISO(selectedAppointment.preferred_date), 'MMMM d, yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/50 mb-1">Time</p>
                    <p className="text-white font-medium">{selectedAppointment.preferred_time || 'Not set'}</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-white/50 mb-1">Contact</p>
                  <div className="space-y-1">
                    <p className="text-white flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      {selectedAppointment.patient_phone}
                    </p>
                    {selectedAppointment.patient_email && (
                      <p className="text-white flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        {selectedAppointment.patient_email}
                      </p>
                    )}
                  </div>
                </div>
                {selectedAppointment.notes && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/50 mb-1">Patient Notes</p>
                    <p className="text-white text-sm">{selectedAppointment.notes}</p>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-white/5">
                  <Label className="text-xs text-white/50">Admin Notes</Label>
                  <Textarea
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    placeholder="Add internal notes..."
                    defaultValue={selectedAppointment.admin_notes || ''}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                {selectedAppointment.status === 'pending' && (
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    onClick={() =>
                      updateMutation.mutate({ id: selectedAppointment.id, updates: { status: 'confirmed' } })
                    }
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-coral/50 text-coral hover:bg-coral/10"
                  onClick={() =>
                    updateMutation.mutate({ id: selectedAppointment.id, updates: { status: 'cancelled' } })
                  }
                  disabled={updateMutation.isPending}
                >
                  Cancel Appointment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
