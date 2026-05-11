import { useState } from "react";
import { SEOHead } from "@/components/seo/SEOHead";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTreatments } from "@/hooks/useTreatments";
import { SmartCitySearch } from "@/components/geo/SmartCitySearch";
import { PromotionBanner } from "@/components/subscription/PromotionBanner";
import { useListingOnboarding, type DraftData } from "@/hooks/useListingOnboarding";
import { z } from "zod";
import {
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  ArrowRight,
  Shield,
  TrendingUp,
  Star,
  BadgeCheck,
  Loader2,
  Stethoscope,
  Save,
} from "lucide-react";

// US Phone formatting helper
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
  clinicName: z.string().trim().min(2, "Clinic name must be at least 2 characters").max(100, "Clinic name must be less than 100 characters"),
  dentistName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().min(10, "Please enter a valid US phone number").max(20, "Phone number must be less than 20 characters"),
  streetAddress: z.string().trim().max(500, "Address must be less than 500 characters").optional(),
  website: z.string().trim().url("Invalid website URL").max(255, "Website must be less than 255 characters").or(z.literal("").transform(() => undefined)),
  description: z.string().trim().max(2000, "Description must be less than 2000 characters").optional(),
});

const ListYourPracticePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: treatments = [] } = useTreatments();
  const {
    currentStep,
    draftData,
    saveDraft,
    autoSave,
    submitListing,
    isSaving,
    isLoadingDraft,
    existingDraft,
    completionScore,
  } = useListingOnboarding();
  
  const [listingMethod, setListingMethod] = useState<'gmb' | 'manual' | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [step, setStepLocal] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    stateId: string;
    cityId: string;
    stateName: string;
    cityName: string;
    isNewCity?: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({
    clinicName: draftData.clinicName || "",
    dentistName: draftData.dentistName || "",
    email: user?.email || draftData.email || "",
    phone: draftData.phone || "",
    streetAddress: draftData.address || "",
    website: draftData.website || "",
    description: draftData.description || "",
    agreeTerms: false,
  });

  // GMB Sign-in handler
  const handleGoogleSignIn = async () => {
    setIsConnectingGoogle(true);
    try {
      localStorage.setItem('gmb_listing_flow', 'true');
      // Always use production domain for OAuth callback
      const redirectTo = 'https://www.appointpanda.com/auth/callback?listing=true';

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid email profile https://www.googleapis.com/auth/business.manage',
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        localStorage.removeItem('gmb_listing_flow');
        throw error;
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect with Google",
        variant: "destructive",
      });
      setIsConnectingGoogle(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Format phone number for US
    if (name === 'phone') {
      const formatted = formatUSPhone(value);
      setFormData(prev => ({ ...prev, phone: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
    
    // Auto-save to draft
    const saveData: Partial<DraftData> = {};
    if (name === 'clinicName') saveData.clinicName = value;
    if (name === 'dentistName') saveData.dentistName = value;
    if (name === 'email') saveData.email = value;
    if (name === 'phone') saveData.phone = formatUSPhone(value);
    if (name === 'website') saveData.website = value;
    if (name === 'streetAddress') saveData.address = value;
    if (name === 'description') saveData.description = value;
    
    if (Object.keys(saveData).length > 0) {
      autoSave(saveData);
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    const newServices = selectedServices.includes(serviceId) 
      ? selectedServices.filter(id => id !== serviceId)
      : [...selectedServices, serviceId];
    setSelectedServices(newServices);
    autoSave({ services: newServices });
  };

  const validateStep = (currentStep: number) => {
    const stepFields: Record<number, string[]> = {
      1: ["clinicName", "dentistName"],
      2: ["email", "phone"],
      3: [],
    };

    // For step 1, also validate location
    if (currentStep === 1 && !selectedLocation) {
      setErrors(prev => ({ ...prev, location: "Please select a city" }));
      return false;
    }

    const fieldsToValidate = stepFields[currentStep];
    const partialData: Record<string, any> = {};
    fieldsToValidate.forEach(field => {
      partialData[field] = (formData as any)[field];
    });

    try {
      const partialSchema = z.object(
        Object.fromEntries(
          fieldsToValidate.map(field => [field, (formSchema.shape as any)[field]])
        )
      );
      partialSchema.parse(partialData);
      setErrors(prev => ({ ...prev, location: "" }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStepLocal((prev) => Math.min(prev + 1, 3) as 1 | 2 | 3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreeTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms and conditions.",
        variant: "destructive",
      });
      return;
    }

     let validatedData = formData;
     try {
       validatedData = formSchema.parse(formData);
     } catch (error) {
       if (error instanceof z.ZodError) {
         const newErrors: Record<string, string> = {};
         error.errors.forEach(err => {
           if (err.path[0]) {
             newErrors[err.path[0] as string] = err.message;
           }
         });
         setErrors(newErrors);
         toast({
           title: "Validation Error",
           description: "Please check the form for errors.",
           variant: "destructive",
         });
         return;
       }
     }

    setIsSubmitting(true);

    try {
      const selectedServiceNames = treatments
        .filter((t: any) => selectedServices.includes(t.id))
        .map((t: any) => t.name);

      // Save draft data first
      const draftSaveData: Partial<DraftData> = {
        clinicName: formData.clinicName,
        dentistName: formData.dentistName,
        email: formData.email,
        phone: formData.phone,
        website: formData.website,
        address: formData.streetAddress,
        description: formData.description,
        services: selectedServices,
        cityId: selectedLocation?.cityId,
        termsAccepted: true,
      };
      
      await autoSave(draftSaveData);

      // Submit listing creates real clinic
      await submitListing.mutateAsync();

      // Send confirmation email
      try {
        await supabase.functions.invoke('send-listing-confirmation', {
          body: {
            email: formData.email,
            clinicName: formData.clinicName,
            dentistName: formData.dentistName,
          },
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }

      toast({
        title: "Listing Created!",
        description: "Your clinic has been listed. Our team will review and publish it within 24-48 hours.",
      });

      navigate("/list-your-practice/success");
    } catch (error) {
      console.error('Listing submission error:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your listing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    { icon: Shield, title: "Free Listing", description: "List your practice for free and reach thousands of patients" },
    { icon: BadgeCheck, title: "Get Verified", description: "Verify your profile to stand out and build trust" },
    { icon: TrendingUp, title: "Grow Your Practice", description: "Attract new patients actively searching for dental care" },
    { icon: Star, title: "Build Reputation", description: "Collect reviews and showcase your expertise" },
  ];

  return (
    <PageLayout>
      <SEOHead
        title="List Your Dental Practice | Join AppointPanda Directory"
        description="List your dental practice for free on AppointPanda. Reach thousands of patients, get verified, collect reviews, and grow your practice with our dental directory."
        canonical="/list-your-practice/"
        keywords={['list dental practice', 'dental directory listing', 'dentist marketing', 'dental practice growth']}
      />
      {/* Compact Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-teal/5 border-b">
        <div className="container py-12 md:py-16">
          <div className="max-w-2xl mx-auto text-center">
            {/* Promotion Banner */}
            <div className="mb-6">
              <PromotionBanner variant="inline" />
            </div>
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              <Building2 className="h-4 w-4" />
              For Dental Professionals
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
              List Your <span className="text-primary">Practice</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Join America's leading dental directory. Connect with patients actively searching for dental care in your area.
            </p>
          </div>
        </div>
      </div>

      <Section size="lg">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Form - 3 columns */}
            <div className="lg:col-span-3">
              <div className="card-modern p-6 md:p-8">
                {/* Method Selection */}
                {!listingMethod && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="font-display text-2xl font-bold mb-2">How would you like to list?</h2>
                      <p className="text-muted-foreground">Choose the fastest way to get started</p>
                    </div>

                    {/* GMB Option */}
                    <Card 
                      className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-teal/5 cursor-pointer hover:border-primary/50 transition-all"
                      onClick={handleGoogleSignIn}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="h-14 w-14 rounded-2xl bg-white shadow-md flex items-center justify-center flex-shrink-0">
                            {isConnectingGoogle ? (
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            ) : (
                              <img 
                                src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" 
                                alt="Google" 
                                className="h-8 w-8"
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg">Continue with Google</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-teal/20 text-teal font-medium">Recommended</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              Import your business info, photos, and reviews from Google Business Profile
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-muted">Auto-fill</span>
                              <span className="text-xs px-2 py-1 rounded-full bg-muted">Sync reviews</span>
                              <span className="text-xs px-2 py-1 rounded-full bg-muted">Verified</span>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-3 text-muted-foreground">Or</span>
                      </div>
                    </div>

                    {/* Manual Option */}
                    <Card 
                      className="border border-border cursor-pointer hover:border-primary/30 transition-all"
                      onClick={() => setListingMethod('manual')}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">Fill Out Manually</h3>
                            <p className="text-sm text-muted-foreground">
                              Enter your practice details manually. Connect Google later.
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <p className="text-xs text-center text-muted-foreground">
                      By continuing, you agree to our <Link to="/terms" className="text-primary hover:underline">Terms</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                    </p>
                  </div>
                )}

                {/* Manual Form */}
                {listingMethod === 'manual' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setListingMethod(null)}
                      className="text-sm text-muted-foreground hover:text-foreground mb-6"
                    >
                      ← Back to options
                    </button>

                    {/* Progress */}
                    <div className="flex items-center gap-2 mb-8">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}>
                            {step > s ? <CheckCircle className="h-5 w-5" /> : s}
                          </div>
                          {s < 3 && (
                            <div className={`h-1 flex-1 rounded-full ${step > s ? "bg-primary" : "bg-muted"}`} />
                          )}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                      {/* Step 1: Basic Info */}
                      {step === 1 && (
                        <div className="space-y-6">
                          <div>
                            <h2 className="font-display text-2xl font-bold">Practice Information</h2>
                            <p className="text-muted-foreground">Tell us about your practice</p>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="clinicName" className="font-bold">Clinic Name *</Label>
                              <div className="relative mt-2">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  id="clinicName"
                                  name="clinicName"
                                  placeholder="Enter clinic name"
                                  value={formData.clinicName}
                                  onChange={handleChange}
                                  className={`pl-12 h-12 rounded-xl ${errors.clinicName ? "border-destructive" : ""}`}
                                />
                              </div>
                              {errors.clinicName && <p className="text-sm text-destructive mt-1">{errors.clinicName}</p>}
                            </div>

                            <div>
                              <Label htmlFor="dentistName" className="font-bold">Your Name *</Label>
                              <div className="relative mt-2">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  id="dentistName"
                                  name="dentistName"
                                  placeholder="Dr. First Last"
                                  value={formData.dentistName}
                                  onChange={handleChange}
                                  className={`pl-12 h-12 rounded-xl ${errors.dentistName ? "border-destructive" : ""}`}
                                />
                              </div>
                              {errors.dentistName && <p className="text-sm text-destructive mt-1">{errors.dentistName}</p>}
                            </div>

                            {/* Smart City Search - replaces state/city dropdowns */}
                            <SmartCitySearch
                              value={selectedLocation}
                              onChange={(location) => {
                                setSelectedLocation(location);
                                if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
                                autoSave({ cityId: location?.cityId, stateId: location?.stateId });
                              }}
                              error={errors.location}
                              placeholder="Type city name, e.g. 'Austin, TX'"
                            />

                            <div>
                              <Label htmlFor="streetAddress" className="font-bold">Street Address (Optional)</Label>
                              <div className="relative mt-2">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  id="streetAddress"
                                  name="streetAddress"
                                  placeholder="123 Main Street, Suite 100"
                                  value={formData.streetAddress}
                                  onChange={handleChange}
                                  className="pl-12 h-12 rounded-xl"
                                />
                              </div>
                            </div>
                          </div>

                          <Button type="button" onClick={handleNext} className="w-full rounded-xl font-bold">
                            Continue
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Step 2: Contact Info */}
                      {step === 2 && (
                        <div className="space-y-6">
                          <div>
                            <h2 className="font-display text-2xl font-bold">Contact Information</h2>
                            <p className="text-muted-foreground">How can patients reach you?</p>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="email" className="font-bold">Business Email *</Label>
                              <div className="relative mt-2">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  id="email"
                                  name="email"
                                  type="email"
                                  placeholder="clinic@example.com"
                                  value={formData.email}
                                  onChange={handleChange}
                                  className={`pl-12 h-12 rounded-xl ${errors.email ? "border-destructive" : ""}`}
                                />
                              </div>
                              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                            </div>

                            <div>
                              <Label htmlFor="phone" className="font-bold">Phone Number *</Label>
                              <div className="relative mt-2">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  id="phone"
                                  name="phone"
                                  type="tel"
                                  placeholder="(555) 123-4567"
                                  value={formData.phone}
                                  onChange={handleChange}
                                  className={`pl-12 h-12 rounded-xl ${errors.phone ? "border-destructive" : ""}`}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">US format: (XXX) XXX-XXXX</p>
                              {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
                            </div>

                            <div>
                              <Label htmlFor="website" className="font-bold">Website (Optional)</Label>
                              <div className="relative mt-2">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  id="website"
                                  name="website"
                                  type="url"
                                  placeholder="https://www.yourclinic.com"
                                  value={formData.website}
                                  onChange={handleChange}
                                  className="pl-12 h-12 rounded-xl"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setStepLocal(1)} className="flex-1 rounded-xl font-bold">
                              Back
                            </Button>
                            <Button type="button" onClick={handleNext} className="flex-1 rounded-xl font-bold">
                              Continue
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Services & Submit */}
                      {step === 3 && (
                        <div className="space-y-6">
                          <div>
                            <h2 className="font-display text-2xl font-bold">Services Offered</h2>
                            <p className="text-muted-foreground">Select the services you provide</p>
                          </div>

                          <div className="space-y-4">
                            {/* Services Grid */}
                            <div>
                              <Label className="font-bold flex items-center gap-2 mb-3">
                                <Stethoscope className="h-4 w-4" />
                                Select Your Services
                              </Label>
                              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
                                {treatments.map((treatment: any) => (
                                  <label
                                    key={treatment.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                      selectedServices.includes(treatment.id)
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/30'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={selectedServices.includes(treatment.id)}
                                      onCheckedChange={() => handleServiceToggle(treatment.id)}
                                    />
                                    <span className="text-sm font-medium">{treatment.name}</span>
                                  </label>
                                ))}
                              </div>
                              {selectedServices.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                                </p>
                              )}
                            </div>

                            <div>
                              <Label htmlFor="description" className="font-bold">About Your Practice (Optional)</Label>
                              <Textarea
                                id="description"
                                name="description"
                                placeholder="Tell patients about your clinic, experience, and what makes you unique..."
                                value={formData.description}
                                onChange={handleChange}
                                className="mt-2 rounded-xl min-h-[100px]"
                              />
                            </div>

                            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                              <Checkbox
                                id="agreeTerms"
                                checked={formData.agreeTerms}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, agreeTerms: checked === true }))}
                              />
                              <Label htmlFor="agreeTerms" className="text-sm leading-relaxed cursor-pointer">
                                I agree to the <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. I confirm that I am authorized to list this practice.
                              </Label>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setStepLocal(2)} className="flex-1 rounded-xl font-bold">
                              Back
                            </Button>
                            <Button type="submit" disabled={isSubmitting || submitListing.isPending} className="flex-1 rounded-xl font-bold">
                              {isSubmitting || submitListing.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Create Listing
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </form>
                  </>
                )}
              </div>
            </div>

            {/* Benefits - 2 columns */}
            <div className="lg:col-span-2">
              <h2 className="font-display text-xl font-bold mb-4">Why List With Us?</h2>
              <div className="space-y-3">
                {benefits.map((benefit, i) => (
                  <div key={i} className="card-modern p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{benefit.title}</h3>
                      <p className="text-xs text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-muted/50">
                <h3 className="font-bold text-sm mb-2">Already have a profile?</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  If your clinic is already listed, claim and verify it instead.
                </p>
                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold w-full">
                  <Link to="/claim-profile">
                    Claim Existing Profile
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
};

export default ListYourPracticePage;
