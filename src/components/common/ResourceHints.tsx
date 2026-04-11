/**
 * ResourceHints - Preload, prefetch, and preconnect hints for performance
 * 
 * This component adds resource hints to the document head
 * to optimize loading of critical resources.
 */

import { Helmet } from 'react-helmet-async';

interface ResourceHintsProps {
  /** URLs to preload (critical resources for current page) */
  preloadUrls?: Array<{
    href: string;
    as: 'script' | 'style' | 'image' | 'font' | 'fetch';
    type?: string;
    crossOrigin?: 'anonymous' | 'use-credentials';
  }>;
  /** URLs to prefetch (resources for likely next navigation) */
  prefetchUrls?: string[];
  /** Domains to preconnect to */
  preconnectDomains?: string[];
  /** DNS prefetch domains (lower priority than preconnect) */
  dnsPrefetchDomains?: string[];
}

// Default preconnect domains for the application
const DEFAULT_PRECONNECTS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://images.unsplash.com',
];

export const ResourceHints = ({
  preloadUrls = [],
  prefetchUrls = [],
  preconnectDomains = DEFAULT_PRECONNECTS,
  dnsPrefetchDomains = [],
}: ResourceHintsProps) => {
  return (
    <Helmet>
      {/* Preconnect to critical domains */}
      {preconnectDomains.map((domain) => (
        <link
          key={`preconnect-${domain}`}
          rel="preconnect"
          href={domain}
          crossOrigin="anonymous"
        />
      ))}

      {/* DNS prefetch for lower-priority domains */}
      {dnsPrefetchDomains.map((domain) => (
        <link
          key={`dns-prefetch-${domain}`}
          rel="dns-prefetch"
          href={domain}
        />
      ))}

      {/* Preload critical resources */}
      {preloadUrls.map((resource) => (
        <link
          key={`preload-${resource.href}`}
          rel="preload"
          href={resource.href}
          as={resource.as}
          type={resource.type}
          crossOrigin={resource.crossOrigin}
        />
      ))}

      {/* Prefetch likely next page resources */}
      {prefetchUrls.map((url) => (
        <link key={`prefetch-${url}`} rel="prefetch" href={url} />
      ))}
    </Helmet>
  );
};

/**
 * Hook to prefetch a route's code when user hovers over a link
 */
export const usePrefetchOnHover = () => {
  const prefetchedRoutes = new Set<string>();

  const prefetchRoute = (route: string) => {
    if (prefetchedRoutes.has(route)) return;
    prefetchedRoutes.add(route);

    // Create a prefetch link
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = route;
    document.head.appendChild(link);
  };

  return { prefetchRoute };
};

export default ResourceHints;
