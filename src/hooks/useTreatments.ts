import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Treatment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  display_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  children?: Treatment[];
}

const HARDCODED_TREATMENTS: Treatment[] = [
  { id: 'cosmetic-dentist', name: 'Cosmetic Dentist', slug: 'cosmetic-dentist', description: null, icon: null, image_url: null, display_order: 1, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-implants', name: 'Dental Implants', slug: 'dental-implants', description: null, icon: null, image_url: null, display_order: 2, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'invisalign', name: 'Invisalign', slug: 'invisalign', description: null, icon: null, image_url: null, display_order: 3, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'teeth-whitening', name: 'Teeth Whitening', slug: 'teeth-whitening', description: null, icon: null, image_url: null, display_order: 4, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'root-canal', name: 'Root Canal', slug: 'root-canal', description: null, icon: null, image_url: null, display_order: 5, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'root-canal-treatment', name: 'Root Canal Treatment', slug: 'root-canal-treatment', description: null, icon: null, image_url: null, display_order: 6, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'veneers', name: 'Veneers', slug: 'veneers', description: null, icon: null, image_url: null, display_order: 7, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'emergency-dentist', name: 'Emergency Dentist', slug: 'emergency-dentist', description: null, icon: null, image_url: null, display_order: 8, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-crowns', name: 'Dental Crowns', slug: 'dental-crowns', description: null, icon: null, image_url: null, display_order: 9, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'tooth-extraction', name: 'Tooth Extraction', slug: 'tooth-extraction', description: null, icon: null, image_url: null, display_order: 10, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dentures', name: 'Dentures', slug: 'dentures', description: null, icon: null, image_url: null, display_order: 11, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'braces', name: 'Braces', slug: 'braces', description: null, icon: null, image_url: null, display_order: 12, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'oral-surgery', name: 'Oral Surgery', slug: 'oral-surgery', description: null, icon: null, image_url: null, display_order: 13, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'pediatric-dentist', name: 'Pediatric Dentist', slug: 'pediatric-dentist', description: null, icon: null, image_url: null, display_order: 14, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'periodontist', name: 'Periodontist', slug: 'periodontist', description: null, icon: null, image_url: null, display_order: 15, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'orthodontist', name: 'Orthodontist', slug: 'orthodontist', description: null, icon: null, image_url: null, display_order: 16, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'endodontist', name: 'Endodontist', slug: 'endodontist', description: null, icon: null, image_url: null, display_order: 17, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'prosthodontist', name: 'Prosthodontist', slug: 'prosthodontist', description: null, icon: null, image_url: null, display_order: 18, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'general-dentistry', name: 'General Dentistry', slug: 'general-dentistry', description: null, icon: null, image_url: null, display_order: 19, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'teeth-cleaning', name: 'Teeth Cleaning', slug: 'teeth-cleaning', description: null, icon: null, image_url: null, display_order: 20, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-fillings', name: 'Dental Fillings', slug: 'dental-fillings', description: null, icon: null, image_url: null, display_order: 21, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-checkup', name: 'Dental Checkup', slug: 'dental-checkup', description: null, icon: null, image_url: null, display_order: 22, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-veneers', name: 'Dental Veneers', slug: 'dental-veneers', description: null, icon: null, image_url: null, display_order: 23, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-bonding', name: 'Dental Bonding', slug: 'dental-bonding', description: null, icon: null, image_url: null, display_order: 24, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-bridge', name: 'Dental Bridge', slug: 'dental-bridge', description: null, icon: null, image_url: null, display_order: 25, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-sealants', name: 'Dental Sealants', slug: 'dental-sealants', description: null, icon: null, image_url: null, display_order: 26, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'gum-disease', name: 'Gum Disease', slug: 'gum-disease', description: null, icon: null, image_url: null, display_order: 27, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'gum-treatment', name: 'Gum Treatment', slug: 'gum-treatment', description: null, icon: null, image_url: null, display_order: 28, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'sleep-apnea', name: 'Sleep Apnea', slug: 'sleep-apnea', description: null, icon: null, image_url: null, display_order: 29, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'tmj-treatment', name: 'TMJ Treatment', slug: 'tmj-treatment', description: null, icon: null, image_url: null, display_order: 30, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'wisdom-teeth', name: 'Wisdom Teeth', slug: 'wisdom-teeth', description: null, icon: null, image_url: null, display_order: 31, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-emergency', name: 'Dental Emergency', slug: 'dental-emergency', description: null, icon: null, image_url: null, display_order: 32, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-x-rays', name: 'Dental X-Rays', slug: 'dental-x-rays', description: null, icon: null, image_url: null, display_order: 33, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
  { id: 'dental-exam', name: 'Dental Exam', slug: 'dental-exam', description: null, icon: null, image_url: null, display_order: 34, is_active: true, created_at: '', updated_at: '' } as unknown as Treatment,
];

export function useTreatments() {
  return useQuery({
    queryKey: ['treatments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('treatments')
          .select('*')
          .eq('is_active', true)
          .order('display_order');
        
        if (error) throw error;
        
        // If DB returns too few treatments, supplement with hardcoded
        if (!data || data.length < 5) {
          if (data && data.length > 0) {
            const dbSlugs = new Set(data.map((t: Treatment) => t.slug));
            const hardcodedFiltered = HARDCODED_TREATMENTS.filter(t => !dbSlugs.has(t.slug));
            return [...data, ...hardcodedFiltered] as Treatment[];
          }
          return HARDCODED_TREATMENTS;
        }
        
        return (data || []) as Treatment[];
      } catch (error) {
        console.warn('[useTreatments] DB error, using hardcoded:', error);
        return HARDCODED_TREATMENTS;
      }
    },
  });
}

export function useTreatment(id: string) {
  return useQuery({
    queryKey: ['treatment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatments')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as unknown as Treatment;
    },
    enabled: !!id,
  });
}
