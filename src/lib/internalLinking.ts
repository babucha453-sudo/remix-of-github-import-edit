import { supabase } from "@/integrations/supabase/client";

export interface InternalLink {
  text: string;
  href: string;
  type: "parent" | "sibling" | "child" | "service" | "treatment" | "related";
}

export interface InternalLinkingResult {
  success: boolean;
  links: InternalLink[];
  error?: string;
}

/**
 * Generate internal links for a city page
 * Links to: parent state, nearby cities, service pages
 */
export async function generateCityInternalLinks(
  cityId: string,
  options: { maxNearbyCities?: number; includeServices?: boolean } = {}
): Promise<InternalLinkingResult> {
  const { maxNearbyCities = 5, includeServices = true } = options;

  try {
    // Get city with state info
    const { data: city, error: cityError } = await supabase
      .from("cities")
      .select(`
        id, name, slug, latitude, longitude,
        state:states!inner(id, name, slug, abbreviation)
      `)
      .eq("id", cityId)
      .single();

    if (cityError || !city) {
      return { success: false, links: [], error: "City not found" };
    }

    const links: InternalLink[] = [];

    // 1. Link to parent state
    links.push({
      text: `More dentists in ${city.state.name}`,
      href: `/state/${city.state.slug}/`,
      type: "parent",
    });

    // 2. Find nearby cities (if coordinates available)
    if (city.latitude && city.longitude) {
      const { data: nearbyCities } = await supabase
        .from("cities")
        .select("id, name, slug")
        .eq("state_id", city.state.id)
        .eq("is_active", true)
        .eq("page_exists", true)
        .neq("id", city.id)
        .limit(maxNearbyCities);

      if (nearbyCities && nearbyCities.length > 0) {
        for (const nearby of nearbyCities) {
          links.push({
            text: `Dentists in ${nearby.name}`,
            href: `/state/${city.state.slug}/${nearby.slug}/`,
            type: "sibling",
          });
        }
      }
    }

    // 3. Link to service pages
    if (includeServices) {
      const { data: services } = await supabase
        .from("treatments")
        .select("id, name, slug")
        .eq("is_active", true)
        .limit(5);

      if (services && services.length > 0) {
        for (const service of services) {
          links.push({
            text: `${service.name} in ${city.name}`,
            href: `/services/${service.slug}/`,
            type: "service",
          });
        }
      }
    }

    return { success: true, links };
  } catch (error: any) {
    return { success: false, links: [], error: error.message };
  }
}

/**
 * Generate internal links for a state page
 * Links to: top cities, service pages
 */
export async function generateStateInternalLinks(
  stateId: string,
  options: { maxCities?: number; includeServices?: boolean } = {}
): Promise<InternalLinkingResult> {
  const { maxCities = 10, includeServices = true } = options;

  try {
    // Get state info
    const { data: state, error: stateError } = await supabase
      .from("states")
      .select("id, name, slug, abbreviation")
      .eq("id", stateId)
      .single();

    if (stateError || !state) {
      return { success: false, links: [], error: "State not found" };
    }

    const links: InternalLink[] = [];

    // 1. Link to top cities in state (by population or dentist count)
    const { data: cities } = await supabase
      .from("cities")
      .select("id, name, slug, dentist_count")
      .eq("state_id", stateId)
      .eq("is_active", true)
      .eq("page_exists", true)
      .order("dentist_count", { ascending: false, nullsFirst: false })
      .limit(maxCities);

    if (cities && cities.length > 0) {
      for (const city of cities) {
        links.push({
          text: `Dentists in ${city.name}`,
          href: `/state/${state.slug}/${city.slug}/`,
          type: "child",
        });
      }
    }

    // 2. Link to service pages
    if (includeServices) {
      const { data: services } = await supabase
        .from("treatments")
        .select("id, name, slug")
        .eq("is_active", true)
        .limit(5);

      if (services && services.length > 0) {
        for (const service of services) {
          links.push({
            text: `${service.name} in ${state.name}`,
            href: `/services/${service.slug}/`,
            type: "service",
          });
        }
      }
    }

    // 3. Link to all states page (if exists)
    links.push({
      text: "Browse all states",
      href: "/locations/",
      type: "parent",
    });

    return { success: true, links };
  } catch (error: any) {
    return { success: false, links: [], error: error.message };
  }
}

