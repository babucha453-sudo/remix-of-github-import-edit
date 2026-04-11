/**
 * BreadcrumbSchema - JSON-LD Breadcrumb structured data
 * 
 * Implements BreadcrumbList schema for full hierarchy:
 * Home > State > City > Service > Profile
 * 
 * This component works alongside the visual Breadcrumbs component
 * to provide machine-readable navigation structure for search engines.
 * 
 * CANONICAL: All URLs use trailing slash format (except root /).
 */

import { Helmet } from "react-helmet-async";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
  baseUrl?: string;
}

// Helper to ensure trailing slash (except root)
const ensureTrailingSlash = (url: string): string => {
  if (url === '/' || url === '') return '/';
  return url.endsWith('/') ? url : `${url}/`;
};

export const BreadcrumbSchema = ({ 
  items, 
  baseUrl = "https://www.appointpanda.com" 
}: BreadcrumbSchemaProps) => {
  const schemaItems = items.map((item, index) => {
    const url = item.url.startsWith("http") 
      ? item.url 
      : `${baseUrl}${ensureTrailingSlash(item.url)}`;
    return {
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: url,
    };
  });

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: schemaItems,
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

/**
 * Helper functions to generate breadcrumb items for different page types
 * All URLs use trailing slash (canonical format)
 */

export const generateStateBreadcrumbs = (
  stateName: string,
  stateSlug: string
): BreadcrumbItem[] => [
  { name: "Home", url: "/" },
  { name: stateName, url: `/${stateSlug}/` },
];

export const generateCityBreadcrumbs = (
  stateName: string,
  stateSlug: string,
  cityName: string,
  citySlug: string
): BreadcrumbItem[] => [
  { name: "Home", url: "/" },
  { name: stateName, url: `/${stateSlug}/` },
  { name: cityName, url: `/${stateSlug}/${citySlug}/` },
];

export const generateServiceBreadcrumbs = (
  serviceName: string,
  serviceSlug: string
): BreadcrumbItem[] => [
  { name: "Home", url: "/" },
  { name: "Services", url: "/services/" },
  { name: serviceName, url: `/services/${serviceSlug}/` },
];

export const generateServiceLocationBreadcrumbs = (
  stateName: string,
  stateSlug: string,
  cityName: string,
  citySlug: string,
  serviceName: string,
  serviceSlug: string
): BreadcrumbItem[] => [
  { name: "Home", url: "/" },
  { name: stateName, url: `/${stateSlug}/` },
  { name: cityName, url: `/${stateSlug}/${citySlug}/` },
  { name: serviceName, url: `/${stateSlug}/${citySlug}/${serviceSlug}/` },
];

export const generateClinicBreadcrumbs = (
  clinicName: string,
  clinicSlug: string,
  stateName?: string,
  stateSlug?: string,
  cityName?: string,
  citySlug?: string
): BreadcrumbItem[] => {
  const crumbs: BreadcrumbItem[] = [{ name: "Home", url: "/" }];
  
  if (stateName && stateSlug) {
    crumbs.push({ name: stateName, url: `/${stateSlug}/` });
  }
  
  if (cityName && citySlug && stateSlug) {
    crumbs.push({ name: cityName, url: `/${stateSlug}/${citySlug}/` });
  }
  
  crumbs.push({ name: clinicName, url: `/clinic/${clinicSlug}/` });
  
  return crumbs;
};

export const generateDentistBreadcrumbs = (
  dentistName: string,
  dentistSlug: string,
  stateName?: string,
  stateSlug?: string,
  cityName?: string,
  citySlug?: string
): BreadcrumbItem[] => {
  const crumbs: BreadcrumbItem[] = [{ name: "Home", url: "/" }];
  
  if (stateName && stateSlug) {
    crumbs.push({ name: stateName, url: `/${stateSlug}/` });
  }
  
  if (cityName && citySlug && stateSlug) {
    crumbs.push({ name: cityName, url: `/${stateSlug}/${citySlug}/` });
  }
  
  crumbs.push({ name: dentistName, url: `/dentist/${dentistSlug}/` });
  
  return crumbs;
};

export default BreadcrumbSchema;
