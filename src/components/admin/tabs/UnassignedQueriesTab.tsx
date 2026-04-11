import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Filter,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  User,
  Users,
  XCircle,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';

interface UnassignedAppointment {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  status: string;
  source: string;
  created_at: string;
  clinic_id: string | null;
  routing_notes: string | null;
  clinic?: { id: string; name: string; city_id: string | null };
  treatment?: { id: string; name: string };
}

export default function UnassignedQueriesTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<UnassignedAppointment | null>(null);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [respondModalOpen, setRespondModalOpen] = useState(false);
  const [selectedClinicForRoute, setSelectedClinicForRoute] = useState<string>('');
  const [routingNotes, setRoutingNotes] = useState('');
  const [responseMessage, setResponseMessage] = useState('');

  // Fetch unassigned appointments (from unpaid clinics or marked as unassigned)
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['unassigned-appointments', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          clinic:clinics!appointments_clinic_id_fkey(id, name, city_id),
          treatment:treatments(id, name)
        `)
        .eq('is_assigned', false)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show');
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return (data || []) as unknown as UnassignedAppointment[];
    },
  });

  // Fetch paid clinics for rerouting (same city)
  const { data: paidClinics } = useQuery({
    queryKey: ['paid-clinics-for-routing', selectedAppointment?.clinic?.city_id],
    queryFn: async () => {
      if (!selectedAppointment?.clinic?.city_id) return [];

      // Get clinics with active subscriptions in the same city
      const { data, error } = await supabase
        .from('clinics')
        .select(`
          id,
          name,
          city_id,
          subscriptions:clinic_subscriptions!inner(status)
        `)
        .eq('city_id', selectedAppointment.clinic.city_id)
        .eq('is_active', true);

      if (error) throw error;
      
      // Filter to only paid clinics (with active subscription)
      return (data || []).filter((c: any) => 
        c.subscriptions?.some((s: any) => s.status === 'active')
      );
    },
    enabled: !!selectedAppointment?.clinic?.city_id && routeModalOpen,
  });

  // Route appointment to another clinic
  const routeAppointment = useMutation({
    mutationFn: async ({ appointmentId, newClinicId, notes }: { appointmentId: string; newClinicId: string; notes: string }) => {
      const { data: oldData } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      const { error } = await supabase
        .from('appointments')
        .update({
          original_clinic_id: oldData?.clinic_id,
          clinic_id: newClinicId,
          is_assigned: true,
          assigned_at: new Date().toISOString(),
          routing_notes: notes,
        })
        .eq('id', appointmentId);

      if (error) throw error;

      await createAuditLog({
        action: 'ROUTE_APPOINTMENT',
        entityType: 'appointment',
        entityId: appointmentId,
        oldValues: { clinic_id: oldData?.clinic_id, is_assigned: false },
        newValues: { clinic_id: newClinicId, is_assigned: true, routing_notes: notes },
      });

      // Send notification to new clinic
      await supabase.functions.invoke('send-booking-email', {
        body: {
          appointmentId,
          type: 'rerouted_booking',
          newStatus: 'pending',
        },
      });
    },
    onSuccess: () => {
      toast.success('Appointment routed successfully');
      queryClient.invalidateQueries({ queryKey: ['unassigned-appointments'] });
      setRouteModalOpen(false);
      setSelectedAppointment(null);
      setSelectedClinicForRoute('');
      setRoutingNotes('');
    },
    onError: (error) => {
      toast.error('Failed to route: ' + error.message);
    },
  });

  // Mark as resolved/closed
  const closeAppointment = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          admin_notes: reason,
          is_assigned: true,
        })
        .eq('id', appointmentId);

      if (error) throw error;

      await createAuditLog({
        action: 'CLOSE_UNASSIGNED_APPOINTMENT',
        entityType: 'appointment',
        entityId: appointmentId,
        newValues: { status: 'cancelled', reason },
      });
    },
    onSuccess: () => {
      toast.success('Appointment closed');
      queryClient.invalidateQueries({ queryKey: ['unassigned-appointments'] });
    },
  });

  // Respond to patient manually
  const respondToPatient = useMutation({
    mutationFn: async ({ appointmentId, message, channel }: { appointmentId: string; message: string; channel: 'email' | 'sms' }) => {
      const appointment = appointments?.find(a => a.id === appointmentId);
      if (!appointment) throw new Error('Appointment not found');

      if (channel === 'email' && appointment.patient_email) {
        // Send via edge function
        await supabase.functions.invoke('send-review-request', {
          body: {
            to: appointment.patient_email,
            type: 'email',
            subject: 'Response to Your Appointment Inquiry',
            html: `<p>Dear ${appointment.patient_name},</p><p>${message}</p><p>Best regards,<br>AppointPanda Team</p>`,
          },
        });
      }

      await createAuditLog({
        action: 'RESPOND_TO_PATIENT',
        entityType: 'appointment',
        entityId: appointmentId,
        newValues: { message, channel },
      });
    },
    onSuccess: () => {
      toast.success('Response sent to patient');
      setRespondModalOpen(false);
      setResponseMessage('');
    },
    onError: (error) => {
      toast.error('Failed to send: ' + error.message);
    },
  });

  const filteredAppointments = appointments?.filter(apt => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      apt.patient_name.toLowerCase().includes(term) ||
      apt.patient_email?.toLowerCase().includes(term) ||
      apt.patient_phone.includes(term) ||
      apt.clinic?.name.toLowerCase().includes(term)
    );
  });

  const stats = {
    total: appointments?.length || 0,
    pending: appointments?.filter(a => a.status === 'pending').length || 0,
    today: appointments?.filter(a => 
      a.created_at && new Date(a.created_at).toDateString() === new Date().toDateString()
    ).length || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            Unassigned Patient Queries
          </h2>
          <p className="text-muted-foreground">
            Appointment requests from unpaid dentists that need manual routing
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Unassigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending Action</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.today}</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or clinic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle>Unassigned Queries ({filteredAppointments?.length || 0})</CardTitle>
          <CardDescription>
            These appointments are from clinics without paid plans and need to be manually routed to paid dentists
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {filteredAppointments?.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-teal mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground">No unassigned queries at the moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments?.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{apt.patient_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {apt.status}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {apt.source}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {apt.patient_phone}
                          </span>
                          {apt.patient_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {apt.patient_email}
                            </span>
                          )}
                          {apt.preferred_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(apt.preferred_date), 'MMM d, yyyy')}
                              {apt.preferred_time && ` at ${apt.preferred_time}`}
                            </span>
                          )}
                        </div>
                        {apt.clinic && (
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-600 font-medium">
                              Original: {apt.clinic.name} (Unpaid)
                            </span>
                          </div>
                        )}
                        {apt.notes && (
                          <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            {apt.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Received: {format(new Date(apt.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setRouteModalOpen(true);
                          }}
                          className="gap-1"
                        >
                          <ArrowRight className="h-3 w-3" />
                          Route
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setRespondModalOpen(true);
                          }}
                          className="gap-1"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Respond
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive gap-1"
                          onClick={() => {
                            if (confirm('Close this query without routing?')) {
                              closeAppointment.mutate({
                                appointmentId: apt.id,
                                reason: 'Closed by admin - no available dentist',
                              });
                            }
                          }}
                        >
                          <XCircle className="h-3 w-3" />
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Route Modal */}
      <Dialog open={routeModalOpen} onOpenChange={setRouteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Route Appointment to Paid Dentist</DialogTitle>
            <DialogDescription>
              Select a paid clinic in the same area to receive this booking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Patient</Label>
              <p className="text-sm font-medium">{selectedAppointment?.patient_name}</p>
              <p className="text-xs text-muted-foreground">{selectedAppointment?.patient_phone}</p>
            </div>
            <div>
              <Label>Select Paid Clinic</Label>
              <Select value={selectedClinicForRoute} onValueChange={setSelectedClinicForRoute}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a clinic..." />
                </SelectTrigger>
                <SelectContent>
                  {paidClinics?.map((clinic: any) => (
                    <SelectItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paidClinics?.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No paid clinics found in this area
                </p>
              )}
            </div>
            <div>
              <Label>Routing Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes about why this was rerouted..."
                value={routingNotes}
                onChange={(e) => setRoutingNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRouteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedAppointment && selectedClinicForRoute) {
                  routeAppointment.mutate({
                    appointmentId: selectedAppointment.id,
                    newClinicId: selectedClinicForRoute,
                    notes: routingNotes,
                  });
                }
              }}
              disabled={!selectedClinicForRoute || routeAppointment.isPending}
            >
              {routeAppointment.isPending ? 'Routing...' : 'Route Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond Modal */}
      <Dialog open={respondModalOpen} onOpenChange={setRespondModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Respond to Patient</DialogTitle>
            <DialogDescription>
              Send a direct response to {selectedAppointment?.patient_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Enter your response to the patient..."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedAppointment && responseMessage) {
                  respondToPatient.mutate({
                    appointmentId: selectedAppointment.id,
                    message: responseMessage,
                    channel: 'email',
                  });
                }
              }}
              disabled={!responseMessage || respondToPatient.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {respondToPatient.isPending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
