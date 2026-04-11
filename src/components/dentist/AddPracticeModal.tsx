import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useStates, useCities } from '@/hooks/useLocations';
import { useTreatments } from '@/hooks/useTreatments';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Stethoscope,
  FileText,
  Sparkles,
} from 'lucide-react';

const formatUSPhone = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  if (match) {
    const parts = [match[1], match[2], match[3]].filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return `(${parts[0]}`;
    if (parts.length === 2) return `(${parts[0]}) ${parts[1]}`;
    return `(${parts[0]}) ${parts[1]}-${parts[2]}`;
  }
  return value;
};

const formSchema = z.object({
  clinicName: z.string().trim().min(2, "Clinic name is required").max(100),
  dentistName: z.string().trim().min(2, "Your name is required").max(100),
  email: z.string().trim().email("Valid email is required").max(255),
  phone: z.string().trim().min(10, "Valid phone number is required").max(20),
  stateId: z.string().min(1, "State is required"),
  cityId: z.string().min(1, "City is required"),
  streetAddress: z.string().trim().max(500).optional(),
  website: z.string().trim().url().max(255).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional(),
});

interface AddPracticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 1, title: 'Practice Details', icon: Building2, description: 'Name and location' },
  { id: 2, title: 'Contact Info', icon: Phone, description: 'How patients reach you' },
  { id: 3, title: 'Services', icon: Stethoscope, description: 'What you offer' },
  { id: 4, title: 'Review & Submit', icon: FileText, description: 'Confirm details' },
];

