/**
 * SyncStructuredData - Synchronous JSON-LD Schema Renderer
 * 
 * CRITICAL FOR SEO: This component renders JSON-LD structured data synchronously
 * in the initial HTML, rather than injecting via useEffect after hydration.
 * This ensures schema markup is visible to Googlebot before JS execution.
 * 
 * Use this component for all SEO-critical pages.
 */

import { useSchemaSettings } from '@/hooks/useSchemaSettings';
import { withTrailingSlash } from '@/lib/url/withTrailingSlash';

const BASE_URL = 'https://www.appointpanda.com';

// ========================== SCHEMA GENERATORS ==========================

export interface OrganizationSchemaData {
  type: 'organization';
}

export interface LocalBusinessSchemaData {
  type: 'localBusiness';
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  url: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  openingHours?: { day: string; open: string; close: string }[];
  geo?: { lat: number; lng: number };
  services?: string[];
}

export interface DentistSchemaData {
  type: 'dentist';
  name: string;
  specialty?: string;
  description?: string;
  image?: string;
  url: string;
  worksFor?: { name: string; url: string };
  qualifications?: string[];
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
}

export interface PhysicianSchemaData {
  type: 'physician';
  name: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  url: string;
  phone?: string;
  geo?: { lat: number; lng: number };
  rating?: number;
  reviewCount?: number;
  specialties?: string[];
  acceptsNewPatients?: boolean;
}

export interface ArticleSchemaData {
  type: 'article';
  headline: string;
  description?: string;
  image?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
}

export interface FAQSchemaData {
  type: 'faq';
  questions: { question: string; answer: string }[];
}

export interface HowToSchemaData {
  type: 'howTo';
  name: string;
  description?: string;
  steps: { name: string; text: string }[];
}

export interface BreadcrumbSchemaData {
  type: 'breadcrumb';
  items: { name: string; url?: string }[];
}

export interface ServiceSchemaData {
  type: 'service';
  name: string;
  description?: string;
  url: string;
  provider?: string;
  areaServed?: string;
}

export interface ItemListSchemaData {
  type: 'itemList';
  name: string;
  description?: string;
  itemListOrder?: 'ItemListOrderAscending' | 'ItemListOrderDescending' | 'ItemListUnordered';
  items: {
    name: string;
    url: string;
    position?: number;
    image?: string;
    description?: string;
  }[];
}

export interface MedicalProcedureSchemaData {
  type: 'medicalProcedure';
  name: string;
  description?: string;
  url: string;
  bodyLocation?: string;
  procedureType?: string;
  howPerformed?: string;
  preparation?: string;
  followup?: string;
}

export type SyncSchemaData =
  | OrganizationSchemaData
  | LocalBusinessSchemaData
  | DentistSchemaData
  | PhysicianSchemaData
  | ArticleSchemaData
  | FAQSchemaData
  | HowToSchemaData
  | BreadcrumbSchemaData
  | ServiceSchemaData
  | ItemListSchemaData
  | MedicalProcedureSchemaData;

// Schema generation functions
const generateOrganizationSchema = (settings?: any) => {
  const org = settings || {
    name: 'AppointPanda',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Find and book appointments with top-rated dental professionals across the United States.',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url,
    logo: org.logo,
    description: org.description,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'US',
    },
    ...(org.email && { email: org.email }),
    ...(org.phone && { telephone: org.phone }),
    ...(org.socialProfiles?.length && { sameAs: org.socialProfiles }),
  };
};

const generateLocalBusinessSchema = (data: LocalBusinessSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': ['Dentist', 'LocalBusiness', 'MedicalBusiness'],
  name: data.name,
  description: data.description,
  url: `${BASE_URL}${withTrailingSlash(data.url)}`,
  image: data.image,
  telephone: data.phone,
  email: data.email,
  priceRange: data.priceRange || '$$',
  ...(data.address && {
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.address,
      addressLocality: data.city,
      addressRegion: data.state,
      addressCountry: data.country || 'US',
    },
  }),
  ...(data.geo && {
    geo: {
      '@type': 'GeoCoordinates',
      latitude: data.geo.lat,
      longitude: data.geo.lng,
    },
  }),
  ...(data.rating && data.reviewCount && data.reviewCount > 0 && {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: data.rating,
      reviewCount: data.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  }),
  ...(data.openingHours?.length && {
    openingHoursSpecification: data.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.day,
      opens: h.open,
      closes: h.close,
    })),
  }),
  ...(data.services?.length && {
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Dental Services',
      itemListElement: data.services.map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service,
        },
      })),
    },
  }),
});

const generatePhysicianSchema = (data: PhysicianSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'Physician',
  name: data.name,
  jobTitle: data.jobTitle || 'Dentist',
  description: data.description,
  image: data.image,
  url: `${BASE_URL}${withTrailingSlash(data.url)}`,
  ...(data.phone && { telephone: data.phone }),
  ...(data.geo && {
    geo: {
      '@type': 'GeoCoordinates',
      latitude: data.geo.lat,
      longitude: data.geo.lng,
    },
  }),
  ...(data.rating && {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: data.rating,
      bestRating: 5,
      worstRating: 1,
      ...(data.reviewCount && { ratingCount: data.reviewCount }),
    },
  }),
  ...(data.specialties?.length && {
    medicalSpecialty: data.specialties.map((s) => ({ '@type': 'MedicalSpecialty', name: s })),
  }),
  ...(data.acceptsNewPatients !== undefined && {
    acceptsNewPatients: data.acceptsNewPatients,
  }),
});

