import type { GetStaticProps } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { DentistFinderLayout } from "@/components/finder";
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
        .select('id, name, slug, icon')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  await queryClient.prefetchQuery({
    queryKey: ['all-states'],
    queryFn: async () => {
      const { data } = await supabase
        .from('states')
        .select('id, name, slug, abbreviation')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 300,
  };
};

export default function SearchPage({ dehydratedState }: any) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <DentistFinderLayout
        title="Find Dentists Near You"
        description="Search for the best dentists and dental clinics. Compare ratings, reviews, and book appointments."
        showFilters={true}
      />
    </HydrationBoundary>
  );
}