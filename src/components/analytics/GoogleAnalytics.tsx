/**
 * GoogleAnalytics - GA4 Script Loader Component
 * 
 * Loads gtag.js and initializes GA4 tracking.
 * Uses measurement ID from environment/settings.
 * 
 * IMPORTANT: This component uses Next.js router for tracking.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';

// Extend Window interface for gtag and dataLayer
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

interface GoogleAnalyticsProps {
  measurementId: string;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const router = useRouter();
  const initializedRef = useRef(false);

  // Track page views on route change
  useEffect(() => {
    if (!measurementId || typeof window === 'undefined') return;
    if (!window.gtag || !initializedRef.current) return;

    // Small delay to ensure page title is updated
    const timeoutId = setTimeout(() => {
      const pathname = router.pathname;
      const search = router.asPath.includes('?') ? '?' + router.asPath.split('?')[1] : '';

      window.gtag('config', measurementId, {
        page_path: pathname + search,
        page_title: document.title,
        page_location: window.location.href,
      });
      console.log('[GA4] Page view:', pathname);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [router.pathname, router.asPath, measurementId]);

  const handleScriptLoad = () => {
    if (typeof window === 'undefined' || !measurementId) return;

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];

    // Define gtag function
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    }
    window.gtag = gtag;

    // Initialize with timestamp and config
    gtag('js', new Date());
    gtag('config', measurementId, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure',
      page_location: window.location.href,
      page_path: window.location.pathname,
    });

    initializedRef.current = true;
    console.log('[GA4] Initialized with measurement ID:', measurementId);

    // Add meta tag for verification panel to detect
    let meta = document.querySelector('meta[name="ga-measurement-id"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'ga-measurement-id');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', measurementId);
  };

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
    </>
  );
}

export default GoogleAnalytics;
