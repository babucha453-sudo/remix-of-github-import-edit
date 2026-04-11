// ============================================================================
// serve-static Edge Function
// Serves pre-rendered HTML to search bots for SEO indexability
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.appointpanda.com";

// IMPORTANT:
// When we call Prerender.io, we must NOT use a bot User-Agent.
// If we do, our Vercel bot rewrite will route Prerender's fetch back to /serve-static,
// causing recursion and incomplete/empty HTML captures.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const ASSET_EXTENSIONS = [
  ".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf", ".xml", ".txt", ".json", ".mp4", ".webm",
];

function isAssetPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (lower.startsWith("/assets/")) return true;
  return ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Page Registry - Inline for edge function (mirrors src/config/pageRegistry.ts)
 */
const INDEXABLE_ROUTE_PATTERNS = [
  { route: '/', pageType: 'home' },
  { route: '/about', pageType: 'static' },
  { route: '/contact', pageType: 'static' },
  { route: '/faq', pageType: 'static' },
  { route: '/how-it-works', pageType: 'static' },
  { route: '/privacy', pageType: 'static' },
  { route: '/terms', pageType: 'static' },
  { route: '/sitemap', pageType: 'static' },
  { route: '/pricing', pageType: 'static' },
  { route: '/services', pageType: 'service' },
  { route: '/blog', pageType: 'blog-index' },
  { route: '/insurance', pageType: 'insurance-index' },
  { route: '/:stateSlug', pageType: 'state' },
  { route: '/:stateSlug/:citySlug', pageType: 'city' },
  { route: '/:stateSlug/:citySlug/:serviceSlug', pageType: 'service-location' },
  { route: '/services/:serviceSlug', pageType: 'service' },
  { route: '/clinic/:clinicSlug', pageType: 'clinic' },
  { route: '/dentist/:dentistSlug', pageType: 'dentist' },
  { route: '/blog/:postSlug', pageType: 'blog-post' },
  { route: '/insurance/:insuranceSlug', pageType: 'insurance-detail' },
];

const PRIVATE_ROUTE_PATTERNS = [
  '/admin', '/dashboard', '/auth', '/onboarding', '/gmb-select',
  '/claim-profile', '/list-your-practice', '/review/', '/rq/',
  '/appointment/', '/form/', '/book/', '/search', '/find-dentist',
];

// Active states (must match database slugs exactly)
const CORE_STATES = [
  { name: 'California', slug: 'ca' },
  { name: 'Massachusetts', slug: 'ma' },
  { name: 'Connecticut', slug: 'ct' },
  { name: 'New Jersey', slug: 'nj' },
];

// Core services for fallback navigation (must match treatment slugs)
const CORE_SERVICES = [
  { name: 'Teeth Whitening', slug: 'teeth-whitening' },
  { name: 'Dental Implants', slug: 'dental-implants' },
  { name: 'Invisalign', slug: 'invisalign' },
  { name: 'Root Canal', slug: 'root-canal' },
  { name: 'Dental Crowns', slug: 'dental-crowns' },
  { name: 'Dental Veneers', slug: 'dental-veneers' },
  { name: 'Dental Bridges', slug: 'dental-bridges' },
  { name: 'Dentures', slug: 'dentures' },
  { name: 'Cosmetic Dentistry', slug: 'cosmetic-dentistry' },
  { name: 'Emergency Dental Care', slug: 'emergency-dental-care' },
];

function matchRoute(routePattern: string, actualPath: string): boolean {
  const routeParts = routePattern.split('/').filter(Boolean);
  const pathParts = actualPath.split('/').filter(Boolean);

  if (routeParts.length !== pathParts.length) return false;

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];
    if (routePart.startsWith(':')) {
      if (!pathPart) return false;
      continue;
    }
    if (routePart !== pathPart) return false;
  }

  return true;
}

function classifyPath(pathname: string): { indexable: boolean; pageType: string | null } {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

  for (const pattern of PRIVATE_ROUTE_PATTERNS) {
    if (normalizedPath.startsWith(pattern)) {
      return { indexable: false, pageType: null };
    }
  }

  for (const { route, pageType } of INDEXABLE_ROUTE_PATTERNS) {
    if (matchRoute(route, normalizedPath)) {
      return { indexable: true, pageType };
    }
  }

  return { indexable: false, pageType: null };
}

/**
 * Extract path segments for generating contextual content
 */
function extractPathInfo(path: string): { stateSlug?: string; citySlug?: string; serviceSlug?: string; clinicSlug?: string; dentistSlug?: string } {
  const parts = path.replace(/\/+$/, '').split('/').filter(Boolean);

  if (parts[0] === 'services' && parts[1]) {
    return { serviceSlug: parts[1] };
  }

  if (parts[0] === 'clinic' && parts[1]) {
    return { clinicSlug: parts[1] };
  }

  if (parts[0] === 'dentist' && parts[1]) {
    return { dentistSlug: parts[1] };
  }

  if (parts.length === 1 && !['blog', 'insurance', 'services', 'about', 'contact', 'faq', 'privacy', 'terms', 'pricing', 'sitemap', 'how-it-works'].includes(parts[0])) {
    return { stateSlug: parts[0] };
  }

  if (parts.length === 2) {
    return { stateSlug: parts[0], citySlug: parts[1] };
  }

  if (parts.length === 3) {
    return { stateSlug: parts[0], citySlug: parts[1], serviceSlug: parts[2] };
  }

  return {};
}

function formatSlugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Filter for non-dental listings to preserve topical authority
 */
function isNonDentalListing(name: string): boolean {
  const nonDentalKeywords = [
    'hair', 'braiding', 'salon', 'laundromat', 'dry cleaning', 'veterinary',
    'hospital', 'animal', 'pet', 'vet', 'massage', 'spa', 'nails'
  ];
  const lowerName = name.toLowerCase();

  // Exclude some dental-related matches (e.g., "Animal" might be in "Animal Dental")
  // but usually a general "Animal Hospital" is not dental.
  // For now, simpler is better for an audit fix.
  return nonDentalKeywords.some(kw => lowerName.includes(kw)) &&
    !lowerName.includes('dental') &&
    !lowerName.includes('dentist') &&
    !lowerName.includes('orthodontics');
}

