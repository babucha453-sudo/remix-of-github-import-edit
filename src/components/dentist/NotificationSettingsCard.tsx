import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  FileText,
  Star,
  CheckCircle,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationSettingsCardProps {
  clinicId: string;
}

interface NotificationSettings {
  notification_email: string | null;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  notify_new_appointment: boolean;
  notify_appointment_reminder: boolean;
  notify_form_submission: boolean;
  notify_new_review: boolean;
  notify_negative_feedback: boolean;
  reminder_1_day: boolean;
  reminder_3_hours: boolean;
}

export default function NotificationSettingsCard({ clinicId }: NotificationSettingsCardProps) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<NotificationSettings>({
    notification_email: '',
    email_enabled: true,
    sms_enabled: false,
    whatsapp_enabled: false,
    notify_new_appointment: true,
    notify_appointment_reminder: true,
    notify_form_submission: true,
    notify_new_review: true,
    notify_negative_feedback: true,
    reminder_1_day: true,
    reminder_3_hours: true,
  });

  // Fetch current settings
  const { data: automationSettings, isLoading } = useQuery({
    queryKey: ['clinic-automation-settings', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_automation_settings')
        .select('*')
        .eq('clinic_id', clinicId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Initialize settings from database
  useEffect(() => {
    if (automationSettings) {
      const config = (automationSettings as any).notification_config || {};
      setSettings({
        notification_email: config.notification_email || '',
        email_enabled: config.email_enabled ?? true,
        sms_enabled: config.sms_enabled ?? false,
        whatsapp_enabled: config.whatsapp_enabled ?? false,
        notify_new_appointment: config.notify_new_appointment ?? true,
        notify_appointment_reminder: config.notify_appointment_reminder ?? true,
        notify_form_submission: config.notify_form_submission ?? true,
        notify_new_review: config.notify_new_review ?? true,
        notify_negative_feedback: config.notify_negative_feedback ?? true,
        reminder_1_day: automationSettings.reminder_1_day ?? true,
        reminder_3_hours: automationSettings.reminder_3_hours ?? true,
      });
    }
  }, [automationSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      const updateData = {
        clinic_id: clinicId,
        reminder_1_day: newSettings.reminder_1_day,
        reminder_3_hours: newSettings.reminder_3_hours,
        is_messaging_enabled: newSettings.email_enabled || newSettings.sms_enabled || newSettings.whatsapp_enabled,
        reminder_channel: newSettings.whatsapp_enabled ? 'whatsapp' : newSettings.sms_enabled ? 'sms' : 'email',
      };

      // Check if record exists
      if (automationSettings) {
        const { error } = await supabase
          .from('clinic_automation_settings')
          .update(updateData)
          .eq('clinic_id', clinicId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clinic_automation_settings')
          .insert(updateData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Notification settings saved');
      queryClient.invalidateQueries({ queryKey: ['clinic-automation-settings', clinicId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg overflow-hidden">
      {/* Accent bar */}
      <div className="h-1 bg-gold" />
      
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gold/20 flex items-center justify-center">
            <Bell className="h-4 w-4 text-gold" />
          </div>
          Notification Preferences
        </CardTitle>
        <CardDescription className="text-white/60">
          Choose how you receive alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Notification Email */}
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Notification Email</Label>
          <Input
            type="email"
            placeholder="your@email.com"
            value={settings.notification_email || ''}
            onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
            className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-white/40"
          />
        </div>

        <Separator className="bg-slate-700/50" />

        {/* Notification Channels */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Channels</h4>
          
          <div className="grid grid-cols-3 gap-2">
            <div 
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                settings.email_enabled 
                  ? 'bg-teal/20 border-teal/40' 
                  : 'bg-slate-700/30 border-slate-600/30'
              }`}
              onClick={() => setSettings({ ...settings, email_enabled: !settings.email_enabled })}
            >
              <div className="flex items-center justify-between mb-1">
                <Mail className={`h-4 w-4 ${settings.email_enabled ? 'text-teal' : 'text-white/40'}`} />
                {settings.email_enabled && <CheckCircle className="h-3 w-3 text-teal" />}
              </div>
              <p className={`text-xs font-medium ${settings.email_enabled ? 'text-white' : 'text-white/40'}`}>Email</p>
            </div>

            <div 
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                settings.sms_enabled 
                  ? 'bg-primary/20 border-primary/40' 
                  : 'bg-slate-700/30 border-slate-600/30'
              }`}
              onClick={() => setSettings({ ...settings, sms_enabled: !settings.sms_enabled })}
            >
              <div className="flex items-center justify-between mb-1">
                <Phone className={`h-4 w-4 ${settings.sms_enabled ? 'text-primary' : 'text-white/40'}`} />
                {settings.sms_enabled && <CheckCircle className="h-3 w-3 text-teal" />}
              </div>
              <p className={`text-xs font-medium ${settings.sms_enabled ? 'text-white' : 'text-white/40'}`}>SMS</p>
            </div>

            <div 
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                settings.whatsapp_enabled 
                  ? 'bg-emerald-500/20 border-emerald-500/40' 
                  : 'bg-slate-700/30 border-slate-600/30'
              }`}
              onClick={() => setSettings({ ...settings, whatsapp_enabled: !settings.whatsapp_enabled })}
            >
              <div className="flex items-center justify-between mb-1">
                <MessageSquare className={`h-4 w-4 ${settings.whatsapp_enabled ? 'text-emerald-400' : 'text-white/40'}`} />
                {settings.whatsapp_enabled && <CheckCircle className="h-3 w-3 text-teal" />}
              </div>
              <p className={`text-xs font-medium ${settings.whatsapp_enabled ? 'text-white' : 'text-white/40'}`}>WhatsApp</p>
            </div>
          </div>
        </div>

        <Separator className="bg-slate-700/50" />

        {/* Notification Types */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Notify me about</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm text-white">New Appointments</span>
              </div>
              <Switch
                checked={settings.notify_new_appointment}
                onCheckedChange={(checked) => setSettings({ ...settings, notify_new_appointment: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-gold" />
                <span className="text-sm text-white">Form Submissions</span>
              </div>
              <Switch
                checked={settings.notify_form_submission}
                onCheckedChange={(checked) => setSettings({ ...settings, notify_form_submission: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
              <div className="flex items-center gap-3">
                <Star className="h-4 w-4 text-teal" />
                <span className="text-sm text-white">New Reviews</span>
              </div>
              <Switch
                checked={settings.notify_new_review}
                onCheckedChange={(checked) => setSettings({ ...settings, notify_new_review: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-coral/10 border border-coral/30">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-coral" />
                <span className="text-sm text-white">Negative Feedback</span>
              </div>
              <Switch
                checked={settings.notify_negative_feedback}
                onCheckedChange={(checked) => setSettings({ ...settings, notify_negative_feedback: checked })}
              />
            </div>
          </div>
        </div>

        <Separator className="bg-slate-700/50" />

        {/* Appointment Reminders */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Patient Reminders</h4>
          
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant="outline" 
              className={`cursor-pointer transition-all ${
                settings.reminder_1_day 
                  ? 'bg-teal/20 border-teal/40 text-teal' 
                  : 'bg-slate-700/30 border-slate-600/30 text-white/50'
              }`}
              onClick={() => setSettings({ ...settings, reminder_1_day: !settings.reminder_1_day })}
            >
              {settings.reminder_1_day && <CheckCircle className="h-3 w-3 mr-1" />}
              1 Day Before
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer transition-all ${
                settings.reminder_3_hours 
                  ? 'bg-teal/20 border-teal/40 text-teal' 
                  : 'bg-slate-700/30 border-slate-600/30 text-white/50'
              }`}
              onClick={() => setSettings({ ...settings, reminder_3_hours: !settings.reminder_3_hours })}
            >
              {settings.reminder_3_hours && <CheckCircle className="h-3 w-3 mr-1" />}
              3 Hours Before
            </Badge>
          </div>
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          className="w-full bg-teal hover:bg-teal/90 text-white font-bold"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}