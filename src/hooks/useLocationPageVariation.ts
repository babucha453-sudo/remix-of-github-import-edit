import { useMemo } from 'react';

export type LocationPageVariation = 'trust-first' | 'results-first' | 'experience-first';

const VARIATION_ORDER: Record<LocationPageVariation, string[]> = {
  'trust-first': [
    'trust-signals',
    'page-intro', 
    'dentist-list',
    'map-section',
    'nearby-cities',
    'faq-section',
  ],
  'results-first': [
    'hero-stats',
    'dentist-list',
    'map-section', 
    'trust-signals-mini',
    'page-intro-short',
    'faq-section',
  ],
  'experience-first': [
    'hero-context',
    'page-intro',
    'trust-signals',
    'dentist-list',
    'map-section',
    'nearby-cities-large',
    'faq-section',
  ],
};

const SECTION_COLORS: Record<LocationPageVariation, Record<string, string>> = {
  'trust-first': {
    primary: 'emerald',
    secondary: 'teal',
    accent: 'cyan',
    card: 'slate',
  },
  'results-first': {
    primary: 'blue',
    secondary: 'indigo', 
    accent: 'violet',
    card: 'slate',
  },
  'experience-first': {
    primary: 'amber',
    secondary: 'orange',
    accent: 'red',
    card: 'slate',
  },
};

export function useLocationPageVariation(citySlug: string, clinicCount: number = 0) {
  const variation = useMemo(() => {
    if (!citySlug) return 'trust-first' as LocationPageVariation;
    
    const hash = citySlug.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const variations: LocationPageVariation[] = ['trust-first', 'results-first', 'experience-first'];
    return variations[Math.abs(hash) % variations.length];
  }, [citySlug]);

  const sectionOrder = VARIATION_ORDER[variation];
  const colors = SECTION_COLORS[variation];
  
  const shouldShowLocalStats = clinicCount > 50;
  const nearbyCitiesCount = variation === 'experience-first' ? 8 : 6;
  const introLength = variation === 'results-first' ? 'short' : 'long';
  
  return {
    variation,
    sectionOrder,
    colors,
    shouldShowLocalStats,
    nearbyCitiesCount,
    introLength,
    getSectionIndex: (section: string) => sectionOrder.indexOf(section),
  };
}

export const LOCATION_PAGE_VARIATIONS: LocationPageVariation[] = [
  'trust-first',
  'results-first', 
  'experience-first',
];

export function getVariationForCity(citySlug: string): LocationPageVariation {
  if (!citySlug) return 'trust-first';
  
  const hash = citySlug.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const variations: LocationPageVariation[] = ['trust-first', 'results-first', 'experience-first'];
  return variations[Math.abs(hash) % variations.length];
}