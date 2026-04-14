import { useState, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/seo/SEOHead";
import { 
  useInsuranceClinics, 
  useInsuranceFilterOptions 
} from "@/hooks/useInsuranceClinics";
import { InsuranceClinicRow } from "@/components/insurance/InsuranceClinicRow";
import { InsurancePagination } from "@/components/insurance/InsurancePagination";
import { InsuranceFilters } from "@/components/insurance/InsuranceFilters";
import { InsuranceFAQ } from "@/components/insurance/InsuranceFAQ";
import { buildInsuranceUrl } from "@/lib/url/buildProfileUrl";
import { 
  Shield, 
  Building2, 
  BadgeCheck,
  Phone,
  ArrowLeft,
  FileCheck,
  Sparkles,
  HeadphonesIcon
} from "lucide-react";

const PAGE_SIZE = 20;

const InsuranceDetailPage = () => {
  const { insuranceSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const slug = insuranceSlug || "";

  // Parse URL params
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const cityFilter = searchParams.get("city");
  const stateFilter = searchParams.get("state");
  const sortParam = searchParams.get("sort") as "rating" | "reviews" | "name" | null;
  const ratingParam = searchParams.get("rating");

  const [sortBy, setSortBy] = useState<"rating" | "reviews" | "name">(sortParam || "rating");
  const [minRating, setMinRating] = useState<number | undefined>(
    ratingParam ? parseFloat(ratingParam) : undefined
  );

  // Fetch insurance details
  const { data: insurance, isLoading: insuranceLoading } = useQuery({
    queryKey: ["insurance", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("insurances")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  // Fetch paginated clinics
  const { clinics, totalCount, totalPages, isLoading: clinicsLoading } = useInsuranceClinics({
    insuranceId: insurance?.id,
    cityFilter,
    stateFilter,
    page: currentPage,
    pageSize: PAGE_SIZE,
    sortBy,
    minRating,
  });

  // Fetch filter options
  const { cities } = useInsuranceFilterOptions(insurance?.id);

  // Handlers
  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleCityChange = useCallback((citySlug: string | null, stateSlug: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page"); // Reset to page 1
    if (citySlug && stateSlug) {
      params.set("city", citySlug);
      params.set("state", stateSlug);
    } else {
      params.delete("city");
      params.delete("state");
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleSortChange = useCallback((sort: "rating" | "reviews" | "name") => {
    setSortBy(sort);
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    params.set("sort", sort);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleRatingChange = useCallback((rating: number | undefined) => {
    setMinRating(rating);
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    if (rating) {
      params.set("rating", String(rating));
    } else {
      params.delete("rating");
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setMinRating(undefined);
    setSortBy("rating");
    setSearchParams({});
  }, [setSearchParams]);

  const isLoading = insuranceLoading || clinicsLoading;

  // Loading state - maintain semantic HTML structure for bots
  if (insuranceLoading) {
    return (
      <PageLayout>
        <SEOHead
          title="Loading Insurance Provider - AppointPanda"
          description="Loading dental insurance provider information. Find clinics that accept your dental insurance."
          canonical={`/insurance/${slug}/`}
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center" role="status" aria-label="Loading insurance details">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading insurance details...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Not found state (matches 404 page style)
  if (!insurance) {
    return (
      <PageLayout>
        <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-background to-muted/30">
          <div className="text-center px-4 max-w-md">
            <div className="mb-6">
              <span className="text-8xl font-black bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">
                404
              </span>
            </div>
            <h1 className="mb-3 text-2xl font-bold text-foreground">
              Insurance Not Found
            </h1>
            <p className="mb-6 text-muted-foreground">
              The insurance provider you're looking for doesn't exist or has been removed.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="default" className="gap-2">
                <Link to="/insurance/">
                  <Shield className="h-4 w-4" />
                  Browse All Insurance
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Go Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const benefits = [
    { icon: FileCheck, title: "Direct Billing", desc: "No upfront payment required" },
    { icon: Sparkles, title: "Pre-Approval", desc: "Clinics handle paperwork" },
    { icon: HeadphonesIcon, title: "Claims Help", desc: "Assistance with claims" },
  ];

  return (
    <PageLayout>
      <SEOHead
        title={`${insurance.name} Dentists - Find Providers Accepting ${insurance.name}`}
        description={`Find ${totalCount}+ dental clinics that accept ${insurance.name} insurance. Direct billing available. Book your appointment today.`}
        canonical={buildInsuranceUrl(insurance.slug)}
        keywords={[`${insurance.name} dental`, `${insurance.name} dentist`, "dental insurance"]}
      />

      {/* Compact Hero */}
      <div className="bg-gradient-to-b from-muted/50 to-background border-b border-border">
        <div className="container py-8 md:py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <span>/</span>
            <Link to="/insurance/" className="hover:text-primary transition-colors">Insurance</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{insurance.name}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Logo */}
            <div className="shrink-0 h-20 w-20 rounded-2xl bg-card border border-border flex items-center justify-center">
              {insurance.logo_url ? (
                <img 
                  src={insurance.logo_url} 
                  alt={insurance.name}
                  className="h-14 w-14 object-contain"
                />
              ) : (
                <Shield className="h-10 w-10 text-primary" />
              )}
            </div>

            {/* Title + Stats */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
                {insurance.name}
              </h1>
              <p className="text-muted-foreground mb-3">
                Find dental clinics that accept {insurance.name} insurance with direct billing.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-bold">{totalCount}</span>
                  <span className="text-muted-foreground">Clinics</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Verified Providers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Pills - Compact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {benefits.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <b.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs truncate">{b.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Section size="md">
        {/* Filters */}
        <InsuranceFilters
          totalCount={totalCount}
          cities={cities}
          selectedCity={cityFilter}
          selectedState={stateFilter}
          sortBy={sortBy}
          minRating={minRating}
          onCityChange={handleCityChange}
          onSortChange={handleSortChange}
          onRatingChange={handleRatingChange}
          onClearFilters={handleClearFilters}
        />

        {/* Results */}
        {clinicsLoading ? (
          <div className="space-y-3 mt-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : clinics.length > 0 ? (
          <>
            <div className="space-y-3 mt-6">
              {clinics.map((clinic) => (
                <InsuranceClinicRow
                  key={clinic.id}
                  clinic={clinic}
                  insuranceName={insurance.name}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8">
              <InsurancePagination
                currentPage={currentPage}
                totalPages={totalPages}
                baseUrl={buildInsuranceUrl(insurance.slug)}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        ) : (
          <div className="text-center py-16 rounded-xl border border-dashed border-border mt-6">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">No Clinics Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {cityFilter
                ? "No clinics match your filters. Try adjusting your search."
                : `We're adding clinics that accept ${insurance.name}.`}
            </p>
            {cityFilter && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </Section>

      {/* FAQ Section */}
      <Section variant="muted" size="md">
        <InsuranceFAQ insuranceName={insurance.name} />
      </Section>

      {/* Other Insurance Links */}
      <Section size="md">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">Other Insurance Providers</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {["Delta Dental", "Cigna", "Aetna", "MetLife", "UnitedHealthcare", "Humana"].map((provider) => (
            <Link
              key={provider}
              to={buildInsuranceUrl(provider.toLowerCase().replace(/\s+/g, "-"))}
              className="px-4 py-2 bg-muted rounded-full hover:bg-primary hover:text-primary-foreground transition-all font-medium text-sm"
            >
              {provider}
            </Link>
          ))}
          <Link
            to="/insurance/"
            className="px-4 py-2 border border-primary text-primary rounded-full hover:bg-primary hover:text-primary-foreground transition-all font-medium text-sm"
          >
            View All
          </Link>
        </div>
      </Section>
    </PageLayout>
  );
};

export default InsuranceDetailPage;
