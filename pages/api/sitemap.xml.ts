import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fnewyocguujowqxyiqsy.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
);

const BASE_URL = 'https://www.appointpanda.com';

// XML escape helper
function xmlEscape(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate sitemap URL entry
function generateUrlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// Get current date in ISO format (lastmod)
function getLastMod() {
  return new Date().toISOString().split('T')[0];
}

export default async function handler(req, res) {
  const { type, page = 1 } = req.query;
  
  // Set headers for XML
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  
  const lastmod = getLastMod();
  
  try {
    let sitemapUrls = [];
    
    switch (type) {
      case 'static':
        // Static pages - main site pages
        sitemapUrls = [
          generateUrlEntry(`${BASE_URL}/`, lastmod, 'daily', '1.0'),
          generateUrlEntry(`${BASE_URL}/search`, lastmod, 'daily', '0.9'),
          generateUrlEntry(`${BASE_URL}/find-dentist`, lastmod, 'daily', '0.9'),
          generateUrlEntry(`${BASE_URL}/services`, lastmod, 'weekly', '0.8'),
          generateUrlEntry(`${BASE_URL}/about`, lastmod, 'monthly', '0.7'),
          generateUrlEntry(`${BASE_URL}/contact`, lastmod, 'monthly', '0.6'),
          generateUrlEntry(`${BASE_URL}/faq`, lastmod, 'monthly', '0.7'),
          generateUrlEntry(`${BASE_URL}/how-it-works`, lastmod, 'monthly', '0.7'),
          generateUrlEntry(`${BASE_URL}/blog`, lastmod, 'daily', '0.8'),
          generateUrlEntry(`${BASE_URL}/insurance`, lastmod, 'weekly', '0.7'),
          generateUrlEntry(`${BASE_URL}/pricing`, lastmod, 'monthly', '0.6'),
          generateUrlEntry(`${BASE_URL}/emergency-dentist`, lastmod, 'weekly', '0.8'),
          generateUrlEntry(`${BASE_URL}/privacy`, lastmod, 'never', '0.3'),
          generateUrlEntry(`${BASE_URL}/terms`, lastmod, 'never', '0.3'),
        ];
        break;
        
      case 'states':
        // All state pages - EXCLUDE NY, TX, FL (not supported)
        const { data: states } = await supabase
          .from('states')
          .select('slug, updated_at')
          .not('slug', 'in', '(ny,tx,fl)')
          .limit(100);
        
        if (states) {
          sitemapUrls = states.map(state => 
            generateUrlEntry(
              `${BASE_URL}/${state.slug}`,
              state.updated_at ? state.updated_at.split('T')[0] : lastmod,
              'daily',
              '0.8'
            )
          );
        }
        break;
        
      case 'cities':
        // All city pages - EXCLUDE NY, TX, FL states - paginated
        const pageNum = parseInt(page) || 1;
        const pageSize = 5000;
        const start = (pageNum - 1) * pageSize;
        const end = start + pageSize;
        
        const { data: cities } = await supabase
          .from('cities')
          .select('slug, state_slug, updated_at')
          .not('state_slug', 'in', '(ny,tx,fl)')
          .range(start, end)
          .order('name');
        
        if (cities) {
          sitemapUrls = cities.map(city => {
            const stateSlug = city.state_slug || '';
            return generateUrlEntry(
              `${BASE_URL}/${stateSlug}/${city.slug}`,
              city.updated_at ? city.updated_at.split('T')[0] : lastmod,
              'daily',
              '0.8'
            );
          });
        }
        break;
        
      case 'clinics':
        // All clinic profile pages - paginated
        const clinicPage = parseInt(page) || 1;
        const clinicPageSize = 1000;
        const clinicStart = (clinicPage - 1) * clinicPageSize;
        const clinicEnd = clinicStart + clinicPageSize;
        
        const { data: clinics } = await supabase
          .from('clinics')
          .select('slug, updated_at, claim_status')
          .neq('slug', null)
          .range(clinicStart, clinicEnd)
          .order('name');
        
        if (clinics) {
          sitemapUrls = clinics.map(clinic => 
            generateUrlEntry(
              `${BASE_URL}/clinic/${clinic.slug}`,
              clinic.updated_at ? clinic.updated_at.split('T')[0] : lastmod,
              clinic.claim_status === 'claimed' ? 'daily' : 'weekly',
              clinic.claim_status === 'claimed' ? '0.9' : '0.6'
            )
          );
        }
        break;
        
      case 'services':
        // Service pages
        const { data: services } = await supabase
          .from('treatments')
          .select('slug, updated_at')
          .limit(200);
        
        if (services) {
          sitemapUrls = services.map(service => 
            generateUrlEntry(
              `${BASE_URL}/services/${service.slug}`,
              service.updated_at ? service.updated_at.split('T')[0] : lastmod,
              'weekly',
              '0.7'
            )
          );
        }
        break;
        
      case 'insurance':
        // Insurance pages
        const { data: insurances } = await supabase
          .from('insurances')
          .select('slug, updated_at')
          .limit(100);
        
        if (insurances) {
          sitemapUrls = insurances.map(ins => 
            generateUrlEntry(
              `${BASE_URL}/insurance/${ins.slug}`,
              ins.updated_at ? ins.updated_at.split('T')[0] : lastmod,
              'weekly',
              '0.7'
            )
          );
        }
        break;
        
      case 'insurance-city':
        // Insurance + City combination pages
        const insPage = parseInt(page) || 1;
        const insPageSize = 5000;
        const insStart = (insPage - 1) * insPageSize;
        const insEnd = insStart + insPageSize;
        
        // Get active insurances
        const { data: allInsurances } = await supabase
          .from('insurances')
          .select('slug')
          .eq('is_active', true);
        
        // Get cities with clinics
        const { data: allCities } = await supabase
          .from('clinics')
          .select('city_id, cities(slug, states(slug))')
          .eq('is_active', true)
          .range(insStart, insEnd);
        
        if (allCities && allInsurances) {
          const cityMap = new Map();
          allCities.forEach(c => {
            if (c.cities) {
              const citySlug = c.cities.slug;
              const stateSlug = c.cities.states?.slug || '';
              if (citySlug && stateSlug) {
                const key = `${stateSlug}/${citySlug}`;
                if (!cityMap.has(key)) {
                  cityMap.set(key, true);
                }
              }
            }
          });
          
          allInsurances.forEach(ins => {
            cityMap.forEach((_, cityKey) => {
              sitemapUrls.push(generateUrlEntry(
                `${BASE_URL}/${cityKey}/${ins.slug}-dentists`,
                lastmod,
                'weekly',
                '0.7'
              ));
            });
          });
        }
        break;
        
      default:
        // Default: generate main static pages
        sitemapUrls = [
          generateUrlEntry(`${BASE_URL}/`, lastmod, 'daily', '1.0'),
          generateUrlEntry(`${BASE_URL}/search`, lastmod, 'daily', '0.9'),
          generateUrlEntry(`${BASE_URL}/find-dentist`, lastmod, 'daily', '0.9'),
          generateUrlEntry(`${BASE_URL}/services`, lastmod, 'weekly', '0.8'),
          generateUrlEntry(`${BASE_URL}/about`, lastmod, 'monthly', '0.7'),
          generateUrlEntry(`${BASE_URL}/contact`, lastmod, 'monthly', '0.6'),
        ];
    }
    
    // Generate XML response
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join('\n')}
</urlset>`;
    
    res.status(200).send(sitemapXml);
    
  } catch (error) {
    console.error('Sitemap generation error:', error);
    
    // Fallback to basic static sitemap
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${generateUrlEntry(`${BASE_URL}/`, lastmod, 'daily', '1.0')}
</urlset>`;
    
    res.status(200).send(fallbackXml);
  }
}

// Example sitemap index structure for reference:
/*
Sitemap Index:
- /api/sitemap.xml?type=static
- /api/sitemap.xml?type=states
- /api/sitemap.xml?type=cities&page=1
- /api/sitemap.xml?type=cities&page=2
- /api/sitemap.xml?type=clinics&page=1
- /api/sitemap.xml?type=services
- /api/sitemap.xml?type=insurance
*/