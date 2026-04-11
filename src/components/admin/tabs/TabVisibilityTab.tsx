import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Eye, 
  EyeOff, 
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Calendar,
  Search,
  Settings,
  RefreshCw,
  Save,
  Info,
  Stethoscope,
  MapPin,
  UserPlus,
  FileText,
  BookOpen,
  Bot,
  Lock,
  CreditCard,
  ClipboardList,
  Globe,
  Mail,
  Palette,
  TrendingUp,
  MessageSquare,
  Target,
  Phone,
  Inbox,
  Zap,
  Star,
  Flag,
  Activity,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Building2, Users, Shield, Calendar, Search, Settings,
  Stethoscope, MapPin, UserPlus, FileText, BookOpen, Bot, Lock, CreditCard,
  ClipboardList, Globe, Mail, Palette, TrendingUp, MessageSquare, Target,
  Phone, Inbox, Zap, Star, Flag, Activity, Clock, Eye, EyeOff,
};

// Define all tabs for Super Admin
const ADMIN_TABS = [
  { id: 'overview', label: 'Command Center', icon: 'LayoutDashboard', group: 'Overview' },
  { id: 'weekly', label: 'Weekly Report', icon: 'TrendingUp', group: 'Overview' },
  { id: 'clinics', label: 'Dental Offices', icon: 'Building2', group: 'Users & Clinics' },
  { id: 'users', label: 'Users', icon: 'Users', group: 'Users & Clinics' },
  { id: 'claims', label: 'Claims', icon: 'Shield', group: 'Users & Clinics' },
  { id: 'treatments', label: 'Treatments', icon: 'Stethoscope', group: 'Users & Clinics' },
  { id: 'locations', label: 'Locations', icon: 'MapPin', group: 'Users & Clinics' },
  { id: 'review-insights', label: 'Review Insights', icon: 'MessageSquare', group: 'Reputation' },
  { id: 'gmb-connections', label: 'GMB Connections', icon: 'Globe', group: 'Reputation' },
  { id: 'gmb-scraper', label: 'Scraper Bot', icon: 'Bot', group: 'Marketing' },
  { id: 'gmb-bridge', label: 'Google Import', icon: 'Globe', group: 'Marketing' },
  { id: 'outreach', label: 'Outreach Center', icon: 'Mail', group: 'Marketing' },
  { id: 'promotions', label: 'Promotions', icon: 'Target', group: 'Marketing' },
  { id: 'appointments', label: 'Appointments', icon: 'Calendar', group: 'Appointments' },
  { id: 'leads', label: 'Lead CRM', icon: 'UserPlus', group: 'Appointments' },
  { id: 'pages', label: 'Page Manager', icon: 'FileText', group: 'Content & SEO' },
  { id: 'blog', label: 'Blog', icon: 'BookOpen', group: 'Content & SEO' },
  { id: 'seo', label: 'SEO Management', icon: 'Search', group: 'Content & SEO' },
  { id: 'seo-bot', label: 'SEO Bot', icon: 'Bot', group: 'Content & SEO' },
  { id: 'seo-copilot', label: 'SEO Copilot', icon: 'Target', group: 'Content & SEO' },
  { id: 'seo-content-optimizer', label: 'Content Optimizer', icon: 'Zap', group: 'Content & SEO' },
  { id: 'ranking-rules', label: 'Ranking Rules', icon: 'TrendingUp', group: 'Content & SEO' },
  { id: 'pinned-profiles', label: 'Pinned Profiles', icon: 'Star', group: 'Content & SEO' },
  { id: 'top-dentists', label: 'Top Dentists', icon: 'Star', group: 'Content & SEO' },
  { id: 'api-control', label: 'API Control', icon: 'Zap', group: 'Integrations' },
  { id: 'crm-numbers', label: 'CRM Numbers', icon: 'Phone', group: 'Integrations' },
  { id: 'messaging-control', label: 'Messaging', icon: 'MessageSquare', group: 'Integrations' },
  { id: 'marketplace-control', label: 'Marketplace Control', icon: 'Target', group: 'System' },
  { id: 'system-audit', label: 'System Audit', icon: 'Activity', group: 'System' },
  { id: 'feature-flags', label: 'Feature Flags', icon: 'Flag', group: 'System' },
  { id: 'roles', label: 'Access Control', icon: 'Lock', group: 'System' },
  { id: 'platform-services', label: 'Platform Services', icon: 'Zap', group: 'System' },
  { id: 'plans', label: 'Plans & Features', icon: 'CreditCard', group: 'System' },
  { id: 'subscriptions', label: 'Revenue', icon: 'CreditCard', group: 'System' },
  { id: 'ai-controls', label: 'AI Controls', icon: 'Bot', group: 'System' },
  { id: 'automation', label: 'Automation Rules', icon: 'Zap', group: 'System' },
  { id: 'support-admin', label: 'Support Tickets', icon: 'Shield', group: 'System' },
  { id: 'audit', label: 'Audit Logs', icon: 'ClipboardList', group: 'System' },
  { id: 'smoke-test', label: 'URL Smoke Test', icon: 'Globe', group: 'System' },
  { id: 'site-config', label: 'Header / Footer', icon: 'Palette', group: 'System' },
  { id: 'contact-details', label: 'Contact Details', icon: 'Phone', group: 'System' },
  { id: 'settings', label: 'Settings', icon: 'Settings', group: 'System' },
];

