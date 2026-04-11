import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  BadgeCheck,
  Building2,
  User,
  ArrowRight,
  CheckCircle,
  Shield,
  TrendingUp,
  Star,
  Mail,
  Loader2,
  FileText,
  MapPin,
  Clock,
  Globe,
  AlertCircle
} from "lucide-react";

type ClaimMethod = "otp" | "manual";
type EmailSource = "domain" | "claim_email";

// Extract domain from website URL
const extractDomain = (website: string | null): string | null => {
  if (!website) return null;
  try {
    let url = website;
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    // Try to extract domain from simple string
    const match = website.replace('www.', '').match(/^([a-zA-Z0-9-]+\.[a-zA-Z.]+)/);
    return match ? match[1] : null;
  }
};

// Extract domain from email
const extractEmailDomain = (email: string): string | null => {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1] : null;
};

const ClaimProfilePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const prefilledClinic = searchParams.get("clinic");
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"clinic" | "dentist">("clinic");
  const [selectedClinic, setSelectedClinic] = useState<any>(null);
  const [step, setStep] = useState<"search" | "choose-method" | "select-email" | "otp-verify" | "manual-form" | "success" | "submitted">("search");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailPrefix, setEmailPrefix] = useState("");
  const [selectedClaimEmail, setSelectedClaimEmail] = useState<string | null>(null);
  const [emailSource, setEmailSource] = useState<EmailSource>("domain");
  
  // Manual review form fields
  const [manualForm, setManualForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: ""
  });

  // Get domain from selected clinic's website
  const clinicDomain = selectedClinic ? extractDomain(selectedClinic.website) : null;
  const fullBusinessEmail = emailPrefix && clinicDomain ? `${emailPrefix}@${clinicDomain}` : "";
  
  // Get claim emails from clinic
  const claimEmails: string[] = selectedClinic?.claim_emails || [];
  const hasClaimEmails = claimEmails.length > 0;

  // Auto-search when clinic is prefilled from URL
  useEffect(() => {
    if (prefilledClinic && prefilledClinic.length >= 2) {
      console.log('🔍 Auto-searching for prefilled clinic:', prefilledClinic);
      setSearchQuery(prefilledClinic);
    }
  }, [prefilledClinic]);

  // Clear URL params once search is triggered (but keep page showing search results)
  useEffect(() => {
    if (searchQuery && searchQuery === prefilledClinic && prefilledClinic) {
      // Search is now running, clear URL params
      setSearchParams({}, { replace: true });
    }
  }, [searchQuery, prefilledClinic, setSearchParams]);

  // Search clinics
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["claim-search", searchQuery, searchType],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      if (searchType === "clinic") {
        const { data } = await supabase
          .from("clinics")
          .select("id, name, slug, address, email, phone, website, claim_status, verification_status, claim_emails, city:cities(name)")
          .ilike("name", `%${searchQuery}%`)
          .limit(10);
        return data || [];
      } else {
        const { data } = await supabase
          .from("dentists")
          .select("id, name, slug, title, clinic:clinics(id, name, slug, website, claim_emails)")
          .ilike("name", `%${searchQuery}%`)
          .limit(10);
        return data || [];
      }
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSelectClinic = (clinic: any) => {
    setSelectedClinic(clinic);
    setEmailPrefix("");
    if (clinic.claim_status === "claimed") {
      toast({
        title: "Already Claimed",
        description: "This profile has already been claimed. Contact support if you believe this is an error.",
        variant: "destructive",
      });
      return;
    }
    setStep("choose-method");
  };

  const handleChooseMethod = (method: ClaimMethod) => {
    if (method === "otp") {
      // If clinic has claim emails, show email selection step
      if (hasClaimEmails) {
        setStep("select-email");
      } else if (clinicDomain) {
        // Fall back to domain-based verification
        setEmailSource("domain");
        setStep("otp-verify");
      } else {
        toast({
          title: "No Email Options Available",
          description: "This clinic doesn't have email records. Please request a manual review instead.",
          variant: "destructive",
        });
      }
    } else {
      setStep("manual-form");
    }
  };
  
  const handleSelectEmailSource = (source: EmailSource, email?: string) => {
    setEmailSource(source);
    if (source === "claim_email" && email) {
      setSelectedClaimEmail(email);
    }
    setStep("otp-verify");
  };

  const handleSendVerification = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to claim your profile.",
        variant: "destructive",
      });
      return;
    }

    let emailToVerify: string;
    
    if (emailSource === "claim_email" && selectedClaimEmail) {
      emailToVerify = selectedClaimEmail;
    } else if (emailPrefix && clinicDomain) {
      emailToVerify = fullBusinessEmail;
    } else {
      toast({
        title: "Email Required",
        description: "Please select or enter an email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-claim-otp', {
        body: {
          clinicId: selectedClinic.id,
          method: "email",
          businessEmail: emailToVerify,
          businessPhone: selectedClinic.phone || "",
        },
      });

      if (error) throw error;

      if (data.success) {
        setOtpSent(true);
        toast({
          title: "Verification Code Sent",
          description: `A 6-digit code has been sent to ${emailToVerify}.`,
        });
      } else {
        throw new Error(data.error || "Failed to send verification code");
      }
    } catch (error: any) {
      console.error('OTP send error:', error);
      toast({
        title: "Failed to Send Code",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerify = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to verify your claim.",
        variant: "destructive",
      });
      return;
    }

    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-claim-otp', {
        body: {
          clinicId: selectedClinic.id,
          code: verificationCode,
        },
      });

      if (error) throw error;

      if (data.success) {
        setStep("success");
        toast({
          title: "Profile Claimed!",
          description: "Your profile has been successfully claimed.",
        });
      } else {
        throw new Error(data.error || "Verification failed");
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code or expired. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to submit a claim request.",
        variant: "destructive",
      });
      return;
    }

    if (!manualForm.name || !manualForm.email || !manualForm.phone) {
      toast({
        title: "Required Fields",
        description: "Please fill in your name, email, and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("claim_requests")
        .upsert({
          clinic_id: selectedClinic.id,
          user_id: user.id,
          status: "pending",
          claim_type: "manual_review",
          requester_name: manualForm.name,
          business_email: manualForm.email,
          requester_phone: manualForm.phone,
          requester_address: manualForm.address,
          admin_notes: manualForm.notes ? `User notes: ${manualForm.notes}` : null,
          verification_method: "manual",
        }, {
          onConflict: 'clinic_id,user_id'
        });

      if (error) throw error;

      setStep("submitted");
      toast({
        title: "Request Submitted",
        description: "Our team will review your claim and contact you shortly.",
      });
    } catch (error: any) {
      console.error('Manual submit error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === "choose-method") {
      setStep("search");
      setSelectedClinic(null);
    } else if (step === "select-email") {
      setStep("choose-method");
      setSelectedClaimEmail(null);
    } else if (step === "otp-verify" || step === "manual-form") {
      if (hasClaimEmails) {
        setStep("select-email");
      } else {
        setStep("choose-method");
      }
      setOtpSent(false);
      setVerificationCode("");
      setEmailPrefix("");
      setSelectedClaimEmail(null);
    }
  };

  const benefits = [
    { icon: BadgeCheck, title: "Verified Badge", description: "Stand out with a verified badge on your profile" },
    { icon: TrendingUp, title: "Higher Ranking", description: "Verified profiles rank higher in search results" },
    { icon: Star, title: "Collect Reviews", description: "Get patient reviews and build your reputation" },
    { icon: Shield, title: "Control Your Info", description: "Update your profile, services, and photos" },
  ];

  // Set noindex for claim pages
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://www.appointpanda.com/claim-profile');
    
    return () => {
      meta?.setAttribute('content', 'index, follow');
      canonical?.remove();
    };
  }, []);

  return (
    <PageLayout>
      {/* Compact Hero */}
      <div className="bg-gradient-to-b from-primary/5 to-background pt-8 pb-6">
        <div className="container">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <span>Claim Profile</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Claim Your <span className="text-primary">Profile</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Verify ownership of your clinic or practice to unlock management features.
          </p>
        </div>
      </div>

      <Section size="md">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left - Main Content (3 cols) */}
          <div className="lg:col-span-3">
            {step === "search" && (
              <div className="card-modern p-6 md:p-8">
                <h2 className="font-display text-xl font-bold mb-5">Find Your Profile</h2>
                
                {/* Search Type Toggle */}
                <div className="flex gap-2 mb-5">
                  <Button
                    variant={searchType === "clinic" ? "default" : "outline"}
                    onClick={() => setSearchType("clinic")}
                    className="rounded-xl font-bold flex-1"
                    size="sm"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Clinic
                  </Button>
                  <Button
                    variant={searchType === "dentist" ? "default" : "outline"}
                    onClick={() => setSearchType("dentist")}
                    className="rounded-xl font-bold flex-1"
                    size="sm"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Dentist
                  </Button>
                </div>

                {/* Search Input */}
                <div className="relative mb-5">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder={`Search by ${searchType} name...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 rounded-xl"
                  />
                </div>

                {/* Search Results */}
                {searching && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Searching...
                  </div>
                )}

                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-2 mb-5">
                    <p className="text-sm text-muted-foreground font-medium">
                      {searchResults.length} results found
                    </p>
                    {searchResults.map((result: any) => (
                      <button
                        key={result.id}
                        onClick={() => handleSelectClinic(result)}
                        className="w-full p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{result.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {result.address || result.title || ""}
                            </p>
                            {result.website && (
                              <p className="text-xs text-primary flex items-center gap-1 mt-1">
                                <Globe className="h-3 w-3" />
                                {extractDomain(result.website)}
                              </p>
                            )}
                          </div>
                          {result.claim_status === "claimed" ? (
                            <Badge variant="secondary" className="rounded-full ml-2">Claimed</Badge>
                          ) : (
                            <Badge className="bg-primary/10 text-primary rounded-full ml-2">Available</Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && searchResults?.length === 0 && !searching && (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">No profiles found matching your search.</p>
                    <Button asChild variant="outline" className="rounded-xl font-bold" size="sm">
                      <Link to="/list-your-practice">
                        List Your Practice Instead
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Not Found CTA */}
                <div className="mt-6 p-5 rounded-xl bg-gold/10 border border-gold/30">
                  <h3 className="font-display font-bold mb-1">Can't find your profile?</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    If your clinic isn't listed yet, you can add it for free.
                  </p>
                  <Button asChild variant="outline" className="rounded-xl font-bold border-gold text-gold hover:bg-gold hover:text-white" size="sm">
                    <Link to="/list-your-practice">
                      List Your Practice
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Choose Verification Method */}
            {step === "choose-method" && selectedClinic && (
              <div className="card-modern p-6 md:p-8">
                <button
                  onClick={handleBack}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
                >
                  ← Back to search
                </button>

                <div className="flex items-start gap-4 mb-6 p-4 rounded-xl bg-muted/50">
                  <Building2 className="h-10 w-10 text-primary flex-shrink-0" />
                  <div>
                    <h3 className="font-bold">{selectedClinic.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedClinic.address}</p>
                    {clinicDomain && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-1">
                        <Globe className="h-3 w-3" />
                        {clinicDomain}
                      </p>
                    )}
                  </div>
                </div>

                <h2 className="font-display text-xl font-bold mb-2">How would you like to verify?</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Choose a method to prove you own this business.
                </p>

                <div className="space-y-3">
                  {/* OTP Option */}
                  <button
                    onClick={() => handleChooseMethod("otp")}
                    disabled={!clinicDomain && !hasClaimEmails}
                    className={`w-full p-5 rounded-xl border-2 transition-all text-left group ${
                      (clinicDomain || hasClaimEmails)
                        ? "border-border hover:border-primary/50"
                        : "border-border/50 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">Verify via Email</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {hasClaimEmails 
                            ? `We have ${claimEmails.length} email${claimEmails.length > 1 ? 's' : ''} on file for this clinic.`
                            : clinicDomain 
                              ? "We'll send a code to any email at your website domain."
                              : "No email options available."
                          }
                        </p>
                        {hasClaimEmails ? (
                          <div className="flex flex-wrap gap-1">
                            {claimEmails.slice(0, 3).map((email, i) => (
                              <Badge key={i} variant="secondary" className="rounded-full text-xs">
                                {email}
                              </Badge>
                            ))}
                            {claimEmails.length > 3 && (
                              <Badge variant="outline" className="rounded-full text-xs">
                                +{claimEmails.length - 3} more
                              </Badge>
                            )}
                          </div>
                        ) : clinicDomain ? (
                          <Badge variant="secondary" className="rounded-full text-xs">
                            yourname@{clinicDomain}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full text-xs text-amber-600 border-amber-300">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No email records
                          </Badge>
                        )}
                      </div>
                      {(clinicDomain || hasClaimEmails) && (
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3 text-muted-foreground text-sm">
                    <div className="flex-1 h-px bg-border" />
                    <span>or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Manual Review Option */}
                  <button
                    onClick={() => handleChooseMethod("manual")}
                    className="w-full p-5 rounded-xl border-2 border-border hover:border-amber-500/50 transition-all text-left group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-6 w-6 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">Don't Have Access?</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          Request a manual review. Submit your details and our team will contact you to verify ownership.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Usually reviewed within 24-48 hours</span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-600 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Email Selection Step */}
            {step === "select-email" && selectedClinic && (
              <div className="card-modern p-6 md:p-8">
                <button
                  onClick={handleBack}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
                >
                  ← Back
                </button>

                <div className="flex items-start gap-4 mb-6 p-4 rounded-xl bg-muted/50">
                  <Building2 className="h-8 w-8 text-primary flex-shrink-0" />
                  <div>
                    <h3 className="font-bold">{selectedClinic.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedClinic.address}</p>
                  </div>
                </div>

                <h2 className="font-display text-xl font-bold mb-2">Select Verification Email</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Choose an email address to receive your verification code. You can use any of the emails we have on file for this clinic.
                </p>

                <div className="space-y-3">
                  {/* Claim emails from database */}
                  {claimEmails.map((email, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectEmailSource("claim_email", email)}
                      className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{email}</p>
                          <p className="text-xs text-muted-foreground">Verified business email</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </button>
                  ))}

                  {/* Website domain option if available */}
                  {clinicDomain && (
                    <>
                      <div className="flex items-center gap-3 text-muted-foreground text-sm">
                        <div className="flex-1 h-px bg-border" />
                        <span>or use website domain</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      
                      <button
                        onClick={() => handleSelectEmailSource("domain")}
                        className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <Globe className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">Use any @{clinicDomain} email</p>
                            <p className="text-xs text-muted-foreground">Enter your custom email address</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setStep("manual-form")}
                  className="w-full mt-5 text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Don't have access to any of these? Request manual review
                </button>
              </div>
            )}

            {/* OTP Verification */}
            {step === "otp-verify" && selectedClinic && (
              <div className="card-modern p-6 md:p-8">
                <button
                  onClick={handleBack}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
                >
                  ← Back
                </button>

                <div className="flex items-start gap-4 mb-6 p-4 rounded-xl bg-muted/50">
                  <Building2 className="h-8 w-8 text-primary flex-shrink-0" />
                  <div>
                    <h3 className="font-bold">{selectedClinic.name}</h3>
                    {emailSource === "claim_email" && selectedClaimEmail ? (
                      <p className="text-xs text-primary">{selectedClaimEmail}</p>
                    ) : (
                      <p className="text-xs text-primary">{clinicDomain}</p>
                    )}
                  </div>
                </div>

                <h2 className="font-display text-xl font-bold mb-2">Email Verification</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  {emailSource === "claim_email" && selectedClaimEmail
                    ? `We'll send a verification code to ${selectedClaimEmail}.`
                    : "Enter any email address associated with your website domain to receive a verification code."
                  }
                </p>

                {!user ? (
                  <div className="text-center py-6 bg-muted/30 rounded-xl">
                    <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Please sign in to continue</p>
                    <Button asChild className="rounded-xl font-bold">
                      <Link to="/auth?redirect=/claim-profile">Sign In to Continue</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Show email input for domain-based verification */}
                    {emailSource === "domain" && clinicDomain && (
                      <div className="mb-5">
                        <Label htmlFor="emailPrefix" className="font-bold">Your Email at {clinicDomain}</Label>
                        <div className="flex mt-2">
                          <Input
                            id="emailPrefix"
                            type="text"
                            placeholder="info"
                            value={emailPrefix}
                            onChange={(e) => setEmailPrefix(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                            className="h-11 rounded-l-xl rounded-r-none border-r-0"
                          />
                          <div className="h-11 px-4 bg-muted border border-l-0 rounded-r-xl flex items-center text-sm text-muted-foreground font-medium">
                            @{clinicDomain}
                          </div>
                        </div>
                        {fullBusinessEmail && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Code will be sent to: <span className="text-foreground font-medium">{fullBusinessEmail}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show selected claim email */}
                    {emailSource === "claim_email" && selectedClaimEmail && (
                      <div className="mb-5 p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <p className="text-sm font-medium">Verification email:</p>
                        <p className="text-lg font-bold text-primary">{selectedClaimEmail}</p>
                      </div>
                    )}

                    <Button 
                      onClick={handleSendVerification} 
                      className="w-full rounded-xl font-bold mb-5"
                      disabled={isSendingOtp || (emailSource === "domain" && !emailPrefix)}
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : otpSent ? (
                        "Resend Code"
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Verification Code
                        </>
                      )}
                    </Button>

                    {otpSent && (
                      <div className="space-y-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <Label htmlFor="code" className="font-bold">Enter 6-digit code:</Label>
                        <Input
                          id="code"
                          placeholder="000000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="h-12 rounded-xl text-center text-2xl tracking-widest"
                          maxLength={6}
                        />
                        <Button
                          onClick={handleVerify}
                          disabled={verificationCode.length !== 6 || isVerifying}
                          className="w-full rounded-xl font-bold"
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Verify & Claim
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    <button
                      onClick={() => setStep("manual-form")}
                      className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Don't have access to website email? Request manual review
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Manual Review Form */}
            {step === "manual-form" && selectedClinic && (
              <div className="card-modern p-6 md:p-8">
                <button
                  onClick={handleBack}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
                >
                  ← Back
                </button>

                <div className="flex items-start gap-4 mb-6 p-4 rounded-xl bg-muted/50">
                  <Building2 className="h-8 w-8 text-amber-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold">{selectedClinic.name}</h3>
                    <Badge variant="outline" className="text-xs mt-1">Manual Review</Badge>
                  </div>
                </div>

                <h2 className="font-display text-xl font-bold mb-2">Request Manual Review</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Submit your details and our team will contact you to verify your ownership.
                </p>

                {!user ? (
                  <div className="text-center py-6 bg-muted/30 rounded-xl">
                    <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Please sign in to submit a request</p>
                    <Button asChild className="rounded-xl font-bold">
                      <Link to="/auth?redirect=/claim-profile">Sign In to Continue</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="font-bold">Your Full Name *</Label>
                      <Input
                        id="name"
                        placeholder="Dr. John Smith"
                        value={manualForm.name}
                        onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                        className="mt-2 h-11 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email" className="font-bold">Your Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="doctor@email.com"
                        value={manualForm.email}
                        onChange={(e) => setManualForm(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-2 h-11 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone" className="font-bold">Your Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={manualForm.phone}
                        onChange={(e) => setManualForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="mt-2 h-11 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address" className="font-bold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Business Address
                      </Label>
                      <Input
                        id="address"
                        placeholder="123 Main St, City, State"
                        value={manualForm.address}
                        onChange={(e) => setManualForm(prev => ({ ...prev, address: e.target.value }))}
                        className="mt-2 h-11 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes" className="font-bold">Additional Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any information to help verify your ownership..."
                        value={manualForm.notes}
                        onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="mt-2 rounded-xl min-h-[80px]"
                      />
                    </div>

                    <Button
                      onClick={handleManualSubmit}
                      disabled={isSubmitting || !manualForm.name || !manualForm.email || !manualForm.phone}
                      className="w-full rounded-xl font-bold h-11"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Submit Claim Request
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>What happens next?</strong> Our team will review your request and contact you within 24-48 hours.
                  </p>
                </div>
              </div>
            )}

            {/* Success - OTP Verified */}
            {step === "success" && (
              <div className="card-modern p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-2">Profile Claimed!</h2>
                <p className="text-muted-foreground mb-6">
                  You can now manage your profile from the dashboard.
                </p>
                <div className="flex flex-col gap-3">
                  <Button asChild className="rounded-xl font-bold">
                    <Link to="/dashboard?tab=my-dashboard">Go to Dashboard</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl font-bold">
                    <Link to={`/clinic/${selectedClinic?.slug}`}>View Your Profile</Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Success - Manual Review Submitted */}
            {step === "submitted" && (
              <div className="card-modern p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
                  <Clock className="h-8 w-8 text-amber-600" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-2">Request Submitted!</h2>
                <p className="text-muted-foreground mb-6">
                  Your claim for <strong>{selectedClinic?.name}</strong> is under review. We'll contact you within 24-48 hours.
                </p>
                <div className="flex flex-col gap-3">
                  <Button asChild className="rounded-xl font-bold">
                    <Link to="/">Return Home</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl font-bold">
                    <Link to={`/clinic/${selectedClinic?.slug}`}>View Clinic Profile</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right - Benefits (2 cols) */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <h2 className="font-display text-lg font-bold mb-4">Why Claim Your Profile?</h2>
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

              {/* Trust Section */}
              <div className="mt-5 p-4 rounded-xl bg-muted/50">
                <h3 className="font-bold text-sm mb-3">Trusted by 500+ Clinics</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-display text-xl font-bold text-primary">500+</p>
                    <p className="text-[10px] text-muted-foreground">Clinics</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold text-primary">50K+</p>
                    <p className="text-[10px] text-muted-foreground">Patients</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold text-primary">4.9</p>
                    <p className="text-[10px] text-muted-foreground">Rating</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
};

export default ClaimProfilePage;
