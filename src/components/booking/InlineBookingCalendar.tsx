import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
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
  Clock,
  CalendarDays,
  User,
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

interface InlineBookingCalendarProps {
  profileId: string;
  profileName: string;
  profileType: "dentist" | "clinic";
  clinicId?: string;
  clinicLatitude?: number;
  clinicLongitude?: number;
  clinicAddress?: string;
  onSuccess?: () => void;
  className?: string;
}

// Helper to format time display (1-hour intervals)
const formatTimeRange = (hour: number): string => {
  const startHour = hour;
  const endHour = hour + 1;
  
  const formatHour = (h: number) => {
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return `12:00 PM`;
    return `${h - 12}:00 PM`;
  };
  
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
};

// Helper to generate time slots from clinic hours (1-hour intervals)
const generateTimeSlots = (openTime: string | null, closeTime: string | null) => {
  if (!openTime || !closeTime) {
    // Default slots: 9 AM to 6 PM (1-hour intervals)
    return Array.from({ length: 9 }, (_, i) => {
      const hour = i + 9;
      const time = `${hour.toString().padStart(2, "0")}:00`;
      return { value: time, label: formatTimeRange(hour) };
    });
  }

  const slots: { value: string; label: string }[] = [];
  const [openHour] = openTime.split(":").map(Number);
  const [closeHour] = closeTime.split(":").map(Number);
  
  // Generate 1-hour slots
  for (let hour = openHour; hour < closeHour; hour++) {
    const time = `${hour.toString().padStart(2, "0")}:00`;
    slots.push({ value: time, label: formatTimeRange(hour) });
  }
  
  return slots;
};

// Default time slots as fallback (1-hour intervals, 9 AM to 6 PM)
const defaultTimeSlots = Array.from({ length: 9 }, (_, i) => {
  const hour = i + 9;
  const time = `${hour.toString().padStart(2, "0")}:00`;
  return { value: time, label: formatTimeRange(hour) };
});

