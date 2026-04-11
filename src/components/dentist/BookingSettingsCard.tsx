import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import {
  Calendar,
  Clock,
  Users,
  Bell,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

interface BookingSettingsCardProps {
  clinicId: string;
}

export default function BookingSettingsCard({ clinicId }: BookingSettingsCardProps) {
  const { settings, isLoading, toggleBooking, updateSettings, isUpdating } = useBookingSettings(clinicId);

  if (isLoading) {
    return (
      <Card className="card-modern">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const bookingEnabled = settings?.booking_enabled ?? true;

  return (
    <Card className="card-modern">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Booking Settings
        </CardTitle>
        <CardDescription>
          Control how patients can book appointments with your practice
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Booking Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              bookingEnabled ? 'bg-teal/20' : 'bg-muted'
            }`}>
              {bookingEnabled ? (
                <CheckCircle className="h-5 w-5 text-teal" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber" />
              )}
            </div>
            <div>
              <p className="font-semibold">Online Booking</p>
              <p className="text-sm text-muted-foreground">
                {bookingEnabled
                  ? 'Patients can book online via your profile'
                  : 'Booking is disabled - patients must call'}
              </p>
            </div>
          </div>
          <Switch
            checked={bookingEnabled}
            onCheckedChange={async (checked) => {
              try {
                await toggleBooking(checked);
                toast.success(checked ? 'Booking enabled' : 'Booking disabled');
              } catch (error) {
                toast.error('Failed to update booking status');
              }
            }}
            disabled={isUpdating}
          />
        </div>

        {!bookingEnabled && (
          <div className="p-3 rounded-lg bg-amber/10 border border-amber/20">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Booking is currently disabled</p>
                <p className="mt-1">
                  Your profile shows a "Request Info" button instead of "Book Now". 
                  Patients will need to call your office to schedule.
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Additional Settings */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Booking Rules
          </h4>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Approval</Label>
                <p className="text-xs text-muted-foreground">
                  Manually approve each booking request
                </p>
              </div>
              <Switch
                checked={settings?.booking_require_approval ?? false}
                onCheckedChange={(checked) => {
                  updateSettings({ booking_require_approval: checked });
                }}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Same-Day Booking</Label>
                <p className="text-xs text-muted-foreground">
                  Let patients book appointments for today
                </p>
              </div>
              <Switch
                checked={settings?.allow_same_day_booking ?? false}
                onCheckedChange={(checked) => {
                  updateSettings({ allow_same_day_booking: checked });
                }}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Guest Booking</Label>
                <p className="text-xs text-muted-foreground">
                  Allow booking without login
                </p>
              </div>
              <Switch
                checked={settings?.allow_guest_booking ?? true}
                onCheckedChange={(checked) => {
                  updateSettings({ allow_guest_booking: checked });
                }}
                disabled={isUpdating}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Notifications */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </h4>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Confirmation Emails</Label>
                <p className="text-xs text-muted-foreground">
                  Send booking confirmations to patients
                </p>
              </div>
              <Switch
                checked={settings?.confirmation_email_enabled ?? true}
                onCheckedChange={(checked) => {
                  updateSettings({ confirmation_email_enabled: checked });
                }}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Send reminder texts before appointments
                </p>
              </div>
              <Switch
                checked={settings?.reminder_sms_enabled ?? false}
                onCheckedChange={(checked) => {
                  updateSettings({ reminder_sms_enabled: checked });
                }}
                disabled={isUpdating}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
