import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Building2,
  MessageSquare,
  Search,
  CalendarDays,
  ArrowUpDown,
  Send,
  TrendingUp,
  Zap,
  MoreHorizontal,
  ChevronRight,
  Sparkles,
  Filter,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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

export default function DentistAppointmentsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'date'>('newest');

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-appointments', user?.id],
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
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['dentist-all-appointments', clinic?.id],
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
  const updateAppointment = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Appointment> }) => {
      const { data: old } = await supabase.from('appointments').select('*').eq('id', id).single();
      const { error } = await supabase
        .from('appointments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      if (updates.status && old?.status !== updates.status) {
        supabase.functions.invoke('send-booking-email', {
          body: { appointmentId: id, type: 'status_update', newStatus: updates.status },
        }).catch(console.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dentist-all-appointments'] });
      toast.success('Appointment updated');
      setSelectedAppointment(null);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  // Filter and sort
  const filteredAppointments = appointments?.filter((apt) => {
    const matchesSearch = !searchQuery ||
      apt.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.patient_phone.includes(searchQuery);

    const matchesTab = activeTab === 'all' ||
      (activeTab === 'pending' && apt.status === 'pending') ||
      (activeTab === 'confirmed' && apt.status === 'confirmed') ||
      (activeTab === 'completed' && apt.status === 'completed');

    let matchesDate = true;
    if (dateFilter !== 'all' && apt.preferred_date) {
      const aptDate = new Date(apt.preferred_date);
      switch (dateFilter) {
        case 'today': matchesDate = isToday(aptDate); break;
        case 'tomorrow': matchesDate = isTomorrow(aptDate); break;
        case 'this_week': matchesDate = isThisWeek(aptDate); break;
      }
    }

    return matchesSearch && matchesTab && matchesDate;
  });

  const sortedAppointments = [...(filteredAppointments || [])].sort((a, b) => {
    if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortOrder === 'date') {
      if (!a.preferred_date) return 1;
      if (!b.preferred_date) return -1;
      return new Date(a.preferred_date).getTime() - new Date(b.preferred_date).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Stats
  const stats = {
    all: appointments?.length || 0,
    pending: appointments?.filter(a => a.status === 'pending').length || 0,
    confirmed: appointments?.filter(a => a.status === 'confirmed').length || 0,
    completed: appointments?.filter(a => a.status === 'completed').length || 0,
    today: appointments?.filter(a => a.preferred_date && isToday(new Date(a.preferred_date))).length || 0,
  };

  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case 'pending': return { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-200' };
      case 'confirmed': return { label: 'Confirmed', className: 'bg-primary/10 text-primary border-primary/20' };
      case 'completed': return { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' };
      case 'cancelled': return { label: 'Cancelled', className: 'bg-destructive/10 text-destructive border-destructive/20' };
      default: return { label: 'Unknown', className: 'bg-muted text-muted-foreground' };
    }
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-20 w-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-6">
          <Building2 className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">No Practice Linked</h2>
        <p className="text-muted-foreground mb-6">Claim your profile to start receiving bookings</p>
        <Button asChild>
          <Link to="/claim-profile">Claim Your Profile</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Manage your patient bookings</p>
        </div>
        <Button variant="outline" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          Calendar View
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className="cursor-pointer bg-gradient-to-br from-slate-900 to-slate-800 border-0 text-white hover:shadow-xl transition-all" 
          onClick={() => setActiveTab('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.all}</p>
                <p className="text-xs text-slate-300">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer bg-gradient-to-br from-amber-500 to-amber-600 border-0 text-white hover:shadow-xl transition-all" 
          onClick={() => setActiveTab('pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-amber-100">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer bg-gradient-to-br from-primary to-teal border-0 text-white hover:shadow-xl transition-all" 
          onClick={() => setActiveTab('confirmed')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
                <p className="text-xs text-teal-100">Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 text-white hover:shadow-xl transition-all" 
          onClick={() => setActiveTab('completed')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-emerald-100">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer bg-gradient-to-br from-coral to-coral/90 border-0 text-white hover:shadow-xl transition-all" 
          onClick={() => { setDateFilter('today'); setActiveTab('all'); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-xs text-coral-light">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10 bg-background rounded-xl"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[140px] rounded-xl">
                <CalendarDays className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
              <SelectTrigger className="w-[140px] rounded-xl">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-auto">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {sortedAppointments.length} appointment{sortedAppointments.length !== 1 ? 's' : ''}
        </p>
        {(searchQuery || dateFilter !== 'all' || activeTab !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setDateFilter('all'); setActiveTab('all'); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Appointment List */}
      <Card className="card-modern overflow-hidden">
        <CardContent className="p-0">
          {appointmentsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : sortedAppointments.length > 0 ? (
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {sortedAppointments.map((apt) => {
                  const statusConfig = getStatusConfig(apt.status);
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => setSelectedAppointment(apt)}
                    >
                      <Avatar className="h-12 w-12 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {apt.patient_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-foreground">{apt.patient_name}</p>
                          {apt.treatment && (
                            <Badge variant="secondary" className="text-xs">{(apt.treatment as any)?.name}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {apt.patient_phone}
                          </span>
                          {apt.preferred_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(apt.preferred_date), 'MMM d')}
                              {apt.preferred_time && ` at ${apt.preferred_time}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <Badge className={`${statusConfig.className} border`}>{statusConfig.label}</Badge>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium mb-1">No appointments found</p>
              <p className="text-sm text-muted-foreground">Appointments will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Appointment Details
            </DialogTitle>
            <DialogDescription>View and manage this booking</DialogDescription>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-6 py-4">
              {/* Patient Info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                    {selectedAppointment.patient_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{selectedAppointment.patient_name}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedAppointment.patient_phone}</span>
                    {selectedAppointment.patient_email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selectedAppointment.patient_email}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Requested Date</p>
                  <p className="font-medium">
                    {selectedAppointment.preferred_date 
                      ? format(new Date(selectedAppointment.preferred_date), 'MMMM d, yyyy')
                      : 'Not specified'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Requested Time</p>
                  <p className="font-medium">{selectedAppointment.preferred_time || 'Not specified'}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge className={`${getStatusConfig(selectedAppointment.status).className} border`}>
                    {getStatusConfig(selectedAppointment.status).label}
                  </Badge>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <p className="font-medium capitalize">{selectedAppointment.source || 'Website'}</p>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Patient Notes</p>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedAppointment(null)}>Close</Button>
            {selectedAppointment?.status === 'pending' && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => updateAppointment.mutate({ id: selectedAppointment.id, updates: { status: 'cancelled' } })}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button 
                  className="bg-primary"
                  onClick={() => updateAppointment.mutate({ id: selectedAppointment.id, updates: { status: 'confirmed' } })}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Confirm
                </Button>
              </>
            )}
            {selectedAppointment?.status === 'confirmed' && (
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => updateAppointment.mutate({ id: selectedAppointment.id, updates: { status: 'completed' } })}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Mark Complete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
