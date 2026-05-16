import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Scissors, Star, ShieldCheck, Palette, 
  Package, Clock, CheckCircle2, ArrowRight,
  Shirt, Stethoscope, Baby, Users, Briefcase,
  ChevronRight, Award, Truck, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/seo/SEOHead";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const industries = [
  {
    icon: Stethoscope,
    name: "Dental & Medical",
    desc: "Custom lab coats, scrubs, and uniforms for dental practices and medical offices. Professional appearance that inspires patient confidence.",
  },
  {
    icon: Baby,
    name: "Nursery & Childcare",
    desc: "Durable, comfortable attire for nursery and childcare staff. Easy-care fabrics that withstand daily use while maintaining a warm, approachable look.",
  },
  {
    icon: Users,
    name: "Corporate & Admin",
    desc: "Polished business wear and admin uniforms for front desk staff, managers, and support teams. Professional image for every role.",
  },
  {
    icon: Briefcase,
    name: "Specialized Roles",
    desc: "Custom garments for receptionists, assistants, hygienists, and specialists. Every role deserves clothing that fits the work.",
  },
];

const features = [
  { icon: Scissors, title: "Bespoke Tailoring", desc: "Every garment is crafted to your exact measurements for a perfect fit." },
  { icon: Palette, title: "Custom Design", desc: "Choose colors, fabrics, and styles that reflect your brand identity." },
  { icon: ShieldCheck, title: "Premium Quality", desc: "High-grade materials built to withstand daily professional use." },
  { icon: Truck, title: "Fast Delivery", desc: "Quick turnaround times with reliable shipping nationwide." },
  { icon: RefreshCw, title: "Easy Reorders", desc: "Reorder your uniform collection with a single click anytime." },
  { icon: Award, title: "Satisfaction Guarantee", desc: "Not happy? We'll make it right — every single time." },
];

const productTypes = [
  { name: "Lab Coats & Jackets", desc: "Professional lab coats with custom embroidery and sizing" },
  { name: "Scrubs & Tunics", desc: "Comfortable, durable scrubs in a range of colors and cuts" },
  { name: "Dresses & Skirts", desc: "Elegant, professional dresses for reception and admin roles" },
  { name: "Shirts & Blouses", desc: "Crisp, comfortable tops with custom branding options" },
  { name: "Trousers & Skirts", desc: "Coordinated bottoms in sizes from XS to 5XL" },
  { name: "Aprons & Smocks", desc: "Protective outerwear for clinical and service roles" },
];

const faqs = [
  {
    q: "What industries do you serve?",
    a: "We specialize in bespoke garments for dental practices, medical offices, nurseries, childcare centers, and corporate environments. If your team needs professional, tailored uniforms, we can help."
  },
  {
    q: "Can you match our existing uniform colors and branding?",
    a: "Yes. We work with your brand guidelines to create garments that match your existing colors, logos, and design aesthetic. Share your color codes or samples, and we'll match them precisely."
  },
  {
    q: "What is the minimum order quantity?",
    a: "We offer flexible MOQs starting at just 5 units per style. Whether you need uniforms for a small dental practice or a large nursery chain, we can accommodate your order size."
  },
  {
    q: "How long does production and delivery take?",
    a: "Standard production takes 2-3 weeks from design approval. Express options are available for urgent orders. We ship nationwide with tracking on every order."
  },
  {
    q: "Do you offer fitting and measurement services?",
    a: "Yes. We provide detailed measurement guides and can arrange virtual fittings for team orders. We also offer size exchange on all first orders to ensure every team member gets the right fit."
  },
  {
    q: "Can I reorder the same garments later?",
    a: "Absolutely. We keep your design files and measurements on record, making reorders fast and consistent. Just reach out and we'll have your garments produced and shipped within the same timeframe."
  },
];

const faqItems = faqs.map((f, i) => ({ id: i + 1, question: f.q, answer: f.a }));

export default function GarmentsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Bespoke Garments & Uniforms for Dental, Nursery & Professional Staff | AppointPanda"
        description="AppointPanda offers bespoke manufacturing of professional dresses, uniforms, and garments tailored for the dental industry, nurseries, and corporate staff. Custom design, premium quality, fast delivery."
        keywords={['bespoke uniforms', 'custom dental scrubs', 'nursery uniforms', 'professional garments', 'dental practice uniforms', 'custom tailoring', 'uniform manufacturing']}
      />

      <Navbar />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-emerald-500/20">
                <Shirt className="h-4 w-4" />
                Custom Manufacturing
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Bespoke Garments & <span className="text-emerald-400">Professional Uniforms</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
                We craft custom dresses, uniforms, and garments for dental practices, nurseries, and professional teams. Premium quality, tailored to your brand.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="h-14 px-10 font-bold rounded-full bg-emerald-500 hover:bg-emerald-600 text-lg" asChild>
                  <Link to="/contact">
                    Request a Quote
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-10 font-bold rounded-full border-slate-600 text-white hover:bg-slate-800 text-lg" asChild>
                  <Link to="/contact">
                    View Catalog
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Industries Served */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
              Industries We Serve
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              From dental practices to childcare centers, we create garments that fit your team's unique needs.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
              >
                <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{item.name}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Types */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
                What We Make
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto text-lg">
                A full range of professional garments, all custom-tailored to your specifications.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {productTypes.map((product, i) => (
                <motion.div
                  key={product.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-4 bg-white rounded-xl p-5 border border-slate-100 shadow-sm"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">{product.name}</h3>
                    <p className="text-sm text-slate-500">{product.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
              Why Choose Our Garments
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              We go beyond standard uniform manufacturing. Every garment is made with intention.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm"
              >
                <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 md:py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From first consultation to delivery, we make the process seamless.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { step: "1", title: "Consultation", desc: "Tell us your team's needs, sizes, colors, and branding." },
              { step: "2", title: "Design", desc: "We create mockups and fabric samples for your approval." },
              { step: "3", title: "Production", desc: "Your garments are crafted with precision and care." },
              { step: "4", title: "Delivery", desc: "We ship directly to your team with tracking on every order." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="h-14 w-14 bg-emerald-500 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-3">
              {faqItems.map((faq) => (
                <div key={faq.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    className="w-full text-left p-5 flex items-center justify-between gap-4"
                    onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                  >
                    <span className="font-bold text-slate-900">{faq.question}</span>
                    <ChevronRight className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform ${openFaq === faq.id ? 'rotate-90' : ''}`} />
                  </button>
                  {openFaq === faq.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="px-5 pb-5 text-sm text-slate-600 leading-relaxed"
                    >
                      {faq.answer}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-emerald-500 to-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Dress Your Team?
            </h2>
            <p className="text-emerald-100 mb-10 text-lg">
              Get in touch today for a free consultation and custom quote. No obligation, just a conversation about what your team needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button size="lg" className="h-14 px-10 font-bold rounded-full bg-white text-emerald-700 hover:bg-emerald-50 text-lg shadow-xl">
                  Get a Free Quote
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/about">
                <Button size="lg" variant="outline" className="h-14 px-10 font-bold rounded-full border-2 border-white/40 text-white hover:bg-white/10 text-lg">
                  Learn About Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}