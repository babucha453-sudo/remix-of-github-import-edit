import type { GetStaticProps, GetStaticPaths } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import BlogPostPage from "@/pages/BlogPostPage";
import { createClient } from '@supabase/supabase-js';

type Props = {
  dehydratedState: DehydratedState;
  postSlug: string;
  postData: any;
  relatedPosts: any[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getStaticPaths: GetStaticPaths = async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(100);
    
    const paths = (posts || []).map((post: any) => ({
      params: { postSlug: post.slug },
    }));
    
    return { paths, fallback: 'blocking' };
  } catch (error) {
    return { paths: [], fallback: 'blocking' };
  }
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const postSlug = params?.postSlug as string;
  
  if (!postSlug) {
    return { notFound: true };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const queryClient = new QueryClient();
  
  try {
    const { data: post } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', postSlug)
      .eq('status', 'published')
      .single();
    
    if (!post) {
      return { notFound: true };
    }
    
    const { data: relatedPosts } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .eq('category', post.category)
      .neq('id', post.id)
      .limit(3);
    
    await queryClient.prefetchQuery({
      queryKey: ['blog-post', postSlug],
      queryFn: () => post,
    });
    
    await queryClient.prefetchQuery({
      queryKey: ['related-posts', post.category],
      queryFn: () => relatedPosts || [],
    });
    
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
        postSlug,
        postData: post,
        relatedPosts: relatedPosts || [],
      },
      revalidate: 60 * 60 * 6,
    };
  } catch (error) {
    return { notFound: true };
  }
};

export default function BlogPostPageWrapper({ dehydratedState, postSlug, postData, relatedPosts }: Props) {
  return (
    <HydrationBoundary key={postSlug} state={dehydratedState}>
      <BlogPostPage initialPost={postData} initialRelatedPosts={relatedPosts} />
    </HydrationBoundary>
  );
}
