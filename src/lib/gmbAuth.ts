// Centralized helpers for Google Business (GMB) OAuth token persistence.
//
// Why this exists:
// - Some browsers clear sessionStorage after cross-site OAuth redirects.
// - Supabase provider_token is often only available right after the OAuth exchange.
// - We need a reliable (short-lived) place to keep the token until the business list is fetched.
//
// IMPORTANT: When a logged-in user syncs GMB with a DIFFERENT Google account,
// we need to capture the GMB token but NOT replace their auth session.
// We store their original session so we can restore it after getting the GMB token.

const SESSION_TOKEN_KEY = 'gmb_provider_token';
const LOCAL_META_KEY = 'gmb_provider_token_meta_v1';
const ORIGINAL_SESSION_KEY = 'gmb_original_session_v1';
const ORIGINAL_USER_KEY = 'gmb_original_user_id';

type StoredToken = {
  token: string;
  expiresAt: number; // epoch ms
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
};

export function setGmbProviderToken(token: string, ttlMinutes = 55) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  
  const meta: StoredToken = {
    token,
    expiresAt: Date.now() + ttlMinutes * 60_000,
  };

  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function getGmbProviderToken(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  
  // 1) Fast path: sessionStorage
  try {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (token) return token;
  } catch {
    // ignore
  }

  // 2) Fallback: localStorage meta (with TTL)
  try {
    const raw = localStorage.getItem(LOCAL_META_KEY);
    if (!raw) return null;

    const meta = JSON.parse(raw) as StoredToken;
    if (!meta?.token || !meta?.expiresAt) {
      localStorage.removeItem(LOCAL_META_KEY);
      return null;
    }

    if (Date.now() > meta.expiresAt) {
      localStorage.removeItem(LOCAL_META_KEY);
      return null;
    }

    // Best effort to re-hydrate sessionStorage for the rest of the flow
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, meta.token);
    } catch {
      // ignore
    }

    return meta.token;
  } catch {
    return null;
  }
}

export function clearGmbProviderToken() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem(LOCAL_META_KEY);
  } catch {
    // ignore
  }
}

/**
 * Store the original user's session before initiating GMB OAuth with a different account.
 * This allows us to restore their session after capturing the GMB token.
 */
export function storeOriginalSession(accessToken: string, refreshToken: string, userId: string) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  
  const session: StoredSession = {
    accessToken,
    refreshToken,
    userId,
    expiresAt: Date.now() + 10 * 60_000, // 10 minute TTL
  };

  try {
    localStorage.setItem(ORIGINAL_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(ORIGINAL_USER_KEY, userId);
  } catch {
    // ignore
  }
}

/**
 * Get the stored original session (if any and not expired)
 */
export function getOriginalSession(): StoredSession | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(ORIGINAL_SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as StoredSession;
    if (!session?.refreshToken || !session?.userId || !session?.expiresAt) {
      clearOriginalSession();
      return null;
    }

    if (Date.now() > session.expiresAt) {
      clearOriginalSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Get the original user ID (used to verify we're restoring the right user)
 */
export function getOriginalUserId(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  
  try {
    return localStorage.getItem(ORIGINAL_USER_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear the stored original session
 */
export function clearOriginalSession() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  
  try {
    localStorage.removeItem(ORIGINAL_SESSION_KEY);
    localStorage.removeItem(ORIGINAL_USER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Clear ALL GMB-related cache and tokens.
 * Use this when switching OAuth credentials or troubleshooting auth issues.
 */
export function clearAllGmbCache() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  // Clear provider tokens
  clearGmbProviderToken();

  // Clear original session
  clearOriginalSession();

  // Clear any flow markers
  try {
    localStorage.removeItem('gmb_relink_flow');
    localStorage.removeItem('gmb_restore_session');
    localStorage.removeItem('gmb_listing_flow');
    localStorage.removeItem('gmb_pending');
    localStorage.removeItem('gmb_link_token');
    sessionStorage.removeItem('gmb_provider_token');
  } catch {
    // ignore
  }

  console.log('[GMB] All GMB cache cleared');
}

// Cleanup stale GMB flow flags on app init (call once on app load)
const FLOW_FLAG_KEYS = ['gmb_listing_flow', 'gmb_relink_flow', 'gmb_pending', 'gmb_restore_session'];
const MAX_FLOW_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function cleanupStaleFlowFlags() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const now = Date.now();
  FLOW_FLAG_KEYS.forEach(key => {
    const ts = localStorage.getItem(`${key}_ts`);
    if (ts && now - parseInt(ts) > MAX_FLOW_AGE_MS) {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_ts`);
    }
  });
}

// Auto-cleanup on module load
cleanupStaleFlowFlags();
