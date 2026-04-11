import { useEffect } from 'react';
import { useSiteSettings } from './useSiteSettings';

/**
 * Hook to dynamically update the favicon based on branding settings
 * 
 * IMPORTANT FOR SEO/GOOGLE INDEXING:
 * The favicon.png in /public must be the correct AppointPanda icon.
 * This hook provides runtime updates but Google indexes the static HTML.
 * 
 * The branding settings in the database should point to:
 * https://www.appointpanda.com/favicon.png (our domain, NOT external URLs)
 */
export function useDynamicFavicon() {
  const { data: settings } = useSiteSettings();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Get favicon from branding settings, fallback to default domain path
    const faviconUrl = settings?.branding?.favicon_url || '/favicon.png?v=5';
    
    // Determine content type based on URL
    const getContentType = (url: string) => {
      if (url.includes('.svg')) return 'image/svg+xml';
      if (url.includes('.png')) return 'image/png';
      if (url.includes('.ico')) return 'image/x-icon';
      return 'image/png'; // Default to PNG
    };
    
    const contentType = getContentType(faviconUrl);
    
    // Update all favicon link elements in the document
    const updateAllFavicons = () => {
      // Primary favicon links
      const primaryIcons = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']") as NodeListOf<HTMLLinkElement>;
      primaryIcons.forEach(link => {
        link.href = faviconUrl;
        link.type = contentType;
      });
      
      // Apple touch icon
      const appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (appleIcon) {
        appleIcon.href = faviconUrl;
      }
      
      // MS application tile
      const msTile = document.querySelector("meta[name='msapplication-TileImage']") as HTMLMetaElement;
      if (msTile) {
        msTile.content = faviconUrl;
      }
    };
    
    updateAllFavicons();
    
    // Log for debugging (remove in production if noisy)
    console.debug('[Favicon] Updated to:', faviconUrl);
  }, [settings?.branding?.favicon_url]);
}
