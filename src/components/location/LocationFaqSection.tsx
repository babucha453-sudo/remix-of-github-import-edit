import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, HelpCircle, ChevronDown, ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqItem {
  q: string;
  a: string;
}

interface LocationFaqSectionProps {
  cityName: string;
  stateAbbr: string;
  faqs: FaqItem[];
  variation: 'trust-first' | 'results-first' | 'experience-first';
}

const LOCAL_FAQS: Record<string, FaqItem[]> = {
  'los-angeles': [
    { q: 'How do I find a good dentist in LA?', a: 'Look for dentists with verified badges, high ratings, and those who specialize in the treatment you need. LA has many specialists including cosmetic dentists and orthodontists.' },
    { q: 'Are there emergency dentists in Los Angeles?', a: 'Yes, many LA dental clinics offer same-day emergency appointments. Look for clinics with "emergency" or "same-day" availability in their profile.' },
  ],
  'san-diego': [
    { q: 'What dental services are popular in San Diego?', a: 'San Diego residents often seek preventive care, teeth whitening, and pediatric dentistry. Many clinics offer family packages.' },
  ],
  'boston': [
    { q: 'How much do braces cost in Boston?', a: 'Traditional braces in Boston range from $3,000-6,000. Many orthodontists offer payment plans. Invisalign is also widely available.' },
  ],
};

export function LocationFaqSection({ cityName, stateAbbr, faqs, variation }: LocationFaqSectionProps) {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  
  const variationConfig = {
    'trust-first': { accent: 'emerald', layout: 'standard' },
    'results-first': { accent: 'blue', layout: 'compact' },
    'experience-first': { accent: 'amber', layout: 'expanded' },
  };
  
  const { accent, layout } = variationConfig[variation];
  const isCompact = layout === 'compact';
  const isExpanded = layout === 'expanded';
  
  const localFaqs = LOCAL_FAQS[cityName.toLowerCase().replace(/ /g, '-')];
  const displayFaqs = localFaqs ? [...faqs.slice(0, 2), ...localFaqs] : faqs;
  
  return (
    <section className="py-16 md:py-20 bg-slate-900">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className={`inline-flex items-center gap-2 bg-${accent}-500/20 border border-${accent}-500/30 rounded-full px-4 py-1.5 mb-4`}>
            <HelpCircle className={`h-4 w-4 text-${accent}-400`} />
            <span className={`text-sm font-semibold text-${accent}-300`}>Questions?</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Frequently Asked <span className={`text-${accent}-400`}>Questions</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Find answers about finding and booking dental appointments in {cityName}
          </p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {displayFaqs.slice(0, isExpanded ? 6 : 4).map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className={`
                bg-white/5 border border-white/10 rounded-2xl 
                data-[state=open]:border-${accent}-500/50 data-[state=open]:bg-white/10
                transition-colors
              `}
            >
              <AccordionTrigger className="text-left hover:no-underline px-5 py-4">
                <span className="flex items-start gap-3 text-left">
                  <span 
                    className={`
                      flex items-center justify-center w-6 h-6 rounded-full 
                      bg-${accent}-500/20 text-${accent}-400 text-sm font-bold shrink-0 mt-0.5
                    `}
                  >
                    {i + 1}
                  </span>
                  <span className={`font-semibold text-slate-100 hover:text-white text-base ${isCompact ? 'text-sm' : ''}`}>
                    {faq.q}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className={`px-5 pb-4 text-slate-300 leading-relaxed ${isCompact ? 'text-sm' : ''}`}>
                <div className="flex items-start gap-2 pl-9">
                  {faq.a}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-slate-400 mb-4">Still have questions?</p>
          <a 
            href="/contact" 
            className={`
              inline-flex items-center gap-2 px-6 py-3 
              bg-${accent}-500 hover:bg-${accent}-600 text-white font-bold rounded-xl 
              transition-colors
            `}
          >
            Contact Us
            <ArrowRight className="h-4 w-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

export default LocationFaqSection;