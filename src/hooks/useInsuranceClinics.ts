import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseInsuranceClinicsOptions {
  insuranceId: string | undefined;
  cityFilter?: string | null;
  stateFilter?: string | null;
  page?: number;
  pageSize?: number;
  sortBy?: "rating" | "reviews" | "name";
  minRating?: number;
}

interface ClinicResult {
  id: string;
  name: string;
  slug: string;
  rating: number | null;
  review_count: number | null;
  cover_image_url: string | null;
  verification_status: string | null;
  city: {
    id: string;
    name: string;
    slug: string;
    state: {
      slug: string;
      abbreviation: string;
    } | null;
  } | null;
  area: {
    name: string;
    slug: string;
  } | null;
}

interface UseInsuranceClinicsResult {
  clinics: ClinicResult[];
  totalCount: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Optimized hook for fetching paginated clinics for a specific insurance.
 * Uses server-side pagination through clinic_insurances join to avoid
 * fetching 6000+ clinic IDs client-side.
 */
export function useInsuranceClinics({
  insuranceId,
  cityFilter,
  stateFilter,
  page = 1,
  pageSize = 20,
  sortBy = "rating",
  minRating,
}: UseInsuranceClinicsOptions): UseInsuranceClinicsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "insurance-clinics-paginated-v2",
      insuranceId,
      cityFilter,
      stateFilter,
      page,
      pageSize,
      sortBy,
      minRating,
    ],
    queryFn: async () => {
      if (!insuranceId) return { clinics: [], totalCount: 0 };

      // Use a more efficient approach: query through clinic_insurances with embedded clinic data
      // This avoids fetching thousands of IDs and hitting URL length limits
      
      // First, get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from("clinic_insurances")
        .select("clinic_id, clinics!inner(id, is_active)", { count: "exact", head: true })
        .eq("insurance_id", insuranceId)
        .eq("clinics.is_active", true);

      if (countError) {
        console.error("Count query error:", countError);
        throw countError;
      }

      // Now fetch paginated clinic data through the join
      // We select from clinic_insurances and embed clinic data
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build the query - selecting from clinic_insurances with embedded clinic
      let query = supabase
        .from("clinic_insurances")
        .select(`
          clinic_id,
          clinics!inner(
            id, name, slug, rating, review_count, cover_image_url, verification_status, is_active,
            city_id,
            cities(id, name, slug, state:states(slug, abbreviation))
          )
        `)
        .eq("insurance_id", insuranceId)
        .eq("clinics.is_active", true);

      // Apply rating filter if specified
      if (minRating && minRating > 0) {
        query = query.gte("clinics.rating", minRating);
      }

      // Apply sorting based on clinic fields
      switch (sortBy) {
        case "rating":
          query = query.order("clinics(rating)", { ascending: false, nullsFirst: false });
          break;
        case "reviews":
          query = query.order("clinics(review_count)", { ascending: false, nullsFirst: false });
          break;
        case "name":
          query = query.order("clinics(name)", { ascending: true });
          break;
      }

      // Apply pagination
      query = query.range(from, to);

      const { data: clinicInsuranceData, error: dataError } = await query;

      if (dataError) {
        console.error("Data query error:", dataError);
        throw dataError;
      }

      // Transform the data to extract clinics
      let clinics = (clinicInsuranceData || []).map((row: any) => {
        const clinic = row.clinics;
        if (!clinic) return null;

        const city = Array.isArray(clinic.cities) ? clinic.cities[0] : clinic.cities;
        const state = city?.state;
        const stateData = Array.isArray(state) ? state[0] : state;

        return {
          id: clinic.id,
          name: clinic.name,
          slug: clinic.slug,
          rating: clinic.rating,
          review_count: clinic.review_count,
          cover_image_url: clinic.cover_image_url,
          verification_status: clinic.verification_status,
          city: city
            ? {
                id: city.id,
                name: city.name,
                slug: city.slug,
                state: stateData || null,
              }
            : null,
          area: null, // Areas are optional, skip for performance
        } as ClinicResult;
      }).filter(Boolean) as ClinicResult[];

      // Apply city/state filter client-side if specified
      if (cityFilter && stateFilter) {
        clinics = clinics.filter((clinic) => {
          return clinic.city?.slug === cityFilter && clinic.city?.state?.slug === stateFilter;
        });
      }

      return {
        clinics,
        totalCount: totalCount || 0,
      };
    },
    enabled: !!insuranceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    clinics: data?.clinics || [],
    totalCount: data?.totalCount || 0,
    totalPages: Math.ceil((data?.totalCount || 0) / pageSize),
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook for fetching available filter options (cities) for an insurance
 */
export function useInsuranceFilterOptions(insuranceId: string | undefined) {
  const { data: cities } = useQuery({
    queryKey: ["insurance-cities-v2", insuranceId],
    queryFn: async () => {
      if (!insuranceId) return [];

      // Fetch unique cities through the join in batches
      // Since we can't easily deduplicate on the server, we'll fetch a sample
      const { data: clinicInsurances } = await supabase
        .from("clinic_insurances")
        .select(`
          clinics!inner(
            id, is_active, city_id,
            cities(id, name, slug, state:states(slug, abbreviation, name))
          )
        `)
        .eq("insurance_id", insuranceId)
        .eq("clinics.is_active", true)
        .limit(1000); // Reasonable sample for cities

      if (!clinicInsurances?.length) return [];

      // Deduplicate cities
      const cityMap = new Map<string, {
        id: string;
        name: string;
        slug: string;
        stateSlug: string;
        stateAbbreviation: string;
        stateName: string;
      }>();

      for (const row of clinicInsurances) {
        const clinic = row.clinics as any;
        if (!clinic) continue;

        const city = Array.isArray(clinic.cities) ? clinic.cities[0] : clinic.cities;
        if (!city?.id) continue;

        if (cityMap.has(city.id)) continue;

        const state = Array.isArray(city.state) ? city.state[0] : city.state;
        cityMap.set(city.id, {
          id: city.id,
          name: city.name,
          slug: city.slug,
          stateSlug: state?.slug || "",
          stateAbbreviation: state?.abbreviation || "",
          stateName: state?.name || "",
        });
      }

      return Array.from(cityMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!insuranceId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return { cities: cities || [] };
}
