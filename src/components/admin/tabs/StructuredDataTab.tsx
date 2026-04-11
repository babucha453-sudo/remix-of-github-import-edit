import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Code, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  Search,
  Building2,
  MapPin,
  User,
  FileText,
  Globe,
  Copy,
  Sparkles,
  Save,
  Settings,
  Plus,
  X,
  Link as LinkIcon
} from 'lucide-react';

// Page types that have structured data
const PAGE_TYPES = [
  { id: 'homepage', label: 'Homepage', icon: Globe, schemaTypes: ['Organization'] },
  { id: 'clinic', label: 'Clinics', icon: Building2, schemaTypes: ['LocalBusiness', 'Dentist', 'Breadcrumb'] },
  { id: 'dentist', label: 'Dentists', icon: User, schemaTypes: ['Person', 'Breadcrumb'] },
  { id: 'city', label: 'City Pages', icon: MapPin, schemaTypes: ['Breadcrumb', 'FAQPage'] },
  { id: 'state', label: 'State Pages', icon: MapPin, schemaTypes: ['Breadcrumb', 'FAQPage'] },
  { id: 'service', label: 'Service Pages', icon: FileText, schemaTypes: ['Service', 'FAQPage'] },
  { id: 'service-location', label: 'Service+Location', icon: MapPin, schemaTypes: ['Service', 'Breadcrumb', 'FAQPage'] },
  { id: 'blog', label: 'Blog Posts', icon: FileText, schemaTypes: ['Article', 'Breadcrumb'] },
];

interface OrganizationSettings {
  name: string;
  url: string;
  logo: string;
  description: string;
  email: string;
  phone: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  socialProfiles: string[];
  foundingDate: string;
  founders: string[];
}

interface SitewideSettings {
  defaultRating: number;
  enableBreadcrumbs: boolean;
  enableFAQSchema: boolean;
  enableReviewSchema: boolean;
  enableLocalBusinessSchema: boolean;
}

interface SchemaTestResult {
  url: string;
  schemaTypes: string[];
  valid: boolean;
  errors: string[];
  warnings: string[];
  rawSchema: object[];
}

