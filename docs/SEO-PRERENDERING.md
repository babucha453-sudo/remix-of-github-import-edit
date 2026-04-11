# SEO Prerendering Setup Guide

This React SPA requires prerendering for proper SEO indexing. Without prerendering, search engine crawlers may not see the dynamically rendered content.

## Current SEO Features

1. **React Helmet Async** - Manages meta tags and title in the document head
2. **Structured Data** - JSON-LD for breadcrumbs, FAQs, LocalBusiness
3. **Canonical URLs** - Automatically generated for all pages
4. **Noscript Fallback** - Basic content for crawlers that don't execute JS
5. **XML Sitemaps** - Complete sitemap index with all pages

## Recommended: Set Up Prerender.io

For full SEO indexing, we recommend using [Prerender.io](https://prerender.io):

### Option 1: Prerender.io Cloud (Recommended)

1. Sign up at https://prerender.io
2. Add your domain
3. Get your prerender token
4. Add middleware to detect crawler requests

### Option 2: Vercel Edge Middleware

Create `middleware.ts` in the project root:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BOT_USER_AGENTS = [
  'googlebot',
  'bingbot',
  'yandexbot',
  'duckduckbot',
  'slurp',
  'baiduspider',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
];

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  const isBot = BOT_USER_AGENTS.some(bot => userAgent.includes(bot));
  
  if (isBot) {
    // Redirect to prerender.io
    const prerenderToken = process.env.PRERENDER_TOKEN;
    const prerenderUrl = `https://service.prerender.io/${request.url}`;
    
    return NextResponse.rewrite(prerenderUrl, {
      headers: {
        'X-Prerender-Token': prerenderToken || '',
      },
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Option 3: Self-Hosted Prerender

Deploy prerender locally using:
- https://github.com/prerender/prerender

## Verifying SEO Setup

1. Use Google Search Console to check indexing
2. Use "Inspect URL" to see rendered HTML
3. Test with `curl -A "Googlebot" https://yoursite.com/page`
4. Use Screaming Frog or similar tools

## Meta Title Flickering Fix

The meta title flickering is caused by:
1. Default title in index.html loads first
2. React Helmet updates it after JS execution

This is expected behavior for SPAs. Prerendering solves this by serving fully-rendered HTML to crawlers.

## Content Visibility

All location pages (City, Service-Location) have:
- Dynamic SEO content from `seo_pages` table
- LocationSEOContent component with rich, unique content
- FAQ structured data
- Internal linking sections

The content IS there - it just needs to be pre-rendered for crawlers to see it.