const generateDentistSchema = (data: DentistSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: data.name,
  jobTitle: data.specialty || 'Dentist',
  description: data.description,
  image: data.image,
  url: `${BASE_URL}${withTrailingSlash(data.url)}`,
  ...(data.worksFor && {
    worksFor: {
      '@type': 'Organization',
      name: data.worksFor.name,
      url: `${BASE_URL}${withTrailingSlash(data.worksFor.url)}`,
    },
  }),
  ...(data.qualifications?.length && {
    hasCredential: data.qualifications.map((q) => ({
      '@type': 'EducationalOccupationalCredential',
      name: q,
    })),
  }),
  ...(data.address && {
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.address,
      addressLocality: data.city,
      addressRegion: data.state,
      addressCountry: 'US',
    },
  }),
  ...(data.phone && { telephone: data.phone }),
  ...(data.rating && data.reviewCount && data.reviewCount > 0 && {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: data.rating,
      reviewCount: data.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  }),
});

const generateArticleSchema = (data: ArticleSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: data.headline,
  description: data.description,
  image: data.image,
  url: `${BASE_URL}${withTrailingSlash(data.url)}`,
  datePublished: data.datePublished,
  dateModified: data.dateModified || data.datePublished,
  author: {
    '@type': 'Person',
    name: data.author || 'AppointPanda Team',
  },
  publisher: {
    '@type': 'Organization',
    name: 'AppointPanda',
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/logo.png`,
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': `${BASE_URL}${withTrailingSlash(data.url)}`,
  },
});

const generateFAQSchema = (data: FAQSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: data.questions.map((q) => ({
    '@type': 'Question',
    name: q.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: q.answer,
    },
  })),
});

const generateHowToSchema = (data: HowToSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: data.name,
  description: data.description || `Learn how to ${data.name.toLowerCase()} with AppointPanda`,
  step: data.steps.map((step, index) => ({
    '@type': 'HowToStep',
    position: index + 1,
    name: step.name,
    text: step.text,
  })),
});

const generateBreadcrumbSchema = (data: BreadcrumbSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: data.items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    ...(item.url && { item: item.url.startsWith('http') ? item.url : `${BASE_URL}${withTrailingSlash(item.url)}` }),
  })),
});

const generateServiceSchema = (data: ServiceSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'MedicalProcedure',
  name: data.name,
  description: data.description,
  url: `${BASE_URL}${withTrailingSlash(data.url)}`,
  provider: {
    '@type': 'Organization',
    name: data.provider || 'AppointPanda',
  },
  ...(data.areaServed && {
    areaServed: {
      '@type': 'City',
      name: data.areaServed,
    },
  }),
});

const generateItemListSchema = (data: ItemListSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: data.name,
  description: data.description,
  itemListOrder: data.itemListOrder || 'ItemListUnordered',
  numberOfItems: data.items.length,
  itemListElement: data.items.map((item, index) => ({
    '@type': 'ListItem',
    position: item.position || index + 1,
    name: item.name,
    url: item.url.startsWith('http') ? item.url : `${BASE_URL}${withTrailingSlash(item.url)}`,
    ...(item.image && { image: item.image }),
    ...(item.description && { description: item.description }),
  })),
});

const generateMedicalProcedureSchema = (data: MedicalProcedureSchemaData) => ({
  '@context': 'https://schema.org',
  '@type': 'MedicalProcedure',
  name: data.name,
  description: data.description,
  url: `${BASE_URL}${withTrailingSlash(data.url)}`,
  ...(data.bodyLocation && { bodyLocation: data.bodyLocation }),
  ...(data.procedureType && { procedureType: data.procedureType }),
  ...(data.howPerformed && { howPerformed: data.howPerformed }),
  ...(data.preparation && { preparation: data.preparation }),
  ...(data.followup && { followup: data.followup }),
});

// Main generator function
function generateSchema(data: SyncSchemaData, organizationSettings?: any): object {
  switch (data.type) {
    case 'organization':
      return generateOrganizationSchema(organizationSettings);
    case 'localBusiness':
      return generateLocalBusinessSchema(data);
    case 'dentist':
      return generateDentistSchema(data);
    case 'physician':
      return generatePhysicianSchema(data);
    case 'article':
      return generateArticleSchema(data);
    case 'faq':
      return generateFAQSchema(data);
    case 'howTo':
      return generateHowToSchema(data);
    case 'breadcrumb':
      return generateBreadcrumbSchema(data);
    case 'service':
      return generateServiceSchema(data);
    case 'itemList':
      return generateItemListSchema(data);
    case 'medicalProcedure':
      return generateMedicalProcedureSchema(data);
    default:
      return {};
  }
}

// ========================== COMPONENT ==========================

interface SyncStructuredDataProps {
  data: SyncSchemaData | SyncSchemaData[];
  id?: string;
}

/**
 * Renders JSON-LD structured data synchronously in the DOM.
 * This component uses dangerouslySetInnerHTML to ensure the script
 * is present in the initial HTML, not injected after hydration.
 */
export const SyncStructuredData = ({ data, id }: SyncStructuredDataProps) => {
  const { data: schemaSettings } = useSchemaSettings();
  
  const schemas = Array.isArray(data) ? data : [data];
  
  // Generate all schemas
  const jsonLdScripts = schemas.map((schemaData, index) => {
    const schema = generateSchema(schemaData, schemaSettings?.organization);
    const schemaId = id ? `${id}-${index}` : `sync-schema-${schemaData.type}-${index}`;
    
    return (
      <script
        key={schemaId}
        id={schemaId}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    );
  });

  return <>{jsonLdScripts}</>;
};

export default SyncStructuredData;
