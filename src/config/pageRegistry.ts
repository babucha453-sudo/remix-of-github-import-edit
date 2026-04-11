/**
 * Page Registry - Master configuration for all pages in the platform
 * 
 * This registry defines which pages are indexable by search engines and their render mode.
 * 
 * RENDER MODES:
 * - PRERENDER: Pre-generated static HTML served to bots (via serve-static edge function)
 * - CSR: Client-side rendering only, no prerendering needed
 * 
 * NOTE: True SSR is not available on this platform (Lovable Cloud / Vercel serverless).
 * We achieve SEO parity using prerendering + bot detection instead.
 */

export type RenderMode = 'PRERENDER' | 'CSR';

export type PageType = 
  | 'home'
  | 'state'
  | 'city'
  | 'service'
  | 'service-location'
  | 'clinic'
  | 'dentist'
  | 'blog-index'
  | 'blog-post'
  | 'insurance-index'
  | 'insurance-detail'
  | 'static'
  | 'auth'
  | 'admin'
  | 'utility';

export interface PageRegistryEntry {
  route: string;
  pageType: PageType;
  indexable: boolean;
  renderMode: RenderMode;
  description: string;
  priority?: number; // 0.0 - 1.0 for sitemap
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

/**
 * INDEXABLE PAGES - Must be prerendered for SEO
 * These pages need full HTML content visible in View Page Source
 */
export const INDEXABLE_PAGES: PageRegistryEntry[] = [
  // ==================== HOME ====================
  {
    route: '/',
    pageType: 'home',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Homepage - main entry point',
    priority: 1.0,
    changefreq: 'daily',
  },

  // ==================== LOCATION PAGES ====================
  {
    route: '/:stateSlug',
    pageType: 'state',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'State directory pages (e.g., /ca)',
    priority: 0.9,
    changefreq: 'weekly',
  },
  {
    route: '/:stateSlug/:citySlug',
    pageType: 'city',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'City directory pages (e.g., /ca/los-angeles)',
    priority: 0.8,
    changefreq: 'weekly',
  },

  // ==================== SERVICE PAGES ====================
  {
    route: '/services',
    pageType: 'service',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'All services index page',
    priority: 0.8,
    changefreq: 'weekly',
  },
  {
    route: '/services/:serviceSlug',
    pageType: 'service',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Individual service pages (e.g., /services/teeth-whitening)',
    priority: 0.7,
    changefreq: 'monthly',
  },

  // ==================== SERVICE + LOCATION COMBINATIONS ====================
  {
    route: '/:stateSlug/:citySlug/:serviceSlug',
    pageType: 'service-location',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Service in location (e.g., /ca/los-angeles/cosmetic-dentist)',
    priority: 0.8,
    changefreq: 'weekly',
  },

  // ==================== PROFILE PAGES ====================
  {
    route: '/clinic/:clinicSlug',
    pageType: 'clinic',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Clinic profile pages',
    priority: 0.7,
    changefreq: 'weekly',
  },
  {
    route: '/dentist/:dentistSlug',
    pageType: 'dentist',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Dentist profile pages',
    priority: 0.7,
    changefreq: 'weekly',
  },

  // ==================== BLOG ====================
  {
    route: '/blog',
    pageType: 'blog-index',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Blog index page',
    priority: 0.8,
    changefreq: 'daily',
  },
  {
    route: '/blog/:postSlug',
    pageType: 'blog-post',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Individual blog posts',
    priority: 0.6,
    changefreq: 'monthly',
  },

  // ==================== INSURANCE ====================
  {
    route: '/insurance',
    pageType: 'insurance-index',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Insurance providers index',
    priority: 0.7,
    changefreq: 'weekly',
  },
  {
    route: '/insurance/:insuranceSlug',
    pageType: 'insurance-detail',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Insurance provider detail pages',
    priority: 0.6,
    changefreq: 'monthly',
  },

  // ==================== STATIC/INFORMATIONAL PAGES ====================
  {
    route: '/about',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'About page',
    priority: 0.5,
    changefreq: 'monthly',
  },
  {
    route: '/contact',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Contact page',
    priority: 0.5,
    changefreq: 'monthly',
  },
  {
    route: '/faq',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'FAQ page',
    priority: 0.5,
    changefreq: 'monthly',
  },
  {
    route: '/how-it-works',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'How it works page',
    priority: 0.5,
    changefreq: 'monthly',
  },
  {
    route: '/privacy',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Privacy policy',
    priority: 0.3,
    changefreq: 'yearly',
  },
  {
    route: '/terms',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Terms of service',
    priority: 0.3,
    changefreq: 'yearly',
  },
  {
    route: '/sitemap',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'HTML sitemap',
    priority: 0.4,
    changefreq: 'weekly',
  },
  {
    route: '/pricing',
    pageType: 'static',
    indexable: true,
    renderMode: 'PRERENDER',
    description: 'Pricing page',
    priority: 0.6,
    changefreq: 'monthly',
  },
  {
    route: '/search',
    pageType: 'utility',
    indexable: false, // Search results should not be indexed
    renderMode: 'CSR',
    description: 'Search results page (noindex)',
  },
  {
    route: '/find-dentist',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Find dentist search (noindex)',
  },
];

/**
 * PRIVATE PAGES - CSR only, blocked from indexing
 * These pages require authentication or are internal tools
 */
export const PRIVATE_PAGES: PageRegistryEntry[] = [
  // ==================== ADMIN / DASHBOARD ====================
  {
    route: '/admin',
    pageType: 'admin',
    indexable: false,
    renderMode: 'CSR',
    description: 'Admin dashboard',
  },
  {
    route: '/dashboard',
    pageType: 'admin',
    indexable: false,
    renderMode: 'CSR',
    description: 'User dashboard (redirects to admin)',
  },

  // ==================== AUTH ====================
  {
    route: '/auth',
    pageType: 'auth',
    indexable: false,
    renderMode: 'CSR',
    description: 'Login/signup page',
  },
  {
    route: '/auth/callback',
    pageType: 'auth',
    indexable: false,
    renderMode: 'CSR',
    description: 'OAuth callback handler',
  },
  {
    route: '/onboarding',
    pageType: 'auth',
    indexable: false,
    renderMode: 'CSR',
    description: 'GMB onboarding flow',
  },
  {
    route: '/gmb-select',
    pageType: 'auth',
    indexable: false,
    renderMode: 'CSR',
    description: 'GMB business selection',
  },

  // ==================== BUSINESS UTILITIES ====================
  {
    route: '/claim-profile',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Profile claim form',
  },
  {
    route: '/list-your-practice',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Practice listing form',
  },
  {
    route: '/list-your-practice/success',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Listing success confirmation',
  },
  {
    route: '/review/:clinicId',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Review funnel page',
  },
  {
    route: '/rq/:requestCode',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Review request handler',
  },
  {
    route: '/appointment/:token',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Appointment management',
  },
  {
    route: '/form/:submissionId',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Patient intake form',
  },
  {
    route: '/book/:clinicId',
    pageType: 'utility',
    indexable: false,
    renderMode: 'CSR',
    description: 'Direct booking page',
  },
];

/**
 * Get all pages in the registry
 */
export const ALL_PAGES = [...INDEXABLE_PAGES, ...PRIVATE_PAGES];

/**
 * Check if a route pattern is indexable
 */
export function isRouteIndexable(routePattern: string): boolean {
  const page = ALL_PAGES.find(p => p.route === routePattern);
  return page?.indexable ?? false;
}

/**
 * Get page config by route pattern
 */
export function getPageConfig(routePattern: string): PageRegistryEntry | undefined {
  return ALL_PAGES.find(p => p.route === routePattern);
}

/**
 * Get all indexable page types for sitemap generation
 */
export function getIndexablePageTypes(): PageType[] {
  return [...new Set(INDEXABLE_PAGES.map(p => p.pageType))];
}

/**
 * CRITICAL: Classify a real path to determine its indexability and render mode.
 * This is the core utility for determining how to handle any URL in the system.
 * 
 * @param pathname - The actual URL path (e.g., "/ca/los-angeles/")
 * @returns Classification result with indexable status, render mode, and matched page type
 */
export interface PathClassification {
  indexable: boolean;
  renderMode: RenderMode;
  pageType: PageType | null;
  matchedRoute: string | null;
}

export function classifyPath(pathname: string): PathClassification {
  // Normalize: ensure no trailing slash for matching (except root)
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  
  // First check exact matches in private pages (highest priority)
  for (const page of PRIVATE_PAGES) {
    if (matchRoute(page.route, normalizedPath)) {
      return {
        indexable: false,
        renderMode: 'CSR',
        pageType: page.pageType,
        matchedRoute: page.route,
      };
    }
  }
  
  // Then check indexable pages
  for (const page of INDEXABLE_PAGES) {
    if (matchRoute(page.route, normalizedPath)) {
      return {
        indexable: page.indexable,
        renderMode: page.renderMode,
        pageType: page.pageType,
        matchedRoute: page.route,
      };
    }
  }
  
  // Unknown path - default to CSR, not indexable
  return {
    indexable: false,
    renderMode: 'CSR',
    pageType: null,
    matchedRoute: null,
  };
}

/**
 * Match a route pattern against an actual path
 * Supports :param style route parameters
 */
function matchRoute(routePattern: string, actualPath: string): boolean {
  // Normalize both paths
  const routeParts = routePattern.split('/').filter(Boolean);
  const pathParts = actualPath.split('/').filter(Boolean);
  
  // Quick length check (except for dynamic segments)
  if (routeParts.length !== pathParts.length) {
    return false;
  }
  
  // Match each segment
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];
    
