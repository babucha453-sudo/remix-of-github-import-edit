import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { State, City, Area } from '@/types/database';
import { normalizeStateSlug } from '@/lib/slug/normalizeStateSlug';
import { ACTIVE_STATE_SLUGS, isActiveState } from '@/lib/constants/activeStates';

export function useStates() {
  return useQuery({
    queryKey: ['states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .eq('is_active', true)
        .in('slug', ACTIVE_STATE_SLUGS)
        .order('display_order');
      
      if (error) throw error;
      return data as State[];
    },
    staleTime: 10 * 60 * 1000, // Cache states for 10 minutes (rarely change)
    gcTime: 30 * 60 * 1000,
  });
}

// Only return states that have at least one approved clinic (and are active)
export function useStatesWithClinics() {
  return useQuery({
    queryKey: ['states-with-clinics'],
    queryFn: async (): Promise<State[]> => {
      // Get all active states (only from the active states list)
      const { data: allStates, error: statesError } = await supabase
        .from('states')
        .select('*')
        .eq('is_active', true)
        .in('slug', ACTIVE_STATE_SLUGS)
        .order('display_order');
      
      if (statesError) throw statesError;
      if (!allStates || allStates.length === 0) return [];

      // Get active clinics - cast to any to avoid TS deep instantiation issue with Supabase types
      const { data: clinicsRaw, error: clinicError } = await (supabase
        .from('clinics')
        .select('city_id') as any)
        .eq('is_active', true)
        .eq('is_duplicate', false);
      
      if (clinicError) throw clinicError;
      
      const clinics = clinicsRaw as Array<{ city_id: string | null }> | null;
      
      // Get city IDs
      const cityIds = (clinics || []).map(c => c.city_id).filter((id): id is string => id !== null);
      if (cityIds.length === 0) return [];

      // Get cities with their state IDs (only active cities)
      const { data: citiesRaw, error: citiesError } = await supabase
        .from('cities')
        .select('id, state_id')
        .eq('is_active', true);
      
      if (citiesError) throw citiesError;
      
      const citiesData = citiesRaw as Array<{ id: string; state_id: string | null }> | null;

      // Filter to cities that have clinics and extract state IDs
      const cityIdSet = new Set(cityIds);
      const stateIdSet = new Set<string>();
      (citiesData || []).forEach(city => {
        if (cityIdSet.has(city.id) && city.state_id) {
          stateIdSet.add(city.state_id);
        }
      });

      // Filter states that have clinics
      return allStates.filter(state => stateIdSet.has(state.id)) as State[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes cache
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useState(slug: string, initialData?: any) {
  const normalized = normalizeStateSlug(slug);
  return useQuery({
    queryKey: ['state', normalized],
    queryFn: async () => {
      // Return initial data if provided and available
      if (initialData) return initialData;
      
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .eq('slug', normalized)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as State | null;
    },
    enabled: !!normalized,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialData: initialData || undefined,
  });
}

export function useCities(stateId?: string) {
  return useQuery({
    queryKey: ['cities', stateId],
    queryFn: async () => {
      let query = supabase
        .from('cities')
        .select(`
          *,
          state:states(*)
        `)
        .eq('is_active', true)
        .not('state_id', 'is', null)
        .order('name');

      if (stateId) {
        query = query.eq('state_id', stateId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as City[];
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000,
  });
}

export function useCitiesByStateSlug(stateSlug: string, initialData?: any[]) {
  const normalized = normalizeStateSlug(stateSlug);
  
  const HARDCODED_CITIES: Record<string, City[]> = {
    'ca': [
      { id: 'ca-los-angeles', name: 'Los Angeles', slug: 'los-angeles', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-san-diego', name: 'San Diego', slug: 'san-diego', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-san-francisco', name: 'San Francisco', slug: 'san-francisco', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-san-jose', name: 'San Jose', slug: 'san-jose', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-sacramento', name: 'Sacramento', slug: 'sacramento', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-fresno', name: 'Fresno', slug: 'fresno', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-oakland', name: 'Oakland', slug: 'oakland', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-long-beach', name: 'Long Beach', slug: 'long-beach', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-bakersfield', name: 'Bakersfield', slug: 'bakersfield', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-anaheim', name: 'Anaheim', slug: 'anaheim', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-santa-ana', name: 'Santa Ana', slug: 'santa-ana', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-riverside', name: 'Riverside', slug: 'riverside', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-stockton', name: 'Stockton', slug: 'stockton', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-irvine', name: 'Irvine', slug: 'irvine', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-chula-vista', name: 'Chula Vista', slug: 'chula-vista', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-alameda', name: 'Alameda', slug: 'alameda', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-alhambra', name: 'Alhambra', slug: 'alhambra', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-apple-valley', name: 'Apple Valley', slug: 'apple-valley', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ca-baldwin-park', name: 'Baldwin Park', slug: 'baldwin-park', state_id: 'ca', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
    ],
    'ma': [
      { id: 'ma-boston', name: 'Boston', slug: 'boston', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-worcester', name: 'Worcester', slug: 'worcester', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-springfield', name: 'Springfield', slug: 'springfield', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-cambridge', name: 'Cambridge', slug: 'cambridge', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-lowell', name: 'Lowell', slug: 'lowell', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-brockton', name: 'Brockton', slug: 'brockton', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-quincy', name: 'Quincy', slug: 'quincy', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-lynn', name: 'Lynn', slug: 'lynn', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-fall-river', name: 'Fall River', slug: 'fall-river', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ma-new-bedford', name: 'New Bedford', slug: 'new-bedford', state_id: 'ma', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
    ],
    'ct': [
      { id: 'ct-hartford', name: 'Hartford', slug: 'hartford', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ct-new-haven', name: 'New Haven', slug: 'new-haven', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ct-stamford', name: 'Stamford', slug: 'stamford', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ct-bridgeport', name: 'Bridgeport', slug: 'bridgeport', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ct-waterbury', name: 'Waterbury', slug: 'waterbury', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ct-norwalk', name: 'Norwalk', slug: 'norwalk', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ct-danbury', name: 'Danbury', slug: 'danbury', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'ct-new-britain', name: 'New Britain', slug: 'new-britain', state_id: 'ct', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
    ],
    'nj': [
      { id: 'nj-newark', name: 'Newark', slug: 'newark', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'nj-jersey-city', name: 'Jersey City', slug: 'jersey-city', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'nj-paterson', name: 'Paterson', slug: 'paterson', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'nj-elizabeth', name: 'Elizabeth', slug: 'elizabeth', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'nj-trenton', name: 'Trenton', slug: 'trenton', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'nj-camden', name: 'Camden', slug: 'camden', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'nj-woodbridge', name: 'Woodbridge', slug: 'woodbridge', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
      { id: 'nj-edison', name: 'Edison', slug: 'edison', state_id: 'nj', country: 'us', image_url: null, dentist_count: 0, is_active: true, created_at: '', updated_at: '' } as unknown as City,
    ],
  };
  
  return useQuery({
    queryKey: ['cities-by-state', normalized],
    queryFn: async () => {
      // Return initial data if provided
      if (initialData) return initialData;
      
      try {
        const { data: stateData, error: stateError } = await supabase
          .from('states')
          .select('id')
          .eq('slug', normalized)
          .maybeSingle();
        
        if (stateError) throw stateError;
        if (!stateData) return HARDCODED_CITIES[normalized || ''] || [];

        const { data, error } = await supabase
          .from('cities')
          .select(`
            *,
            state:states(*)
          `)
          .eq('state_id', stateData.id)
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        
        // If DB returns too few cities, supplement with hardcoded
        if (!data || data.length < 5) {
          const hardcoded = HARDCODED_CITIES[normalized || ''] || [];
          if (data && data.length > 0) {
            const dbSlugs = new Set(data.map((c: any) => c.slug));
            const hardcodedFiltered = hardcoded.filter((c: City) => !dbSlugs.has(c.slug));
            return [...data, ...hardcodedFiltered] as City[];
          }
          return hardcoded;
        }
        
        return data as City[];
      } catch (error) {
        console.warn('[useCitiesByStateSlug] DB error, using hardcoded:', error);
        return HARDCODED_CITIES[normalized || ''] || [];
      }
    },
    enabled: !!normalized,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialData: initialData || undefined,
  });
}

export function useCity(slug: string, stateSlug?: string, initialData?: any) {
  const normalizedStateSlug = stateSlug ? normalizeStateSlug(stateSlug) : null;
  return useQuery({
    queryKey: ['city', slug, normalizedStateSlug],
    queryFn: async () => {
      // Return initial data if provided and available
      if (initialData) return initialData;
      
      // Build query based on whether we have a state slug
      let query = supabase
        .from('cities')
        .select(`
          *,
          state:states(*)
        `)
        .eq('slug', slug)
        .eq('is_active', true);
      
      const { data: cities, error } = await query;
      
      if (error) throw error;
      if (!cities || cities.length === 0) return null;
      
      // If we have a state slug, filter to the matching state
      if (normalizedStateSlug) {
        const matchingCity = cities.find(
          (city: any) => city.state?.slug === normalizedStateSlug
        );
        return (matchingCity as City) || null;
      }
      
      // Otherwise return the first match (legacy behavior)
      return cities[0] as City | null;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialData: initialData || undefined,
  });
}

export function useAreas(cityId?: string) {
  return useQuery({
    queryKey: ['areas', cityId],
    queryFn: async () => {
      let query = supabase
        .from('areas')
        .select(`
          *,
          city:cities(*, state:states(*))
        `)
        .eq('is_active', true)
        .order('name');

      if (cityId) {
        query = query.eq('city_id', cityId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Area[];
    },
  });
}

// Helper to format location display
export function formatLocation(city?: City | null, state?: State | null): string {
  if (city && city.state) {
    return `${city.name}, ${city.state.abbreviation}`;
  }
  if (city && state) {
    return `${city.name}, ${state.abbreviation}`;
  }
  if (city) {
    return city.name;
  }
  if (state) {
    return state.name;
  }
  return 'United States';
}
