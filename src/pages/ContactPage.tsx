import { useState } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/seo/SEOHead";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { z } from "zod";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  MessageSquare,
  Building2,
  Globe,
  Headphones,
  CalendarCheck,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  CheckCircle,
  User,
  Stethoscope
} from "lucide-react";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional().or(z.literal("")),
  subject: z.string().trim().min(2, "Subject is required").max(200, "Subject must be less than 200 characters"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message must be less than 2000 characters"),
});

const ContactPage = () => {
  const { toast } = useToast();
  const { data: siteSettings, isLoading } = useSiteSettings();
  const { data: seoContent } = useSeoPageContent("contact");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userType, setUserType] = useState<'patient' | 'dentist'>('patient');
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    practiceName: "", // For dentists only
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      contactSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const messageContent = userType === 'dentist' 
        ? `[DENTIST INQUIRY]\nPractice: ${formData.practiceName || 'Not specified'}\nSubject: ${formData.subject}\n\n${formData.message}`
        : `[PATIENT INQUIRY]\nSubject: ${formData.subject}\n\n${formData.message}`;

      const { error } = await supabase.from("leads").insert({
        patient_name: formData.name,
        patient_email: formData.email,
        patient_phone: formData.phone || "N/A",
        message: messageContent,
        source: `contact-form-${userType}`,
        status: "new",
      });

      if (error) throw error;

      toast({
        title: "Message Sent!",
        description: "Thank you for contacting us. We'll get back to you within 24 hours.",
      });

      setFormData({ name: "", email: "", phone: "", subject: "", message: "", practiceName: "" });
    } catch (error) {
      toast({
        title: "Failed to send",
        description: "There was an error sending your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get contact details from admin settings - all data comes from Contact Details tab
  const contactDetails = siteSettings?.contactDetails;
  const supportEmail = contactDetails?.support_email || '';
  const supportPhone = contactDetails?.support_phone || '';
  const bookingPhone = contactDetails?.booking_phone || supportPhone;
  const bookingEmail = contactDetails?.booking_email || supportEmail;
  const salesPhone = contactDetails?.sales_phone || supportPhone;
  const salesEmail = contactDetails?.sales_email || contactDetails?.partnerships_email || supportEmail;

  // Build address from settings
  const addressParts = [];
  if (contactDetails?.address_line1) addressParts.push(contactDetails.address_line1);
  if (contactDetails?.address_line2) addressParts.push(contactDetails.address_line2);
  if (contactDetails?.city) addressParts.push(contactDetails.city);
  if (contactDetails?.state) addressParts.push(contactDetails.state);
  if (contactDetails?.zip_code) addressParts.push(contactDetails.zip_code);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;
  const country = contactDetails?.country || 'United States';

  // Contact departments - using values from Contact Details tab in admin
  const departments = [
    { 
      icon: Headphones, 
      title: "General Support", 
      description: "Questions about using AppointPanda",
      phone: supportPhone,
      email: supportEmail,
      color: "from-primary/20 to-teal/10"
    },
    { 
      icon: CalendarCheck, 
      title: "Booking Assistance", 
      description: "Help with appointments",
      phone: bookingPhone,
      email: bookingEmail,
      color: "from-gold/20 to-amber-500/10"
    },
    { 
      icon: ShoppingBag, 
      title: "Sales & Partnerships", 
      description: "Business inquiries",
      phone: salesPhone,
      email: salesEmail,
      color: "from-purple/20 to-indigo-500/10"
    },
  ];

  const features = [
    "24-hour response time",
    "Dedicated support team",
    "Multi-channel assistance",
    "Expert guidance"
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || "Contact Us | Get in Touch with AppointPanda"}
        description={seoContent?.meta_description || "Have questions about finding a dentist or listing your practice? Contact the AppointPanda team. We're here to help with dental appointments and practice listings."}
        canonical="/contact/"
        keywords={['contact appointpanda', 'dental help', 'dentist questions', 'dental support']}
      />

      {/* Dark Hero Section */}
      <section className="relative bg-dark-section text-dark-section-foreground overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple/10 rounded-full blur-3xl" />
        
        <div className="container relative py-20 md:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">We're Here to Help</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-6">
              Get in{" "}
              <span className="text-gradient">Touch</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-dark-section-foreground/70 max-w-2xl mx-auto mb-8">
              Have questions about finding a dentist or listing your practice? Our team is ready to assist you.
            </p>

            {/* Quick Contact Stats */}
            <div className="flex flex-wrap justify-center gap-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Departments - Elevated Cards */}
      <Section size="lg" className="-mt-10 relative z-20">
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {departments.map((dept, i) => (
            <div 
              key={i} 
              className="card-modern p-8 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${dept.color} flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform`}>
                <dept.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">{dept.title}</h3>
              <p className="text-sm text-muted-foreground mb-5">{dept.description}</p>
              <div className="space-y-3">
                <a 
                  href={`tel:${dept.phone.replace(/[^\d+]/g, '')}`} 
                  className="flex items-center justify-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {dept.phone}
                </a>
                <a 
                  href={`mailto:${dept.email}`} 
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  {dept.email}
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6 md:gap-8">
          {/* Contact Form - Takes more space */}
          <div className="lg:col-span-3">
            <div className="card-modern p-5 md:p-8 shadow-elevated">
              {/* User Type Toggle */}
              <div className="flex items-center justify-center gap-2 p-1 bg-muted/50 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => setUserType('patient')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                    userType === 'patient' 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <User className="h-4 w-4" />
                  I'm a Patient
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('dentist')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                    userType === 'dentist' 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Stethoscope className="h-4 w-4" />
                  I'm a Dentist
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${
                  userType === 'patient' 
                    ? 'bg-gradient-to-br from-primary/20 to-teal/10' 
                    : 'bg-gradient-to-br from-purple/20 to-indigo-500/10'
                }`}>
                  {userType === 'patient' ? (
                    <Send className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                  ) : (
                    <Building2 className="h-6 w-6 md:h-7 md:w-7 text-purple" />
                  )}
                </div>
                <div>
                  <h2 className="font-display text-xl md:text-2xl font-bold">
                    {userType === 'patient' ? 'Patient Inquiry' : 'Dentist Inquiry'}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {userType === 'patient' 
                      ? 'Questions about finding a dentist or booking?' 
                      : 'Interested in listing your practice?'
                    }
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="font-bold text-sm">Your Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder={userType === 'patient' ? "John Doe" : "Dr. John Smith"}
                      value={formData.name}
                      onChange={handleChange}
                      className={`mt-2 h-11 md:h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary ${errors.name ? "border-destructive" : ""}`}
                    />
                    {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="email" className="font-bold text-sm">Email Address *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={userType === 'patient' ? "john@example.com" : "doctor@practice.com"}
                      value={formData.email}
                      onChange={handleChange}
                      className={`mt-2 h-11 md:h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary ${errors.email ? "border-destructive" : ""}`}
                    />
                    {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone" className="font-bold text-sm">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={handleChange}
                      className="mt-2 h-11 md:h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary"
                    />
                  </div>
                  {userType === 'dentist' ? (
                    <div>
                      <Label htmlFor="practiceName" className="font-bold text-sm">Practice Name</Label>
                      <Input
                        id="practiceName"
                        name="practiceName"
                        placeholder="Smile Dental Care"
                        value={formData.practiceName}
                        onChange={handleChange}
                        className="mt-2 h-11 md:h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="subject" className="font-bold text-sm">Subject *</Label>
                      <Input
                        id="subject"
                        name="subject"
                        placeholder="How can we help?"
                        value={formData.subject}
                        onChange={handleChange}
                        className={`mt-2 h-11 md:h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary ${errors.subject ? "border-destructive" : ""}`}
                      />
                      {errors.subject && <p className="text-sm text-destructive mt-1">{errors.subject}</p>}
                    </div>
                  )}
                </div>

                {userType === 'dentist' && (
                  <div>
                    <Label htmlFor="subject" className="font-bold text-sm">Subject *</Label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="Listing my practice, Partnership inquiry..."
                      value={formData.subject}
                      onChange={handleChange}
                      className={`mt-2 h-11 md:h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary ${errors.subject ? "border-destructive" : ""}`}
                    />
                    {errors.subject && <p className="text-sm text-destructive mt-1">{errors.subject}</p>}
                  </div>
                )}

                <div>
                  <Label htmlFor="message" className="font-bold text-sm">Message *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder={userType === 'patient' 
                      ? "Tell us how we can help you find the right dentist..."
                      : "Tell us about your practice and how we can help..."
                    }
                    value={formData.message}
                    onChange={handleChange}
                    className={`mt-2 rounded-xl min-h-[120px] md:min-h-[140px] bg-muted/50 border-border/50 focus:border-primary ${errors.message ? "border-destructive" : ""}`}
                  />
                  {errors.message && <p className="text-sm text-destructive mt-1">{errors.message}</p>}
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full rounded-2xl font-bold shadow-glow h-12" size="lg">
                  {isSubmitting ? "Sending..." : "Send Message"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Contact Info */}
            <div className="card-modern p-6 shadow-elevated">
              <h3 className="font-display font-bold text-lg mb-5 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Contact Information
              </h3>
              <div className="space-y-1">
                <a 
                  href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} 
                  className="flex items-start gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-teal/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Phone</p>
                    <p className="font-bold text-lg">{supportPhone}</p>
                  </div>
                </a>

                <a 
                  href={`mailto:${supportEmail}`} 
                  className="flex items-start gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold/20 to-amber-500/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Mail className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Email</p>
                    <p className="font-bold">{supportEmail}</p>
                  </div>
                </a>

                <div className="flex items-start gap-4 p-4 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-coral/20 to-pink/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-coral" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Location</p>
                    <p className="font-bold">{country}</p>
                    {fullAddress && <p className="text-sm text-muted-foreground mt-1">{fullAddress}</p>}
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple/20 to-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Business Hours</p>
                    <p className="font-bold">Mon - Fri: 9AM - 6PM EST</p>
                    <p className="text-sm text-muted-foreground mt-1">Weekend support available</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="card-modern p-6 bg-gradient-to-br from-primary/5 via-transparent to-teal/5 border-primary/10">
              <h3 className="font-display font-bold mb-5">Quick Links</h3>
              <div className="space-y-2">
                <Link to="/faq" className="flex items-center gap-3 p-3 rounded-xl hover:bg-background transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <MessageSquare className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="font-semibold">Frequently Asked Questions</span>
                </Link>
                <Link to="/list-your-practice" className="flex items-center gap-3 p-3 rounded-xl hover:bg-background transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="font-semibold">List Your Practice</span>
                </Link>
                <Link to="/claim-profile" className="flex items-center gap-3 p-3 rounded-xl hover:bg-background transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Globe className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="font-semibold">Claim Your Profile</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section variant="dark" size="md">
        <div className="text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-dark-section-foreground">
            Looking for a Dentist?
          </h2>
          <p className="text-dark-section-foreground/70 mb-8 max-w-xl mx-auto">
            Browse our directory of verified dental professionals across the United States.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="rounded-2xl font-bold shadow-glow">
              <Link to="/search">
                Find a Dentist
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl font-bold border-white/40 text-white bg-white/10 hover:bg-white/20">
              <Link to="/list-your-practice">List Your Practice</Link>
            </Button>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
};

export default ContactPage;