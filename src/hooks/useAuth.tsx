import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/types/database';
import { setGmbProviderToken } from '@/lib/gmbAuth';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDentist: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track if initial session check is done to avoid flashing
  const initialCheckDone = useRef(false);
  // Track active user ID to prevent duplicate fetches
  const currentUserId = useRef<string | null>(null);

  const fetchUserData = async (userId: string, forceRefresh = false, retryCount = 0) => {
    // Skip if we're already fetching for this user (unless forcing refresh)
    if (!forceRefresh && currentUserId.current === userId) return;
    currentUserId.current = userId;
    
    const maxRetries = 3;
    const baseDelay = 1000;
    
    try {
      // Fetch roles from user_roles table
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (rolesError) throw rolesError;
      
      if (rolesData) {
        setRoles(rolesData.map(r => r.role as AppRole));
      }
      
      // Create a basic profile from the user data
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setProfile({
          id: currentUser.id,
          user_id: currentUser.id,
          email: currentUser.email || null,
          full_name:
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            null,
          phone: currentUser.phone || null,
          avatar_url:
            currentUser.user_metadata?.avatar_url ||
            currentUser.user_metadata?.picture ||
            null,
          created_at: currentUser.created_at,
          updated_at: currentUser.updated_at || currentUser.created_at,
        });
      }
    } catch (error: any) {
      console.error('Error fetching user data:', error);
      
      // Retry with exponential backoff for network/timeout errors
      const isRetryable = error?.message?.includes('504') || 
                          error?.message?.includes('timeout') ||
                          error?.message?.includes('fetch') ||
                          error?.code === 'PGRST301';
      
      if (isRetryable && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Retrying fetchUserData in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserData(userId, true, retryCount + 1);
      }
    }
  };

  // Expose a function to force refresh roles (useful after GMB OAuth flow)
  const refreshRoles = async () => {
    if (user?.id) {
      await fetchUserData(user.id, true);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST (before checking session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Only update if session actually changed
        const newUserId = newSession?.user?.id ?? null;
        const currentSessionUserId = session?.user?.id ?? null;
        
        // Skip TOKEN_REFRESHED events that don't change the user
        if (event === 'TOKEN_REFRESHED' && newUserId === currentSessionUserId) {
          return;
        }
        
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Capture Google provider token for GMB flows (do not log the token)
        if (newSession?.provider_token) {
          setGmbProviderToken(newSession.provider_token);
        }

        if (newSession?.user && newUserId !== currentUserId.current) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(() => {
            void fetchUserData(newSession.user.id).finally(() => {
              setIsLoading(false);
              initialCheckDone.current = true;
            });
          }, 0);
        } else if (!newSession?.user) {
          setProfile(null);
          setRoles([]);
          currentUserId.current = null;
          setIsLoading(false);
          initialCheckDone.current = true;
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      // Only process if we haven't already set session from onAuthStateChange
      if (!initialCheckDone.current) {
        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        // Capture provider token if available (e.g., immediately after Google OAuth redirect)
        if (existingSession?.provider_token) {
          setGmbProviderToken(existingSession.provider_token);
        }

        if (existingSession?.user) {
          void fetchUserData(existingSession.user.id).finally(() => {
            setIsLoading(false);
            initialCheckDone.current = true;
          });
        } else {
          setIsLoading(false);
          initialCheckDone.current = true;
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const isAdmin = roles.includes('super_admin') || roles.includes('district_manager');
  const isSuperAdmin = roles.includes('super_admin');
  const isDentist = roles.includes('dentist');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isLoading,
        isAdmin,
        isSuperAdmin,
        isDentist,
        signIn,
        signUp,
        signOut,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
