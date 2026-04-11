import { Helmet } from 'react-helmet-async';
import { useSchemaSettings } from '@/hooks/useSchemaSettings';
import { withTrailingSlash } from '@/lib/url/withTrailingSlash';

const BASE_URL = 'https://www.appointpanda.com';

// Organization Schema
export interface OrganizationSchemaProps {
  type: 'organization';
}

// LocalBusiness/Dentist Schema
export interface LocalBusinessSchemaProps {
  type: 'localBusiness';
  name: string;
  description?: string;
  address?: string;
  city?: string;
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
}

// Person/Dentist Schema
export interface PersonSchemaProps {
  type: 'person';
  name: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  url: string;
  worksFor?: { name: string; url: string };
  qualifications?: string[];
}

// Article Schema
export interface ArticleSchemaProps {
  type: 'article';
  headline: string;
  description?: string;
  image?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
}

// FAQ Schema
export interface FAQSchemaProps {
  type: 'faq';
  questions: { question: string; answer: string }[];
}

// Breadcrumb Schema
export interface BreadcrumbSchemaProps {
  type: 'breadcrumb';
  items: { name: string; url?: string }[];
}

// Service Schema
export interface ServiceSchemaProps {
  type: 'service';
  name: string;
  description?: string;
  url: string;
  provider?: string;
  areaServed?: string;
}

export type StructuredDataProps =
  | OrganizationSchemaProps
  | LocalBusinessSchemaProps
  | PersonSchemaProps
  | ArticleSchemaProps
  | FAQSchemaProps
  | BreadcrumbSchemaProps
  | ServiceSchemaProps;

// Organization schema generator that uses settings
const generateOrganizationSchema = (settings?: {
  name: string;
  url: string;
  logo: string;
  description: string;
  email?: string;
  phone?: string;
  foundingDate?: string;
  founders?: string[];
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  socialProfiles?: string[];
}) => {
  const org = settings || {
    name: 'AppointPanda',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Find and book appointments with top-rated dental professionals across the United States.',
  };

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url,
    logo: org.logo,
    description: org.description,
  };

  if (org.email) schema.email = org.email;
  if (org.phone) schema.telephone = org.phone;
  if (org.foundingDate) schema.foundingDate = org.foundingDate;
  
  if (org.founders && org.founders.length > 0) {
    schema.founder = org.founders.map(name => ({
      '@type': 'Person',
      name,
    }));
  }

  if (org.address && org.address.streetAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: org.address.streetAddress,
      addressLocality: org.address.addressLocality,
      addressRegion: org.address.addressRegion,
      postalCode: org.address.postalCode,
      addressCountry: org.address.addressCountry || 'US',
    };
  } else {
    schema.address = {
      '@type': 'PostalAddress',
      addressCountry: 'US',
    };
  }

  if (org.socialProfiles && org.socialProfiles.length > 0) {
    schema.sameAs = org.socialProfiles;
  }

  return schema;
};

const generateLocalBusinessSchema = (props: LocalBusinessSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': ['Dentist', 'LocalBusiness'],
  name: props.name,
  description: props.description,
  url: `${BASE_URL}${withTrailingSlash(props.url)}`,
  image: props.image,
  telephone: props.phone,
  email: props.email,
  priceRange: props.priceRange || '$$',
  address: props.address
    ? {
        '@type': 'PostalAddress',
        streetAddress: props.address,
        addressLocality: props.city,
        addressCountry: props.country || 'US',
      }
    : undefined,
  geo: props.geo
    ? {
        '@type': 'GeoCoordinates',
        latitude: props.geo.lat,
        longitude: props.geo.lng,
      }
    : undefined,
  aggregateRating:
    props.rating && props.reviewCount && props.reviewCount > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: props.rating,
          reviewCount: props.reviewCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
  openingHoursSpecification: props.openingHours?.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: h.day,
    opens: h.open,
    closes: h.close,
  })),
});

const generatePersonSchema = (props: PersonSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: props.name,
  jobTitle: props.jobTitle || 'Dentist',
  description: props.description,
  image: props.image,
  url: `${BASE_URL}${withTrailingSlash(props.url)}`,
  worksFor: props.worksFor
    ? {
        '@type': 'Dentist',
        name: props.worksFor.name,
        url: `${BASE_URL}${withTrailingSlash(props.worksFor.url)}`,
      }
    : undefined,
  hasCredential: props.qualifications?.map((q) => ({
    '@type': 'EducationalOccupationalCredential',
    name: q,
  })),
});

const generateArticleSchema = (props: ArticleSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: props.headline,
  description: props.description,
  image: props.image,
  url: `${BASE_URL}${withTrailingSlash(props.url)}`,
  datePublished: props.datePublished,
  dateModified: props.dateModified || props.datePublished,
  author: {
    '@type': 'Person',
    name: props.author || 'AppointPanda Team',
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
    '@id': `${BASE_URL}${withTrailingSlash(props.url)}`,
  },
});

const generateFAQSchema = (props: FAQSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: props.questions.map((q) => ({
    '@type': 'Question',
    name: q.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: q.answer,
    },
  })),
});

const generateBreadcrumbSchema = (props: BreadcrumbSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: props.items.map((item, index) => {
    let itemUrl: string | undefined;
    if (item.url) {
      itemUrl = item.url.startsWith('http') ? item.url : `${BASE_URL}${withTrailingSlash(item.url)}`;
    }
    return {
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: itemUrl,
    };
  }),
});

const generateServiceSchema = (props: ServiceSchemaProps) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: props.name,
  description: props.description,
  url: `${BASE_URL}${withTrailingSlash(props.url)}`,
  provider: props.provider
    ? {
        '@type': 'Organization',
        name: props.provider,
      }
    : {
        '@type': 'Organization',
        name: 'AppointPanda',
      },
  areaServed: props.areaServed
    ? {
        '@type': 'City',
        name: props.areaServed,
      }
    : {
        '@type': 'Country',
        name: 'United States',
      },
  serviceType: 'Dental Service',
});

export const StructuredData = (props: StructuredDataProps) => {
  const { data: schemaSettings } = useSchemaSettings();

  let schema: object;

  switch (props.type) {
    case 'organization':
      schema = generateOrganizationSchema(schemaSettings?.organization);
      break;
    case 'localBusiness':
      schema = generateLocalBusinessSchema(props);
      break;
    case 'person':
      schema = generatePersonSchema(props);
      break;
    case 'article':
      schema = generateArticleSchema(props);
      break;
    case 'faq':
      schema = generateFAQSchema(props);
      break;
    case 'breadcrumb':
      schema = generateBreadcrumbSchema(props);
      break;
    case 'service':
      schema = generateServiceSchema(props);
      break;
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

export default StructuredData;
