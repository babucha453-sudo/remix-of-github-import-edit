# SSG + ISR Configuration

This document outlines the Static Site Generation (SSG) and Incremental Static Regeneration (ISR) setup for AppointPanda.

## Overview

The project uses Next.js native SSG + ISR instead of external prerendering services.

## Architecture

### Pages Using SSG + ISR

| Page Type | Path Pattern | Revalidation | Fallback |
|-----------|-------------|--------------|----------|
| State Pages | `/[stateSlug]` | 60 seconds | blocking |
| City Pages | `/[stateSlug]/[citySlug]` | 60 seconds | blocking |
| Service Location | `/[stateSlug]/[citySlug]/[serviceSlug]` | 60 seconds | blocking |
| Clinic Profiles | `/clinic/[clinicSlug]` | 15 minutes | blocking |
| Dentist Profiles | `/dentist/[dentistSlug]` | 15 minutes | blocking |
| Blog Posts | `/blog/[postSlug]` | 6 hours | blocking |
| Services | `/services/[serviceSlug]` | 60 seconds | blocking |
| Insurance | `/insurance/[insuranceSlug]` | 60 seconds | blocking |

### Static Pages (No ISR)

These pages are static and don't change frequently:
- Homepage (`/`)
- About (`/about`)
- FAQ (`/faq`)
- Contact (`/contact`)
- Pricing (`/pricing`)
- How It Works (`/how-it-works`)
- Terms (`/terms`)
- Privacy (`/privacy`)
- Emergency Dentist (`/emergency-dentist`)

### Client-Side Only Pages

These pages require authentication or are user-specific:
- Dashboard (`/dashboard`)
- Admin (`/admin`)
- Auth (`/auth`)
- Booking (`/book/[clinicId]`)
- Appointment (`/appointment/[token]`)

## Configuration

### ISR Settings (`src/lib/isr.ts`)

```typescript
export const ISR_CONFIG = {
  Revalidation: {
    STATIC_PAGES: 86400,      // 24 hours
    STATE_PAGES: 3600,       // 1 hour
    CITY_PAGES: 3600,        // 1 hour
    SERVICE_LOCATION_PAGES: 3600,
    CLINIC_PAGES: 900,       // 15 minutes
    DENTIST_PAGES: 900,      // 15 minutes
    BLOG_PAGES: 21600,       // 6 hours
    SERVICE_PAGES: 3600,
    INSURANCE_PAGES: 3600,
    DYNAMIC_USER_PAGES: 60,
  },
  ...
};
```

## Vercel Configuration

The `vercel.json` handles:
- Security headers (X-Robots-Tag for private pages)
- Sitemap rewrites to Supabase functions
- Static asset optimization
- Bot detection is handled natively by Next.js

## Sitemap

Sitemaps are generated via Supabase Edge Functions:
- `/sitemap.xml` - Main sitemap
- `/sitemap-states.xml` - State pages
- `/sitemap-cities.xml` - City pages
- `/sitemap-clinics.xml` - Clinic profiles
- `/sitemap-dentists.xml` - Dentist profiles
- `/sitemap-posts.xml` - Blog posts

## Fallback Behavior

- `blocking`: New pages are generated on first request and cached for future requests
- Pre-built pages: Generated at build time for known paths
- Unknown paths: Return 404

## Build Process

```bash
npm run build
```

This will:
1. Generate static pages for all known paths
2. Set up ISR revalidation
3. Configure edge caching headers

## Performance

- Static pages are served from Vercel's Edge Network
- ISR ensures content stays fresh without full rebuilds
- Client-side hydration provides dynamic interactivity