// Define all tabs for Dentist Dashboard
const DENTIST_TABS = [
  { id: 'my-dashboard', label: 'My Practice', icon: 'LayoutDashboard', group: 'Dashboard' },
  { id: 'my-appointments', label: 'Appointments', icon: 'Calendar', group: 'Operations' },
  { id: 'my-availability', label: 'Availability', icon: 'Clock', group: 'Operations' },
  { id: 'my-appointment-types', label: 'Appointment Types', icon: 'Stethoscope', group: 'Operations' },
  { id: 'my-patients', label: 'Patients', icon: 'Users', group: 'Operations' },
  { id: 'my-messages', label: 'Messages', icon: 'Inbox', group: 'Operations' },
  { id: 'my-intake-forms', label: 'Intake Forms', icon: 'ClipboardList', group: 'Operations' },
  { id: 'my-operations', label: 'Automation', icon: 'Zap', group: 'Operations' },
  { id: 'my-profile', label: 'Edit Profile', icon: 'Building2', group: 'Profile' },
  { id: 'my-team', label: 'Team', icon: 'Users', group: 'Profile' },
  { id: 'my-services', label: 'Services', icon: 'Stethoscope', group: 'Profile' },
  { id: 'my-insurance', label: 'Insurance', icon: 'Shield', group: 'Profile' },
  { id: 'my-reputation', label: 'Reputation Suite', icon: 'Star', group: 'Reputation' },
  { id: 'my-settings', label: 'Settings', icon: 'Settings', group: 'Settings' },
  { id: 'my-support', label: 'Support Tickets', icon: 'Shield', group: 'Settings' },
];

interface TabVisibility {
  adminTabs: Record<string, boolean>;
  dentistTabs: Record<string, boolean>;
}

