import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { SEOContentBlock } from "@/components/seo/SEOContentBlock";
import { PageIntroSection } from "@/components/seo/PageIntroSection";
import { GeographicLinkBlock } from "@/components/seo/GeographicLinkBlock";
import { SEOHead } from "@/components/seo/SEOHead";
import { SyncStructuredData } from "@/components/seo/SyncStructuredData";
import { useSeoPageContent } from "@/hooks/useSeoPageContent";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";
import { DentistFinderLayout, DentistFinderCard, DentistFinderProfile } from "@/components/finder";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Star,
} from "lucide-react";

interface SearchResultsPageProps {
  initialService?: string;
  initialLocation?: string;
}

export default function SearchResultsPage({ initialService, initialLocation }: SearchResultsPageProps) {
  const [searchParams] = useSearchParams();
  const service = searchParams.get('service') || initialService || '';
  const location = searchParams.get('location') || initialLocation || '';
  
  const isReady = usePrerenderReady(!!service || !!location);

  // Get city/state from location string
  const locationParts = location.split(',').map(p => p.trim());
  const cityName = locationParts[0];
  const stateName = locationParts[1];

  // Fetch city and state data
  const { data: cityData } = useQuery({
    queryKey: ['search-city', cityName],
    queryFn: async () => {
      if (!cityName) return null;
      const { data } = await supabase
        .from('cities')
        .select('id, name, slug, state_id')
        .ilike('name', cityName)
        .eq('is_active', true)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!cityName
  });

  const { data: stateData } = useQuery({
    queryKey: ['search-state', stateName],
    queryFn: async () => {
      if (!stateName) return null;
      const { data } = await supabase
        .from('states')
        .select('id, name, slug, abbreviation')
        .ilike('name', stateName)
        .eq('is_active', true)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!stateName
  });

  // SEO content
  const seoSlug = location ? location.toLowerCase().replace(/\s+/g, '-') : 'search';
  const { data: seoContent } = useSeoPageContent(seoSlug);

  // Generate structured data
  const structuredData = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `Search Dentists${service ? ` for ${service}` : ''}${location ? ` in ${location}` : ''}`,
    "description": `Find dentists${service ? ` offering ${service}` : ''}${location ? ` in ${location}` : ''}. View ratings, reviews, and book appointments.`
  }), [service, location]);

  const pageTitle = service 
    ? `Find ${service}${location ? ` in ${location}` : ''}`
    : `Search Dentists${location ? ` in ${location}` : ''}`;
    
  const pageDescription = service
    ? `Search results for ${service} dentists${location ? ` in ${location}` : ''}. Find top-rated dental clinics, view ratings and reviews, and book appointments online.`
    : `Search dentists${location ? ` in ${location}` : ''}. Find the best dental clinics and dentists near you.`;

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-8">
          <div className="max-w-7xl mx-auto">
            <Skeleton className="h-10 w-64 bg-white/20 mb-4" />
            <Skeleton className="h-6 w-96 bg-white/20" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
      />
      <SyncStructuredData data={structuredData} />
      
      <DentistFinderLayout
        title={service ? `${service} in ${location || 'UAE'}` : `Dentists in ${location || 'UAE'}`}
        description={service ? `Find the best ${service} specialists` : `Find dentists and dental clinics near you`}
        initialLocation={location}
        initialCityId={cityData?.id}
        initialStateId={stateData?.id}
        showFilters={true}
      />
    </>
  );
}