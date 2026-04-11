import type { GetStaticProps } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import HomeV2 from "@/pages/HomeV2";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_STATE_SLUGS } from "@/lib/constants/activeStates";

type Props = {
  dehydratedState: DehydratedState;
};

// Use ISR - pre-render at build time, revalidate every 60 seconds
export const getStaticProps: GetStaticProps<Props> = async () => {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["seo-page-content", "/"],
      queryFn: async () => {
        const candidates = ["/", "", "///"].map((s) => s.replace(/^\/+|\/+$/g, ""));
        const normalized = candidates[0] || "";
        const { data } = await supabase
          .from("seo_pages")
          .select("*")
          .in("slug", [normalized, `/${normalized}`, "/", ""])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data ?? null;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["states-with-clinics"],
      queryFn: async () => {
        const { data: allStates, error: statesError } = await supabase
          .from("states")
          .select("*")
          .eq("is_active", true)
          .in("slug", ACTIVE_STATE_SLUGS)
          .order("display_order");
        if (statesError) throw statesError;
        if (!allStates?.length) return [];

        const { data: clinicsRaw, error: clinicError } = await (supabase
          .from("clinics")
          .select("city_id") as any).eq("is_active", true).eq("is_duplicate", false);
        if (clinicError) throw clinicError;

        const cityIds = (clinicsRaw || [])
          .map((c: any) => c.city_id)
          .filter((id: any): id is string => typeof id === "string");
        if (!cityIds.length) return [];

        const { data: citiesRaw, error: citiesError } = await supabase
          .from("cities")
          .select("id, state_id")
          .eq("is_active", true);
        if (citiesError) throw citiesError;

        const cityIdSet = new Set(cityIds);
        const stateIdSet = new Set<string>();
        (citiesRaw || []).forEach((c: any) => {
          if (cityIdSet.has(c.id) && c.state_id) stateIdSet.add(c.state_id);
        });
        return (allStates || []).filter((s: any) => stateIdSet.has(s.id));
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["real-counts"],
      queryFn: async () => {
        const { data: activeStates } = await supabase
          .from("states")
          .select("id")
          .eq("is_active", true);
        const activeStateIds = (activeStates || []).map((s: any) => s.id);

        let citiesCount = 0;
        if (activeStateIds.length) {
          const { count } = await supabase
            .from("cities")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true)
            .in("state_id", activeStateIds);
          citiesCount = count || 0;
        }

        let clinicCount = 0;
        let dentistCount = 0;
        if (activeStateIds.length) {
          const { data: activeCities } = await supabase
            .from("cities")
            .select("id")
            .eq("is_active", true)
            .in("state_id", activeStateIds);
          const activeCityIds = (activeCities || []).map((c: any) => c.id);
          if (activeCityIds.length) {
            const { count: cCount } = await supabase
              .from("clinics")
              .select("*", { count: "exact", head: true })
              .eq("is_active", true)
              .in("city_id", activeCityIds);
            clinicCount = cCount || 0;
          }

          const { count: dCount } = await supabase
            .from("dentists")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true);
          dentistCount = dCount || 0;
        }

        const { count: treatmentsCount } = await supabase
          .from("treatments")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

        return {
          clinics: clinicCount,
          states: activeStateIds.length,
          cities: citiesCount,
          dentists: dentistCount,
          treatments: treatmentsCount || 0,
        };
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["treatments"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("treatments")
          .select("*")
          .eq("is_active", true)
          .order("display_order");
        if (error) throw error;
        return data || [];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["top-dentists-per-location", 30],
      queryFn: async () => {
        try {
          const { data: activeStates } = await supabase
            .from("states")
            .select("id")
            .eq("is_active", true);
          const activeStateIds = (activeStates || []).map((s: any) => s.id);
          if (!activeStateIds.length) return [];

          const { data: activeCities } = await supabase
            .from("cities")
            .select("id")
            .eq("is_active", true)
            .in("state_id", activeStateIds);
          const activeCityIds = (activeCities || []).map((c: any) => c.id);
          if (!activeCityIds.length) return [];

          const { data: clinics } = await supabase
            .from("clinics")
            .select("id, name, slug, cover_image_url, rating, review_count, city:cities(name, state:states(abbreviation))")
            .eq("is_active", true)
            .in("city_id", activeCityIds)
            .order("rating", { ascending: false })
            .limit(30);

          return (clinics || []).map((c: any) => ({
            name: c.name,
            slug: c.slug,
            type: "clinic" as const,
            specialty: "Dental Clinic",
            location: c.city ? `${c.city.name}, ${c.city.state?.abbreviation || ""}` : "United States",
            rating: Number(c.rating) || 0,
            reviewCount: c.review_count || 0,
            image: c.cover_image_url,
          }));
        } catch {
          return [];
        }
      },
    }),
  ]);

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 60,
  };
};

export default function IndexPage({ dehydratedState }: Props) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <HomeV2 />
    </HydrationBoundary>
  );
}
