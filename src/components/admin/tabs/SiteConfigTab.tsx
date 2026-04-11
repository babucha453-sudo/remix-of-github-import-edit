import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACTIVE_STATE_SLUGS } from '@/lib/constants/activeStates';
import { 
  Layout, 
  Menu, 
  Link as LinkIcon, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  GripVertical,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

interface NavLink {
  id: string;
  label: string;
  path: string;
  order: number;
  isActive: boolean;
  type: 'main' | 'dropdown' | 'mobile';
}

interface FooterLink {
  label: string;
  path: string;
  external?: boolean;
}

interface FooterSection {
  id: string;
  title: string;
  links: FooterLink[];
  order: number;
}

interface SocialLink {
  id: string;
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
  url: string;
  isActive: boolean;
}

// Static pages available in the app
const STATIC_PAGES = [
  { label: 'Home', path: '/' },
  { label: 'About Us', path: '/about' },
  { label: 'Contact', path: '/contact' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Blog', path: '/blog' },
  { label: 'Services', path: '/services' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'How It Works', path: '/how-it-works' },
  { label: 'List Your Practice', path: '/list-your-practice' },
  { label: 'Privacy Policy', path: '/privacy' },
  { label: 'Terms of Service', path: '/terms' },
  { label: 'Insurance', path: '/insurance' },
];

export default function SiteConfigTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('header');

  // Fetch treatments (services) for link selection
  const { data: treatments = [] } = useQuery({
    queryKey: ['treatments-for-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch states for link selection (active states only)
  const { data: states = [] } = useQuery({
    queryKey: ['states-for-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('states')
        .select('id, name, slug')
        .eq('is_active', true)
        .in('slug', ACTIVE_STATE_SLUGS)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch cities for link selection
  const { data: cities = [] } = useQuery({
    queryKey: ['cities-for-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, slug, states!cities_state_id_fkey(slug)')
        .eq('is_active', true)
        .order('name')
        .limit(100);
      if (error) throw error;
      return (data || []).map((city: any) => ({
        ...city,
        state_slug: city.states?.slug || '',
      }));
    },
  });

  // Fetch site config from global_settings
  const { data: siteConfig, isLoading } = useQuery({
    queryKey: ['site-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .in('key', ['header_nav', 'footer_config', 'social_links', 'contact_details', 'platform', 'legal']);
      if (error) throw error;
      
      const config: Record<string, unknown> = {};
      (data || []).forEach((item: any) => {
        config[item.key] = item.value;
      });
      return config;
    },
  });

  // Header Navigation State
  const [headerLinks, setHeaderLinks] = useState<NavLink[]>([]);
  const [editingLink, setEditingLink] = useState<NavLink | null>(null);
  const [linkForm, setLinkForm] = useState({ label: '', path: '', type: 'main' as NavLink['type'] });

  // Footer State
  const [footerSections, setFooterSections] = useState<FooterSection[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [footerText, setFooterText] = useState({
    copyright: '© 2025 AppointPanda. All rights reserved.',
    legal: 'Licensed Dental Professionals Only.',
  });

  // Load config into state when fetched
  useEffect(() => {
    if (siteConfig) {
      // Load header links
      const headerNav = siteConfig['header_nav'] as any;
      if (headerNav?.links?.length > 0) {
        setHeaderLinks(headerNav.links);
      } else {
        // Default header links (no /ae/ prefix)
        setHeaderLinks([
          { id: '1', label: 'Find Dentist', path: '/search', order: 1, isActive: true, type: 'main' },
          { id: '2', label: 'Services', path: '/services', order: 2, isActive: true, type: 'main' },
          { id: '3', label: 'About', path: '/about', order: 3, isActive: true, type: 'main' },
          { id: '4', label: 'Blog', path: '/blog', order: 4, isActive: true, type: 'main' },
          { id: '5', label: 'Contact', path: '/contact', order: 5, isActive: true, type: 'main' },
          { id: '6', label: 'Pricing', path: '/pricing', order: 6, isActive: true, type: 'main' },
        ]);
      }

      // Load footer config
      const footerConfig = siteConfig['footer_config'] as any;
      if (footerConfig?.sections?.length > 0) {
        setFooterSections(footerConfig.sections);
      } else {
        // Default footer sections (no /ae/ prefix)
        setFooterSections([
          { id: '1', title: 'Services', order: 1, links: [
            { label: 'Teeth Whitening', path: '/services/teeth-whitening' },
            { label: 'Dental Implants', path: '/services/dental-implants' },
            { label: 'Invisalign', path: '/services/invisalign' },
          ]},
          { id: '2', title: 'Locations', order: 2, links: [
            { label: 'California', path: '/ca' },
            { label: 'Massachusetts', path: '/ma' },
          ]},
          { id: '3', title: 'Company', order: 3, links: [
            { label: 'About Us', path: '/about' },
            { label: 'Contact', path: '/contact' },
            { label: 'FAQs', path: '/faq' },
            { label: 'Pricing', path: '/pricing' },
          ]},
        ]);
      }

      // Load social links
      const socialConfig = siteConfig['social_links'] as any;
      if (socialConfig?.facebook || socialConfig?.instagram || socialConfig?.twitter || socialConfig?.linkedin) {
        setSocialLinks([
          { id: '1', platform: 'facebook', url: socialConfig.facebook || '', isActive: !!socialConfig.facebook },
          { id: '2', platform: 'instagram', url: socialConfig.instagram || '', isActive: !!socialConfig.instagram },
          { id: '3', platform: 'twitter', url: socialConfig.twitter || '', isActive: !!socialConfig.twitter },
          { id: '4', platform: 'linkedin', url: socialConfig.linkedin || '', isActive: !!socialConfig.linkedin },
          { id: '5', platform: 'youtube', url: socialConfig.youtube || '', isActive: !!socialConfig.youtube },
          { id: '6', platform: 'tiktok', url: socialConfig.tiktok || '', isActive: !!socialConfig.tiktok },
        ]);
      } else if (socialConfig?.links) {
        // Handle old format
        setSocialLinks(socialConfig.links);
      } else {
        setSocialLinks([
          { id: '1', platform: 'facebook', url: '', isActive: false },
          { id: '2', platform: 'instagram', url: '', isActive: false },
          { id: '3', platform: 'twitter', url: '', isActive: false },
          { id: '4', platform: 'linkedin', url: '', isActive: false },
          { id: '5', platform: 'youtube', url: '', isActive: false },
          { id: '6', platform: 'tiktok', url: '', isActive: false },
        ]);
      }

      // Load legal/footer text
      const legal = siteConfig['legal'] as any;
      if (legal) {
        setFooterText({
          copyright: legal.copyright_text || '© 2025 AppointPanda. All rights reserved.',
          legal: legal.footer_text || 'Licensed Dental Professionals Only.',
        });
      }
    }
  }, [siteConfig]);

  // Save config mutation
  const saveConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> | unknown[] | string }) => {
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', key)
        .single();
      
      if (existing) {
        const { error } = await supabase
          .from('global_settings')
          .update({ value: value as any, updated_at: new Date().toISOString() })
          .eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert([{ key, value: value as any }]);
        if (error) throw error;
      }
      
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'global_settings',
        entityId: key,
        newValues: value as Record<string, unknown>,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-config'] });
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveHeader = async () => {
    await saveConfig.mutateAsync({ key: 'header_nav', value: { links: headerLinks } });
    toast.success('Header configuration saved');
  };

  const handleSaveFooter = async () => {
    // Save footer sections
    await saveConfig.mutateAsync({ key: 'footer_config', value: { sections: footerSections } });
    
    // Save social links in the new format used by useSiteSettings
    const socialObj: Record<string, string> = {};
    socialLinks.forEach(s => {
      if (s.isActive && s.url) {
        socialObj[s.platform] = s.url;
      }
    });
    await saveConfig.mutateAsync({ key: 'social_links', value: socialObj });
    
    // Save legal text
    await saveConfig.mutateAsync({ 
      key: 'legal', 
      value: { 
        copyright_text: footerText.copyright, 
        footer_text: footerText.legal 
      } 
    });
    
    toast.success('Footer configuration saved');
  };

  const addHeaderLink = () => {
    if (!linkForm.label || !linkForm.path) {
      toast.error('Please fill in label and path');
      return;
    }
    const newLink: NavLink = {
      id: Date.now().toString(),
      label: linkForm.label,
      path: linkForm.path,
      order: headerLinks.length + 1,
      isActive: true,
      type: linkForm.type,
    };
    setHeaderLinks([...headerLinks, newLink]);
    setLinkForm({ label: '', path: '', type: 'main' });
    setEditingLink(null);
  };

  const updateHeaderLink = () => {
    if (!editingLink) return;
    setHeaderLinks(headerLinks.map(l => 
      l.id === editingLink.id 
        ? { ...l, label: linkForm.label, path: linkForm.path, type: linkForm.type }
        : l
    ));
    setEditingLink(null);
    setLinkForm({ label: '', path: '', type: 'main' });
  };

  const deleteHeaderLink = (id: string) => {
    setHeaderLinks(headerLinks.filter(l => l.id !== id));
  };

  const toggleLinkActive = (id: string) => {
    setHeaderLinks(headerLinks.map(l => 
      l.id === id ? { ...l, isActive: !l.isActive } : l
    ));
  };

  // Build linkable pages list
  const getLinkablePages = () => {
    const pages: { label: string; path: string; category: string }[] = [];
    
    // Static pages
    STATIC_PAGES.forEach(p => {
      pages.push({ ...p, category: 'Pages' });
    });
    
    // Services
    treatments.forEach((t: any) => {
      pages.push({ label: t.name, path: `/services/${t.slug}`, category: 'Services' });
    });
    
    // States
    states.forEach((s: any) => {
      pages.push({ label: s.name, path: `/${s.slug}`, category: 'States' });
    });
    
    // Cities
    cities.forEach((c: any) => {
      if (c.state_slug) {
        pages.push({ label: `${c.name}`, path: `/${c.state_slug}/${c.slug}`, category: 'Cities' });
      }
    });
    
    return pages;
  };

  const linkablePages = getLinkablePages();

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return Facebook;
      case 'instagram': return Instagram;
      case 'twitter': return Twitter;
      case 'linkedin': return Linkedin;
      case 'youtube': return Youtube;
      case 'tiktok': return Globe;
      default: return LinkIcon;
    }
  };

  const addFooterSection = () => {
    const newSection: FooterSection = {
      id: Date.now().toString(),
      title: 'New Section',
      links: [],
      order: footerSections.length + 1,
    };
    setFooterSections([...footerSections, newSection]);
  };

  const deleteFooterSection = (id: string) => {
    setFooterSections(footerSections.filter(s => s.id !== id));
  };

  const addLinkToSection = (sectionId: string) => {
    setFooterSections(footerSections.map(s =>
      s.id === sectionId 
        ? { ...s, links: [...s.links, { label: '', path: '' }] }
        : s
    ));
  };

  const updateSectionLink = (sectionId: string, linkIndex: number, field: 'label' | 'path', value: string) => {
    setFooterSections(footerSections.map(s => {
      if (s.id !== sectionId) return s;
      const newLinks = [...s.links];
      newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
      return { ...s, links: newLinks };
    }));
  };

  const removeLinkFromSection = (sectionId: string, linkIndex: number) => {
    setFooterSections(footerSections.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, links: s.links.filter((_, i) => i !== linkIndex) };
    }));
  };

  const selectPageForLink = (sectionId: string, linkIndex: number, path: string) => {
    const page = linkablePages.find(p => p.path === path);
    if (page) {
      setFooterSections(footerSections.map(s => {
        if (s.id !== sectionId) return s;
        const newLinks = [...s.links];
        newLinks[linkIndex] = { label: page.label, path: page.path };
        return { ...s, links: newLinks };
      }));
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
          <h1 className="text-3xl font-display font-bold text-foreground">Site Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage header navigation and footer content</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="header" className="rounded-xl">
            <Menu className="h-4 w-4 mr-2" />
            Header / Navigation
          </TabsTrigger>
          <TabsTrigger value="footer" className="rounded-xl">
            <Layout className="h-4 w-4 mr-2" />
            Footer
          </TabsTrigger>
        </TabsList>

        {/* HEADER TAB */}
        <TabsContent value="header" className="mt-4 space-y-4">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Navigation Links</CardTitle>
                <CardDescription>Configure the main navigation menu</CardDescription>
              </div>
              <Button onClick={handleSaveHeader} disabled={saveConfig.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Header
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add/Edit Link Form */}
              <div className="p-4 bg-muted/30 rounded-xl space-y-4">
                <h4 className="font-medium">{editingLink ? 'Edit Link' : 'Add New Link'}</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>Label</Label>
                    <Input
                      value={linkForm.label}
                      onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
                      placeholder="Link label"
                    />
                  </div>
                  <div>
                    <Label>Select Page</Label>
                    <Select
                      value={linkForm.path}
                      onValueChange={(value) => {
                        const page = linkablePages.find(p => p.path === value);
                        setLinkForm({ 
                          ...linkForm, 
                          path: value,
                          label: linkForm.label || page?.label || ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a page" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {['Pages', 'Services', 'States', 'Cities'].map(category => {
                          const categoryPages = linkablePages.filter(p => p.category === category);
                          if (categoryPages.length === 0) return null;
                          return (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{category}</div>
                              {categoryPages.slice(0, category === 'Cities' ? 20 : undefined).map((page) => (
                                <SelectItem key={page.path} value={page.path}>
                                  {page.label}
                                </SelectItem>
                              ))}
                            </div>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Or Custom Path</Label>
                    <Input
                      value={linkForm.path}
                      onChange={(e) => setLinkForm({ ...linkForm, path: e.target.value })}
                      placeholder="/custom-path"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={linkForm.type}
                      onValueChange={(value) => setLinkForm({ ...linkForm, type: value as NavLink['type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main">Main Link</SelectItem>
                        <SelectItem value="dropdown">Dropdown</SelectItem>
                        <SelectItem value="mobile">Mobile Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingLink ? (
                    <>
                      <Button onClick={updateHeaderLink}>Update Link</Button>
                      <Button variant="outline" onClick={() => {
                        setEditingLink(null);
                        setLinkForm({ label: '', path: '', type: 'main' });
                      }}>Cancel</Button>
                    </>
                  ) : (
                    <Button onClick={addHeaderLink}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Link
                    </Button>
                  )}
                </div>
              </div>

              {/* Links Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headerLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      </TableCell>
                      <TableCell className="font-medium">{link.label}</TableCell>
                      <TableCell className="text-muted-foreground">{link.path}</TableCell>
                      <TableCell className="capitalize">{link.type}</TableCell>
                      <TableCell>
                        <Switch
                          checked={link.isActive}
                          onCheckedChange={() => toggleLinkActive(link.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingLink(link);
                            setLinkForm({ label: link.label, path: link.path, type: link.type });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteHeaderLink(link.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FOOTER TAB */}
        <TabsContent value="footer" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleSaveFooter} disabled={saveConfig.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Footer
            </Button>
          </div>

          {/* Social Links */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Social Media Links
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {socialLinks.map((social) => {
                  const Icon = getSocialIcon(social.platform);
                  return (
                    <div key={social.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground capitalize">{social.platform}</Label>
                        <Input
                          value={social.url}
                          onChange={(e) => setSocialLinks(socialLinks.map(s => 
                            s.id === social.id ? { ...s, url: e.target.value, isActive: !!e.target.value } : s
                          ))}
                          placeholder={`https://${social.platform}.com/...`}
                          className="mt-1"
                        />
                      </div>
                      <Switch
                        checked={social.isActive}
                        onCheckedChange={(checked) => setSocialLinks(socialLinks.map(s =>
                          s.id === social.id ? { ...s, isActive: checked } : s
                        ))}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Footer Text */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Footer Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Copyright Text</Label>
                  <Input
                    value={footerText.copyright}
                    onChange={(e) => setFooterText({ ...footerText, copyright: e.target.value })}
                    placeholder="© 2025 Company. All rights reserved."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Legal Text</Label>
                  <Input
                    value={footerText.legal}
                    onChange={(e) => setFooterText({ ...footerText, legal: e.target.value })}
                    placeholder="Licensed Professionals Only."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer Sections */}
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Footer Link Sections
                </CardTitle>
                <CardDescription>
                  Manage footer columns. Select pages from the dropdown or enter custom paths.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={addFooterSection}>
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {footerSections.map((section) => (
                  <div key={section.id} className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <Input
                        value={section.title}
                        onChange={(e) => setFooterSections(footerSections.map(s =>
                          s.id === section.id ? { ...s, title: e.target.value } : s
                        ))}
                        className="font-semibold text-lg"
                        placeholder="Section Title"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive shrink-0 ml-2"
                        onClick={() => deleteFooterSection(section.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {section.links.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded-lg">
                          <div className="flex-1 space-y-1">
                            <Select
                              value={link.path}
                              onValueChange={(value) => selectPageForLink(section.id, idx, value)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Select a page..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                {['Pages', 'Services', 'States', 'Cities'].map(category => {
                                  const categoryPages = linkablePages.filter(p => p.category === category);
                                  if (categoryPages.length === 0) return null;
                                  return (
                                    <div key={category}>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{category}</div>
                                      {categoryPages.slice(0, category === 'Cities' ? 20 : undefined).map((page) => (
                                        <SelectItem key={page.path} value={page.path}>
                                          {page.label}
                                        </SelectItem>
                                      ))}
                                    </div>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-1">
                              <Input
                                value={link.label}
                                onChange={(e) => updateSectionLink(section.id, idx, 'label', e.target.value)}
                                placeholder="Label"
                                className="text-xs h-8"
                              />
                              <Input
                                value={link.path}
                                onChange={(e) => updateSectionLink(section.id, idx, 'path', e.target.value)}
                                placeholder="Path"
                                className="text-xs h-8"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive shrink-0"
                            onClick={() => removeLinkFromSection(section.id, idx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => addLinkToSection(section.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Link
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
