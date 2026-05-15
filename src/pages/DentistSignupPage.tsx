import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(200).trim(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

async function tryEdgeFunctionSignup(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.functions.invoke('dentist-signup', {
    body: { email, password, fullName },
  });
  return { data, error };
}

async function assignDentistRole(userId: string, maxRetries = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const { error } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: userId, role: 'dentist' },
        { onConflict: 'user_id,role' }
      );
    if (!error) return true;
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  return false;
}

export default function DentistSignupPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const { email, password, fullName } = formData;
      let userId: string | null = null;
      let usedFallback = false;

      // Step 1: Try edge function first (fast, no rate limits)
      const edgeResult = await tryEdgeFunctionSignup(email, password, fullName);

      if (edgeResult.error || edgeResult.data?.error) {
        const edgeErrMsg = (edgeResult.data?.error || edgeResult.error?.message || '').toLowerCase();

        // If edge function not found (404) or network error, fall back to standard signup
        const isRecoverableError =
          edgeResult.error?.message?.includes('fetch') ||
          edgeResult.error?.message?.includes('Failed to send') ||
          edgeResult.error?.message?.includes('Network') ||
          edgeResult.error?.message?.includes('404') ||
          edgeErrMsg.includes('not found') ||
          edgeErrMsg.includes('failed to send');

        if (isRecoverableError) {
          console.warn('[Signup] Edge function unavailable, falling back to standard signup');
          usedFallback = true;

          // Fallback: Use standard Supabase signup
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
            },
          });

          if (signUpError) {
            const errMsg = signUpError.message.toLowerCase();
            if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('user already')) {
              toast.error('This email is already registered. Please sign in.');
              setIsSubmitting(false);
              return;
            }
            if (errMsg.includes('rate_limit') || errMsg.includes('too many') || errMsg.includes('over_email')) {
              toast.error('Too many signup attempts. Please wait a few minutes, or use Google sign up.');
              setIsSubmitting(false);
              return;
            }
            toast.error(signUpError.message || 'Signup failed. Please try again.');
            setIsSubmitting(false);
            return;
          }

          userId = signUpData.user?.id ?? null;

          // If email confirmation is required, let user know
          if (signUpData.user && !signUpData.session) {
            toast.success('Account created! Please check your email to confirm your account.');
            setTimeout(() => navigate('/auth?tab=login'), 2000);
            setIsSubmitting(false);
            return;
          }
        } else {
          // Non-recoverable edge function error (e.g., user already exists)
          if (edgeErrMsg.includes('already registered') || edgeErrMsg.includes('already exists') || edgeErrMsg.includes('409')) {
            toast.error('This email is already registered. Please sign in.');
            setIsSubmitting(false);
            return;
          }
          toast.error(edgeResult.data?.error || edgeResult.error?.message || 'Signup failed.');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Edge function succeeded
        userId = edgeResult.data?.userId ?? null;
      }

      // Step 2: Sign in (works for both edge function and fallback)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast.error('Account created but failed to sign in. Please sign in manually.');
        navigate('/auth?tab=login', { replace: true });
        setIsSubmitting(false);
        return;
      }

      // Step 3: Assign dentist role (if not done by edge function, or fallback case)
      if (usedFallback && userId) {
        const roleAssigned = await assignDentistRole(userId);
        if (!roleAssigned) {
          console.warn('[Signup] Failed to assign dentist role, will retry on next login');
        }
      }

      toast.success('Welcome to AppointPanda!');
      navigate('/onboarding?new=true', { replace: true });
    } catch (err: any) {
      console.error('[Signup] Unexpected error:', err);
      toast.error(err?.message || 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      localStorage.removeItem('gmb_listing_flow');
      localStorage.removeItem('gmb_pending');
      localStorage.removeItem('gmb_link_token');
      localStorage.removeItem('gmb_relink_flow');
      localStorage.removeItem('gmb_restore_session');

      const currentOrigin = window.location.origin;
      const redirectTo = `${currentOrigin}/auth/callback`;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <SEOHead
        title="Sign Up as a Dentist | AppointPanda"
        description="Create your free AppointPanda account and start managing your dental practice online."
      />

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent">
            Dentist Sign Up
          </CardTitle>
          <CardDescription>
            Create your account and start managing your dental practice
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <span className="bg-card px-3 text-muted-foreground">Or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Dr. John Smith"
                value={formData.fullName}
                onChange={handleChange}
                className={errors.fullName ? 'border-destructive' : ''}
              />
              {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="doctor@practice.com"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'border-destructive' : ''}
              />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/auth?tab=login" className="text-primary underline-offset-2 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}