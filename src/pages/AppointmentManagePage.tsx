import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
  User,
  Stethoscope,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const timeSlots = Array.from({ length: 20 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minutes = i % 2 === 0 ? "00" : "30";
  const time = `${hour.toString().padStart(2, "0")}:${minutes}`;
  const displayTime =
    hour < 12
      ? `${hour}:${minutes} AM`
      : hour === 12
      ? `12:${minutes} PM`
      : `${hour - 12}:${minutes} PM`;
  return { value: time, label: displayTime };
});

const AppointmentManagePage = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCancelDialog, setShowCancelDialog] = useState(action === "cancel");
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(action === "reschedule");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionCompleted, setActionCompleted] = useState<"cancelled" | "rescheduled" | null>(null);

  // Set noindex for appointment management pages - they should not be indexed
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    
    return () => {
      meta?.setAttribute('content', 'index, follow');
    };
  }, []);

  const { data: appointment, isLoading, error } = useQuery({
    queryKey: ["appointment-manage", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          clinic:clinics!appointments_clinic_id_fkey(id, name, phone, address, slug),
          dentist:dentists(id, name, slug),
          treatment:treatments(id, name)
        `)
        .eq("manage_token", token)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Appointment not found");

      return data;
    },
    enabled: !!token,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("No token");

      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("manage_token", token);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-manage", token] });
      setShowCancelDialog(false);
      setActionCompleted("cancelled");
      toast({
        title: "Appointment Cancelled",
        description: "Your appointment has been successfully cancelled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!token || !selectedDate || !selectedTime) {
        throw new Error("Please select a new date and time");
      }

      const { error } = await supabase
        .from("appointments")
        .update({
          preferred_date: format(selectedDate, "yyyy-MM-dd"),
          preferred_time: selectedTime,
          status: "pending",
          confirmed_date: null,
          confirmed_time: null,
        })
        .eq("manage_token", token);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-manage", token] });
      setShowRescheduleDialog(false);
      setActionCompleted("rescheduled");
      toast({
        title: "Appointment Rescheduled",
        description: "Your appointment has been rescheduled. The clinic will confirm your new time.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancel = async () => {
    setIsProcessing(true);
    await cancelMutation.mutateAsync();
    setIsProcessing(false);
  };

  const handleReschedule = async () => {
    setIsProcessing(true);
    await rescheduleMutation.mutateAsync();
    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CalendarIcon className="h-8 w-8 text-primary" />
            </div>
            <p className="text-muted-foreground">Loading appointment details...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !appointment) {
    return (
      <PageLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Appointment Not Found</h1>
            <p className="text-muted-foreground">
              This link may have expired or the appointment doesn't exist. Please contact the clinic directly if you need assistance.
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const status = appointment.status || "pending";
  const isCancellable = ["pending", "confirmed"].includes(status);
  const isReschedulable = ["pending", "confirmed"].includes(status);
  const appointmentDate = appointment.confirmed_date || appointment.preferred_date;
  const appointmentTime = appointment.confirmed_time || appointment.preferred_time;

  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    pending: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: <Clock className="h-5 w-5" />, label: "Pending Confirmation" },
    confirmed: { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle className="h-5 w-5" />, label: "Confirmed" },
    completed: { color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: <CheckCircle className="h-5 w-5" />, label: "Completed" },
    cancelled: { color: "text-destructive", bg: "bg-destructive/5 border-destructive/20", icon: <XCircle className="h-5 w-5" />, label: "Cancelled" },
    no_show: { color: "text-slate-600", bg: "bg-slate-50 border-slate-200", icon: <AlertTriangle className="h-5 w-5" />, label: "No Show" },
  };

  const currentStatus = statusConfig[status] || statusConfig.pending;

  return (
    <PageLayout>
      <div className="min-h-[70vh] py-12">
        <div className="container max-w-2xl mx-auto px-4">
          {/* Success State After Action */}
          {actionCompleted && (
            <div className="text-center mb-8">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                actionCompleted === "cancelled" ? "bg-destructive/10" : "bg-emerald-100"
              )}>
                {actionCompleted === "cancelled" ? (
                  <XCircle className="h-10 w-10 text-destructive" />
                ) : (
                  <RefreshCw className="h-10 w-10 text-emerald-600" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {actionCompleted === "cancelled" ? "Appointment Cancelled" : "Appointment Rescheduled"}
              </h2>
              <p className="text-muted-foreground">
                {actionCompleted === "cancelled"
                  ? "Your appointment has been successfully cancelled."
                  : "Your new appointment request has been sent. The clinic will confirm your time."}
              </p>
            </div>
          )}

          {/* Main Card */}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-lg">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <CalendarIcon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Your Appointment</h1>
                  <p className="text-muted-foreground">Manage your booking details</p>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full border", currentStatus.bg, currentStatus.color)}>
                {currentStatus.icon}
                <span className="font-bold">{currentStatus.label}</span>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="p-6 space-y-6">
              {/* Date & Time */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Date</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {appointmentDate ? format(parseISO(appointmentDate), "EEEE, MMMM d, yyyy") : "Not set"}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Time</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {appointmentTime || "Not set"}
                  </p>
                </div>
              </div>

              {/* Clinic Info */}
              {appointment.clinic && (
                <div className="bg-muted/50 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Clinic</span>
                  </div>
                  <p className="text-lg font-bold text-foreground mb-2">{appointment.clinic.name}</p>
                  {appointment.clinic.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <span className="text-sm">{appointment.clinic.address}</span>
                    </div>
                  )}
                  {appointment.clinic.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground mt-2">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${appointment.clinic.phone}`} className="text-sm hover:text-primary transition-colors">
                        {appointment.clinic.phone}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Treatment */}
              {appointment.treatment && (
                <div className="bg-muted/50 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Stethoscope className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Service</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{appointment.treatment.name}</p>
                </div>
              )}

              {/* Patient Info */}
              <div className="bg-muted/50 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Patient Details</span>
                </div>
                <p className="font-bold text-foreground mb-2">{appointment.patient_name}</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{appointment.patient_phone}</span>
                  </div>
                  {appointment.patient_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{appointment.patient_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {(isCancellable || isReschedulable) && !actionCompleted && (
                <div className="pt-4 border-t border-border">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {isReschedulable && (
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-1 rounded-2xl font-bold h-14"
                        onClick={() => setShowRescheduleDialog(true)}
                      >
                        <RefreshCw className="h-5 w-5 mr-2" />
                        Reschedule
                      </Button>
                    )}
                    {isCancellable && (
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-1 rounded-2xl font-bold h-14 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setShowCancelDialog(true)}
                      >
                        <XCircle className="h-5 w-5 mr-2" />
                        Cancel Appointment
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-center text-xl">Cancel Appointment?</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowCancelDialog(false)}
              disabled={isProcessing}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={handleCancel}
              disabled={isProcessing}
            >
              {isProcessing ? "Cancelling..." : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">Reschedule Appointment</DialogTitle>
            <DialogDescription className="text-center">
              Choose a new date and time for your appointment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Calendar */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Select New Date</label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < addDays(new Date(), 1)}
                  className="rounded-2xl border border-border pointer-events-auto"
                />
              </div>
            </div>

            {/* Time Slot */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Select New Time</label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Choose a time slot" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowRescheduleDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={handleReschedule}
              disabled={isProcessing || !selectedDate || !selectedTime}
            >
              {isProcessing ? "Rescheduling..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default AppointmentManagePage;
