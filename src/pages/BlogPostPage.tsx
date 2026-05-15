import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { StructuredData } from "@/components/seo/StructuredData";
import { getContentBody, calculateReadingTime } from "@/lib/blogContent";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { BlogDentistList } from "@/components/blog/BlogDentistList";
import { BlogFAQList } from "@/components/blog/BlogFAQList";
import { EmailCapture } from "@/components/EmailCapture";
import { 
  Calendar, User, Clock, ArrowLeft, Share2, Facebook, Twitter, Linkedin,
  MapPin, Search, Phone, Star, Shield, ArrowRight, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { sanitizeHtml } from "@/lib/utils";

type BlogContentBlock = {
  id: string;
  type: "heading" | "image" | "dentist-list" | "faq-list";
  headingLevel?: "h1" | "h2" | "h3";
  headingText?: string;
  content?: string;
  imageUrl?: string;
  imageAlt?: string;
  clinicIds?: string[];
  clinicSlugs?: string[];
  locationLabel?: string;
  faqs?: Array<{ question: string; answer: string }>;
};

interface BlogPostPageProps {
  initialPost?: any;
  initialRelatedPosts?: any[];
}

const BlogPostPage = ({ initialPost, initialRelatedPosts }: BlogPostPageProps) => {
  const { postSlug } = useParams();
  const slug = postSlug || "";

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      return data;
    },
    initialData: initialPost,
  });

  const { data: relatedPosts } = useQuery({
    queryKey: ["related-posts", post?.category],
    queryFn: async () => {
      if (!post?.category) return [];
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .eq("category", post.category)
        .neq("slug", slug)
        .order("published_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    initialData: initialRelatedPosts,
    enabled: !!post?.category || !!initialRelatedPosts,
  });

  // Fetch popular states for sidebar
  const { data: popularStates } = useQuery({
    queryKey: ["popular-states-sidebar"],
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

  // Fetch popular treatments for sidebar
  const { data: popularTreatments } = useQuery({
    queryKey: ["popular-treatments-sidebar"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatments")
        .select("name, slug")
        .eq("is_active", true)
        .order("display_order")
        .limit(6);
      return data || [];
    },
  });

  // Signal prerender when data is ready
  const isDataReady = !isLoading && !!post;
  usePrerenderReady(isDataReady);

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container py-8">
          <Skeleton className="h-96 rounded-3xl mb-8" />
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!post) {
    return (
      <PageLayout>
        <Section>
          <div className="text-center py-20">
            <h1 className="font-display text-3xl font-bold mb-4">Post Not Found</h1>
            <p className="text-muted-foreground mb-8">
              The blog post you're looking for doesn't exist.
            </p>
            <Button asChild className="rounded-xl font-bold">
              <Link to="/blog">Back to Blog</Link>
            </Button>
          </div>
        </Section>
      </PageLayout>
    );
  }

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: post.title },
  ];

  const extractBlocksFromContent = (content: unknown): BlogContentBlock[] | null => {
    if (!content) return null;
    if (Array.isArray(content)) return content as BlogContentBlock[];
    if (typeof content === "object" && content !== null) {
      const obj = content as any;
      if (Array.isArray(obj.blocks)) return obj.blocks as BlogContentBlock[];
      if (obj.type === "json" && Array.isArray(obj.body)) return obj.body as BlogContentBlock[];
    }
    return null;
  };

  const contentBlocks = extractBlocksFromContent(post.content);
  const contentStringForReading = contentBlocks
    ? contentBlocks
        .map((b) => [b.headingText, b.content, b.imageAlt].filter(Boolean).join(" "))
        .join("\n")
    : getContentBody(post.content);
  const readingTime = calculateReadingTime(contentStringForReading);

  // Check if content contains HTML tags (from n8n) or markdown
  const isHtmlContent = (content: string) => {
    return /<[a-z][\s\S]*>/i.test(content) && !content.includes('<!-- DENTIST_LIST:') && !content.includes('<!-- FAQ_LIST:');
  };

  // Parse special block markers from content
  const parseSpecialBlocks = (content: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    const lines = content.split('\n');
    let currentTextBlock: string[] = [];
    let elementKey = 0;

    const flushTextBlock = () => {
      if (currentTextBlock.length > 0) {
        const textContent = currentTextBlock.join('\n');
        if (textContent.trim()) {
          elements.push(
            <div key={`text-${elementKey++}`}>
              {renderTextContent(textContent)}
            </div>
          );
        }
        currentTextBlock = [];
      }
    };

    for (const line of lines) {
      // Check for dentist list marker
      const dentistMatch = line.match(/<!-- DENTIST_LIST:(.+?) -->/);
      if (dentistMatch) {
        flushTextBlock();
        try {
          const data = JSON.parse(dentistMatch[1]);
          elements.push(
            <BlogDentistList 
              key={`dentist-${elementKey++}`}
              clinicIds={data.clinicIds || []}
              locationLabel={data.locationLabel}
            />
          );
        } catch (e) {
          console.error('Failed to parse dentist list data:', e);
        }
        continue;
      }

      // Check for FAQ list marker
      const faqMatch = line.match(/<!-- FAQ_LIST:(.+?) -->/);
      if (faqMatch) {
        flushTextBlock();
        try {
          const data = JSON.parse(faqMatch[1]);
          elements.push(
            <BlogFAQList 
              key={`faq-${elementKey++}`}
              faqs={data.faqs || []}
            />
          );
        } catch (e) {
          console.error('Failed to parse FAQ list data:', e);
        }
        continue;
      }

      currentTextBlock.push(line);
    }

    flushTextBlock();
    return elements;
  };

  // Render text content (markdown-like format with link support)
  const renderTextContent = (content: string): React.ReactNode[] => {
    return content
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-3xl font-bold mt-8 mb-4">{renderInlineContent(line.slice(2))}</h1>;
        } else if (line.startsWith('## ')) {
          return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{renderInlineContent(line.slice(3))}</h2>;
        } else if (line.startsWith('### ')) {
          return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{renderInlineContent(line.slice(4))}</h3>;
        } else if (line.startsWith('- **')) {
          const match = line.match(/- \*\*(.+?)\*\*:?\s*(.*)/);
          if (match) {
            return (
              <li key={i} className="ml-6 mb-2">
                <strong className="text-foreground">{match[1]}</strong>
                {match[2] && <span>: {renderInlineContent(match[2])}</span>}
              </li>
            );
          }
        } else if (line.startsWith('- ')) {
          return <li key={i} className="ml-6 mb-2">{renderInlineContent(line.slice(2))}</li>;
        } else if (line.match(/^\d+\.\s/)) {
          return <li key={i} className="ml-6 mb-2 list-decimal">{renderInlineContent(line.replace(/^\d+\.\s/, ''))}</li>;
        } else if (line.match(/^!\[.*?\]\(.*?\)$/)) {
          // Image markdown: ![alt](url)
          const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
          if (imgMatch) {
            return (
              <figure key={i} className="my-6">
                <img 
                  src={imgMatch[2]} 
                  alt={imgMatch[1]} 
                  className="w-full rounded-xl"
                  loading="lazy"
                />
                {imgMatch[1] && (
                  <figcaption className="text-sm text-muted-foreground text-center mt-2">
                    {imgMatch[1]}
                  </figcaption>
                )}
              </figure>
            );
          }
        } else if (line.trim() === '') {
          return <div key={i} className="h-4" />;
        } else {
          return <p key={i} className="mb-4 leading-relaxed">{renderInlineContent(line)}</p>;
        }
        return <p key={i} className="mb-4 leading-relaxed">{line}</p>;
      });
  };

  // Render inline content with links and bold text
  const renderInlineContent = (text: string): React.ReactNode => {
    // Parse markdown links [text](url) and bold **text**
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const combinedRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[2] && match[3]) {
        // It's a link [text](url)
        const linkUrl = match[3];
        const isExternal = linkUrl.startsWith('http');
        parts.push(
          isExternal ? (
            <a 
              key={`link-${match.index}`}
              href={linkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {match[2]}
            </a>
          ) : (
            <Link 
              key={`link-${match.index}`}
              to={linkUrl}
              className="text-primary hover:underline"
            >
              {match[2]}
            </Link>
          )
        );
      } else if (match[4]) {
        // It's bold text **text**
        parts.push(<strong key={`bold-${match.index}`}>{match[4]}</strong>);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Main render content function
  const renderBlocks = (blocks: BlogContentBlock[]) => {
    return blocks.map((b, i) => {
      if (b.type === "dentist-list") {
        return (
          <BlogDentistList
            key={b.id || `dentist-${i}`}
            clinicIds={b.clinicIds || []}
            clinicSlugs={b.clinicSlugs || []}
            locationLabel={b.locationLabel}
            headingText={b.headingText}
          />
        );
      }

      if (b.type === "faq-list") {
        return <BlogFAQList key={b.id || `faq-${i}`} faqs={b.faqs || []} headingText={b.headingText} />;
      }

      if (b.type === "image" && b.imageUrl) {
        return (
          <figure key={b.id || `img-${i}`} className="my-6 not-prose">
            <img
              src={b.imageUrl}
              alt={b.imageAlt || "Blog image"}
              className="w-full rounded-xl"
              loading="lazy"
            />
            {b.imageAlt && (
              <figcaption className="text-sm text-muted-foreground text-center mt-2">
                {b.imageAlt}
              </figcaption>
            )}
          </figure>
        );
      }

      if (b.type === "heading") {
        const HTag = (b.headingLevel || "h2") as "h1" | "h2" | "h3";
        const headingClass =
          HTag === "h1"
            ? "text-3xl font-bold mt-8 mb-4"
            : HTag === "h3"
              ? "text-xl font-bold mt-6 mb-3"
              : "text-2xl font-bold mt-8 mb-4";

        return (
          <div key={b.id || `heading-${i}`}>
            {b.headingText ? <HTag className={headingClass}>{renderInlineContent(b.headingText)}</HTag> : null}
            {b.content ? <div>{renderTextContent(b.content)}</div> : null}
          </div>
        );
      }

      return null;
    });
  };

  const renderContent = (rawContent: unknown) => {
    // Prefer structured blocks if present (prevents raw JSON from rendering as text)
    const blocks = extractBlocksFromContent(rawContent);
    if (blocks?.length) {
      return renderBlocks(blocks);
    }

    const content = getContentBody(rawContent);

    // If content contains HTML tags (and no special markers), render as HTML directly
    if (isHtmlContent(content)) {
      return (
        <div 
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} 
        />
      );
    }
    
    // Parse content with special block markers
    return parseSpecialBlocks(content);
  };

  return (
    <PageLayout>
      <SEOHead
        title={post.seo_title || post.title}
        description={post.seo_description || post.excerpt || `Read "${post.title}" on AppointPanda's dental health blog.`}
        canonical={`/blog/${post.slug}/`}
        ogType="article"
        ogImage={post.featured_image_url || undefined}
        author={post.author_name || 'AppointPanda Team'}
        publishedAt={post.published_at || undefined}
        modifiedAt={post.updated_at || undefined}
        keywords={post.tags || ['dental health', 'oral care']}
      />
      <StructuredData
        type="article"
        headline={post.title}
        description={post.excerpt || post.seo_description || ''}
        image={post.featured_image_url || ''}
        url={`/blog/${post.slug}/`}
        datePublished={post.published_at || ''}
        dateModified={post.updated_at || post.published_at || ''}
        author={post.author_name || 'AppointPanda Team'}
      />
      <StructuredData
        type="breadcrumb"
        items={breadcrumbs.map(b => ({ name: b.label, url: b.href }))}
      />

      {/* Breadcrumb Section - Clean Header */}
      <Section size="sm" className="border-b border-border bg-muted/30">
        <Breadcrumbs items={breadcrumbs} />
      </Section>

      <Section size="lg">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Article */}
          <article className="lg:col-span-2">
            {/* Article Header Card */}
            <div className="card-modern p-6 md:p-8 mb-6">
              {/* Category & Reading Time */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {post.category && (
                  <Badge className="bg-primary text-primary-foreground rounded-full px-4 py-1">
                    {post.category}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {readingTime} min read
                </span>
              </div>

              {/* Title */}
              <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold mb-6 leading-tight">
                {post.title}
              </h1>

              {/* Author & Date */}
              <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{post.author_name || "AppointPanda Team"}</p>
                    <p className="text-sm text-muted-foreground">Dental Health Expert</p>
                  </div>
                </div>
                {post.published_at && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2 ml-auto">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(post.published_at), "MMMM d, yyyy")}
                  </div>
                )}
              </div>
            </div>

            {/* Featured Image Card */}
            {post.featured_image_url && (
              <div className="card-modern overflow-hidden mb-6">
                <div className="relative aspect-video">
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 bg-muted/30 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Featured image for: {post.title}
                  </p>
                </div>
              </div>
            )}

            {/* Content Card */}
            <div className="card-modern p-6 md:p-8">
              {/* Excerpt/Summary */}
              {post.excerpt && (
                <div className="bg-primary/5 border-l-4 border-primary rounded-r-xl p-4 mb-8">
                  <p className="text-lg text-muted-foreground italic leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>
              )}

              {/* Main Content */}
              <div className="prose prose-lg max-w-none text-foreground blog-content">
                {post.content ? (
                  <div className="leading-relaxed">
                    {renderContent(post.content)}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No content available.</p>
                )}
              </div>

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground mr-2">Tags:</span>
                  {post.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="rounded-full">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Share Section */}
              <div className="flex items-center gap-4 mt-6 pt-6 border-t border-border">
                <span className="font-bold text-sm flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share this article:
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full h-10 w-10 hover:bg-blue-500/10 hover:border-blue-500/50"
                    onClick={() => window.open(`https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
                  >
                    <Facebook className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full h-10 w-10 hover:bg-sky-500/10 hover:border-sky-500/50"
                    onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(post.title)}`, '_blank')}
                  >
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full h-10 w-10 hover:bg-blue-700/10 hover:border-blue-700/50"
                    onClick={() => window.open(`https://linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent(post.title)}`, '_blank')}
                  >
                    <Linkedin className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Author Bio */}
              {post.author_name && (
                <div className="mt-8 pt-8 border-t border-slate-200">
                  <div className="bg-slate-50 rounded-xl p-6 flex items-start gap-4">
                    <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">
                        {post.author_name || 'AppointPanda Editorial Team'}
                      </h4>
                      <p className="text-sm text-slate-600 mb-2">
                        Dental health content specialist at AppointPanda, dedicated to helping patients make informed decisions about their dental care through comprehensive, accurate information.
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        {post.published_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Published {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        {post.updated_at && post.updated_at !== post.published_at && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            Updated {new Date(post.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email Capture */}
            <div className="mt-10">
              <EmailCapture
                headline="Get More Dental Tips"
                subtext="Subscribe to get weekly articles delivered to your inbox"
                className="rounded-xl"
              />
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* CTA Card */}
            <div className="card-modern p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Find a Dentist</h3>
                  <p className="text-sm text-muted-foreground">Near you</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Ready to book an appointment? Find verified dental professionals in your city.
              </p>
              <Button asChild className="w-full rounded-xl font-bold">
                <Link to="/search">
                  Browse Dentists
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Browse by Location */}
            <div className="card-modern p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Browse by Location</h3>
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
              </div>
            </div>

            {/* Popular Treatments */}
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

            {/* Trust Signals */}
            <div className="card-modern p-6 bg-muted/30">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-emerald-500" />
                <h3 className="font-bold">Why AppointPanda?</h3>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-500 text-xs">✓</span>
                  </div>
                  <span>6,600+ verified dental clinics</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-500 text-xs">✓</span>
                  </div>
                  <span>Book appointments in 60 seconds</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-500 text-xs">✓</span>
                  </div>
                  <span>Read real patient reviews</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-500 text-xs">✓</span>
                  </div>
                  <span>Compare prices & insurance</span>
                </li>
              </ul>
            </div>

            {/* Contact CTA */}
            <div className="card-modern p-6 border-coral/20 bg-coral/5">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="h-5 w-5 text-coral" />
                <h3 className="font-bold">Need Help?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Our team can help you find the right dentist for your needs.
              </p>
              <Button asChild variant="outline" className="w-full rounded-xl font-bold border-coral/30 hover:bg-coral/10">
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          </aside>
        </div>

        {/* Back to Blog */}
        <div className="mt-8">
          <Button asChild variant="outline" className="rounded-xl font-bold">
            <Link to="/blog">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Link>
          </Button>
        </div>
      </Section>

      {/* Related Posts */}
      {relatedPosts && relatedPosts.length > 0 && (
        <Section variant="muted" size="lg">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  to={`/blog/${relatedPost.slug}`}
                  className="card-modern overflow-hidden group card-hover"
                >
                  <div className="h-40 relative overflow-hidden">
                    {relatedPost.featured_image_url ? (
                      <img
                        src={relatedPost.featured_image_url}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20" />
                    )}
                  </div>
                  <div className="p-5">
                    <Badge variant="secondary" className="rounded-full mb-2">
                      {relatedPost.category}
                    </Badge>
                    <h3 className="font-display font-bold group-hover:text-primary transition-colors line-clamp-2">
                      {relatedPost.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* CTA Section */}
      <Section variant="primary" size="md">
        <div className="text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to Find Your Perfect Dentist?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Browse our directory of 6,600+ verified dental professionals across the United States.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" variant="secondary" className="rounded-2xl font-bold">
              <Link to="/search">
                Find a Dentist
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl font-bold bg-transparent border-white/30 text-white hover:bg-white/10">
              <Link to="/services">
                Browse Services
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
};

export default BlogPostPage;