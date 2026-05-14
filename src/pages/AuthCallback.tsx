import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createAuditLog } from '@/lib/audit';
import {
  setGmbProviderToken,
  getOriginalSession,
  clearOriginalSession,
  clearGmbProviderToken
} from '@/lib/gmbAuth';
import { useAuth } from '@/hooks/useAuth';

/**
 * AuthCallback
 * 
 * Handles post-OAuth redirects for:
 * 1) Normal Google login (redirect to dashboard based on role)
 * 2) "List Your Practice" flow (bootstrap dentist role + clinic, then onboarding)
 * 3) GMB sync flow (existing dentist linking GMB to their clinic)
 * 
 * CRITICAL: When a logged-in user uses a DIFFERENT Google account to sync GMB,
 * we capture the GMB token from that account, then RESTORE the original user's session.
 * This prevents creating a new user account for the GMB-linked Google account.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshRoles } = useAuth();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Set noindex for auth callback pages
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');

    return () => {
      meta?.setAttribute('content', 'index, follow');
    };
  }, []);

  useEffect(() => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const waitForSession = async (timeoutMs = 8000) => {
      const intervalMs = 200;
      const started = Date.now();

      while (Date.now() - started < timeoutMs) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return session;
        await sleep(intervalMs);
      }

      return null;
    };

    const invokeWithToken = async <T,>(
      fnName: string,
      accessToken: string,
      body: unknown
    ): Promise<{ data: T | null; error: Error | null }> => {
      try {
        const { data, error } = await supabase.functions.invoke(fnName, {
          body,
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return { data: (data as T) ?? null, error: (error as Error) ?? null };
      } catch (err) {
        return { data: null, error: err as Error };
      }
    };

    // GMB Sync: complete linking existing clinic to Google
    const handleGmbTransfer = async (accessToken: string) => {
      const linkToken = localStorage.getItem('gmb_link_token');

      if (!linkToken) {
        console.warn('No GMB link token found - skipping GMB transfer');
        localStorage.removeItem('gmb_pending');
        return false;
      }

      try {
        setMessage('Connecting Google Business Profile...');
        const { data, error } = await invokeWithToken<{ success?: boolean; error?: string }>(
          'gmb-link-complete',
          accessToken,
          { linkToken }
        );

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to complete GMB link');

        // Clear tokens after success
        localStorage.removeItem('gmb_link_token');
        localStorage.removeItem('gmb_pending');

        return true;
      } catch (err) {
        console.error('Failed to complete GMB link:', err);
        return false;
      }
    };

    // Listing flow: redirect to business selection instead of auto-creating blank clinic
    const handleListingFlow = async (accessToken: string) => {
      try {
        setMessage('Preparing business discovery...');

        // Just verify the user is authenticated, don't create anything yet
        // The actual business discovery will happen on the GMBBusinessSelection page
        return true;
      } catch (err) {
        console.error('Listing flow prep failed:', err);
        return false;
      }
    };

    const readRoles = async (userId: string) => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) console.warn('Failed to read user roles:', error);
      return data?.map((r) => r.role) ?? [];
    };

    const readOnboardingStatus = async (userId: string) => {
      const { data } = await supabase
        .from('user_onboarding')
        .select('onboarding_status')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.onboarding_status ?? null;
    };

    const handleCallback = async () => {
      try {
        // OAuth error from provider
        const oauthError = searchParams.get('error');
        const oauthErrorDescription = searchParams.get('error_description');
        if (oauthError) {
          setStatus('error');
          setMessage('Authentication failed');
          setErrorDetails(oauthErrorDescription || oauthError);
          return;
        }

        // Distinguish callback types from URL params AND localStorage
        const isGmbCallback =
          searchParams.get('gmb') === 'true' || localStorage.getItem('gmb_pending') === 'true';
        const isListingFlow =
          searchParams.get('listing') === 'true' || localStorage.getItem('gmb_listing_flow') === 'true';
        const isRelinkFlow =
          searchParams.get('relink') === 'true' || localStorage.getItem('gmb_relink_flow') === 'true';

        // Check if we need to restore the original user's session after getting GMB token
        const shouldRestoreSession = localStorage.getItem('gmb_restore_session') === 'true';
        const originalSession = getOriginalSession();

        // IMPORTANT: Google provider_token is often ONLY available on the immediate OAuth exchange response
        // and is NOT reliably persisted in the stored session (PKCE flow). We must capture it here.
        let providerTokenFromExchange: string | null = null;

        // PKCE code flow
        const code = searchParams.get('code');
        if (code) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeData?.session?.provider_token) {
            providerTokenFromExchange = exchangeData.session.provider_token;
          }

          if (exchangeError) {
            const msg = exchangeError.message?.toLowerCase?.() ?? '';
            const pkceMissing =
              msg.includes('code verifier') ||
              msg.includes('code_verifier') ||
              msg.includes('both auth code and code verifier');

            if (pkceMissing) {
              throw new Error(
                'Sign-in could not be completed (missing verifier). This usually happens if sign-in started on a different domain, or the browser blocked/cleared storage during the redirect. Please retry from the same site and allow cookies/storage.'
              );
            }

            throw exchangeError;
          }
        } else {
          // Implicit flow fallback (hash tokens)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          if (accessToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get('refresh_token') || '',
            });
            if (sessionError) throw sessionError;

            if (sessionData?.session?.provider_token) {
              providerTokenFromExchange = sessionData.session.provider_token;
            }
          }
        }

        // Get the GMB OAuth session (might be a different Google account)
        let gmbOAuthSession = await waitForSession();
        if (!gmbOAuthSession) {
          throw new Error(
            'No session was created. This may happen if sign-in started on a different domain. Please try again.'
          );
        }

        // Capture the GMB provider token
        const providerToken = providerTokenFromExchange ?? gmbOAuthSession.provider_token ?? null;
        console.log('Provider token available:', !!providerToken);

        if (providerToken) {
          setGmbProviderToken(providerToken);

          // Store the token server-side for persistence
          if (isGmbCallback || isListingFlow || isRelinkFlow) {
            try {
              const { error: storeError } = await supabase.functions.invoke('gmb-store-token', {
                headers: { Authorization: `Bearer ${gmbOAuthSession.access_token}` },
                body: {
                  providerToken,
                  scopes: 'openid email profile https://www.googleapis.com/auth/business.manage'
                },
              });
              if (storeError) {
                console.warn('Failed to store GMB token server-side:', storeError);
              } else {
                console.log('GMB token stored server-side successfully');
              }
            } catch (e) {
              console.warn('Error storing GMB token:', e);
            }
          }
        }

        // CRITICAL: If this is a GMB relink flow and we have the original session stored,
        // restore the original user's session instead of keeping the GMB Google account logged in
        let session = gmbOAuthSession;
        let restoredOriginalUser = false;

        if (shouldRestoreSession && originalSession && (isRelinkFlow || isGmbCallback)) {
          setMessage('Restoring your session...');
          console.log('Restoring original user session after GMB OAuth');

          try {
            // Don't sign out first - just try to refresh the original session directly
            // This is more reliable than sign out + set session
            const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: originalSession.refreshToken,
            });

            if (refreshError || !refreshedSession?.session) {
              console.warn('Failed to refresh original session, trying setSession...', refreshError);

              // Try setSession as fallback (might work if token is still valid)
              const { data: restoredSession, error: restoreError } = await supabase.auth.setSession({
                access_token: originalSession.accessToken,
                refresh_token: originalSession.refreshToken,
              });

              if (restoreError || !restoredSession?.session) {
                console.error('Failed to restore original session:', restoreError);
                // Don't throw - keep the GMB session but mark that we couldn't restore
                // This way the user stays logged in (as the GMB Google account) and can still proceed
                console.warn('Keeping GMB OAuth session as fallback - user may need to re-login as original account');
                restoredOriginalUser = false;
              } else {
                session = restoredSession.session;
                restoredOriginalUser = true;
              }
            } else {
              session = refreshedSession.session;
              restoredOriginalUser = true;
              console.log('Original user session restored successfully via refresh');
            }
          } catch (restoreErr) {
            console.error('Failed to restore original session:', restoreErr);
            // Don't throw - keep the current session and continue
            // User can still complete the GMB flow, they just might be logged in as a different account
            console.warn('Continuing with current session after restore failure');
          }

          // Clean up stored session regardless of outcome
          clearOriginalSession();
          localStorage.removeItem('gmb_restore_session');
        }

        // Audit log for successful authentication
        await createAuditLog({
          action: restoredOriginalUser ? 'GMB_LINK' : 'AUTH_LOGIN',
          entityType: 'user',
          entityId: session.user.id,
          metadata: {
            provider: session.user.app_metadata?.provider || 'unknown',
            isGmbCallback,
            isListingFlow,
            restoredOriginalUser,
          },
        }).catch(() => { });

        // Read current roles
        let roles = await readRoles(session.user.id);
        const provider = session.user.app_metadata?.provider || 'unknown';
        const isGoogleProvider = provider === 'google';

        // GMB sync flow (existing dentist linking GMB to their clinic)
        let gmbSuccess = false;
        let shouldSelectGmbBusiness = false;

        if (isGmbCallback && !restoredOriginalUser) {
          gmbSuccess = await handleGmbTransfer(session.access_token);
          if (!gmbSuccess) {
            // If link transfer failed (e.g., expired token), redirect to GMB selection instead
            console.log('GMB transfer failed, redirecting to business selection');
            shouldSelectGmbBusiness = true;
          }
          roles = await readRoles(session.user.id); // refresh after possible role assignment
        }

        // Listing/relink flows → redirect to business selection
        // IMPORTANT: For relink flow with restored session, we still want to go to GMB selection
        const shouldSelectBusiness = isListingFlow || isRelinkFlow;

        if (shouldSelectBusiness && !restoredOriginalUser) {
          // For listing flow (new user), redirect to GMB business selection page
          const listingFlowSuccess = await handleListingFlow(session.access_token);
          if (!listingFlowSuccess) {
            throw new Error('Failed to prepare business discovery. Please try again.');
          }
        }

        // Clear flow flags (but keep gmb_listing_flow if redirecting to selection)
        if (!shouldSelectBusiness && !shouldSelectGmbBusiness && !restoredOriginalUser) {
          localStorage.removeItem('gmb_listing_flow');
          localStorage.removeItem('gmb_relink_flow');
        }
        localStorage.removeItem('gmb_pending');
        localStorage.removeItem('gmb_link_token');

        // Refresh roles in app state
        await refreshRoles();

        setStatus('success');
        setMessage(isGmbCallback || restoredOriginalUser ? 'Google Business Profile connected!' : 'Signed in successfully!');

        // Check onboarding status
        const onboardingStatus = await readOnboardingStatus(session.user.id);
        const isSuperAdmin = roles.includes('super_admin') || roles.includes('district_manager');
        const isAdmin = isSuperAdmin || roles.some(r => ['seo_team', 'content_team', 'marketing_team', 'support_team'].includes(r));
        const isDentist = roles.includes('dentist');

        // Route decision

        // If this is a GMB relink or listing flow, always go to GMB selection
        // regardless of whether we restored the original user or not
        if (isRelinkFlow || isListingFlow || shouldSelectGmbBusiness) {
          // Keep the relink flow flag so GMB selection knows to update existing clinic
          if (isRelinkFlow || shouldSelectGmbBusiness) {
            localStorage.setItem('gmb_relink_flow', 'true');
          }
          console.log('Redirecting to GMB selection page', { isRelinkFlow, isListingFlow, restoredOriginalUser });
          navigate('/gmb-select', { replace: true });
          return;
        }

        if (isGmbCallback && gmbSuccess) {
          // Existing dentist successfully completed GMB link → go to dashboard
          navigate('/dashboard?tab=settings&gmb_connected=true', { replace: true });
          return;
        }

        // SuperAdmins and Admins go directly to /admin - no delays or onboarding
        if (isSuperAdmin || isAdmin) {
          navigate('/admin', { replace: true });
        } else if (isDentist) {
          // Dentists go directly to dashboard (no onboarding redirect)
          navigate('/dashboard?tab=my-dashboard', { replace: true });
        } else {
          // No role yet - bootstrap dentist role if Google provider login
          if (isGoogleProvider) {
            setMessage('Setting up your account...');
            try {
              const { data: bootstrapData, error: bootstrapError } = await supabase.functions.invoke('dentist-onboarding-bootstrap', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });

              if (bootstrapError) {
                console.error('Bootstrap error:', bootstrapError);
              } else {
                console.log('Bootstrap complete:', bootstrapData);
              }

              // Wait a moment for role to propagate
              await sleep(500);

              // Refresh roles after bootstrap
              await refreshRoles();

              // Re-read roles to confirm
              const newRoles = await readRoles(session.user.id);
              console.log('New roles after bootstrap:', newRoles);

              // Check if user needs to add a clinic
              if (bootstrapData?.needsClinic) {
                // New user without clinic - redirect to GMB business selection
                // so they can add their practice via GMB or manually
                localStorage.setItem('gmb_listing_flow', 'true');
                navigate('/gmb-select', { replace: true });
              } else {
                // User already has a clinic - go to dashboard
                navigate('/dashboard?tab=my-dashboard', { replace: true });
              }
            } catch (err) {
              console.error('Failed to bootstrap dentist:', err);
              // Still try to navigate to GMB selection for new users
              localStorage.setItem('gmb_listing_flow', 'true');
              navigate('/gmb-select', { replace: true });
            }
          } else {
            // Non-Google signup without role - go to onboarding
            navigate('/onboarding?new=true', { replace: true });
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
        setMessage('Authentication failed');
        setErrorDetails(err instanceof Error ? err.message : 'Unknown error occurred');

        // Clean up any pending state
        localStorage.removeItem('gmb_link_token');
        localStorage.removeItem('gmb_pending');
        localStorage.removeItem('gmb_listing_flow');
        localStorage.removeItem('gmb_relink_flow');
        localStorage.removeItem('gmb_restore_session');
        clearOriginalSession();
        clearGmbProviderToken();
      }
    };

    void handleCallback();
  }, [searchParams, navigate, refreshRoles]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent">
            Appoint Panda
          </CardTitle>
          <CardDescription>
            {status === 'processing' && 'Completing authentication...'}
            {status === 'success' && 'Authentication successful'}
            {status === 'error' && 'Authentication failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'processing' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="h-16 w-16 rounded-full bg-teal/10 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-teal" />
              </div>
              <p className="text-foreground font-medium">{message}</p>
              <p className="text-sm text-muted-foreground">Redirecting...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="h-16 w-16 rounded-full bg-coral/10 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-coral" />
              </div>
              <p className="text-foreground font-medium">{message}</p>
              {errorDetails && <p className="text-sm text-muted-foreground text-center">{errorDetails}</p>}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => navigate('/auth')}>
                  Try Again
                </Button>
                <Button onClick={() => navigate('/')}>Go Home</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
