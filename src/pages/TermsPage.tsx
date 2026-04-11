import { Link } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SEOHead } from "@/components/seo/SEOHead";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { FileText, Sparkles, ArrowRight, Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsPage = () => {
  const { data: siteSettings } = useSiteSettings();
  const { data: seoContent } = useSeoPageContent("terms");
  const supportEmail = siteSettings?.contactDetails?.support_email || 'support@appointpanda.com';

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: `By accessing or using AppointPanda ("the Platform"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.

These terms apply to all users of the Platform, including patients, dental professionals, and clinic administrators.`
    },
    {
      title: "2. Description of Services",
      content: `AppointPanda provides an online platform that connects patients with dental professionals across the United States. Our services include:

• Directory of dental clinics and professionals
• Clinic and dentist profile pages
• Appointment request functionality
• Patient reviews and ratings
• Information about dental services

We do not provide medical advice, diagnoses, or treatments. All medical decisions should be made in consultation with qualified healthcare professionals.`
    },
    {
      title: "3. User Accounts",
      content: `To access certain features, you may need to create an account. You agree to:

• Provide accurate and complete information
• Maintain the security of your account credentials
• Notify us immediately of any unauthorized access
• Be responsible for all activities under your account

We reserve the right to suspend or terminate accounts that violate these terms.`
    },
    {
      title: "4. For Patients",
      content: `As a patient using our Platform, you agree to:

• Provide accurate information when requesting appointments
• Respect the policies of dental clinics and professionals
• Submit honest and fair reviews based on actual experiences
• Not use the Platform for any unlawful purposes

We do not guarantee the availability of appointments or the quality of services provided by listed clinics.`
    },
    {
      title: "5. For Dental Professionals",
      content: `As a dental professional or clinic using our Platform, you agree to:

• Provide accurate and up-to-date information about your practice
• Maintain valid state licensing and credentials
• Respond to patient inquiries in a timely manner
• Comply with all applicable laws and regulations
• Not engage in false advertising or misleading practices

Verified listings are subject to additional terms and verification requirements.`
    },
    {
      title: "6. Intellectual Property",
      content: `All content on the Platform, including text, graphics, logos, and software, is the property of AppointPanda or its licensors and is protected by intellectual property laws.

You may not:
• Copy, modify, or distribute our content without permission
• Use our trademarks without authorization
• Reverse engineer or attempt to extract source code`
    },
    {
      title: "7. User Content",
      content: `You retain ownership of content you submit (reviews, photos, etc.), but grant us a license to use, display, and distribute such content on our Platform.

You represent that your content:
• Is accurate and not misleading
• Does not infringe on third-party rights
• Does not contain harmful or offensive material
• Complies with all applicable laws

We reserve the right to remove any content that violates these terms.`
    },
    {
      title: "8. Disclaimers",
      content: `THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE:

• The accuracy of information provided by clinics
• The availability or quality of dental services
• Uninterrupted access to the Platform
• That the Platform will be error-free

We are not responsible for any damages arising from your use of the Platform or reliance on information provided.`
    },
    {
      title: "9. Limitation of Liability",
      content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, APPOINTPANDA SHALL NOT BE LIABLE FOR:

• Indirect, incidental, or consequential damages
• Loss of profits, data, or business opportunities
• Damages arising from third-party services or content

Our total liability shall not exceed the amount you paid us in the past 12 months.`
    },
    {
      title: "10. Indemnification",
      content: `You agree to indemnify and hold harmless AppointPanda, its officers, directors, employees, and agents from any claims, damages, or expenses arising from:

• Your use of the Platform
• Your violation of these terms
• Your violation of any third-party rights`
    },
    {
      title: "11. Changes to Terms",
      content: `We may modify these terms at any time. We will notify you of material changes by posting on the Platform. Your continued use after changes constitutes acceptance of the new terms.`
    },
    {
      title: "12. Governing Law",
      content: `These terms are governed by the laws of the United States. Any disputes shall be resolved in accordance with applicable federal and state laws.`
    },
    {
      title: "13. Contact Information",
      content: `For questions about these terms, please contact us:

AppointPanda
United States
Email: ${supportEmail}`
    }
  ];

  const keyPoints = [
    "Free for patients to use",
    "Verified dental professionals only",
    "Your data is protected",
    "Right to remove content"
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || "Terms and Conditions | AppointPanda Service Agreement"}
        description={seoContent?.meta_description || "Read AppointPanda's terms and conditions. Understand the rules, policies, and guidelines for using our dental directory platform for patients and professionals."}
        canonical="/terms/"
        keywords={['terms and conditions', 'service agreement', 'dental directory terms', 'appointpanda terms']}
      />

      {/* Dark Hero Section */}
      <section className="relative bg-dark-section text-dark-section-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">Legal</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Terms &{" "}
              <span className="text-gradient">Conditions</span>
            </h1>
            
            <p className="text-lg text-dark-section-foreground/70 max-w-xl mx-auto mb-8">
              Please read these terms carefully before using AppointPanda. By using our platform, you agree to these terms.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {keyPoints.map((point, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Section size="lg">
        <div className="max-w-4xl mx-auto">
          <div className="card-modern p-8 md:p-12">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground">
                  <strong>Last Updated:</strong> January 2026
                </p>
                <p className="text-sm text-muted-foreground">Effective immediately for all users</p>
              </div>
            </div>

            <div className="space-y-8">
              {sections.map((section, i) => (
                <div key={i} className="group">
                  <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary font-bold">
                      {i + 1}
                    </span>
                    {section.title.replace(/^\d+\.\s*/, '')}
                  </h2>
                  <div className="text-muted-foreground leading-relaxed whitespace-pre-line pl-11">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t text-center">
              <p className="text-muted-foreground mb-4">Have questions about our terms?</p>
              <Button asChild variant="outline" className="rounded-2xl font-bold">
                <Link to="/contact">
                  Contact Us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
};

export default TermsPage;