    // Dynamic segment (starts with :)
    if (routePart.startsWith(':')) {
      // Any non-empty value matches
      if (!pathPart) return false;
      continue;
    }
    
    // Static segment - must match exactly
    if (routePart !== pathPart) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a path is definitively indexable (for SEO enforcement)
 * This is the authoritative check - if true, the page MUST NOT have noindex
 */
export function isPathIndexable(pathname: string): boolean {
  const classification = classifyPath(pathname);
  return classification.indexable;
}

/**
 * URLs that should have noindex meta tag
 * DEPRECATED: Use classifyPath() instead for consistent behavior
 */
export const NOINDEX_PATTERNS = [
  '/admin',
  '/dashboard',
  '/auth',
  '/onboarding',
  '/gmb-select',
  '/claim-profile',
  '/list-your-practice',
  '/review/',
  '/rq/',
  '/appointment/',
  '/form/',
  '/book/',
  '/search',
  '/find-dentist',
];

/**
 * Check if a URL should have noindex
 * @deprecated Use classifyPath(pathname).indexable === false instead
 */
export function shouldNoIndex(pathname: string): boolean {
  // Use the new classification system
  return !classifyPath(pathname).indexable;
}

/**
 * Summary statistics for the registry
 */
export const REGISTRY_STATS = {
  totalIndexablePatterns: INDEXABLE_PAGES.length,
  totalPrivatePatterns: PRIVATE_PAGES.length,
  pageTypes: {
    indexable: getIndexablePageTypes(),
    private: [...new Set(PRIVATE_PAGES.map(p => p.pageType))],
  },
};

/**
 * Dynamic page counts - these are populated from the database
 * Used by the static page generator and sitemap
 */
export interface DynamicPageCounts {
  states: number;
  cities: number;
  services: number;
  serviceLocations: number;
  clinics: number;
  dentists: number;
  blogPosts: number;
  insurances: number;
}

/**
 * Estimated total indexable URLs based on typical counts
 * Actual counts should be fetched from the database
 */
export const ESTIMATED_PAGE_COUNTS: DynamicPageCounts = {
  states: 51, // 50 states + DC
  cities: 100, // Active cities with clinics
  services: 35, // Treatment types
  serviceLocations: 5000, // cities × services (filtered)
  clinics: 6600, // Active clinic profiles
  dentists: 3000, // Active dentist profiles
  blogPosts: 200, // Published blog posts
  insurances: 30, // Insurance providers
};
