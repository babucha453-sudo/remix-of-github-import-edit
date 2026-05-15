import type { GetStaticProps } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ServicesPage from "@/pages/ServicesPage";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = new QueryClient();
  const supabase = createClient(supabaseUrl, supabaseKey);

  await queryClient.prefetchQuery({
    queryKey: ['all-treatments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug, description, icon, meta_title, meta_description')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  await queryClient.prefetchQuery({
    queryKey: ['all-states-for-services'],
    queryFn: async () => {
      const { data } = await supabase
        .from('states')
        .select('id, name, slug, abbreviation, dentist_count')
        .eq('is_active', true)
        .order('dentist_count', { ascending: false })
        .limit(51);
      return data || [];
    },
  });

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 3600,
  };
};

export default function ServicesPageWrapper({ dehydratedState }: any) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <ServicesPage />
    </HydrationBoundary>
  );
}