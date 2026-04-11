import { useState, useEffect, useRef, ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  rootMargin?: string;
  threshold?: number;
  delay?: number;
}

/**
 * LazyComponent - Lazy loads components when they enter viewport
 * Reduces initial bundle size and improves TTI (Time to Interactive)
 * 
 * Usage:
 * <LazyComponent>
 *   <HeavyComponent />
 * </LazyComponent>
 */
export function LazyComponent({
  children,
  fallback,
  className,
  rootMargin = '100px 0px',
  threshold = 0.01,
  delay = 0,
}: LazyComponentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            if (delay > 0) {
              setTimeout(() => {
                setIsVisible(true);
                setHasLoaded(true);
              }, delay);
            } else {
              setIsVisible(true);
              setHasLoaded(true);
            }
            observer.disconnect();
          }
        });
      },
      { rootMargin, threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasLoaded, delay, rootMargin, threshold]);

  return (
    <div ref={ref} className={cn('min-h-[1px]', className)}>
      {isVisible ? (
        children
      ) : (
        fallback || (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )
      )}
    </div>
  );
}

interface LazySectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
  placeholderHeight?: string;
}

/**
 * LazySection - For lazy loading entire page sections
 * Use for below-the-fold content like footer, testimonials, etc.
 */
export function LazySection({
  children,
  id,
  className,
  placeholderHeight = '400px',
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px 0px', threshold: 0 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      className={className}
      style={{ minHeight: isVisible ? undefined : placeholderHeight }}
    >
      {isVisible && children}
    </section>
  );
}

/**
 * Dynamic import wrapper for code splitting
 * Use with React.lazy() for route-based code splitting
 * 
 * Example:
 * const HeavyComponent = lazy(() => import('./HeavyComponent'));
 * <LazyLoad component={HeavyComponent} />
 */
interface LazyLoadProps<T extends object> {
  component: ComponentType<T>;
  props?: T;
  fallback?: ReactNode;
}

export function LazyLoad<T extends object>({
  component: Component,
  props,
  fallback,
}: LazyLoadProps<T>) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px 0px', threshold: 0.01 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? (
        <Component {...(props as T)} />
      ) : (
        fallback || (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )
      )}
    </div>
  );
}

export default LazyComponent;
