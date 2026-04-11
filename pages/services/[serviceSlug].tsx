import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ServicePage from "@/pages/ServicePage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  serviceSlug: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: services } = await supabase
      .from('treatments')
      .select('slug')
      .eq('is_active', true);
    
    const dbPaths = (services || []).map((service: any) => ({
      params: { serviceSlug: service.slug },
    }));
    
    // Always include ALL hardcoded services in paths
    const hardcodedPaths = HARDCODED_SERVICES.map(slug => ({ params: { serviceSlug: slug } }));
    
    // Merge DB paths with hardcoded, deduplicate
    const allPathsMap = new Map();
    [...hardcodedPaths, ...dbPaths].forEach(p => {
      allPathsMap.set(p.params.serviceSlug, p);
    });
    
    return { paths: Array.from(allPathsMap.values()), fallback: 'blocking' };
  } catch (error) {
    return {
      paths: HARDCODED_SERVICES.map(slug => ({ params: { serviceSlug: slug } })),
      fallback: 'blocking',
    };
  }
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const serviceSlug = params?.serviceSlug as string;
  
  if (!serviceSlug) {
    return { notFound: true };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const queryClient = new QueryClient();
  
  // Check if it's a known service
  const isKnownService = HARDCODED_SERVICES.includes(serviceSlug);
  
  try {
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
    
    // Create fallback for known services
    const serviceData = service || (isKnownService ? {
      id: serviceSlug,
      name: serviceSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      slug: serviceSlug,
      is_active: true,
    } : null);
    
    // Don't return 404 for known services
    if (!serviceData && !isKnownService) {
      return { notFound: true };
    }
    
    await queryClient.prefetchQuery({
      queryKey: ['service', serviceSlug],
      queryFn: () => serviceData,
    });
    
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        serviceSlug,
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error('[ISR] Error fetching service:', error);
    // For known services, don't return 404
    if (isKnownService) {
      const fallbackService = {
        id: serviceSlug,
        name: serviceSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        slug: serviceSlug,
        is_active: true,
      };
      return {
        props: {
          dehydratedState: dehydrate(queryClient),
          serviceSlug,
        },
        revalidate: 60,
      };
    }
    return { notFound: true };
  }
};

export default function ServicePageWrapper({ dehydratedState, serviceSlug }: Props) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <ServicePage />
    </HydrationBoundary>
  );
}
