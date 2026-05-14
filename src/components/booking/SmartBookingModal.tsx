import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Stethoscope,
  Star,
  MapPin,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SmartBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
  clinicName: string;
  clinicAddress?: string;
  dentistName?: string;
  dentistId?: string;
  clinicRating?: number;
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

const SERVICES = [
  { id: "checkup", name: "Dental Checkup", price: "$0-50", icon: Stethoscope, color: "bg-emerald-100 text-emerald-600" },
  { id: "cleaning", name: "Teeth Cleaning", price: "$75-150", icon: Sparkles, color: "bg-teal-100 text-teal-600" },
  { id: "whitening", name: "Teeth Whitening", price: "$200-500", icon: Star, color: "bg-amber-100 text-amber-600" },
  { id: "filling", name: "Tooth Filling", price: "$100-300", icon: Stethoscope, color: "bg-blue-100 text-blue-600" },
  { id: "crown", name: "Crown Treatment", price: "$500-1500", icon: Stethoscope, color: "bg-purple-100 text-purple-600" },
  { id: "implant", name: "Dental Implant", price: "$1000-4000", icon: Stethoscope, color: "bg-rose-100 text-rose-600" },
  { id: "root-canal", name: "Root Canal", price: "$500-1200", icon: Stethoscope, color: "bg-orange-100 text-orange-600" },
  { id: "emergency", name: "Emergency Visit", price: "$100-300", icon: Calendar, color: "bg-red-100 text-red-600" },
];

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM"
];

const QUICK_SERVICES = SERVICES.slice(0, 4);

