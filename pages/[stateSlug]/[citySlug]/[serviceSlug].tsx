import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ServiceLocationPage from "@/pages/ServiceLocationPage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  stateSlug: string;
  citySlug: string;
  serviceSlug: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Hardcoded fallback data
const HARDCODED_SERVICES = [
  'cosmetic-dentist', 'dental-implants', 'invisalign', 'teeth-whitening',
  'root-canal', 'root-canal-treatment', 'veneers', 'emergency-dentist', 'dental-crowns',
  'tooth-extraction', 'dentures', 'braces', 'oral-surgery', 'pediatric-dentist',
  'periodontist', 'orthodontist', 'endodontist', 'prosthodontist',
  'general-dentistry', 'teeth-cleaning', 'dental-fillings', 'dental-checkup',
  'dental-veneers', 'dental-bonding', 'dental-bridge', 'dental-sealants',
  'gum-disease', 'gum-treatment', 'sleep-apnea', 'tmj-treatment',
  'wisdom-teeth', 'dental-emergency', 'dental-x-rays', 'dental-exam'
];

const HARDCODED_CITIES: Record<string, string[]> = {
  'ca': ['los-angeles', 'san-diego', 'san-francisco', 'san-jose', 'sacramento', 'fresno', 'oakland', 'long-beach', 'bakersfield', 'anaheim'],
  'ma': ['boston', 'worcester', 'springfield', 'cambridge', 'lowell', 'brockton', 'quincy', 'lynn', 'arlington', 'attleboro', 'barnstable', 'billerica', 'brookline', 'medford', 'malden', 'newton', 'somerville'],
  'ct': ['hartford', 'new-haven', 'stamford', 'bridgeport', 'waterbury', 'norwalk', 'danbury', 'west-hartford', 'fairfield', 'bristol'],
  'nj': ['newark', 'jersey-city', 'paterson', 'elizabeth', 'trenton', 'camden', 'woodbridge', 'edison', 'toms-river', 'hamilton'],
};

const HARDCODED_STATES: Record<string, any> = {
  'ca': { id: 'ca', name: 'California', slug: 'ca', abbreviation: 'CA' },
  'ma': { id: 'ma', name: 'Massachusetts', slug: 'ma', abbreviation: 'MA' },
  'ct': { id: 'ct', name: 'Connecticut', slug: 'ct', abbreviation: 'CT' },
  'nj': { id: 'nj', name: 'New Jersey', slug: 'nj', abbreviation: 'NJ' },
};

export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get services
    const { data: services } = await supabase
      .from('treatments')
      .select('slug')
      .eq('is_active', true)
      .limit(100);
    
    const serviceSlugs = (services || []).map((s: any) => s.slug);
    
    // Generate paths for all state/city combinations
    const paths: { params: { stateSlug: string; citySlug: string; serviceSlug: string } }[] = [];
    
    for (const [state, cities] of Object.entries(HARDCODED_CITIES)) {
      for (const city of cities) {
        for (const service of (serviceSlugs.length > 0 ? serviceSlugs : HARDCODED_SERVICES).slice(0, 15)) {
          paths.push({
            params: { stateSlug: state, citySlug: city, serviceSlug: service }
          });
        }
      }
    }
    
    return { paths, fallback: 'blocking' };
  } catch (error) {
    console.error('[ISR] Error fetching service paths:', error);
    // Fallback
    const paths: { params: { stateSlug: string; citySlug: string; serviceSlug: string } }[] = [];
    
    for (const [state, cities] of Object.entries(HARDCODED_CITIES)) {
      for (const city of cities) {
        for (const service of HARDCODED_SERVICES) {
          paths.push({
            params: { stateSlug: state, citySlug: city, serviceSlug: service }
          });
        }
      }
    }
    
    return { paths, fallback: 'blocking' };
  }
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const stateSlug = params?.stateSlug as string;
  const citySlug = params?.citySlug as string;
  const serviceSlug = params?.serviceSlug as string;
  
  if (!stateSlug || !citySlug || !serviceSlug) {
    return { notFound: true };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const queryClient = new QueryClient();
  
  // Check if it's a known combination
  const isKnownState = HARDCODED_STATES[stateSlug];
  const isKnownCity = HARDCODED_CITIES[stateSlug]?.includes(citySlug);
  const isKnownService = HARDCODED_SERVICES.includes(serviceSlug);
  
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
      console.log('[ISR] State not found in DB');
    }
    
    const stateData = state || HARDCODED_STATES[stateSlug];
    
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
    
    // Create fallback city if known
    const cityData = city || (isKnownCity ? {
      id: citySlug,
      name: citySlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      slug: citySlug,
      state_id: stateData?.id,
      state: stateData,
      is_active: true,
    } : null);
    
    // Try to fetch service
    let service: any = null;
    try {
      const { data: serviceData } = await supabase
        .from('treatments')
        .select('*')
        .eq('slug', serviceSlug)
        .eq('is_active', true)
        .single();
      service = serviceData;
    } catch (e) {
      console.log('[ISR] Service not found in DB');
    }
    
    // Create fallback service if known
    const serviceData = service || (isKnownService ? {
      id: serviceSlug,
      name: serviceSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      slug: serviceSlug,
      is_active: true,
    } : null);
    
    // Don't return 404 for known combinations
    if (!stateData && !isKnownState) {
      return { notFound: true };
    }
    
    if (!cityData && !isKnownCity) {
      return { notFound: true };
    }
    
    if (!serviceData && !isKnownService) {
      return { notFound: true };
    }
    
    // Prefetch data
    await queryClient.prefetchQuery({
      queryKey: ['state', stateSlug],
      queryFn: () => stateData,
    });
    
    await queryClient.prefetchQuery({
      queryKey: ['city', citySlug, stateSlug],
      queryFn: () => cityData,
    });
    
    await queryClient.prefetchQuery({
      queryKey: ['service', serviceSlug],
      queryFn: () => serviceData,
    });
    
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        stateSlug,
        citySlug,
        serviceSlug,
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error('[ISR] Error fetching service location:', error);
    // For known combinations, don't return 404
    if (isKnownState && isKnownCity && isKnownService) {
      return {
        props: {
          dehydratedState: dehydrate(queryClient),
          stateSlug,
          citySlug,
          serviceSlug,
        },
        revalidate: 60,
      };
    }
    return { notFound: true };
  }
};

export default function ServiceLocationPageWrapper({ 
  dehydratedState, 
  stateSlug, 
  citySlug, 
  serviceSlug 
}: Props) {
  return (
    <HydrationBoundary key={`${stateSlug}-${citySlug}-${serviceSlug}`} state={dehydratedState}>
      <ServiceLocationPage />
    </HydrationBoundary>
  );
}
