import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  ttfb: number | null;
}

/**
 * usePerformanceMonitor - Monitor Core Web Vitals and performance metrics
 * Use this to track performance improvements and identify bottlenecks
 */
export function usePerformanceMonitor(enableLogging = true) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    cls: null,
    fid: null,
    ttfb: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('PerformanceObserver' in window)) return;

    const observers: PerformanceObserver[] = [];

    // LCP - Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        const lcpValue = lastEntry.startTime;
        
        setMetrics((prev) => ({ ...prev, lcp: lcpValue }));
        
        if (enableLogging) {
          console.log('LCP:', lcpValue, 'ms', lcpValue <= 2500 ? '✅ Good' : lcpValue <= 4000 ? '⚠️ Needs Improvement' : '❌ Poor');
        }
      });
      
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      observers.push(lcpObserver);
    } catch (e) {
      console.warn('LCP not supported');
    }

    // CLS - Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        
        setMetrics((prev) => ({ ...prev, cls: clsValue }));
        
        if (enableLogging) {
          console.log('CLS:', clsValue, clsValue <= 0.1 ? '✅ Good' : clsValue <= 0.25 ? '⚠️ Needs Improvement' : '❌ Poor');
        }
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      observers.push(clsObserver);
    } catch (e) {
      console.warn('CLS not supported');
    }

    // FCP - First Contentful Paint
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            const fcpValue = entry.startTime;
            
            setMetrics((prev) => ({ ...prev, fcp: fcpValue }));
            
            if (enableLogging) {
              console.log('FCP:', fcpValue, 'ms', fcpValue <= 1800 ? '✅ Good' : fcpValue <= 3000 ? '⚠️ Needs Improvement' : '❌ Poor');
            }
          }
        }
      });
      
      fcpObserver.observe({ entryTypes: ['paint'] });
      observers.push(fcpObserver);
    } catch (e) {
      console.warn('FCP not supported');
    }

    // FID - First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidValue = (entry as any).processingStart - entry.startTime;
          
          setMetrics((prev) => ({ ...prev, fid: fidValue }));
          
          if (enableLogging) {
            console.log('FID:', fidValue, 'ms', fidValue <= 100 ? '✅ Good' : fidValue <= 300 ? '⚠️ Needs Improvement' : '❌ Poor');
          }
        }
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
      observers.push(fidObserver);
    } catch (e) {
      console.warn('FID not supported');
    }

    // TTFB - Time to First Byte
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const ttfbValue = navigation.responseStart - navigation.startTime;
        setMetrics((prev) => ({ ...prev, ttfb: ttfbValue }));
        
        if (enableLogging) {
          console.log('TTFB:', ttfbValue, 'ms', ttfbValue <= 800 ? '✅ Good' : ttfbValue <= 1800 ? '⚠️ Needs Improvement' : '❌ Poor');
        }
      }
    } catch (e) {
      console.warn('TTFB calculation failed');
    }

    // Cleanup observers on unmount
    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [enableLogging]);

  return metrics;
}

/**
 * useResourceLoading - Monitor resource loading performance
 */
export function useResourceLogging() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('PerformanceObserver' in window)) return;

    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming;
          
          // Log slow resources (> 1s)
          if (resource.duration > 1000) {
            console.warn('Slow resource:', resource.name, `${resource.duration.toFixed(0)}ms`);
          }
          
          // Log large resources (> 1MB)
          if (resource.transferSize > 1024 * 1024) {
            console.warn('Large resource:', resource.name, `${(resource.transferSize / 1024 / 1024).toFixed(2)}MB`);
          }
        }
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      
      return () => resourceObserver.disconnect();
    } catch (e) {
      console.warn('Resource timing not supported');
    }
  }, []);
}

export default usePerformanceMonitor;
