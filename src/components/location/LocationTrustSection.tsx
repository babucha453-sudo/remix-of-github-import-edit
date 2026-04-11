import { motion } from "framer-motion";
import { Shield, Star, CheckCircle2, Clock, Award, BadgeCheck, Users, Heart, Sparkles } from "lucide-react";

interface LocationTrustSectionProps {
  variation: 'trust-first' | 'results-first' | 'experience-first';
  totalClinics?: number;
}

const TRUST_CONFIG = {
  'trust-first': {
    badges: [
      { icon: Shield, label: 'HIPAA', sublabel: 'Compliant', color: 'emerald' },
      { icon: Star, label: '4.9★', sublabel: 'Avg Rating', color: 'amber' },
      { icon: CheckCircle2, label: 'Verified', sublabel: 'Dentists', color: 'emerald' },
      { icon: Clock, label: 'Instant', sublabel: 'Booking', color: 'blue' },
    ],
    layout: 'four-column',
  },
  'results-first': {
    badges: [
      { icon: BadgeCheck, label: 'Verified', sublabel: 'Clinics', color: 'blue' },
      { icon: Star, label: '4.9★', sublabel: 'Rating', color: 'amber' },
      { icon: Clock, label: 'Same-day', sublabel: 'Appts', color: 'blue' },
    ],
    layout: 'three-column-compact',
  },
  'experience-first': {
    badges: [
      { icon: Award, label: 'Top Rated', sublabel: '2024', color: 'amber' },
      { icon: BadgeCheck, label: 'Licensed', sublabel: 'Professionals', color: 'emerald' },
      { icon: Heart, label: 'Patient', sublabel: 'Choice', color: 'rose' },
      { icon: Sparkles, label: 'Premium', sublabel: 'Quality', color: 'violet' },
      { icon: Users, label: '10k+', sublabel: 'Reviews', color: 'blue' },
    ],
    layout: 'five-column-large',
  },
};

export function LocationTrustSection({ variation, totalClinics = 0 }: LocationTrustSectionProps) {
  const config = TRUST_CONFIG[variation];
  const { badges, layout } = config;
  
  const isCompact = layout === 'three-column-compact';
  const isLarge = layout === 'five-column-large';
  
  const bgColor = variation === 'trust-first' 
    ? 'bg-white border-b border-slate-100' 
    : variation === 'results-first'
    ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
    : 'bg-white';
  
  const textColor = variation === 'results-first' ? 'text-white' : 'text-slate-800';
  const subtextColor = variation === 'results-first' ? 'text-blue-100' : 'text-slate-500';
  
  const cols = layout === 'five-column-large' 
    ? 'grid-cols-2 md:grid-cols-5' 
    : layout === 'three-column-compact'
    ? 'grid-cols-3'
    : 'grid-cols-2 md:grid-cols-4';
  
  return (
    <section className={`py-6 md:py-8 ${bgColor}`}>
      <div className="container px-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-5xl mx-auto`}
        >
          <div 
            className={`
              grid ${cols} gap-3 md:gap-4
              ${isCompact ? 'text-center' : ''}
              ${isLarge ? 'text-center' : ''}
            `}
          >
            {badges.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`
                  flex items-center gap-3 
                  ${isCompact ? 'p-2' : isLarge ? 'p-4 bg-slate-50 rounded-2xl' : 'p-3 bg-slate-50 rounded-2xl'}
                  ${variation === 'results-first' ? 'bg-white/10 backdrop-blur-sm border border-white/20' : ''}
                  ${isLarge ? 'border border-slate-100' : ''}
                `}
              >
                <div 
                  className={`
                    ${isLarge ? 'w-14 h-14' : isCompact ? 'w-8 h-8' : 'w-12 h-12'} 
                    bg-${badge.color}-500 rounded-xl flex items-center justify-center shrink-0
                  `}
                >
                  <badge.icon 
                    className={`
                      ${isLarge ? 'h-7 w-7' : isCompact ? 'h-4 w-4' : 'h-6 w-6'} 
                      text-white
                    `}
                  />
                </div>
                <div className={isLarge ? 'flex-1' : ''}>
                  <p className={`font-bold ${isLarge ? 'text-lg' : ''} ${textColor}`}>
                    {isLarge && totalClinics > 100 && badge.label === '10k+' 
                      ? `${(totalClinics / 1000).toFixed(1)}k+` 
                      : badge.label}
                  </p>
                  <p className={`text-xs ${subtextColor}`}>{badge.sublabel}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default LocationTrustSection;