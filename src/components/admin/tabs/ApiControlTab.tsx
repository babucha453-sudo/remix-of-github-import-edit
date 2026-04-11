import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  Clock,
  Activity,
  Server,
  MessageSquare,
  Mail,
  Bot,
  CreditCard,
  Eye,
  EyeOff,
  Save,
  Phone,
  Link,
  Key,
  Shield,
  Copy,
  Play,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import { format } from 'date-fns';
import { useApiStatus } from '@/hooks/useApiStatus';

interface APIStatus {
  id: string;
  name: string;
  key: string;
  icon: React.ElementType;
  status: 'connected' | 'error' | 'rate_limited' | 'not_configured' | 'testing';
  lastSync?: string;
  errorMessage?: string;
  isEnabled: boolean;
}

const defaultAPIs: Omit<APIStatus, 'status' | 'lastSync' | 'errorMessage' | 'isEnabled'>[] = [
  { id: 'aimlapi', name: 'AI/ML API Gateway (Primary AI)', key: 'aimlapi', icon: Zap },
  { id: 'google_places', name: 'Google Places API', key: 'google_places', icon: Globe },
  { id: 'google_reviews', name: 'Google Reviews API', key: 'google_reviews', icon: MessageSquare },
  { id: 'whatsapp', name: 'WhatsApp Business API', key: 'whatsapp', icon: MessageSquare },
  { id: 'sms', name: 'SMS Gateway (Twilio)', key: 'sms', icon: Phone },
  { id: 'resend', name: 'Resend Email API', key: 'resend', icon: Mail },
  { id: 'smtp', name: 'Email SMTP (Fallback)', key: 'smtp', icon: Mail },
  { id: 'stripe', name: 'Stripe Payments', key: 'stripe', icon: CreditCard },
  { id: 'search_console', name: 'Google Search Console', key: 'search_console', icon: Activity },
];

