import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    prerenderReady: boolean;
  }
}

/**
 * Hook to signal Prerender.io that the page is ready for capture.
 * 
 * CRITICAL FOR SEO: This hook controls when bots can capture the page.
 * Only signal ready when ALL SEO-critical content is rendered:
 * - Page headings and titles
 * - Main content sections
 * - FAQs
 * - Schema markup
 * - Internal links
 * 
 * @param isReady - Boolean indicating if ALL page data is loaded
 * @param options - Optional configuration
 */
interface PrerenderOptions {
  /** Delay in ms before signaling ready (default: 500) */
  delay?: number;
  /** Minimum content length to validate (optional) */
  minContentLength?: number;
}

export function usePrerenderReady(isReady: boolean, options?: PrerenderOptions): boolean {
  const hasSignaled = useRef(false);
  const [ready, setReady] = useState(false);
  const delay = options?.delay ?? 500;

  useEffect(() => {
    // Only signal once per page load
    if (isReady && !hasSignaled.current) {
      hasSignaled.current = true;
      
      // Delay to ensure React has committed ALL DOM updates
      const timer = setTimeout(() => {
        setReady(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [isReady, delay]);

  return ready;
}

export default usePrerenderReady;
