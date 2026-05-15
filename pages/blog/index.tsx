import type { GetStaticProps } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import BlogPage from "@/pages/BlogPage";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = new QueryClient();
  const supabase = createClient(supabaseUrl, supabaseKey);

  await queryClient.prefetchQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, featured_image_url, published_at, author_name, category, reading_time')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  await queryClient.prefetchQuery({
    queryKey: ['featured-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, featured_image_url, published_at, author_name')
        .eq('status', 'published')
        .eq('is_featured', true)
        .order('published_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 1800,
  };
};

export default function BlogPageWrapper({ dehydratedState }: any) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <BlogPage />
    </HydrationBoundary>
  );
}