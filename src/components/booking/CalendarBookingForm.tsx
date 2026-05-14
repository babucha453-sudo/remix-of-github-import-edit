import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCaptcha } from "@/hooks/useCaptcha";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, isSameDay, startOfDay, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getTimeSlotsForDate,
  getClosedDays,
  type ClinicHours,
} from "@/lib/bookingUtils";
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
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Navigation,
  Heart,
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
    .min(1, "Email is required"),
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

interface CalendarBookingFormProps {
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



export function CalendarBookingForm({
  profileId,
  profileName,
  profileType,
  clinicId,
  clinicLatitude,
  clinicLongitude,
  clinicAddress,
  onSuccess,
  onClose,
}: CalendarBookingFormProps) {
  const { toast } = useToast();
  const { executeCaptcha, isLoading: captchaLoading } = useCaptcha();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

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

  const closedDays = useMemo(() => {
    return getClosedDays(clinicHours);
  }, [clinicHours]);

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getTimeSlotsForDate(selectedDate, clinicHours);
  }, [selectedDate, clinicHours]);

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
      fieldsToValidate = ["treatment_id"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["preferred_date", "preferred_time"];
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
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      const captchaToken = await executeCaptcha();
      if (!captchaToken) {
        toast({
          title: "Verification Failed",
          description: "Please complete the CAPTCHA verification and try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const targetClinicId = profileType === "clinic" ? profileId : clinicId || null;
      
      // Check if this is a returning patient by phone or email
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

      console.log('Submitting appointment:', appointmentData, 'Returning patient:', isReturningPatient);

      const { data: insertedAppointment, error } = await supabase
        .from("appointments")
        .insert(appointmentData)
        .select('id')
        .single();

      if (error) {
        console.error('Appointment insert error:', error);
        throw error;
      }

      setAppointmentId(insertedAppointment?.id || null);

      // Send confirmation email (fire-and-forget)
      if (insertedAppointment?.id && data.patient_email) {
        supabase.functions.invoke('send-booking-email', {
          body: {
            appointmentId: insertedAppointment.id,
            type: 'new_booking',
            newStatus: 'pending'
          }
        }).catch(emailError => {
          console.error('Failed to send booking email:', emailError);
        });
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

  const progress = (currentStep / 3) * 100;

  if (isSuccess) {
    const directionsUrl = getDirectionsUrl();

    return (
      <div className="relative">
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-8 text-center rounded-t-3xl">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Booking Sent!</h3>
          <p className="text-white/80 text-sm">Your request has been submitted successfully</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-slate-600 mb-4">
              <span className="font-semibold text-emerald-600">{profileName}</span> will contact you shortly to confirm your appointment.
            </p>
          </div>

          {/* What's Next Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <h4 className="font-bold text-slate-800 mb-3">📋 What happens next?</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">1.</span>
                The clinic will review your booking request
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">2.</span>
                You'll receive a confirmation email with appointment details
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">3.</span>
                Use the email link to reschedule or cancel anytime
              </li>
            </ul>
          </div>

          {directionsUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Clinic Location</p>
                  <p className="text-sm text-slate-500">Ready for your visit</p>
                </div>
              </div>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 text-white rounded-xl py-3 font-bold transition-all hover:bg-emerald-700"
              >
                <Navigation className="h-4 w-4" />
                Get Directions
              </a>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={onClose}>
              Close
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <Heart className="h-3 w-3 inline mr-1 text-destructive" />
            Thank you for choosing AppointPanda
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 via-emerald-25 to-transparent p-6 pb-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">Book Appointment</h2>
          <p className="text-sm text-slate-500">{profileName}</p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            {["Service", "Date & Time", "Your Details"].map((step, index) => (
              <div
                key={step}
                className={cn(
                  "flex items-center gap-2",
                  currentStep >= index + 1 ? "text-emerald-600" : "text-slate-400"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                    currentStep > index + 1
                      ? "bg-emerald-600 text-white"
                      : currentStep === index + 1
                      ? "bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500"
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  {currentStep > index + 1 ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <span className="hidden sm:block font-medium">{step}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1.5 rounded-full" />
        </div>
      </div>

      {/* Form Content */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 pt-2 space-y-6 max-h-[50vh] overflow-y-auto">
          {/* Step 1: Service Selection */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">What service do you need?</h3>
                <p className="text-sm text-slate-500">Select the treatment you're interested in</p>
              </div>

              <FormField
                control={form.control}
                name="treatment_id"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-2xl h-14 border-2 border-slate-200 focus:border-emerald-500 transition-all">
                          <SelectValue placeholder="Choose a service..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-64 rounded-2xl">
                        <SelectItem value="not_sure" className="rounded-xl py-3">
                          <span className="font-bold text-emerald-600">Not sure / Need consultation</span>
                        </SelectItem>
                        {treatments?.map((treatment) => (
                          <SelectItem key={treatment.id} value={treatment.id} className="rounded-xl py-3">
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
                    <FormLabel className="text-sm font-medium">Additional notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your dental concern or any specific requests..."
                        className="rounded-2xl resize-none border-2 border-slate-200 focus:border-emerald-500 transition-all"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 2: Date & Time with Calendar */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold text-foreground">When would you like to visit?</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedDate ? "Now select your preferred time" : "Select your preferred date"}
                </p>
              </div>

              {/* Calendar - compact for mobile */}
              <FormField
                control={form.control}
                name="preferred_date"
                render={() => (
                  <FormItem>
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        disabled={(date) => date < addDays(new Date(), 1) || closedDays.includes(getDay(date))}
                        className="rounded-2xl border border-border p-2 sm:p-3 pointer-events-auto w-full max-w-[320px]"
                      />
                    </div>
                    {selectedDate && (
                      <p className="text-center text-sm text-emerald-600 font-medium mt-2">
                        Selected: {format(selectedDate, "EEEE, MMMM d, yyyy")}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time Slots Grid - Only shown after date is selected */}
              {selectedDate && (
                <FormField
                  control={form.control}
                  name="preferred_time"
                  render={({ field }) => (
                    <FormItem className="animate-fade-in-up">
                      <FormLabel className="text-sm font-medium text-center block">Available Times</FormLabel>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => field.onChange(slot.value)}
                            className={cn(
                              "py-2.5 px-2 rounded-xl text-xs sm:text-sm font-medium transition-all border",
                              field.value === slot.value
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50"
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
              )}

              {!selectedDate && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Please select a date to view available time slots
                </p>
              )}
            </div>
          )}

          {/* Step 3: Personal Details */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-foreground">Your Contact Details</h3>
                <p className="text-sm text-muted-foreground">How can the clinic reach you?</p>
              </div>

              <FormField
                control={form.control}
                name="patient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your full name"
                        className="rounded-2xl h-14 border-2 border-slate-200 focus:border-emerald-500 transition-all"
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
                    <FormLabel className="text-sm font-medium">Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        className="rounded-2xl h-14 border-2 border-slate-200 focus:border-emerald-500 transition-all"
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
                     <FormLabel className="text-sm font-medium">
                       Email <span className="text-destructive">*</span>
                     </FormLabel>
                     <FormControl>
                       <Input
                         type="email"
                         placeholder="your@email.com (required)"
                         className="rounded-2xl h-14 border-2 border-slate-200 focus:border-emerald-500 transition-all"
                         {...field}
                       />
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4 border-t border-border">
            {currentStep > 1 && (
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            {currentStep < 3 ? (
              <Button type="button" className="flex-1 rounded-xl h-12 font-bold" onClick={nextStep}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1 rounded-xl h-12 font-bold" disabled={isSubmitting || captchaLoading}>
                {isSubmitting || captchaLoading ? "Verifying..." : "Confirm Booking"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
