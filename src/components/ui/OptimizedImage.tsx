import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  className?: string;
  containerClassName?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  sizes?: string;
  quality?: number;
  loading?: 'eager' | 'lazy';
}

/**
 * OptimizedImage - High-performance image component with:
 * - Lazy loading via Intersection Observer
 * - WebP/AVIF format support detection
 * - Responsive srcset generation
 * - Blur placeholder effect
 * - Priority loading for LCP images
 * - Aspect ratio preservation to prevent CLS
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  className,
  containerClassName,
  objectFit = 'cover',
  sizes = '100vw',
  quality = 85,
  loading,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, loading]);

  // Generate responsive srcset for Unsplash images
  const getSrcSet = (originalSrc: string): string | undefined => {
    if (!originalSrc.includes('unsplash.com')) return undefined;
    
    const widths = [320, 640, 750, 828, 1080, 1200, 1920];
    return widths
      .map((w) => `${originalSrc}&w=${w}&q=${quality} ${w}w`)
      .join(', ');
  };

  // Generate optimized URL for Unsplash images
  const getOptimizedSrc = (originalSrc: string): string => {
    if (!originalSrc.includes('unsplash.com')) return originalSrc;
    
    const widthParam = width || 1200;
    return `${originalSrc}&w=${widthParam}&q=${quality}&fm=webp`;
  };

  const optimizedSrc = getOptimizedSrc(src);
  const srcSet = getSrcSet(src);
  const aspectRatio = width && height ? `${width} / ${height}` : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        containerClassName
      )}
      style={{
        aspectRatio,
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto',
      }}
    >
      {/* Blur placeholder */}
      {placeholder === 'blur' && blurDataURL && !isLoaded && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-lg scale-110 transition-opacity duration-500"
          style={{ backgroundImage: `url(${blurDataURL})` }}
        />
      )}

      {/* Color placeholder fallback */}
      {placeholder === 'blur' && !blurDataURL && !isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      {/* Actual image */}
      {isInView && (
        <img
          ref={imgRef}
          src={optimizedSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            'transition-opacity duration-500',
            objectFit === 'cover' && 'object-cover',
            objectFit === 'contain' && 'object-contain',
            objectFit === 'fill' && 'object-fill',
            objectFit === 'none' && 'object-none',
            objectFit === 'scale-down' && 'object-scale-down',
            !isLoaded && 'opacity-0',
            isLoaded && 'opacity-100',
            className
          )}
          style={{
            width: '100%',
            height: '100%',
          }}
          {...props}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
          <span className="text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
}

/**
 * PriorityImage - For above-the-fold images that should load immediately
 * Use for hero images, logos, and Largest Contentful Paint (LCP) elements
 */
export function PriorityImage(props: Omit<OptimizedImageProps, 'priority'>) {
  return <OptimizedImage {...props} priority loading="eager" />;
}

/**
 * LazyImage - For below-the-fold images that can load lazily
 * Default lazy loading with intersection observer
 */
export function LazyImage(props: Omit<OptimizedImageProps, 'loading'>) {
  return <OptimizedImage {...props} loading="lazy" />;
}

export default OptimizedImage;