/**
 * Fetch real SEO content from database for the fallback HTML
 */
async function fetchSeoContent(supabase: any, path: string): Promise<{
  h1?: string;
  meta_title?: string;
  meta_description?: string;
  content?: string;
  faqs?: { question: string; answer: string }[];
} | null> {
  try {
    // Try multiple slug formats
    const normalizedPath = path.replace(/^\/|\/$/g, '');
    const candidates = [
      normalizedPath,
      `/${normalizedPath}`,
      `/${normalizedPath}/`,
      normalizedPath.replace(/\/$/, ''),
    ];

    const { data } = await supabase
      .from('seo_pages')
      .select('h1, meta_title, meta_description, content, faqs')
      .in('slug', candidates)
      .limit(1)
      .maybeSingle();

    // Parse FAQs from content if faqs column is empty
    if (data && !data.faqs && data.content) {
      const faqs = parseFaqsFromContent(data.content);
      data.faqs = faqs;
    }

    return data;
  } catch (err) {
    console.log('Failed to fetch SEO content:', err);
    return null;
  }
}

/**
 * Parse FAQs from markdown content
 */
function parseFaqsFromContent(content: string): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];
  const lines = content.split('\n');
  let inFaqSection = false;
  let currentQuestion = '';
  let currentAnswer = '';

  for (const line of lines) {
    if (line.toLowerCase().includes('frequently asked') || line.toLowerCase().includes('faq')) {
      inFaqSection = true;
      continue;
    }

    if (inFaqSection) {
      // Match Q: or **Q:** or ### Question patterns
      const questionMatch = line.match(/^(?:\*\*)?(?:Q:|Question:|\d+\.)?\s*(.+?)(?:\*\*)?$/);
      if (line.startsWith('### ') || line.startsWith('**Q:') || line.match(/^\d+\.\s+\*\*/)) {
        if (currentQuestion && currentAnswer) {
          faqs.push({ question: currentQuestion.trim(), answer: currentAnswer.trim() });
        }
        currentQuestion = line.replace(/^#{1,3}\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/^\d+\.\s*/, '');
        currentAnswer = '';
      } else if (line.startsWith('A:') || line.startsWith('**A:')) {
        currentAnswer = line.replace(/^(?:\*\*)?A:\s*/, '').replace(/\*\*$/, '');
      } else if (currentQuestion && line.trim()) {
        currentAnswer += ' ' + line.trim();
      }
    }
  }

  if (currentQuestion && currentAnswer) {
    faqs.push({ question: currentQuestion.trim(), answer: currentAnswer.trim() });
  }

  return faqs.slice(0, 5); // Limit to 5 FAQs
}

/**
 * Fetch nearby cities for internal linking
 */
async function fetchNearbyCities(supabase: any, stateSlug: string): Promise<{ name: string; slug: string }[]> {
  try {
    const { data: state } = await supabase
      .from('states')
      .select('id')
      .or(`slug.eq.${stateSlug},abbreviation.ilike.${stateSlug}`)
      .limit(1)
      .maybeSingle();

    if (!state) return [];

    const { data: cities } = await supabase
      .from('cities')
      .select('name, slug')
      .eq('state_id', state.id)
      .eq('is_active', true)
      .order('dentist_count', { ascending: false })
      .limit(8);

    return cities || [];
  } catch (err) {
    return [];
  }
}

/**
 * Fetch clinic listings for a city
 */
async function fetchCityListings(supabase: any, stateSlug: string, citySlug: string): Promise<{
  clinics: { name: string; slug: string; rating: number; address: string }[];
  count: number;
}> {
  try {
    const { data: city } = await supabase
      .from('cities')
      .select('id, state:states!inner(slug, abbreviation)')
      .eq('slug', citySlug)
      .limit(1)
      .maybeSingle();

    if (!city) return { clinics: [], count: 0 };

    const { data: clinics, count } = await supabase
      .from('clinics')
      .select('name, slug, rating, address', { count: 'exact' })
      .eq('city_id', city.id)
      .eq('is_active', true)
      .order('rating', { ascending: false })
      .limit(10);

    return {
      clinics: (clinics || []).map((c: any) => ({
        name: c.name,
        slug: c.slug,
        rating: c.rating || 0,
        address: c.address || ''
      })),
      count: count || 0
    };
  } catch (err) {
    return { clinics: [], count: 0 };
  }
}

/**
 * Fetch clinic profile for clinic pages
 */
