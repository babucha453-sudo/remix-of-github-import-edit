import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import StatePage from "@/pages/StatePage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  stateSlug: string;
  stateData: any;
  citiesData: any[];
};

// Create server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Hardcoded state slugs as fallback
const HARDCODED_STATES = ['ca', 'ma', 'ct', 'nj'];

// Get all state slugs for static generation
export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: states } = await supabase
      .from('states')
      .select('slug')
      .eq('is_active', true);
    
    const dbPaths = (states || []).map((state: any) => ({
      params: { stateSlug: state.slug },
    }));
    
    // Always include hardcoded states in paths
    const hardcodedPaths = HARDCODED_STATES.map(slug => ({ params: { stateSlug: slug } }));
    
    // Merge and deduplicate
    const allPathsMap = new Map();
    [...hardcodedPaths, ...dbPaths].forEach(p => {
      allPathsMap.set(p.params.stateSlug, p);
    });
    
    console.log(`[ISR] Generating ${allPathsMap.size} state pages`);
    
    return {
      paths: Array.from(allPathsMap.values()),
      fallback: 'blocking',
    };
  } catch (error) {
    console.error('[ISR] Error fetching states:', error);
    return { 
      paths: HARDCODED_STATES.map(slug => ({ params: { stateSlug: slug } })),
      fallback: 'blocking' 
    };
  }
};

// Hardcoded state data as fallback
const HARDCODED_STATE_DATA: Record<string, any> = {
  'ca': { id: 'ca', name: 'California', slug: 'ca', abbreviation: 'CA' },
  'ma': { id: 'ma', name: 'Massachusetts', slug: 'ma', abbreviation: 'MA' },
  'ct': { id: 'ct', name: 'Connecticut', slug: 'ct', abbreviation: 'CT' },
  'nj': { id: 'nj', name: 'New Jersey', slug: 'nj', abbreviation: 'NJ' },
};

// ISR: Revalidate every 60 seconds
export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const stateSlug = params?.stateSlug as string;
  
  if (!stateSlug) {
    return { notFound: true };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const queryClient = new QueryClient();

  try {
    // Fetch state data
    const { data: state } = await supabase
      .from('states')
      .select('*')
      .eq('slug', stateSlug)
      .eq('is_active', true)
      .single();

    // If not found in DB, use hardcoded fallback
    const stateData = state || HARDCODED_STATE_DATA[stateSlug];
    
    if (!stateData) {
      console.log(`[ISR] State not found: ${stateSlug}`);
      return { notFound: true };
    }

    // Fetch cities in this state (empty array if DB fails)
    let cities: any[] = [];
    try {
      const { data: citiesData } = await supabase
        .from('cities')
        .select('*')
        .eq('state_id', stateData.id)
        .eq('is_active', true)
        .order('name');
      cities = citiesData || [];
    } catch (e) {
      console.log(`[ISR] Could not fetch cities for ${stateSlug}`);
    }

    // Fetch clinics in this state (empty array if DB fails)
    let clinics: any[] = [];
    try {
      const { data: clinicsData } = await supabase
        .from('clinics')
        .select('*, city:cities(name, slug)')
        .eq('state_id', stateData.id)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(20);
      clinics = clinicsData || [];
    } catch (e) {
      console.log(`[ISR] Could not fetch clinics for ${stateSlug}`);
    }

    // Prefetch data
    await queryClient.prefetchQuery({
      queryKey: ['state', stateSlug],
      queryFn: () => stateData,
    });

    await queryClient.prefetchQuery({
      queryKey: ['cities-by-state', stateData.id],
      queryFn: () => cities,
    });

    await queryClient.prefetchQuery({
      queryKey: ['clinics-by-state', stateData.id],
      queryFn: () => clinics,
    });

    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        stateSlug,
        stateData,
        citiesData: cities,
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error(`[ISR] Error fetching state ${stateSlug}:`, error);
    
    // Fallback to hardcoded data on error
    const fallbackState = HARDCODED_STATE_DATA[stateSlug];
    if (fallbackState) {
      await queryClient.prefetchQuery({
        queryKey: ['state', stateSlug],
        queryFn: () => fallbackState,
      });
      
      await queryClient.prefetchQuery({
        queryKey: ['cities-by-state', fallbackState.id],
        queryFn: () => [],
      });
      
      await queryClient.prefetchQuery({
        queryKey: ['clinics-by-state', fallbackState.id],
        queryFn: () => [],
      });
      
      return {
        props: {
          dehydratedState: dehydrate(queryClient),
          stateSlug,
          stateData: fallbackState,
          citiesData: [],
        },
        revalidate: 60,
      };
    }
    
    return { notFound: true };
  }
};

export default function StatePageWrapper({ dehydratedState, stateData, citiesData, stateSlug }: Props) {
  return (
    <HydrationBoundary key={stateSlug} state={dehydratedState}>
      <StatePage initialState={stateData} initialCities={citiesData} />
    </HydrationBoundary>
  );
}
