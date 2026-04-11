import { lazy, ComponentType } from 'react';

/**
 * Wraps React.lazy with automatic retry + page reload on chunk load failure.
 * This handles stale deployments where the browser has cached old HTML
 * referencing chunk hashes that no longer exist on the server.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 1
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error) => {
      if (retries > 0) {
        // Retry once in case of transient network error
        return new Promise<{ default: T }>((resolve) => {
          setTimeout(() => resolve(factory()), 1000);
        });
      }

      // If chunk failed after retries, force reload to get fresh HTML
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
      } else {
        sessionStorage.removeItem('chunk_reload');
      }

      throw error;
    })
  );
}
