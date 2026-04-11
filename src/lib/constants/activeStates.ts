/**
 * Active States Configuration
 * 
 * These are the only states that are live on the platform.
 * All UI features, scrapers, content management, and location filters
 * MUST restrict to these states only.
 */

export const ACTIVE_STATE_SLUGS = ['ca', 'ct', 'ma', 'nj'];
export type ActiveStateSlug = 'ca' | 'ct' | 'ma' | 'nj';

export const ACTIVE_STATES = [
  { name: 'California', slug: 'ca', abbr: 'CA' },
  { name: 'Connecticut', slug: 'ct', abbr: 'CT' },
  { name: 'Massachusetts', slug: 'ma', abbr: 'MA' },
  { name: 'New Jersey', slug: 'nj', abbr: 'NJ' },
] as const;

export type ActiveState = typeof ACTIVE_STATES[number];

/**
 * Check if a state slug is in the active states list
 */
export function isActiveState(slug: string): boolean {
  const lower = slug.toLowerCase();
  return ACTIVE_STATE_SLUGS.includes(lower);
}

/**
 * Map of abbreviation to full slug for DB queries
 */
const ABBREV_TO_FULL: Record<string, string> = {
  ca: 'california',
  ct: 'connecticut',
  ma: 'massachusetts',
  nj: 'new-jersey',
};

export function getFullSlug(slug: string): string {
  const lower = slug.toLowerCase();
  return ABBREV_TO_FULL[lower] ?? lower;
}

/**
 * Filter an array of states to only include active ones
 */
export function filterActiveStates<T extends { slug?: string | null }>(states: T[]): T[] {
  return states.filter(state => state.slug && isActiveState(state.slug));
}

/**
 * Get state info by slug
 */
export function getActiveStateBySlug(slug: string): ActiveState | undefined {
  return ACTIVE_STATES.find(s => s.slug === slug.toLowerCase());
}

/**
 * Check if an SEO page slug belongs to an active state.
 * This is used to filter SEO pages in admin interfaces.
 * 
 * Rules:
 * - Static pages (no state prefix): always included
 * - Blog pages: always included
 * - State/City/Service-Location pages: must start with active state slug or full name
 * - Clinic/Dentist pages: always included (use city-based filtering in other ways)
 * - Treatment/service pages: always included
 */
export function isPageInActiveState(pageSlug: string, pageType?: string): boolean {
  // Normalize the slug (remove leading slash, lowercase)
  const normalized = pageSlug.replace(/^\/+/, '').toLowerCase();
  
  // Static pages, blog posts, profile pages, and treatment pages are always included
  if (pageType === 'static' || pageType === 'blog' || pageType === 'clinic' || 
      pageType === 'dentist' || pageType === 'treatment') {
    return true;
  }
  
  // If slug is empty or just a slash, include it
  if (!normalized || normalized === '/') {
    return true;
  }
  
  // Check if it starts with an active state slug (abbreviation like 'ca', 'ct', 'ma', 'nj')
  for (const stateSlug of ACTIVE_STATE_SLUGS) {
    // Match "ca", "ca/", "ca/city-name", etc.
    if (normalized === stateSlug || normalized.startsWith(`${stateSlug}/`)) {
      return true;
    }
  }
  
  // Services pages (/services/xxx) are always included
  if (normalized.startsWith('services/') || normalized === 'services') {
    return true;
  }
  
  // Page doesn't match any active state
  return false;
}