export function SmartBookingModal({
  open,
  onOpenChange,
  clinicId,
  clinicName,
  clinicAddress,
  dentistName,
  dentistId,
  clinicRating,
}: SmartBookingModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<BookingStep>("service");
  const [data, setData] = useState<BookingData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [showAllServices, setShowAllServices] = useState(false);

  const displayServices = showAllServices ? SERVICES : QUICK_SERVICES;

  const handleServiceSelect = (service: typeof SERVICES[0]) => {
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
      toast({ title: "Please fill in your name and phone", variant: "destructive" });
      return;
    }
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!clinicId) return;
    
    setIsSubmitting(true);
    try {
      const appointmentDate = data.date ? format(data.date, "yyyy-MM-dd") : null;
      
      const { error } = await supabase.from("appointments").insert({
        clinic_id: clinicId,
        dentist_id: dentistId,
        patient_name: data.patientName,
        patient_phone: data.patientPhone,
        patient_email: data.patientEmail,
        preferred_date: appointmentDate,
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
    setShowAllServices(false);
    onOpenChange(false);
  };

  const goBack = () => {
    const stepOrder = ["service", "datetime", "details", "confirm"];
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1] as BookingStep);
  };

  useEffect(() => {
    if (!open) {
      setStep("service");
      setData({});
      setDate(undefined);
      setShowAllServices(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-w-[calc(100vw-1rem)] rounded-2xl border border-gray-100 bg-white p-0 overflow-hidden max-h-[90vh]" hideCloseButton>
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-50 via-white to-white px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {step !== "service" && step !== "success" ? (
              <button 
                onClick={goBack} 
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
            ) : <div />}
            
            <div className="flex items-center gap-2">
              {clinicRating && (
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full">
                  <Star className="h-4 w-4 text-amber-500 fill-current" />
                  <span className="text-sm font-semibold text-amber-700">{clinicRating.toFixed(1)}</span>
                </div>
              )}
              <div className="flex gap-1.5">
                {["service", "datetime", "details"].map((s, i) => {
                  const stepIdx = ["service", "datetime", "details"].indexOf(step);
                  return (
                    <div 
                      key={s}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        i <= stepIdx ? "bg-emerald-500" : "bg-gray-200"
                      )}
                    />
                  );
                })}
              </div>
            </div>
            
            <button 
              onClick={handleClose} 
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
            >
              ×
            </button>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-180px)]">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Service Selection */}
            {step === "service" && (
              <motion.div
                key="service"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="text-center mb-5">
                  <h2 className="text-xl font-bold text-gray-900">What do you need?</h2>
                  <p className="text-sm text-gray-500 mt-1">{clinicName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {displayServices.map((service) => {
                    const Icon = service.icon;
                    return (
                      <button
                        key={service.id}
                        onClick={() => handleServiceSelect(service)}
                        className={cn(
                          "p-4 rounded-xl border-2 border-gray-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-200 text-left group",
                          data.serviceId === service.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "bg-white"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", service.color.split(' ')[0])}>
                            <Icon className={cn("h-5 w-5", service.color.split(' ')[1])} />
                          </div>
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {service.price}
                          </span>
                        </div>
                        <div className="font-semibold text-gray-900 text-sm">{service.name}</div>
                      </button>
                    );
                  })}
                </div>
                
                {!showAllServices && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowAllServices(true)}
                    className="w-full text-gray-500 hover:text-emerald-600"
                  >
                    View more services
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </motion.div>
            )}

            {/* Step 2: Date & Time */}
            {step === "datetime" && (
              <motion.div
                key="datetime"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Pick a date & time</h2>
                  <p className="text-sm text-gray-500">{data.serviceName}</p>
                </div>

                {/* Date Selection */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = addDays(new Date(), i + 1);
                    const isSelected = date && format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
                    return (
                      <button
                        key={i}
                        onClick={() => handleDateSelect(d)}
                        className={cn(
                          "flex-shrink-0 w-14 py-3 rounded-xl border-2 transition-all flex flex-col items-center",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-100 hover:border-emerald-300"
                        )}
                      >
                        <span className="text-xs text-gray-500">{format(d, "EEE")}</span>
                        <span className="text-lg font-bold text-gray-900">{format(d, "d")}</span>
                      </button>
                    );
                  })}
                </div>
                
                {date && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-500" /> Available times
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {TIME_SLOTS.map((time) => (
                        <button
                          key={time}
                          onClick={() => handleTimeSelect(time)}
                          className={cn(
                            "py-2.5 px-2 text-sm rounded-lg border-2 border-gray-100 transition-all",
                            data.timeSlot === time
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
                              : "hover:border-emerald-300 hover:bg-emerald-50 text-gray-700"
                          )}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Your Details */}
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Your information</h2>
                  <p className="text-sm text-gray-500">
                    {data.serviceName} • {date && format(date, "MMM d")} at {data.timeSlot}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-600">Your Name *</Label>
                    <Input
                      placeholder="John Smith"
                      value={data.patientName || ""}
                      onChange={(e) => setData(prev => ({ ...prev, patientName: e.target.value }))}
                      className="h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm text-gray-600">Phone Number *</Label>
                    <Input
                      placeholder="(555) 123-4567"
                      value={data.patientPhone || ""}
                      onChange={(e) => setData(prev => ({ ...prev, patientPhone: e.target.value }))}
                      className="h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm text-gray-600">Email (optional)</Label>
                    <Input
                      type="email"
                      placeholder="john@email.com"
                      value={data.patientEmail || ""}
                      onChange={(e) => setData(prev => ({ ...prev, patientEmail: e.target.value }))}
                      className="h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm text-gray-600">Notes (optional)</Label>
                    <Textarea
                      placeholder="Any concerns or special requests..."
                      value={data.notes || ""}
                      onChange={(e) => setData(prev => ({ ...prev, notes: e.target.value }))}
                      className="rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 min-h-[80px]"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={handleDetailsSubmit}
                  className="w-full rounded-xl h-12 font-semibold bg-emerald-600 hover:bg-emerald-700"
                  disabled={!data.patientName || !data.patientPhone}
                >
                  Review Booking
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step 4: Confirm */}
            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Review your booking</h2>
                </div>
                
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Service</span>
                    <span className="font-medium text-gray-900">{data.serviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span className="font-medium text-gray-900">
                      {date && format(date, "EEEE, MMM d")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time</span>
                    <span className="font-medium text-gray-900">{data.timeSlot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Clinic</span>
                    <span className="font-medium text-gray-900 truncate max-w-[150px]">{clinicName}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name</span>
                      <span className="font-medium text-gray-900">{data.patientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phone</span>
                      <span className="font-medium text-gray-900">{data.patientPhone}</span>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="w-full rounded-xl h-12 font-semibold bg-emerald-600 hover:bg-emerald-700"
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
              </motion.div>
            )}

            {/* Step 5: Success */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5"
                >
                  <CheckCircle className="h-10 w-10 text-emerald-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
                <p className="text-gray-500 mb-6">
                  You'll receive a confirmation at {data.patientPhone}
                </p>
                
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-left mb-6">
                  <p className="font-semibold text-gray-900">{data.serviceName}</p>
                  <p className="text-sm text-gray-500">
                    {date && format(date, "EEEE, MMM d, yyyy")} at {data.timeSlot}
                  </p>
                  {clinicAddress && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" /> {clinicAddress}
                    </p>
                  )}
                </div>
                
                <Button 
                  onClick={handleClose} 
                  className="w-full rounded-xl h-12 font-semibold bg-emerald-600 hover:bg-emerald-700"
                >
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}