/**
 * Centralized URL builders for profile and location URLs.
 * 
 * CANONICAL FORMAT: All URLs must end with trailing slash.
 * This is the SINGLE SOURCE OF TRUTH for URL generation.
 * 
 * NO /ae/ PREFIX - The legacy UAE format has been removed.
 */

import { withTrailingSlash } from "./withTrailingSlash";

export interface DentistData {
  slug: string;
}

export interface ClinicData {
  slug: string;
}

export interface CityData {
  slug: string;
  state?: { slug: string } | null;
  states?: { slug: string } | { slug: string }[] | null;
}

export interface ServiceData {
  slug: string;
}

/**
 * Build canonical dentist profile URL
 * Format: /dentist/{slug}/
 */
export function buildDentistProfileUrl(dentist: DentistData): string {
  if (!dentist?.slug) return "/";
  return withTrailingSlash(`/dentist/${dentist.slug}`);
}

/**
 * Build canonical clinic profile URL
 * Format: /clinic/{slug}/
 */
export function buildClinicProfileUrl(clinic: ClinicData): string {
  if (!clinic?.slug) return "/";
  return withTrailingSlash(`/clinic/${clinic.slug}`);
}

/**
 * Build state page URL
 * Format: /{stateSlug}/
 */
export function buildStateUrl(stateSlug: string): string {
  if (!stateSlug) return "/";
  return withTrailingSlash(`/${stateSlug}`);
}

/**
 * Build city page URL
 * Format: /{stateSlug}/{citySlug}/
 */
export function buildCityUrl(stateSlug: string, citySlug: string): string {
  if (!stateSlug || !citySlug) return "/";
  return withTrailingSlash(`/${stateSlug}/${citySlug}`);
}

/**
 * Build city URL from city object with state relation
 */
export function buildCityUrlFromData(city: CityData): string {
  if (!city?.slug) return "/";
  
  // Handle different state data formats
  let stateSlug: string | undefined;
  if (city.state?.slug) {
    stateSlug = city.state.slug;
  } else if (city.states) {
    const statesData = Array.isArray(city.states) ? city.states[0] : city.states;
    stateSlug = statesData?.slug;
  }
  
  if (!stateSlug) return "/";
  return buildCityUrl(stateSlug, city.slug);
}

/**
 * Build service page URL
 * Format: /services/{serviceSlug}/
 */
export function buildServiceUrl(serviceSlug: string): string {
  if (!serviceSlug) return "/services/";
  return withTrailingSlash(`/services/${serviceSlug}`);
}

/**
 * Build service-location page URL
 * Format: /{stateSlug}/{citySlug}/{serviceSlug}/
 */
export function buildServiceLocationUrl(
  stateSlug: string,
  citySlug: string,
  serviceSlug: string
): string {
  if (!stateSlug || !citySlug || !serviceSlug) return "/";
  return withTrailingSlash(`/${stateSlug}/${citySlug}/${serviceSlug}`);
}

/**
 * Build insurance page URL
 * Format: /insurance/{insuranceSlug}/
 */
export function buildInsuranceUrl(insuranceSlug: string): string {
  if (!insuranceSlug) return "/insurance/";
  return withTrailingSlash(`/insurance/${insuranceSlug}`);
}

/**
 * Build review funnel URL
 * Format: /review/{clinicId}/
 */
export function buildReviewUrl(clinicId: string): string {
  if (!clinicId) return "/";
  return withTrailingSlash(`/review/${clinicId}`);
}

/**
 * Build search URL with optional filters
 */
export function buildSearchUrl(params?: Record<string, string>): string {
  const base = withTrailingSlash("/search");
  if (!params || Object.keys(params).length === 0) return base;
  
  const searchParams = new URLSearchParams(params);
  return `${base}?${searchParams.toString()}`;
}
