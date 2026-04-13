import { Link } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { useRealCounts } from "@/hooks/useRealCounts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MessageSquare, ArrowRight, Sparkles, Search, Building2, HelpCircle, Users, Shield, Phone } from "lucide-react";

const FAQPage = () => {
  const { data: siteSettings } = useSiteSettings();
  const { data: counts } = useRealCounts();
  const { data: seoContent } = useSeoPageContent("faq");
  const supportEmail = siteSettings?.contactDetails?.support_email || 'support@appointpanda.com';
  const supportPhone = siteSettings?.contactDetails?.support_phone || '+1 833-887-2632';

  const categories = [
    {
      icon: Users,
      title: "For Patients",
      color: "from-primary/20 to-teal/10",
      faqs: [
        {
          q: "How do I find a dentist on AppointPanda?",
          a: "Use our search feature to find dentists by location, specialty, or treatment type. You can filter results by ratings, verified status, and availability. Each dentist profile includes reviews, qualifications, and contact information."
        },
        {
          q: "Are the dentists on AppointPanda verified?",
          a: "All dentists listed on AppointPanda are licensed professionals. Clinics and dentists with the 'Verified' badge have completed our additional verification process, which includes license verification and quality checks."
        },
        {
          q: "How do I book an appointment?",
          a: "You can request an appointment directly through a clinic or dentist's profile page. Fill out the booking form with your preferred date and time, and the clinic will contact you to confirm. Some clinics also offer instant booking."
        },
        {
          q: "Is it free to use AppointPanda?",
          a: "Yes, AppointPanda is completely free for patients. You can search for dentists, read reviews, and request appointments without any charges."
        },
        {
          q: "How do I leave a review for a dentist?",
          a: "After visiting a clinic, you can leave a review on their profile page. Reviews are moderated to ensure they are genuine and helpful for other patients. You may need to verify your visit before your review is published."
        },
      ]
    },
    {
      icon: Building2,
      title: "For Dentists & Clinics",
      color: "from-gold/20 to-amber-500/10",
      faqs: [
        {
          q: "How do I list my clinic on AppointPanda?",
          a: "Visit our 'List Your Practice' page and fill out the registration form. Our team will review your submission and contact you within 24-48 hours. Basic listings are free, and you can upgrade to a verified profile for premium features."
        },
        {
          q: "What are the benefits of verification?",
          a: "Verified profiles receive a verification badge, higher search ranking, priority placement in search results, access to analytics dashboard, and the ability to respond to reviews. Verified clinics attract more patient inquiries."
        },
        {
          q: "How do I claim an existing profile?",
          a: "If your clinic is already listed, you can claim it through our 'Claim Profile' page. Search for your clinic, verify your ownership through email or phone OTP, and gain control of your profile to update information and respond to reviews."
        },
        {
          q: "How much does it cost to be listed?",
          a: "Basic listings are free. Verified listings start at $199/month and include premium features like priority ranking, analytics, and the verified badge. Contact our team for custom plans."
        },
        {
          q: "Can I manage multiple clinic locations?",
          a: "Yes, you can manage multiple clinic locations under one account. Each location will have its own profile page, and you can manage all of them from a single dashboard."
        },
      ]
    },
    {
      icon: HelpCircle,
      title: "General",
      color: "from-purple/20 to-indigo-500/10",
      faqs: [
        {
          q: "What areas does AppointPanda cover?",
          a: "AppointPanda currently covers dental practices across the United States. We're continuously expanding to include more locations and providers nationwide."
        },
        {
          q: "How do I report incorrect information?",
          a: `If you find incorrect information on any listing, please contact us through our Contact page or email us at ${supportEmail}. We take data accuracy seriously and will investigate and correct any errors.`
        },
        {
          q: "Is my personal information safe?",
          a: "Yes, we take data privacy seriously. Your personal information is encrypted and never shared with third parties without your consent. Read our Privacy Policy for more details."
        },
        {
          q: "How do I delete my account?",
          a: `To delete your account, please contact our support team at ${supportEmail}. We'll process your request within 48 hours and confirm once your account has been deleted.`
        },
      ]
    }
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || "FAQ | Frequently Asked Questions About AppointPanda"}
        description={seoContent?.meta_description || "Find answers to common questions about AppointPanda. Learn how to find dentists, book appointments, list your practice, and manage your dental profile."}
        canonical="/faq/"
        keywords={['dental FAQ', 'appointpanda help', 'find dentist questions', 'dental booking help']}
      />
      
      {/* SEO FIX: Add FAQPage structured data for Google */}
      <SyncStructuredData
        data={{
          type: 'faq',
          questions: categories.flatMap((cat: any) => (cat.faqs || []).map((faq: any) => ({
            question: faq.question,
            answer: faq.answer,
          }))),
        }}
      />

      {/* Dark Hero Section */}
      <section className="relative bg-dark-section text-dark-section-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">Help Center</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Frequently Asked{" "}
              <span className="text-gradient">Questions</span>
            </h1>
            
            <p className="text-lg text-dark-section-foreground/70 max-w-xl mx-auto mb-8">
              Find answers to common questions about finding dentists, booking appointments, and managing your practice.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <Building2 className="h-4 w-4 text-primary" />
                <span>{counts?.clinics?.toLocaleString() || "6,600+"}+ Practices</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <Shield className="h-4 w-4 text-gold" />
                <span>Verified Professionals</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <Users className="h-4 w-4 text-coral" />
                <span>Free for Patients</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Sections */}
      <Section size="lg">
        <div className="max-w-4xl mx-auto space-y-12">
          {categories.map((category, catIndex) => (
            <div key={catIndex} className="card-modern p-6 md:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center`}>
                  <category.icon className="h-7 w-7 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold">{category.title}</h2>
              </div>
              
              <Accordion type="single" collapsible className="w-full">
                {category.faqs.map((faq, faqIndex) => (
                  <AccordionItem key={faqIndex} value={`${catIndex}-${faqIndex}`} className="border-border/50">
                    <AccordionTrigger className="text-left font-bold hover:text-primary py-5">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </Section>

      {/* Still Have Questions CTA */}
      <Section variant="muted" size="lg">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
            Still Have Questions?
          </h2>
          <p className="text-muted-foreground mb-8">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="rounded-2xl font-bold">
              <Link to="/contact">
                Contact Support
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl font-bold">
              <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`}>
                <Phone className="mr-2 h-5 w-5" />
                Call Us
              </a>
            </Button>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section variant="dark" size="md">
        <div className="text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-dark-section-foreground">
            Ready to find your dentist?
          </h2>
          <p className="text-dark-section-foreground/70 mb-8 max-w-xl mx-auto">
            Join thousands of patients who've found their perfect dental care provider through AppointPanda.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="rounded-2xl font-bold shadow-glow">
              <Link to="/search">
                <Search className="mr-2 h-5 w-5" />
                Find a Dentist
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

export default FAQPage;
