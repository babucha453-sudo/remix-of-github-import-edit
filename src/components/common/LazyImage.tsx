import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

/**
 * LazyImage component that leverages Next.js internal Image optimization.
 */
export function LazyImage({
  src,
  alt,
  className,
  width = 400,
  height = 300,
  priority = false
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Optimize Unsplash images with quality and size parameters if needed, 
  // but Next.js Image component handles most of this.
  // However, for external loader support we might need to be careful.
  // If it's a relative path or fixed domain, next/image is great.

  const isUnsplash = src.includes('unsplash.com');
  const optimizedSrc = isUnsplash && src.includes('?')
    ? src.split('?')[0] + '?auto=format&fit=crop&q=75'
    : src;

  return (
    <div className={cn('relative overflow-hidden w-full h-full flex items-center justify-center', className)}>
      <Image
        src={optimizedSrc}
        alt={alt}
        fill
        priority={priority}
        onLoad={() => setIsLoaded(true)}
        className={cn(
          'transition-opacity duration-300 ease-in-out',
          isLoaded ? 'opacity-100' : 'opacity-0',
          '!object-cover !w-full !h-full'
        )}
        style={{ objectFit: 'cover' }}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}



