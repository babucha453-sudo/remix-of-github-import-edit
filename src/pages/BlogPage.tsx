import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { EmailCapture } from "@/components/EmailCapture";
import { StructuredData } from "@/components/seo/StructuredData";
import { useRealCounts } from "@/hooks/useRealCounts";
import { Calendar, User, ArrowRight, Clock, Tag, MapPin, Search, Star, Sparkles, BookOpen, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const BlogPage = () => {
  const { data: counts } = useRealCounts();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      return data || [];
    },
  });

  const { data: featuredPosts } = useQuery({
    queryKey: ["featured-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .eq("is_featured", true)
        .order("published_at", { ascending: false })
        .limit(3);
      return data || [];
    },
  });

  const { data: popularStates } = useQuery({
    queryKey: ["popular-states-blog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("states")
        .select("name, slug")
        .eq("is_active", true)
        .order("display_order")
        .limit(5);
      return data || [];
    },
  });

  const { data: popularTreatments } = useQuery({
    queryKey: ["popular-treatments-blog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("name, slug")
        .eq("is_active", true)
        .order("display_order")
        .limit(8);
      return data || [];
    },
  });

  const categories = ["Dental Health", "Cosmetic Dentistry", "Oral Hygiene", "Treatments", "Industry News"];

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Blog" },
  ];

  return (
    <PageLayout>
      <SEOHead
        title="Dental Health Blog - Tips, Advice & News"
        description="Expert dental health advice, tips, and the latest news from top dental professionals. Learn about oral hygiene, treatments, cosmetic dentistry, and more."
        canonical="/blog/"
        keywords={['dental health blog', 'oral hygiene tips', 'dental advice', 'dentist blog', 'dental care tips']}
      />
      <StructuredData
        type="breadcrumb"
        items={breadcrumbs.map(b => ({ name: b.label, url: b.href }))}
      />

      {/* Dark Hero Section */}
      <section className="relative bg-dark-section text-dark-section-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(234,179,8,0.1),transparent_50%)]" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">Dental Insights</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Dental Health{" "}
              <span className="text-gradient">Blog</span>
            </h1>
            
            <p className="text-lg text-dark-section-foreground/70 max-w-xl mx-auto mb-8">
              Expert advice, dental tips, and the latest news from top dental professionals across the United States.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>{posts?.length || 0} Articles</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <Star className="h-4 w-4 text-gold" />
                <span>Expert Authors</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <Clock className="h-4 w-4 text-coral" />
                <span>Updated Weekly</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Posts */}
      {featuredPosts && featuredPosts.length > 0 && (
        <Section size="md" className="-mt-8 relative z-10">
          <div className="grid md:grid-cols-3 gap-6">
            {featuredPosts.map((post, i) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className={`card-modern overflow-hidden group ${i === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
              >
                <div className={`relative ${i === 0 ? "h-80 md:h-full" : "h-48"}`}>
                  {post.featured_image_url ? (
                    <img
                      src={post.featured_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-accent/10 to-gold/20" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-primary text-primary-foreground rounded-full">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  </div>
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <Badge className="w-fit bg-white/20 backdrop-blur-sm text-white rounded-full mb-3">
                      {post.category || "Dental Health"}
                    </Badge>
                    <h3 className={`font-display font-bold text-white group-hover:text-primary transition-colors ${i === 0 ? "text-2xl md:text-3xl" : "text-lg"}`}>
                      {post.title}
                    </h3>
                    {i === 0 && post.excerpt && (
                      <p className="text-white/70 mt-2 line-clamp-2">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-white/60">
                      {post.author_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {post.author_name}
                        </span>
                      )}
                      {post.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(post.published_at), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Categories */}
      <Section variant="muted" size="sm">
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="default" className="rounded-full font-bold">
            All Posts
          </Button>
          {categories.map((cat) => (
            <Button key={cat} variant="outline" className="rounded-full font-bold">
              {cat}
            </Button>
          ))}
        </div>
      </Section>

      {/* Main Content Grid */}
      <Section size="lg">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Posts Grid */}
          <div className="lg:col-span-2">
            <SectionHeader
              label="Latest Articles"
              title="All Blog"
              highlight="Posts"
            />

            {isLoading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card-modern p-0">
                    <Skeleton className="h-48 rounded-t-3xl" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="card-modern overflow-hidden group card-hover"
                  >
                    <div className="h-48 relative overflow-hidden">
                      {post.featured_image_url ? (
                        <img
                          src={post.featured_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-accent/10 to-gold/20 flex items-center justify-center">
                          <BookOpen className="h-12 w-12 text-primary/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        {post.category && (
                          <Badge variant="secondary" className="rounded-full text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {post.category}
                          </Badge>
                        )}
                        {post.published_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(post.published_at), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-bold group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-4 text-sm font-bold text-primary">
                        Read More
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 card-modern">
                <BookOpen className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-display text-xl font-bold mb-2">No posts yet</h3>
                <p className="text-muted-foreground">
                  We're working on bringing you great dental content. Check back soon!
                </p>
              </div>
            )}

            {posts && posts.length > 9 && (
              <div className="text-center mt-8">
                <Button variant="outline" size="lg" className="rounded-2xl font-bold">
                  Load More Posts
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Search CTA */}
            <div className="card-modern p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Find a Dentist</h3>
                  <p className="text-sm text-muted-foreground">In your city</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Browse {counts?.clinics?.toLocaleString() || "6,600+"}+ verified dental professionals and book your appointment today.
              </p>
              <Button asChild className="w-full rounded-xl font-bold">
                <Link to="/search">
                  Search Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Browse by State */}
            <div className="card-modern p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Find by Location</h3>
              </div>
              <div className="space-y-2">
                {popularStates?.map((state) => (
                  <Link
                    key={state.slug}
                    to={`/${state.slug}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-primary/10 transition-colors group"
                  >
                    <span className="font-medium group-hover:text-primary">{state.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </Link>
                ))}
                <Link
                  to="/search"
                  className="flex items-center justify-center p-3 rounded-xl border border-dashed border-border hover:border-primary hover:text-primary transition-colors text-sm font-medium"
                >
                  View All Locations
                </Link>
              </div>
            </div>

            {/* Popular Services */}
            <div className="card-modern p-6">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-gold" />
                <h3 className="font-bold">Popular Services</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {popularTreatments?.map((treatment) => (
                  <Link
                    key={treatment.slug}
                    to={`/services/${treatment.slug}`}
                    className="px-3 py-1.5 text-sm rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {treatment.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Newsletter CTA */}
            <EmailCapture
              headline="Never Miss a Dental Tip"
              subtext="Get weekly dental tips and exclusive offers delivered to your inbox"
              className="rounded-xl"
            />
          </aside>
        </div>
      </Section>

      {/* CTA */}
      <Section variant="primary" size="md">
        <div className="text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to Find Your Dentist?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Browse our directory of verified dental professionals across the United States.
          </p>
          <Button asChild size="lg" variant="secondary" className="rounded-2xl font-bold">
            <Link to="/search">
              Find a Dentist
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </Section>
    </PageLayout>
  );
};

export default BlogPage;
