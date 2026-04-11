import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Save,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  CheckCircle,
  Building2,
  MessageSquare,
  Headphones,
  DollarSign,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

interface ContactDetails {
  support_email: string;
  booking_email: string;
  sales_email: string;
  partnerships_email: string;
  support_phone: string;
  booking_phone: string;
  sales_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

interface SocialLinks {
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  tiktok: string;
  website: string;
}

const DEFAULT_CONTACT: ContactDetails = {
  support_email: '',
  booking_email: '',
  sales_email: '',
  partnerships_email: '',
  support_phone: '',
  booking_phone: '',
  sales_phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  country: 'United States',
};

const DEFAULT_SOCIAL: SocialLinks = {
  facebook: '',
  instagram: '',
  twitter: '',
  linkedin: '',
  youtube: '',
  tiktok: '',
  website: '',
};

export default function ContactDetailsTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('emails');
  const [contactDetails, setContactDetails] = useState<ContactDetails>(DEFAULT_CONTACT);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(DEFAULT_SOCIAL);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['contact-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value')
        .in('key', ['contact_details', 'social_links']);
      if (error) throw error;
      return data || [];
    },
  });

  // Initialize form from settings
  useEffect(() => {
    if (settings) {
      const contactSetting = settings.find(s => s.key === 'contact_details');
      const socialSetting = settings.find(s => s.key === 'social_links');
      
      if (contactSetting?.value) {
        setContactDetails({ ...DEFAULT_CONTACT, ...(contactSetting.value as unknown as Partial<ContactDetails>) });
      }
      if (socialSetting?.value) {
        setSocialLinks({ ...DEFAULT_SOCIAL, ...(socialSetting.value as unknown as Partial<SocialLinks>) });
      }
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save contact details
      const contactExists = settings?.find(s => s.key === 'contact_details');
      if (contactExists) {
        await supabase
          .from('global_settings')
          .update({ value: contactDetails as any, updated_at: new Date().toISOString() })
          .eq('key', 'contact_details');
      } else {
        await supabase
          .from('global_settings')
          .insert({ key: 'contact_details', value: contactDetails as any, description: 'Platform contact information' });
      }

      // Save social links
      const socialExists = settings?.find(s => s.key === 'social_links');
      if (socialExists) {
        await supabase
          .from('global_settings')
          .update({ value: socialLinks as any, updated_at: new Date().toISOString() })
          .eq('key', 'social_links');
      } else {
        await supabase
          .from('global_settings')
          .insert({ key: 'social_links', value: socialLinks as any, description: 'Social media links' });
      }

      await createAuditLog({
        action: 'UPDATE_CONTACT_SETTINGS',
        entityType: 'global_settings',
        entityId: 'contact_details',
        newValues: { contactDetails, socialLinks },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-settings'] });
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Contact details saved successfully!');
      setHasChanges(false);
    },
    onError: (e) => toast.error('Failed to save: ' + e.message),
  });

  const updateContact = (field: keyof ContactDetails, value: string) => {
    setContactDetails(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateSocial = (field: keyof SocialLinks, value: string) => {
    setSocialLinks(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Contact Details</h1>
          <p className="text-muted-foreground mt-1">
            Manage contact information displayed across the website
          </p>
        </div>
        {hasChanges && (
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2 bg-teal hover:bg-teal/90"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save All Changes'}
          </Button>
        )}
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-primary">Site-Wide Settings</p>
            <p className="text-sm text-muted-foreground">
              These details will appear in the header, footer, and contact page across the entire website.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="emails" className="rounded-xl gap-2">
            <Mail className="h-4 w-4" />
            Email Addresses
          </TabsTrigger>
          <TabsTrigger value="phones" className="rounded-xl gap-2">
            <Phone className="h-4 w-4" />
            Phone Numbers
          </TabsTrigger>
          <TabsTrigger value="address" className="rounded-xl gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </TabsTrigger>
          <TabsTrigger value="social" className="rounded-xl gap-2">
            <Globe className="h-4 w-4" />
            Social Media
          </TabsTrigger>
        </TabsList>

        {/* Email Addresses */}
        <TabsContent value="emails" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Addresses
              </CardTitle>
              <CardDescription>
                Configure different email addresses for various departments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-muted-foreground" />
                    Customer Support Email
                  </Label>
                  <Input
                    type="email"
                    value={contactDetails.support_email}
                    onChange={(e) => updateContact('support_email', e.target.value)}
                    placeholder="support@appointpanda.com"
                  />
                  <p className="text-xs text-muted-foreground">For customer inquiries and help requests</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Booking Inquiries Email
                  </Label>
                  <Input
                    type="email"
                    value={contactDetails.booking_email}
                    onChange={(e) => updateContact('booking_email', e.target.value)}
                    placeholder="bookings@appointpanda.com"
                  />
                  <p className="text-xs text-muted-foreground">For appointment-related questions</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Sales Email
                  </Label>
                  <Input
                    type="email"
                    value={contactDetails.sales_email}
                    onChange={(e) => updateContact('sales_email', e.target.value)}
                    placeholder="sales@appointpanda.com"
                  />
                  <p className="text-xs text-muted-foreground">For pricing and subscription inquiries</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Partnerships Email
                  </Label>
                  <Input
                    type="email"
                    value={contactDetails.partnerships_email}
                    onChange={(e) => updateContact('partnerships_email', e.target.value)}
                    placeholder="partners@appointpanda.com"
                  />
                  <p className="text-xs text-muted-foreground">For business partnerships and collaborations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phone Numbers */}
        <TabsContent value="phones" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Phone Numbers
              </CardTitle>
              <CardDescription>
                Configure phone numbers for different departments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-muted-foreground" />
                    Support Hotline
                  </Label>
                  <Input
                    type="tel"
                    value={contactDetails.support_phone}
                    onChange={(e) => updateContact('support_phone', e.target.value)}
                    placeholder="1-800-555-1234"
                  />
                  <p className="text-xs text-muted-foreground">Main customer support line</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Booking Line
                  </Label>
                  <Input
                    type="tel"
                    value={contactDetails.booking_phone}
                    onChange={(e) => updateContact('booking_phone', e.target.value)}
                    placeholder="1-800-555-5678"
                  />
                  <p className="text-xs text-muted-foreground">For appointment scheduling</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Sales Line
                  </Label>
                  <Input
                    type="tel"
                    value={contactDetails.sales_phone}
                    onChange={(e) => updateContact('sales_phone', e.target.value)}
                    placeholder="1-800-555-9012"
                  />
                  <p className="text-xs text-muted-foreground">For sales inquiries</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address */}
        <TabsContent value="address" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Business Address
              </CardTitle>
              <CardDescription>
                Your company's physical address for the website footer and contact page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Address Line 1</Label>
                  <Input
                    value={contactDetails.address_line1}
                    onChange={(e) => updateContact('address_line1', e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Address Line 2 (Optional)</Label>
                  <Input
                    value={contactDetails.address_line2}
                    onChange={(e) => updateContact('address_line2', e.target.value)}
                    placeholder="Suite 100"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={contactDetails.city}
                      onChange={(e) => updateContact('city', e.target.value)}
                      placeholder="Los Angeles"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={contactDetails.state}
                      onChange={(e) => updateContact('state', e.target.value)}
                      placeholder="CA"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>ZIP Code</Label>
                    <Input
                      value={contactDetails.zip_code}
                      onChange={(e) => updateContact('zip_code', e.target.value)}
                      placeholder="90001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={contactDetails.country}
                      onChange={(e) => updateContact('country', e.target.value)}
                      placeholder="United States"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <Separator />
              <div>
                <Label className="text-muted-foreground">Preview</Label>
                <div className="mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="font-medium">
                    {contactDetails.address_line1 || '123 Main Street'}
                    {contactDetails.address_line2 && `, ${contactDetails.address_line2}`}
                  </p>
                  <p className="text-muted-foreground">
                    {contactDetails.city || 'City'}, {contactDetails.state || 'ST'} {contactDetails.zip_code || '00000'}
                  </p>
                  <p className="text-muted-foreground">{contactDetails.country || 'United States'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media */}
        <TabsContent value="social" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Social Media Links
              </CardTitle>
              <CardDescription>
                Add your social media profiles to display in the website footer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-600" />
                    Facebook
                  </Label>
                  <Input
                    value={socialLinks.facebook}
                    onChange={(e) => updateSocial('facebook', e.target.value)}
                    placeholder="https://facebook.com/appointpanda"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-600" />
                    Instagram
                  </Label>
                  <Input
                    value={socialLinks.instagram}
                    onChange={(e) => updateSocial('instagram', e.target.value)}
                    placeholder="https://instagram.com/appointpanda"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-sky-500" />
                    Twitter / X
                  </Label>
                  <Input
                    value={socialLinks.twitter}
                    onChange={(e) => updateSocial('twitter', e.target.value)}
                    placeholder="https://twitter.com/appointpanda"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-blue-700" />
                    LinkedIn
                  </Label>
                  <Input
                    value={socialLinks.linkedin}
                    onChange={(e) => updateSocial('linkedin', e.target.value)}
                    placeholder="https://linkedin.com/company/appointpanda"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-red-600" />
                    YouTube
                  </Label>
                  <Input
                    value={socialLinks.youtube}
                    onChange={(e) => updateSocial('youtube', e.target.value)}
                    placeholder="https://youtube.com/@appointpanda"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    TikTok
                  </Label>
                  <Input
                    value={socialLinks.tiktok}
                    onChange={(e) => updateSocial('tiktok', e.target.value)}
                    placeholder="https://tiktok.com/@appointpanda"
                  />
                </div>
              </div>

              {/* Preview */}
              <Separator />
              <div>
                <Label className="text-muted-foreground">Active Social Links</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(socialLinks).map(([key, value]) => {
                    if (!value) return null;
                    const Icon = key === 'facebook' ? Facebook : 
                                key === 'instagram' ? Instagram :
                                key === 'twitter' ? Twitter :
                                key === 'linkedin' ? Linkedin :
                                key === 'youtube' ? Youtube : Globe;
                    return (
                      <Badge key={key} variant="secondary" className="gap-1 capitalize">
                        <Icon className="h-3 w-3" />
                        {key}
                        <CheckCircle className="h-3 w-3 text-teal ml-1" />
                      </Badge>
                    );
                  })}
                  {!Object.values(socialLinks).some(v => v) && (
                    <p className="text-sm text-muted-foreground">No social links configured</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button at Bottom */}
      <div className="flex justify-end">
        <Button 
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasChanges}
          size="lg"
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
}