export function AddPracticeModal({ open, onOpenChange }: AddPracticeModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: states = [] } = useStates();
  const { data: allCities = [] } = useCities();
  const { data: treatments = [] } = useTreatments();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    clinicName: '',
    dentistName: profile?.full_name || '',
    email: user?.email || '',
    phone: '',
    stateId: '',
    cityId: '',
    streetAddress: '',
    website: '',
    description: '',
    agreeTerms: false,
  });

  const filteredCities = allCities.filter((city: any) => {
    if (!formData.stateId) return false;
    return (city as any).state?.id === formData.stateId || (city as any).states?.id === formData.stateId;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: formatUSPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const validateStep = (currentStep: number): boolean => {
    const stepFields: Record<number, (keyof typeof formData)[]> = {
      1: ['clinicName', 'dentistName', 'stateId', 'cityId'],
      2: ['email', 'phone'],
      3: [],
      4: [],
    };

    const fieldsToValidate = stepFields[currentStep] || [];
    const newErrors: Record<string, string> = {};

    fieldsToValidate.forEach(field => {
      const value = formData[field];
      try {
        const fieldSchema = (formSchema.shape as any)[field];
        if (fieldSchema) {
          fieldSchema.parse(value);
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          newErrors[field] = err.errors[0]?.message || 'Invalid';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const generateBaseSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  };

  // Generate unique slug by checking existing slugs
  const generateUniqueSlug = async (tableName: 'clinics' | 'dentists', name: string): Promise<string> => {
    const baseSlug = generateBaseSlug(name);
    
    if (!baseSlug) {
      return `practice-${Date.now().toString(36)}`;
    }

    // Check if base slug exists
    const { data: existing } = await supabase
      .from(tableName)
      .select('slug')
      .like('slug', `${baseSlug}%`)
      .order('slug', { ascending: false });

    if (!existing || existing.length === 0) {
      return baseSlug;
    }

    // Find the highest counter
    let maxCounter = 0;
    const exactMatch = existing.some((row) => row.slug === baseSlug);
    
    if (exactMatch) {
      maxCounter = 1;
    }

    for (const row of existing) {
      const match = row.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
      if (match) {
        const counter = parseInt(match[1], 10);
        if (counter >= maxCounter) {
          maxCounter = counter + 1;
        }
      }
    }

    if (maxCounter === 0) {
      return baseSlug;
    }

    return `${baseSlug}-${maxCounter}`;
  };

  const handleSubmit = async () => {
    if (!formData.agreeTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedState = states.find((s: any) => s.id === formData.stateId);
      const selectedCity = filteredCities.find((c: any) => c.id === formData.cityId);
      const selectedServiceNames = treatments
        .filter((t: any) => selectedServices.includes(t.id))
        .map((t: any) => t.name);

      // Generate unique slug without random codes
      const slug = await generateUniqueSlug('clinics', formData.clinicName);

      // Create the clinic directly
      const { data: newClinic, error: clinicError } = await supabase
        .from('clinics')
        .insert({
          name: formData.clinicName,
          slug,
          phone: formData.phone,
          email: formData.email,
          website: formData.website || null,
          address: formData.streetAddress || null,
          description: formData.description || null,
          city_id: formData.cityId,
          claimed_by: user?.id,
          claim_status: 'claimed',
          verification_status: 'pending',
          location_verified: true,
          is_active: true,
          source: 'self-listing',
        })
        .select()
        .single();

      if (clinicError) throw clinicError;

      // Add clinic treatments
      if (selectedServices.length > 0 && newClinic) {
        const treatmentInserts = selectedServices.map(treatmentId => ({
          clinic_id: newClinic.id,
          treatment_id: treatmentId,
        }));
        
        await supabase.from('clinic_treatments').insert(treatmentInserts);
      }

      // Create dentist profile linked to clinic with unique slug
      const dentistSlug = await generateUniqueSlug('dentists', formData.dentistName);
      await supabase.from('dentists').insert({
        name: formData.dentistName,
        slug: dentistSlug,
        email: formData.email,
        phone: formData.phone,
        clinic_id: newClinic.id,
        is_primary: true,
        is_active: true,
      });

      // Ensure user has dentist role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user?.id)
        .eq('role', 'dentist')
        .maybeSingle();

      if (!existingRole) {
        await supabase.from('user_roles').insert({
          user_id: user?.id,
          role: 'dentist',
        });
      }

      // Also create a lead for admin tracking
      await supabase.from('leads').insert({
        patient_name: formData.dentistName,
        patient_email: formData.email,
        patient_phone: formData.phone,
        clinic_id: newClinic.id,
        message: JSON.stringify({
          type: 'self_listing',
          clinicName: formData.clinicName,
          state: selectedState?.name || '',
          city: selectedCity?.name || '',
          services: selectedServiceNames,
          description: formData.description,
        }),
        source: 'dashboard-add-practice',
        status: 'converted',
      });

      toast.success('Practice created successfully!');
      queryClient.invalidateQueries({ queryKey: ['dentist-profile'] });
      onOpenChange(false);
      
      // Reset form
      setStep(1);
      setFormData({
        clinicName: '',
        dentistName: profile?.full_name || '',
        email: user?.email || '',
        phone: '',
        stateId: '',
        cityId: '',
        streetAddress: '',
        website: '',
        description: '',
        agreeTerms: false,
      });
      setSelectedServices([]);
    } catch (error: any) {
      console.error('Error creating practice:', error);
      toast.error(error.message || 'Failed to create practice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (step / 4) * 100;
  const currentStepInfo = STEPS[step - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-xl">Add Your Practice</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                Create your clinic profile in a few steps
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Step {step} of 4</span>
            <span className="font-medium text-primary">{currentStepInfo.title}</span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-between">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`flex flex-col items-center gap-1 ${
                  step >= s.id ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step > s.id
                      ? 'bg-primary text-primary-foreground'
                      : step === s.id
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}
                </div>
                <span className="text-[10px] hidden sm:block">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="py-4">
          {/* Step 1: Practice Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="clinicName" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Practice Name *
                  </Label>
                  <Input
                    id="clinicName"
                    name="clinicName"
                    value={formData.clinicName}
                    onChange={handleChange}
                    placeholder="e.g., Sunshine Dental Care"
                    className={errors.clinicName ? 'border-destructive' : ''}
                  />
                  {errors.clinicName && (
                    <p className="text-xs text-destructive mt-1">{errors.clinicName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="dentistName" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Your Name *
                  </Label>
                  <Input
                    id="dentistName"
                    name="dentistName"
                    value={formData.dentistName}
                    onChange={handleChange}
                    placeholder="Dr. John Smith"
                    className={errors.dentistName ? 'border-destructive' : ''}
                  />
                  {errors.dentistName && (
                    <p className="text-xs text-destructive mt-1">{errors.dentistName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stateId" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      State *
                    </Label>
                    <Select
                      value={formData.stateId}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, stateId: value, cityId: '' }));
                        if (errors.stateId) setErrors(prev => ({ ...prev, stateId: '' }));
                      }}
                    >
                      <SelectTrigger className={errors.stateId ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((state: any) => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.stateId && (
                      <p className="text-xs text-destructive mt-1">{errors.stateId}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="cityId" className="flex items-center gap-2">
                      City *
                    </Label>
                    <Select
                      value={formData.cityId}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, cityId: value }));
                        if (errors.cityId) setErrors(prev => ({ ...prev, cityId: '' }));
                      }}
                      disabled={!formData.stateId}
                    >
                      <SelectTrigger className={errors.cityId ? 'border-destructive' : ''}>
                        <SelectValue placeholder={formData.stateId ? 'Select city' : 'Select state first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCities.map((city: any) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.cityId && (
                      <p className="text-xs text-destructive mt-1">{errors.cityId}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="streetAddress" className="flex items-center gap-2">
                    Street Address (Optional)
                  </Label>
                  <Input
                    id="streetAddress"
                    name="streetAddress"
                    value={formData.streetAddress}
                    onChange={handleChange}
                    placeholder="123 Main Street, Suite 100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Business Email *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@yourpractice.com"
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                    className={errors.phone ? 'border-destructive' : ''}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive mt-1">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Website (Optional)
                  </Label>
                  <Input
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://yourpractice.com"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="flex items-center gap-2">
                    About Your Practice (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Tell patients about your practice, specialties, and what makes you unique..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Services */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  Services Offered
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Select the services your practice offers. This helps patients find you.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                  {treatments.map((treatment: any) => (
                    <div
                      key={treatment.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedServices.includes(treatment.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                      onClick={() => handleServiceToggle(treatment.id)}
                    >
                      <Checkbox
                        checked={selectedServices.includes(treatment.id)}
                        onCheckedChange={() => handleServiceToggle(treatment.id)}
                      />
                      <span className="text-sm">{treatment.name}</span>
                    </div>
                  ))}
                </div>
                {selectedServices.length > 0 && (
                  <p className="text-sm text-primary mt-3">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Review Your Information
                </h4>
                
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Practice Name</span>
                    <span className="font-medium">{formData.clinicName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Name</span>
                    <span className="font-medium">{formData.dentistName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">
                      {filteredCities.find((c: any) => c.id === formData.cityId)?.name || ''},{' '}
                      {states.find((s: any) => s.id === formData.stateId)?.name || ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{formData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{formData.phone}</span>
                  </div>
                  {formData.website && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Website</span>
                      <span className="font-medium truncate max-w-[200px]">{formData.website}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Services</span>
                    <span className="font-medium">{selectedServices.length} selected</span>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary mb-1">What happens next?</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Your practice will be created immediately</li>
                      <li>• You can edit your profile anytime from the dashboard</li>
                      <li>• Upgrade to a paid plan for enhanced visibility</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="agreeTerms"
                  checked={formData.agreeTerms}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, agreeTerms: checked as boolean }))
                  }
                />
                <label htmlFor="agreeTerms" className="text-sm text-muted-foreground cursor-pointer">
                  I agree to the Terms of Service and Privacy Policy
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={step === 1 ? () => onOpenChange(false) : handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < 4 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.agreeTerms}
              className="bg-gradient-to-r from-primary to-teal hover:from-primary/90 hover:to-teal/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Practice
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
