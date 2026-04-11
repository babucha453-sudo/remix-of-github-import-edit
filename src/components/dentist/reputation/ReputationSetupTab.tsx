import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import {
  Settings,
  Globe,
  Filter,
  Bell,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Save,
  Link2,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Smartphone,
  ArrowRight,
  Sparkles,
  Info,
  RefreshCw,
} from 'lucide-react';
import { storeOriginalSession } from '@/lib/gmbAuth';

interface ReputationSetupTabProps {
  clinicId: string;
  clinicName: string;
  googlePlaceId?: string | null;
}

export default function ReputationSetupTab({
  clinicId,
  clinicName,
  googlePlaceId,
}: ReputationSetupTabProps) {
  const queryClient = useQueryClient();
  const [customReviewUrl, setCustomReviewUrl] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['reputation-setup', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dentist_settings')
        .select('*')
        .eq('clinic_id', clinicId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) || { funnel_enabled: true, funnel_threshold: 4 };
    },
  });

  // Fetch custom review URL
  const { data: tokenData } = useQuery({
    queryKey: ['gmb-token-data', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_data')
        .eq('clinic_id', clinicId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (tokenData?.gmb_data && typeof tokenData.gmb_data === 'object') {
      const gmbData = tokenData.gmb_data as { custom_review_url?: string };
      if (gmbData.custom_review_url) {
        setCustomReviewUrl(gmbData.custom_review_url);
      }
    }
  }, [tokenData]);

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase
        .from('dentist_settings')
        .upsert({
          clinic_id: clinicId,
          ...updates,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      await createAuditLog({
        action: 'update_reputation_settings',
        entityType: 'dentist_settings',
        entityId: clinicId,
        newValues: updates,
      });
    },
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['reputation-setup'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Save custom review URL
  const saveReviewUrl = async () => {
    if (!customReviewUrl.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }
    try {
      new URL(customReviewUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsSavingUrl(true);
    try {
      const { data: existing } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_data')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      const existingData = (existing?.gmb_data as Record<string, unknown>) || {};
      await supabase.from('clinic_oauth_tokens').upsert({
        clinic_id: clinicId,
        gmb_data: { ...existingData, custom_review_url: customReviewUrl.trim() },
      }, { onConflict: 'clinic_id' });

      toast.success('Review link saved');
      queryClient.invalidateQueries({ queryKey: ['gmb-token-data'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSavingUrl(false);
    }
  };

  // Connect to Google
  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Please sign in first');
        return;
      }

      storeOriginalSession(session.access_token, session.refresh_token || '', session.user.id);
      localStorage.setItem('gmb_relink_flow', 'true');
      localStorage.setItem('gmb_restore_session', 'true');

      const redirectTo = 'https://www.appointpanda.com/auth/callback?relink=true';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid email profile https://www.googleapis.com/auth/business.manage',
          redirectTo,
          queryParams: { access_type: 'offline', prompt: 'consent select_account' },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const autoGeneratedUrl = googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : '';

  // Calculate setup progress
  const setupSteps = [
    { done: !!googlePlaceId || !!customReviewUrl, label: 'Google Review Link' },
    { done: settings?.funnel_enabled !== false, label: 'Review Funnel' },
    { done: true, label: 'Notifications' }, // Always consider done for now
  ];
  const completedSteps = setupSteps.filter(s => s.done).length;
  const setupProgress = Math.round((completedSteps / setupSteps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Setup Progress */}
      <Card className="bg-gradient-to-r from-primary/10 via-teal/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">Reputation Setup</h3>
              <p className="text-sm text-muted-foreground">Configure your reputation management system</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{setupProgress}%</p>
              <p className="text-sm text-muted-foreground">Complete</p>
            </div>
          </div>
          <Progress value={setupProgress} className="h-2 mb-4" />
          <div className="flex gap-4">
            {setupSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {step.done ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>{step.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Google Business Profile Setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Google Business Profile</CardTitle>
                <CardDescription>Connect or manually configure your Google reviews</CardDescription>
              </div>
            </div>
            {googlePlaceId ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : customReviewUrl ? (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                <Link2 className="h-3 w-3 mr-1" />
                Manual Link
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-200 text-red-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-connect option */}
          <div className="p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border">
                <img
                  src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png"
                  alt="Google"
                  className="h-6 w-6"
                />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1">Connect via Google (Recommended)</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Automatically sync your Google Business Profile for seamless review management.
                </p>
                <Button onClick={handleGoogleConnect} disabled={isConnecting} variant="outline">
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {googlePlaceId ? 'Reconnect' : 'Connect Google'}
                </Button>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Manual link option */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <Label className="font-medium">Manual Google Review Link</Label>
            </div>
            <div className="flex gap-2">
              <Input
                value={customReviewUrl}
                onChange={(e) => setCustomReviewUrl(e.target.value)}
                placeholder="https://g.page/r/your-business/review"
                className="flex-1"
              />
              <Button onClick={saveReviewUrl} disabled={isSavingUrl}>
                {isSavingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find your link at{' '}
              <a
                href="https://support.google.com/business/answer/7035772"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Business Profile → Share Review Link
              </a>
            </p>
          </div>

          {/* Current active link */}
          {(googlePlaceId || customReviewUrl) && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Active Review Link:</span>
                <a
                  href={customReviewUrl || autoGeneratedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {(customReviewUrl || autoGeneratedUrl).slice(0, 50)}...
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Funnel Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Filter className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Review Funnel</CardTitle>
              <CardDescription>Control how patients are routed based on satisfaction</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
            <div>
              <Label className="font-medium">Enable Review Funnel</Label>
              <p className="text-sm text-muted-foreground">
                Route patients through satisfaction check before reviews
              </p>
            </div>
            <Switch
              checked={settings?.funnel_enabled ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ funnel_enabled: checked })}
            />
          </div>

          {/* Threshold */}
          <div className="space-y-3">
            <Label className="font-medium">Positive Threshold (1-5)</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={5}
                value={settings?.funnel_threshold ?? 4}
                onChange={(e) => updateSettings.mutate({ funnel_threshold: parseInt(e.target.value) || 4 })}
                className="w-24"
              />
              <p className="text-sm text-muted-foreground">
                Ratings at or above this redirect to Google
              </p>
            </div>
          </div>

          {/* Visual Flow */}
          <div className="p-4 rounded-xl bg-muted/30 border">
            <h4 className="font-medium mb-4">How It Works</h4>
            <div className="flex items-center justify-between gap-4">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Patient scans</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-xs text-muted-foreground">Rates experience</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                    <ThumbsUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">→ Google</p>
                </div>
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                    <ThumbsDown className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">→ Private</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Bell className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure alerts for reputation events</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="font-medium">Email Alerts</Label>
                <p className="text-sm text-muted-foreground">Receive email for negative feedback</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="font-medium">Rating Drop Alerts</Label>
                <p className="text-sm text-muted-foreground">Alert when rating drops significantly</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="font-medium">Dashboard Notifications</Label>
                <p className="text-sm text-muted-foreground">Show alerts in your dashboard</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
