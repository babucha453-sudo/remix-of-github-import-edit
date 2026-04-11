import { useState, useCallback } from "react";

interface SearchIntent {
  treatments: string[];
  location: {
    state?: string;
    city?: string;
    nearMe?: boolean;
    userLat?: number;
    userLon?: number;
    radiusKm?: number;
  };
  budget: {
    max?: number;
    min?: number;
    preference?: "affordable" | "premium" | "any";
  };
  quantity?: number;
  insurance?: string;
  urgency?: "emergency" | "same_day" | "weekend" | "normal";
  preferences: string[];
  originalQuery: string;
  needsMoreInfo?: boolean;
  missingInfo?: string[];
}

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  address: string;
  city_name: string;
  state_slug: string;
  rating: number;
  review_count: number;
  cover_image_url: string;
  is_paid: boolean;
  relevance_score: number;
  match_reasons: string[];
  treatments_matched: string[];
  price_range?: { from: number; to: number };
  distance_km?: number;
}

interface AISearchResponse {
  results: SearchResult[];
  totalCount: number;
  intent: SearchIntent;
  suggestions: string[];
  followUpQuestion?: string;
  conversationStep?: "ask_service" | "ask_location" | "no_results" | "expand_budget";
  redirectTo?: string;
  searchDurationMs: number;
  fallbackUsed: boolean;
  needsMoreInfo?: boolean;
  missingInfo?: string[];
}

interface UseAISearchOptions {
  onSuccess?: (response: AISearchResponse) => void;
  onError?: (error: string) => void;
}

export function useAISearch(options: UseAISearchOptions = {}) {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [response, setResponse] = useState<AISearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const getUserLocation = useCallback((): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }, []);

  const search = useCallback(async (query: string, forceLocation?: boolean) => {
    if (!query.trim() || query.trim().length < 3) {
      setError("Query must be at least 3 characters");
      return null;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Check if query mentions "near me"
      const needsLocation = query.toLowerCase().includes("near me") || 
                           query.toLowerCase().includes("nearby") ||
                           forceLocation;
      
      let userLocation = null;
      if (needsLocation) {
        userLocation = await getUserLocation();
      }

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/ai-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            query: query.trim(),
            sessionId,
            visitorId:
              typeof window !== "undefined"
                ? window.localStorage.getItem("visitor_id")
                : null,
            userLocation,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Search failed");
      }

      const data: AISearchResponse = await res.json();
      setResponse(data);
      setResults(data.results);
      options.onSuccess?.(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Search failed";
      setError(errorMessage);
      options.onError?.(errorMessage);
      return null;
    } finally {
      setIsSearching(false);
    }
  }, [sessionId, getUserLocation, options]);

  const clear = useCallback(() => {
    setResults([]);
    setResponse(null);
    setError(null);
  }, []);

  const logClick = useCallback(async (resultId: string) => {
    try {
      await fetch(
        `${SUPABASE_URL}/functions/v1/ai-search`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            sessionId,
            clickedResultId: resultId,
          }),
        }
      );
    } catch (err) {
      console.error("Failed to log click:", err);
    }
  }, [sessionId, SUPABASE_URL, SUPABASE_ANON_KEY]);

  return {
    search,
    clear,
    logClick,
    requestLocationPermission,
    isSearching,
    results,
    response,
    error,
    sessionId,
  };
}

export type { SearchIntent, SearchResult, AISearchResponse };
