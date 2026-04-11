import { useState, forwardRef, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Mail, 
  Globe, 
  Key, 
  CreditCard, 
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Database,
  Bot,
  Copy,
  ExternalLink,
  Search,
  BarChart3,
  Code,
  Image,
  Palette,
  Upload,
  X,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import { PlatformVerificationsPanel } from '@/components/admin/settings/PlatformVerificationsPanel';

interface GlobalSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
}

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['global-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings' as any)
        .select('*')
        .order('key');
      if (error) throw error;
      return (data || []) as unknown as GlobalSetting[];
    },
  });

  // State for form values
  const [formValues, setFormValues] = useState<Record<string, Record<string, unknown>>>({});

  // Initialize form values from settings
  const getSettingValue = (key: string) => {
    if (formValues[key]) return formValues[key];
    const setting = settings?.find(s => s.key === key);
    return setting?.value || {};
  };

  const updateFormValue = (key: string, field: string, value: unknown) => {
    setFormValues(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || getSettingValue(key)),
        [field]: value,
      },
    }));
  };

  // Save setting mutation
  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> }) => {
      const existing = settings?.find(s => s.key === key);
      
      if (existing) {
        const { error } = await (supabase
          .from('global_settings' as any) as any)
          .update({ value, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('global_settings' as any) as any)
          .insert([{ key, value }]);
        if (error) throw error;
      }
      
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'global_settings',
        entityId: key,
        newValues: value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
      toast.success('Settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = (key: string) => {
    const value = formValues[key] || getSettingValue(key);
    saveSetting.mutate({ key, value });
  };

  const toggleShowSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const renderSecretInput = (key: string, field: string, label: string, placeholder: string) => {
    const value = getSettingValue(key);
    const fieldValue = (value[field] as string) || '';
    const isVisible = showSecrets[`${key}.${field}`];
    
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="relative">
          <Input
            type={isVisible ? 'text' : 'password'}
            value={fieldValue}
            onChange={(e) => updateFormValue(key, field, e.target.value)}
            placeholder={placeholder}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-7 w-7 p-0"
            onClick={() => toggleShowSecret(`${key}.${field}`)}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-display font-bold text-foreground">Global Settings</h1>
          <p className="text-muted-foreground mt-1">Configure integrations and platform settings</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 rounded-xl">
          <TabsTrigger value="general" className="rounded-xl">General</TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-xl">Integrations</TabsTrigger>
          <TabsTrigger value="verifications" className="rounded-xl flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Verify
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-xl">Email / SMTP</TabsTrigger>
          <TabsTrigger value="google" className="rounded-xl">Google APIs</TabsTrigger>
          <TabsTrigger value="payment" className="rounded-xl">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Platform Settings
              </CardTitle>
              <CardDescription>General platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input
                  value={(getSettingValue('platform')?.site_name as string) || 'Appoint Panda'}
                  onChange={(e) => updateFormValue('platform', 'site_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Site URL</Label>
                <Input
                  value={(getSettingValue('platform')?.site_url as string) || ''}
                  onChange={(e) => updateFormValue('platform', 'site_url', e.target.value)}
                  placeholder="https://appointpanda.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input
                  value={(getSettingValue('platform')?.support_email as string) || ''}
                  onChange={(e) => updateFormValue('platform', 'support_email', e.target.value)}
                  placeholder="support@appointpanda.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Verification Fee (USD)</Label>
                <Input
                  type="number"
                  value={(getSettingValue('platform')?.verification_fee as number) || 49}
                  onChange={(e) => updateFormValue('platform', 'verification_fee', parseInt(e.target.value))}
                />
              </div>
              <Button onClick={() => handleSave('platform')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Platform Settings
              </Button>
            </CardContent>
          </Card>

          {/* Branding - Logo & Favicon */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding
              </CardTitle>
              <CardDescription>Customize your site logo and favicon - upload images or provide URLs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Logo */}
                <div className="space-y-3">
                  <Label>Site Logo</Label>
                  <div className="flex gap-2">
                    <Input
                      value={(getSettingValue('branding')?.logo_url as string) || ''}
                      onChange={(e) => updateFormValue('branding', 'logo_url', e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="flex-1"
                    />
                    <div className="relative">
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingField('logo');
                          try {
                            const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`;
                            const { data, error } = await supabase.storage
                              .from('site-branding')
                              .upload(fileName, file, { upsert: true });
                            if (error) throw error;
                            const { data: urlData } = supabase.storage
                              .from('site-branding')
                              .getPublicUrl(data.path);
                            updateFormValue('branding', 'logo_url', urlData.publicUrl);
                            toast.success('Logo uploaded successfully');
                          } catch (err: any) {
                            toast.error('Upload failed: ' + err.message);
                          } finally {
                            setUploadingField(null);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={uploadingField === 'logo'}
                        onClick={() => document.getElementById('logo-upload')?.click()}
                      >
                        {uploadingField === 'logo' ? (
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: PNG or SVG, 200x60px
                  </p>
                  {(getSettingValue('branding')?.logo_url as string) && (
                    <div className="p-4 border border-border rounded-xl bg-muted/30 relative group">
                      <img 
                        src={getSettingValue('branding')?.logo_url as string} 
                        alt="Site Logo Preview" 
                        className="max-h-12 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => updateFormValue('branding', 'logo_url', '')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Favicon */}
                <div className="space-y-3">
                  <Label>Favicon</Label>
                  <div className="flex gap-2">
                    <Input
                      value={(getSettingValue('branding')?.favicon_url as string) || ''}
                      onChange={(e) => updateFormValue('branding', 'favicon_url', e.target.value)}
                      placeholder="https://example.com/favicon.ico"
                      className="flex-1"
                    />
                    <div className="relative">
                      <input
                        type="file"
                        id="favicon-upload"
                        accept="image/png,image/x-icon,image/ico,image/webp"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingField('favicon');
                          try {
                            const fileName = `favicon-${Date.now()}.${file.name.split('.').pop()}`;
                            const { data, error } = await supabase.storage
                              .from('site-branding')
                              .upload(fileName, file, { upsert: true });
                            if (error) throw error;
                            const { data: urlData } = supabase.storage
                              .from('site-branding')
                              .getPublicUrl(data.path);
                            updateFormValue('branding', 'favicon_url', urlData.publicUrl);
                            toast.success('Favicon uploaded successfully');
                          } catch (err: any) {
                            toast.error('Upload failed: ' + err.message);
                          } finally {
                            setUploadingField(null);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={uploadingField === 'favicon'}
                        onClick={() => document.getElementById('favicon-upload')?.click()}
                      >
                        {uploadingField === 'favicon' ? (
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: ICO or PNG, 32x32px or 64x64px
                  </p>
                  {(getSettingValue('branding')?.favicon_url as string) && (
                    <div className="p-4 border border-border rounded-xl bg-muted/30 flex items-center gap-3 relative group">
                      <img 
                        src={getSettingValue('branding')?.favicon_url as string} 
                        alt="Favicon Preview" 
                        className="w-8 h-8 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-sm text-muted-foreground">Favicon preview</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => updateFormValue('branding', 'favicon_url', '')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Dark Mode Logo */}
              <div className="space-y-3">
                <Label>Dark Mode Logo (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={(getSettingValue('branding')?.logo_dark_url as string) || ''}
                    onChange={(e) => updateFormValue('branding', 'logo_dark_url', e.target.value)}
                    placeholder="https://example.com/logo-dark.png"
                    className="flex-1"
                  />
                  <div className="relative">
                    <input
                      type="file"
                      id="logo-dark-upload"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingField('logo_dark');
                        try {
                          const fileName = `logo-dark-${Date.now()}.${file.name.split('.').pop()}`;
                          const { data, error } = await supabase.storage
                            .from('site-branding')
                            .upload(fileName, file, { upsert: true });
                          if (error) throw error;
                          const { data: urlData } = supabase.storage
                            .from('site-branding')
                            .getPublicUrl(data.path);
                          updateFormValue('branding', 'logo_dark_url', urlData.publicUrl);
                          toast.success('Dark mode logo uploaded successfully');
                        } catch (err: any) {
                          toast.error('Upload failed: ' + err.message);
                        } finally {
                          setUploadingField(null);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={uploadingField === 'logo_dark'}
                      onClick={() => document.getElementById('logo-dark-upload')?.click()}
                    >
                      {uploadingField === 'logo_dark' ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional: Logo for dark mode. If not set, the main logo will be used.
                </p>
                {(getSettingValue('branding')?.logo_dark_url as string) && (
                  <div className="p-4 border border-border rounded-xl bg-slate-800 relative group">
                    <img 
                      src={getSettingValue('branding')?.logo_dark_url as string} 
                      alt="Dark Mode Logo Preview" 
                      className="max-h-12 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      onClick={() => updateFormValue('branding', 'logo_dark_url', '')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <Button onClick={() => handleSave('branding')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Branding Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Legal & Compliance
              </CardTitle>
              <CardDescription>Configure copyright and legal text displayed in footer and across the site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Copyright Text</Label>
                <Input
                  value={(getSettingValue('legal')?.copyright_text as string) || ''}
                  onChange={(e) => updateFormValue('legal', 'copyright_text', e.target.value)}
                  placeholder="© 2026 AppointPanda. All rights reserved by Quick Commerce LLC."
                />
                <p className="text-xs text-muted-foreground">Displays in the footer bottom bar (e.g., "© 2026 AppointPanda...")</p>
              </div>
              <div className="space-y-2">
                <Label>Footer Legal Text</Label>
                <Textarea
                  value={(getSettingValue('legal')?.footer_text as string) || ''}
                  onChange={(e) => updateFormValue('legal', 'footer_text', e.target.value)}
                  placeholder="Licensed Dental Professionals Only."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">Additional legal disclaimer shown after copyright text</p>
              </div>
              <div className="space-y-2">
                <Label>Unsubscribe Policy</Label>
                <Textarea
                  value={(getSettingValue('legal')?.unsubscribe_policy as string) || ''}
                  onChange={(e) => updateFormValue('legal', 'unsubscribe_policy', e.target.value)}
                  placeholder="You can unsubscribe at any time..."
                  rows={3}
                />
              </div>
              <Button onClick={() => handleSave('legal')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Legal Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          {/* Google Search Console Verification */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Google Search Console
              </CardTitle>
              <CardDescription>Add verification codes to verify site ownership with Google Search Console. You can use multiple verification methods.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Verification Code */}
              <div className="p-4 border border-border rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-teal/10 text-teal border-teal/30">Primary</Badge>
                  <span className="text-sm font-medium">Meta Tag Verification #1</span>
                </div>
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    value={(getSettingValue('google_search_console')?.verification_code as string) || 'QXeUyCI6vHRD4bv5ZLJCYQVSvESe4uqju4tWaamlr2A'}
                    onChange={(e) => updateFormValue('google_search_console', 'verification_code', e.target.value)}
                    placeholder="e.g., QXeUyCI6vHRD4bv5ZLJCYQVSvESe4uqju4tWaamlr2A"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-teal" />
                  <span>Active in index.html</span>
                </div>
              </div>

              {/* Secondary Verification Code */}
              <div className="p-4 border border-border rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Secondary</Badge>
                  <span className="text-sm font-medium">Meta Tag Verification #2</span>
                </div>
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    value={(getSettingValue('google_search_console')?.verification_code_2 as string) || 'H9uwPx5Kjhrqb_8-MKqMjxN9CBQkXuBaOie7Qw61Y-0'}
                    onChange={(e) => updateFormValue('google_search_console', 'verification_code_2', e.target.value)}
                    placeholder="e.g., H9uwPx5Kjhrqb_8-MKqMjxN9CBQkXuBaOie7Qw61Y-0"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-teal" />
                  <span>Active in index.html</span>
                </div>
              </div>

              {/* HTML File Verification */}
              <div className="p-4 border border-border rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Alternative</Badge>
                  <span className="text-sm font-medium">HTML File Verification</span>
                </div>
                <div className="space-y-2">
                  <Label>HTML Verification Filename</Label>
                  <Input
                    value={(getSettingValue('google_search_console')?.html_file_name as string) || ''}
                    onChange={(e) => updateFormValue('google_search_console', 'html_file_name', e.target.value)}
                    placeholder="e.g., googleabcdef123456.html"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload the HTML file to your <code className="bg-muted px-1 rounded">public/</code> folder. The file should contain only the verification token provided by Google.
                  </p>
                </div>
                {(getSettingValue('google_search_console')?.html_file_name as string) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-teal" />
                    <span>File configured: {getSettingValue('google_search_console')?.html_file_name as string}</span>
                  </div>
                )}
              </div>

              {/* Status Summary */}
              {(() => {
                const gscSettings = getSettingValue('google_search_console');
                const code1 = gscSettings?.verification_code || 'QXeUyCI6vHRD4bv5ZLJCYQVSvESe4uqju4tWaamlr2A';
                const code2 = gscSettings?.verification_code_2 || 'H9uwPx5Kjhrqb_8-MKqMjxN9CBQkXuBaOie7Qw61Y-0';
                const htmlFile = gscSettings?.html_file_name;
                const activeCount = [code1, code2, htmlFile].filter(Boolean).length;
                return (
                  <div className="p-3 rounded-xl bg-teal/10 border border-teal/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-teal" />
                      <span className="text-sm font-medium text-teal">{activeCount} verification method{activeCount !== 1 ? 's' : ''} configured</span>
                    </div>
                  </div>
                );
              })()}

              <Button onClick={() => handleSave('google_search_console')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Search Console Settings
              </Button>
            </CardContent>
          </Card>

          {/* Google Analytics */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Google Analytics
              </CardTitle>
              <CardDescription>Track website traffic and user behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Google Analytics 4 Measurement ID</Label>
                <Input
                  value={(getSettingValue('google_analytics')?.measurement_id as string) || ''}
                  onChange={(e) => updateFormValue('google_analytics', 'measurement_id', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your Google Analytics account under Admin → Data Streams → Your website stream
                </p>
              </div>

              <div className="space-y-2">
                <Label>Google Tag Manager ID (Optional)</Label>
                <Input
                  value={(getSettingValue('google_analytics')?.gtm_id as string) || ''}
                  onChange={(e) => updateFormValue('google_analytics', 'gtm_id', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Use Google Tag Manager for more advanced tracking configurations
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label>Enable Analytics Tracking</Label>
                <Switch
                  checked={(getSettingValue('google_analytics')?.enabled as boolean) ?? false}
                  onCheckedChange={(v) => updateFormValue('google_analytics', 'enabled', v)}
                />
              </div>

              {(() => {
                const gaSettings = getSettingValue('google_analytics');
                const hasAnalytics = gaSettings?.measurement_id || gaSettings?.gtm_id;
                const isEnabled = gaSettings?.enabled;
                return (
                  <div className={`p-3 rounded-xl ${hasAnalytics && isEnabled ? 'bg-teal/10 border border-teal/20' : 'bg-muted'}`}>
                    <div className="flex items-center gap-2">
                      {hasAnalytics && isEnabled ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-teal" />
                          <span className="text-sm font-medium text-teal">Analytics tracking active</span>
                        </>
                      ) : hasAnalytics ? (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm text-amber-600">Analytics configured but disabled</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">No analytics configured</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              <Button onClick={() => handleSave('google_analytics')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Analytics Settings
              </Button>
            </CardContent>
          </Card>

          {/* Other Integrations */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-5 w-5" />
                Custom Scripts & Pixels
              </CardTitle>
              <CardDescription>Add custom tracking scripts, chat widgets, or other integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Facebook Pixel ID</Label>
                <Input
                  value={(getSettingValue('tracking_pixels')?.facebook_pixel_id as string) || ''}
                  onChange={(e) => updateFormValue('tracking_pixels', 'facebook_pixel_id', e.target.value)}
                  placeholder="123456789012345"
                />
              </div>

              <div className="space-y-2">
                <Label>Custom Head Scripts</Label>
                <Textarea
                  value={(getSettingValue('custom_scripts')?.head_scripts as string) || ''}
                  onChange={(e) => updateFormValue('custom_scripts', 'head_scripts', e.target.value)}
                  placeholder="<!-- Paste custom scripts here -->"
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Scripts added here will be injected into the &lt;head&gt; of every page
                </p>
              </div>

              <div className="space-y-2">
                <Label>Custom Body Scripts (End of Body)</Label>
                <Textarea
                  value={(getSettingValue('custom_scripts')?.body_scripts as string) || ''}
                  onChange={(e) => updateFormValue('custom_scripts', 'body_scripts', e.target.value)}
                  placeholder="<!-- Paste custom scripts here -->"
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleSave('tracking_pixels')} disabled={saveSetting.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Pixel Settings
                </Button>
                <Button onClick={() => handleSave('custom_scripts')} disabled={saveSetting.isPending} variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Save Custom Scripts
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Verifications Tab */}
        <TabsContent value="verifications" className="mt-4">
          <PlatformVerificationsPanel />
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP Configuration
              </CardTitle>
              <CardDescription>Email sending configuration for outreach campaigns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={(getSettingValue('smtp')?.host as string) || ''}
                    onChange={(e) => updateFormValue('smtp', 'host', e.target.value)}
                    placeholder="smtp.resend.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    value={(getSettingValue('smtp')?.port as number) || 587}
                    onChange={(e) => updateFormValue('smtp', 'port', parseInt(e.target.value))}
                  />
                </div>
              </div>
              {renderSecretInput('smtp', 'username', 'SMTP Username', 'resend')}
              {renderSecretInput('smtp', 'password', 'SMTP Password / API Key', '••••••••')}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={(getSettingValue('smtp')?.from_name as string) || ''}
                    onChange={(e) => updateFormValue('smtp', 'from_name', e.target.value)}
                    placeholder="Appoint Panda"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    value={(getSettingValue('smtp')?.from_email as string) || ''}
                    onChange={(e) => updateFormValue('smtp', 'from_email', e.target.value)}
                    placeholder="noreply@appointpanda.com"
                  />
                </div>
              </div>
              <Button onClick={() => handleSave('smtp')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Email Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="google" className="mt-4 space-y-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Google Places API
              </CardTitle>
              <CardDescription>Required for GMB import functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSecretInput('google_places', 'api_key', 'Google Places API Key', 'AIza...')}
              <p className="text-sm text-muted-foreground">
                Get your API key from the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-primary hover:underline">Google Cloud Console</a>
              </p>
              <Button onClick={() => handleSave('google_places')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Google Places Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                Google OAuth (for GMB Claim Verification)
              </CardTitle>
              <CardDescription>Configure OAuth credentials and callback URL for Google login</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSecretInput('google_oauth', 'client_id', 'Client ID', 'xxx.apps.googleusercontent.com')}
              {renderSecretInput('google_oauth', 'client_secret', 'Client Secret', '••••••••')}
              
              {/* Callback URL - Editable */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Callback URL
                  <Badge variant="outline" className="text-[10px]">Editable</Badge>
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={(getSettingValue('google_oauth')?.callback_url as string) || `${window.location.origin}/auth/callback`}
                    onChange={(e) => updateFormValue('google_oauth', 'callback_url', e.target.value)}
                    placeholder="https://www.appointpanda.com/auth/callback"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      const url = (getSettingValue('google_oauth')?.callback_url as string) || `${window.location.origin}/auth/callback`;
                      navigator.clipboard.writeText(url);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set your production callback URL (e.g., <strong>https://www.appointpanda.com/auth/callback</strong>). Add this URL as an authorized redirect URI in your{' '}
                  <a 
                    href="https://console.cloud.google.com/apis/credentials" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              
              {/* Status indicator */}
              {(() => {
                const oauthSettings = getSettingValue('google_oauth');
                const hasCredentials = oauthSettings?.client_id && oauthSettings?.client_secret;
                const hasCallbackUrl = oauthSettings?.callback_url;
                return (
                  <div className={`p-3 rounded-xl ${hasCredentials ? 'bg-teal/10 border border-teal/20' : 'bg-muted'}`}>
                    <div className="flex items-center gap-2">
                      {hasCredentials ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-teal" />
                          <span className="text-sm font-medium text-teal">
                            OAuth credentials configured
                            {hasCallbackUrl ? ` • Custom callback: ${hasCallbackUrl}` : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">OAuth credentials not configured</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              
              <Button onClick={() => handleSave('google_oauth')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Google OAuth Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Google Search Console
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSecretInput('google_search_console', 'access_token', 'Access Token', '••••••••')}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                <AlertTriangle className="h-5 w-5 text-gold" />
                <span className="text-sm">OAuth integration coming soon. Token refresh not yet automated.</span>
              </div>
              <Button onClick={() => handleSave('google_search_console')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Search Console Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Gateway
              </CardTitle>
              <CardDescription>Configure payment processing for verification subscriptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-xl bg-blue-light border border-blue-custom/20">
                <AlertTriangle className="h-5 w-5 text-blue-custom" />
                <span className="text-sm">Payment gateway integration coming soon. Currently using manual verification.</span>
              </div>
              {renderSecretInput('payment', 'stripe_secret_key', 'Stripe Secret Key (for future use)', 'sk_...')}
              {renderSecretInput('payment', 'stripe_webhook_secret', 'Stripe Webhook Secret', 'whsec_...')}
              <Button onClick={() => handleSave('payment')} disabled={saveSetting.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Payment Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
