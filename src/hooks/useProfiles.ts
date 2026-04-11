import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  name: string;
  slug: string;
  type: 'dentist' | 'clinic';
  specialty?: string;
  location?: string;
  rating: number;
  reviewCount: number;
  image?: string;
  isVerified: boolean;
  isClaimed?: boolean;
  isPinned?: boolean;
  clinicName?: string;
  clinicId?: string;
  languages?: string[];
  areaId?: string;
  cityId?: string;
}

interface ProfileFilters {
  cityId?: string;
  areaId?: string;
  treatmentId?: string;
  limit?: number;
}

export function useProfiles(filters: ProfileFilters = {}) {
  return useQuery({
    queryKey: ['profiles', filters],
    queryFn: async () => {
      const profiles: Profile[] = [];

      // Build a set of clinic IDs that match our filters
      let eligibleClinicIds: Set<string> | null = null;

      // If we have a city filter, get clinic IDs in that city first
      if (filters.cityId) {
        const { data: cityClinics } = await supabase
          .from('clinics')
          .select('id')
          .eq('city_id', filters.cityId)
          .eq('is_active', true);
        
        eligibleClinicIds = new Set((cityClinics || []).map(c => c.id));
        
        if (eligibleClinicIds.size === 0) {
          return [];
        }
      }

      // If treatment filter is provided, intersect with clinics offering that treatment
      // FALLBACK: If no clinics in this city have explicit treatment records,
      // show ALL city clinics (most general dentists offer common services)
      if (filters.treatmentId) {
        let treatmentQuery = supabase
          .from("clinic_treatments")
          .select("clinic_id, clinic:clinics!inner(id, city_id, is_active)")
          .eq("treatment_id", filters.treatmentId);
        
        // Filter by city if provided
        if (filters.cityId) {
          treatmentQuery = treatmentQuery.eq("clinic.city_id", filters.cityId);
        }
        
        const { data: clinicTreatments } = await treatmentQuery;
        
        const treatmentClinicIds = new Set<string>((clinicTreatments || [])
          .filter((ct: any) => ct.clinic?.is_active)
          .map(ct => String(ct.clinic_id)));

        // Only apply treatment filter if we actually found matching clinics
        // If no clinics have this treatment mapped, fall back to showing all city clinics
        if (treatmentClinicIds.size > 0) {
          if (eligibleClinicIds) {
            eligibleClinicIds = new Set([...eligibleClinicIds].filter(id => treatmentClinicIds.has(id)));
          } else {
            eligibleClinicIds = treatmentClinicIds;
          }

          if (eligibleClinicIds.size === 0) {
            // Treatment exists but no city clinics offer it — still fall back to city clinics
            // Re-fetch city clinics without treatment filter
            if (filters.cityId) {
              const { data: fallbackClinics } = await supabase
                .from('clinics')
                .select('id')
                .eq('city_id', filters.cityId)
                .eq('is_active', true);
              eligibleClinicIds = new Set((fallbackClinics || []).map(c => c.id));
            }
          }
        }
        // If treatmentClinicIds.size === 0, we keep eligibleClinicIds as-is (all city clinics)
      }

      // Convert to array for .in() query (limit to avoid performance issues)
      const clinicIdArray = eligibleClinicIds ? [...eligibleClinicIds] : null;

      // Fetch dentists with their clinics
      let dentistQuery = supabase
        .from('dentists')
        .select(`
          *,
          clinic:clinics(
            id, name, slug, city_id, area_id, verification_status, claim_status, cover_image_url, rating, review_count,
            city:cities(name, slug),
            area:areas(name, slug)
          )
        `)
        .eq('is_active', true)
        .order('rating', { ascending: false });

      // Apply clinic filter if we have eligible clinic IDs
      if (clinicIdArray && clinicIdArray.length > 0) {
        dentistQuery = dentistQuery.in('clinic_id', clinicIdArray);
      } else if (clinicIdArray && clinicIdArray.length === 0) {
        // No eligible clinics, skip dentist query
        dentistQuery = dentistQuery.eq('id', 'impossible-id-that-never-matches');
      }

      if (filters.limit) {
        dentistQuery = dentistQuery.limit(filters.limit);
      }

      const { data: dentists } = await dentistQuery;

      const clinicsWithDentists = new Set<string>();

      if (dentists) {
        for (const d of dentists) {
          if (d.clinic_id) {
            clinicsWithDentists.add(d.clinic_id);
          }
          
          // Skip if clinic doesn't match our city/area filters (double check)
          if (filters.cityId && d.clinic?.city_id !== filters.cityId) continue;
          if (filters.areaId && d.clinic?.area_id !== filters.areaId) continue;
          
          let photoUrl = d.image_url;
          if (!photoUrl && d.clinic?.cover_image_url) {
            photoUrl = d.clinic.cover_image_url;
          }

          // Only show verified if both claimed AND verification_status is verified
          const isVerified = d.clinic?.claim_status === 'claimed' && d.clinic?.verification_status === 'verified';
          
          profiles.push({
            id: d.id,
            name: d.name,
            slug: d.slug,
            type: 'dentist',
            specialty: d.title || 'General Dentist',
            location: d.clinic?.area?.name || d.clinic?.city?.name || 'United States',
            rating: Number(d.rating) || 0,
            reviewCount: d.review_count || 0,
            image: photoUrl || undefined,
            isVerified,
            clinicName: d.clinic?.name,
            clinicId: d.clinic_id || undefined,
            languages: d.languages || [],
            areaId: d.clinic?.area_id,
            cityId: d.clinic?.city_id,
          });
        }
      }

      // Fetch clinics (those without dentists already added)
      let clinicQuery = supabase
        .from('clinics')
        .select(`
          *,
          city:cities(name, slug),
          area:areas(name, slug)
        `)
        .eq('is_active', true)
        .order('rating', { ascending: false });

      // Apply filters
      if (clinicIdArray && clinicIdArray.length > 0) {
        clinicQuery = clinicQuery.in('id', clinicIdArray);
      } else if (filters.cityId) {
        clinicQuery = clinicQuery.eq('city_id', filters.cityId);
      }
      
      if (filters.areaId) {
        clinicQuery = clinicQuery.eq('area_id', filters.areaId);
      }

      const { data: clinics } = await clinicQuery;

      if (clinics) {
        for (const c of clinics) {
          if (clinicsWithDentists.has(c.id)) continue;
          
          let photoUrl = c.cover_image_url;
          
          // Only show verified if both claimed AND verification_status is verified
          const isVerified = c.claim_status === 'claimed' && c.verification_status === 'verified';
          
          profiles.push({
            id: c.id,
            name: c.name,
            slug: c.slug,
            type: 'clinic',
            specialty: 'Dental Clinic',
            location: c.area?.name || c.city?.name || 'United States',
            rating: Number(c.rating) || 0,
            reviewCount: c.review_count || 0,
            image: photoUrl || undefined,
            isVerified,
            clinicName: c.name,
            clinicId: c.id,
            areaId: c.area_id,
            cityId: c.city_id,
          });
        }
      }

      profiles.sort((a, b) => b.rating - a.rating);
      
      if (filters.limit && profiles.length > filters.limit) {
        return profiles.slice(0, filters.limit);
      }

      return profiles;
    },
  });
}

