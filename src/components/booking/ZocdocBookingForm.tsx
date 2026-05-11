import { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, isSameDay, startOfDay, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  formatTimeRange,
  generateTimeSlots,
  defaultTimeSlots,
  getTimeSlotsForDate,
  getClosedDays,
  type ClinicHours,
} from "@/lib/bookingUtils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Navigation,
  Heart,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
};

const bookingSchema = z.object({
  patient_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100)
    .transform(sanitizeText),
  patient_phone: z
    .string()
    .min(9, "Please enter a valid phone number")
    .max(20)
    .regex(/^[\d\s\+\-\(\)]+$/, "Please enter a valid phone number"),
  patient_email: z
    .string()
    .email("Please enter a valid email")
    .optional()
    .or(z.literal("")),
  treatment_id: z.string().min(1, "Please select a service"),
  preferred_date: z.string().min(1, "Please select a date"),
  preferred_time: z.string().min(1, "Please select a time"),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val ? sanitizeText(val) : val)),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface ZocdocBookingFormProps {
  profileId: string;
  profileName: string;
  profileType: "dentist" | "clinic";
  clinicId?: string;
  clinicLatitude?: number;
  clinicLongitude?: number;
  clinicAddress?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}



export function ZocdocBookingForm({
  profileId,
  profileName,
  profileType,
  clinicId,
  clinicLatitude,
  clinicLongitude,
  clinicAddress,
  onSuccess,
  onClose,
}: ZocdocBookingFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const timeSlotsRef = useRef<HTMLDivElement>(null);

  const { data: treatments } = useQuery({
    queryKey: ["booking-treatments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  const targetClinicIdForHours = profileType === "clinic" ? profileId : clinicId;

  const { data: clinicHours } = useQuery({
    queryKey: ["clinic-hours", targetClinicIdForHours],
    queryFn: async () => {
      if (!targetClinicIdForHours) return [];
      const { data } = await supabase
        .from("clinic_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("clinic_id", targetClinicIdForHours);
      return (data || []) as ClinicHours[];
    },
    enabled: !!targetClinicIdForHours,
  });

  const timeSlots = useMemo(() => {
    return getTimeSlotsForDate(selectedDate, clinicHours);
  }, [selectedDate, clinicHours]);

  const closedDays = useMemo(() => {
    return getClosedDays(clinicHours);
  }, [clinicHours]);

  const dateOptions = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(new Date(), i);
      if (!closedDays.includes(getDay(date))) {
        dates.push(date);
      }
    }
    return dates;
  }, [closedDays]);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      patient_name: "",
      patient_phone: "",
      patient_email: "",
      treatment_id: "",
      preferred_date: format(new Date(), "yyyy-MM-dd"),
      preferred_time: "",
      notes: "",
    },
  });

  // Auto-scroll to time slots when date changes
  useEffect(() => {
    if (selectedDate && timeSlotsRef.current) {
      timeSlotsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedDate]);

  const nextStep = async () => {
    let fieldsToValidate: (keyof BookingFormData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ["preferred_date", "preferred_time"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["treatment_id"];
    }

    const result = await form.trigger(fieldsToValidate);
    if (result) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    form.setValue("preferred_date", format(date, "yyyy-MM-dd"));
    setShowCalendar(false);
  };

  const navigateDate = (direction: "prev" | "next") => {
    const currentIndex = dateOptions.findIndex(d => isSameDay(d, selectedDate));
    if (direction === "prev" && currentIndex > 0) {
      handleDateSelect(dateOptions[currentIndex - 1]);
    } else if (direction === "next" && currentIndex < dateOptions.length - 1) {
      handleDateSelect(dateOptions[currentIndex + 1]);
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      const targetClinicId = profileType === "clinic" ? profileId : clinicId || null;
      
      // Check if this is a returning patient
      let isReturningPatient = false;
      let isPaidClinic = false;
      
      if (targetClinicId) {
        // Check returning patient
        const { data: existingAppointments } = await supabase
          .from("appointments")
          .select("id")
          .eq("clinic_id", targetClinicId)
          .or(`patient_phone.eq.${data.patient_phone}${data.patient_email ? `,patient_email.eq.${data.patient_email}` : ""}`)
          .limit(1);
        
        isReturningPatient = (existingAppointments?.length || 0) > 0;

        // Check if clinic has active subscription (paid tier)
        const { data: subscription } = await supabase
          .from("clinic_subscriptions")
          .select("id")
          .eq("clinic_id", targetClinicId)
          .eq("status", "active")
          .maybeSingle();
        
        isPaidClinic = !!subscription;
      }

      const appointmentData = {
        patient_name: data.patient_name,
        patient_phone: data.patient_phone,
        patient_email: data.patient_email || null,
        treatment_id: data.treatment_id && data.treatment_id !== "not_sure" ? data.treatment_id : null,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
        notes: data.notes || null,
        clinic_id: targetClinicId,
        dentist_id: profileType === "dentist" ? profileId : null,
        status: "pending" as const,
        source: "website" as const,
        is_returning_patient: isReturningPatient,
        // Free tier clinics: booking stored but marked as unassigned for admin routing
        is_assigned: isPaidClinic,
      };

      const { data: insertedAppointment, error } = await supabase
        .from("appointments")
        .insert(appointmentData)
        .select('id')
        .single();

      if (error) throw error;

      setAppointmentId(insertedAppointment?.id || null);

      // Send confirmation email (edge function handles paid/free logic internally)
      if (insertedAppointment?.id && data.patient_email) {
        supabase.functions.invoke('send-booking-email', {
          body: {
            appointmentId: insertedAppointment.id,
            type: 'new_booking',
            newStatus: 'pending'
          }
        }).catch(console.error);
      }

      setIsSuccess(true);
      toast({
        title: "Booking Request Sent!",
        description: isPaidClinic 
          ? "The clinic will contact you to confirm." 
          : "Your request has been received and will be processed shortly.",
      });
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDirectionsUrl = () => {
    if (clinicLatitude && clinicLongitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${clinicLatitude},${clinicLongitude}`;
    }
    if (clinicAddress) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clinicAddress)}`;
    }
    return null;
  };

  // Success Screen
  if (isSuccess) {
    const directionsUrl = getDirectionsUrl();
    return (
      <div className="relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/20 transition-colors text-white z-10">
          <X className="h-5 w-5" />
        </button>
        <div className="bg-gradient-to-br from-primary via-primary to-emerald-600 p-6 text-center rounded-t-3xl">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Booking Sent!</h3>
          <p className="text-white/80 text-sm">{profileName}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <h4 className="font-bold text-sm text-foreground mb-2">What happens next?</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• Clinic reviews your request</li>
              <li>• Confirmation email sent to you</li>
              <li>• Use email link to reschedule/cancel</li>
            </ul>
          </div>

          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold transition-all hover:bg-primary/90"
            >
              <Navigation className="h-4 w-4" />
              Get Directions
            </a>
          )}

          <Button variant="outline" className="w-full rounded-xl h-11 font-bold" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[85vh] flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between p-4 pb-2 border-b border-border flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-foreground truncate">Book Appointment</h2>
          <p className="text-xs text-muted-foreground truncate">{profileName}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0 ml-2">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Step Indicator - Compact */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border flex-shrink-0 overflow-x-auto scrollbar-hide">
        {["Time", "Service", "Details"].map((step, index) => (
          <div key={step} className="flex items-center gap-1 flex-shrink-0">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all flex-shrink-0",
                currentStep > index + 1
                  ? "bg-primary text-primary-foreground"
                  : currentStep === index + 1
                  ? "bg-primary/20 text-primary ring-1 ring-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {currentStep > index + 1 ? "✓" : index + 1}
            </div>
            <span className={cn(
              "text-xs font-medium whitespace-nowrap",
              currentStep === index + 1 ? "text-foreground" : "text-muted-foreground"
            )}>{step}</span>
            {index < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Step 1: Zocdoc-style Date & Time Selection */}
          {currentStep === 1 && (
            <div className="p-4 space-y-4 animate-fade-in-up overflow-hidden">
              {/* Date Navigation - Zocdoc style */}
              <div className="flex items-center justify-between gap-2 max-w-full">
                <button
                  type="button"
                  onClick={() => navigateDate("prev")}
                  disabled={isSameDay(selectedDate, new Date())}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide py-1 min-w-0">
                  {dateOptions.slice(0, 7).map((date, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleDateSelect(date)}
                      className={cn(
                        "flex flex-col items-center min-w-[44px] px-1.5 py-2 rounded-xl transition-all border flex-shrink-0",
                        isSameDay(date, selectedDate)
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-muted/50 text-foreground border-border hover:border-primary/50"
                      )}
                    >
                      <span className="text-[9px] font-medium uppercase">
                        {format(date, "EEE")}
                      </span>
                      <span className="text-sm font-bold">{format(date, "d")}</span>
                      <span className="text-[9px] opacity-80">{format(date, "MMM")}</span>
                    </button>
                  ))}
                </div>
                
                <button
                  type="button"
                  onClick={() => navigateDate("next")}
                  className="p-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Calendar Toggle */}
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center justify-center gap-2 w-full text-sm text-primary font-medium py-2"
              >
                <CalendarDays className="h-4 w-4" />
                {showCalendar ? "Hide Calendar" : "View Full Calendar"}
              </button>

              {/* Expanded Calendar */}
              {showCalendar && (
                <div className="border border-border rounded-xl p-3 bg-muted/30">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                      <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {dateOptions.map((date, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleDateSelect(date)}
                        className={cn(
                          "p-2 text-sm rounded-lg transition-all",
                          isSameDay(date, selectedDate)
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        {format(date, "d")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Slots */}
              <div ref={timeSlotsRef}>
                <FormField
                  control={form.control}
                  name="preferred_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-bold">
                        Available Times for {format(selectedDate, "MMM d")}
                      </FormLabel>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2 max-w-full">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => field.onChange(slot.value)}
                            className={cn(
                              "py-2 px-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all border truncate",
                              field.value === slot.value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/30 text-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* Step 2: Service Selection (Compact) */}
          {currentStep === 2 && (
            <div className="p-4 space-y-4 animate-fade-in-up">
              <FormField
                control={form.control}
                name="treatment_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold">What do you need?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-12 border-border">
                          <SelectValue placeholder="Select a service..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-64 rounded-xl">
                        <SelectItem value="not_sure" className="rounded-lg py-2.5">
                          <span className="font-bold text-primary">Not sure / Consultation</span>
                        </SelectItem>
                        {treatments?.map((treatment) => (
                          <SelectItem key={treatment.id} value={treatment.id} className="rounded-lg py-2.5">
                            {treatment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 3: Contact Details + Notes */}
          {currentStep === 3 && (
            <div className="p-4 space-y-3 animate-fade-in-up">
              <FormField
                control={form.control}
                name="patient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your full name"
                        className="rounded-xl h-11 border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="patient_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        className="rounded-xl h-11 border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="patient_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Email (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        className="rounded-xl h-11 border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any specific concerns..."
                        className="rounded-xl resize-none border-border"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Navigation - Sticky at bottom */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4 flex gap-3">
            {currentStep > 1 && (
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11 font-bold" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {currentStep < 3 ? (
              <Button type="button" className="flex-1 rounded-xl h-11 font-bold" onClick={nextStep}>
                Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1 rounded-xl h-11 font-bold" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Confirm Booking"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
