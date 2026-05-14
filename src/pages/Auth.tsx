import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { clearGmbProviderToken } from '@/lib/gmbAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function Auth() {
  const { user, roles, signIn, signUp, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');

  useEffect(() => {
    console.log('[Auth] useEffect:', { isLoading, hasUser: !!user, roles, hasRedirected });
    
    // Wait for auth to finish loading AND ensure user exists
    if (isLoading || !user) {
      console.log('[Auth] Skipping redirect:', { isLoading, hasUser: !!user });
      return;
    }

    // Check if there's an active GMB flow - don't redirect if so
    const isGmbFlow = localStorage.getItem('gmb_listing_flow') === 'true' ||
                      localStorage.getItem('gmb_relink_flow') === 'true' ||
                      localStorage.getItem('gmb_pending') === 'true' ||
                      localStorage.getItem('gmb_restore_session') === 'true';
    
    if (isGmbFlow) {
      console.log('[Auth] GMB flow in progress, not redirecting');
      return;
    }

    // Get base path - admins go to /admin, dentists/dentists go to /dashboard
    const isSuperAdmin = roles.includes('super_admin') || roles.includes('district_manager');
    const isAdmin = isSuperAdmin || roles.some(r => ['seo_team', 'content_team', 'marketing_team', 'support_team'].includes(r));
    const isDentist = roles.includes('dentist');
    
    console.log('[Auth] Roles check:', { isSuperAdmin, isAdmin, isDentist, roles });

    // Redirect authenticated users away from auth page
    if (hasRedirected) {
      // Already redirected before - but force redirect on first login success
      // Check if we need to redirect based on current path
      if (location.pathname === '/auth' || location.pathname === '/login') {
        // Force redirect now
        if (isSuperAdmin || isAdmin) {
          navigate('/admin', { replace: true });
        } else if (isDentist) {
          navigate('/dashboard?tab=my-dashboard', { replace: true });
        } else if (roles.length === 0) {
          navigate('/onboarding?new=true', { replace: true });
        } else {
          navigate('/onboarding?new=true', { replace: true });
        }
      }
      return;
    }

    // First time redirect - mark as redirected and navigate
    setHasRedirected(true);

    // SuperAdmins go directly to /admin - no delays, no onboarding
    if (isSuperAdmin || isAdmin) {
      console.log('[Auth] Redirecting to /admin');
      navigate('/admin', { replace: true });
    } else if (isDentist) {
      console.log('[Auth] Redirecting to /dashboard');
      // Dentists go to their dashboard
      navigate('/dashboard?tab=my-dashboard', { replace: true });
    } else if (roles.length === 0) {
      console.log('[Auth] No roles, redirecting to /onboarding');
      // User has no roles - might still be loading, or is a new user
      // Send to onboarding
      navigate('/onboarding?new=true', { replace: true });
    } else {
      console.log('[Auth] Unknown role, redirecting to /onboarding');
      // Has some other role, default to onboarding
      navigate('/onboarding?new=true', { replace: true });
    }
  }, [user, roles, isLoading, navigate, hasRedirected, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message.includes('Invalid login credentials') ? 'Invalid email or password' : error.message);
    } else {
      toast.success('Welcome back!');
      // Force redirect on successful login - useEffect might take time to trigger
      setTimeout(() => {
        if (!roles.length) {
          navigate('/onboarding?new=true', { replace: true });
        } else if (roles.includes('dentist')) {
          navigate('/dashboard?tab=my-dashboard', { replace: true });
        } else if (roles.includes('super_admin') || roles.some(r => ['seo_team', 'content_team', 'marketing_team', 'support_team'].includes(r))) {
          navigate('/admin', { replace: true });
        } else {
          navigate('/onboarding?new=true', { replace: true });
        }
      }, 1500);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsSubmitting(false);

    if (error) {
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('user already')) {
        toast.error('This email is already registered. Please sign in.');
      } else if (errMsg.includes('rate_limit') || errMsg.includes('too many') || errMsg.includes('over_email')) {
        toast.error('Too many signup attempts with this email. Please wait a few minutes and try again, or use "Continue with Google" to sign up.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Account created successfully! Check your email to confirm your account.');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // Ensure we don't accidentally continue a stale GMB listing/sync flow from localStorage
      localStorage.removeItem('gmb_listing_flow');
      localStorage.removeItem('gmb_pending');
      localStorage.removeItem('gmb_link_token');
      localStorage.removeItem('gmb_relink_flow');
      localStorage.removeItem('gmb_restore_session');
      clearGmbProviderToken();

      // Use current origin for OAuth callback to ensure proper domain handling
      const currentOrigin = window.location.origin;
      const redirectTo = `${currentOrigin}/auth/callback`;
      
      console.log('[Auth] Starting Google OAuth, redirect:', redirectTo);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
  };

  // Set noindex for auth pages
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent">
            Appoint Panda
          </CardTitle>
          <CardDescription>
            Sign in to manage your dental practice or find the best dentists
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google Sign In Button */}
          <Button
            variant="outline"
            className="w-full mb-6 h-12"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <img 
                src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" 
                alt="Google" 
                className="h-5 w-5 mr-2"
              />
            )}
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Dr. John Smith"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating account...' : 'Create Account'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Having trouble signing up?{' '}
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline cursor-pointer"
                    onClick={handleGoogleSignIn}
                  >
                    Use Google to sign up
                  </button>
                  {' '}— it's faster and avoids email verification.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
