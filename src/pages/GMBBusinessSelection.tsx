import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getGmbProviderToken, setGmbProviderToken, clearGmbProviderToken } from '@/lib/gmbAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface GMBBusiness {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  description: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: unknown[] | null;
}

interface LocationMatchResult {
  countryId: string | null;
  cityId: string | null;
  areaId: string | null;
  countryName: string | null;
  cityName: string | null;
  areaName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  requiresManualSelection: boolean;
}

export default function GMBBusinessSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshRoles } = useAuth();
  const providerTokenFromNavState = (location.state as any)?.providerToken as string | undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [businesses, setBusinesses] = useState<GMBBusiness[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<GMBBusiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const parseInvokeError = async (invokeError: any): Promise<{ message: string; code: string | null }> => {
    // Supabase Functions errors often include `context` which is a Response
    const context = invokeError?.context;

    if (context && typeof context === 'object' && typeof context.clone === 'function') {
      // Try JSON first
      try {
        const body = await context.clone().json();
        const message = body?.error || invokeError?.message || 'Failed to fetch Google Business Profiles';
        const code = body?.code || null;
        return { message, code };
      } catch {
        // ignore
      }

      // Fallback to text
      try {
        const text = await context.clone().text();
        return { message: text || invokeError?.message || 'Failed to fetch Google Business Profiles', code: null };
      } catch {
        // ignore
      }
    }

    return {
      message: invokeError?.message || 'Failed to fetch Google Business Profiles',
      code: null,
    };
  };

  // Set noindex for GMB selection pages
  useEffect(() => {
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
    // Wait a moment for auth to settle before checking user
    // This prevents redirect loops when session is being restored
    const timer = setTimeout(() => {
      if (!user) {
        console.log('[GMB] No user found, redirecting to auth');
        navigate('/auth', { replace: true });
        return;
      }

      fetchBusinesses();
    }, 500);

    return () => clearTimeout(timer);
  }, [user, navigate]);

  const fetchBusinesses = async () => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session. Please sign in again.');
      }

      // Get the provider token captured during the OAuth callback.
      // Priority:
      // 1) navigation state (survives when browser blocks storage)
      // 2) dual-storage token helper
      // 3) session.provider_token (often not persisted in PKCE)
      const storedToken = getGmbProviderToken();
      const providerToken = providerTokenFromNavState ?? storedToken ?? session.provider_token ?? null;

      // Debug (safe): helps diagnose why token isn't available without leaking it.
      console.log('[GMB] token sources', {
        nav: !!providerTokenFromNavState,
        stored: !!storedToken,
        session: !!session.provider_token,
      });

      // Persist for the rest of the discovery flow.
      if (!storedToken && providerToken) {
        setGmbProviderToken(providerToken);
      }

      if (!providerToken) {
        setErrorCode('NO_PROVIDER_TOKEN');
        throw new Error('Google Business access token not found. Please sign in with Google again.');
      }

      const { data, error: fetchError } = await supabase.functions.invoke('gmb-fetch-businesses', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { providerToken },
      });

      if (fetchError) {
        const parsed = await parseInvokeError(fetchError);
        setErrorCode(parsed.code);
        throw new Error(parsed.message);
      }

      if (!data?.success) {
        setErrorCode(data?.code || null);
        throw new Error(data?.error || 'Failed to fetch businesses');
      }

      setBusinesses(data.businesses || []);

      // If only one business, auto-select it
      if (data.businesses?.length === 1) {
        setSelectedBusiness(data.businesses[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch businesses:', err);
      setError(err.message || 'Failed to fetch Google Business Profiles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBusiness = async () => {
    if (!selectedBusiness) return;

    setIsCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Check if this is a re-link flow (existing dentist linking GMB to their clinic)
      const isRelinkFlow = localStorage.getItem('gmb_relink_flow') === 'true';

      if (isRelinkFlow) {
        // For re-link, just update the existing clinic with the new google_place_id
        const { data: existingClinic } = await supabase
          .from('clinics')
          .select('id')
          .eq('claimed_by', user?.id)
          .single();

        if (existingClinic) {
          const { error: updateError } = await supabase
            .from('clinics')
            .update({
              google_place_id: selectedBusiness.placeId,
              gmb_data: {
                name: selectedBusiness.name,
                address: selectedBusiness.address,
                phone: selectedBusiness.phone,
                website: selectedBusiness.website,
                category: selectedBusiness.category,
                fetched_at: new Date().toISOString(),
              },
              gmb_location_id: selectedBusiness.id,
              gmb_connected: true,
              gmb_last_sync_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingClinic.id);

          if (updateError) throw updateError;

          toast.success('Google Business Profile connected successfully!');
          localStorage.removeItem('gmb_relink_flow');
          clearGmbProviderToken();

          navigate('/dashboard?tab=settings&gmb_connected=true', { replace: true });
          return;
        }
      }

      // New listing flow - create clinic via edge function
      const { data, error: createError } = await supabase.functions.invoke('gmb-create-listing', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { business: selectedBusiness },
      });

      if (createError) throw createError;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create listing');
      }

      toast.success('Your practice has been successfully listed!');

      // Tokens are only needed for the discovery step; clear them after the clinic is created.
      clearGmbProviderToken();
      localStorage.removeItem('gmb_listing_flow');

      // Refresh roles in case dentist role was just assigned
      await refreshRoles();

      // Check if location requires manual selection
      const locationMatch: LocationMatchResult = data.locationMatch;

      if (locationMatch?.requiresManualSelection) {
        // Navigate to onboarding with location selection needed flag
        navigate(
          `/onboarding?gmb_connected=true&listing_created=true&location_pending=true&detected_city=${encodeURIComponent(locationMatch.cityName || '')}&detected_city_id=${locationMatch.cityId || ''}`,
          { replace: true }
        );
      } else {
        // Location auto-matched, go directly to onboarding
        navigate('/onboarding?gmb_connected=true&listing_created=true&location_verified=true', { replace: true });
      }
    } catch (err: any) {
      console.error('Failed to create listing:', err);
      toast.error(err.message || 'Failed to create listing');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkipGMB = async () => {
    // If user doesn't want to select a business, check if this is a relink flow
    const isRelinkFlow = localStorage.getItem('gmb_relink_flow') === 'true';

    // Clean up flow flags
    localStorage.removeItem('gmb_listing_flow');
    localStorage.removeItem('gmb_relink_flow');
    localStorage.removeItem('gmb_restore_session');
    clearGmbProviderToken();

    if (isRelinkFlow) {
      // For relink flow, go back to dashboard settings
      navigate('/dashboard?tab=settings', { replace: true });
    } else {
      // For new listing flow, go to manual onboarding
      navigate('/onboarding?new=true&skip_gmb=true', { replace: true });
    }
  };

  const handleRetryAuth = async () => {
    // Re-initiate Google OAuth
    // - listing flow: create a new clinic
    // - relink flow: update the existing clinic
    const isRelinkFlow = localStorage.getItem('gmb_relink_flow') === 'true';

    // For relink flow, store the current user's session before OAuth
    if (isRelinkFlow) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        const { storeOriginalSession } = await import('@/lib/gmbAuth');
        storeOriginalSession(
          currentSession.access_token,
          currentSession.refresh_token || '',
          currentSession.user.id
        );
        localStorage.setItem('gmb_restore_session', 'true');
      }
      localStorage.setItem('gmb_relink_flow', 'true');
    } else {
      localStorage.setItem('gmb_listing_flow', 'true');
    }

    // Always use production domain for OAuth callback
    const redirectTo = `https://www.appointpanda.com/auth/callback?${isRelinkFlow ? 'relink=true' : 'listing=true'}`;

    // IMPORTANT: Always use signInWithOAuth (not linkIdentity) for GMB flows
    // signInWithOAuth ensures we get a fresh provider_token with business.manage scope
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'openid email profile https://www.googleapis.com/auth/business.manage',
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent select_account',
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Finding Your Businesses...</CardTitle>
            <CardDescription>
              Connecting to Google Business Profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-coral" />
            </div>
            <CardTitle className="text-2xl">Unable to Fetch Businesses</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorCode === 'NO_PROVIDER_TOKEN' || errorCode === 'TOKEN_EXPIRED' ? (
              <Button onClick={handleRetryAuth} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sign in with Google Again
              </Button>
            ) : (
              <Button onClick={fetchBusinesses} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button variant="outline" onClick={handleSkipGMB} className="w-full">
              Continue Without Google Business
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-10 w-10 text-gold" />
            </div>
            <CardTitle className="text-2xl">No Google Business Profiles Found</CardTitle>
            <CardDescription>
              We couldn't find any Google Business Profiles linked to your Google account.
              You can still list your practice manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium mb-2">Don't have a Google Business Profile?</p>
              <p>You can create one at <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">business.google.com</a> and come back later to sync it.</p>
            </div>
            <Button onClick={handleSkipGMB} className="w-full">
              Continue with Manual Setup
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={handleRetryAuth} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Different Google Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Select Your Practice</h1>
          <p className="text-muted-foreground">
            Choose the Google Business Profile you want to list on Appoint Panda
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {businesses.map((business) => (
            <Card
              key={business.id}
              className={`cursor-pointer transition-all ${selectedBusiness?.id === business.id
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                  : 'hover:border-primary/30'
                }`}
              onClick={() => setSelectedBusiness(business)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${selectedBusiness?.id === business.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                    }`}>
                    {selectedBusiness?.id === business.id ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg truncate">{business.name}</h3>
                      {business.category && (
                        <Badge variant="secondary" className="flex-shrink-0">
                          {business.category}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {business.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{business.address}</span>
                        </div>
                      )}
                      {business.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span>{business.phone}</span>
                        </div>
                      )}
                      {business.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{business.website}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleSelectBusiness}
            disabled={!selectedBusiness || isCreating}
            className="flex-1"
            size="lg"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Listing...
              </>
            ) : (
              <>
                List This Practice
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleSkipGMB}
            disabled={isCreating}
            size="lg"
          >
            Skip & Enter Manually
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">
          By listing your practice, you agree to our terms and privacy policy.
          Your business information will be synced from Google Business Profile.
        </p>
      </div>
    </div>
  );
}
