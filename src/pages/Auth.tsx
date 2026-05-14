import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { clearGmbProviderToken } from '@/lib/gmbAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Auth() {
  const { user, roles, signIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    if (isLoading || !user) return;

    const isGmbFlow = localStorage.getItem('gmb_listing_flow') === 'true' ||
                      localStorage.getItem('gmb_relink_flow') === 'true' ||
                      localStorage.getItem('gmb_pending') === 'true' ||
                      localStorage.getItem('gmb_restore_session') === 'true';
    if (isGmbFlow) return;

    const isSuperAdmin = roles.includes('super_admin') || roles.includes('district_manager');
    const isAdmin = isSuperAdmin || roles.some(r => ['seo_team', 'content_team', 'marketing_team', 'support_team'].includes(r));
    const isDentist = roles.includes('dentist');

    const shouldRedirect = ['/auth', '/login', '/signup/dentist'].includes(location.pathname);
    if (!shouldRedirect) return;

    const timer = setTimeout(() => {
      if (isSuperAdmin || isAdmin) {
        navigate('/admin', { replace: true });
      } else if (isDentist) {
        navigate('/dashboard?tab=my-dashboard', { replace: true });
      } else {
        navigate('/onboarding?new=true', { replace: true });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [user, roles, isLoading, navigate, location.pathname]);

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
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-primary/10 to-teal/10 border border-primary/20 rounded-xl p-5 text-center">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3m12 0v4m3-4h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4m-6 0a1 1 0 0 1 0 2H8m6 0H8m6 0v8m-3-4v4m0 0h4" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-base mb-1">Are you a Dentist?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use our dedicated signup page for the best onboarding experience. It takes less than 2 minutes.
                  </p>
                  <Link to="/signup/dentist">
                    <Button className="w-full font-bold shadow-glow">
                      Sign Up as a Dentist
                      <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Button>
                  </Link>
                </div>

                <div className="relative mb-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground">or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
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
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
