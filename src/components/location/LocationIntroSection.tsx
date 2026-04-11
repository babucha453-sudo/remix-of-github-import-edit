import { motion } from "framer-motion";
import { Stethoscope, MapPin, Users, Star, Shield, Clock, Award } from "lucide-react";

interface LocationIntroSectionProps {
  cityName: string;
  stateAbbr: string;
  clinicCount: number;
  variation: 'trust-first' | 'results-first' | 'experience-first';
  content?: string | null;
  treatments?: { name: string; slug: string }[];
  stateSlug: string;
}

const LOCAL_CONTEXT: Record<string, string> = {
  'los-angeles': 'with its diverse population and focus on cosmetic dentistry',
  'san-diego': 'known for family-friendly dental practices and coastal conveniently',
  'san-francisco': 'with cutting-edge dental technology and specialty care',
  'boston': 'with world-class dental schools and advanced specialists',
  'new-york': 'with high-demand cosmetic and restorative dentistry',
  'chicago': 'with accessible family dental care',
  'houston': 'with affordable comprehensive dental services',
};

const DENTAL_TIPS: Record<string, string> = {
  'ca': 'California dentists offer a wide range of services including preventive care, cosmetic procedures, and specialized treatments. Many clinics offer flexible payment plans.',
  'ma': 'Massachusetts dental practices are known for thorough preventive care and modern technology. Most accept insurance plans in-network.',
  'ct': 'Connecticut dentists specialize in family dentistry and orthodontic care. Many offer evening and weekend appointments.',
  'nj': 'New Jersey dental clinics provide comprehensive care with many multilingual staff. Emergency appointments often available same-day.',
};

export function LocationIntroSection({ 
  cityName, 
  stateAbbr, 
  clinicCount, 
  variation, 
  content,
  treatments = [],
  stateSlug 
}: LocationIntroSectionProps) {
  const isShort = variation === 'results-first';
  const isLarge = variation === 'experience-first';
  
  const localContext = LOCAL_CONTEXT[cityName.toLowerCase().replace(/ /g, '-')] || '';
  const dentalTip = DENTAL_TIPS[stateSlug] || DENTAL_TIPS['ca'];
  
  const primaryColor = variation === 'trust-first' ? 'emerald' : variation === 'results-first' ? 'blue' : 'amber';
  
  const bgCards = [
    { icon: Users, label: 'Specialists', value: `${clinicCount}+`, color: primaryColor },
    { icon: Star, label: 'Avg Rating', value: '4.9', color: 'amber' },
    { icon: Clock, label: ' appointment', value: 'Same-day', color: primaryColor },
  ];
  
  return (
    <section className="py-8 bg-slate-50">
      <div className="container px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          <div 
            className={`bg-white rounded-3xl ${
              isLarge ? 'p-10 md:p-12 shadow-xl border-2' : 'p-8 md:p-10 shadow-lg border'
            } border-slate-100`}
            style={{
              borderColor: isLarge ? `var(--${primaryColor}-100)` : undefined,
            }}
          >
            <div className="flex items-start gap-4 mb-6">
              <div 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-${primaryColor}-500 to-${primaryColor === 'emerald' ? 'teal' : primaryColor === 'blue' ? 'indigo' : 'orange'}-600`}
              >
                <Stethoscope className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800">
                  Dental Care in {cityName}
                </h2>
                <p className="text-slate-500 mt-1">
                  {localContext ? `Find the best dentists ${localContext}` : 'Your guide to finding the best dentists'}
                </p>
              </div>
            </div>
            
            {!isShort && (
              <div className="prose prose-slate max-w-none mb-6">
                <p className="text-lg text-slate-600 leading-relaxed">
                  {content || dentalTip}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {bgCards.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 p-4 bg-${card.color}-50 rounded-2xl border border-${card.color}-100`}
                >
                  <div className={`w-10 h-10 bg-${card.color}-500 rounded-xl flex items-center justify-center shrink-0`}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-lg">{card.value}</p>
                    <p className="text-xs text-slate-500">{card.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {treatments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-600 mb-3">Popular treatments in {cityName}:</p>
                <div className="flex flex-wrap gap-2">
                  {treatments.slice(0, isShort ? 3 : 5).map((treatment, i) => (
                    <motion.a
                      key={treatment.slug}
                      href={`/${stateSlug}/${cityName.toLowerCase().replace(/ /g, '-')}/${treatment.slug}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className={`px-4 py-2 bg-${primaryColor}-50 text-${primaryColor}-700 rounded-full text-sm font-medium hover:bg-${primaryColor}-100 transition-colors`}
                    >
                      {treatment.name}
                    </motion.a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default LocationIntroSection;