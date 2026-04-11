# SEO Architecture Guide

## Platform Constraints

This project runs on **Lovable Cloud (Vercel + Supabase Edge Functions)**. This means:

- ❌ **True SSR is NOT available** (no persistent Node.js server)
- ✅ **Prerendering + Bot Detection** achieves the same SEO result

## Key Achievement: SSR-Equivalent for Bots

Our architecture achieves 100% of SEO goals:
- ✅ Full HTML visible in View Page Source (for bots)
- ✅ All content indexable without JavaScript execution
- ✅ **NEVER** return `noindex` for indexable pages (enforced at multiple levels)
- ✅ Proper meta tags, canonical URLs, structured data
- ✅ On-demand prerendering for cache misses

## How It Works

### The SEO Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Request Flow                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   User Request                                                       │
│        │                                                             │
│        ▼                                                             │
│   ┌──────────┐     Human?     ┌────────────────┐                    │
│   │  Vercel  │ ─────────────► │   CSR (SPA)    │                    │
│   │  Edge    │                │   React App    │                    │
│   └──────────┘                └────────────────┘                    │
│        │                                                             │
│        │ Bot? (Googlebot, etc.)                                     │
│        ▼                                                             │
│   ┌──────────────────┐                                              │
│   │  serve-static    │                                              │
│   │  Edge Function   │                                              │
│   └──────────────────┘                                              │
│        │                                                             │
│        ├─────── Is path INDEXABLE? ──────┐                          │
│        │                                  │                          │
│        ▼ YES                              ▼ NO                       │
│   ┌──────────────────┐           ┌──────────────────┐               │
│   │  Cache HIT?      │           │  Return noindex  │               │
│   │  Return HTML     │           │  (private page)  │               │
│   └──────────────────┘           └──────────────────┘               │
│        │                                                             │
│        │ Cache MISS                                                  │
│        ▼                                                             │
│   ┌──────────────────┐                                              │
│   │  Prerender.io    │◄── On-demand prerendering                    │
│   │  (live render)   │                                              │
│   └──────────────────┘                                              │
│        │                                                             │
│        ├── Cache the result                                          │
│        ▼                                                             │
│   ┌──────────────────┐                                              │
│   │  Return HTML     │                                              │
│   │  index, follow   │◄── ALWAYS for indexable pages                │
│   └──────────────────┘                                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Critical Rules

1. **Indexable pages ALWAYS get `index, follow`** - even on cache miss
2. **On-demand prerendering** fills cache gaps automatically
3. **SEOHead component enforces registry** - ignores `noindex` prop for indexable pages
4. **robots.txt matches registry** - only blocks private pages

### Bot Detection (vercel.json)

```json
{
  "source": "/(.*)",
  "has": [{
    "type": "header",
    "key": "user-agent",
    "value": "(?i).*(googlebot|bingbot|...).*"
  }],
  "destination": "https://.../serve-static?path=/$1"
}
```

Detected bots:
- Googlebot, Bingbot, Yandex, Baidu
- Social: Facebook, Twitter, LinkedIn, Discord, WhatsApp, Telegram
- SEO tools: Ahrefs, Semrush, Screaming Frog

### Pre-generated HTML Storage

Static HTML files are stored in Supabase Storage:
- **Bucket**: `static-pages`
- **Path format**: `{page-type}_{slug}_{hash}.html`
- **Examples**:
  - `state_california_abc123.html`
  - `city_california_los-angeles_def456.html`
  - `clinic_smile-dental-la_ghi789.html`

## Page Registry (Single Source of Truth)

All pages are classified in `src/config/pageRegistry.ts`:

### Key Utility: `classifyPath(pathname)`

```typescript
import { classifyPath, isPathIndexable } from '@/config/pageRegistry';

// Full classification
const result = classifyPath('/california/los-angeles/');
// Returns: { 
//   indexable: true, 
//   renderMode: 'PRERENDER', 
//   pageType: 'city', 
//   matchedRoute: '/:stateSlug/:citySlug' 
// }

// Quick indexability check
if (isPathIndexable('/california/los-angeles/')) {
  // This page MUST be rendered with index, follow
}
```

