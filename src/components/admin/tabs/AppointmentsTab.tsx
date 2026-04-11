import { useState } from 'react';
import { useAdminAppointments, useUpdateAppointment, useDentistBookingCounts } from '@/hooks/useAdminAppointments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Calendar,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Building2,
  Phone,
  Stethoscope,
  Filter,
  Download,
  BarChart3,
  UserCheck,
  Send,
  Mail,
  MessageSquare,
  Link2,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  Settings2,
  Bell,
  CalendarCheck,
  CalendarX,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

export default function AppointmentsTab() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    clinicId: '',
    dentistId: '',
    treatmentId: '',
    dateFrom: '',
    dateTo: '',
    source: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [activeView, setActiveView] = useState<'all' | 'today' | 'upcoming' | 'urgent'>('all');

  const { data: appointments, isLoading, refetch } = useAdminAppointments({
    status: filters.status || undefined,
    clinicId: filters.clinicId || undefined,
    dentistId: filters.dentistId || undefined,
    treatmentId: filters.treatmentId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    source: filters.source || undefined,
  });
  const updateAppointment = useUpdateAppointment();
  const { data: dentistCounts } = useDentistBookingCounts();

  // Send notification mutation
  const sendNotification = useMutation({
    mutationFn: async ({ appointmentId, type }: { appointmentId: string; type: string }) => {
      const { data, error } = await supabase.functions.invoke('send-booking-email', {
        body: { appointmentId, type: 'status_update', newStatus: type }
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'success' in data && (data as any).success === false) {
        throw new Error((data as any).error || 'Failed to send notification');
      }
    },
    onSuccess: () => {
      toast.success('Notification sent successfully');
    },
    onError: (error) => {
      toast.error('Failed to send notification');
      console.error(error);
    }
  });

  // Fetch filter options
  const { data: clinics } = useQuery({
    queryKey: ['filter-clinics'],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('id, name, slug').eq('is_active', true).order('name').limit(100);
      return data || [];
    },
  });

  const { data: dentists } = useQuery({
    queryKey: ['filter-dentists'],
    queryFn: async () => {
      const { data } = await supabase.from('dentists').select('id, name').eq('is_active', true).order('name').limit(100);
      return data || [];
    },
  });

  const { data: treatments } = useQuery({
    queryKey: ['filter-treatments'],
    queryFn: async () => {
      const { data } = await supabase.from('treatments').select('id, name').eq('is_active', true).order('display_order');
      return data || [];
    },
  });

  const handleStatusChange = async (id: string, status: string, sendEmail: boolean = false) => {
    await updateAppointment.mutateAsync({ id, updates: { status: status as any } });
    if (sendEmail) {
      sendNotification.mutate({ appointmentId: id, type: status });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <Badge className="bg-primary/10 text-primary border border-primary/20"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case 'completed': return <Badge className="bg-teal/10 text-teal border border-teal/20"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'cancelled': return <Badge className="bg-coral/10 text-coral border border-coral/20"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'no_show': return <Badge className="bg-gold/10 text-gold border border-gold/20"><AlertTriangle className="h-3 w-3 mr-1" />No Show</Badge>;
      default: return <Badge className="bg-purple/10 text-purple border border-purple/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getDateBadge = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (isToday(date)) return <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px]">Today</Badge>;
    if (isTomorrow(date)) return <Badge className="bg-teal/10 text-teal border border-teal/20 text-[10px]">Tomorrow</Badge>;
    if (isPast(date)) return <Badge className="bg-coral/10 text-coral border border-coral/20 text-[10px]">Past</Badge>;
    return null;
  };

  const copyManageLink = (token: string) => {
    const link = `${window.location.origin}/appointment/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Appointment link copied!');
  };

  const openManageLink = (token: string) => {
    window.open(`${window.location.origin}/appointment/${token}`, '_blank');
  };

  const openClinicBookingPage = (slug: string) => {
    window.open(`${window.location.origin}/clinic/${slug}`, '_blank');
  };

  const statusCounts = {
    pending: appointments?.filter(a => a.status === 'pending').length || 0,
    confirmed: appointments?.filter(a => a.status === 'confirmed').length || 0,
    completed: appointments?.filter(a => a.status === 'completed').length || 0,
    cancelled: appointments?.filter(a => a.status === 'cancelled').length || 0,
    no_show: appointments?.filter(a => a.status === 'no_show').length || 0,
  };

  // Filter appointments based on active view
  const getFilteredAppointments = () => {
    let filtered = appointments || [];
    
    // Search filter
    filtered = filtered.filter(a =>
      a.patient_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      a.patient_phone?.includes(filters.search) ||
      a.clinic?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      a.dentist?.name?.toLowerCase().includes(filters.search.toLowerCase())
    );

    // View filter
    const today = new Date().toISOString().split('T')[0];
    switch (activeView) {
      case 'today':
        filtered = filtered.filter(a => a.preferred_date === today);
        break;
      case 'upcoming':
        filtered = filtered.filter(a => a.preferred_date && a.preferred_date >= today && a.status !== 'cancelled' && a.status !== 'completed');
        break;
      case 'urgent':
        filtered = filtered.filter(a => a.status === 'pending' || a.status === 'no_show');
        break;
    }

    return filtered;
  };

  const filteredAppointments = getFilteredAppointments();

  const exportCSV = () => {
    const headers = ['Patient', 'Phone', 'Email', 'Clinic', 'Dentist', 'Treatment', 'Date', 'Time', 'Status', 'Source', 'Created', 'Manage Link'];
    const rows = filteredAppointments.map(a => [
      a.patient_name,
      a.patient_phone,
      a.patient_email || '',
      a.clinic?.name || '',
      a.dentist?.name || '',
      a.treatment?.name || '',
      a.preferred_date || '',
      a.preferred_time || '',
      a.status,
      a.source,
      a.created_at,
      a.manage_token ? `${window.location.origin}/appointment/${a.manage_token}` : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Booking Command Center</h1>
          <p className="text-muted-foreground mt-1">Manage, track, and optimize all appointments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick View Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All', icon: Calendar, count: appointments?.length || 0 },
          { key: 'today', label: 'Today', icon: CalendarCheck, count: appointments?.filter(a => a.preferred_date === new Date().toISOString().split('T')[0]).length || 0 },
          { key: 'upcoming', label: 'Upcoming', icon: ArrowUpRight, count: appointments?.filter(a => a.preferred_date && a.preferred_date >= new Date().toISOString().split('T')[0] && a.status !== 'cancelled' && a.status !== 'completed').length || 0 },
          { key: 'urgent', label: 'Needs Action', icon: Zap, count: statusCounts.pending + statusCounts.no_show },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeView === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView(tab.key as any)}
            className={activeView === tab.key ? '' : 'border-2'}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
            <Badge variant="secondary" className="ml-2 text-xs">{tab.count}</Badge>
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Pending', count: statusCounts.pending, icon: Clock, color: 'purple' },
          { label: 'Confirmed', count: statusCounts.confirmed, icon: CheckCircle, color: 'primary' },
          { label: 'Completed', count: statusCounts.completed, icon: CheckCircle, color: 'teal' },
          { label: 'Cancelled', count: statusCounts.cancelled, icon: XCircle, color: 'coral' },
          { label: 'No Show', count: statusCounts.no_show, icon: AlertTriangle, color: 'gold' },
        ].map((stat) => (
          <Card 
            key={stat.label} 
            className={`border-2 border-${stat.color}/20 bg-${stat.color}/5 cursor-pointer hover:border-${stat.color}/40 transition-all`}
            onClick={() => setFilters({ ...filters, status: stat.label.toLowerCase().replace(' ', '_') })}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl bg-${stat.color}/10 border border-${stat.color}/20 flex items-center justify-center`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.count}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dentist Booking Counts */}
      {dentistCounts && dentistCounts.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              Bookings by Dentist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {dentistCounts.slice(0, 10).map((d) => (
                <div 
                  key={d.id} 
                  className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-2 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => setFilters({ ...filters, dentistId: d.id })}
                >
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{d.name}</span>
                  <Badge variant="secondary">{d.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Clinic</label>
                <Select value={filters.clinicId} onValueChange={(v) => setFilters({ ...filters, clinicId: v === 'all' ? '' : v })}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="All Clinics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clinics</SelectItem>
                    {clinics?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Dentist</label>
                <Select value={filters.dentistId} onValueChange={(v) => setFilters({ ...filters, dentistId: v === 'all' ? '' : v })}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="All Dentists" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dentists</SelectItem>
                    {dentists?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Treatment</label>
                <Select value={filters.treatmentId} onValueChange={(v) => setFilters({ ...filters, treatmentId: v === 'all' ? '' : v })}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="All Treatments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Treatments</SelectItem>
                    {treatments?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Source</label>
                <Select value={filters.source} onValueChange={(v) => setFilters({ ...filters, source: v === 'all' ? '' : v })}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date From</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="border-2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date To</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="border-2"
                />
              </div>
              <div className="col-span-2 flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({
                    status: '', search: '', clinicId: '', dentistId: '', treatmentId: '', dateFrom: '', dateTo: '', source: ''
                  })}
                >
                  Clear All Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Status */}
      <Card className="border border-border">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name, phone, clinic, or dentist..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 border-2"
              />
            </div>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? '' : v })}>
              <SelectTrigger className="w-48 border-2">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card className="border border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Patient</TableHead>
                <TableHead>Clinic / Dentist</TableHead>
                <TableHead>Treatment</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((apt) => (
                <TableRow key={apt.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{apt.patient_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {apt.patient_phone}
                          {apt.patient_email && (
                            <>
                              <Mail className="h-3 w-3 ml-2" />
                              <span className="truncate max-w-[120px]">{apt.patient_email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {apt.clinic?.name && (
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <button 
                            onClick={() => apt.clinic?.slug && openClinicBookingPage(apt.clinic.slug)}
                            className="font-medium hover:text-primary hover:underline cursor-pointer transition-colors"
                          >
                            {apt.clinic.name}
                          </button>
                        </div>
                      )}
                      {apt.dentist?.name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <UserCheck className="h-3 w-3" />
                          {apt.dentist.name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {apt.treatment?.name ? (
                      <div className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3 text-primary" />
                        <span className="text-sm">{apt.treatment.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Consultation</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{apt.preferred_date ? format(new Date(apt.preferred_date), 'MMM d, yyyy') : '-'}</p>
                          {getDateBadge(apt.preferred_date)}
                        </div>
                        {apt.preferred_time && (
                          <p className="text-xs text-muted-foreground">{apt.preferred_time}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(apt.status || 'pending')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Quick Status Dropdown */}
                      <Select 
                        value={apt.status || 'pending'} 
                        onValueChange={(v) => handleStatusChange(apt.id, v, true)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no_show">No Show</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Copy Manage Link */}
                      {apt.manage_token && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyManageLink(apt.manage_token!)}
                          title="Copy patient manage link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Open Manage Link */}
                      {apt.manage_token && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openManageLink(apt.manage_token!)}
                          title="Open patient self-service page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Send Notification */}
                      {apt.patient_email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => sendNotification.mutate({ appointmentId: apt.id, type: apt.status || 'pending' })}
                          title="Send email notification"
                          disabled={sendNotification.isPending}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}

                      {/* View Details */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedAppointment(apt)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Appointment Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Patient</p>
                                <p className="font-medium">{apt.patient_name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="font-medium">{apt.patient_phone}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="font-medium">{apt.patient_email || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Status</p>
                                {getStatusBadge(apt.status || 'pending')}
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Date</p>
                                <p className="font-medium">{apt.preferred_date || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Time</p>
                                <p className="font-medium">{apt.preferred_time || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Clinic</p>
                                <p className="font-medium">{apt.clinic?.name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Treatment</p>
                                <p className="font-medium">{apt.treatment?.name || 'Consultation'}</p>
                              </div>
                            </div>
                            {apt.notes && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                                <p className="text-sm bg-muted p-3 rounded-lg">{apt.notes}</p>
                              </div>
                            )}
                            {apt.manage_token && (
                              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                <p className="text-xs font-medium text-primary mb-2">Patient Self-Service Link</p>
                                <div className="flex gap-2">
                                  <Input 
                                    value={`${window.location.origin}/appointment/${apt.manage_token}`}
                                    readOnly
                                    className="text-xs"
                                  />
                                  <Button size="sm" variant="outline" onClick={() => copyManageLink(apt.manage_token!)}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" onClick={() => openManageLink(apt.manage_token!)}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">
                                  Share this link with the patient to let them reschedule or cancel
                                </p>
                              </div>
                            )}
                            
                            {/* Quick Actions */}
                            <div className="flex gap-2 pt-2 border-t">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => sendNotification.mutate({ appointmentId: apt.id, type: apt.status || 'pending' })}
                                disabled={!apt.patient_email || sendNotification.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Resend Email
                              </Button>
                              {apt.clinic?.slug && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => openClinicBookingPage(apt.clinic!.slug!)}
                                >
                                  <Building2 className="h-4 w-4 mr-2" />
                                  View Clinic
                                </Button>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAppointments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No appointments found</p>
                    <p className="text-sm">Try adjusting your filters or search query</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
