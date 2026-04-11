import { useEffect } from 'react';

/**
 * useServiceWorker - Register service worker for caching and offline support
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        
        console.log('Service Worker registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('New version available! Refresh to update.');
              }
            });
          }
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    // Wait for page load to register SW
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }

    return () => {
      window.removeEventListener('load', registerSW);
    };
  }, []);
}

/**
 * usePageVisibility - Track page visibility changes
 * Useful for pausing expensive operations when tab is hidden
 */
export function usePageVisibility(callback?: (isVisible: boolean) => void) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      callback?.(isVisible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callback]);
}

/**
 * useNetworkStatus - Monitor network connection status
 */
export function useNetworkStatus(callback?: (isOnline: boolean) => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => callback?.(true);
    const handleOffline = () => callback?.(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [callback]);
}

export default useServiceWorker;
