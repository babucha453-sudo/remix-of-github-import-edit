import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import {
  Zap,
  MessageSquare,
  Mail,
  Bot,
  Star,
  Calendar,
  Bell,
  CreditCard,
  Shield,
  Globe,
  Users,
  Building2,
  FileText,
  Search,
  Settings,
  ToggleLeft,
  Activity,
  Loader2,
} from 'lucide-react';

interface PlatformService {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'core' | 'messaging' | 'reputation' | 'automation' | 'premium';
  isPremium?: boolean;
}

const PLATFORM_SERVICES: PlatformService[] = [
  // Core Features
  { id: 'clinic_profiles', key: 'clinic_profiles', name: 'Clinic Profiles', description: 'Public clinic listings and profiles', icon: Building2, category: 'core' },
  { id: 'dentist_profiles', key: 'dentist_profiles', name: 'Dentist Profiles', description: 'Individual dentist pages', icon: Users, category: 'core' },
  { id: 'search_directory', key: 'search_directory', name: 'Search & Directory', description: 'Location-based clinic search', icon: Search, category: 'core' },
  { id: 'appointment_booking', key: 'appointment_booking', name: 'Appointment Booking', description: 'Online booking functionality', icon: Calendar, category: 'core' },
  { id: 'clinic_claiming', key: 'clinic_claiming', name: 'Clinic Claiming', description: 'Allow dentists to claim profiles', icon: Shield, category: 'core' },
  
  // Messaging Features
  { id: 'sms_notifications', key: 'sms_notifications', name: 'SMS Notifications', description: 'Send SMS to patients', icon: MessageSquare, category: 'messaging' },
  { id: 'whatsapp_notifications', key: 'whatsapp_notifications', name: 'WhatsApp Notifications', description: 'Send WhatsApp messages', icon: MessageSquare, category: 'messaging', isPremium: true },
  { id: 'email_notifications', key: 'email_notifications', name: 'Email Notifications', description: 'Email communication system', icon: Mail, category: 'messaging' },
  { id: 'appointment_reminders', key: 'appointment_reminders', name: 'Appointment Reminders', description: 'Automated reminders before appointments', icon: Bell, category: 'messaging' },
  
  // Reputation Features
  { id: 'review_collection', key: 'review_collection', name: 'Review Collection', description: 'Review request system', icon: Star, category: 'reputation' },
  { id: 'review_funnel', key: 'review_funnel', name: 'Review Funnel', description: 'Thumbs up/down review routing', icon: Star, category: 'reputation' },
  { id: 'qr_code_reviews', key: 'qr_code_reviews', name: 'QR Code Reviews', description: 'QR codes for review collection', icon: Star, category: 'reputation' },
  { id: 'ai_review_replies', key: 'ai_review_replies', name: 'AI Review Replies', description: 'AI-suggested review responses', icon: Bot, category: 'reputation', isPremium: true },
  
  // Automation Features
  { id: 'automation_rules', key: 'automation_rules', name: 'Automation Rules', description: 'Custom automation workflows', icon: Zap, category: 'automation', isPremium: true },
  { id: 'ai_insights', key: 'ai_insights', name: 'AI Insights', description: 'AI-powered analytics', icon: Bot, category: 'automation', isPremium: true },
  { id: 'outreach_campaigns', key: 'outreach_campaigns', name: 'Outreach Campaigns', description: 'Email marketing campaigns', icon: Mail, category: 'automation' },
  
  // Premium Features
  { id: 'dedicated_crm_number', key: 'dedicated_crm_number', name: 'Dedicated CRM Number', description: 'Private virtual number for dentists', icon: MessageSquare, category: 'premium', isPremium: true },
  { id: 'advanced_analytics', key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed performance reports', icon: Activity, category: 'premium', isPremium: true },
  { id: 'priority_support', key: 'priority_support', name: 'Priority Support', description: 'Fast-track support tickets', icon: Shield, category: 'premium', isPremium: true },
];

export default function PlatformServicesTab() {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('core');

  // Fetch service settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-services-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'platform_services')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return (data?.value as Record<string, { enabled: boolean; config?: Record<string, unknown> }>) || {};
    },
  });

  // Update service setting
  const updateService = useMutation({
    mutationFn: async ({ serviceKey, enabled, config }: { serviceKey: string; enabled: boolean; config?: Record<string, unknown> }) => {
      const currentSettings = settings || {};
      const newSettings = {
        ...currentSettings,
        [serviceKey]: { enabled, config: config || currentSettings[serviceKey]?.config || {} },
      };

      const existing = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', 'platform_services')
        .single();

      if (existing.data) {
        const { error } = await supabase
          .from('global_settings')
          .update({ value: newSettings as any, updated_at: new Date().toISOString() })
          .eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert([{ key: 'platform_services', value: newSettings as any }]);
        if (error) throw error;
      }

      await createAuditLog({
        action: enabled ? 'ENABLE_SERVICE' : 'DISABLE_SERVICE',
        entityType: 'platform_service',
        entityId: serviceKey,
        newValues: { enabled },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-services-settings'] });
      toast.success('Service updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getServiceStatus = (key: string) => {
    return settings?.[key]?.enabled ?? true; // Default enabled
  };

  const categories = [
    { id: 'core', name: 'Core Features', icon: Globe, count: PLATFORM_SERVICES.filter(s => s.category === 'core').length },
    { id: 'messaging', name: 'Messaging', icon: MessageSquare, count: PLATFORM_SERVICES.filter(s => s.category === 'messaging').length },
    { id: 'reputation', name: 'Reputation', icon: Star, count: PLATFORM_SERVICES.filter(s => s.category === 'reputation').length },
    { id: 'automation', name: 'Automation', icon: Zap, count: PLATFORM_SERVICES.filter(s => s.category === 'automation').length },
    { id: 'premium', name: 'Premium', icon: CreditCard, count: PLATFORM_SERVICES.filter(s => s.category === 'premium').length },
  ];

  const filteredServices = PLATFORM_SERVICES.filter(s => s.category === activeCategory);
  const enabledCount = PLATFORM_SERVICES.filter(s => getServiceStatus(s.key)).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Platform Services</h1>
          <p className="text-muted-foreground mt-1">Control which features are available across the platform</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {enabledCount} / {PLATFORM_SERVICES.length} Active
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {categories.map(cat => {
          const Icon = cat.icon;
          const categoryServices = PLATFORM_SERVICES.filter(s => s.category === cat.id);
          const activeInCategory = categoryServices.filter(s => getServiceStatus(s.key)).length;
          return (
            <Card 
              key={cat.id} 
              className={`card-modern cursor-pointer transition-all ${activeCategory === cat.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${activeCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{activeInCategory}/{cat.count} active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Services List */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleLeft className="h-5 w-5" />
            {categories.find(c => c.id === activeCategory)?.name} Services
          </CardTitle>
          <CardDescription>
            Toggle services on/off to control availability across the entire platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredServices.map(service => {
            const Icon = service.icon;
            const isEnabled = getServiceStatus(service.key);
            return (
              <div key={service.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`h-6 w-6 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{service.name}</p>
                      {service.isPremium && (
                        <Badge className="bg-gold/20 text-gold text-xs">Premium</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={isEnabled ? 'default' : 'secondary'}>
                    {isEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => updateService.mutate({ serviceKey: service.key, enabled: checked })}
                    disabled={updateService.isPending}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="card-modern border-blue-custom/20 bg-blue-light">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-blue-custom mt-0.5" />
            <div>
              <p className="font-medium text-blue-custom">How Platform Services Work</p>
              <p className="text-sm text-muted-foreground mt-1">
                Disabling a service will hide it from all users (dentists and patients) across the platform.
                This is useful for temporarily disabling features during maintenance or for phased rollouts.
                Premium features can be controlled separately via Plan feature bundling.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
