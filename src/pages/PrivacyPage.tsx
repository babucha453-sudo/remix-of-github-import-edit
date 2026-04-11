import { Link } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SEOHead } from "@/components/seo/SEOHead";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { Shield, Sparkles, ArrowRight, Lock, Eye, Database, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPage = () => {
  const { data: siteSettings } = useSiteSettings();
  const { data: seoContent } = useSeoPageContent("privacy");
  const supportEmail = siteSettings?.contactDetails?.support_email || 'support@appointpanda.com';

  const sections = [
    {
      icon: Database,
      title: "1. Information We Collect",
      content: `We collect information you provide directly to us, such as when you create an account, submit a form, or contact us. This may include:

• Name and contact information (email, phone number)
• Account credentials
• Profile information for dentists and clinics
• Appointment requests and booking details
• Reviews and feedback you submit
• Communications with us

We also automatically collect certain information when you use our platform, including:

• Device information (browser type, operating system)
• Usage data (pages visited, time spent)
• IP address and location data
• Cookies and similar technologies`
    },
    {
      icon: Eye,
      title: "2. How We Use Your Information",
      content: `We use the information we collect to:

• Provide, maintain, and improve our services
• Process appointment requests and facilitate bookings
• Send you notifications about your appointments
• Respond to your comments, questions, and requests
• Send you marketing communications (with your consent)
• Monitor and analyze trends, usage, and activities
• Detect, investigate, and prevent fraudulent transactions
• Personalize your experience on our platform
• Comply with legal obligations`
    },
    {
      title: "3. Information Sharing",
      content: `We do not sell your personal information. We may share your information in the following circumstances:

• With dental clinics when you request an appointment
• With service providers who assist in our operations
• To comply with legal obligations
• To protect our rights and prevent fraud
• With your consent or at your direction

When you submit an appointment request, your contact information will be shared with the relevant clinic to facilitate the booking.`
    },
    {
      icon: Lock,
      title: "4. Data Security",
      content: `We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:

• Encryption of data in transit and at rest
• Regular security assessments
• Access controls and authentication
• Secure data storage practices

However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.`
    },
    {
      title: "5. Your Rights",
      content: `You have the following rights regarding your personal information:

• Access: Request a copy of the personal data we hold about you
• Correction: Request correction of inaccurate or incomplete data
• Deletion: Request deletion of your personal data
• Objection: Object to processing of your personal data
• Portability: Request transfer of your data to another service
• Withdrawal: Withdraw consent at any time

To exercise these rights, please contact us at ${supportEmail}.`
    },
    {
      title: "6. Cookies",
      content: `We use cookies and similar tracking technologies to collect and track information about your use of our platform. You can control cookies through your browser settings. For more information, please see our Cookie Policy.`
    },
    {
      title: "7. Third-Party Links",
      content: `Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies before providing any personal information.`
    },
    {
      title: "8. Children's Privacy",
      content: `Our services are not directed to children under 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.`
    },
    {
      title: "9. Changes to This Policy",
      content: `We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date. We encourage you to review this policy periodically.`
    },
    {
      title: "10. Contact Us",
      content: `If you have any questions about this Privacy Policy or our privacy practices, please contact us at:

AppointPanda
United States
Email: ${supportEmail}`
    }
  ];

  const highlights = [
    { icon: Shield, title: "Data Protection", description: "Your data is encrypted and secure" },
    { icon: Eye, title: "Transparency", description: "Clear about how we use data" },
    { icon: Lock, title: "Your Control", description: "Exercise your data rights anytime" },
  ];

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || "Privacy Policy | AppointPanda Data Protection"}
        description={seoContent?.meta_description || "Learn how AppointPanda collects, uses, and protects your personal information. Read our comprehensive privacy policy for patients and dental professionals."}
        canonical="/privacy/"
        keywords={['privacy policy', 'data protection', 'dental privacy', 'appointpanda privacy']}
      />

      {/* Dark Hero Section */}
      <section className="relative bg-dark-section text-dark-section-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">Your Privacy Matters</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Privacy{" "}
              <span className="text-gradient">Policy</span>
            </h1>
            
            <p className="text-lg text-dark-section-foreground/70 max-w-xl mx-auto mb-8">
              Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {highlights.map((item, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <item.icon className="h-6 w-6 text-primary mx-auto mb-2" />
                  <h3 className="font-bold text-sm">{item.title}</h3>
                  <p className="text-xs text-dark-section-foreground/60">{item.description}</p>
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
                <p className="text-sm text-muted-foreground">Committed to protecting your privacy</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-8 leading-relaxed p-4 rounded-xl bg-muted/50">
              AppointPanda ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>

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
              <p className="text-muted-foreground mb-4">Have questions about your privacy?</p>
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

export default PrivacyPage;
