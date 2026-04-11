/**
 * useWebVitals - Core Web Vitals monitoring hook
 * 
 * Monitors and reports LCP, FID, CLS, TTFB, and FCP
 * for performance tracking and optimization.
 */

import { useEffect, useRef } from 'react';

interface WebVitalsMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'FCP' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

interface UseWebVitalsOptions {
  /** Report metrics to console in development */
  debug?: boolean;
  /** Custom reporter function */
  onReport?: (metric: WebVitalsMetric) => void;
}

// Rating thresholds based on Core Web Vitals
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  TTFB: { good: 800, needsImprovement: 1800 },
  FCP: { good: 1800, needsImprovement: 3000 },
  INP: { good: 200, needsImprovement: 500 },
};

const getRating = (
  name: keyof typeof THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
};

export function useWebVitals(options: UseWebVitalsOptions = {}) {
  const { debug = false, onReport } = options;
  const metricsRef = useRef<Map<string, WebVitalsMetric>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reportMetric = (metric: WebVitalsMetric) => {
      metricsRef.current.set(metric.name, metric);

      if (debug) {
        const color =
          metric.rating === 'good'
            ? '#0cce6b'
            : metric.rating === 'needs-improvement'
            ? '#ffa400'
            : '#ff4e42';
        
        console.log(
          `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`,
          `color: ${color}; font-weight: bold;`
        );
      }

      onReport?.(metric);
    };

    // Use PerformanceObserver API
    try {
      // LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        
        reportMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          rating: getRating('LCP', lastEntry.startTime),
          delta: lastEntry.startTime,
          id: `lcp-${Date.now()}`,
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // FCP (First Contentful Paint)
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const fcpEntry = entries.find((e) => e.name === 'first-contentful-paint');
        
        if (fcpEntry) {
          reportMetric({
            name: 'FCP',
            value: fcpEntry.startTime,
            rating: getRating('FCP', fcpEntry.startTime),
            delta: fcpEntry.startTime,
            id: `fcp-${Date.now()}`,
          });
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });

      // CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        
        reportMetric({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          delta: clsValue,
          id: `cls-${Date.now()}`,
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // FID (First Input Delay) - deprecated, but still useful
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const firstEntry = entries[0] as PerformanceEventTiming;
        
        if (firstEntry) {
          const fid = firstEntry.processingStart - firstEntry.startTime;
          reportMetric({
            name: 'FID',
            value: fid,
            rating: getRating('FID', fid),
            delta: fid,
            id: `fid-${Date.now()}`,
          });
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });

      // TTFB (Time to First Byte)
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navEntry) {
        const ttfb = navEntry.responseStart - navEntry.requestStart;
        reportMetric({
          name: 'TTFB',
          value: ttfb,
          rating: getRating('TTFB', ttfb),
          delta: ttfb,
          id: `ttfb-${Date.now()}`,
        });
      }

      return () => {
        lcpObserver.disconnect();
        fcpObserver.disconnect();
        clsObserver.disconnect();
        fidObserver.disconnect();
      };
    } catch (e) {
      // PerformanceObserver not supported
      if (debug) {
        console.warn('[Web Vitals] PerformanceObserver not supported');
      }
    }
  }, [debug, onReport]);

  return {
    getMetrics: () => Object.fromEntries(metricsRef.current),
  };
}

/**
 * PerformanceMonitor component - Add to app root for automatic monitoring
 */
export function PerformanceMonitor({ debug = false }: { debug?: boolean }) {
  useWebVitals({ debug });
  return null;
}

export default useWebVitals;
