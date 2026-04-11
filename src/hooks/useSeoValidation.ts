import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SeoValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

export interface MetadataValidation {
  title: { isValid: boolean; message: string; length: number };
  description: { isValid: boolean; message: string; length: number };
  h1: { isValid: boolean; message: string };
}

// Validate SEO metadata before saving
export function validateMetadata(
  title: string,
  description: string,
  h1: string,
  config = { titleMin: 40, titleMax: 60, descMin: 120, descMax: 160 }
): MetadataValidation {
  const titleLen = title?.length || 0;
  const descLen = description?.length || 0;
  
  return {
    title: {
      isValid: titleLen >= config.titleMin && titleLen <= config.titleMax,
      message: titleLen < config.titleMin 
        ? `Title too short (${titleLen}/${config.titleMin} min)`
        : titleLen > config.titleMax 
        ? `Title too long (${titleLen}/${config.titleMax} max)`
        : `Good length (${titleLen} chars)`,
      length: titleLen,
    },
    description: {
      isValid: descLen >= config.descMin && descLen <= config.descMax,
      message: descLen < config.descMin
        ? `Description too short (${descLen}/${config.descMin} min)`
        : descLen > config.descMax
        ? `Description too long (${descLen}/${config.descMax} max)`
        : `Good length (${descLen} chars)`,
      length: descLen,
    },
    h1: {
      isValid: !!h1 && h1.length > 0 && h1.length <= 70,
      message: !h1 ? 'H1 is required' : h1.length > 70 ? 'H1 too long' : 'Good H1',
    },
  };
}

// Check for duplicate metadata across all pages
export function useCheckDuplicateMetadata() {
  return useMutation({
    mutationFn: async ({ 
      title, 
      description, 
      excludeSlug 
    }: { 
      title: string; 
      description: string; 
      excludeSlug?: string;
    }) => {
      const { data: pages, error } = await supabase
        .from('seo_pages')
        .select('slug, meta_title, meta_description');
      
      if (error) throw error;
      
      const titleLower = title.trim().toLowerCase();
      const descLower = description.trim().toLowerCase();
      
      const duplicateTitles: string[] = [];
      const duplicateDescriptions: string[] = [];
      
      for (const page of pages || []) {
        if (excludeSlug && page.slug === excludeSlug) continue;
        
        if (page.meta_title?.trim().toLowerCase() === titleLower) {
          duplicateTitles.push(page.slug);
        }
        if (page.meta_description?.trim().toLowerCase() === descLower) {
          duplicateDescriptions.push(page.slug);
        }
      }
      
      return {
        hasDuplicateTitle: duplicateTitles.length > 0,
        hasDuplicateDescription: duplicateDescriptions.length > 0,
        duplicateTitles,
        duplicateDescriptions,
        isUnique: duplicateTitles.length === 0 && duplicateDescriptions.length === 0,
      };
    },
  });
}

// Full SEO validation before publishing
export function useValidateBeforePublish() {
  const checkDuplicates = useCheckDuplicateMetadata();
  
  return useMutation({
    mutationFn: async ({
      slug,
      title,
      description,
      h1,
      content,
    }: {
      slug: string;
      title: string;
      description: string;
      h1: string;
      content?: string;
    }): Promise<SeoValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let score = 100;
      
      // Validate metadata lengths
      const metadata = validateMetadata(title, description, h1);
      
      if (!metadata.title.isValid) {
        if (metadata.title.length < 40) {
          errors.push(`Title too short: ${metadata.title.length} chars (min 40)`);
          score -= 20;
        } else {
          warnings.push(`Title length: ${metadata.title.length} chars (max 60 recommended)`);
          score -= 5;
        }
      }
      
      if (!metadata.description.isValid) {
        if (metadata.description.length < 120) {
          errors.push(`Description too short: ${metadata.description.length} chars (min 120)`);
          score -= 20;
        } else {
          warnings.push(`Description length: ${metadata.description.length} chars (max 160 recommended)`);
          score -= 5;
        }
      }
      
      if (!metadata.h1.isValid) {
        errors.push(metadata.h1.message);
        score -= 15;
      }
      
      // Check for duplicates
      try {
        const duplicateResult = await checkDuplicates.mutateAsync({
          title,
          description,
          excludeSlug: slug,
        });
        
        if (duplicateResult.hasDuplicateTitle) {
          errors.push(`Duplicate title found on: ${duplicateResult.duplicateTitles.slice(0, 3).join(', ')}`);
          score -= 30;
        }
        
        if (duplicateResult.hasDuplicateDescription) {
          warnings.push(`Similar description on: ${duplicateResult.duplicateDescriptions.slice(0, 3).join(', ')}`);
          score -= 10;
        }
      } catch (e) {
        warnings.push('Could not check for duplicates');
      }
      
      // Content quality checks
      if (content) {
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        if (wordCount < 300) {
          warnings.push(`Thin content: ${wordCount} words (aim for 500+)`);
          score -= 10;
        }
      }
      
      // Keyword in title check (basic)
      if (title && !title.toLowerCase().includes('dent')) {
        warnings.push('Consider including dental-related keywords in title');
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        score: Math.max(0, score),
      };
    },
  });
}

// Canonical URL generator
export function generateCanonicalUrl(slug: string, baseUrl = 'https://www.appointpanda.com'): string {
  // Ensure slug starts with /
  const cleanSlug = slug.startsWith('/') ? slug : `/${slug}`;
  // Remove trailing slash for consistency (except root)
  const normalizedSlug = cleanSlug === '/' ? cleanSlug : cleanSlug.replace(/\/$/, '');
  return `${baseUrl}${normalizedSlug}`;
}

// Schema.org structured data helpers
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
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
  };
}

export function generateLocalBusinessSchema(clinic: {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  city?: string;
  state?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: clinic.name,
    address: clinic.address ? {
      '@type': 'PostalAddress',
      streetAddress: clinic.address,
      addressLocality: clinic.city,
      addressRegion: clinic.state,
      addressCountry: 'US',
    } : undefined,
    telephone: clinic.phone,
    aggregateRating: clinic.rating ? {
      '@type': 'AggregateRating',
      ratingValue: clinic.rating,
      reviewCount: clinic.reviewCount || 0,
    } : undefined,
  };
}
