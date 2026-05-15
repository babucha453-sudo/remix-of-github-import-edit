import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import InsuranceDetailPage from "@/pages/InsuranceDetailPage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  insuranceSlug: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: insurances } = await supabase
      .from('insurances')
      .select('slug')
      .eq('is_active', true)
      .limit(100);
    
    const paths = (insurances || []).map((insurance: any) => ({
      params: { insuranceSlug: insurance.slug },
    }));
    
    return { paths, fallback: 'blocking' };
  } catch (error) {
    console.error('[ISR] Error fetching insurances:', error);
    return { paths: [], fallback: 'blocking' };
  }
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const insuranceSlug = params?.insuranceSlug as string;
  
  if (!insuranceSlug) {
    return { notFound: true };
  }
  
  const queryClient = new QueryClient();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: insurance } = await supabase
      .from('insurances')
      .select('*')
      .eq('slug', insuranceSlug)
      .eq('is_active', true)
      .single();
    
    if (!insurance) {
      return { notFound: true };
    }
    
    await queryClient.prefetchQuery({
      queryKey: ['insurance', insuranceSlug],
      queryFn: () => insurance,
    });
    
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        insuranceSlug,
      },
      revalidate: 86400,
    };
  } catch (error) {
    console.error('[ISR] Error fetching insurance:', error);
    return { notFound: true };
  }
};

export default function InsuranceDetailPageWrapper({ dehydratedState, insuranceSlug }: Props) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <InsuranceDetailPage insuranceSlug={insuranceSlug} />
    </HydrationBoundary>
  );
}