export default function ApiControlTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('status');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editingApi, setEditingApi] = useState<string | null>(null);
  const [apiForm, setApiForm] = useState<Record<string, string>>({});
  const { testApi, testResults, isTesting } = useApiStatus();

  // Fetch API settings from global_settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['api-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .in('key', defaultAPIs.map(a => a.key));
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch API logs/errors
  const { data: apiLogs } = useQuery({
    queryKey: ['api-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Update API setting
  const updateApiSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> }) => {
      const existing = settings?.find(s => s.key === key);
      const jsonValue = value as unknown as { [key: string]: string | number | boolean | null };

      if (existing) {
        const { error } = await supabase
          .from('global_settings')
          .update({ value: jsonValue, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert([{ key, value: jsonValue }]);
        if (error) throw error;
      }

      await createAuditLog({
        action: 'UPDATE_API_SETTINGS',
        entityType: 'api_integration',
        entityId: key,
        newValues: { ...jsonValue, api_key: '***REDACTED***' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-settings'] });
      toast.success('API settings updated');
      setEditingApi(null);
      setApiForm({});
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const [currentOrigin, setCurrentOrigin] = useState('');
  useEffect(() => {
    setCurrentOrigin(window.location.origin);
  }, []);

  // Toggle API enabled status
  const toggleApi = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const existing = settings?.find(s => s.key === key);
      const currentValue = (existing?.value as Record<string, unknown>) || {};
      const newValue = { ...currentValue, enabled };

      if (existing) {
        const { error } = await supabase
          .from('global_settings')
          .update({
            value: newValue as { [key: string]: string | number | boolean | null },
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert([{ key, value: { enabled } as { [key: string]: boolean } }]);
        if (error) throw error;
      }

      await createAuditLog({
        action: enabled ? 'ENABLE_API' : 'DISABLE_API',
        entityType: 'api_integration',
        entityId: key,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-settings'] });
      toast.success('API status updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Compute API statuses - use test results if available
  const getApiStatus = (key: string): APIStatus['status'] => {
    // First check test results (most recent)
    if (testResults[key]) {
      return testResults[key].status;
    }

    const setting = settings?.find(s => s.key === key);

    // Special handling for AIMLAPI - it uses secure secrets
    if (key === 'aimlapi') {
      if (setting) {
        const value = setting.value as Record<string, unknown>;
        if (value.last_test_status) {
          return value.last_test_status as APIStatus['status'];
        }
        if (value.uses_secrets && value.secret_key_configured) {
          return 'connected';
        }
      }
      // AIMLAPI_KEY is configured in secrets, so default to connected
      return 'connected';
    }

    if (!setting) return 'not_configured';
    const value = setting.value as Record<string, unknown>;

    // Check stored test status
    if (value.last_test_status) {
      return value.last_test_status as APIStatus['status'];
    }

    // Special handling for Stripe - uses secure secrets
    if (key === 'stripe' && value.uses_secrets && value.secret_key_configured) {
      return 'connected';
    }

    if (!value.api_key && !value.enabled && !value.client_id && !value.access_token && !value.account_sid) {
      return 'not_configured';
    }
    if (value.last_error) return 'error';
    if (value.rate_limited) return 'rate_limited';
    return 'connected';
  };

  const getApiSetting = (key: string) => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value as Record<string, unknown> || {};
  };

  const apiStatuses: APIStatus[] = defaultAPIs.map(api => ({
    ...api,
    status: getApiStatus(api.key),
    lastSync: testResults[api.key]?.timestamp || (getApiSetting(api.key).last_test as string) || (getApiSetting(api.key).last_sync as string) || undefined,
    errorMessage: testResults[api.key]?.message || (getApiSetting(api.key).last_error as string) || undefined,
    isEnabled: (getApiSetting(api.key).enabled as boolean) ?? false,
  }));

  const connectedCount = apiStatuses.filter(a => a.status === 'connected').length;
  const errorCount = apiStatuses.filter(a => a.status === 'error').length;
  const notConfiguredCount = apiStatuses.filter(a => a.status === 'not_configured').length;

  const getStatusBadge = (status: APIStatus['status'], apiKey?: string) => {
    const isCurrentlyTesting = apiKey && isTesting[apiKey];

    if (isCurrentlyTesting) {
      return <Badge className="bg-primary/20 text-primary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing...</Badge>;
    }

    switch (status) {
      case 'connected': return <Badge className="bg-teal/20 text-teal"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'error': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case 'rate_limited': return <Badge className="bg-gold/20 text-gold"><AlertTriangle className="h-3 w-3 mr-1" />Rate Limited</Badge>;
      default: return <Badge variant="secondary">Not Configured</Badge>;
    }
  };

  // Test connection for an API
  const handleTestConnection = async (apiKey: string) => {
    const currentSettings = getApiSetting(apiKey);
    await testApi(apiKey, currentSettings);
    queryClient.invalidateQueries({ queryKey: ['api-settings'] });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Get webhook URL
  const webhookBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

  // Render settings dialog content based on API type
  const renderSettingsDialog = () => {
    if (!editingApi) return null;
    const currentSettings = getApiSetting(editingApi);

    switch (editingApi) {
      case 'aimlapi':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-violet-600 mt-0.5" />
                <div>
                  <p className="font-medium text-violet-900">AI/ML API Gateway (Primary AI Service)</p>
                  <p className="text-sm text-violet-700 mt-1">
                    This is the primary AI gateway used for all AI features including SEO, content generation, review analysis, and more.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-teal/10 border border-teal/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-teal" />
                  <span className="font-medium text-teal">AIMLAPI_KEY</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  API key is securely stored in Lovable Cloud secrets and used by all edge functions for AI processing.
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="font-medium">Supported Models</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded bg-muted/50">gemini-2.0-flash</div>
                  <div className="p-2 rounded bg-muted/50">gemini-2.5-pro</div>
                  <div className="p-2 rounded bg-muted/50">gpt-4o</div>
                  <div className="p-2 rounded bg-muted/50">claude-3-5-sonnet</div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-medium">Used By</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">SEO Expert</Badge>
                  <Badge variant="secondary">SEO Bot</Badge>
                  <Badge variant="secondary">Content Optimizer</Badge>
                  <Badge variant="secondary">AI Assistant</Badge>
                  <Badge variant="secondary">Review Sentiment</Badge>
                  <Badge variant="secondary">AI Reply Generator</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={apiForm.aimlapi_enabled === 'true' || (apiForm.aimlapi_enabled === undefined && ((currentSettings.enabled as boolean) ?? true))}
                  onCheckedChange={(checked) => setApiForm({ ...apiForm, aimlapi_enabled: checked ? 'true' : 'false' })}
                />
                <Label>Enable AI/ML API Integration</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingApi(null)}>Cancel</Button>
              <Button onClick={() => updateApiSetting.mutate({
                key: 'aimlapi',
                value: {
                  uses_secrets: true,
                  secret_key_configured: true,
                  enabled: apiForm.aimlapi_enabled === 'true' || (apiForm.aimlapi_enabled === undefined && ((currentSettings.enabled as boolean) ?? true)),
                }
              })}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        );

      case 'whatsapp':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">WhatsApp Business API Setup</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Configure your WhatsApp Business API credentials from Meta Business Suite.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Access Token</Label>
                <div className="relative">
                  <Input
                    type={showSecrets.whatsapp_token ? 'text' : 'password'}
                    value={apiForm.whatsapp_token ?? (currentSettings.access_token as string) ?? ''}
                    onChange={(e) => setApiForm({ ...apiForm, whatsapp_token: e.target.value })}
                    placeholder="Your WhatsApp access token"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowSecrets({ ...showSecrets, whatsapp_token: !showSecrets.whatsapp_token })}
                  >
                    {showSecrets.whatsapp_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input
                  value={apiForm.whatsapp_phone_id ?? (currentSettings.phone_number_id as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, whatsapp_phone_id: e.target.value })}
                  placeholder="Your WhatsApp Phone Number ID"
                />
              </div>

              <div className="space-y-2">
                <Label>Business Account ID</Label>
                <Input
                  value={apiForm.whatsapp_business_id ?? (currentSettings.business_account_id as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, whatsapp_business_id: e.target.value })}
                  placeholder="Your WhatsApp Business Account ID"
                />
              </div>

              <div className="space-y-2">
                <Label>Verify Token (for webhook)</Label>
                <Input
                  value={apiForm.whatsapp_verify_token ?? (currentSettings.verify_token as string) ?? 'DUBAI_DENTAL_WHATSAPP_VERIFY'}
                  onChange={(e) => setApiForm({ ...apiForm, whatsapp_verify_token: e.target.value })}
                  placeholder="Webhook verification token"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Webhook URL (configure in Meta)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={`${webhookBaseUrl}/whatsapp-webhook`}
                    readOnly
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${webhookBaseUrl}/whatsapp-webhook`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this URL to your WhatsApp Business Platform webhook settings
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={apiForm.whatsapp_enabled === 'true' || (apiForm.whatsapp_enabled === undefined && (currentSettings.enabled as boolean))}
                  onCheckedChange={(checked) => setApiForm({ ...apiForm, whatsapp_enabled: checked ? 'true' : 'false' })}
                />
                <Label>Enable WhatsApp Integration</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingApi(null)}>Cancel</Button>
              <Button onClick={() => updateApiSetting.mutate({
                key: 'whatsapp',
                value: {
                  access_token: apiForm.whatsapp_token || currentSettings.access_token || '',
                  phone_number_id: apiForm.whatsapp_phone_id || currentSettings.phone_number_id || '',
                  business_account_id: apiForm.whatsapp_business_id || currentSettings.business_account_id || '',
                  verify_token: apiForm.whatsapp_verify_token || currentSettings.verify_token || 'DUBAI_DENTAL_WHATSAPP_VERIFY',
                  enabled: apiForm.whatsapp_enabled === 'true' || (apiForm.whatsapp_enabled === undefined && currentSettings.enabled),
                }
              })}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        );

      case 'sms':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Twilio SMS Gateway Setup</p>
                  <p className="text-sm text-green-700 mt-1">
                    Configure your Twilio credentials for SMS notifications.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account SID</Label>
                <Input
                  value={apiForm.twilio_sid ?? (currentSettings.account_sid as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, twilio_sid: e.target.value })}
                  placeholder="Your Twilio Account SID"
                />
              </div>

              <div className="space-y-2">
                <Label>Auth Token</Label>
                <div className="relative">
                  <Input
                    type={showSecrets.twilio_token ? 'text' : 'password'}
                    value={apiForm.twilio_token ?? (currentSettings.auth_token as string) ?? ''}
                    onChange={(e) => setApiForm({ ...apiForm, twilio_token: e.target.value })}
                    placeholder="Your Twilio Auth Token"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowSecrets({ ...showSecrets, twilio_token: !showSecrets.twilio_token })}
                  >
                    {showSecrets.twilio_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Sender Number</Label>
                <Input
                  value={apiForm.twilio_from ?? (currentSettings.from_number as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, twilio_from: e.target.value })}
                  placeholder="+1234567890"
                />
                <p className="text-xs text-muted-foreground">
                  Your Twilio phone number (or use Messaging Service SID)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Messaging Service SID (Optional)</Label>
                <Input
                  value={apiForm.twilio_messaging_sid ?? (currentSettings.messaging_service_sid as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, twilio_messaging_sid: e.target.value })}
                  placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={apiForm.sms_enabled === 'true' || (apiForm.sms_enabled === undefined && (currentSettings.enabled as boolean))}
                  onCheckedChange={(checked) => setApiForm({ ...apiForm, sms_enabled: checked ? 'true' : 'false' })}
                />
                <Label>Enable SMS Integration</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingApi(null)}>Cancel</Button>
              <Button onClick={() => updateApiSetting.mutate({
                key: 'sms',
                value: {
                  account_sid: apiForm.twilio_sid || currentSettings.account_sid || '',
                  auth_token: apiForm.twilio_token || currentSettings.auth_token || '',
                  from_number: apiForm.twilio_from || currentSettings.from_number || '',
                  messaging_service_sid: apiForm.twilio_messaging_sid || currentSettings.messaging_service_sid || '',
                  enabled: apiForm.sms_enabled === 'true' || (apiForm.sms_enabled === undefined && currentSettings.enabled),
                }
              })}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        );

      case 'smtp':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-900">Email SMTP Setup</p>
                  <p className="text-sm text-purple-700 mt-1">
                    Configure your SMTP server for sending emails.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={apiForm.smtp_host ?? (currentSettings.host as string) ?? ''}
                    onChange={(e) => setApiForm({ ...apiForm, smtp_host: e.target.value })}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input
                    value={apiForm.smtp_port ?? (currentSettings.port as string) ?? '587'}
                    onChange={(e) => setApiForm({ ...apiForm, smtp_port: e.target.value })}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={apiForm.smtp_user ?? (currentSettings.username as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, smtp_user: e.target.value })}
                  placeholder="your-email@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showSecrets.smtp_pass ? 'text' : 'password'}
                    value={apiForm.smtp_pass ?? (currentSettings.password as string) ?? ''}
                    onChange={(e) => setApiForm({ ...apiForm, smtp_pass: e.target.value })}
                    placeholder="Your SMTP password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowSecrets({ ...showSecrets, smtp_pass: !showSecrets.smtp_pass })}
                  >
                    {showSecrets.smtp_pass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>From Email</Label>
                <Input
                  value={apiForm.smtp_from ?? (currentSettings.from_email as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, smtp_from: e.target.value })}
                  placeholder="noreply@yourdomain.com"
                />
              </div>

              <div className="space-y-2">
                <Label>From Name</Label>
                <Input
                  value={apiForm.smtp_from_name ?? (currentSettings.from_name as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, smtp_from_name: e.target.value })}
                  placeholder="Appoint Panda"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={apiForm.smtp_enabled === 'true' || (apiForm.smtp_enabled === undefined && (currentSettings.enabled as boolean))}
                  onCheckedChange={(checked) => setApiForm({ ...apiForm, smtp_enabled: checked ? 'true' : 'false' })}
                />
                <Label>Enable Email Integration</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingApi(null)}>Cancel</Button>
              <Button onClick={() => updateApiSetting.mutate({
                key: 'smtp',
                value: {
                  host: apiForm.smtp_host || currentSettings.host || '',
                  port: apiForm.smtp_port || currentSettings.port || '587',
                  username: apiForm.smtp_user || currentSettings.username || '',
                  password: apiForm.smtp_pass || currentSettings.password || '',
                  from_email: apiForm.smtp_from || currentSettings.from_email || '',
                  from_name: apiForm.smtp_from_name || currentSettings.from_name || '',
                  enabled: apiForm.smtp_enabled === 'true' || (apiForm.smtp_enabled === undefined && currentSettings.enabled),
                }
              })}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        );

      case 'google_oauth':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Google OAuth Setup</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Configure your Google OAuth credentials for GMB synchronization.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  value={apiForm.google_client_id ?? (currentSettings.client_id as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, google_client_id: e.target.value })}
                  placeholder="xxx.apps.googleusercontent.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Client Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecrets.google_secret ? 'text' : 'password'}
                    value={apiForm.google_client_secret ?? (currentSettings.client_secret as string) ?? ''}
                    onChange={(e) => setApiForm({ ...apiForm, google_client_secret: e.target.value })}
                    placeholder="Your client secret"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowSecrets({ ...showSecrets, google_secret: !showSecrets.google_secret })}
                  >
                    {showSecrets.google_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Callback URL (configure in Google Cloud Console)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={`${currentOrigin}/auth/callback`}
                    readOnly
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${window.location.origin}/auth/callback`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this URL as an authorized redirect URI in your Google Cloud Console OAuth credentials
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={apiForm.google_oauth_enabled === 'true' || (apiForm.google_oauth_enabled === undefined && (currentSettings.enabled as boolean))}
                  onCheckedChange={(checked) => setApiForm({ ...apiForm, google_oauth_enabled: checked ? 'true' : 'false' })}
                />
                <Label>Enable Google OAuth Integration</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingApi(null)}>Cancel</Button>
              <Button onClick={() => {
                updateApiSetting.mutate({
                  key: 'google_oauth',
                  value: {
                    client_id: apiForm.google_client_id || currentSettings.client_id || '',
                    client_secret: apiForm.google_client_secret || currentSettings.client_secret || '',
                    redirect_uri: `${window.location.origin}/auth/callback`,
                    enabled: apiForm.google_oauth_enabled === 'true' || (apiForm.google_oauth_enabled === undefined && currentSettings.enabled),
                  }
                });
              }}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        );

      case 'stripe':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-violet-50 border border-violet-200">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-violet-600 mt-0.5" />
                <div>
                  <p className="font-medium text-violet-900">Stripe Payment Gateway</p>
                  <p className="text-sm text-violet-700 mt-1">
                    Stripe credentials are securely stored in Lovable Cloud secrets.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-teal/10 border border-teal/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-teal" />
                  <span className="font-medium text-teal">STRIPE_SECRET_KEY</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Secret key is configured securely and used by edge functions for payment processing.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-teal/10 border border-teal/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-teal" />
                  <span className="font-medium text-teal">STRIPE_WEBHOOK_SECRET</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Webhook secret is configured for secure event verification.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Webhook URL (configure in Stripe Dashboard)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={`${webhookBaseUrl}/stripe-webhook`}
                    readOnly
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${webhookBaseUrl}/stripe-webhook`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this URL in your Stripe Dashboard → Developers → Webhooks
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={apiForm.stripe_enabled === 'true' || (apiForm.stripe_enabled === undefined && (currentSettings.enabled as boolean))}
                  onCheckedChange={(checked) => setApiForm({ ...apiForm, stripe_enabled: checked ? 'true' : 'false' })}
                />
                <Label>Enable Stripe Payments</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingApi(null)}>Cancel</Button>
              <Button onClick={() => updateApiSetting.mutate({
                key: 'stripe',
                value: {
                  uses_secrets: true,
                  secret_key_configured: true,
                  webhook_secret_configured: true,
                  enabled: apiForm.stripe_enabled === 'true' || (apiForm.stripe_enabled === undefined && currentSettings.enabled),
                }
              })}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        );

      default:
        // Generic API settings
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key / Token</Label>
                <div className="relative">
                  <Input
                    type={showSecrets[editingApi] ? 'text' : 'password'}
                    value={apiForm[`${editingApi}_key`] ?? (currentSettings.api_key as string) ?? ''}
                    onChange={(e) => setApiForm({ ...apiForm, [`${editingApi}_key`]: e.target.value })}
                    placeholder="Enter API key..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowSecrets({ ...showSecrets, [editingApi]: !showSecrets[editingApi] })}
                  >
                    {showSecrets[editingApi] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Endpoint URL (Optional)</Label>
                <Input
                  value={apiForm[`${editingApi}_url`] ?? (currentSettings.endpoint_url as string) ?? ''}
                  onChange={(e) => setApiForm({ ...apiForm, [`${editingApi}_url`]: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={apiForm[`${editingApi}_enabled`] === 'true' || (apiForm[`${editingApi}_enabled`] === undefined && (currentSettings.enabled as boolean))}
                  onCheckedChange={(checked) => setApiForm({ ...apiForm, [`${editingApi}_enabled`]: checked ? 'true' : 'false' })}
                />
                <Label>Enable Integration</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingApi(null)}>Cancel</Button>
              <Button onClick={() => updateApiSetting.mutate({
                key: editingApi,
                value: {
                  api_key: apiForm[`${editingApi}_key`] || currentSettings.api_key || '',
                  endpoint_url: apiForm[`${editingApi}_url`] || currentSettings.endpoint_url || '',
                  enabled: apiForm[`${editingApi}_enabled`] === 'true' || (apiForm[`${editingApi}_enabled`] === undefined && currentSettings.enabled),
                }
              })}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">API & Integrations</h1>
          <p className="text-muted-foreground mt-1">Monitor and configure external API connections</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['api-settings'] })}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {/* Google OAuth Callback URL */}
      <Card className="card-modern border-primary/20 bg-primary/5 mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Google OAuth Callback URL</p>
                <p className="text-xs text-muted-foreground">Required for GMB OAuth integration</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={`${currentOrigin}/auth/callback`}
                readOnly
                className="w-80 bg-background text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(`${window.location.origin}/auth/callback`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pl-13">
            Add this URL as an authorized redirect URI in your Google Cloud Console OAuth 2.0 credentials
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connectedCount}</p>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <XCircle className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{errorCount}</p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notConfiguredCount}</p>
              <p className="text-sm text-muted-foreground">Not Configured</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{defaultAPIs.length}</p>
              <p className="text-sm text-muted-foreground">Total APIs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="status" className="rounded-xl">
            <Activity className="h-4 w-4 mr-2" />
            Status Overview
          </TabsTrigger>
          <TabsTrigger value="configure" className="rounded-xl">
            <Settings className="h-4 w-4 mr-2" />
            Configure APIs
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl">
            <Clock className="h-4 w-4 mr-2" />
            Error Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg">API Status Dashboard</CardTitle>
              <CardDescription>Real-time status of all external integrations</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>API</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiStatuses.map((api) => {
                    const Icon = api.icon;
                    const testResult = testResults[api.key];
                    return (
                      <TableRow key={api.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{api.name}</p>
                              <p className="text-xs text-muted-foreground">{api.key}</p>
                              {api.status === 'error' && api.errorMessage && (
                                <p className="text-xs text-coral mt-0.5 max-w-xs truncate">
                                  {api.errorMessage}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(api.status, api.key)}
                            {testResult && (
                              <p className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                                {testResult.message}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {api.lastSync ? format(new Date(api.lastSync), 'MMM d, HH:mm') : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={api.isEnabled}
                            onCheckedChange={(checked) => toggleApi.mutate({ key: api.key, enabled: checked })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestConnection(api.key)}
                              disabled={isTesting[api.key]}
                            >
                              {isTesting[api.key] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingApi(api.key)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configure" className="mt-4 space-y-4">
          {apiStatuses.map((api) => {
            const Icon = api.icon;
            const testResult = testResults[api.key];
            return (
              <Card key={api.id} className="card-modern">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{api.name}</CardTitle>
                        <CardDescription>
                          {api.key}
                          {testResult && (
                            <span className={`ml-2 text-xs ${testResult.status === 'connected' ? 'text-teal' :
                              testResult.status === 'error' ? 'text-coral' : 'text-muted-foreground'
                              }`}>
                              — {testResult.message}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(api.status, api.key)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(api.key)}
                        disabled={isTesting[api.key]}
                      >
                        {isTesting[api.key] ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setEditingApi(api.key)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg">API Error Logs</CardTitle>
              <CardDescription>Recent errors from external API calls</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Error Code</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiLogs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">
                        {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{log.error_code || 'UNKNOWN'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{log.error_message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.context_data ? JSON.stringify(log.context_data).slice(0, 50) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!apiLogs || apiLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50 text-teal" />
                        <p>No recent API errors</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={!!editingApi} onOpenChange={(open) => !open && setEditingApi(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configure {defaultAPIs.find(a => a.key === editingApi)?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your API credentials to enable this integration
            </DialogDescription>
          </DialogHeader>
          {renderSettingsDialog()}
        </DialogContent>
      </Dialog>
    </div>
  );
}