export default function StructuredDataTab() {
  const [activeTab, setActiveTab] = useState('settings');
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<SchemaTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [selectedPageType, setSelectedPageType] = useState<string | null>(null);
  const [newSocialUrl, setNewSocialUrl] = useState('');
  const [newFounder, setNewFounder] = useState('');
  
  const queryClient = useQueryClient();

  // Fetch schema settings from database
  const { data: schemaSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['schema-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schema_settings')
        .select('*');
      
      if (error) throw error;
      
      const settings: Record<string, any> = {};
      data?.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      return settings as { organization: OrganizationSettings; sitewide: SitewideSettings };
    },
  });

  // Local state for editing
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [sitewideSettings, setSitewideSettings] = useState<SitewideSettings | null>(null);

  // Initialize local state when data loads
  useEffect(() => {
    if (schemaSettings?.organization) {
      setOrgSettings(schemaSettings.organization);
    }
    if (schemaSettings?.sitewide) {
      setSitewideSettings(schemaSettings.sitewide);
    }
  }, [schemaSettings]);

  // Save organization settings
  const saveOrgMutation = useMutation({
    mutationFn: async (settings: OrganizationSettings) => {
      const { error } = await supabase
        .from('schema_settings')
        .update({ setting_value: settings as any, updated_at: new Date().toISOString() })
        .eq('setting_key', 'organization');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-settings'] });
      toast.success('Organization schema settings saved');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + error.message);
    },
  });

  // Save sitewide settings
  const saveSitewideMutation = useMutation({
    mutationFn: async (settings: SitewideSettings) => {
      const { error } = await supabase
        .from('schema_settings')
        .update({ setting_value: settings as any, updated_at: new Date().toISOString() })
        .eq('setting_key', 'sitewide');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-settings'] });
      toast.success('Sitewide schema settings saved');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + error.message);
    },
  });

  // Fetch sample pages for each type
  const { data: samplePages, isLoading: loadingPages } = useQuery({
    queryKey: ['schema-sample-pages'],
    queryFn: async () => {
      const samples: Record<string, { slug: string; name: string }[]> = {};
      
      const { data: clinics } = await supabase
        .from('clinics')
        .select('slug, name')
        .eq('is_active', true)
        .limit(5);
      samples.clinic = clinics?.map(c => ({ slug: `/clinic/${c.slug}`, name: c.name })) || [];
      
      const { data: dentists } = await supabase
        .from('dentists')
        .select('slug, name')
        .eq('is_active', true)
        .limit(5);
      samples.dentist = dentists?.map(d => ({ slug: `/dentist/${d.slug}`, name: d.name })) || [];
      
      const { data: cities } = await supabase
        .from('cities')
        .select('slug, name, states(slug)')
        .eq('is_active', true)
        .limit(5);
      samples.city = cities?.map(c => {
        const stateData = Array.isArray(c.states) ? c.states[0] : c.states;
        return { 
          slug: `/${stateData?.slug}/${c.slug}`, 
          name: c.name 
        };
      }) || [];
      
      const { data: states } = await supabase
        .from('states')
        .select('slug, name')
        .eq('is_active', true)
        .limit(5);
      samples.state = states?.map(s => ({ slug: `/${s.slug}`, name: s.name })) || [];
      
      const { data: treatments } = await supabase
        .from('treatments')
        .select('slug, name')
        .eq('is_active', true)
        .limit(5);
      samples.service = treatments?.map(t => ({ slug: `/services/${t.slug}`, name: t.name })) || [];
      
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('slug, title')
        .eq('status', 'published')
        .limit(5);
      samples.blog = posts?.map(p => ({ slug: `/blog/${p.slug}`, name: p.title })) || [];
      
      samples.homepage = [{ slug: '/', name: 'Homepage' }];
      
      if (samples.city?.[0] && samples.service?.[0]) {
        const cityData = cities?.[0];
        const stateData = Array.isArray(cityData?.states) ? cityData.states[0] : cityData?.states;
        samples['service-location'] = treatments?.slice(0, 3).map(t => ({
          slug: `/${stateData?.slug}/${cityData?.slug}/${t.slug}`,
          name: `${t.name} in ${cityData?.name}`
        })) || [];
      }
      
      return samples;
    },
  });

  const testStructuredData = async (url: string) => {
    setTesting(true);
    try {
      const fullUrl = url.startsWith('http') ? url : `https://www.appointpanda.com${url}`;
      const pageType = detectPageType(url);
      const expectedSchemas = PAGE_TYPES.find(p => p.id === pageType)?.schemaTypes || [];
      
      const result: SchemaTestResult = {
        url: fullUrl,
        schemaTypes: expectedSchemas,
        valid: expectedSchemas.length > 0,
        errors: [],
        warnings: [],
        rawSchema: [],
      };
      
      if (!expectedSchemas.includes('Breadcrumb') && pageType !== 'homepage') {
        result.warnings.push('Missing BreadcrumbList schema - recommended for navigation');
      }
      
      if (pageType === 'clinic' && !expectedSchemas.includes('LocalBusiness')) {
        result.errors.push('Clinic pages must have LocalBusiness schema');
      }
      
      if ((pageType === 'city' || pageType === 'service') && !expectedSchemas.includes('FAQPage')) {
        result.warnings.push('Consider adding FAQPage schema for better SERP features');
      }
      
      setTestResult(result);
      toast.success('Schema analysis complete');
    } catch (error) {
      toast.error('Failed to analyze schema');
    } finally {
      setTesting(false);
    }
  };

  const detectPageType = (url: string): string => {
    if (url === '/' || url === '') return 'homepage';
    if (url.startsWith('/clinic/')) return 'clinic';
    if (url.startsWith('/dentist/')) return 'dentist';
    if (url.startsWith('/services/')) return 'service';
    if (url.startsWith('/blog/')) return 'blog';
    const parts = url.split('/').filter(Boolean);
    if (parts.length === 3) return 'service-location';
    if (parts.length === 2) return 'city';
    if (parts.length === 1) return 'state';
    return 'unknown';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const openRichResultsTest = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `https://www.appointpanda.com${url}`;
    window.open(`https://search.google.com/test/rich-results?url=${encodeURIComponent(fullUrl)}`, '_blank');
  };

  const openSchemaValidator = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `https://www.appointpanda.com${url}`;
    window.open(`https://validator.schema.org/?url=${encodeURIComponent(fullUrl)}`, '_blank');
  };

  const addSocialProfile = () => {
    if (newSocialUrl && orgSettings) {
      setOrgSettings({
        ...orgSettings,
        socialProfiles: [...(orgSettings.socialProfiles || []), newSocialUrl]
      });
      setNewSocialUrl('');
    }
  };

  const removeSocialProfile = (index: number) => {
    if (orgSettings) {
      const updated = [...(orgSettings.socialProfiles || [])];
      updated.splice(index, 1);
      setOrgSettings({ ...orgSettings, socialProfiles: updated });
    }
  };

  const addFounder = () => {
    if (newFounder && orgSettings) {
      setOrgSettings({
        ...orgSettings,
        founders: [...(orgSettings.founders || []), newFounder]
      });
      setNewFounder('');
    }
  };

  const removeFounder = (index: number) => {
    if (orgSettings) {
      const updated = [...(orgSettings.founders || [])];
      updated.splice(index, 1);
      setOrgSettings({ ...orgSettings, founders: updated });
    }
  };

  // Generate preview of organization schema
  const generateOrgSchemaPreview = () => {
    if (!orgSettings) return {};
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: orgSettings.name,
      url: orgSettings.url,
      logo: orgSettings.logo,
      description: orgSettings.description,
      email: orgSettings.email || undefined,
      telephone: orgSettings.phone || undefined,
      foundingDate: orgSettings.foundingDate || undefined,
      founder: orgSettings.founders?.length ? orgSettings.founders.map(name => ({
        '@type': 'Person',
        name
      })) : undefined,
      address: orgSettings.address?.streetAddress ? {
        '@type': 'PostalAddress',
        streetAddress: orgSettings.address.streetAddress,
        addressLocality: orgSettings.address.addressLocality,
        addressRegion: orgSettings.address.addressRegion,
        postalCode: orgSettings.address.postalCode,
        addressCountry: orgSettings.address.addressCountry,
      } : undefined,
      sameAs: orgSettings.socialProfiles?.length ? orgSettings.socialProfiles : undefined,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
          <Code className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Structured Data Management</h1>
          <p className="text-muted-foreground">
            Configure, test, and monitor JSON-LD schema markup across all pages
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Schema Settings
          </TabsTrigger>
          <TabsTrigger value="overview">Schema Overview</TabsTrigger>
          <TabsTrigger value="test">Test & Validate</TabsTrigger>
          <TabsTrigger value="templates">Schema Templates</TabsTrigger>
          <TabsTrigger value="issues">Issues & Fixes</TabsTrigger>
        </TabsList>

        {/* Settings Tab - NEW */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          {loadingSettings ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Organization Schema Settings */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <CardTitle>Organization Schema Settings</CardTitle>
                    </div>
                    <Button 
                      onClick={() => orgSettings && saveOrgMutation.mutate(orgSettings)}
                      disabled={saveOrgMutation.isPending}
                    >
                      {saveOrgMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                  <CardDescription>
                    Configure your organization's structured data that appears on the homepage and is referenced across all pages.
                    These settings help Google understand your business entity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {orgSettings && (
                    <>
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="org-name">Organization Name *</Label>
                          <Input
                            id="org-name"
                            value={orgSettings.name}
                            onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                            placeholder="AppointPanda"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-url">Website URL *</Label>
                          <Input
                            id="org-url"
                            value={orgSettings.url}
                            onChange={(e) => setOrgSettings({ ...orgSettings, url: e.target.value })}
                            placeholder="https://www.appointpanda.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-logo">Logo URL *</Label>
                          <Input
                            id="org-logo"
                            value={orgSettings.logo}
                            onChange={(e) => setOrgSettings({ ...orgSettings, logo: e.target.value })}
                            placeholder="https://www.appointpanda.com/logo.png"
                          />
                          <p className="text-xs text-muted-foreground">Recommended: 112x112 to 600x600 pixels</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-founding">Founding Date</Label>
                          <Input
                            id="org-founding"
                            type="date"
                            value={orgSettings.foundingDate}
                            onChange={(e) => setOrgSettings({ ...orgSettings, foundingDate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org-desc">Description *</Label>
                        <Textarea
                          id="org-desc"
                          value={orgSettings.description}
                          onChange={(e) => setOrgSettings({ ...orgSettings, description: e.target.value })}
                          placeholder="Describe your organization..."
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">Appears in search results. Keep under 160 characters for best display.</p>
                      </div>

                      {/* Contact Info */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Contact Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="org-email">Contact Email</Label>
                            <Input
                              id="org-email"
                              type="email"
                              value={orgSettings.email}
                              onChange={(e) => setOrgSettings({ ...orgSettings, email: e.target.value })}
                              placeholder="contact@appointpanda.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="org-phone">Contact Phone</Label>
                            <Input
                              id="org-phone"
                              value={orgSettings.phone}
                              onChange={(e) => setOrgSettings({ ...orgSettings, phone: e.target.value })}
                              placeholder="+1-555-123-4567"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Business Address (Optional)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="org-street">Street Address</Label>
                            <Input
                              id="org-street"
                              value={orgSettings.address?.streetAddress || ''}
                              onChange={(e) => setOrgSettings({ 
                                ...orgSettings, 
                                address: { ...orgSettings.address, streetAddress: e.target.value }
                              })}
                              placeholder="123 Main St"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="org-city">City</Label>
                            <Input
                              id="org-city"
                              value={orgSettings.address?.addressLocality || ''}
                              onChange={(e) => setOrgSettings({ 
                                ...orgSettings, 
                                address: { ...orgSettings.address, addressLocality: e.target.value }
                              })}
                              placeholder="San Francisco"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="org-region">State/Region</Label>
                            <Input
                              id="org-region"
                              value={orgSettings.address?.addressRegion || ''}
                              onChange={(e) => setOrgSettings({ 
                                ...orgSettings, 
                                address: { ...orgSettings.address, addressRegion: e.target.value }
                              })}
                              placeholder="CA"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="org-postal">Postal Code</Label>
                            <Input
                              id="org-postal"
                              value={orgSettings.address?.postalCode || ''}
                              onChange={(e) => setOrgSettings({ 
                                ...orgSettings, 
                                address: { ...orgSettings.address, postalCode: e.target.value }
                              })}
                              placeholder="94102"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="org-country">Country</Label>
                            <Input
                              id="org-country"
                              value={orgSettings.address?.addressCountry || 'US'}
                              onChange={(e) => setOrgSettings({ 
                                ...orgSettings, 
                                address: { ...orgSettings.address, addressCountry: e.target.value }
                              })}
                              placeholder="US"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Social Profiles */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Social Profiles (sameAs)</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Add your official social media profile URLs. These help Google verify your organization.
                        </p>
                        <div className="space-y-2">
                          {(orgSettings.socialProfiles || []).map((url, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <LinkIcon className="h-4 w-4 text-muted-foreground" />
                              <Input value={url} disabled className="flex-1" />
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeSocialProfile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <Input
                              value={newSocialUrl}
                              onChange={(e) => setNewSocialUrl(e.target.value)}
                              placeholder="https://facebook.com/appointpanda"
                              onKeyDown={(e) => e.key === 'Enter' && addSocialProfile()}
                            />
                            <Button variant="outline" onClick={addSocialProfile}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Founders */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Founders (Optional)</h4>
                        <div className="space-y-2">
                          {(orgSettings.founders || []).map((name, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <Input value={name} disabled className="flex-1" />
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeFounder(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <Input
                              value={newFounder}
                              onChange={(e) => setNewFounder(e.target.value)}
                              placeholder="John Doe"
                              onKeyDown={(e) => e.key === 'Enter' && addFounder()}
                            />
                            <Button variant="outline" onClick={addFounder}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Schema Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Organization Schema Preview
                  </CardTitle>
                  <CardDescription>
                    This is how your organization schema will appear on the homepage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto max-h-96">
                    {JSON.stringify(generateOrgSchemaPreview(), null, 2)}
                  </pre>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => copyToClipboard(JSON.stringify(generateOrgSchemaPreview(), null, 2))}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Schema
                  </Button>
                </CardContent>
              </Card>

              {/* Sitewide Settings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      <CardTitle>Sitewide Schema Settings</CardTitle>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => sitewideSettings && saveSitewideMutation.mutate(sitewideSettings)}
                      disabled={saveSitewideMutation.isPending}
                    >
                      {saveSitewideMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                  <CardDescription>
                    Enable or disable schema types across all pages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sitewideSettings && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable Breadcrumb Schema</Label>
                          <p className="text-xs text-muted-foreground">Show breadcrumb navigation in search results</p>
                        </div>
                        <Switch
                          checked={sitewideSettings.enableBreadcrumbs}
                          onCheckedChange={(checked) => setSitewideSettings({ ...sitewideSettings, enableBreadcrumbs: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable FAQ Schema</Label>
                          <p className="text-xs text-muted-foreground">Show FAQ dropdowns in search results</p>
                        </div>
                        <Switch
                          checked={sitewideSettings.enableFAQSchema}
                          onCheckedChange={(checked) => setSitewideSettings({ ...sitewideSettings, enableFAQSchema: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable Review/Rating Schema</Label>
                          <p className="text-xs text-muted-foreground">Show star ratings in search results</p>
                        </div>
                        <Switch
                          checked={sitewideSettings.enableReviewSchema}
                          onCheckedChange={(checked) => setSitewideSettings({ ...sitewideSettings, enableReviewSchema: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable LocalBusiness Schema</Label>
                          <p className="text-xs text-muted-foreground">Rich business info for clinic pages</p>
                        </div>
                        <Switch
                          checked={sitewideSettings.enableLocalBusinessSchema}
                          onCheckedChange={(checked) => setSitewideSettings({ ...sitewideSettings, enableLocalBusinessSchema: checked })}
                        />
                      </div>
                      <div className="border-t pt-4">
                        <Label htmlFor="default-rating">Default Rating (for clinics without reviews)</Label>
                        <Input
                          id="default-rating"
                          type="number"
                          min={1}
                          max={5}
                          step={0.1}
                          value={sitewideSettings.defaultRating}
                          onChange={(e) => setSitewideSettings({ ...sitewideSettings, defaultRating: parseFloat(e.target.value) || 4.5 })}
                          className="mt-2 w-24"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PAGE_TYPES.map((pageType) => {
              const Icon = pageType.icon;
              const samples = samplePages?.[pageType.id] || [];
              return (
                <Card 
                  key={pageType.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedPageType === pageType.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedPageType(selectedPageType === pageType.id ? null : pageType.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{pageType.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {pageType.schemaTypes.map((schema) => (
                        <Badge key={schema} variant="secondary" className="text-xs">
                          {schema}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {samples.length} sample pages available
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedPageType && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {PAGE_TYPES.find(p => p.id === selectedPageType)?.label} Schema Details
                </CardTitle>
                <CardDescription>
                  Sample pages and quick validation links
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {(samplePages?.[selectedPageType] || []).map((page, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{page.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{page.slug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openRichResultsTest(page.slug)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Rich Results
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openSchemaValidator(page.slug)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Validate
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setTestUrl(page.slug);
                              setActiveTab('test');
                            }}
                          >
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Page Schema</CardTitle>
              <CardDescription>
                Enter a URL to analyze its structured data implementation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter URL path (e.g., /clinic/bright-smile-dental)"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={() => testStructuredData(testUrl)}
                  disabled={testing || !testUrl}
                >
                  {testing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Analyze
                </Button>
              </div>

              {testResult && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Analysis Results</h4>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {testResult.url}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openRichResultsTest(testUrl)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Google Rich Results Test
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openSchemaValidator(testUrl)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Schema.org Validator
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border">
                      <h5 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Expected Schemas
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {testResult.schemaTypes.map((type) => (
                          <Badge key={type} variant="default">{type}</Badge>
                        ))}
                      </div>
                    </div>

                    {testResult.errors.length > 0 && (
                      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                        <h5 className="font-medium mb-2 flex items-center gap-2 text-destructive">
                          <XCircle className="h-4 w-4" />
                          Errors
                        </h5>
                        <ul className="text-sm space-y-1">
                          {testResult.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {testResult.warnings.length > 0 && (
                      <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/5">
                        <h5 className="font-medium mb-2 flex items-center gap-2 text-yellow-600">
                          <AlertTriangle className="h-4 w-4" />
                          Warnings
                        </h5>
                        <ul className="text-sm space-y-1">
                          {testResult.warnings.map((warn, idx) => (
                            <li key={idx}>{warn}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Test</CardTitle>
              <CardDescription>Test common page types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setTestUrl('/'); testStructuredData('/'); }}>
                  Homepage
                </Button>
                {samplePages?.clinic?.[0] && (
                  <Button variant="outline" size="sm" onClick={() => { setTestUrl(samplePages.clinic[0].slug); testStructuredData(samplePages.clinic[0].slug); }}>
                    Sample Clinic
                  </Button>
                )}
                {samplePages?.dentist?.[0] && (
                  <Button variant="outline" size="sm" onClick={() => { setTestUrl(samplePages.dentist[0].slug); testStructuredData(samplePages.dentist[0].slug); }}>
                    Sample Dentist
                  </Button>
                )}
                {samplePages?.city?.[0] && (
                  <Button variant="outline" size="sm" onClick={() => { setTestUrl(samplePages.city[0].slug); testStructuredData(samplePages.city[0].slug); }}>
                    Sample City
                  </Button>
                )}
                {samplePages?.service?.[0] && (
                  <Button variant="outline" size="sm" onClick={() => { setTestUrl(samplePages.service[0].slug); testStructuredData(samplePages.service[0].slug); }}>
                    Sample Service
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Organization Schema
                </CardTitle>
                <CardDescription>Used on homepage - configured in Schema Settings tab</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
{`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "{{organization.name}}",
  "url": "{{organization.url}}",
  "logo": "{{organization.logo}}",
  "description": "{{organization.description}}",
  "address": { ... },
  "sameAs": [...]
}`}
                </pre>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="mt-2 p-0"
                  onClick={() => setActiveTab('settings')}
                >
                  Configure in Settings →
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  LocalBusiness/Dentist Schema
                </CardTitle>
                <CardDescription>Auto-generated from clinic data</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
{`{
  "@context": "https://schema.org",
  "@type": ["Dentist", "LocalBusiness"],
  "name": "{{clinic.name}}",
  "url": "{{clinic.url}}",
  "telephone": "{{clinic.phone}}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{{clinic.address}}",
    "addressLocality": "{{clinic.city}}",
    "addressCountry": "US"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{{clinic.rating}}",
    "reviewCount": "{{clinic.reviewCount}}"
  }
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  BreadcrumbList Schema
                </CardTitle>
                <CardDescription>Auto-generated based on page hierarchy</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
{`{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.appointpanda.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "{{page.name}}",
      "item": "{{page.url}}"
    }
  ]
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  FAQPage Schema
                </CardTitle>
                <CardDescription>Auto-generated from FAQ content on pages</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
{`{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{{faq.question}}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{faq.answer}}"
      }
    }
  ]
}`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Common Schema Issues & How to Fix Them
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-green-500/5 border-green-500/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-700">Missing Organization Details</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Organization schema fields like email, phone, address, and social profiles are now configurable.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setActiveTab('settings')}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Configure Organization Schema
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Google Search Console: "Temporary processing error"</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  This typically occurs when Google cannot access your sitemap or when the XML is malformed.
                </p>
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-green-500/10">✓ Sitemap is accessible and returns valid XML</Badge>
                  <Badge variant="outline" className="bg-green-500/10">✓ Child sitemaps are properly linked</Badge>
                  <Badge variant="outline" className="bg-green-500/10">✓ Content-Type header is application/xml</Badge>
                  <Badge variant="outline" className="bg-green-500/10">✓ Empty slugs are filtered out</Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://www.appointpanda.com/sitemap.xml', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Live Sitemap
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://search.google.com/search-console', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Resubmit in Search Console
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Missing Required Fields by Schema Type</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Ensure all required schema properties are present:
                </p>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">Organization</Badge>
                    <span>name, url (configurable in Settings)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">LocalBusiness</Badge>
                    <span>name, address (auto-filled from clinic data)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">Person</Badge>
                    <span>name (auto-filled from dentist data)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">Article</Badge>
                    <span>headline, author, datePublished (auto-filled from blog post)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">FAQPage</Badge>
                    <span>mainEntity with Question/Answer pairs (auto-generated)</span>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Schema Validation Tools</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://search.google.com/test/rich-results', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Google Rich Results Test
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://validator.schema.org/', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Schema.org Validator
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://search.google.com/search-console', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Google Search Console
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
