import { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from './use-mobile';

const COOKIE_NAME = 'exit-intent-dismissed';
const COOKIE_EXPIRY_DAYS = 7;

function getCookie(name: string): boolean {
  if (typeof document === 'undefined') return false;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() === 'true';
  return false;
}

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

export interface UseExitIntentOptions {
  enabled?: boolean;
  desktopDelay?: number;
  mobileDelay?: number;
  exitThreshold?: number;
}

export function useExitIntent(options: UseExitIntentOptions = {}) {
  const {
    enabled = true,
    desktopDelay = 30000,
    mobileDelay = 15000,
    exitThreshold = 10,
  } = options;

  const isMobile = useIsMobile();
  const [shouldShow, setShouldShow] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  const delay = isMobile ? mobileDelay : desktopDelay;

  const dismiss = useCallback(() => {
    setCookie(COOKIE_NAME, 'true', COOKIE_EXPIRY_DAYS);
    setShouldShow(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (getCookie(COOKIE_NAME)) return;
    if (hasTriggered) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= exitThreshold) {
        setShouldShow(true);
        setHasTriggered(true);
      }
    };

    const timer = setTimeout(() => {
      if (!hasTriggered) {
        setShouldShow(true);
        setHasTriggered(true);
      }
    }, delay);

    if (!isMobile) {
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      clearTimeout(timer);
      if (!isMobile) {
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [enabled, delay, exitThreshold, isMobile, hasTriggered]);

  return { shouldShow, dismiss };
}