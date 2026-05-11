import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/integrations/supabase/client';

const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

const getMidnight = (): number => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return midnight.getTime();
};

const isSessionExpired = (lastActivity: number, lastMidnight: number): boolean => {
  const now = Date.now();
  const activityExpired = now - lastActivity > SESSION_DURATION;
  const midnightPassed = now >= getMidnight() && lastMidnight < getMidnight();
  return activityExpired || midnightPassed;
};

const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

const getOrCreateSession = (): { sessionId: string; lastActivity: number; lastMidnight: number; pageViewCount: number } => {
  if (typeof window === 'undefined') {
    return { sessionId: '', lastActivity: 0, lastMidnight: 0, pageViewCount: 0 };
  }

  const stored = localStorage.getItem('visitor_session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (!isSessionExpired(parsed.lastActivity, parsed.lastMidnight)) {
        return parsed;
      }
    } catch {
      // Invalid stored data, create new session
    }
  }

  const newSession = {
    sessionId: generateSessionId(),
    lastActivity: Date.now(),
    lastMidnight: getMidnight(),
    pageViewCount: 0,
  };
  localStorage.setItem('visitor_session', JSON.stringify(newSession));
  return newSession;
};

const updateSessionActivity = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('visitor_session');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.lastActivity = Date.now();
      parsed.lastMidnight = getMidnight();
      localStorage.setItem('visitor_session', JSON.stringify(parsed));
    }
  } catch {}
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
  const session = useRef(getOrCreateSession());
  const pageStartTime = useRef<number>(Date.now());
  const scrollDepth = useRef<number>(0);
  const totalEvents = useRef<number>(0);
  const sessionStartTime = useRef<number>(Date.now());
  const initialized = useRef<boolean>(false);
  const sessionId = session.current.sessionId;

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
            sessionId,
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
      if (location.pathname.startsWith('/admin')) return;

      updateSessionActivity();
      const stored = localStorage.getItem('visitor_session');
      let pageViewCount = 1;
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.pageViewCount = (parsed.pageViewCount || 0) + 1;
        pageViewCount = parsed.pageViewCount;
        localStorage.setItem('visitor_session', JSON.stringify(parsed));
      }

      pageStartTime.current = Date.now();
      scrollDepth.current = 0;

      const pageType = getPageType(location.pathname);
      const pathData = extractPathData(location.pathname);

      try {
        const referrer = document.referrer ? document.referrer.substring(0, 500) : null;
        
        await supabase.functions.invoke('track-visitor', {
          body: {
            type: 'pageview',
            sessionId,
            data: {
              pagePath: location.pathname?.substring(0, 500),
              pageTitle: document.title?.substring(0, 200),
              pageType,
              referrer,
              pageViewCount,
              ...pathData,
            },
          },
        });
      } catch (error) {
        console.error('Failed to track pageview:', error);
      }
    };

    trackPageView();

    return () => {
      const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
      if (timeOnPage > 1) {
        supabase.functions.invoke('track-visitor', {
          body: {
            type: 'pageview',
            sessionId,
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
          sessionId,
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
          sessionId,
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
          sessionId,
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
          sessionId,
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
    sessionId,
    pageViewCount: session.current.pageViewCount,
    trackEvent,
    trackJourneyStep,
    linkPatient,
  };
}
