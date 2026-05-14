import { useCallback, useEffect, useRef, useState } from 'react';

export type CaptchaProvider = 'turnstile' | 'recaptcha' | 'none';

interface CaptchaConfig {
  provider: CaptchaProvider;
  siteKey: string;
}

interface UseCaptchaReturn {
  executeCaptcha: () => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
  resetCaptcha: () => void;
  provider: CaptchaProvider;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    grecaptcha?: {
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: (error: unknown) => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  tabindex?: number;
}

const CAPTCHA_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const RECAPTCHA_SCRIPT_URL = 'https://www.google.com/recaptcha/api.js';

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function getCaptchaConfig(): CaptchaConfig {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (turnstileSiteKey) {
    return { provider: 'turnstile', siteKey: turnstileSiteKey };
  }

  if (recaptchaSiteKey) {
    return { provider: 'recaptcha', siteKey: recaptchaSiteKey };
  }

  return { provider: 'none', siteKey: '' };
}

export function useCaptcha(): UseCaptchaReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config] = useState(() => getCaptchaConfig());
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (config.provider === 'none') return;

    const scriptUrl = config.provider === 'turnstile' ? CAPTCHA_SCRIPT_URL : RECAPTHA_SCRIPT_URL;
    const scriptId = config.provider === 'turnstile' ? 'turnstile-script' : 'recaptcha-script';

    loadScript(scriptUrl, scriptId).catch((err) => {
      console.warn('CAPTCHA script load warning:', err.message);
    });

    return () => {
      if (widgetIdRef.current && config.provider === 'turnstile') {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [config.provider]);

  const executeTurnstile = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!window.turnstile) {
        const checkInterval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(checkInterval);
            executeTurnstile().then(resolve);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(null);
        }, 5000);
        return;
      }

      const container = document.createElement('div');
      container.id = `turnstile-container-${Date.now()}`;
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;z-index:-1;';
      document.body.appendChild(container);

      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: config.siteKey,
        callback: (token: string) => {
          window.turnstile?.remove(widgetIdRef.current!);
          document.body.removeChild(container);
          widgetIdRef.current = null;
          resolve(token);
        },
        'error-callback': () => {
          window.turnstile?.remove(widgetIdRef.current!);
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
          widgetIdRef.current = null;
          resolve(null);
        },
        'expired-callback': () => {
          window.turnstile?.reset(widgetIdRef.current!);
        },
        theme: 'auto',
      });
    });
  }, [config.siteKey]);

  const executeRecaptcha = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const checkAndExecute = () => {
        if (window.grecaptcha && window.grecaptcha.execute) {
          window.grecaptcha
            .execute(config.siteKey, { action: 'booking' })
            .then(resolve)
            .catch(() => resolve(null));
        } else {
          const checkInterval = setInterval(() => {
            if (window.grecaptcha?.execute) {
              clearInterval(checkInterval);
              window.grecaptcha
                .execute(config.siteKey, { action: 'booking' })
                .then(resolve)
                .catch(() => resolve(null));
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
          }, 10000);
        }
      };

      if (!document.querySelector(`script[src="${RECAPTCHA_SCRIPT_URL}?render=${config.siteKey}"]`)) {
        const script = document.createElement('script');
        script.src = `${RECAPTHA_SCRIPT_URL}?render=${config.siteKey}`;
        script.async = true;
        script.onload = checkAndExecute;
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      } else {
        checkAndExecute();
      }
    });
  }, [config.siteKey]);

  const executeCaptcha = useCallback(async (): Promise<string | null> => {
    if (config.provider === 'none') {
      return 'captcha-disabled';
    }

    setIsLoading(true);
    setError(null);

    try {
      let token: string | null = null;

      if (config.provider === 'turnstile') {
        token = await executeTurnstile();
      } else if (config.provider === 'recaptcha') {
        token = await executeRecaptcha();
      }

      if (!token) {
        setError('CAPTCHA verification failed. Please try again.');
        return null;
      }

      return token;
    } catch (err) {
      setError('CAPTCHA error. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [config, executeTurnstile, executeRecaptcha]);

  const resetCaptcha = useCallback(() => {
    if (config.provider === 'turnstile' && widgetIdRef.current) {
      window.turnstile?.reset(widgetIdRef.current);
    }
    setError(null);
  }, [config.provider]);

  return {
    executeCaptcha,
    isLoading,
    error,
    resetCaptcha,
    provider: config.provider,
  };
}

export async function verifyCaptchaToken(token: string): Promise<boolean> {
  if (token === 'captcha-disabled') {
    return true;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.warn('CAPTCHA secret key not configured, skipping server-side verification');
    return true;
  }

  try {
    const verifyUrl = secretKey
      ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
      : 'https://www.google.com/recaptcha/api/siteverify';

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const result = await response.json();
    return result.success === true;
  } catch {
    console.error('CAPTCHA verification error');
    return false;
  }
}

export default useCaptcha;