/**
 * Generate internal links for a service page
 * Links to: related treatments, top locations offering this service
 */
export async function generateServiceInternalLinks(
  serviceSlug: string,
  options: { maxLocations?: number; maxRelated?: number } = {}
): Promise<InternalLinkingResult> {
  const { maxLocations = 5, maxRelated = 3 } = options;

  try {
    // Get service info
    const { data: service, error: serviceError } = await supabase
      .from("treatments")
      .select("id, name, slug")
      .eq("slug", serviceSlug)
      .single();

    if (serviceError || !service) {
      return { success: false, links: [], error: "Service not found" };
    }

    const links: InternalLink[] = [];

    // 1. Link to related services
    const { data: relatedServices } = await supabase
      .from("treatments")
      .select("id, name, slug")
      .eq("is_active", true)
      .neq("id", service.id)
      .limit(maxRelated);

    if (relatedServices && relatedServices.length > 0) {
      for (const related of relatedServices) {
        links.push({
          text: related.name,
          href: `/services/${related.slug}/`,
          type: "related",
        });
      }
    }

    // 2. Link to top states
    const { data: states } = await supabase
      .from("states")
      .select("id, name, slug")
      .eq("is_active", true)
      .eq("page_exists", true)
      .limit(maxLocations);

    if (states && states.length > 0) {
      for (const state of states) {
        links.push({
          text: `${service.name} in ${state.name}`,
          href: `/state/${state.slug}/`,
          type: "service",
        });
      }
    }

    // 3. Link to all services
    links.push({
      text: "View all dental services",
      href: "/services/",
      type: "parent",
    });

    return { success: true, links };
  } catch (error: any) {
    return { success: false, links: [], error: error.message };
  }
}

/**
 * Update internal links in SEO page content
 */
export async function updateSeoPageInternalLinks(
  seoPageId: string,
  links: InternalLink[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: page, error: pageError } = await supabase
      .from("seo_pages")
      .select("content")
      .eq("id", seoPageId)
      .single();

    if (pageError || !page) {
      return { success: false, error: "Page not found" };
    }

    let content: any = {};
    try {
      content = typeof page.content === "string" ? JSON.parse(page.content) : page.content || {};
    } catch {
      content = {};
    }

    // Update internal links in content
    content.internal_links = links.map((link) => ({
      text: link.text,
      href: link.href,
      type: link.type,
    }));

    const { error: updateError } = await supabase
      .from("seo_pages")
      .update({ content: JSON.stringify(content) })
      .eq("id", seoPageId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Bulk update internal links for all pages of a type
 */
export async function bulkUpdateInternalLinks(
  pageType: "state" | "city" | "service"
): Promise<{ success: boolean; updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  try {
    // Get all pages of this type
    const { data: pages } = await supabase
      .from("seo_pages")
      .select("id, slug")
      .eq("page_type", pageType)
      .eq("is_indexed", true);

    if (!pages || pages.length === 0) {
      return { success: true, updated: 0, errors: 0 };
    }

    for (const page of pages) {
      try {
        let links: InternalLink[] = [];

        if (pageType === "state") {
          // Get state ID from slug
          const { data: state } = await supabase
            .from("states")
            .select("id")
            .eq("slug", page.slug)
            .single();

          if (state) {
            const result = await generateStateInternalLinks(state.id);
            if (result.success) {
              links = result.links;
            }
          }
        } else if (pageType === "city") {
          // Get city from slug (format: state-slug/city-slug)
          const parts = page.slug.split("/");
          if (parts.length === 2) {
            const { data: city } = await supabase
              .from("cities")
              .select("id")
              .eq("slug", parts[1])
              .single();

            if (city) {
              const result = await generateCityInternalLinks(city.id);
              if (result.success) {
                links = result.links;
              }
            }
          }
        } else if (pageType === "service") {
          const result = await generateServiceInternalLinks(page.slug);
          if (result.success) {
            links = result.links;
          }
        }

        if (links.length > 0) {
          const updateResult = await updateSeoPageInternalLinks(page.id, links);
          if (updateResult.success) {
            updated++;
          } else {
            errors++;
          }
        }
      } catch {
        errors++;
      }
    }

    return { success: true, updated, errors };
  } catch (error: any) {
    return { success: false, updated, errors };
  }
}
