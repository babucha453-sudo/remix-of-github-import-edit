/**
 * Image optimization utilities
 * Automatically optimize image URLs for better performance
 */

/**
 * Optimize Unsplash image URL with proper sizing and format
 */
export function optimizeImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg';
  } = {}
): string {
  if (!url) return url;
  
  // If it's not an Unsplash URL, return as-is
  if (!url.includes('images.unsplash.com')) return url;
  
  const { width = 800, quality = 80, format = 'webp' } = options;
  
  // Parse existing params
  const hasParams = url.includes('?');
  const baseUrl = hasParams ? url.split('?')[0] : url;
  
  // Build optimized URL
  const params = new URLSearchParams();
  params.set('w', width.toString());
  params.set('q', quality.toString());
  params.set('fm', format);
  
  // Add fit param for better cropping
  params.set('fit', 'crop');
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Get responsive image srcset for Unsplash images
 */
export function getResponsiveSrcSet(
  url: string,
  widths: number[] = [400, 800, 1200],
  quality: number = 80
): string {
  if (!url || !url.includes('images.unsplash.com')) return '';
  
  return widths
    .map((w) => `${optimizeImageUrl(url, { width: w, quality })} ${w}w`)
    .join(', ');
}

/**
 * Get srcSet sizes attribute based on layout
 */
export function getSizes(layout: 'fixed' | 'responsive' | 'fill' = 'responsive'): string {
  const sizes = {
    fixed: '',
    responsive: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    fill: '100vw',
  };
  return sizes[layout];
}

/**
 * Check if image should be prioritized (above the fold)
 */
export function shouldPrioritize(src: string): boolean {
  // Hero images and logos should load immediately
  const priorityPatterns = [
    /hero/i,
    /logo/i,
    /banner/i,
    /cover/i,
  ];
  
  return priorityPatterns.some((pattern) => pattern.test(src));
}

/**
 * Generate blur placeholder URL (low quality, small size)
 */
export function getBlurPlaceholder(url: string): string {
  if (!url || !url.includes('images.unsplash.com')) return '';
  return optimizeImageUrl(url, { width: 20, quality: 10, format: 'webp' });
}

export default {
  optimizeImageUrl,
  getResponsiveSrcSet,
  getSizes,
  shouldPrioritize,
  getBlurPlaceholder,
};