export function useFeaturedProfiles(limit: number = 6) {
  return useProfiles({ limit });
}

// Get one dentist per location for homepage "Top 1%" section
// ONLY show clinics from ACTIVE cities within ACTIVE states and with proper images
export function useTopDentistsPerLocation(limit: number = 8) {
  return useQuery({
    queryKey: ['top-dentists-per-location', limit],
    queryFn: async () => {
      // First get active state IDs
      const { data: activeStates } = await supabase
        .from('states')
        .select('id')
        .eq('is_active', true);
      
      const activeStateIds = (activeStates || []).map(s => s.id);
      if (activeStateIds.length === 0) return [];
      
      // Get active cities in active states
      const { data: activeCities } = await supabase
        .from('cities')
        .select('id')
        .eq('is_active', true)
        .in('state_id', activeStateIds);
      
      const activeCityIds = (activeCities || []).map(c => c.id);
      if (activeCityIds.length === 0) return [];
      
      // Fetch clinics only from active cities in active states
      const { data: clinics } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, cover_image_url, rating, review_count,
          verification_status, claim_status, city_id,
          area:areas(id, name, slug),
          city:cities(id, name, slug, state_id)
        `)
        .eq('is_active', true)
        .in('city_id', activeCityIds)
        .order('rating', { ascending: false });
      
      if (!clinics) return [];
      
      const seenLocations = new Set<string>();
      const profiles: Profile[] = [];
      
      for (const c of clinics) {
        // Check if clinic has a valid image (cover_image_url)
        const photoUrl = c.cover_image_url;
        
        // SKIP clinics without images - they don't rank on homepage/location pages
        if (!photoUrl) continue;
        
        // Use city_id as the location key to get one per city
        const cityData = c.city as any;
        const locationKey = cityData?.[0]?.id || c.id;
        
        // Skip if we already have a profile from this location
        if (seenLocations.has(locationKey)) continue;
        seenLocations.add(locationKey);
        
        // Only show verified if both claimed AND verification_status is verified
        const isVerified = c.claim_status === 'claimed' && c.verification_status === 'verified';
        
        profiles.push({
          id: c.id,
          name: c.name,
          slug: c.slug,
          type: 'clinic',
          specialty: 'Dental Clinic',
          location: (c.area as any)?.[0]?.name || (c.city as any)?.[0]?.name || 'United States',
          rating: Number(c.rating) || 0,
          reviewCount: c.review_count || 0,
          image: photoUrl,
          isVerified,
          clinicName: c.name,
          clinicId: c.id,
          areaId: (c.area as any)?.[0]?.id,
          cityId: (c.city as any)?.[0]?.id,
        });
        
        if (profiles.length >= limit) break;
      }
      
      return profiles;
    },
  });
}

// Helper function to generate a letter avatar URL
export function getLetterAvatarUrl(name: string): string {
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0f766e&color=fff&size=200&font-size=0.4&bold=true`;
}
