import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { storeOriginalSession } from '@/lib/gmbAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
  Settings,
} from 'lucide-react';

interface GMBConnectionCardProps {
  clinicId: string;
  clinicName: string;
  googlePlaceId: string | null;
  lastSyncAt?: string;
  onConnect?: () => void;
  showManualEntry?: boolean;
}

export default function GMBConnectionCard({
  clinicId,
  clinicName,
  googlePlaceId,
  lastSyncAt,
  onConnect,
  showManualEntry = true,
}: GMBConnectionCardProps) {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [manualPlaceId, setManualPlaceId] = useState('');
  const [showManual, setShowManual] = useState(false);

  const isConnected = !!googlePlaceId;
  const hasGmbData = !!googlePlaceId;

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Please sign in first');
        return;
      }

      // CRITICAL: Store the original user's session before OAuth
      // This allows us to restore their session after getting the GMB token
      // even if they use a different Google account for GMB
      storeOriginalSession(
        session.access_token,
        session.refresh_token || '',
        session.user.id
      );

      // This is a "relink" flow: after OAuth we send the user to /gmb-select to pick the exact Business Profile.
      localStorage.setItem('gmb_relink_flow', 'true');
      // Mark that we need to restore the original user after GMB OAuth
      localStorage.setItem('gmb_restore_session', 'true');

      // Use current origin for OAuth callback to ensure proper domain handling
      const currentOrigin = window.location.origin;
      const redirectTo = `${currentOrigin}/auth/callback?relink=true`;

      console.log('[GMB] Starting OAuth for GMB connection, redirect:', redirectTo);

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
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect with Google');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!googlePlaceId) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmb-import', {
        body: {
          action: 'sync',
          placeId: googlePlaceId,
          clinicId,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Profile synced with Google Business');
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
      queryClient.invalidateQueries({ queryKey: ['dentist-clinic'] });
      queryClient.invalidateQueries({ queryKey: ['google-reviews', clinicId] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSave = async () => {
    if (!manualPlaceId.trim()) return;
    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          google_place_id: manualPlaceId.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', clinicId);

      if (error) throw error;
      toast.success('Google Place ID saved');
      setManualPlaceId('');
      setShowManual(false);
      queryClient.invalidateQueries({ queryKey: ['dentist-clinic'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    }
  };

  return (
    <Card className={`card-modern ${isConnected ? 'border-teal/30 bg-teal/5' : 'border-gold/30 bg-gold/5'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <img 
              src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" 
              alt="Google" 
              className="h-5 w-5"
            />
            Google Business Profile
          </CardTitle>
          {isConnected ? (
            <Badge className="bg-teal/20 text-teal border-0">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge className="bg-gold/20 text-gold border-0">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          {isConnected
            ? 'Sync reviews, hours, and photos from your Google Business Profile'
            : 'Connect your Google Business Profile to sync reviews and manage your online presence'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Place ID</span>
              <code className="bg-muted px-2 py-1 rounded text-xs">{googlePlaceId}</code>
            </div>
            {lastSyncAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last synced</span>
                <span>{new Date(lastSyncAt).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={isSyncing} className="flex-1">
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`https://business.google.com/dashboard/l/${googlePlaceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              onClick={handleGoogleConnect}
              disabled={isConnecting}
              className="w-full bg-white hover:bg-gray-50 text-gray-800 border border-gray-300"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <img
                  src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png"
                  alt="Google"
                  className="h-5 w-5 mr-2"
                />
              )}
              Sign in with Google
            </Button>

            {showManualEntry && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                {showManual ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter Google Place ID"
                      value={manualPlaceId}
                      onChange={(e) => setManualPlaceId(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleManualSave} disabled={!manualPlaceId.trim()}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowManual(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="w-full" onClick={() => setShowManual(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Enter Place ID Manually
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