export default function TabVisibilityTab() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'admin' | 'dentist'>('admin');
  const [localVisibility, setLocalVisibility] = useState<TabVisibility>({
    adminTabs: Object.fromEntries(ADMIN_TABS.map(t => [t.id, true])),
    dentistTabs: Object.fromEntries(DENTIST_TABS.map(t => [t.id, true])),
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch saved visibility from global_settings
  const { data: savedVisibility, isLoading } = useQuery({
    queryKey: ['tab-visibility-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'tab_visibility')
        .maybeSingle();
      if (error) throw error;
      return data?.value as unknown as TabVisibility | null;
    },
  });

  // Load saved visibility
  useEffect(() => {
    if (savedVisibility) {
      setLocalVisibility({
        adminTabs: { 
          ...Object.fromEntries(ADMIN_TABS.map(t => [t.id, true])),
          ...savedVisibility.adminTabs 
        },
        dentistTabs: { 
          ...Object.fromEntries(DENTIST_TABS.map(t => [t.id, true])),
          ...savedVisibility.dentistTabs 
        },
      });
    }
  }, [savedVisibility]);

  // Save visibility settings
  const saveVisibility = useMutation({
    mutationFn: async (visibility: TabVisibility) => {
      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: 'tab_visibility',
          value: visibility as any,
          description: 'Tab visibility settings for admin and dentist dashboards',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;

      await createAuditLog({
        action: 'UPDATE_TAB_VISIBILITY',
        entityType: 'global_settings',
        entityId: 'tab_visibility',
        newValues: { 
          hiddenAdminTabs: Object.entries(visibility.adminTabs).filter(([, v]) => !v).map(([k]) => k),
          hiddenDentistTabs: Object.entries(visibility.dentistTabs).filter(([, v]) => !v).map(([k]) => k),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tab-visibility-settings'] });
      toast.success('Tab visibility saved successfully');
      setHasChanges(false);
    },
    onError: (e: Error) => toast.error('Failed to save: ' + e.message),
  });

  const toggleTab = (tabId: string, section: 'admin' | 'dentist') => {
    setLocalVisibility(prev => ({
      ...prev,
      [section === 'admin' ? 'adminTabs' : 'dentistTabs']: {
        ...prev[section === 'admin' ? 'adminTabs' : 'dentistTabs'],
        [tabId]: !prev[section === 'admin' ? 'adminTabs' : 'dentistTabs'][tabId],
      },
    }));
    setHasChanges(true);
  };

  const toggleAll = (section: 'admin' | 'dentist', visible: boolean) => {
    const tabs = section === 'admin' ? ADMIN_TABS : DENTIST_TABS;
    setLocalVisibility(prev => ({
      ...prev,
      [section === 'admin' ? 'adminTabs' : 'dentistTabs']: Object.fromEntries(
        tabs.map(t => [t.id, visible])
      ),
    }));
    setHasChanges(true);
  };

  // Group tabs by their group property
  const groupTabs = (tabs: typeof ADMIN_TABS, visibility: Record<string, boolean>) => {
    const groups: Record<string, typeof ADMIN_TABS> = {};
    tabs.forEach(tab => {
      if (!groups[tab.group]) groups[tab.group] = [];
      groups[tab.group].push(tab);
    });
    return groups;
  };

  const currentTabs = activeSection === 'admin' ? ADMIN_TABS : DENTIST_TABS;
  const currentVisibility = activeSection === 'admin' ? localVisibility.adminTabs : localVisibility.dentistTabs;
  const groupedTabs = groupTabs(currentTabs, currentVisibility);

  const filteredGroups = Object.entries(groupedTabs).reduce((acc, [group, tabs]) => {
    const filtered = tabs.filter(tab => 
      tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tab.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) acc[group] = filtered;
    return acc;
  }, {} as Record<string, typeof ADMIN_TABS>);

  const visibleCount = Object.values(currentVisibility).filter(Boolean).length;
  const totalCount = currentTabs.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Eye className="h-8 w-8 text-primary" />
            Tab Visibility Control
          </h1>
          <p className="text-muted-foreground mt-1">
            Control which tabs are visible in Super Admin and Dentist dashboards
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button 
              onClick={() => saveVisibility.mutate(localVisibility)}
              disabled={saveVisibility.isPending}
              className="gap-2 bg-teal hover:bg-teal/90"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tab-visibility-settings'] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">How This Works</p>
              <p className="text-muted-foreground">
                Turning off a tab will hide it from the sidebar navigation for all users of that dashboard type.
                Hidden tabs won't be accessible even via direct URL. All changes are logged to the audit trail.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as 'admin' | 'dentist')}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="admin" className="gap-2">
              <Shield className="h-4 w-4" />
              Super Admin Tabs
            </TabsTrigger>
            <TabsTrigger value="dentist" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Dentist Dashboard Tabs
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {visibleCount} / {totalCount} Visible
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
          <Input
            placeholder="Search tabs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => toggleAll(activeSection, true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Show All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => toggleAll(activeSection, false)}
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Hide All
            </Button>
          </div>
        </div>

        <TabsContent value="admin" className="mt-6">
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(filteredGroups).map(([group, tabs]) => (
              <Card key={group}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">{group}</CardTitle>
                  <CardDescription className="text-xs">
                    {tabs.filter(t => currentVisibility[t.id]).length} / {tabs.length} visible
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tabs.map(tab => {
                    const Icon = iconMap[tab.icon] || Eye;
                    const isVisible = currentVisibility[tab.id];
                    
                    return (
                      <div
                        key={tab.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                          isVisible ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`} />
                          <span className={`text-sm ${isVisible ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                            {tab.label}
                          </span>
                        </div>
                        <Switch
                          checked={isVisible}
                          onCheckedChange={() => toggleTab(tab.id, 'admin')}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="dentist" className="mt-6">
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(filteredGroups).map(([group, tabs]) => (
              <Card key={group}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">{group}</CardTitle>
                  <CardDescription className="text-xs">
                    {tabs.filter(t => currentVisibility[t.id]).length} / {tabs.length} visible
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tabs.map(tab => {
                    const Icon = iconMap[tab.icon] || Eye;
                    const isVisible = currentVisibility[tab.id];
                    
                    return (
                      <div
                        key={tab.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                          isVisible ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`} />
                          <span className={`text-sm ${isVisible ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                            {tab.label}
                          </span>
                        </div>
                        <Switch
                          checked={isVisible}
                          onCheckedChange={() => toggleTab(tab.id, 'dentist')}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
