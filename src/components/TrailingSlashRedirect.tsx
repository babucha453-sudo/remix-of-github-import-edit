import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * TrailingSlashRedirect - SEO compatibility component
 *
 * NOTE: We now rely on Next.js trailingSlash: false config in next.config.mjs
 * which handles redirects server-side. This component is kept as a fallback
 * for edge cases only. It is placed AFTER server-side redirects complete.
 *
 * This component ONLY handles the rare case where the server doesn't redirect
 * (e.g., direct links without trailing slash from external sources).
 * For Googlebot, Next.js handles trailing slash normalization on the server.
 */
export function TrailingSlashRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const asPath = router.asPath;
    const [path, queryAndHash] = asPath.split('?');

    // Only redirect if path has no trailing slash and is not a file-like path
    // and is not the root. Server-side Next.js should already handle most cases.
    if (path.endsWith('/') || path === '' || path.includes('.')) {
      return;
    }

    const search = queryAndHash ? '?' + queryAndHash.split('#')[0] : '';
    const hash = asPath.includes('#') ? '#' + asPath.split('#')[1] : '';

    // Use replace to avoid history entries (same as server-side redirect behavior)
    window.location.replace(path + '/' + search + hash);
  }, [router.asPath]);

  return null;
}
