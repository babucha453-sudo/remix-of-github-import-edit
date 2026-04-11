import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  CheckCircle,
  Circle,
  PartyPopper,
  Star,
  Shield,
  ArrowRight,
  Loader2,
  Lock,
  MapPin,
} from 'lucide-react';
import { LocationSelectionModal } from '@/components/LocationSelectionModal';

const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

interface ProfileCompleteness {
  hasName: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasDescription: boolean;
  hasImages: boolean;
  hasLocation: boolean;
  percentage: number;
}

/**
 * GMBOnboarding (Welcome / Onboarding Page)
 * 
 * Shows for:
 * - New signups (dentists who just signed up via Google or email)
 * - Users with onboarding_status != 'complete'
 * 
 * Allows:
 * - Skip directly to dashboard
 * - Complete profile
 * - Set password (for Google users)
 * - Select location if not auto-matched
 */
export default function GMBOnboarding() {
  const { user, roles, refreshRoles, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'welcome' | 'password' | 'location' | 'complete'>('welcome');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const isNewSignupParam = searchParams.get('new') === 'true';
  const gmbConnected = searchParams.get('gmb_connected') === 'true';
  const listingCreated = searchParams.get('listing_created') === 'true';
  const skippedGmb = searchParams.get('skip_gmb') === 'true';
  const locationPending = searchParams.get('location_pending') === 'true';
  const locationVerified = searchParams.get('location_verified') === 'true';
  const detectedCity = searchParams.get('detected_city') || '';
  const detectedCityId = searchParams.get('detected_city_id') || '';
  const isDentist = roles.includes('dentist');

  // Fetch user's clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['user-clinic', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('clinics')
        .select('*, city:cities(name), area:areas(name)')
        .eq('claimed_by', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch onboarding status
  const { data: onboarding } = useQuery({
    queryKey: ['user-onboarding', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isNewSignup = isNewSignupParam && onboarding?.onboarding_status !== 'complete';
  const isAdmin = roles.includes('super_admin') || roles.includes('district_manager');

  // Set noindex for onboarding pages
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

  // If onboarding is already complete and not a new signup, redirect to dashboard
  useEffect(() => {
    if (authLoading || clinicLoading) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    // If user is not a new signup and not coming from GMB connection:
    // - If onboarding is complete, go to dashboard
    // - If onboarding is null (no record) for existing dentist, treat as complete
    const isExistingUser = !isNewSignup && !gmbConnected;
    const onboardingComplete = onboarding?.onboarding_status === 'complete';
    const noOnboardingRecord = !onboarding;

    if (isExistingUser && (onboardingComplete || noOnboardingRecord)) {
      if (isDentist) {
        navigate('/dashboard?tab=my-dashboard', { replace: true });
      } else if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [authLoading, clinicLoading, user, onboarding, isNewSignup, gmbConnected, isDentist, isAdmin, navigate]);

  // Calculate profile completeness
  const completeness: ProfileCompleteness = {
    hasName: !!clinic?.name,
    hasAddress: !!clinic?.address,
    hasPhone: !!clinic?.phone,
    hasEmail: !!clinic?.email,
    hasDescription: !!clinic?.description,
    hasImages: !!clinic?.cover_image_url,
    hasLocation: !!clinic?.location_verified,
    percentage: 0,
  };

  const checks = [
    completeness.hasName,
    completeness.hasAddress,
    completeness.hasPhone,
    completeness.hasEmail,
    completeness.hasDescription,
    completeness.hasImages,
    completeness.hasLocation,
  ];
  completeness.percentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  // Check if location needs to be selected
  const needsLocationSelection = locationPending || (clinic && !clinic.location_verified && !clinic.location_pending_approval);

  // Check if user has password set
  const hasPassword = user?.identities?.some((i) => i.provider === 'email');
  const hasGoogle = user?.identities?.some((i) => i.provider === 'google');

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'there';

  const handleSetPassword = async () => {
    try {
      passwordSchema.parse(password);
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsSettingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success('Password set successfully!');
      setStep('complete');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set password');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleSkipPassword = () => {
    setStep('complete');
  };

  const markOnboardingComplete = async () => {
    if (!user?.id) return;
    const now = new Date().toISOString();
    await supabase
      .from('user_onboarding')
      .upsert(
        {
          user_id: user.id,
          onboarding_status: 'complete',
          completed_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );
    queryClient.invalidateQueries({ queryKey: ['user-onboarding'] });
  };

  const handleGoToDashboard = async () => {
    setIsSkipping(true);

    // Bootstrap dentist role if missing
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id);

    const hasDentistRole = (rolesData ?? []).some((r) => r.role === 'dentist');
    
    if (!hasDentistRole) {
      // Call bootstrap function to create role
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.functions.invoke('dentist-onboarding-bootstrap', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          await refreshRoles();
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      }
    }

    await markOnboardingComplete();
    navigate('/dashboard?tab=my-dashboard', { replace: true });
  };

  const handleCompleteProfile = async () => {
    // Bootstrap dentist role if missing
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id);

    const hasDentistRole = (rolesData ?? []).some((r) => r.role === 'dentist');
    
    if (!hasDentistRole) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.functions.invoke('dentist-onboarding-bootstrap', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          await refreshRoles();
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      }
    }

    // Don't mark complete yet - they're going to edit profile
    navigate('/dashboard?tab=my-profile', { replace: true });
  };

  if (authLoading || clinicLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Redirect handled in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent mb-2">
            Appoint Panda
          </h1>
          <p className="text-muted-foreground">Your dental practice dashboard</p>
        </div>

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-teal/20 flex items-center justify-center mb-4">
                <PartyPopper className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome, {userName}!</CardTitle>
              <CardDescription className="text-base">
                {listingCreated
                  ? 'Your practice has been successfully listed!'
                  : isNewSignup && skippedGmb
                  ? "Let's set up your practice profile manually."
                  : isNewSignup
                  ? "You've successfully signed up. Let's set up your practice profile."
                  : gmbConnected
                  ? 'Your Google Business Profile is now connected!'
                  : "Welcome back! Let's complete your practice setup."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Status */}
              {clinic && (
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Profile Completeness</span>
                    <Badge variant={completeness.percentage >= 80 ? 'default' : 'secondary'}>
                      {completeness.percentage}%
                    </Badge>
                  </div>
                  <Progress value={completeness.percentage} className="h-2" />

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {completeness.hasName ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Practice name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {completeness.hasAddress ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Address</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {completeness.hasPhone ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Phone number</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {completeness.hasEmail ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {completeness.hasDescription ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Description</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {completeness.hasImages ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Cover image</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {completeness.hasLocation ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Location confirmed</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Selection Needed Warning */}
              {needsLocationSelection && clinic && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <MapPin className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900">Location Confirmation Required</p>
                    <p className="text-sm text-amber-700 mb-3">
                      We couldn't auto-detect your exact area. Please confirm your location so your clinic appears on the right directory pages.
                    </p>
                    <Button
                      onClick={() => setShowLocationModal(true)}
                      className="bg-amber-600 hover:bg-amber-700"
                      size="sm"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Select Your Location
                    </Button>
                  </div>
                </div>
              )}

              {/* Location Verified Success */}
              {locationVerified && (
                <div className="flex items-center gap-3 bg-teal/10 rounded-xl p-4">
                  <MapPin className="h-5 w-5 text-teal" />
                  <div>
                    <p className="font-medium text-teal">Location Verified</p>
                    <p className="text-sm text-muted-foreground">
                      Your clinic is now listed in {clinic?.area?.name || clinic?.city?.name || 'your area'}
                    </p>
                  </div>
                </div>
              )}

              {/* GMB / Listing Status */}
              {(gmbConnected || listingCreated) && !locationPending && (
                <div className="flex items-center gap-3 bg-teal/10 rounded-xl p-4">
                  <CheckCircle className="h-5 w-5 text-teal" />
                  <div>
                    <p className="font-medium text-teal">
                      {listingCreated ? 'Practice Listed Successfully' : 'Google Business Connected'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {listingCreated
                        ? 'Your business data has been imported from Google'
                        : 'Reviews and business info will sync automatically'}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                {!hasPassword && hasGoogle && (
                  <Button onClick={() => setStep('password')} variant="outline" className="w-full h-12">
                    <Lock className="h-4 w-4 mr-2" />
                    Set a Password (Optional)
                  </Button>
                )}

                <Button onClick={handleCompleteProfile} variant="outline" className="w-full h-12">
                  Complete Your Profile
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                <Button
                  onClick={handleGoToDashboard}
                  className="w-full h-12"
                  disabled={isSkipping}
                >
                  {isSkipping ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Skip → Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Verified Badge</p>
                    <p className="text-xs text-muted-foreground">Build patient trust</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Collect Reviews</p>
                    <p className="text-xs text-muted-foreground">Grow your reputation</p>
                  </div>
                </div>
              </div>

              {/* US-Only Notice */}
              <p className="text-xs text-center text-muted-foreground pt-2">
                Appoint Panda is currently available for dental practices in California, Massachusetts, and Connecticut.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step: Password Setup */}
        {step === 'password' && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Set a Password</CardTitle>
              <CardDescription>
                Create a password so you can also log in with email in the future
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleSkipPassword} className="flex-1">
                  Skip for Now
                </Button>
                <Button
                  onClick={handleSetPassword}
                  disabled={isSettingPassword || !password}
                  className="flex-1"
                >
                  {isSettingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Set Password
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-16 w-16 rounded-full bg-teal/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-teal" />
              </div>
              <CardTitle className="text-2xl">You're All Set!</CardTitle>
              <CardDescription>
                Your account is ready. Head to your dashboard to manage your practice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleGoToDashboard} className="w-full h-12" disabled={isSkipping}>
                {isSkipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Location Selection Modal */}
      {clinic && (
        <LocationSelectionModal
          open={showLocationModal}
          onOpenChange={setShowLocationModal}
          clinicId={clinic.id}
          detectedCity={detectedCity || clinic?.city?.name}
          detectedCityId={detectedCityId || clinic?.city_id}
          onLocationSelected={() => {
            queryClient.invalidateQueries({ queryKey: ['user-clinic'] });
            toast.success('Location confirmed! Your clinic is now live.');
            // Navigate without the location_pending flag
            navigate('/onboarding?gmb_connected=true&listing_created=true&location_verified=true', { replace: true });
          }}
        />
      )}
    </div>
  );
}
