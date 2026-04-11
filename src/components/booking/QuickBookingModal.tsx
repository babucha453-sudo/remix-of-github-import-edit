import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface QuickBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
  clinicName: string;
  dentistName?: string;
  dentistId?: string;
}

type BookingStep = "service" | "datetime" | "details" | "confirm" | "success";

interface BookingData {
  serviceId?: string;
  serviceName?: string;
  date?: Date;
  timeSlot?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  notes?: string;
}

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM"
];

const QUICK_SERVICES = [
  { id: "checkup", name: "Dental Checkup", duration: "30 min" },
  { id: "cleaning", name: "Teeth Cleaning", duration: "45 min" },
  { id: "whitening", name: "Teeth Whitening", duration: "60 min" },
  { id: "filling", name: "Tooth Filling", duration: "45 min" },
  { id: "crown", name: "Crown Treatment", duration: "60 min" },
  { id: "implant", name: "Dental Implant", duration: "90 min" },
  { id: "root-canal", name: "Root Canal", duration: "60 min" },
  { id: "emergency", name: "Emergency Visit", duration: "30 min" },
];

export function QuickBookingModal({
  open,
  onOpenChange,
  clinicId,
  clinicName,
  dentistName,
  dentistId,
}: QuickBookingModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<BookingStep>("service");
  const [data, setData] = useState<BookingData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  
  const handleServiceSelect = (service: typeof QUICK_SERVICES[0]) => {
    setData(prev => ({ ...prev, serviceId: service.id, serviceName: service.name }));
    setStep("datetime");
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setData(prev => ({ ...prev, date: selectedDate }));
  };

  const handleTimeSelect = (time: string) => {
    setData(prev => ({ ...prev, timeSlot: time }));
    setStep("details");
  };

  const handleDetailsSubmit = async () => {
    if (!data.patientName || !data.patientPhone) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!clinicId) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        clinic_id: clinicId,
        dentist_id: dentistId,
        patient_name: data.patientName,
        patient_phone: data.patientPhone,
        patient_email: data.patientEmail,
        appointment_date: data.date?.toISOString().split('T')[0],
        appointment_time: data.timeSlot,
        service_type: data.serviceName,
        notes: data.notes,
        status: "pending",
        source: "online_booking",
      });

      if (error) throw error;
      setStep("success");
    } catch (err: any) {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("service");
    setData({});
    setDate(undefined);
    onOpenChange(false);
  };

  const goBack = () => {
    if (step === "datetime") setStep("service");
    else if (step === "details") setStep("datetime");
    else if (step === "confirm") setStep("details");
  };

  // Render step indicators
  const steps = [
    { key: "service", label: "Service" },
    { key: "datetime", label: "Date & Time" },
    { key: "details", label: "Your Info" },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-1rem)] rounded-2xl border-0 bg-background p-0 overflow-hidden max-h-[90vh]">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b flex items-center justify-between">
          {step !== "service" && step !== "success" ? (
            <button onClick={goBack} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div />
          )}
          
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  "w-2 h-2 rounded-full",
                  i <= currentStepIndex ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          
          <button onClick={handleClose} className="p-2 -mr-2 hover:bg-muted rounded-full text-muted-foreground">
            ×
          </button>
        </div>

        {/* Step Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Step 1: Select Service */}
          {step === "service" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display text-xl font-bold">What do you need?</h2>
                <p className="text-sm text-muted-foreground">Select a service to book</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {QUICK_SERVICES.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      data.serviceId === service.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium text-sm">{service.name}</div>
                    <div className="text-xs text-muted-foreground">{service.duration}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {step === "datetime" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display text-xl font-bold">Pick a date & time</h2>
                <p className="text-sm text-muted-foreground">{data.serviceName}</p>
              </div>
              
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                disabled={(d) => isBefore(d, startOfDay(new Date()))}
                className="rounded-xl border"
              />
              
              {date && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Available times for {format(date, "MMM d")}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((time) => (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time)}
                        className={cn(
                          "py-2 px-1 text-sm rounded-lg border transition-all",
                          data.timeSlot === time
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary"
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Your Details */}
          {step === "details" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display text-xl font-bold">Your information</h2>
                <p className="text-sm text-muted-foreground">
                  {data.serviceName} • {data.date && format(data.date, "MMM d")} at {data.timeSlot}
                </p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Your Name *</Label>
                  <Input
                    placeholder="John Smith"
                    value={data.patientName || ""}
                    onChange={(e) => setData(prev => ({ ...prev, patientName: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Phone Number *</Label>
                  <Input
                    placeholder="(555) 123-4567"
                    value={data.patientPhone || ""}
                    onChange={(e) => setData(prev => ({ ...prev, patientPhone: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="john@email.com"
                    value={data.patientEmail || ""}
                    onChange={(e) => setData(prev => ({ ...prev, patientEmail: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Notes (optional)</Label>
                  <Textarea
                    placeholder="Any concerns or special requests..."
                    value={data.notes || ""}
                    onChange={(e) => setData(prev => ({ ...prev, notes: e.target.value }))}
                    className="rounded-xl min-h-[80px]"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleDetailsSubmit}
                className="w-full rounded-xl h-12 font-bold"
                disabled={!data.patientName || !data.patientPhone}
              >
                Review Booking
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-display text-xl font-bold">Review your booking</h2>
              </div>
              
              <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{data.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {data.date && format(data.date, "EEEE, MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{data.timeSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clinic</span>
                  <span className="font-medium">{clinicName}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{data.patientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{data.patientPhone}</span>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="w-full rounded-xl h-12 font-bold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Booking
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 5: Success */}
          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold mb-2">Booking Confirmed!</h2>
              <p className="text-muted-foreground mb-4">
                You'll receive a confirmation at {data.patientPhone}
              </p>
              <div className="p-4 rounded-xl bg-muted/50 text-left text-sm space-y-2 mb-4">
                <p><strong>{data.serviceName}</strong></p>
                <p>{data.date && format(data.date, "EEEE, MMM d, yyyy")} at {data.timeSlot}</p>
                <p>{clinicName}</p>
              </div>
              <Button onClick={handleClose} className="w-full rounded-xl h-12 font-bold">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}