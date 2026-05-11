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
        {
          q: "How much does a dental cleaning cost?",
          a: "The average dental cleaning costs between $75-$200 depending on your location and the complexity of the cleaning. Regular cleanings are typically covered by insurance, and many clinics on AppointPanda offer affordable pricing for uninsured patients."
        },
        {
          q: "Does insurance cover braces?",
          a: "Many dental insurance plans offer partial coverage for orthodontic treatment, especially for patients under 18. Coverage typically ranges from 25-50% with a lifetime maximum. Contact your insurance provider to understand your specific benefits."
        },
        {
          q: "What's the average cost of dental implants?",
          a: "Dental implants typically cost $1,500-$6,000 per tooth, depending on the location, materials used, and complexity of the procedure. Many clinics offer payment plans, and some insurance plans provide partial coverage for implants."
        },
        {
          q: "How do I know if my insurance is accepted?",
          a: "Each dentist profile on AppointPanda lists the insurance plans they accept. You can also contact the clinic directly before booking to verify your specific insurance is accepted and understand your coverage details."
        },
        {
          q: "What insurance plans do you accept?",
          a: "Accepted insurance varies by clinic. Common plans include Delta Dental, Cigna, Aetna, MetLife, and many others. Use our filter to find dentists who accept your specific insurance provider."
        },
        {
          q: "What should I bring to my first appointment?",
          a: "Bring a valid photo ID, your insurance card, a list of current medications, and any relevant medical records. Arrive 15 minutes early to complete paperwork. If you have dental X-rays from another provider, bring those as well."
        },
        {
          q: "How long does a dental exam take?",
          a: "A comprehensive dental exam typically takes 30-60 minutes. This includes a visual examination, X-rays if needed, gum assessment, and discussion of treatment options. Routine check-ups are usually shorter, around 15-20 minutes."
        },
        {
          q: "What qualifies as a dental emergency?",
          a: "Dental emergencies include severe tooth pain, knocked-out teeth, broken teeth, swelling or infection, bleeding that won't stop, and trauma to the mouth. If you experience any of these, contact a dentist immediately or visit an emergency room."
        },
        {
          q: "What should I do if I have a dental emergency?",
          a: "Call your dentist immediately—many reserve time for emergencies. For knocked-out teeth, keep the tooth moist in milk or saliva. For severe pain, over-the-counter pain relievers can help until you reach a dental professional."
        },
        {
          q: "Does teeth whitening damage enamel?",
          a: "Professional teeth whitening is safe when done correctly. Over-the-counter products used excessively can cause sensitivity or damage enamel. Professional treatments from licensed dentists use controlled whitening agents that are safe for your teeth."
        },
        {
          q: "How long do dental crowns last?",
          a: "Dental crowns typically last 10-15 years with proper care. Good oral hygiene, avoiding hard foods, and regular dental check-ups can extend the life of your crown. Some crowns can last 20+ years with excellent maintenance."
        },
        {
          q: "Can I book an appointment for someone else?",
          a: "Yes, you can book an appointment for a family member or dependent. You'll need to provide their contact information and details. The clinic may require the patient's consent or presence for certain treatments."
        },
        {
          q: "How far in advance can I book?",
          a: "Most clinics accept appointments 2-4 weeks in advance, though some offer same-day or next-day availability. For specialty procedures, you may need to book further in advance. Check individual clinic profiles for their scheduling policies."
        },
        {
          q: "Do you offer pediatric dentistry?",
          a: "Yes, many dentists on AppointPanda specialize in pediatric dentistry and treat children of all ages. Look for dentists with pediatric specialty or experience in our search filters to find the right provider for your child."
        },
        {
          q: "What is the difference between a general dentist and a specialist?",
          a: "General dentists provide routine care like cleanings, fillings, and extractions. Specialists have additional training in areas like orthodontics, periodontics, or oral surgery. Your general dentist can refer you to a specialist if needed."
        },
        {
          q: "How often should I visit the dentist?",
          a: "Most patients should visit the dentist every 6 months for routine cleanings and check-ups. Your dentist may recommend more frequent visits if you have gum disease, cavities, or other dental issues that require monitoring."
        },
        {
          q: "What if I have dental anxiety?",
          a: "Many dentists offer sedation options for anxious patients, including nitrous oxide (laughing gas), oral sedation, or IV sedation. Communicate your concerns when booking—dentists are experienced in helping patients feel comfortable."
        },
        {
          q: "Can I get a second opinion on treatment recommendations?",
          a: "Absolutely! Getting a second opinion is common and often recommended for major procedures. Use AppointPanda to consult with another qualified dentist to compare treatment options and costs before making a decision."
        },
        {
          q: "What payment options are available?",
          a: "Most clinics accept cash, credit cards, and payment plans. Many offer in-house financing or work with third-party financing companies like CareCredit. Some also provide discounts for upfront payment or family packages."
        },
        {
          q: "Do you offer telemedicine consultations?",
          a: "Some dentists on AppointPanda offer virtual consultations for initial assessments, follow-ups, and minor concerns. During your video consultation, the dentist can evaluate your symptoms and determine if an in-person visit is needed."
        },
        {
          q: "What should I do if I have a toothache?",
          a: "Rinse your mouth with warm water and floss gently to remove any trapped food. Apply a cold compress to reduce swelling and take over-the-counter pain relievers. Contact a dentist promptly—tooth pain often indicates an infection that needs treatment."
        },
        {
          q: "How can I improve my oral hygiene at home?",
          a: "Brush twice daily for two minutes, floss daily, use mouthwash, and maintain a balanced diet. Replace your toothbrush every 3 months, and avoid smoking. Regular dental check-ups help catch problems early before they become serious."
        },
        {
          q: "What are the signs of gum disease?",
          a: "Signs include red, swollen, or tender gums, bleeding when brushing, receding gums, persistent bad breath, loose teeth, and changes in your bite. Early-stage gum disease (gingivitis) is reversible with proper treatment and good oral hygiene."
        },
        {
          q: "Are dental X-rays safe?",
          a: "Modern dental X-rays use very low radiation levels and are considered safe. Digital X-rays reduce exposure even further. Dentists recommend X-rays to detect problems that aren't visible during a visual exam, typically every 1-2 years."
        },
        {
          q: "What causes tooth sensitivity?",
          a: "Tooth sensitivity can result from worn enamel, exposed roots, cavities, gum disease, or cracked teeth. Using desensitizing toothpaste, avoiding acidic foods, and treating the underlying cause can help reduce sensitivity. Consult your dentist for proper diagnosis."
        },
        {
          q: "How much do braces cost?",
          a: "Traditional braces range from $3,000-$7,000, while clear aligners like Invisalign cost $3,500-$8,000. Costs vary based on treatment complexity and location. Many clinics offer payment plans, and insurance may cover a portion of orthodontic treatment."
        },
        {
          q: "What is the best way to whiten my teeth?",
          a: "Professional in-office whitening provides the fastest results, while take-home professional kits offer gradual whitening. Over-the-counter products are available but are less effective. Consult your dentist to determine the best option for your teeth."
        },
        {
          q: "How long does orthodontic treatment take?",
          a: "Treatment time varies based on the complexity of your case. Minor adjustments may take 6 months, while comprehensive treatment typically takes 18-24 months. Your orthodontist will provide an estimated timeline after your initial consultation."
        },
        {
          q: "Do you extract wisdom teeth?",
          a: "Most general dentists perform wisdom tooth extractions, while complex cases may be referred to an oral surgeon. Your dentist will evaluate your wisdom teeth with X-rays and recommend the best approach for removal if necessary."
        },
        {
          q: "What is a root canal?",
          a: "A root canal is a treatment to save a severely infected or damaged tooth. The procedure removes the infected pulp, cleans the inside of the tooth, and seals it. With proper care, a root-canaled tooth can last a lifetime."
        },
        {
          q: "How much does a cavity filling cost?",
          a: "Fillings cost $100-$400 depending on the material used (amalgam vs. composite) and the size of the cavity. Insurance typically covers a portion of the cost. Many clinics offer affordable options for uninsured patients."
        },
        {
          q: "What is periodontal treatment?",
          a: "Periodontal treatment addresses gum disease and may include deep cleaning (scaling and root planing), antibiotic therapy, or surgery for advanced cases. Early treatment prevents tooth loss and improves overall oral health."
        },
        {
          q: "Can I change dentists after starting treatment?",
          a: "Yes, you can switch dentists at any time. Request your dental records from your current dentist to share with your new provider. Your new dentist will evaluate your treatment progress and continue or adjust your care plan."
        },
        {
          q: "What happens if I miss my appointment?",
          a: "Most clinics have a 24-hour cancellation policy. Missing an appointment may result in a no-show fee or loss of your deposit. Contact the clinic as soon as possible if you need to reschedule to avoid charges."
        }
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
        {
          q: "How do I claim my profile?",
          a: "Search for your clinic on our platform and click the 'Claim This Profile' button. You'll need to verify your ownership through email or phone verification. Once claimed, you can update all information and access the dashboard."
        },
        {
          q: "Can I update my clinic photos?",
          a: "Yes, verified profiles can upload and manage their clinic photos. Add photos of your office, equipment, and team to help patients get familiar with your practice. High-quality images can increase patient trust and booking rates."
        },
        {
          q: "How do I respond to patient reviews?",
          a: "Verified clinics can respond to reviews through their dashboard. Professional responses to both positive and negative reviews show you value patient feedback. Address concerns professionally and offer to resolve issues offline when appropriate."
        },
        {
          q: "Can I remove fake reviews?",
          a: "If you believe a review violates our guidelines (spam, fake, or inappropriate content), you can flag it for review by our moderation team. We'll investigate and remove content that violates our terms of service."
        },
        {
          q: "How does the booking system work?",
          a: "Patients can request appointments through your profile, and you'll receive notifications in your dashboard. You can configure availability, set response times, and integrate with your existing calendar system for seamless scheduling."
        },
        {
          q: "Can I offer telemedicine consultations?",
          a: "Yes, you can enable telemedicine consultations in your profile settings. Virtual appointments are great for initial consultations, follow-ups, and minor concerns. You'll need to comply with telehealth regulations in your state."
        },
        {
          q: "How can I get more patient leads?",
          a: "Verified profiles rank higher in search results and attract more inquiries. Optimize your profile with complete information, photos, and positive reviews. Respond quickly to patient inquiries and use our marketing tools to increase visibility."
        },
        {
          q: "What marketing tools are available?",
          a: "We offer promotional tools including featured listings, targeted advertising, and practice highlight posts. You can also access patient demographics and booking analytics to optimize your marketing strategy."
        },
        {
          q: "How do I update my business hours?",
          a: "Update your business hours through your clinic dashboard. Accurate hours help patients know when you're available and can improve your search ranking for local searches. Remember to update holiday hours as well."
        },
        {
          q: "Can I add team members to my account?",
          a: "Yes, verified clinics can add team members with different access levels. You can assign roles like administrator, front desk, or dentist to manage who can view and edit your profile information."
        },
        {
          q: "How do I handle appointment requests?",
          a: "You'll receive notifications for new appointment requests via email and SMS. Review the patient's information in your dashboard and either accept, decline, or propose an alternative time. Some clinics enable auto-acceptance for quick bookings."
        },
        {
          q: "What analytics are available?",
          a: "Your dashboard provides insights including profile views, appointment requests, patient demographics, and review trends. Use this data to understand patient behavior and optimize your practice's visibility on the platform."
        },
        {
          q: "How do I add my specializations?",
          a: "In your dashboard, you can select specializations and services your clinic offers, such as orthodontics, implants, or cosmetic dentistry. This helps you appear in relevant patient searches and attract the right patients."
        },
        {
          q: "Can I export my patient leads?",
          a: "Yes, you can export patient inquiry data including names, contact information, and appointment details. This helps you integrate leads into your CRM or follow up with patients through your existing systems."
        },
        {
          q: "How do I update my insurance accepted list?",
          a: "Edit your insurance accepted list in your profile settings. Keep this current to attract patients with insurance and reduce inquiry friction. Patients often filter searches by accepted insurance."
        },
        {
          q: "What happens if I receive a negative review?",
          a: "Negative reviews happen—respond professionally and politely. Thank the patient for feedback, apologize for their experience, and offer to discuss the matter offline. Potential patients see how you handle criticism."
        },
        {
          q: "How can I improve my profile visibility?",
          a: "Complete all profile fields, add photos, maintain positive reviews, and use relevant keywords in your description. Responding quickly to patient inquiries also improves your ranking in our search algorithm."
        },
        {
          q: "Do you offer custom branding options?",
          a: "Verified clinics can customize their profile with logos, brand colors, and custom content sections. This helps your practice stand out and create a consistent brand experience for patients visiting your profile."
        },
        {
          q: "How do I integrate with my existing website?",
          a: "Add a link to your existing website in your profile. You can also use our booking widget on your site to enable seamless patient scheduling. Contact our support for technical integration assistance."
        },
        {
          q: "What support is available for clinics?",
          a: "We provide dedicated support via email, phone, and live chat. Verified clinics also get access to a dedicated account manager who can help optimize your profile and marketing strategy."
        }
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
        {
          q: "Is AppointPanda free for patients?",
          a: "Yes, AppointPanda is completely free for patients. You can search for dentists, read reviews, book appointments, and use all features at no cost. We make money through verified clinic subscriptions, not from patients."
        },
        {
          q: "How do you verify dentists?",
          a: "Our verification process checks dental licenses through state databases, verifies clinic credentials, and confirms business addresses. We also review certifications and quality standards before granting the verified badge."
        },
        {
          q: "Is AppointPanda available in [my city]?",
          a: "We currently cover major metropolitan areas and are rapidly expanding to more locations. Search for your city on our platform to see available dentists. If there are none yet, we encourage you to suggest clinics to add."
        },
        {
          q: "What areas do you cover?",
          a: "We cover dental practices across the United States, with strong presence in major cities. Our network includes over 6,600+ dental practices. Check our search to see clinics in your specific area."
        },
        {
          q: "Is my data secure?",
          a: "Yes, we use industry-standard encryption to protect your data. All information is stored securely and we comply with data protection regulations. We never sell or share your personal data with third parties."
        },
        {
          q: "Is your platform HIPAA compliant?",
          a: "Yes, AppointPanda is designed to comply with HIPAA requirements for healthcare data. We implement appropriate administrative, physical, and technical safeguards to protect patient information."
        },
        {
          q: "How can I contact customer support?",
          a: "You can reach us by email at support@appointpanda.com, call us at +1 833-887-2632, or use the contact form on our website. Our support team is available Monday through Friday during business hours."
        },
        {
          q: "What makes AppointPanda different from other dental directories?",
          a: "We offer verified dentist profiles, transparent reviews, and a free platform for patients. Our focus on quality assurance and responsive support makes us different. We also provide marketing tools specifically for dental practices."
        },
        {
          q: "Do you have a mobile app?",
          a: "Our website is fully responsive and works great on mobile devices. You can search for dentists, read reviews, and book appointments directly from your phone's browser without needing a separate app."
        },
        {
          q: "How do I update my contact information?",
          a: "Log into your account and navigate to settings to update your contact information. If you're a clinic, use your dashboard to update business details, phone numbers, and email addresses."
        },
        {
          q: "What languages are supported?",
          a: "Our platform is primarily in English. Some dentist profiles may include additional language information to help you find providers who speak other languages. Contact the clinic directly for language options."
        },
        {
          q: "How do I subscribe to your newsletter?",
          a: "Enter your email in the newsletter signup form on our homepage or in your account settings. Receive updates on dental health tips, new features, and dental industry news."
        }
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
            question: faq.q,
            answer: faq.a,
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
