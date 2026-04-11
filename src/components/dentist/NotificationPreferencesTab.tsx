import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useDentistClinic } from '@/hooks/useDentistClinic';
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  FileText,
  XCircle,
  Send,
  Save,
  TestTube,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface NotificationSettings {
  // Notification Types
  notification_new_appointment: boolean;
  notification_form_submission: boolean;
  notification_cancellation: boolean;
  notification_message: boolean;
  // Channels
  notification_channel_email: boolean;
  notification_channel_whatsapp: boolean;
  notification_channel_dashboard: boolean;
  // Destinations
  notification_email_secondary: string | null;
  notification_whatsapp_number: string | null;
  // Existing fields
  reminder_sms_enabled: boolean | null;
  confirmation_email_enabled: boolean | null;
}

export default function NotificationPreferencesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: clinic, isLoading: clinicLoading } = useDentistClinic();

  const [settings, setSettings] = useState<NotificationSettings>({
    notification_new_appointment: true,
    notification_form_submission: true,
    notification_cancellation: true,
    notification_message: true,
    notification_channel_email: true,
    notification_channel_whatsapp: false,
    notification_channel_dashboard: true,
    notification_email_secondary: null,
    notification_whatsapp_number: null,
    reminder_sms_enabled: true,
    confirmation_email_enabled: true,
  });

  const { data: dentistSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['dentist-notification-settings', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dentist_settings')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  useEffect(() => {
    if (dentistSettings) {
      setSettings({
        notification_new_appointment: dentistSettings.notification_new_appointment ?? true,
        notification_form_submission: dentistSettings.notification_form_submission ?? true,
        notification_cancellation: dentistSettings.notification_cancellation ?? true,
        notification_message: dentistSettings.notification_message ?? true,
        notification_channel_email: dentistSettings.notification_channel_email ?? true,
        notification_channel_whatsapp: dentistSettings.notification_channel_whatsapp ?? false,
        notification_channel_dashboard: dentistSettings.notification_channel_dashboard ?? true,
        notification_email_secondary: dentistSettings.notification_email_secondary ?? null,
        notification_whatsapp_number: dentistSettings.notification_whatsapp_number ?? null,
        reminder_sms_enabled: dentistSettings.reminder_sms_enabled ?? true,
        confirmation_email_enabled: dentistSettings.confirmation_email_enabled ?? true,
      });
    }
  }, [dentistSettings]);

  const saveSettings = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      const { data: existing } = await supabase
        .from('dentist_settings')
        .select('id')
        .eq('clinic_id', clinic?.id)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('dentist_settings')
          .update(newSettings)
          .eq('clinic_id', clinic?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dentist_settings')
          .insert({ clinic_id: clinic?.id, ...newSettings });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Notification preferences saved');
      queryClient.invalidateQueries({ queryKey: ['dentist-notification-settings'] });
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  const sendTestNotification = useMutation({
    mutationFn: async (channel: 'email' | 'whatsapp') => {
      const destination = channel === 'email' 
        ? (settings.notification_email_secondary || user?.email)
        : settings.notification_whatsapp_number;

      if (!destination) {
        throw new Error(`No ${channel} destination configured`);
      }

      const { error } = await supabase.functions.invoke('send-review-request', {
        body: {
          to: destination,
          type: channel === 'email' ? 'email' : 'whatsapp',
          subject: 'Test Notification from AppointPanda',
          html: `<p>This is a test notification from AppointPanda.</p><p>Your notification preferences are working correctly!</p>`,
          message: 'This is a test notification from AppointPanda. Your preferences are working correctly!',
        },
      });

      if (error) throw error;
    },
    onSuccess: (_, channel) => {
      toast.success(`Test ${channel} sent successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleToggle = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleInputChange = (key: keyof NotificationSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value || null }));
  };

  if (clinicLoading || settingsLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!clinic) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Practice Linked</h3>
          <p className="text-muted-foreground">
            You need to claim or create a practice to configure notifications
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notifications & Communication Preferences
        </h2>
        <p className="text-muted-foreground">
          Control how and when you receive notifications about appointments and patients
        </p>
      </div>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Types</CardTitle>
          <CardDescription>Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">New Appointment Request</p>
                <p className="text-sm text-muted-foreground">When a patient books or requests an appointment</p>
              </div>
            </div>
            <Switch
              checked={settings.notification_new_appointment}
              onCheckedChange={(checked) => handleToggle('notification_new_appointment', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-light flex items-center justify-center">
                <FileText className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="font-medium">Form Submission Received</p>
                <p className="text-sm text-muted-foreground">When a patient completes an intake form</p>
              </div>
            </div>
            <Switch
              checked={settings.notification_form_submission}
              onCheckedChange={(checked) => handleToggle('notification_form_submission', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-coral-light flex items-center justify-center">
                <XCircle className="h-5 w-5 text-coral" />
              </div>
              <div>
                <p className="font-medium">Appointment Cancellation</p>
                <p className="text-sm text-muted-foreground">When a patient cancels their appointment</p>
              </div>
            </div>
            <Switch
              checked={settings.notification_cancellation}
              onCheckedChange={(checked) => handleToggle('notification_cancellation', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold-light flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="font-medium">Message Received</p>
                <p className="text-sm text-muted-foreground">When you receive a message from a patient</p>
              </div>
            </div>
            <Switch
              checked={settings.notification_message}
              onCheckedChange={(checked) => handleToggle('notification_message', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Communication Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Communication Channels</CardTitle>
          <CardDescription>Select how you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
            </div>
            <Switch
              checked={settings.notification_channel_email}
              onCheckedChange={(checked) => handleToggle('notification_channel_email', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-sm text-muted-foreground">Receive notifications via WhatsApp</p>
              </div>
            </div>
            <Switch
              checked={settings.notification_channel_whatsapp}
              onCheckedChange={(checked) => handleToggle('notification_channel_whatsapp', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Bell className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Dashboard Alerts</p>
                <p className="text-sm text-muted-foreground">See notifications in your dashboard</p>
              </div>
            </div>
            <Switch
              checked={settings.notification_channel_dashboard}
              onCheckedChange={(checked) => handleToggle('notification_channel_dashboard', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Destination Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Destinations</CardTitle>
          <CardDescription>Configure where notifications are sent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Primary Email</Label>
            <Input
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              This is your login email and cannot be changed here
            </p>
          </div>

          <div className="space-y-2">
            <Label>Secondary Email (Optional)</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="backup@example.com"
                value={settings.notification_email_secondary || ''}
                onChange={(e) => handleInputChange('notification_email_secondary', e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => sendTestNotification.mutate('email')}
                disabled={sendTestNotification.isPending}
                title="Send test email"
              >
                <TestTube className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Notifications will be sent to both primary and secondary email
            </p>
          </div>

          <div className="space-y-2">
            <Label>WhatsApp Number</Label>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="+1 234 567 8900"
                value={settings.notification_whatsapp_number || ''}
                onChange={(e) => handleInputChange('notification_whatsapp_number', e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => sendTestNotification.mutate('whatsapp')}
                disabled={sendTestNotification.isPending || !settings.notification_whatsapp_number}
                title="Send test WhatsApp"
              >
                <TestTube className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +1 for US)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Patient Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Patient Notifications</CardTitle>
          <CardDescription>Control what patients receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Confirmation Email</p>
              <p className="text-sm text-muted-foreground">Send confirmation when booking is confirmed</p>
            </div>
            <Switch
              checked={settings.confirmation_email_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('confirmation_email_enabled', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">SMS Reminders</p>
              <p className="text-sm text-muted-foreground">Send reminder before appointment</p>
            </div>
            <Switch
              checked={settings.reminder_sms_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('reminder_sms_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => {
            if (dentistSettings) {
              setSettings({
                notification_new_appointment: dentistSettings.notification_new_appointment ?? true,
                notification_form_submission: dentistSettings.notification_form_submission ?? true,
                notification_cancellation: dentistSettings.notification_cancellation ?? true,
                notification_message: dentistSettings.notification_message ?? true,
                notification_channel_email: dentistSettings.notification_channel_email ?? true,
                notification_channel_whatsapp: dentistSettings.notification_channel_whatsapp ?? false,
                notification_channel_dashboard: dentistSettings.notification_channel_dashboard ?? true,
                notification_email_secondary: dentistSettings.notification_email_secondary ?? null,
                notification_whatsapp_number: dentistSettings.notification_whatsapp_number ?? null,
                reminder_sms_enabled: dentistSettings.reminder_sms_enabled ?? true,
                confirmation_email_enabled: dentistSettings.confirmation_email_enabled ?? true,
              });
            }
          }}
        >
          Reset
        </Button>
        <Button
          onClick={() => saveSettings.mutate(settings)}
          disabled={saveSettings.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveSettings.isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
