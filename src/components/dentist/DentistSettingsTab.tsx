import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Settings,
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Lock,
  Bell,
  Shield,
  CheckCircle,
  ExternalLink,
  LinkIcon,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  Unlink,
  AlertTriangle,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import GMBConnectionCard from '@/components/reputation/GMBConnectionCard';
import GMBBookingLinkCard from '@/components/dentist/GMBBookingLinkCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function DentistSettingsTab() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [unlinkGoogleDialog, setUnlinkGoogleDialog] = useState(false);
  const [unlinkGmbDialog, setUnlinkGmbDialog] = useState(false);

  // Check if user signed in with Google
  const isGoogleUser = user?.app_metadata?.provider === 'google' || 
    (user?.app_metadata?.providers as string[] | undefined)?.includes('google');

  // Fetch clinic (without sensitive gmb fields that are now in clinic_oauth_tokens)
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, google_place_id, website, gmb_connected, verification_status')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch oauth tokens separately (only accessible to clinic owner)
  const { data: oauthTokens } = useQuery({
    queryKey: ['clinic-oauth-tokens', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_connected, gmb_last_sync_at, gmb_data')
        .eq('clinic_id', clinic?.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  // Social links state (would be stored in clinic or profile)
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    facebook: '',
    twitter: '',
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailReviewAlerts: true,
    emailAppointments: true,
    smsReminders: false,
    weeklyDigest: true,
  });

  // Update password
  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Update social links (placeholder - would need DB migration)
  const handleSaveSocialLinks = async () => {
    toast.success('Social links saved');
  };

  // Unlink GMB connection (remove from clinic_oauth_tokens)
  const handleUnlinkGmb = async () => {
    if (!clinic?.id) return;

    try {
      // Delete oauth tokens
      await supabase
        .from('clinic_oauth_tokens')
        .delete()
        .eq('clinic_id', clinic.id);

      // Update clinic to clear google_place_id and gmb_connected
      const { error } = await supabase
        .from('clinics')
        .update({
          google_place_id: null,
          gmb_connected: false,
        })
        .eq('id', clinic.id);

      if (error) throw error;

      toast.success('GMB disconnected. Review sync has been disabled.');
      queryClient.invalidateQueries({ queryKey: ['dentist-clinic-settings'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-oauth-tokens'] });
      setUnlinkGmbDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect GMB');
    }
  };

  // Re-link GMB - initiate OAuth with GMB scopes and then let the user pick a business
  const handleRelinkGmb = async () => {
    if (!clinic?.id) return;

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.user) {
        toast.error('Please sign in first');
        return;
      }

      // CRITICAL: Store the original user's session before OAuth
      // This allows us to restore their session after getting the GMB token
      // even if they use a different Google account for GMB
      const { storeOriginalSession } = await import('@/lib/gmbAuth');
      storeOriginalSession(
        currentSession.access_token,
        currentSession.refresh_token || '',
        currentSession.user.id
      );

      // Mark as relink flow so /gmb-select updates the existing clinic instead of creating a new one
      localStorage.setItem('gmb_relink_flow', 'true');
      // Mark that we need to restore the original user after GMB OAuth
      localStorage.setItem('gmb_restore_session', 'true');

      // Always use production domain for OAuth callback
      const redirectTo = 'https://www.appointpanda.com/auth/callback?relink=true';

      // IMPORTANT: Use signInWithOAuth to get the GMB token from the Google account
      // The callback will capture the token and then restore the original user session
      const { error } = await supabase.auth.signInWithOAuth({
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

      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate GMB connection');
    }
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your practice settings and connections</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Connected Accounts */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              Manage your linked accounts and sign-in methods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Account */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Google Account</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              {isGoogleUser ? (
                <Badge className="bg-teal/20 text-teal border-0">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not Connected
                </Badge>
              )}
            </div>

            {/* GMB Account */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sm">Google Business Profile</p>
                  <p className="text-xs text-muted-foreground">
                    {clinic?.google_place_id ? clinic.name : 'Not linked'}
                  </p>
                </div>
              </div>
              {clinic?.google_place_id ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-teal/20 text-teal border-0">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-coral hover:text-coral"
                    onClick={() => setUnlinkGmbDialog(true)}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRelinkGmb}
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              )}
            </div>

            <Separator />

            <div className="p-3 rounded-lg bg-amber/10 border border-amber/20">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">De-linking accounts</p>
                  <p className="mt-1">
                    Removing GMB connection will disable review sync and automation features.
                    Your account will remain active.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GMB Connection */}
        {clinic && (
          <GMBConnectionCard
            clinicId={clinic.id}
            clinicName={clinic.name}
            googlePlaceId={clinic.google_place_id}
            lastSyncAt={(oauthTokens?.gmb_data as any)?.fetched_at || oauthTokens?.gmb_last_sync_at}
          />
        )}

        {/* GMB Booking Link */}
        {clinic && (
          <GMBBookingLinkCard
            clinicId={clinic.id}
            clinicSlug={clinic.slug}
            isGmbConnected={!!clinic.google_place_id}
          />
        )}

        {/* Social Links */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Social Connections
            </CardTitle>
            <CardDescription>
              Link your social media profiles to your practice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                Instagram
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://instagram.com/yourpractice"
                  value={socialLinks.instagram}
                  onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                />
                <Button variant="outline" size="icon" disabled={!socialLinks.instagram}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                Facebook
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://facebook.com/yourpractice"
                  value={socialLinks.facebook}
                  onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                />
                <Button variant="outline" size="icon" disabled={!socialLinks.facebook}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-sky-500" />
                X (Twitter)
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://x.com/yourpractice"
                  value={socialLinks.twitter}
                  onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                />
                <Button variant="outline" size="icon" disabled={!socialLinks.twitter}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button onClick={handleSaveSocialLinks} className="w-full">
              Save Social Links
            </Button>
          </CardContent>
        </Card>

        {/* Password & Security */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Password & Security
            </CardTitle>
            <CardDescription>
              Update your password and security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleUpdatePassword} 
              disabled={isUpdatingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {isUpdatingPassword ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>

            <Separator className="my-4" />

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Security Status</h4>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-teal" />
                  <span className="text-sm">Two-Factor Authentication</span>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-sm">Google Sign-In</span>
                </div>
                <Badge className="bg-teal/20 text-teal border-0">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how and when you receive alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Review Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when you receive new reviews</p>
              </div>
              <Switch
                checked={notifications.emailReviewAlerts}
                onCheckedChange={(checked) => setNotifications({ ...notifications, emailReviewAlerts: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Appointment Notifications</p>
                <p className="text-xs text-muted-foreground">Get notified about new and updated appointments</p>
              </div>
              <Switch
                checked={notifications.emailAppointments}
                onCheckedChange={(checked) => setNotifications({ ...notifications, emailAppointments: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">SMS Reminders</p>
                <p className="text-xs text-muted-foreground">Receive SMS for urgent notifications</p>
              </div>
              <Switch
                checked={notifications.smsReminders}
                onCheckedChange={(checked) => setNotifications({ ...notifications, smsReminders: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">Get a weekly summary of your practice performance</p>
              </div>
              <Switch
                checked={notifications.weeklyDigest}
                onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyDigest: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unlink GMB Dialog */}
      <AlertDialog open={unlinkGmbDialog} onOpenChange={setUnlinkGmbDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Business Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing reviews from Google and disable automated review collection features.
              You can reconnect your Google Business Profile at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkGmb} className="bg-coral hover:bg-coral/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}