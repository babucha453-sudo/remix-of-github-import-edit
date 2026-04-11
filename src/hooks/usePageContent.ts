import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';

export interface PageContent {
  id: string;
  page_type: string;
  page_slug: string;
  reference_id: string | null;
  
  // SEO
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  og_image: string | null;
  noindex: boolean;
  
  // Hero
  h1: string | null;
  hero_subtitle: string | null;
  hero_intro: string | null;
  hero_image: string | null;
  hero_stats: Array<{ label: string; value: string }> | null;
  
  // Content sections
  section_1_title: string | null;
  section_1_content: string | null;
  section_2_title: string | null;
  section_2_content: string | null;
  section_3_title: string | null;
  section_3_content: string | null;
  body_content: string | null;
  cta_text: string | null;
  cta_button_text: string | null;
  cta_button_url: string | null;
  
  // FAQ
  faqs: Array<{ question: string; answer: string }> | null;
  
  // Media
  featured_image: string | null;
  gallery_images: string[] | null;
  
  // Status
  is_published: boolean;
  
  created_at: string;
  updated_at: string;
}

export function usePageContent(pageSlug: string) {
  return useQuery({
    queryKey: ['page-content', pageSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_content')
        .select('*')
        .eq('page_slug', pageSlug)
        .maybeSingle();
      
      if (error) throw error;
      return data as PageContent | null;
    },
    enabled: !!pageSlug,
  });
}

export function useAllPageContent(filters: { pageType?: string } = {}) {
  return useQuery({
    queryKey: ['all-page-content', filters],
    queryFn: async () => {
      let query = supabase
        .from('page_content')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (filters.pageType) {
        query = query.eq('page_type', filters.pageType);
      }
      
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as PageContent[];
    },
  });
}

export function useUpsertPageContent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (content: Partial<PageContent> & { page_slug: string; page_type: string }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from('page_content')
        .select('id')
        .eq('page_slug', content.page_slug)
        .maybeSingle();
      
      if (existing) {
        // Update
        const { error } = await supabase
          .from('page_content')
          .update({
            ...content,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', existing.id);
        
        if (error) throw error;
        
        await createAuditLog({
          action: 'UPDATE',
          entityType: 'page_content',
          entityId: existing.id,
          newValues: content,
        });
        
        return existing.id;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('page_content')
          .insert([content as never])
          .select('id')
          .single();
        
        if (error) throw error;
        
        await createAuditLog({
          action: 'CREATE',
          entityType: 'page_content',
          entityId: data.id,
          newValues: content,
        });
        
        return data.id;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-content', variables.page_slug] });
      queryClient.invalidateQueries({ queryKey: ['all-page-content'] });
      toast.success('Page content saved successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });
}

export function useDeletePageContent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('page_content')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await createAuditLog({
        action: 'DELETE',
        entityType: 'page_content',
        entityId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-page-content'] });
      toast.success('Page content deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });
}

// Get default content for a page type based on its entity data
export function getDefaultPageContent(
  pageType: string,
  entityData: Record<string, unknown> | null,
  pageUrl: string
): Partial<PageContent> {
  const baseFaqs: Array<{ question: string; answer: string }> = [];
  
  switch (pageType) {
    case 'state': {
      const stateName = (entityData?.name as string) || 'This State';
      const stateAbbr = (entityData?.abbreviation as string) || '';
      return {
        page_slug: pageUrl,
        page_type: 'state',
        h1: `Find Dentists in ${stateName}`,
        hero_subtitle: `Discover top-rated dental professionals across ${stateName}. Browse by city, compare reviews, and book your appointment online.`,
        hero_intro: '',
        section_1_title: 'Browse by City',
        section_1_content: `Explore cities in ${stateName} to find dental clinics near you.`,
        section_2_title: 'Available Services',
        section_2_content: `Find dental treatments and services available in ${stateName}.`,
        body_content: `${stateName} is home to thousands of dental professionals offering comprehensive care from routine cleanings to advanced cosmetic procedures.`,
        faqs: [
          { question: `How do I find a dentist in ${stateName}?`, answer: `Browse our verified list of dentists across ${stateName}. Select your city, then filter by specialty, rating, and insurance to find the perfect match.` },
          { question: `Are dentists in ${stateName} verified?`, answer: `All dentists on our platform are licensed professionals. Profiles with the "Verified" badge have completed our additional verification process.` },
          { question: `Can I book same-day appointments?`, answer: `Many dental offices in ${stateName} offer same-day or next-day appointments. Use our search filters to find clinics with immediate availability.` },
        ],
        is_published: true,
      };
    }
    
    case 'city': {
      const cityName = (entityData?.name as string) || 'This City';
      const stateName = (entityData as any)?.state?.name || '';
      const stateAbbr = (entityData as any)?.state?.abbreviation || '';
      const locationDisplay = stateAbbr ? `${cityName}, ${stateAbbr}` : cityName;
      
      return {
        page_slug: pageUrl,
        page_type: 'city',
        h1: `Best Dentists in ${locationDisplay}`,
        hero_subtitle: `Find and book appointments with top-rated dental professionals in ${cityName}. Compare verified clinics and read patient reviews.`,
        hero_intro: '',
        section_1_title: 'Available Now',
        section_1_content: `Dentists & Clinics in ${cityName}`,
        section_2_title: 'About This Area',
        section_2_content: `Dental Care in ${cityName}`,
        body_content: `${cityName} is home to many exceptional dental clinics and specialists. Whether you need a routine checkup, cosmetic dentistry, or specialized treatment, our verified network of dental professionals is here to provide exceptional care.`,
        faqs: [
          { question: `How do I find a good dentist in ${cityName}?`, answer: `Browse our verified list of dentists in ${cityName}. Look for verified badges, patient reviews, and specializations that match your needs.` },
          { question: `Are the dentists in ${cityName} verified?`, answer: `All dentists on our platform are licensed professionals. Profiles with the "Verified" badge have claimed their profile and completed our additional verification process.` },
          { question: `How much does dental treatment cost in ${cityName}?`, answer: `Dental costs vary by treatment type. A basic checkup typically ranges from $75-200, while specialized treatments can range from $3,000-6,000.` },
          { question: `Can I book emergency dental appointments in ${cityName}?`, answer: `Yes, many clinics in ${cityName} offer same-day emergency appointments. Use our search to find clinics with emergency availability.` },
        ],
        is_published: true,
      };
    }
    
    case 'treatment': {
      const treatmentName = (entityData?.name as string) || 'This Treatment';
      return {
        page_slug: pageUrl,
        page_type: 'treatment',
        h1: treatmentName,
        hero_subtitle: `Learn about ${treatmentName.toLowerCase()} and find qualified dental professionals near you.`,
        section_1_title: 'What is it?',
        section_1_content: (entityData?.description as string) || `Information about ${treatmentName.toLowerCase()}.`,
        section_2_title: 'Find a Specialist',
        section_2_content: `Find dentists who specialize in ${treatmentName.toLowerCase()}.`,
        faqs: [
          { question: `What is ${treatmentName}?`, answer: `${treatmentName} is a dental procedure designed to improve your oral health and smile.` },
          { question: `How much does ${treatmentName} cost?`, answer: `Costs vary depending on your location and specific needs. Contact a dentist for a personalized quote.` },
        ],
        is_published: true,
      };
    }
    
    default:
      return {
        page_slug: pageUrl,
        page_type: pageType,
        h1: (entityData?.name as string) || 'Page Title',
        hero_subtitle: '',
        faqs: [],
        is_published: true,
      };
  }
}
