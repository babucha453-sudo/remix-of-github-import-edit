import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ExternalLink, 
  Link2, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Calendar,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface GMBBookingLinkCardProps {
  clinicId: string;
  clinicSlug: string;
  isGmbConnected: boolean;
}

export default function GMBBookingLinkCard({ 
  clinicId, 
  clinicSlug,
  isGmbConnected 
}: GMBBookingLinkCardProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch current booking link status
  const { data: linkStatus, isLoading } = useQuery({
    queryKey: ['gmb-booking-link-status', clinicId],
    queryFn: async () => {
      const { data: oauthTokens } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_booking_link_enabled, gmb_booking_link_id, gmb_booking_link_set_at')
        .eq('clinic_id', clinicId)
        .single();

      return {
        enabled: oauthTokens?.gmb_booking_link_enabled ?? false,
        linkId: oauthTokens?.gmb_booking_link_id,
        setAt: oauthTokens?.gmb_booking_link_set_at,
      };
    },
    enabled: !!clinicId && isGmbConnected,
  });

  // Mutation to set/remove booking link
  const bookingLinkMutation = useMutation({
    mutationFn: async (action: 'set' | 'remove') => {
      const { data, error } = await supabase.functions.invoke('gmb-booking-link', {
        body: { action, clinicId }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: (data, action) => {
      queryClient.invalidateQueries({ queryKey: ['gmb-booking-link-status', clinicId] });
      queryClient.invalidateQueries({ queryKey: ['clinic-oauth-tokens', clinicId] });

      if (action === 'set') {
        toast.success('Booking link added to your Google Business Profile!', {
          description: 'Patients can now book directly from Google Maps.',
        });
      } else {
        toast.success('Booking link removed from Google Business Profile');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to update booking link', {
        description: error.message,
      });
    },
  });

  const handleToggle = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      await bookingLinkMutation.mutateAsync(enabled ? 'set' : 'remove');
    } finally {
      setIsUpdating(false);
    }
  };

  const bookingUrl = `https://www.appointpanda.com/book/${clinicId}`;

  if (!isGmbConnected) {
    return (
      <Card className="card-modern border-dashed opacity-75">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            GMB Booking Link
          </CardTitle>
          <CardDescription>
            Connect your Google Business Profile first to enable this feature
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>Requires active GMB connection</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="card-modern">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-modern">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            GMB Booking Link
          </CardTitle>
          {linkStatus?.enabled && (
            <Badge className="bg-teal/20 text-teal border-0">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
        <CardDescription>
          Add a "Book Appointment" button to your Google Business Profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle Section */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Enable Booking Button</p>
              <p className="text-xs text-muted-foreground">
                Shows on your Google Maps listing
              </p>
            </div>
          </div>
          <Switch
            checked={linkStatus?.enabled ?? false}
            onCheckedChange={handleToggle}
            disabled={isUpdating || bookingLinkMutation.isPending}
          />
        </div>

        {/* Status Info */}
        {linkStatus?.enabled && (
          <div className="space-y-3">
            {/* Booking URL */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Your booking URL:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {bookingUrl}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(bookingUrl);
                    toast.success('Booking URL copied!');
                  }}
                >
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(bookingUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Last synced */}
            {linkStatus.setAt && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last synced to GMB:</span>
                <span>{format(new Date(linkStatus.setAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleToggle(true)}
              disabled={isUpdating || bookingLinkMutation.isPending}
            >
              {isUpdating || bookingLinkMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh GMB Link
                </>
              )}
            </Button>
          </div>
        )}

        {/* Benefits when disabled */}
        {!linkStatus?.enabled && (
          <div className="p-3 rounded-lg bg-amber/10 border border-amber/20">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-foreground">Why enable this?</p>
                <ul className="mt-1 text-muted-foreground space-y-1">
                  <li>• Patients can book directly from Google Maps</li>
                  <li>• Increases appointment requests by up to 40%</li>
                  <li>• Link persists until you disable it</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