### Indexable Pages (PRERENDER)
// Serves pre-generated HTML to bots
// Normalizes paths (trailing slashes, etc.)
// Cache miss → returns noindex shell
```

## robots.txt

Located at: `public/robots.txt`

### Allowed (all indexable pages):
- `/` - Homepage
- `/:state` - State pages
- `/:state/:city` - City pages
- `/:state/:city/:service` - Service-location pages
- `/clinic/*` - Clinic profiles
- `/dentist/*` - Dentist profiles
- `/blog/*` - Blog content
- `/services/*` - Services
- `/insurance/*` - Insurance pages

### Blocked:
- `/admin` - Admin dashboard
- `/dashboard` - User dashboard
- `/auth/*` - Authentication
- `/onboarding` - GMB onboarding
- `/claim-profile` - Claim flow
- `/list-your-practice` - Listing form
- `/appointment/*` - Appointment management
- `/review/*` - Review funnel
- `/rq/*` - Review requests
- `/form/*` - Patient forms
- `/book/*` - Direct booking
- Query params: `?utm_*`, `?fbclid=*`, etc.

## Sitemap

### XML Sitemap Index
URL: `https://www.appointpanda.com/sitemap.xml`

Child sitemaps:
- `sitemap-static.xml` - Static pages
- `sitemap-locations.xml` - State/city pages
- `sitemap-services.xml` - Service pages
- `sitemap-service-locations.xml` - Service+location combos
- `sitemap-clinics.xml` - Clinic profiles
- `sitemap-dentists.xml` - Dentist profiles
- `sitemap-posts.xml` - Blog posts

### HTML Sitemap
URL: `https://www.appointpanda.com/sitemap`

Visual sitemap with category cards and statistics.

## SEO Validation Checklist

For every indexable page, verify:

- [ ] Full content visible in View Page Source (when accessed by bot)
- [ ] Page loads with JavaScript disabled (via prerendered HTML)
- [ ] `<title>` tag present and under 60 chars
- [ ] `<meta name="description">` present and under 160 chars
- [ ] Single `<h1>` tag with main keyword
- [ ] Canonical URL present
- [ ] NOT blocked by robots.txt
- [ ] NO `noindex` meta tag
- [ ] Included in sitemap.xml
- [ ] Returns 200 status

## Testing Bot View

### Admin Tool
Navigate to: **Admin → Static Pages → Test Bot View**

Enter any URL to see:
- Whether cached HTML exists
- Full HTML content
- Meta tags present
- Content preview

### Manual Testing

```bash
# Simulate Googlebot
curl -A "Googlebot" https://www.appointpanda.com/california

# Check if HTML contains content
curl -A "Googlebot" https://www.appointpanda.com/clinic/smile-dental | grep "<h1>"
```

## Maintenance

### Regenerate Static Pages

1. Go to Admin → Static Pages
2. Click the refresh icon to reset progress
3. Click play to start generation
4. Monitor progress in real-time

### Add New Page Type

1. Update `src/config/pageRegistry.ts`
2. Add route to `App.tsx` if needed
3. Add to `generate-static-pages` edge function
4. Add to `sitemap` edge function
5. Verify robots.txt allows the pattern

## Troubleshooting

### Page Not Indexed

1. Check robots.txt doesn't block it
2. Verify sitemap includes the URL
3. Check if static HTML exists in storage
4. Test with "Test Bot View" tool
5. Check Google Search Console for errors

### Stale Content

1. Delete cached HTML from storage
2. Regenerate via Static Pages tab
3. Content updates automatically on next bot visit

### Missing Meta Tags

1. Check page component uses `<SEOHead>` component
2. Verify `useSeoPageContent` hook returns data
3. Check `seo_pages` table has entry for slug
