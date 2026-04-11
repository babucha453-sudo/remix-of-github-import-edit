import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/integrations/supabase/client';

// Generate a unique session ID
const generateSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  
  const stored = sessionStorage.getItem('visitor_session_id');
  if (stored) return stored;
  
  const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  sessionStorage.setItem('visitor_session_id', newId);
  return newId;
};

// Get UTM parameters from URL
const getUtmParams = () => {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
  };
};

// Determine page type from path
const getPageType = (path: string): string => {
  if (path === '/') return 'home';
  if (path.startsWith('/clinic/')) return 'clinic';
  if (path.startsWith('/dentist/')) return 'dentist';
  if (path.startsWith('/city/')) return 'city';
  if (path.startsWith('/state/')) return 'state';
  if (path.startsWith('/service/')) return 'service';
  if (path.startsWith('/search')) return 'search';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/auth')) return 'auth';
  return 'other';
};

// Extract IDs from path
const extractPathData = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  
  if (path.startsWith('/clinic/') && parts[1]) {
    return { clinicSlug: parts[1] };
  }
  if (path.startsWith('/dentist/') && parts[1]) {
    return { dentistSlug: parts[1] };
  }
  if (path.startsWith('/city/') && parts[1]) {
    return { citySlug: parts[1] };
  }
  if (path.startsWith('/state/') && parts[1]) {
    return { stateSlug: parts[1] };
  }
  if (path.startsWith('/service/')) {
    return { 
      treatmentSlug: parts[1],
      citySlug: parts[2],
    };
  }
  return {};
};

export function useVisitorTracking() {
  const router = useRouter();
  const location = { pathname: router.pathname, search: router.asPath.includes('?') ? router.asPath.split('?')[1] : '' };
  const sessionId = useRef<string>(generateSessionId());
  const pageStartTime = useRef<number>(Date.now());
  const scrollDepth = useRef<number>(0);
  const totalPageviews = useRef<number>(0);
  const totalEvents = useRef<number>(0);
  const sessionStartTime = useRef<number>(Date.now());
  const initialized = useRef<boolean>(false);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const depth = Math.round((window.scrollY / scrollHeight) * 100);
        scrollDepth.current = Math.max(scrollDepth.current, depth);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize session
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initSession = async () => {
      try {
        // Truncate referrer to max 500 chars to avoid validation errors
        const referrer = document.referrer ? document.referrer.substring(0, 500) : null;
        
        await supabase.functions.invoke('track-visitor', {
          body: {
            type: 'session',
            sessionId: sessionId.current,
            data: {
              referrer,
              landingPage: window.location.pathname?.substring(0, 500),
              ...getUtmParams(),
            },
          },
        });
      } catch (error) {
        console.error('Failed to init session:', error);
      }
    };

    initSession();
  }, []);

  // Track page views
  useEffect(() => {
    const trackPageView = async () => {
      // Don't track admin pages
      if (location.pathname.startsWith('/admin')) return;

      totalPageviews.current++;
      pageStartTime.current = Date.now();
      scrollDepth.current = 0;

      const pageType = getPageType(location.pathname);
      const pathData = extractPathData(location.pathname);

      try {
        // Truncate values to avoid validation errors
        const referrer = document.referrer ? document.referrer.substring(0, 500) : null;
        
        await supabase.functions.invoke('track-visitor', {
          body: {
            type: 'pageview',
            sessionId: sessionId.current,
            data: {
              pagePath: location.pathname?.substring(0, 500),
              pageTitle: document.title?.substring(0, 200),
              pageType,
              referrer,
              ...pathData,
            },
          },
        });
      } catch (error) {
        console.error('Failed to track pageview:', error);
      }
    };

    trackPageView();

    // Track time on previous page when leaving
    return () => {
      const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
      if (timeOnPage > 1) {
        supabase.functions.invoke('track-visitor', {
          body: {
            type: 'pageview',
            sessionId: sessionId.current,
            data: {
              pagePath: location.pathname,
              timeOnPage,
              scrollDepth: scrollDepth.current,
              exitPage: true,
            },
          },
        }).catch(() => {});
      }
    };
  }, [location.pathname]);

  // Track events
  const trackEvent = useCallback(async (
    eventType: string,
    eventCategory: string,
    metadata?: Record<string, any>
  ) => {
    totalEvents.current++;
    
    try {
      await supabase.functions.invoke('track-visitor', {
        body: {
          type: 'event',
          sessionId: sessionId.current,
          data: {
            eventType,
            eventCategory,
            pagePath: location.pathname,
            metadata,
          },
        },
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, [location.pathname]);

  // Track journey step
  const trackJourneyStep = useCallback(async (
    stage: string,
    stepNumber: number,
    clinicId?: string,
    dentistId?: string
  ) => {
    try {
      await supabase.functions.invoke('track-visitor', {
        body: {
          type: 'journey',
          sessionId: sessionId.current,
          data: {
            stage,
            stepNumber,
            pagePath: location.pathname,
            clinicId,
            dentistId,
          },
        },
      });
    } catch (error) {
      console.error('Failed to track journey:', error);
    }
  }, [location.pathname]);

  // Link session to patient after booking
  const linkPatient = useCallback(async (
    patientName: string,
    patientEmail?: string,
    patientPhone?: string,
    patientId?: string,
    appointmentId?: string
  ) => {
    try {
      // Link patient to session
      await supabase.functions.invoke('track-visitor', {
        body: {
          type: 'link-patient',
          sessionId: sessionId.current,
          data: {
            patientName,
            patientEmail,
            patientPhone,
            patientId,
          },
        },
      });

      // Mark journey as converted
      await supabase.functions.invoke('track-visitor', {
        body: {
          type: 'journey',
          sessionId: sessionId.current,
          data: {
            stage: 'converted',
            stepNumber: 99,
            pagePath: location.pathname,
            converted: true,
            appointmentId,
          },
        },
      });
    } catch (error) {
      console.error('Failed to link patient:', error);
    }
  }, [location.pathname]);

  return {
    sessionId: sessionId.current,
    trackEvent,
    trackJourneyStep,
    linkPatient,
  };
}
