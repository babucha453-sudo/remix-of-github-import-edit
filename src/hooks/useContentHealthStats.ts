import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllWithRange } from '@/lib/api/fetchAllWithRange';

// Hardcoded active state slugs (abbreviations used in database)
const ACTIVE_STATE_SLUGS = ['ca', 'ct', 'ma', 'nj'];

export interface ContentHealthStats {
  total: number;
  good: number;
  thin: number;
  missing: number;
  byType: {
    page_type: string;
    total: number;
    good: number;
    thin: number;
    missing: number;
  }[];
}

/**
 * Check if a slug belongs to an active state.
 * Only pages starting with ca/, ct/, ma/, nj/ are considered valid.
 */
function isActiveStateSlug(slug: string, pageType: string): boolean {
  if (!slug) return false;
  
  // Non-location page types are always valid
  if (['static', 'blog', 'treatment', 'clinic'].includes(pageType)) return true;
  
  const normalized = slug.toLowerCase().replace(/^\//, ''); // Remove leading slash
  
  // Check for clinic/dentist paths (always valid)
  if (normalized.startsWith('clinic/') || normalized.startsWith('dentist/')) return true;
  if (normalized.startsWith('services') || normalized.startsWith('blog') || normalized.startsWith('insurance')) return true;
  
  // Location pages must start with an active state abbreviation
  for (const stateSlug of ACTIVE_STATE_SLUGS) {
    if (normalized === stateSlug || normalized.startsWith(`${stateSlug}/`)) {
      return true;
    }
  }
  
  return false;
}

export function useContentHealthStats() {
  return useQuery({
    queryKey: ['content-health-stats-v2'],
    queryFn: async (): Promise<ContentHealthStats> => {
      // PostgREST defaults to 1,000 rows unless we explicitly page.
      // For accurate stats across 20k+ pages we must fetch in chunks.
      const pages = await fetchAllWithRange<{ page_type: string | null; word_count: number | null; slug: string }>(
        async (from, to) => {
          const { data, error } = await supabase
            .from('seo_pages')
            .select('page_type, word_count, slug')
            .range(from, to);
          if (error) throw error;
          return data || [];
        }
      );
      
      const stats: ContentHealthStats = {
        total: 0,
        good: 0,
        thin: 0,
        missing: 0,
        byType: []
      };
      
      const typeMap = new Map<string, { total: number; good: number; thin: number; missing: number }>();
      
      for (const page of pages) {
        const pageType = page.page_type || 'unknown';
        
        // Skip pages from inactive states
        if (!isActiveStateSlug(page.slug, pageType)) continue;
        
        const wordCount = page.word_count ?? 0;
        
        // Service and service-location pages require 800+ words for "good" status
        // All other page types require 300+ words
        const minGoodWords = ['service', 'service_location'].includes(pageType) ? 800 : 300;
        
        let status: 'good' | 'thin' | 'missing';
        if (wordCount >= minGoodWords) {
          status = 'good';
          stats.good++;
        } else if (wordCount >= 1) {
          status = 'thin';
          stats.thin++;
        } else {
          status = 'missing';
          stats.missing++;
        }
        
        stats.total++;
        
        if (!typeMap.has(pageType)) {
          typeMap.set(pageType, { total: 0, good: 0, thin: 0, missing: 0 });
        }
        const typeStats = typeMap.get(pageType)!;
        typeStats.total++;
        typeStats[status]++;
      }
      
      stats.byType = Array.from(typeMap.entries()).map(([page_type, counts]) => ({
        page_type,
        ...counts
      })).sort((a, b) => b.missing - a.missing);
      
      return stats;
    },
    staleTime: 60000, // 1 minute
  });
}

