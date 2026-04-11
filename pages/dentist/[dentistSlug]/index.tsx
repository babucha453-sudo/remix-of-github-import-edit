import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import DentistPage from "@/pages/DentistPage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  dentistSlug: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: dentists } = await supabase
      .from('dentists')
      .select('slug')
      .eq('is_active', true)
      .order('rating', { ascending: false })
      .limit(200); // Top 200 dentists
    
    const paths = (dentists || []).map((dentist: any) => ({
      params: { dentistSlug: dentist.slug },
    }));
    
    return { paths, fallback: 'blocking' };
  } catch (error) {
    return { paths: [], fallback: 'blocking' };
  }
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const dentistSlug = params?.dentistSlug as string;
  
  if (!dentistSlug) {
    return { notFound: true };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const queryClient = new QueryClient();
  
  try {
    const { data: dentist } = await supabase
      .from('dentists')
      .select('*, clinic:clinics(name, slug, city:cities(name, slug, state:states(slug, abbreviation)))')
      .eq('slug', dentistSlug)
      .eq('is_active', true)
      .single();
    
    if (!dentist) {
      return { notFound: true };
    }
    
    await queryClient.prefetchQuery({
      queryKey: ['dentist', dentistSlug],
      queryFn: () => dentist,
    });
    
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        dentistSlug,
      },
      revalidate: 60,
    };
  } catch (error) {
    return { notFound: true };
  }
};

export default function DentistPageWrapper({ dehydratedState, dentistSlug }: Props) {
  return (
    <HydrationBoundary key={dentistSlug} state={dehydratedState}>
      <DentistPage />
    </HydrationBoundary>
  );
}
