import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeStateSlug } from "@/lib/slug/normalizeStateSlug";

export interface SeoPageContent {
  id: string;
  slug: string;
  page_type: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  content: string | null;
  og_title: string | null;
  og_description: string | null;
  is_optimized: boolean;
  faq_json?: { question: string; answer: string }[] | null;
  faqs?: { question: string; answer: string }[] | null;
}

/**
 * Hook to fetch SEO content from seo_pages table for any page by slug
 */
export function useSeoPageContent(slug: string | undefined) {
  return useQuery({
    queryKey: ["seo-page-content", slug],
    queryFn: async (): Promise<SeoPageContent | null> => {
      if (!slug) return null;

      // Normalize slug - remove leading/trailing slashes
      const normalizedSlug = slug.replace(/^\/+|\/+$/g, "");

      // Also normalize directory state segment when present (e.g., california -> ca)
      // This fixes mismatches where generated content was saved under /ca/... but
      // the user navigated to /ca/...
      const parts = normalizedSlug.split("/").filter(Boolean);
      const normalizedStatefulSlug =
        parts.length >= 1
          ? [normalizeStateSlug(parts[0]), ...parts.slice(1)].join("/")
          : normalizedSlug;

      // Some historical/generated slugs store the city segment with a state suffix
      // (e.g. "/ca/antioch-ca/teeth-whitening"), while the router may use "/ca/antioch/...".
      // Add a safe candidate that appends "-<state>" to the city segment when applicable.
      const stateSegment = parts[0] ? normalizeStateSlug(parts[0]) : "";
      const citySegment = parts[1] || "";
      const cityWithStateSuffix =
        stateSegment && citySegment && !citySegment.endsWith(`-${stateSegment}`)
          ? `${citySegment}-${stateSegment}`
          : citySegment;
      const cityStatefulSlug =
        parts.length >= 2
          ? [stateSegment, cityWithStateSuffix, ...parts.slice(2)].filter(Boolean).join("/")
          : null;

      // Database stores slugs with or without leading slashes
      // Use a single query with multiple candidates for efficiency
      // Also include trailing-slash variants because many generated pages are
      // stored as "/path/" (canonical URLs) while routes are usually "path".
      const withTrailingSlash = (s: string) => (s.endsWith("/") ? s : `${s}/`);
      const withoutTrailingSlash = (s: string) => s.replace(/\/+$/g, "");

      const candidates = Array.from(
        new Set([
          normalizedSlug,
          `/${normalizedSlug}`,
          normalizedStatefulSlug,
          `/${normalizedStatefulSlug}`,
          ...(cityStatefulSlug ? [cityStatefulSlug, `/${cityStatefulSlug}`] : []),
          withTrailingSlash(normalizedSlug),
          withTrailingSlash(`/${normalizedSlug}`),
          withTrailingSlash(normalizedStatefulSlug),
          withTrailingSlash(`/${normalizedStatefulSlug}`),
          ...(cityStatefulSlug ? [withTrailingSlash(cityStatefulSlug), withTrailingSlash(`/${cityStatefulSlug}`)] : []),
          // Defensive: if caller already provided a trailing slash, also try without
          withoutTrailingSlash(normalizedSlug),
          `/${withoutTrailingSlash(normalizedSlug)}`,
          withoutTrailingSlash(normalizedStatefulSlug),
          `/${withoutTrailingSlash(normalizedStatefulSlug)}`,
          ...(cityStatefulSlug
            ? [
                withoutTrailingSlash(cityStatefulSlug),
                `/${withoutTrailingSlash(cityStatefulSlug)}`,
              ]
            : []),
        ].filter(Boolean))
      );

      // First try to get optimized content with actual content
      const { data: optimizedData, error: optimizedError } = await supabase
        .from("seo_pages")
        .select("*")
        .in("slug", candidates)
        .eq("is_optimized", true)
        .not("content", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (optimizedError) {
        console.error("Error fetching SEO page content:", optimizedError);
      }

      // Helper to safely parse faqs from JSON to typed array
      const parseFaqs = (rawFaqs: unknown): { question: string; answer: string }[] | null => {
        if (!rawFaqs) return null;
        if (!Array.isArray(rawFaqs)) return null;
        // Validate each item has question and answer
        const validated = rawFaqs.filter(
          (item): item is { question: string; answer: string } =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.question === 'string' &&
            typeof item.answer === 'string'
        );
        return validated.length > 0 ? validated : null;
      };

      // If we found optimized content, return it
      if (optimizedData && optimizedData.content) {
        return {
          ...optimizedData,
          faqs: parseFaqs(optimizedData.faqs),
        } as SeoPageContent;
      }

      // Fallback: Get any page with content (even if not marked optimized)
      const { data: anyData, error: anyError } = await supabase
        .from("seo_pages")
        .select("*")
        .in("slug", candidates)
        .not("content", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyError) {
        console.error("Error fetching fallback SEO content:", anyError);
      }

      if (anyData) {
        return {
          ...anyData,
          faqs: parseFaqs(anyData.faqs),
        } as SeoPageContent;
      }

      // CRITICAL: Third fallback - get page with meta_title/meta_description
      // even if it has no body content. This ensures meta tags from the
      // Meta Optimizer tab are always used on the live site.
      const { data: metaOnlyData, error: metaOnlyError } = await supabase
        .from("seo_pages")
        .select("*")
        .in("slug", candidates)
        .or("meta_title.not.is.null,meta_description.not.is.null")
        .order("is_optimized", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (metaOnlyError) {
        console.error("Error fetching meta-only SEO content:", metaOnlyError);
        return null;
      }

      if (metaOnlyData) {
        return {
          ...metaOnlyData,
          faqs: parseFaqs(metaOnlyData.faqs),
        } as SeoPageContent;
      }

      return null;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (SEO content rarely changes)
    gcTime: 30 * 60 * 1000, // Keep in garbage collection for 30 minutes
  });
}

/**
 * Parse markdown content to extract sections
 */
export function parseMarkdownContent(content: string | null): {
  intro: string;
  sections: { heading: string; content: string; level: number }[];
} {
  if (!content) {
    return { intro: "", sections: [] };
  }

  const lines = content.split("\n");
  let intro = "";
  const sections: { heading: string; content: string; level: number }[] = [];
  let currentSection: { heading: string; content: string; level: number } | null = null;
  let inIntro = true;

  for (const line of lines) {
    // Check for headings
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h2Match) {
      inIntro = false;
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { heading: h2Match[1], content: "", level: 2 };
    } else if (h3Match) {
      inIntro = false;
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { heading: h3Match[1], content: "", level: 3 };
    } else if (inIntro) {
      intro += line + "\n";
    } else if (currentSection) {
      currentSection.content += line + "\n";
    }
  }

  // Push last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return { intro: intro.trim(), sections };
}

/**
 * Parse FAQ from content or JSON
 */
export function parseFaqFromContent(
  content: string | null,
  faqJson?: { question: string; answer: string }[] | null
): { question: string; answer: string }[] {
  // If we have FAQ JSON, use it directly
  if (faqJson && Array.isArray(faqJson) && faqJson.length > 0) {
    return faqJson;
  }

  // Otherwise, try to extract from content
  if (!content) return [];

  const faqs: { question: string; answer: string }[] = [];
  const lines = content.split("\n");
  let inFaqSection = false;
  let currentQuestion = "";
  let currentAnswer = "";

  for (const line of lines) {
    // Check if we're in FAQ section
    if (line.match(/^##\s*Frequently Asked Questions/i)) {
      inFaqSection = true;
      continue;
    }

    // If we hit another H2, we're out of FAQ section
    if (inFaqSection && line.match(/^## (?!Frequently)/)) {
      inFaqSection = false;
      if (currentQuestion && currentAnswer) {
        faqs.push({ question: currentQuestion, answer: currentAnswer.trim() });
      }
      continue;
    }

    if (inFaqSection) {
      const h3Match = line.match(/^### (.+)$/);
      if (h3Match) {
        // Save previous FAQ
        if (currentQuestion && currentAnswer) {
          faqs.push({ question: currentQuestion, answer: currentAnswer.trim() });
        }
        currentQuestion = h3Match[1];
        currentAnswer = "";
      } else if (currentQuestion) {
        currentAnswer += line + "\n";
      }
    }
  }

  // Push last FAQ
  if (currentQuestion && currentAnswer) {
    faqs.push({ question: currentQuestion, answer: currentAnswer.trim() });
  }

  return faqs;
}
