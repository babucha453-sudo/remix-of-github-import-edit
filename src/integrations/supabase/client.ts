import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Isomorphic Supabase client.
 *
 * - **Browser**: uses `localStorage` and persists session like before.
 * - **Server (Next SSR)**: does NOT touch browser APIs; keeps auth in-memory.
 *
 * Import like:
 * `import { supabase } from "@/integrations/supabase/client"`
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isBrowser = typeof window !== "undefined";

// Create a dummy client for SSR/build when env vars are missing
function createDummyClient(): ReturnType<typeof createClient<Database>> {
  const noop = () => Promise.resolve({ data: null, error: null });
  const emptyArray = () => Promise.resolve({ data: [], error: null });

  const chainable = {
    eq: () => chainable,
    neq: () => chainable,
    gt: () => chainable,
    gte: () => chainable,
    lt: () => chainable,
    lte: () => chainable,
    like: () => chainable,
    ilike: () => chainable,
    is: () => chainable,
    in: () => chainable,
    contains: () => chainable,
    containedBy: () => chainable,
    rangeLt: () => chainable,
    rangeGt: () => chainable,
    rangeGte: () => chainable,
    rangeLte: () => chainable,
    rangeAdjacent: () => chainable,
    overlaps: () => chainable,
    textSearch: () => chainable,
    match: () => chainable,
    not: () => chainable,
    or: () => chainable,
    and: () => chainable,
    filter: () => chainable,
    order: () => chainable,
    limit: () => chainable,
    range: () => chainable,
    single: noop,
    maybeSingle: noop,
    csv: emptyArray,
    then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
  };

  const fromChainable = {
    ...chainable,
    select: () => fromChainable,
    insert: () => fromChainable,
    upsert: () => fromChainable,
    update: () => fromChainable,
    delete: () => fromChainable,
  };

  return {
    from: () => fromChainable,
    rpc: () => chainable,
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: () => Promise.resolve({ data: { url: '' }, error: null }),
      signInWithPassword: noop,
      signUp: noop,
      signOut: () => Promise.resolve({ error: null }),
      resetPasswordForEmail: noop,
      updateUser: noop,
      setSession: noop,
      refreshSession: noop,
      getSessionFromUrl: noop,
    },
    storage: {
      from: () => ({
        upload: noop,
        download: noop,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: noop,
        list: emptyArray,
      }),
    },
    realtime: { channel: () => ({ on: () => ({ subscribe: () => {} }) }) } as any,
  } as any;
}

// Create the actual client or a dummy for SSR
export const supabase =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? createDummyClient()
    : createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // On the server, `storage` must be undefined (no localStorage).
          storage: (isBrowser ? window.localStorage : undefined) as any,
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser,
        },
      });