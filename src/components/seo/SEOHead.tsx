import { Helmet } from 'react-helmet-async';
import { classifyPath } from '@/config/pageRegistry';
import { SITE_CONFIG } from '@/lib/seo';

export interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article' | 'profile';
  ogImage?: string;
  keywords?: string[];
  author?: string;
  publishedAt?: string;
  modifiedAt?: string;
}

const SITE_NAME = 'AppointPanda';
const BASE_URL = SITE_CONFIG.baseUrl;
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

export const SEOHead = ({
  title,
  description,
  canonical,
  noindex = false,
  ogType = 'website',
  ogImage,
  keywords,
  author,
  publishedAt,
  modifiedAt,
}: SEOHeadProps) => {
  // Avoid double branding: if title already contains the site name, use it as-is
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  
  // CRITICAL: Always generate canonical URL - use provided or derive from current path
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const canonicalUrl = canonical 
    ? `${BASE_URL}${canonical.startsWith('/') ? canonical : `/${canonical}`}` 
    : `${BASE_URL}${currentPath}`;
  
  // Normalize canonical: remove trailing slash duplicates, ensure consistency
  const normalizedCanonical = canonicalUrl.replace(/\/+$/, '') + '/';
  
  const imageUrl = ogImage || DEFAULT_OG_IMAGE;

  // CRITICAL SEO RULE: If the page is classified as indexable in the registry,
  // we MUST NOT output noindex, regardless of what the component is told.
  // This prevents accidental noindexing of important pages.
  const classification = classifyPath(currentPath);
  const isPageIndexable = classification.indexable;
  
  // If registry says indexable, override any noindex prop
  const effectiveNoindex = isPageIndexable ? false : noindex;

  // Log a warning if there's a mismatch (helpful for debugging)
  if (typeof window !== 'undefined' && isPageIndexable && noindex) {
    console.warn(
      `SEO Warning: Page "${currentPath}" is marked indexable in registry but component requested noindex. Registry takes precedence.`
    );
  }

  return (
    <Helmet>
      {/* Primary Meta Tags - These are CRITICAL for SEO */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={effectiveNoindex ? 'noindex, nofollow' : 'index, follow'} />
      
      {/* Canonical URL - Prevents duplicate content */}
      <link rel="canonical" href={normalizedCanonical} />

      {/* Sitemap reference (helps external tools discover sitemap from any page) */}
      <link rel="sitemap" type="application/xml" href={`${BASE_URL}/sitemap.xml`} />
      
      {/* Keywords */}
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(', ')} />
      )}
      
      {/* Author */}
      {author && <meta name="author" content={author} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={normalizedCanonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={normalizedCanonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      
      {/* Article specific (for blog posts) */}
      {ogType === 'article' && publishedAt && (
        <meta property="article:published_time" content={publishedAt} />
      )}
      {ogType === 'article' && modifiedAt && (
        <meta property="article:modified_time" content={modifiedAt} />
      )}
    </Helmet>
  );
};

export default SEOHead;
