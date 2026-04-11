/**
 * Performance utilities for optimizing Core Web Vitals
 */

/**
 * Debounce function to limit expensive operations
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit execution frequency
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Schedule non-critical work during idle time
 */
export function scheduleIdleWork(work: () => void, timeout?: number): void {
  if (typeof window === 'undefined') {
    work();
    return;
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(
      (deadline) => {
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
          work();
        }
      },
      { timeout: timeout || 2000 }
    );
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(work, 1);
  }
}

/**
 * Prefetch a resource (image, script, etc.)
 */
export function prefetchResource(url: string, as: 'image' | 'script' | 'style' | 'document' = 'document'): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
}

/**
 * Preload a critical resource
 */
export function preloadResource(url: string, as: 'image' | 'script' | 'style' | 'font', type?: string): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = as;
  if (type) link.type = type;
  if (as === 'font') link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

/**
 * Measure Core Web Vitals
 */
interface WebVitalsMetric {
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id: string;
  navigationType?: string;
}

export function measureWebVitals(onMetric: (metric: WebVitalsMetric) => void): void {
  if (typeof window === 'undefined') return;

  // CLS - Cumulative Layout Shift
  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];

  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        clsEntries.push(entry);
        clsValue += (entry as any).value;
      }
    }
  });

  try {
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    // Layout Shift not supported
  }

  // LCP - Largest Contentful Paint
  let lcpValue = 0;
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    lcpValue = lastEntry.startTime;
  });

  try {
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    // LCP not supported
  }

  // FCP - First Contentful Paint
  const fcpObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        onMetric({
          name: 'FCP',
          value: entry.startTime,
          rating: entry.startTime <= 1800 ? 'good' : entry.startTime <= 3000 ? 'needs-improvement' : 'poor',
          id: entry.entryType,
        });
      }
    }
  });

  try {
    fcpObserver.observe({ entryTypes: ['paint'] });
  } catch (e) {
    // Paint not supported
  }

  // Report metrics on page hide
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (clsValue > 0) {
        onMetric({
          name: 'CLS',
          value: clsValue,
          rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
          id: 'cls',
        });
      }
      if (lcpValue > 0) {
        onMetric({
          name: 'LCP',
          value: lcpValue,
          rating: lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs-improvement' : 'poor',
          id: 'lcp',
        });
      }
    }
  });
}

/**
 * Optimize scroll performance with passive listeners
 */
export function addPassiveEventListener(
  element: EventTarget,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): () => void {
  const opts = { passive: true, ...options };
  element.addEventListener(event, handler, opts);
  return () => element.removeEventListener(event, handler, opts);
}

/**
 * Batch DOM reads and writes
 */
export function batchDOMOperations<T>(
  reads: (() => T)[],
  writes: ((data: T[]) => void)[]
): void {
  // Read phase
  const data = reads.map((read) => read());
  
  // Write phase - use requestAnimationFrame for visual changes
  requestAnimationFrame(() => {
    writes.forEach((write) => write(data));
  });
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user has data saver enabled
 */
export function isDataSaverEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as any).connection;
  return conn?.saveData === true;
}

/**
 * Check connection speed
 */
export function getConnectionSpeed(): 'slow-2g' | '2g' | '3g' | '4g' {
  if (typeof navigator === 'undefined') return '4g';
  const conn = (navigator as any).connection;
  if (!conn) return '4g';
  return conn.effectiveType || '4g';
}

/**
 * Conditionally load based on connection
 */
export function shouldLoadHeavyContent(): boolean {
  if (isDataSaverEnabled()) return false;
  const speed = getConnectionSpeed();
  return speed === '4g' || speed === '3g';
}

export default {
  debounce,
  throttle,
  scheduleIdleWork,
  prefetchResource,
  preloadResource,
  measureWebVitals,
  prefersReducedMotion,
  isDataSaverEnabled,
  getConnectionSpeed,
  shouldLoadHeavyContent,
};
