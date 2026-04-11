import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ClinicPage from "@/pages/ClinicPage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  clinicSlug: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Generate only top clinics for SSG - full generation would be too large
export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: clinics } = await supabase
      .from('clinics')
      .select('slug')
      .eq('is_active', true)
      .eq('is_duplicate', false)
      .order('rating', { ascending: false })
      .limit(200); // Top 200 clinics
    
    const paths = (clinics || []).map((clinic: any) => ({
      params: { clinicSlug: clinic.slug },
    }));
    
    return { paths, fallback: 'blocking' };
  } catch (error) {
    return { paths: [], fallback: 'blocking' };
  }
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const clinicSlug = params?.clinicSlug as string;
  
  if (!clinicSlug) {
    return { notFound: true };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const queryClient = new QueryClient();
  
  try {
    const { data: clinic } = await supabase
      .from('clinics')
      .select('*, city:cities(name, slug, state:states(slug, abbreviation))')
      .eq('slug', clinicSlug)
      .eq('is_active', true)
      .single();
    
    if (!clinic) {
      return { notFound: true };
    }
    
    await queryClient.prefetchQuery({
      queryKey: ['clinic', clinicSlug],
      queryFn: () => clinic,
    });
    
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        clinicSlug,
      },
      revalidate: 60,
    };
  } catch (error) {
    return { notFound: true };
  }
};

export default function ClinicPageWrapper({ dehydratedState, clinicSlug }: Props) {
  return (
    <HydrationBoundary key={clinicSlug} state={dehydratedState}>
      <ClinicPage />
    </HydrationBoundary>
  );
}
