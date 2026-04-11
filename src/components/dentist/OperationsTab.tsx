import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClinicSubscription, useHasFeature } from '@/hooks/useClinicFeatures';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Bell,
  MessageSquare,
  Zap,
  Clock,
  Save,
  Mail,
  Phone,
  CheckCircle,
  AlertCircle,
  Globe,
  RefreshCw,
  Lock,
  Crown,
} from 'lucide-react';
import { NoPracticeLinked } from './NoPracticeLinked';
import UpgradePrompt from '@/components/subscription/UpgradePrompt';

interface AutomationSettings {
  id: string;
  clinic_id: string;
  reminder_2_days: boolean;
  reminder_1_day: boolean;
  reminder_3_hours: boolean;
  reminder_channel: string;
  followup_enabled: boolean;
  review_request_enabled: boolean;
  is_messaging_enabled: boolean;
  daily_message_limit: number;
}

interface CrmNumber {
  id: string;
  phone_number: string;
  provider: string;
  is_active: boolean;
  is_whatsapp_enabled: boolean;
}

export default function OperationsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('reminders');
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-operations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, google_place_id')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch or create automation settings
  const { data: automationSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['clinic-automation-settings', clinic?.id],
    queryFn: async () => {
      // Try to fetch existing
      const { data, error } = await supabase
        .from('clinic_automation_settings')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Create default settings
        const { data: newData, error: createError } = await supabase
          .from('clinic_automation_settings')
          .insert({ clinic_id: clinic?.id })
          .select()
          .single();

        if (createError) throw createError;
        setSettings(newData);
        return newData as AutomationSettings;
      }

      if (error) throw error;
      setSettings(data);
      return data as AutomationSettings;
    },
    enabled: !!clinic?.id,
  });

  // Fetch CRM number
  const { data: crmNumber } = useQuery({
    queryKey: ['clinic-crm-number', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_numbers')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as CrmNumber | null;
    },
    enabled: !!clinic?.id,
  });

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!settings || !clinic?.id) throw new Error('No settings');

      const { error } = await supabase
        .from('clinic_automation_settings')
        .update({
          reminder_2_days: settings.reminder_2_days,
          reminder_1_day: settings.reminder_1_day,
          reminder_3_hours: settings.reminder_3_hours,
          reminder_channel: settings.reminder_channel,
          followup_enabled: settings.followup_enabled,
          review_request_enabled: settings.review_request_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinic.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-automation-settings'] });
      toast.success('Settings saved');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  };

  // Check feature access
  const { data: subscription } = useClinicSubscription(clinic?.id);
  const { hasAccess: hasSmsReminders } = useHasFeature(clinic?.id, 'sms_reminders');
  const { hasAccess: hasGmbSync } = useHasFeature(clinic?.id, 'gmb_sync');
  
  const planName = subscription?.plan?.name || 'Free';
  const isPaidPlan = planName !== 'Free' && planName !== 'Basic';

  if (clinicLoading || settingsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  // Show upgrade prompt if not on paid plan
  if (!isPaidPlan) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Operations & Automation</h2>
          <p className="text-muted-foreground">Automation & communication settings</p>
        </div>
        
        <UpgradePrompt 
          featureName="Automation Suite"
          requiredPlan="professional"
          clinicId={clinic.id}
        />
        
        {/* Preview of features (locked) */}
        <div className="grid md:grid-cols-3 gap-4 opacity-60 pointer-events-none">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Appointment Reminders
                <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Auto-send reminders 2 days, 1 day, and 3 hours before appointments</p>
            </CardContent>
          </Card>
          
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-teal" />
                Follow-up Messages
                <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Automatic thank you messages and review requests</p>
            </CardContent>
          </Card>
          
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                GMB Sync
                <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Keep your profile synced with Google Business</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Operations</h2>
          <p className="text-muted-foreground">Automation & communication settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Crown className="h-3 w-3 mr-1" />
            {planName}
          </Badge>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>

      {/* CRM Number Status */}
      <Card className={crmNumber ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                crmNumber ? 'bg-green-100' : 'bg-amber-100'
              }`}>
                <Phone className={`h-5 w-5 ${crmNumber ? 'text-green-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="font-medium">
                  {crmNumber ? 'CRM Number Active' : 'No CRM Number Assigned'}
                </p>
                {crmNumber ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{crmNumber.phone_number}</span>
                    {crmNumber.is_whatsapp_enabled && (
                      <Badge variant="secondary" className="text-xs">WhatsApp</Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Contact admin to get a dedicated number for SMS/WhatsApp
                  </p>
                )}
              </div>
            </div>
            {crmNumber ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="reminders" className="rounded-xl">
            <Bell className="h-4 w-4 mr-2" />
            Reminders
          </TabsTrigger>
          <TabsTrigger value="followup" className="rounded-xl">
            <MessageSquare className="h-4 w-4 mr-2" />
            Follow-up
          </TabsTrigger>
          <TabsTrigger value="gmb" className="rounded-xl">
            <Globe className="h-4 w-4 mr-2" />
            GMB Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reminders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Appointment Reminders
              </CardTitle>
              <CardDescription>
                Automatically remind patients about their upcoming appointments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">2 Days Before</p>
                      <p className="text-sm text-muted-foreground">
                        Send reminder 48 hours before appointment
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.reminder_2_days || false}
                    onCheckedChange={(checked) =>
                      setSettings((s) => s ? { ...s, reminder_2_days: checked } : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">1 Day Before</p>
                      <p className="text-sm text-muted-foreground">
                        Send reminder 24 hours before appointment
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.reminder_1_day || false}
                    onCheckedChange={(checked) =>
                      setSettings((s) => s ? { ...s, reminder_1_day: checked } : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">3 Hours Before</p>
                      <p className="text-sm text-muted-foreground">
                        Send final reminder 3 hours before
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.reminder_3_hours || false}
                    onCheckedChange={(checked) =>
                      setSettings((s) => s ? { ...s, reminder_3_hours: checked } : null)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reminder Channel</Label>
                <Select
                  value={settings?.reminder_channel || 'sms'}
                  onValueChange={(value) =>
                    setSettings((s) => s ? { ...s, reminder_channel: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Only</SelectItem>
                    <SelectItem value="sms">SMS Only</SelectItem>
                    <SelectItem value="whatsapp" disabled={!crmNumber?.is_whatsapp_enabled}>
                      WhatsApp Only
                    </SelectItem>
                    <SelectItem value="email_sms">Email + SMS</SelectItem>
                    <SelectItem value="all" disabled={!crmNumber?.is_whatsapp_enabled}>
                      All Channels
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Email is always available. SMS/WhatsApp require a CRM number.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Follow-up Automation
              </CardTitle>
              <CardDescription>
                Automatic follow-up messages after appointments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium">Post-Appointment Follow-up</p>
                    <p className="text-sm text-muted-foreground">
                      Send a thank you message after completed appointments
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings?.followup_enabled || false}
                  onCheckedChange={(checked) =>
                    setSettings((s) => s ? { ...s, followup_enabled: checked } : null)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gold-light flex items-center justify-center">
                    <Zap className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-medium">Review Request</p>
                    <p className="text-sm text-muted-foreground">
                      Send review link after positive appointment feedback
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings?.review_request_enabled || false}
                  onCheckedChange={(checked) =>
                    setSettings((s) => s ? { ...s, review_request_enabled: checked } : null)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gmb" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Google My Business Sync
              </CardTitle>
              <CardDescription>
                Keep your profile in sync with Google Business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Google Place ID</p>
                      <p className="text-sm text-muted-foreground">
                        {clinic.google_place_id || 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {clinic.google_place_id ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
              </div>

              {clinic.google_place_id && (
                <Button className="w-full" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              )}

              <p className="text-sm text-muted-foreground">
                GMB sync updates your profile with the latest hours, photos, and reviews from Google.
                Set your Google Place ID in the Profile tab.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
