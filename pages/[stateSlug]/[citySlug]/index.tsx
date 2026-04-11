import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import CityPage from "@/pages/CityPage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  stateSlug: string;
  citySlug: string;
  stateData: any;
  cityData: any;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Hardcoded fallback data - more comprehensive list
const HARDCODED_STATES = ['ca', 'ma', 'ct', 'nj'];

const HARDCODED_CITIES: Record<string, string[]> = {
  'ca': ['los-angeles', 'san-diego', 'san-francisco', 'san-jose', 'sacramento', 'fresno', 'oakland', 'long-beach', 'bakersfield', 'anaheim', 'santa-ana', 'riverside', 'stockton', 'irvine', 'chula-vista'],
  'ma': ['boston', 'worcester', 'springfield', 'cambridge', 'lowell', 'brockton', 'quincy', 'lynn', 'fall-river', 'new-bedford', 'newton', 'somerville', 'waltham', 'malden', 'medford', 'arlington', 'attleboro', 'barnstable', 'billerica', 'brookline'],
  'ct': ['hartford', 'new-haven', 'stamford', 'bridgeport', 'waterbury', 'norwalk', 'danbury', 'new-britain', 'west-hartford', 'fairfield', 'bristol', 'meriden', 'manchester'],
  'nj': ['newark', 'jersey-city', 'paterson', 'elizabeth', 'trenton', 'camden', 'woodbridge', 'edison', 'toms-river', 'hamilton', 'lakewood', 'brick', 'freehold'],
};

export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get all active cities from DB
    const { data: cities } = await supabase
      .from('cities')
      .select('slug, state:states(slug)')
      .eq('is_active', true)
      .limit(500);
    
    const dbPaths = (cities || []).map((city: any) => ({
      params: { 
        stateSlug: city.state?.slug || 'ca', 
        citySlug: city.slug 
      },
    }));
    
    // Always include ALL hardcoded cities in paths to ensure they're pre-built
    const hardcodedPaths: { params: { stateSlug: string; citySlug: string } }[] = [];
    for (const [state, cities] of Object.entries(HARDCODED_CITIES)) {
      for (const city of cities) {
        hardcodedPaths.push({ params: { stateSlug: state, citySlug: city } });
      }
    }
    
    // Merge DB paths with hardcoded paths, deduplicating
    const allPathsMap = new Map();
    [...hardcodedPaths, ...dbPaths].forEach(p => {
      allPathsMap.set(`${p.params.stateSlug}/${p.params.citySlug}`, p);
    });
    
    return { paths: Array.from(allPathsMap.values()), fallback: 'blocking' };
  } catch (error) {
    console.error('[ISR] Error fetching cities:', error);
    // Fallback to hardcoded
    const fallbackPaths: { params: { stateSlug: string; citySlug: string } }[] = [];
    for (const [state, cities] of Object.entries(HARDCODED_CITIES)) {
      for (const city of cities) {
        fallbackPaths.push({ params: { stateSlug: state, citySlug: city } });
      }
    }
    return { paths: fallbackPaths, fallback: 'blocking' };
  }
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const stateSlug = params?.stateSlug as string;
  const citySlug = params?.citySlug as string;
  
  if (!stateSlug || !citySlug) {
    return { notFound: true };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const queryClient = new QueryClient();
  
  // First check if it's in our hardcoded list - if so, allow rendering
  const isKnownCity = HARDCODED_CITIES[stateSlug]?.includes(citySlug);
  
  try {
    // Try to fetch state
    let state: any = null;
    try {
      const { data: stateData } = await supabase
        .from('states')
        .select('*')
        .eq('slug', stateSlug)
        .eq('is_active', true)
        .single();
      state = stateData;
    } catch (e) {
      console.log('[ISR] State not found in DB, using fallback');
    }
    
    // Use fallback state data if not found
    const fallbackStateData: Record<string, any> = {
      'ca': { id: 'ca', name: 'California', slug: 'ca', abbreviation: 'CA' },
      'ma': { id: 'ma', name: 'Massachusetts', slug: 'ma', abbreviation: 'MA' },
      'ct': { id: 'ct', name: 'Connecticut', slug: 'ct', abbreviation: 'CT' },
      'nj': { id: 'nj', name: 'New Jersey', slug: 'nj', abbreviation: 'NJ' },
    };
    
    const stateData = state || fallbackStateData[stateSlug];
    
    if (!stateData && !isKnownCity) {
      return { notFound: true };
    }
    
    // Try to fetch city
    let city: any = null;
    try {
      if (stateData?.id) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('*, state:states(*)')
          .eq('slug', citySlug)
          .eq('state_id', stateData.id)
          .eq('is_active', true)
          .single();
        city = cityData;
      }
    } catch (e) {
      console.log('[ISR] City not found in DB');
    }
    
    // Create a fallback city object for known cities
    const fallbackCityData: Record<string, any> = {};
    for (const [st, cities] of Object.entries(HARDCODED_CITIES)) {
      for (const c of cities) {
        const stateInfo = fallbackStateData[st];
        fallbackCityData[`${st}-${c}`] = {
          id: c,
          name: c.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          slug: c,
          state_id: stateInfo?.id,
          state: stateInfo,
          is_active: true,
        };
      }
    }
    
    const cityData = city || fallbackCityData[`${stateSlug}-${citySlug}`];
    
    // Don't return 404 for known cities - let them render
    if (!cityData && !isKnownCity) {
      return { notFound: true };
    }
    
    // Prefetch data for hydration
    await queryClient.prefetchQuery({
      queryKey: ['state', stateSlug],
      queryFn: () => stateData,
    });
    
    await queryClient.prefetchQuery({
      queryKey: ['city', citySlug, stateSlug],
      queryFn: () => cityData,
    });
    
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        stateSlug,
        citySlug,
        stateData,
        cityData,
      },
      revalidate: 60, // ISR: Revalidate every 60 seconds
    };
  } catch (error) {
    console.error('[ISR] Error fetching city:', error);
    // For known cities, don't return 404 even on error
    const isKnownCity = HARDCODED_CITIES[params?.stateSlug as string]?.includes(params?.citySlug as string);
    if (isKnownCity) {
      return {
        props: {
          dehydratedState: dehydrate(queryClient),
          stateSlug: params?.stateSlug as string,
          citySlug: params?.citySlug as string,
          stateData: null,
          cityData: null,
        },
        revalidate: 60,
      };
    }
    return { notFound: true };
  }
};

export default function CityPageWrapper({ dehydratedState, stateSlug, citySlug, stateData, cityData }: Props) {
  return (
    <HydrationBoundary key={`${stateSlug}-${citySlug}`} state={dehydratedState}>
      <CityPage initialState={stateData} initialCity={cityData} />
    </HydrationBoundary>
  );
}
