import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CheckCircle, User, Calendar, Stethoscope, ChevronRight, ChevronLeft } from "lucide-react";

const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

const bookingSchema = z.object({
  patient_name: z.string().min(2, "Name must be at least 2 characters").max(100)
    .transform(sanitizeText),
  patient_phone: z.string().min(9, "Please enter a valid phone number").max(20)
    .regex(/^[\d\s\+\-\(\)]+$/, "Please enter a valid phone number"),
  patient_email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  treatment_id: z.string().min(1, "Please select a service"),
  preferred_date: z.string().min(1, "Please select a preferred date"),
  preferred_time: z.string().min(1, "Please select a preferred time"),
  notes: z.string().max(500).optional()
    .transform((val) => val ? sanitizeText(val) : val),
});

type BookingFormData = z.infer<typeof bookingSchema>;

const STEPS = [
  { id: 1, title: "Your Info", icon: User },
  { id: 2, title: "Service", icon: Stethoscope },
  { id: 3, title: "Date & Time", icon: Calendar },
];

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
  profileType: 'dentist' | 'clinic';
  clinicId?: string;
}

export function BookingModal({
  open,
  onOpenChange,
  profileId,
  profileName,
  profileType,
  clinicId,
}: BookingModalProps) {
  const { toast } = useToast();
  const { trackAppointmentRequest } = useAnalytics();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const { data: treatments } = useQuery({
    queryKey: ['booking-treatments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order');
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

  const selectedTreatment = form.watch('treatment_id');

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      const appointmentData = {
        patient_name: data.patient_name,
        patient_phone: data.patient_phone,
        patient_email: data.patient_email || null,
        treatment_id: data.treatment_id === 'not_sure' ? null : data.treatment_id,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
        notes: data.notes || null,
        clinic_id: profileType === 'clinic' ? profileId : clinicId || null,
        dentist_id: profileType === 'dentist' ? profileId : null,
        status: 'pending',
        source: 'website',
      };

      const { error } = await supabase
        .from('appointments')
        .insert(appointmentData);

      if (error) throw error;

      trackAppointmentRequest({
        clinic_id: profileType === 'clinic' ? profileId : clinicId || '',
        clinic_name: profileName,
        dentist_id: profileType === 'dentist' ? profileId : undefined,
        treatment_type: data.treatment_id === 'not_sure' ? 'not_sure' : treatments?.find(t => t.id === data.treatment_id)?.name,
      });

      setIsSuccess(true);
      toast({
        title: "Booking Request Sent!",
        description: "The clinic will contact you to confirm your appointment.",
      });

      setTimeout(() => {
        setIsSuccess(false);
        form.reset();
        setCurrentStep(1);
        onOpenChange(false);
      }, 2500);
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "Booking Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: (keyof BookingFormData)[] = [];
    
    if (currentStep === 1) {
      fieldsToValidate = ['patient_name', 'patient_phone'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['treatment_id'];
    } else if (currentStep === 3) {
      fieldsToValidate = ['preferred_date', 'preferred_time'];
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const getTreatmentName = (id: string) => {
    if (id === 'not_sure') return 'Need Consultation';
    return treatments?.find(t => t.id === id)?.name || 'Service';
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-2xl">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5 animate-scale-in">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Booking Submitted!</h3>
            <p className="text-slate-600 max-w-xs">
              Your appointment request with <span className="font-semibold text-emerald-600">{profileName}</span> has been sent. They will contact you shortly.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
        {/* Progress Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5">
          <DialogHeader className="text-white">
            <DialogTitle className="text-xl font-bold">Book Your Appointment</DialogTitle>
            <DialogDescription className="text-emerald-100">
              {profileName}
            </DialogDescription>
          </DialogHeader>
          
          {/* Step Indicators */}
          <div className="flex items-center justify-center mt-5 gap-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div 
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300",
                      isActive ? "bg-white/20 text-white" : 
                      isCompleted ? "bg-emerald-400 text-white" : "bg-white/10 text-emerald-200"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "w-8 h-0.5 mx-1",
                      isCompleted ? "bg-emerald-400" : "bg-white/20"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-slate-800">Tell us about yourself</h3>
                    <p className="text-sm text-slate-500">We need your contact details to confirm the appointment</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="patient_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">Full Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Doe" 
                            className="rounded-xl h-12 border-slate-200 focus:border-emerald-500 focus:ring-emerald-200" 
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="patient_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">Phone Number *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+1 234 567 8900" 
                              className="rounded-xl h-12 border-slate-200 focus:border-emerald-500 focus:ring-emerald-200" 
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
                          <FormLabel className="text-sm font-medium text-slate-700">Email (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="you@email.com" 
                              className="rounded-xl h-12 border-slate-200 focus:border-emerald-500 focus:ring-emerald-200" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Service Selection */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-slate-800">What do you need?</h3>
                    <p className="text-sm text-slate-500">Select the dental service you're looking for</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="treatment_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">Service Required *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl h-12 border-slate-200 focus:border-emerald-500">
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-64">
                            <SelectItem value="not_sure" className="font-semibold text-emerald-600">
                              🤔 Not sure / Need consultation
                            </SelectItem>
                            {treatments?.map((treatment) => (
                              <SelectItem key={treatment.id} value={treatment.id}>
                                {treatment.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedTreatment === 'not_sure' && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <p className="text-sm font-medium text-emerald-800 mb-2">No problem! Common services include:</p>
                      <div className="flex flex-wrap gap-2">
                        {["Checkup & Cleaning", "Teeth Whitening", "Dental Implants", "Invisalign", "Root Canal", "Crowns"].map((service, i) => (
                          <span key={i} className="text-xs bg-white px-3 py-1 rounded-full border border-emerald-200 text-emerald-700">
                            {service}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-emerald-600 mt-2">
                        The clinic will help you determine the best treatment during your visit.
                      </p>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your dental concern..." 
                            className="rounded-xl resize-none border-slate-200 focus:border-emerald-500" 
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

              {/* Step 3: Date & Time */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-slate-800">When would you like to visit?</h3>
                    <p className="text-sm text-slate-500">Choose your preferred date and time</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="preferred_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">Preferred Date *</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              min={minDate}
                              className="rounded-xl h-12 border-slate-200 focus:border-emerald-500" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferred_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">Preferred Time *</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="rounded-xl h-12 border-slate-200 focus:border-emerald-500">
                                  <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].map((time) => (
                                  <SelectItem key={time} value={time}>
                                    {time}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Summary Card */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h4 className="font-semibold text-slate-800 mb-3">Booking Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Name:</span>
                        <span className="font-medium text-slate-700">{form.getValues('patient_name')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Service:</span>
                        <span className="font-medium text-emerald-600">{getTreatmentName(form.getValues('treatment_id'))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Date:</span>
                        <span className="font-medium text-slate-700">{form.getValues('preferred_date') || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Time:</span>
                        <span className="font-medium text-slate-700">{form.getValues('preferred_time') || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-4">
                {currentStep > 1 && (
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 rounded-xl h-12 font-semibold border-slate-200 hover:bg-slate-50"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                )}
                
                {currentStep < 3 ? (
                  <Button 
                    type="button"
                    onClick={handleNext}
                    className="flex-1 rounded-xl h-12 font-semibold bg-emerald-600 hover:bg-emerald-700"
                  >
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl h-12 font-semibold bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="mr-2">⏳</span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirm Booking
                      </>
                    )}
                  </Button>
                )}
              </div>

              <p className="text-xs text-center text-slate-400">
                By booking, you agree to our Terms. The clinic will contact you to confirm.
              </p>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}