export const ISR_CONFIG = {
  Revalidation: {
    STATIC_PAGES: 60 * 60 * 24,
    STATE_PAGES: 60 * 60,
    CITY_PAGES: 60 * 60,
    SERVICE_LOCATION_PAGES: 60 * 60,
    CLINIC_PAGES: 60 * 15,
    DENTIST_PAGES: 60 * 15,
    BLOG_PAGES: 60 * 60 * 6,
    SERVICE_PAGES: 60 * 60,
    INSURANCE_PAGES: 60 * 60,
    DYNAMIC_USER_PAGES: 60,
  },
  
  Fallback: {
    STATES: 'blocking',
    CITIES: 'blocking',
    SERVICE_LOCATIONS: 'blocking',
    CLINICS: 'blocking',
    DENTISTS: 'blocking',
    BLOG_POSTS: 'blocking',
    SERVICES: 'blocking',
    INSURANCE: 'blocking',
  },
  
  Paths: {
    MAX_STATIC_PATHS: 500,
    STATIC_STATE_PATHS: ['ca', 'ma', 'ct', 'nj'],
    STATIC_CITY_PATHS_PER_STATE: 20,
  },
} as const;

export const getRevalidateTime = (pageType: keyof typeof ISR_CONFIG.Revalidation): number => {
  return ISR_CONFIG.Revalidation[pageType] || 60;
};

export const getFallbackMode = (pageType: keyof typeof ISR_CONFIG.Fallback): 'blocking' | 'true' | 'false' => {
  return ISR_CONFIG.Fallback[pageType] || 'blocking';
};
