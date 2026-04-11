import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * TrailingSlashRedirect - Enforces URL consistency
 * 
 * SEO CRITICAL: Ensures all URLs use the same format (WITH trailing slash)
 * This prevents duplicate content issues where /page and /page/ are indexed separately.
 *
 * Note: Next.js handles this via trailingSlash config, but keeping for compatibility.
 */
export function TrailingSlashRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const pathname = router.pathname;
    const asPath = router.asPath;
    const [path, queryAndHash] = asPath.split('?');
    const search = queryAndHash ? '?' + queryAndHash.split('#')[0] : '';
    const hash = asPath.includes('#') ? '#' + asPath.split('#')[1] : '';
    
    // Skip if it's the root path or already has a trailing slash
    if (pathname === '/' || path.endsWith('/')) {
      return;
    }
    
    // Skip file-like paths (with extensions)
    if (path.includes('.')) {
      return;
    }
    
    // Add trailing slash
    const pathWithSlash = path + "/";

    // Hard redirect to canonical URL (no history entry)
    window.location.replace(pathWithSlash + search + hash);
  }, [router.pathname, router.asPath]);

  return null;
}
