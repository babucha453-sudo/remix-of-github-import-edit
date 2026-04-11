// SEO utility functions and constants

export const SITE_CONFIG = {
  name: 'AppointPanda',
  domain: process.env.NEXT_PUBLIC_DOMAIN || 'appointpanda.com',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://www.appointpanda.com',
  defaultCountry: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || 'us',
  defaultCity: process.env.NEXT_PUBLIC_DEFAULT_CITY || 'los-angeles',
  countryName: 'United States',
  defaultState: 'ca',
};

// URL helper functions
export const getCountryUrl = (countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}`;

export const getCityUrl = (citySlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/${citySlug}`;

export const getAreaUrl = (citySlug: string, areaSlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/${citySlug}/${areaSlug}`;

export const getServiceUrl = (serviceSlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/services/${serviceSlug}`;

export const getCityServiceUrl = (citySlug: string, serviceSlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/${citySlug}/${serviceSlug}`;

export const getAreaServiceUrl = (citySlug: string, areaSlug: string, serviceSlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/${citySlug}/${areaSlug}/${serviceSlug}`;

export const getClinicUrl = (clinicSlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/clinic/${clinicSlug}`;

export const getDentistUrl = (dentistSlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/dentist/${dentistSlug}`;

export const getBlogUrl = (countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/blog`;

export const getBlogPostUrl = (postSlug: string, countryCode: string = SITE_CONFIG.defaultCountry) => 
  `/${countryCode}/blog/${postSlug}`;

// SEO meta generators
export const generatePageTitle = (parts: string[]) => 
  [...parts, SITE_CONFIG.name].join(' | ');

export const generateLocationMeta = (locationName: string, type: 'city' | 'area') => ({
  title: `Best Dentists in ${locationName} - Book Appointments Online`,
  description: `Find and book appointments with top-rated dental professionals in ${locationName}. Compare verified clinics, read patient reviews, and get the care you deserve.`,
  keywords: [
    `dentists in ${locationName}`,
    `dental clinics ${locationName}`,
    `best dentist ${locationName}`,
    `teeth cleaning ${locationName}`,
    `dental care ${locationName}`,
  ],
});

export const generateServiceMeta = (serviceName: string, locationName?: string) => ({
  title: locationName 
    ? `${serviceName} in ${locationName} - Find Specialists & Book Online`
    : `${serviceName} in ${SITE_CONFIG.countryName} - Find Specialists & Book Online`,
  description: locationName
    ? `Find the best ${serviceName.toLowerCase()} specialists in ${locationName}. Compare verified clinics, read reviews, and book your appointment today.`
    : `Find the best ${serviceName.toLowerCase()} specialists in the ${SITE_CONFIG.countryName}. Compare verified clinics, read reviews, and book your appointment today.`,
  keywords: [
    serviceName.toLowerCase(),
    locationName ? `${serviceName.toLowerCase()} ${locationName}` : `${serviceName.toLowerCase()} ${SITE_CONFIG.defaultState}`,
    `${serviceName.toLowerCase()} dentist`,
    `${serviceName.toLowerCase()} cost`,
    `${serviceName.toLowerCase()} clinic`,
  ],
});

export const generateClinicMeta = (clinicName: string, locationName?: string) => ({
  title: `${clinicName}${locationName ? ` - ${locationName}` : ''} - Reviews & Appointments`,
  description: `${clinicName} is a verified dental clinic${locationName ? ` in ${locationName}` : ''}. Read patient reviews, view services offered, and book your appointment online.`,
  keywords: [
    clinicName.toLowerCase(),
    `${clinicName.toLowerCase()} reviews`,
    locationName ? `dental clinic ${locationName}` : `dental clinic ${SITE_CONFIG.countryName}`,
    'dentist appointment',
    'dental care',
  ],
});

export const generateDentistMeta = (dentistName: string, specialty?: string, clinicName?: string) => ({
  title: `${dentistName}${specialty ? ` - ${specialty}` : ''} - Book Appointment`,
  description: `Book an appointment with ${dentistName}${specialty ? `, a ${specialty.toLowerCase()} specialist` : ''}${clinicName ? ` at ${clinicName}` : ''}. Read patient reviews and get quality dental care.`,
  keywords: [
    dentistName.toLowerCase(),
    specialty ? specialty.toLowerCase() : 'dentist',
    'dental appointment',
    'book dentist',
    'dental care',
  ],
});

export const generateBlogPostMeta = (title: string, excerpt?: string) => ({
  title,
  description: excerpt || `Read ${title} on AppointPanda's dental health blog. Expert advice and tips from ${SITE_CONFIG.countryName}'s top dental professionals.`,
  keywords: [
    'dental health',
    'oral hygiene',
    'dental tips',
    'dental care',
  ],
});

// Breadcrumb type
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Breadcrumb generators
export const generateHomeBreadcrumb = (countryCode: string = SITE_CONFIG.defaultCountry): BreadcrumbItem[] => [
  { label: 'Home', href: `/${countryCode}` },
];

export const generateLocationBreadcrumbs = (
  cityName: string,
  citySlug: string,
  areaName?: string,
  areaSlug?: string,
  countryCode: string = SITE_CONFIG.defaultCountry
): BreadcrumbItem[] => {
  const crumbs: BreadcrumbItem[] = [
    { label: 'Home', href: `/${countryCode}` },
    { label: cityName, href: areaSlug ? getCityUrl(citySlug, countryCode) : undefined },
  ];
  
  if (areaName && areaSlug) {
    crumbs.push({ label: areaName });
  }
  
  return crumbs;
};

export const generateServiceBreadcrumbs = (
  serviceName: string,
  serviceSlug: string,
  cityName?: string,
  citySlug?: string,
  countryCode: string = SITE_CONFIG.defaultCountry
): BreadcrumbItem[] => {
  const crumbs: BreadcrumbItem[] = [
    { label: 'Home', href: `/${countryCode}` },
    { label: 'Services', href: `/${countryCode}/services` },
  ];
  
  if (cityName && citySlug) {
    crumbs.push(
      { label: serviceName, href: getServiceUrl(serviceSlug, countryCode) },
      { label: `in ${cityName}` }
    );
  } else {
    crumbs.push({ label: serviceName });
  }
  
  return crumbs;
};

export const generateClinicBreadcrumbs = (
  clinicName: string,
  cityName?: string,
  citySlug?: string,
  countryCode: string = SITE_CONFIG.defaultCountry
): BreadcrumbItem[] => [
  { label: 'Home', href: `/${countryCode}` },
  ...(cityName && citySlug ? [{ label: cityName, href: getCityUrl(citySlug, countryCode) }] : []),
  { label: clinicName },
];

export const generateDentistBreadcrumbs = (
  dentistName: string,
  cityName?: string,
  citySlug?: string,
  countryCode: string = SITE_CONFIG.defaultCountry
): BreadcrumbItem[] => [
  { label: 'Home', href: `/${countryCode}` },
  ...(cityName && citySlug ? [{ label: cityName, href: getCityUrl(citySlug, countryCode) }] : []),
  { label: dentistName },
];

export const generateBlogBreadcrumbs = (
  postTitle?: string,
  countryCode: string = SITE_CONFIG.defaultCountry
): BreadcrumbItem[] => [
  { label: 'Home', href: `/${countryCode}` },
  { label: 'Blog', href: postTitle ? getBlogUrl(countryCode) : undefined },
  ...(postTitle ? [{ label: postTitle }] : []),
];