async function fetchClinicProfile(supabase: any, clinicSlug: string): Promise<{
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  rating: number;
  reviewCount: number;
  latitude?: number;
  longitude?: number;
  services: string[];
  cityName: string;
  stateName: string;
  stateSlug: string;
} | null> {
  try {
    const { data: clinic } = await supabase
      .from('clinics')
      .select(`
        name, slug, description, address, phone, rating, review_count, latitude, longitude,
        city:cities(name, slug, state:states(name, slug, abbreviation))
      `)
      .eq('slug', clinicSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (!clinic) return null;

    // Fetch services
    const { data: treatments } = await supabase
      .from('clinic_treatments')
      .select('treatment:treatments(name)')
      .eq('clinic_id', clinic.id)
      .limit(8);

    return {
      name: clinic.name,
      slug: clinic.slug,
      description: clinic.description || '',
      address: clinic.address || '',
      phone: clinic.phone || '',
      rating: clinic.rating || 0,
      reviewCount: clinic.review_count || 0,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      services: (treatments || []).map((t: any) => t.treatment?.name).filter(Boolean),
      cityName: clinic.city?.name || '',
      stateName: clinic.city?.state?.name || '',
      stateSlug: clinic.city?.state?.slug || '',
    };
  } catch (err) {
    return null;
  }
}

/**
 * Generate SEO-friendly HTML with complete content and navigation
 * This is served to bots and must contain all SEO-critical content
 */
async function generateMinimalHtmlWithContent(
  supabase: any,
  path: string,
  pageType: string
): Promise<string> {
  const pathInfo = extractPathInfo(path);
  const { stateSlug, citySlug, serviceSlug, clinicSlug, dentistSlug } = pathInfo;

  // Fetch real SEO content from database
  const seoContent = await fetchSeoContent(supabase, path);

  // Build contextual title and description
  let title = seoContent?.meta_title || 'AppointPanda — Find Your Perfect Dentist';
  let h1 = seoContent?.h1 || 'Find Top-Rated Dentists Near You';
  let description = seoContent?.meta_description || 'AppointPanda helps you find and book appointments with trusted dental professionals across the United States.';
  let robots = 'index, follow'; // SEO AUDIT FIX: Configurable robots tag
  let contentHtml = '';
  let faqHtml = '';
  let listingsHtml = '';
  let clinicProfileHtml = '';

  // Parse content into semantic HTML sections
  if (seoContent?.content) {
    const contentLines = seoContent.content.split('\n').filter((l: string) => l.trim());
    const sections: { heading?: string; paragraphs: string[] }[] = [];
    let currentSection: { heading?: string; paragraphs: string[] } = { paragraphs: [] };

    for (const line of contentLines) {
      if (line.startsWith('## ')) {
        if (currentSection.paragraphs.length > 0 || currentSection.heading) {
          sections.push(currentSection);
        }
        currentSection = { heading: line.replace('## ', ''), paragraphs: [] };
      } else if (line.startsWith('### ')) {
        if (currentSection.paragraphs.length > 0 || currentSection.heading) {
          sections.push(currentSection);
        }
        currentSection = { heading: line.replace('### ', ''), paragraphs: [] };
      } else if (line.trim() && !line.toLowerCase().includes('frequently asked') && !line.toLowerCase().includes('faq')) {
        currentSection.paragraphs.push(line);
      }
    }
    if (currentSection.paragraphs.length > 0 || currentSection.heading) {
      sections.push(currentSection);
    }

    // Generate semantic HTML from sections (limit to 6 sections for performance)
    contentHtml = sections.slice(0, 6).map(section => {
      const paragraphsHtml = section.paragraphs.map(p => `<p>${p}</p>`).join('\n        ');
      if (section.heading) {
        return `<section>
        <h2>${section.heading}</h2>
        ${paragraphsHtml}
      </section>`;
      }
      return paragraphsHtml;
    }).join('\n      ');
  }

  // Generate FAQ HTML (critical for SEO)
  const faqs = seoContent?.faqs || [];
  if (faqs.length > 0) {
    faqHtml = `
    <section itemscope itemtype="https://schema.org/FAQPage">
      <h2>Frequently Asked Questions</h2>
      <dl>
        ${faqs.map(faq => `
        <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
          <dt itemprop="name">${faq.question}</dt>
          <dd itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
            <span itemprop="text">${faq.answer}</span>
          </dd>
        </div>
        `).join('')}
      </dl>
    </section>`;
  }

  // Fetch and render clinic listings for city/service-location pages
  if ((pageType === 'city' || pageType === 'service-location') && stateSlug && citySlug) {
    const listings = await fetchCityListings(supabase, stateSlug, citySlug);
    if (listings.clinics.length > 0) {
      // SEO AUDIT FIX: Include clinic count in title for better CTR
      if (!seoContent?.meta_title) {
        const cityDisplay = formatSlugToName(citySlug);
        const stateDisplay = formatSlugToName(stateSlug);
        title = `${listings.count}+ Dentists in ${cityDisplay}, ${stateDisplay} — Book Online Today | AppointPanda`;
      }

      listingsHtml = `
    <section itemscope itemtype="https://schema.org/ItemList">
      <h2>Top Dental Clinics in ${formatSlugToName(citySlug)}</h2>
      <meta itemprop="numberOfItems" content="${listings.count}" />
      <ol class="clinic-list">
        ${listings.clinics.map((clinic, idx) => `
        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
          <meta itemprop="position" content="${idx + 1}" />
          <article itemscope itemprop="item" itemtype="https://schema.org/Dentist">
            <h3 itemprop="name"><a href="${BASE_URL}/clinic/${clinic.slug}/" itemprop="url">${clinic.name}</a></h3>
            ${clinic.rating > 0 ? `<div class="rating"><span itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating"><span itemprop="ratingValue">${clinic.rating.toFixed(1)}</span>/5 stars</span></div>` : ''}
            ${clinic.address ? `<p itemprop="address">${clinic.address}</p>` : ''}
          </article>
        </li>
        `).join('')}
      </ol>
      ${listings.count > 10 ? `<p><a href="${BASE_URL}${path}">View all ${listings.count} dental clinics →</a></p>` : ''}
    </section>`;
    }
  }

  // Fetch clinic profile for clinic pages
  if (pageType === 'clinic' && clinicSlug) {
    const profile = await fetchClinicProfile(supabase, clinicSlug);
    if (profile) {
      // SEO AUDIT FIX: Handle non-dental listings by setting noindex
      if (isNonDentalListing(profile.name)) {
        robots = 'noindex, nofollow';
      }

      // SEO AUDIT FIX: Include rating and location specifics in title for better CTR
      const ratingStr = profile.rating > 0 ? `★${profile.rating.toFixed(1)} ` : '';
      const reviewStr = profile.reviewCount > 0 ? ` — ${profile.reviewCount} Reviews` : '';
      title = `${ratingStr}${profile.name}, ${profile.cityName}${reviewStr} | AppointPanda`;
      h1 = profile.name;
      description = profile.description || `${profile.name} is a dental clinic in ${profile.cityName}, ${profile.stateName}. View ratings, hours, services, and book your appointment online.`;

      // SEO AUDIT FIX: Add JSON-LD for clinic profile
      const schemaData = {
        "@context": "https://schema.org",
        "@type": "Dentist",
        "name": profile.name,
        "description": profile.description || `Professional dental clinic in ${profile.cityName}`,
        "url": `${BASE_URL}/clinic/${profile.slug}/`,
        "telephone": profile.phone || "",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": profile.address || "",
          "addressLocality": profile.cityName || "",
          "addressRegion": profile.stateSlug?.toUpperCase() || "",
          "addressCountry": "US"
        },
        "geo": profile.latitude && profile.longitude ? {
          "@type": "GeoCoordinates",
          "latitude": Number(profile.latitude),
          "longitude": Number(profile.longitude)
        } : undefined,
        "aggregateRating": profile.rating > 0 ? {
          "@type": "AggregateRating",
          "ratingValue": profile.rating,
          "reviewCount": profile.reviewCount || 1,
          "bestRating": "5",
          "worstRating": "1"
        } : undefined,
        "priceRange": "$75 - $6,000"
      };

      clinicProfileHtml = `
    <section itemscope itemtype="https://schema.org/Dentist">
      <meta itemprop="name" content="${profile.name}" />
      ${profile.address ? `<p itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">Address: <span itemprop="streetAddress">${profile.address}</span>, <span itemprop="addressLocality">${profile.cityName}</span></p>` : ''}
      ${profile.phone ? `<p>Phone: <a href="tel:${profile.phone}" itemprop="telephone">${profile.phone}</a></p>` : ''}
      ${profile.rating > 0 ? `<div class="rating" itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
        Rating: <span itemprop="ratingValue">${profile.rating.toFixed(1)}</span>/5 stars
        ${profile.reviewCount > 0 ? `(<span itemprop="reviewCount">${profile.reviewCount}</span> reviews)` : ''}
      </div>` : ''}
      ${profile.description ? `<p itemprop="description">${profile.description}</p>` : ''}
      <script type="application/ld+json">${JSON.stringify(schemaData)}</script>
      ${profile.services.length > 0 ? `
      <div>
        <h3>Services Offered</h3>
        <ul>
          ${profile.services.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      <p><a href="${BASE_URL}/${profile.stateSlug}">Browse more dentists in ${profile.stateName}</a></p>
    </section>`;
    }
  }

  // Fallback content generation based on page type
  if (!seoContent) {
    if (pageType === 'state' && stateSlug) {
      const stateName = formatSlugToName(stateSlug);
      title = `Find Dentists in ${stateName} — Book Online Today | AppointPanda`;
      h1 = `Find Dentists in ${stateName}`;
      description = `Discover top-rated dental clinics and dentists in ${stateName}. Compare providers, read verified reviews, and book appointments online.`;
      contentHtml = `<section>
        <h2>Dental Care in ${stateName}</h2>
        <p>${stateName} is home to thousands of dental professionals offering comprehensive oral health services. From routine cleanings to advanced cosmetic procedures, you'll find qualified dentists ready to help you achieve your best smile.</p>
        <p>AppointPanda makes it easy to compare dentists, read verified patient reviews, and book appointments online in ${stateName}. Our platform verifies licenses and certifications to ensure you receive quality care from trusted professionals.</p>
      </section>
      <section>
        <h2>Finding the Right Dentist in ${stateName}</h2>
        <p>Choosing a dentist is an important decision for your long-term oral health. In ${stateName}, you have access to general dentists, orthodontists, periodontists, and oral surgeons. Consider factors like office location, insurance acceptance, and patient reviews when making your choice.</p>
        <p>Many clinics in ${stateName} offer modern amenities, sedation dentistry options for anxious patients, and flexible scheduling including evening and weekend appointments.</p>
      </section>
      <section>
        <h2>Dental Insurance and Costs</h2>
        <p>Dental care costs in ${stateName} can vary based on the specific procedure and location. Most clinics accept major insurance plans, and many offer financing options or membership plans for patients without insurance.</p>
        <p>We recommend contacting clinics directly through our platform to verify insurance coverage and ask about new patient specials or payment plans.</p>
      </section>
      <section>
        <h2>Book Your Appointment Today</h2>
        <p>Ready to improve your smile? Browse our top-rated dental clinics in ${stateName}, read reviews from real patients, and book your appointment online instantly. No more waiting on hold—just simple, convenient scheduling.</p>
      </section>`;
    } else if (pageType === 'city' && stateSlug && citySlug) {
      const stateName = formatSlugToName(stateSlug);
      const cityName = formatSlugToName(citySlug);
      title = `Dentists in ${cityName}, ${stateName} — Book Online Today | AppointPanda`;
      h1 = `Find Dentists in ${cityName}, ${stateName}`;
      description = `Compare top-rated dentists in ${cityName}, ${stateName}. Browse verified reviews, check insurance, and book appointments online today.`;
      contentHtml = `<section>
        <h2>About Dental Care in ${cityName}</h2>
        <p>Looking for a dentist in ${cityName}? Our directory features verified dental clinics offering services from general dentistry to specialized treatments like dental implants, orthodontics, and cosmetic procedures.</p>
        <p>Whether you need a routine checkup or emergency dental care, you can find and book appointments with trusted professionals in ${cityName}, ${stateName}. We make it simple to find care that fits your schedule and budget.</p>
      </section>
      <section>
        <h2>Comprehensive Dental Services</h2>
        <p>Clinics in ${cityName} provide a wide range of services to meet your family's needs. Common treatments include teeth whitening, veneers, root canals, crowns, and bridges. Many providers also offer pediatric dentistry for children and teens.</p>
        <p>Advanced technology like digital X-rays and 3D imaging is standard in many ${cityName} practices, ensuring precise diagnoses and effective treatment plans.</p>
      </section>
      <section>
        <h2>Insurance and Payment Options</h2>
        <p>Most dental offices in ${cityName} accept PPO insurance plans and offer competitive pricing. If you don't have insurance, ask about in-house membership plans or third-party financing like CareCredit.</p>
        <p>Our platform allows you to filter search results by insurance to find providers who are in-network with your plan, saving you money on out-of-pocket costs.</p>
      </section>
      <section>
        <h2>Why Choose AppointPanda?</h2>
        <p>We verify every clinic on our platform to ensure they meet our high standards for quality and patient care. Read verified reviews from other ${cityName} residents to make an informed decision.</p>
        <p>Book your next dental appointment online in ${cityName} today and take the first step toward a healthier, brighter smile.</p>
      </section>`;
    } else if (pageType === 'service-location' && stateSlug && citySlug && serviceSlug) {
      const stateName = formatSlugToName(stateSlug);
      const cityName = formatSlugToName(citySlug);
      const serviceName = formatSlugToName(serviceSlug);
      title = `Best ${serviceName} in ${cityName}, ${stateName} — Compare Dentists | AppointPanda`;
      h1 = `${serviceName} Dentists in ${cityName}, ${stateName}`;
      description = `Find the best ${serviceName.toLowerCase()} specialists in ${cityName}, ${stateName}. Compare dentists, read verified reviews, and book online today.`;
      contentHtml = `<section>
        <h2>About ${serviceName} in ${cityName}</h2>
        <p>Find experienced ${serviceName.toLowerCase()} specialists in ${cityName}. Our directory features verified dentists with expertise in ${serviceName.toLowerCase()} procedures, patient reviews, and online booking.</p>
        <p>Compare providers, view their qualifications, and schedule your ${serviceName.toLowerCase()} consultation today. We help you find the best care for your specific dental needs.</p>
      </section>
      <section>
        <h2>Understanding ${serviceName}</h2>
        <p>${serviceName} procedures can significantly improve your oral health and confidence. Whether it's a restorative treatment or a cosmetic enhancement, choosing a skilled specialist in ${cityName} is crucial for the best results.</p>
        <p>During your consultation, your dentist will evaluate your condition, discuss treatment options, and create a personalized plan tailored to your goals.</p>
      </section>
      <section>
        <h2>Cost and Insurance for ${serviceName}</h2>
        <p>The cost of ${serviceName.toLowerCase()} in ${cityName} varies by provider and the complexity of the case. Many insurance plans cover a portion of the cost, while others may offer payment plans to make treatment more affordable.</p>
        <p>Check with individual clinics about their payment options and insurance acceptance for ${serviceName.toLowerCase()} procedures.</p>
      </section>
      <section>
        <h2>Find Top-Rated Specialists</h2>
        <p>Don't settle for less when it comes to your smile. Use AppointPanda to find top-rated ${serviceName.toLowerCase()} specialists in ${cityName}, ${stateName}. Read reviews, compare ratings, and book with confidence.</p>
        <p>Start your journey to better oral health today by scheduling a consultation with a verified expert near you.</p>
      </section>`;
    } else if (pageType === 'service' && serviceSlug) {
      const serviceName = formatSlugToName(serviceSlug);
      title = `Find ${serviceName} Dentists Near You | AppointPanda`;
      h1 = `Find ${serviceName} Specialists`;
      description = `Discover top-rated ${serviceName.toLowerCase()} dentists across the United States. Compare providers, read reviews, and book appointments online.`;
      contentHtml = `<section>
        <h2>About ${serviceName}</h2>
        <p>${serviceName} is a dental procedure that helps patients achieve better oral health and a more confident smile. Our directory connects you with qualified specialists across the country.</p>
        <p>Browse ${serviceName.toLowerCase()} providers, read patient reviews, and book your consultation online.</p>
      </section>`;
    } else if (pageType === 'clinic') {
      title = 'Dental Clinic — Reviews, Hours & Booking | AppointPanda';
      h1 = 'Dental Clinic';
      description = 'View this dental clinic profile on AppointPanda. See services, patient reviews, hours, and book an appointment online.';
    } else if (pageType === 'dentist') {
      title = 'Dentist — Ratings, Reviews & Booking | AppointPanda';
      h1 = 'Dentist Profile';
      description = 'View this dentist profile on AppointPanda. See qualifications, patient reviews, and book an appointment online.';
    }
  }

  // Fetch nearby cities for internal linking
  const nearbyCities = stateSlug ? await fetchNearbyCities(supabase, stateSlug) : [];

  // Build navigation links - CRITICAL for crawl discovery and internal linking
  // CANONICAL: All links use trailing slash (except root /)
  const stateLinks = CORE_STATES.map(s =>
    `<li><a href="${BASE_URL}/${s.slug}/">Dentists in ${s.name}</a></li>`
  ).join('\n            ');

  const serviceLinks = CORE_SERVICES.map(s =>
    `<li><a href="${BASE_URL}/services/${s.slug}/">${s.name}</a></li>`
  ).join('\n            ');

  // Dynamic nearby city links (filtered to exclude current city)
  const nearbyCityLinks = nearbyCities.length > 0
    ? nearbyCities
      .filter(c => c.slug !== citySlug)
      .map(c => `<li><a href="${BASE_URL}/${stateSlug}/${c.slug}/">Dentists in ${c.name}</a></li>`)
      .join('\n            ')
    : '';

  // Service-location links for cities
  const serviceLocationLinks = (citySlug && stateSlug)
    ? CORE_SERVICES.map(s =>
      `<li><a href="${BASE_URL}/${stateSlug}/${citySlug}/${s.slug}/">${s.name} in ${formatSlugToName(citySlug)}</a></li>`
    ).join('\n            ')
    : '';

  const mainNavLinks = `
    <li><a href="${BASE_URL}/">Home</a></li>
    <li><a href="${BASE_URL}/services/">All Dental Services</a></li>
    <li><a href="${BASE_URL}/blog/">Dental Health Blog</a></li>
    <li><a href="${BASE_URL}/about/">About Us</a></li>
    <li><a href="${BASE_URL}/contact/">Contact</a></li>
    <li><a href="${BASE_URL}/sitemap/">Sitemap</a></li>
  `;

  // Contextual breadcrumbs (trailing slashes)
  let breadcrumbNav = `<a href="${BASE_URL}/">Home</a>`;
  const breadcrumbItems = [{ name: 'Home', url: `${BASE_URL}/` }];

  if (stateSlug) {
    const stateName = formatSlugToName(stateSlug);
    breadcrumbNav += ` → <a href="${BASE_URL}/${stateSlug}/">${stateName}</a>`;
    breadcrumbItems.push({ name: stateName, url: `${BASE_URL}/${stateSlug}/` });
    if (citySlug) {
      const cityName = formatSlugToName(citySlug);
      breadcrumbNav += ` → <a href="${BASE_URL}/${stateSlug}/${citySlug}/">${cityName}</a>`;
      breadcrumbItems.push({ name: cityName, url: `${BASE_URL}/${stateSlug}/${citySlug}/` });
      if (serviceSlug) {
        const serviceName = formatSlugToName(serviceSlug);
        breadcrumbNav += ` → <span>${serviceName}</span>`;
        breadcrumbItems.push({ name: serviceName, url: `${BASE_URL}/${stateSlug}/${citySlug}/${serviceSlug}/` });
      }
    }
  } else if (serviceSlug) {
    breadcrumbNav += ` → <a href="${BASE_URL}/services/">Services</a>`;
    breadcrumbItems.push({ name: 'Services', url: `${BASE_URL}/services/` });
    breadcrumbNav += ` → <span>${formatSlugToName(serviceSlug)}</span>`;
    breadcrumbItems.push({ name: formatSlugToName(serviceSlug), url: `${BASE_URL}/services/${serviceSlug}/` });
  } else if (clinicSlug) {
    breadcrumbNav += ` → <a href="${BASE_URL}/sitemap/">Clinics</a>`;
    breadcrumbNav += ` → <span>Clinic Profile</span>`;
  } else if (dentistSlug) {
    breadcrumbNav += ` → <a href="${BASE_URL}/sitemap/">Dentists</a>`;
    breadcrumbNav += ` → <span>Dentist Profile</span>`;
  }

  // Generate JSON-LD structured data
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AppointPanda',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Find and book appointments with top-rated dental professionals across the United States.',
  };

  // FAQ schema (if FAQs exist)
  const faqSchema = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  } : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${BASE_URL}${path}">
  
  <!-- AppointPanda Favicon -->
  <link rel="icon" type="image/png" href="${BASE_URL}/favicon.png?v=5">
  <link rel="apple-touch-icon" href="${BASE_URL}/favicon.png?v=5">
  
  <!-- Open Graph -->
  <meta property="og:url" content="${BASE_URL}${path}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:site_name" content="AppointPanda">
  <meta property="og:image" content="${BASE_URL}/og-image.png">
  
  <!-- JSON-LD Structured Data (synchronous, in head) -->
  <script type="application/ld+json">${JSON.stringify(organizationSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
  
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.7; max-width: 1200px; margin: 0 auto; padding: 20px; color: #222; }
    header { border-bottom: 1px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 24px; }
    nav ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 16px; }
    nav a { color: #0066cc; text-decoration: none; font-weight: 500; }
    nav a:hover { text-decoration: underline; }
    h1 { color: #111; margin-bottom: 12px; font-size: 2rem; }
    h2 { color: #222; margin-top: 32px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; font-size: 1.5rem; }
    h3 { color: #333; margin-top: 24px; font-size: 1.2rem; }
    .breadcrumb { font-size: 14px; color: #555; margin-bottom: 20px; }
    .breadcrumb a { color: #0066cc; }
    .description { font-size: 1.1rem; color: #444; margin-bottom: 28px; line-height: 1.8; }
    section { margin-bottom: 36px; }
    section p { margin-bottom: 16px; }
    .link-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; padding: 0; list-style: none; margin-top: 16px; }
    .link-grid li { list-style: none; }
    .link-grid a { display: block; padding: 12px 16px; background: #f7f7f7; border-radius: 8px; color: #0066cc; text-decoration: none; font-weight: 500; transition: background 0.2s; }
    .link-grid a:hover { background: #e8e8e8; }
    .clinic-list { list-style: none; padding: 0; }
    .clinic-list li { margin-bottom: 20px; padding: 16px; background: #fafafa; border-radius: 8px; border: 1px solid #e8e8e8; }
    .clinic-list h3 { margin: 0 0 8px 0; font-size: 1.1rem; }
    .clinic-list h3 a { color: #0066cc; text-decoration: none; }
    .clinic-list h3 a:hover { text-decoration: underline; }
    .clinic-list .rating { color: #f5a623; font-weight: 600; margin-bottom: 4px; }
    .clinic-list p { margin: 4px 0; color: #555; font-size: 0.95rem; }
    dl { margin: 0; }
    dl > div { margin-bottom: 20px; padding: 16px; background: #f9f9f9; border-radius: 8px; }
    dt { font-weight: 600; color: #222; margin-bottom: 8px; }
    dd { margin: 0; color: #444; line-height: 1.7; }
    footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e0e0e0; color: #555; font-size: 14px; }
    footer a { color: #0066cc; text-decoration: none; margin: 0 8px; }
    .cta { display: inline-block; padding: 14px 28px; background: #0066cc; color: white; border-radius: 8px; text-decoration: none; margin-top: 24px; font-weight: 600; transition: background 0.2s; }
    .cta:hover { background: #0052a3; }
    @media (max-width: 768px) {
      h1 { font-size: 1.5rem; }
      h2 { font-size: 1.25rem; }
      .link-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <a href="${BASE_URL}/" aria-label="AppointPanda Home">
      <strong>AppointPanda</strong> - Find Your Perfect Dentist
    </a>
    <nav aria-label="Main navigation">
      <ul>
        ${mainNavLinks}
      </ul>
    </nav>
  </header>
  
  <main>
    <nav class="breadcrumb" aria-label="Breadcrumb">
      ${breadcrumbNav}
    </nav>
    
    <article>
      <h1>${h1}</h1>
      <p class="description">${description}</p>
      
      ${clinicProfileHtml}
      
      ${contentHtml ? `<div class="content-area">${contentHtml}</div>` : ''}
      
      ${listingsHtml}
      
      ${faqHtml}
      
      <a href="${BASE_URL}${path}" class="cta">View Full Page & Book Online</a>
    </article>
    
    ${nearbyCityLinks ? `
    <section>
      <h2>Nearby Cities</h2>
      <ul class="link-grid">
        ${nearbyCityLinks}
      </ul>
    </section>
    ` : ''}
    
    ${serviceLocationLinks ? `
    <section>
      <h2>Dental Services in ${formatSlugToName(citySlug || '')}</h2>
      <ul class="link-grid">
        ${serviceLocationLinks}
      </ul>
    </section>
    ` : ''}
    
    <section>
      <h2>Browse Dentists by State</h2>
      <ul class="link-grid">
        ${stateLinks}
      </ul>
    </section>
    
    <section>
      <h2>Popular Dental Services</h2>
      <ul class="link-grid">
        ${serviceLinks}
      </ul>
    </section>
  </main>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} AppointPanda. All rights reserved.</p>
    <nav aria-label="Footer navigation">
      <a href="${BASE_URL}/privacy/">Privacy Policy</a> |
      <a href="${BASE_URL}/terms/">Terms of Service</a> |
      <a href="${BASE_URL}/contact/">Contact Us</a> |
      <a href="${BASE_URL}/sitemap/">Sitemap</a>
    </nav>
  </footer>
</body>
</html>`;
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success or client error (don't retry 4xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Server error - retry
      if (response.status >= 500) {
        console.log(`Attempt ${attempt}/${maxRetries} failed with ${response.status}, retrying...`);
        lastError = new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.log(`Attempt ${attempt}/${maxRetries} failed with error, retrying...`);
      lastError = err as Error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('All retries failed');
}

/**
 * Prerender a page using Prerender.io with retry logic
 */
async function prerenderAndCache(
  supabase: any,
  path: string,
  pageType: string,
  prerenderToken: string,
  forceRecache: boolean = true
): Promise<{ html: string; cached: boolean }> {
  const targetUrl = `${BASE_URL}${path}`;
  const prerenderUrl = `https://service.prerender.io/${targetUrl}`;

  console.log(`Prerendering on-demand: ${path} (forceRecache: ${forceRecache})`);

  try {
    const headers: Record<string, string> = {
      "X-Prerender-Token": prerenderToken,
      "User-Agent": BROWSER_USER_AGENT,
      "X-Prerender-Render-Delay": "6000", // Increased for full page hydration (SEO audit fix)
    };

    if (forceRecache) {
      headers['X-Prerender-Recache'] = 'true';
    }

    const response = await fetchWithRetry(prerenderUrl, { headers }, 3);

    if (!response.ok) {
      console.error(`Prerender failed for ${path}: ${response.status}`);
      const fallbackHtml = await generateMinimalHtmlWithContent(supabase, path, pageType);
      return { html: fallbackHtml, cached: false };
    }

    let html = await response.text();

    // Validate we got meaningful content (not empty, skeleton, or error page)
    // SEO AUDIT FIX: Reject HTML under 3000 chars or missing <h1> — likely a skeleton/loading state
    const hasH1 = /<h1[^>]*>/.test(html);
    if (!html || html.length < 3000 || !hasH1 || html.includes('Prerender Error')) {
      console.error(`Prerender returned invalid/skeleton content for ${path} (length: ${html?.length || 0}, hasH1: ${hasH1})`);
      const fallbackHtml = await generateMinimalHtmlWithContent(supabase, path, pageType);
      return { html: fallbackHtml, cached: false };
    }

    // Ensure no noindex in prerendered content for indexable pages
    html = html.replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex[^"']*["']\s*\/?>/gi,
      '<meta name="robots" content="index, follow">'
    );

    // Generate a storage path
    const contentHash = hashContent(html);
    const storagePath = `${pageType}${path.replace(/\//g, '_')}${contentHash}.html`;

    // Try to upload and cache (best effort)
    try {
      await supabase.storage
        .from('static-pages')
        .upload(storagePath, html, {
          contentType: 'text/html',
          upsert: true
        });

      const cachePath = path.endsWith('/') ? path : path + '/';

      await supabase
        .from('static_page_cache')
        .upsert({
          path: cachePath,
          page_type: pageType,
          storage_path: storagePath,
          content_hash: contentHash,
          generated_at: new Date().toISOString(),
          is_stale: false
        }, { onConflict: 'path' });

      console.log(`Cached prerendered page: ${path}`);
      return { html, cached: true };
    } catch (cacheErr) {
      console.error(`Failed to cache ${path}:`, cacheErr);
      return { html, cached: false };
    }
  } catch (err) {
    console.error(`Prerender error for ${path}:`, err);
    const fallbackHtml = await generateMinimalHtmlWithContent(supabase, path, pageType);
    return { html: fallbackHtml, cached: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const prerenderToken = Deno.env.get("PRERENDER_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    let requestedPath = url.searchParams.get('path') || url.pathname.replace('/serve-static', '');
    const isTestMode = url.searchParams.get('test') === '1';

    if (!requestedPath.startsWith('/')) {
      requestedPath = '/' + requestedPath;
    }

    // Handle sitemap XML requests
    if (requestedPath.match(/^\/sitemap.*\.xml$/i)) {
      const sitemapUrl = `${supabaseUrl}/functions/v1/sitemap`;
      let sitemapType = '';

      const typeMatch = requestedPath.match(/sitemap-([^.]+)\.xml/);
      if (typeMatch) {
        const typePart = typeMatch[1];
        // Handle chunked sitemaps like sitemap-clinics-1.xml
        const chunkMatch = typePart.match(/^(.+)-(\d+)$/);
        if (chunkMatch) {
          sitemapType = `?type=${chunkMatch[1]}&chunk=${chunkMatch[2]}`;
        } else {
          sitemapType = `?type=${typePart}`;
        }
      }

      console.log(`Redirecting sitemap request ${requestedPath} to sitemap function`);

      const response = await fetch(`${sitemapUrl}${sitemapType}`, {
        headers: { 'Authorization': `Bearer ${supabaseKey}` }
      });

      const xml = await response.text();
      return new Response(xml, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Handle robots.txt and llms.txt
    if (requestedPath === '/robots.txt' || requestedPath.match(/^\/llms.*\.txt$/i)) {
      const fileUrl = `${BASE_URL}${requestedPath}`;
      const response = await fetch(fileUrl, {
        headers: { 'User-Agent': BROWSER_USER_AGENT }
      });
      const text = await response.text();
      return new Response(text, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // CANONICAL: Enforce trailing slash (except root /)
    // 301 redirect non-trailing slash URLs to trailing slash version
    if (requestedPath !== '/' && !requestedPath.endsWith('/') && !requestedPath.includes('.')) {
      const pathWithSlash = requestedPath + '/';
      console.log(`301 Redirect: ${requestedPath} -> ${pathWithSlash} (adding trailing slash)`);
      return new Response(null, {
        status: 301,
        headers: {
          ...corsHeaders,
          'Location': `${BASE_URL}${pathWithSlash}`,
          'Cache-Control': 'public, max-age=31536000', // Cache redirect permanently
        },
      });
    }

    // Normalize: ensure trailing slash for internal processing (except root)
    if (requestedPath !== '/' && !requestedPath.endsWith('/')) {
      requestedPath = requestedPath + '/';
    }

    // 301 REDIRECT: Fix malformed city slugs with redundant state suffix
    // e.g., /ca/antioch-ca/root-canal -> /ca/antioch/root-canal
    // But keep disambiguation slugs like fairfield-ca (same city name in multiple states)
    const DISAMBIGUATION_CITIES = ['fairfield', 'norwalk', 'middletown', 'lakewood'];
    const malformedSlugMatch = requestedPath.match(/^\/(ca|ma|ct|nj)\/([a-z-]+)-(ca|ma|ct|nj)(\/.*)?$/);
    if (malformedSlugMatch) {
      const [, stateInPath, cityBase, stateInSlug, rest = ''] = malformedSlugMatch;
      // Only redirect if NOT a disambiguation city
      if (!DISAMBIGUATION_CITIES.includes(cityBase)) {
        const correctedPath = `/${stateInPath}/${cityBase}${rest}`;
        console.log(`301 Redirect: ${requestedPath} -> ${correctedPath} (malformed slug fix)`);
        return new Response(null, {
          status: 301,
          headers: {
            ...corsHeaders,
            'Location': `${BASE_URL}${correctedPath}`,
            'Cache-Control': 'public, max-age=31536000', // Cache redirect permanently
          },
        });
      }
    }

    // 301 REDIRECT: /ae/ routes to canonical paths
    // SEO AUDIT FIX: /ae/clinic/* and /ae/dentist/* are not in INDEXABLE_ROUTE_PATTERNS
    // and waste crawl budget with 404s. Redirect to canonical equivalents.
    const aeRedirectMatch = requestedPath.match(/^\/ae\/(clinic|dentist)\/(.+)$/);
    if (aeRedirectMatch) {
      const [, routeType, slug] = aeRedirectMatch;
      const canonicalPath = `/${routeType}/${slug}`;
      const finalPath = canonicalPath.endsWith('/') ? canonicalPath : canonicalPath + '/';
      console.log(`301 Redirect: ${requestedPath} -> ${finalPath} (/ae/ to canonical)`);
      return new Response(null, {
        status: 301,
        headers: {
          ...corsHeaders,
          'Location': `${BASE_URL}${finalPath}`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }
    // Catch-all /ae/ redirect for any other /ae/ paths
    if (requestedPath.startsWith('/ae/') || requestedPath === '/ae') {
      console.log(`301 Redirect: ${requestedPath} -> / (/ae/ catch-all)`);
      return new Response(null, {
        status: 301,
        headers: {
          ...corsHeaders,
          'Location': `${BASE_URL}/`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    console.log(`Serving static page for path: ${requestedPath} (test mode: ${isTestMode})`);

    // Proxy static assets
    if (isAssetPath(requestedPath)) {
      const assetUrl = `${BASE_URL}${requestedPath}`;
      const upstream = await fetch(assetUrl, {
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: "*/*",
        },
      });

      const headers = new Headers();
      headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("x-static-cache", "asset-proxy");
      for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);

      return new Response(upstream.body, { status: upstream.status, headers });
    }

    // Classify the path
    const classification = classifyPath(requestedPath);

    // Non-indexable pages: check if it's a private route or a 404
    if (!classification.indexable) {
      // Check if it's a known private route (these should not redirect)
      const isKnownPrivate = PRIVATE_ROUTE_PATTERNS.some(pattern =>
        requestedPath.startsWith(pattern)
      );

      if (isKnownPrivate) {
        console.log(`Path ${requestedPath} is a private/utility page`);
        return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <title>Private Page - AppointPanda</title>
</head>
<body>
  <p>This is a private page.</p>
</body>
</html>`, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'x-static-cache': 'private',
          },
        });
      }

      // Not a known indexable route and not a private route = 404
      // IMPORTANT: Do NOT redirect 404s to homepage. Keep users/bots on the 404 URL.
      console.log(`404 Not Found: ${requestedPath}`);
      return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <title>404 - Page Not Found</title>
</head>
<body>
  <h1>Page Not Found</h1>
  <p>The requested page does not exist.</p>
  <p><a href="${BASE_URL}/">Go to homepage</a></p>
</body>
</html>`, {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'x-static-cache': '404',
        },
      });
    }

    // Look up in cache first
    const { data: cacheEntry, error: cacheError } = await supabase
      .from('static_page_cache')
      .select('storage_path, generated_at, is_stale')
      .eq('path', requestedPath)
      .single();

    // CACHE HIT
    if (!cacheError && cacheEntry) {
      // If stale, re-prerender
      if (cacheEntry.is_stale && prerenderToken && classification.pageType) {
        console.log(`Stale cache for ${requestedPath} - triggering fresh prerender`);
        const { html, cached } = await prerenderAndCache(
          supabase,
          requestedPath,
          classification.pageType,
          prerenderToken
        );

        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'x-static-cache': cached ? 'refreshed' : 'prerendered',
            'x-generated-at': new Date().toISOString(),
          },
        });
      }

      // Serve cached content
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('static-pages')
        .download(cacheEntry.storage_path);

      if (!downloadError && fileData) {
        const html = await fileData.text();
        console.log(`Served cached page for ${requestedPath} (generated: ${cacheEntry.generated_at})`);

        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'x-static-cache': 'hit',
            'x-generated-at': cacheEntry.generated_at,
          },
        });
      }
    }

    // CACHE MISS - Prerender on-demand
    console.log(`Cache miss for indexable page: ${requestedPath}`);

    if (prerenderToken && classification.pageType) {
      const { html, cached } = await prerenderAndCache(
        supabase,
        requestedPath,
        classification.pageType,
        prerenderToken
      );

      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=600',
          'x-static-cache': cached ? 'prerendered-cached' : 'prerendered',
          'x-generated-at': new Date().toISOString(),
        },
      });
    }

    // No prerender token - return minimal HTML with full content structure
    const minimalHtml = classification.pageType
      ? await generateMinimalHtmlWithContent(supabase, requestedPath, classification.pageType)
      : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <title>AppointPanda - Find Your Dentist</title>
  <link rel="canonical" href="${BASE_URL}${requestedPath}">
</head>
<body>
  <h1>AppointPanda</h1>
  <p>Find and book appointments with top-rated dentists.</p>
  <p><a href="${BASE_URL}${requestedPath}">Visit this page</a></p>
</body>
</html>`;

    return new Response(minimalHtml, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'x-static-cache': 'miss-fallback',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (err) {
    const error = err as Error;
    console.error("Serve static error:", error);
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex">
  <title>Error - AppointPanda</title>
</head>
<body>
  <p>An error occurred. <a href="${BASE_URL}">Go to homepage</a></p>
</body>
</html>`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});
