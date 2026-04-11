/**
 * useAnalytics - Google Analytics 4 hook for event tracking
 * 
 * Tracks all 8 core conversion events per SEO Roadmap:
 * - appointment_request
 * - phone_click
 * - email_click
 * - profile_view
 * - review_submission
 * - insurance_check
 * - service_filter_use
 * - city_search
 */

import { useCallback } from 'react';

// GA4 Event types matching roadmap requirements
export type GA4Event = 
  | 'appointment_request'
  | 'phone_click'
  | 'email_click'
  | 'profile_view'
  | 'review_submission'
  | 'insurance_check'
  | 'service_filter_use'
  | 'city_search'
  | 'page_view'
  | 'blog_read'
  | 'cta_click'
  | 'form_start'
  | 'form_submit';

export interface EventParams {
  // Common params
  page_location?: string;
  page_title?: string;
  
  // Appointment events
  clinic_id?: string;
  clinic_name?: string;
  dentist_id?: string;
  dentist_name?: string;
  treatment_type?: string;
  
  // Location events
  city?: string;
  state?: string;
  service?: string;
  
  // Search/filter events
  search_term?: string;
  filter_type?: string;
  filter_value?: string;
  results_count?: number;
  
  // Insurance events
  insurance_provider?: string;
  
  // Content events
  content_type?: string;
  content_id?: string;
  
  // Engagement
  engagement_time_msec?: number;
  
  // Custom params
  [key: string]: string | number | boolean | undefined;
}

// Note: Window.gtag and Window.dataLayer are declared in GoogleAnalytics.tsx
// Do NOT redeclare them here to avoid type conflicts

// Check if GA is loaded
const isGALoaded = (): boolean => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

// Get measurement ID from meta tag (injected server-side)
const getMeasurementId = (): string | null => {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="ga-measurement-id"]');
  return meta?.getAttribute('content') || null;
};

export function useAnalytics() {
  /**
   * Track a custom event
   */
  const trackEvent = useCallback((eventName: GA4Event, params?: EventParams) => {
    if (!isGALoaded()) {
      console.debug('[Analytics] gtag not loaded, skipping event:', eventName);
      return;
    }
    
    try {
      window.gtag('event', eventName, {
        ...params,
        send_to: getMeasurementId() || undefined,
      });
      console.debug('[Analytics] Event tracked:', eventName, params);
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error);
    }
  }, []);

  /**
   * Track appointment request
   */
  const trackAppointmentRequest = useCallback((params: {
    clinic_id: string;
    clinic_name: string;
    dentist_id?: string;
    dentist_name?: string;
    treatment_type?: string;
    city?: string;
    state?: string;
  }) => {
    trackEvent('appointment_request', {
      ...params,
      content_type: 'appointment',
    });
  }, [trackEvent]);

  /**
   * Track phone click (click-to-call)
   */
  const trackPhoneClick = useCallback((params: {
    clinic_id: string;
    clinic_name: string;
    phone_number?: string;
  }) => {
    trackEvent('phone_click', {
      ...params,
      content_type: 'contact',
    });
  }, [trackEvent]);

  /**
   * Track email click
   */
  const trackEmailClick = useCallback((params: {
    clinic_id: string;
    clinic_name: string;
    email?: string;
  }) => {
    trackEvent('email_click', {
      ...params,
      content_type: 'contact',
    });
  }, [trackEvent]);

  /**
   * Track profile view (dentist or clinic)
   */
  const trackProfileView = useCallback((params: {
    profile_type: 'clinic' | 'dentist';
    profile_id: string;
    profile_name: string;
    city?: string;
    state?: string;
  }) => {
    trackEvent('profile_view', {
      content_type: params.profile_type,
      content_id: params.profile_id,
      clinic_name: params.profile_name,
      city: params.city,
      state: params.state,
    });
  }, [trackEvent]);

  /**
   * Track review submission
   */
  const trackReviewSubmission = useCallback((params: {
    clinic_id: string;
    clinic_name: string;
    rating: number;
  }) => {
    trackEvent('review_submission', {
      ...params,
      content_type: 'review',
    });
  }, [trackEvent]);

  /**
   * Track insurance check/filter
   */
  const trackInsuranceCheck = useCallback((params: {
    insurance_provider: string;
    city?: string;
    state?: string;
    results_count?: number;
  }) => {
    trackEvent('insurance_check', {
      ...params,
      filter_type: 'insurance',
    });
  }, [trackEvent]);

  /**
   * Track service/treatment filter
   */
  const trackServiceFilter = useCallback((params: {
    service: string;
    city?: string;
    state?: string;
    results_count?: number;
  }) => {
    trackEvent('service_filter_use', {
      filter_type: 'service',
      filter_value: params.service,
      city: params.city,
      state: params.state,
      results_count: params.results_count,
    });
  }, [trackEvent]);

  /**
   * Track city search
   */
  const trackCitySearch = useCallback((params: {
    search_term?: string;
    city: string;
    state?: string;
    results_count?: number;
  }) => {
    trackEvent('city_search', {
      ...params,
      filter_type: 'location',
    });
  }, [trackEvent]);

  /**
   * Track page view (for SPA navigation)
   */
  const trackPageView = useCallback((params?: {
    page_path?: string;
    page_title?: string;
  }) => {
    if (!isGALoaded()) return;
    
    const measurementId = getMeasurementId();
    if (!measurementId) return;

    window.gtag('config', measurementId, {
      page_path: params?.page_path || window.location.pathname,
      page_title: params?.page_title || document.title,
    });
  }, []);

  /**
   * Track CTA click
   */
  const trackCTAClick = useCallback((params: {
    cta_text: string;
    cta_location: string;
    destination?: string;
  }) => {
    trackEvent('cta_click', {
      content_type: 'cta',
      ...params,
    });
  }, [trackEvent]);

  /**
   * Track blog article read
   */
  const trackBlogRead = useCallback((params: {
    article_id: string;
    article_title: string;
    category?: string;
    read_percentage?: number;
  }) => {
    trackEvent('blog_read', {
      content_type: 'blog',
      content_id: params.article_id,
      ...params,
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackAppointmentRequest,
    trackPhoneClick,
    trackEmailClick,
    trackProfileView,
    trackReviewSubmission,
    trackInsuranceCheck,
    trackServiceFilter,
    trackCitySearch,
    trackPageView,
    trackCTAClick,
    trackBlogRead,
  };
}

export default useAnalytics;