export function InlineBookingCalendar({
  profileId,
  profileName,
  profileType,
  clinicId,
  clinicLatitude,
  clinicLongitude,
  clinicAddress,
  onSuccess,
  className,
}: InlineBookingCalendarProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  // Determine clinic ID for fetching hours
  const targetClinicIdForHours = profileType === "clinic" ? profileId : clinicId;

  // Fetch clinic hours
  const { data: clinicHours } = useQuery({
    queryKey: ["clinic-hours", targetClinicIdForHours],
    queryFn: async () => {
      if (!targetClinicIdForHours) return null;
      const { data } = await supabase
        .from("clinic_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("clinic_id", targetClinicIdForHours);
      return data || [];
    },
    enabled: !!targetClinicIdForHours,
  });

  // Get time slots for selected date based on clinic hours
  const timeSlots = useMemo(() => {
    if (!selectedDate) return defaultTimeSlots;
    
    const dayOfWeek = getDay(selectedDate); // 0 = Sunday, 1 = Monday, etc.
    
    if (!clinicHours || clinicHours.length === 0) {
      return defaultTimeSlots;
    }
    
    const dayHours = clinicHours.find(h => h.day_of_week === dayOfWeek);
    
    if (!dayHours || dayHours.is_closed) {
      return []; // Clinic is closed on this day
    }
    
    return generateTimeSlots(dayHours.open_time, dayHours.close_time);
  }, [selectedDate, clinicHours]);

  // Get closed days for calendar
  const closedDays = useMemo(() => {
    if (!clinicHours || clinicHours.length === 0) {
      return [0]; // Default: closed on Sundays
    }
    return clinicHours
      .filter(h => h.is_closed)
      .map(h => h.day_of_week);
  }, [clinicHours]);

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

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      patient_name: "",
      patient_phone: "",
      patient_email: "",
      treatment_id: "",
      preferred_date: "",
      preferred_time: "",
      notes: "",
    },
  });

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

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      form.setValue("preferred_date", format(date, "yyyy-MM-dd"));
      // Clear time when date changes
      form.setValue("preferred_time", "");
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      const targetClinicId = profileType === "clinic" ? profileId : clinicId || null;
      
      // Check if this is a returning patient
      let isReturningPatient = false;
      if (targetClinicId) {
        const { data: existingAppointments } = await supabase
          .from("appointments")
          .select("id")
          .eq("clinic_id", targetClinicId)
          .or(`patient_phone.eq.${data.patient_phone}${data.patient_email ? `,patient_email.eq.${data.patient_email}` : ""}`)
          .limit(1);
        
        isReturningPatient = (existingAppointments?.length || 0) > 0;
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
      };

      const { data: insertedAppointment, error } = await supabase
        .from("appointments")
        .insert(appointmentData)
        .select('id')
        .single();

      if (error) throw error;

      setAppointmentId(insertedAppointment?.id || null);

      // Send confirmation email (fire-and-forget)
      if (insertedAppointment?.id && data.patient_email) {
        supabase.functions.invoke('send-booking-email', {
          body: {
            appointmentId: insertedAppointment.id,
            type: 'new_booking',
            newStatus: 'pending'
          }
        }).catch(() => {});
      }

      setIsSuccess(true);
      toast({
        title: "Booking Request Sent!",
        description: "The clinic will contact you to confirm your appointment.",
      });
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Please try again later.";
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

  const selectedTimeSlot = form.watch("preferred_time");

  if (isSuccess) {
    const directionsUrl = getDirectionsUrl();

    return (
      <div className={cn("card-modern overflow-hidden", className)}>
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Booking Sent!</h3>
          <p className="text-white/80 text-sm">Your request has been submitted</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <h4 className="font-bold text-foreground mb-2 text-sm">📋 What happens next?</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                The clinic reviews your request
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                You'll receive a confirmation email
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                Use the link to reschedule if needed
              </li>
            </ul>
          </div>

          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-primary/10 text-primary rounded-xl py-3 font-bold text-sm transition-all hover:bg-primary/20"
            >
              <Navigation className="h-4 w-4" />
              Get Directions
            </a>
          )}

          <p className="text-xs text-center text-muted-foreground">
            <Heart className="h-3 w-3 inline mr-1 text-destructive" />
            Thank you for choosing AppointPanda
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card-modern overflow-hidden max-w-full", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 md:p-4 border-b border-border">
        <h3 className="font-bold text-foreground flex items-center gap-2 text-sm md:text-base">
          <CalendarDays className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
          Book Appointment
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {currentStep === 1 && "Select your preferred date and time"}
          {currentStep === 2 && "What service do you need?"}
          {currentStep === 3 && "Enter your contact details"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-3 md:p-4 overflow-hidden max-w-full">
          {/* Step 1: Date & Time - Calendar-led design */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in-up overflow-hidden max-w-full">
              {/* Calendar - Compact for inline display */}
              <FormField
                control={form.control}
                name="preferred_date"
                render={() => (
                  <FormItem className="overflow-hidden max-w-full">
                    <div className="flex justify-center overflow-hidden max-w-full">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        disabled={(date) => {
                          // Disable past dates and tomorrow minimum
                          if (date < addDays(new Date(), 1)) return true;
                          // Disable closed days based on clinic hours
                          const dayOfWeek = getDay(date);
                          return closedDays.includes(dayOfWeek);
                        }}
                        className="rounded-xl border border-border p-1.5 md:p-2 pointer-events-auto w-full max-w-[280px] md:max-w-none"
                        classNames={{
                          months: "flex flex-col",
                          month: "space-y-1 md:space-y-2",
                          caption: "flex justify-center pt-1 relative items-center text-xs md:text-sm",
                          caption_label: "text-xs md:text-sm font-medium",
                          nav: "space-x-1 flex items-center",
                          nav_button: "h-6 w-6 md:h-7 md:w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted rounded-lg touch-manipulation",
                          nav_button_previous: "absolute left-1",
                          nav_button_next: "absolute right-1",
                          table: "w-full border-collapse",
                          head_row: "flex justify-around",
                          head_cell: "text-muted-foreground rounded-md w-7 md:w-8 font-normal text-[0.65rem] md:text-[0.7rem]",
                          row: "flex justify-around w-full mt-0.5 md:mt-1",
                          cell: "h-7 w-7 md:h-8 md:w-8 text-center text-xs md:text-sm p-0 relative",
                          day: "h-7 w-7 md:h-8 md:w-8 p-0 font-normal text-xs md:text-sm rounded-lg hover:bg-muted touch-manipulation",
                          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                          day_today: "bg-accent text-accent-foreground",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-50",
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time Slots - Only shown after date selection, in a compact grid */}
              {selectedDate && (
                <FormField
                  control={form.control}
                  name="preferred_time"
                  render={({ field }) => (
                    <FormItem className="animate-fade-in-up overflow-hidden max-w-full">
                      <FormLabel className="text-xs font-medium flex items-center gap-1 mb-2">
                        <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        Available Times for {format(selectedDate, "MMM d")}
                      </FormLabel>
                      {timeSlots.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-xs md:text-sm">
                          No available times for this day. Please select another date.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 max-h-44 md:max-h-48 overflow-y-auto pr-1 pb-1 scrollbar-hide max-w-full">
                          {timeSlots.map((slot) => (
                            <button
                              key={slot.value}
                              type="button"
                              onClick={() => field.onChange(slot.value)}
                              className={cn(
                                "py-2 px-1 rounded-lg text-[10px] md:text-xs font-medium transition-all border touch-manipulation truncate",
                                field.value === slot.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                              )}
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Next Button */}
              <Button
                type="button"
                onClick={nextStep}
                disabled={!selectedDate || !selectedTimeSlot}
                className="w-full rounded-xl h-11 font-bold"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Service Selection */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <FormField
                control={form.control}
                name="treatment_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Select Service</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-12 border-2 border-border/50 focus:border-primary">
                          <SelectValue placeholder="Choose a service..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-48 rounded-xl">
                        <SelectItem value="not_sure" className="rounded-lg py-2">
                          <span className="font-bold text-primary">Not sure / Consultation</span>
                        </SelectItem>
                        {treatments?.map((treatment) => (
                          <SelectItem key={treatment.id} value={treatment.id} className="rounded-lg py-2">
                            {treatment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any specific concerns..."
                        className="rounded-xl resize-none border-2 border-border/50 focus:border-primary text-sm"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={prevStep} className="rounded-xl h-11">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button type="button" onClick={nextStep} className="flex-1 rounded-xl h-11 font-bold">
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Contact Details */}
          {currentStep === 3 && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <User className="h-3.5 w-3.5" />
                Your contact information
              </div>

              <FormField
                control={form.control}
                name="patient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Full Name *"
                        className="rounded-xl h-11 border-2 border-border/50 focus:border-primary"
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
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="Phone +1 (555) 123-4567 *"
                        className="rounded-xl h-11 border-2 border-border/50 focus:border-primary"
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
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Email (optional)"
                        className="rounded-xl h-11 border-2 border-border/50 focus:border-primary"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Summary */}
              <div className="bg-muted/50 rounded-xl p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">Your Appointment</p>
                <p className="text-muted-foreground">
                  {selectedDate && format(selectedDate, "EEEE, MMMM d")} at {selectedTimeSlot && timeSlots.find(s => s.value === selectedTimeSlot)?.label}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" onClick={prevStep} className="rounded-xl h-11">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl h-11 font-bold">
                  {isSubmitting ? "Submitting..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
