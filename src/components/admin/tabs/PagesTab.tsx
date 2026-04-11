import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllPageContent, useUpsertPageContent, getDefaultPageContent, PageContent } from '@/hooks/usePageContent';
import { useTreatments } from '@/hooks/useTreatments';
import { useAdminClinics } from '@/hooks/useAdminClinics';
import { useAdminBlogPosts } from '@/hooks/useAdminBlog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  FileText, Search, Plus, Edit, Eye, EyeOff, Globe, ExternalLink, MapPin, 
  Stethoscope, Building2, BookOpen, Save, Type, AlignLeft, Image, Map,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface PageItem {
  id: string;
  type: 'static' | 'state' | 'city' | 'treatment' | 'clinic' | 'blog' | 'service-location';
  name: string;
  url: string;
  published: boolean;
  indexed: boolean;
  data?: any;
  stateSlug?: string;
  citySlug?: string;
}

export default function PagesTab() {
  const [filters, setFilters] = useState({ type: 'all', search: '' });
  const [displayLimit, setDisplayLimit] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Fetch only ACTIVE states
  const { data: states, isLoading: statesLoading } = useQuery({
    queryKey: ['admin-states-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch cities with state info - only from ACTIVE states
  const { data: cities, isLoading: citiesLoading } = useQuery({
    queryKey: ['admin-cities-with-active-states'],
    queryFn: async () => {
      // First get active state IDs
      const { data: activeStates } = await supabase
        .from('states')
        .select('id')
        .eq('is_active', true);
      
      const activeStateIds = (activeStates || []).map(s => s.id);
      if (activeStateIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('cities')
        .select('*, state:states(id, name, slug, abbreviation)')
        .eq('is_active', true)
        .in('state_id', activeStateIds)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: treatments, isLoading: treatmentsLoading } = useTreatments();
  const { data: clinics, isLoading: clinicsLoading } = useAdminClinics();
  const { data: blogPosts, isLoading: blogLoading } = useAdminBlogPosts();
  
  // Use page_content table
  const { data: pageContents } = useAllPageContent({});
  const upsertPageContent = useUpsertPageContent();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageItem | null>(null);
  const [activeEditTab, setActiveEditTab] = useState('seo');
  
  // Create page form state
  const [createForm, setCreateForm] = useState({
    pageType: '' as string,
    stateId: '',
    cityId: '',
    treatmentId: '',
    customSlug: '',
    customName: '',
  });

  // Edit form state - matches page_content table structure
  const [editForm, setEditForm] = useState<Partial<PageContent>>({
    meta_title: '',
    meta_description: '',
    keywords: [],
    og_image: '',
    noindex: false,
    h1: '',
    hero_subtitle: '',
    hero_intro: '',
    hero_image: '',
    section_1_title: '',
    section_1_content: '',
    section_2_title: '',
    section_2_content: '',
    section_3_title: '',
    section_3_content: '',
    body_content: '',
    cta_text: '',
    cta_button_text: '',
    cta_button_url: '',
    faqs: [],
    featured_image: '',
    is_published: true,
  });

  const isLoading = statesLoading || citiesLoading || treatmentsLoading || clinicsLoading || blogLoading;

  // Build URL based on page type and location - use abbreviation for states
  const buildUrl = (type: string, stateSlug?: string, citySlug?: string, slug?: string): string => {
    switch (type) {
      case 'state':
        return `/${stateSlug}`;
      case 'city':
        return stateSlug && citySlug ? `/${stateSlug}/${citySlug}` : `/${citySlug}`;
      case 'treatment':
        return `/services/${slug}`;
      case 'service-location':
        return stateSlug && citySlug && slug ? `/${stateSlug}/${citySlug}/${slug}` : `/services/${slug}`;
      case 'clinic':
        return `/clinic/${slug}`;
      case 'blog':
        return `/blog/${slug}`;
      default:
        return `/${slug || ''}`;
    }
  };

  // Build all website pages list
  const allPages: PageItem[] = [
    // Static pages
    { id: 'home', type: 'static', name: 'Home Page', url: '/', published: true, indexed: true },
    { id: 'about', type: 'static', name: 'About Us', url: '/about', published: true, indexed: true },
    { id: 'contact', type: 'static', name: 'Contact Us', url: '/contact', published: true, indexed: true },
    { id: 'search', type: 'static', name: 'Search / Find Dentists', url: '/search', published: true, indexed: true },
    { id: 'services', type: 'static', name: 'All Services', url: '/services', published: true, indexed: true },
    { id: 'faq', type: 'static', name: 'FAQ', url: '/faq', published: true, indexed: true },
    { id: 'privacy', type: 'static', name: 'Privacy Policy', url: '/privacy', published: true, indexed: true },
    { id: 'terms', type: 'static', name: 'Terms of Service', url: '/terms', published: true, indexed: true },
    { id: 'insurance', type: 'static', name: 'Insurance', url: '/insurance', published: true, indexed: true },
    { id: 'how-it-works', type: 'static', name: 'How It Works', url: '/how-it-works', published: true, indexed: true },
    
    // State pages - use slug (which is now abbreviation in lowercase)
    ...(states || []).map(state => ({
      id: `state-${state.id}`,
      type: 'state' as const,
      name: `${state.name} (${state.abbreviation})`,
      url: buildUrl('state', state.slug),
      published: state.is_active,
      indexed: state.is_active,
      data: state,
      stateSlug: state.slug,
    })),
    
    // City pages (with state prefix)
    ...(cities || []).map(city => ({
      id: `city-${city.id}`,
      type: 'city' as const,
      name: `${city.name}, ${city.state?.abbreviation || city.state?.name || ''}`,
      url: buildUrl('city', city.state?.slug, city.slug),
      published: city.is_active,
      indexed: city.is_active,
      data: city,
      stateSlug: city.state?.slug,
      citySlug: city.slug,
    })),
    
    // Treatment/Service pages
    ...(treatments || []).map(treatment => ({
      id: `treatment-${treatment.id}`,
      type: 'treatment' as const,
      name: treatment.name,
      url: buildUrl('treatment', undefined, undefined, treatment.slug),
      published: treatment.is_active,
      indexed: treatment.is_active,
      data: treatment,
    })),
    
    // Service + Location pages
    ...((cities || []).flatMap(city => 
      (treatments || []).map(treatment => ({
        id: `service-location-${city.id}-${treatment.id}`,
        type: 'service-location' as const,
        name: `${treatment.name} in ${city.name}, ${city.state?.abbreviation || ''}`,
        url: buildUrl('service-location', city.state?.slug, city.slug, treatment.slug),
        published: city.is_active && treatment.is_active,
        indexed: city.is_active && treatment.is_active,
        data: { city, treatment },
        stateSlug: city.state?.slug,
        citySlug: city.slug,
      }))
    )),
    
    // Clinic pages
    ...(clinics || []).map(clinic => ({
      id: `clinic-${clinic.id}`,
      type: 'clinic' as const,
      name: clinic.name,
      url: buildUrl('clinic', undefined, undefined, clinic.slug),
      published: clinic.is_active,
      indexed: clinic.is_active,
      data: clinic,
    })),
    
    // Blog pages
    ...(blogPosts || []).map(post => ({
      id: `blog-${post.id}`,
      type: 'blog' as const,
      name: post.title,
      url: buildUrl('blog', undefined, undefined, post.slug),
      published: post.status === 'published',
      indexed: post.status === 'published',
      data: post,
    })),
  ];

  // Filter pages
  const filteredPages = allPages.filter(page => {
    const matchesType = filters.type === 'all' || page.type === filters.type;
    const matchesSearch = !filters.search || 
      page.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      page.url.toLowerCase().includes(filters.search.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Count by type
  const pageCounts = {
    all: allPages.length,
    static: allPages.filter(p => p.type === 'static').length,
    state: allPages.filter(p => p.type === 'state').length,
    city: allPages.filter(p => p.type === 'city').length,
    treatment: allPages.filter(p => p.type === 'treatment').length,
    'service-location': allPages.filter(p => p.type === 'service-location').length,
    clinic: allPages.filter(p => p.type === 'clinic').length,
    blog: allPages.filter(p => p.type === 'blog').length,
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayLimit(prev => prev + 50);
      setIsLoadingMore(false);
    }, 300);
  };

  const openEditPage = (page: PageItem) => {
    setEditingPage(page);
    setActiveEditTab('seo');
    
    // Find existing page content from database
    const existingContent = pageContents?.find(p => p.page_slug === page.url);
    
    if (existingContent) {
      // Load existing content from database
      setEditForm({
        meta_title: existingContent.meta_title || '',
        meta_description: existingContent.meta_description || '',
        keywords: existingContent.keywords || [],
        og_image: existingContent.og_image || '',
        noindex: existingContent.noindex || false,
        h1: existingContent.h1 || '',
        hero_subtitle: existingContent.hero_subtitle || '',
        hero_intro: existingContent.hero_intro || '',
        hero_image: existingContent.hero_image || '',
        section_1_title: existingContent.section_1_title || '',
        section_1_content: existingContent.section_1_content || '',
        section_2_title: existingContent.section_2_title || '',
        section_2_content: existingContent.section_2_content || '',
        section_3_title: existingContent.section_3_title || '',
        section_3_content: existingContent.section_3_content || '',
        body_content: existingContent.body_content || '',
        cta_text: existingContent.cta_text || '',
        cta_button_text: existingContent.cta_button_text || '',
        cta_button_url: existingContent.cta_button_url || '',
        faqs: existingContent.faqs || [],
        featured_image: existingContent.featured_image || '',
        is_published: existingContent.is_published ?? true,
      });
    } else {
      // Generate default content based on page type and data
      const defaultContent = getDefaultPageContent(page.type, page.data, page.url);
      setEditForm({
        meta_title: defaultContent.h1 || page.name,
        meta_description: defaultContent.hero_subtitle || '',
        keywords: [],
        og_image: '',
        noindex: false,
        h1: defaultContent.h1 || page.name,
        hero_subtitle: defaultContent.hero_subtitle || '',
        hero_intro: defaultContent.hero_intro || '',
        hero_image: defaultContent.hero_image || '',
        section_1_title: defaultContent.section_1_title || '',
        section_1_content: defaultContent.section_1_content || '',
        section_2_title: defaultContent.section_2_title || '',
        section_2_content: defaultContent.section_2_content || '',
        section_3_title: '',
        section_3_content: '',
        body_content: defaultContent.body_content || '',
        cta_text: defaultContent.cta_text || '',
        cta_button_text: '',
        cta_button_url: '',
        faqs: defaultContent.faqs || [],
        featured_image: defaultContent.featured_image || '',
        is_published: true,
      });
    }
    
    setEditDialogOpen(true);
  };

  const handleSavePage = async () => {
    if (!editingPage) return;
    
    try {
      await upsertPageContent.mutateAsync({
        page_slug: editingPage.url,
        page_type: editingPage.type,
        meta_title: editForm.meta_title || null,
        meta_description: editForm.meta_description || null,
        keywords: editForm.keywords || null,
        og_image: editForm.og_image || null,
        noindex: editForm.noindex || false,
        h1: editForm.h1 || null,
        hero_subtitle: editForm.hero_subtitle || null,
        hero_intro: editForm.hero_intro || null,
        hero_image: editForm.hero_image || null,
        section_1_title: editForm.section_1_title || null,
        section_1_content: editForm.section_1_content || null,
        section_2_title: editForm.section_2_title || null,
        section_2_content: editForm.section_2_content || null,
        section_3_title: editForm.section_3_title || null,
        section_3_content: editForm.section_3_content || null,
        body_content: editForm.body_content || null,
        cta_text: editForm.cta_text || null,
        cta_button_text: editForm.cta_button_text || null,
        cta_button_url: editForm.cta_button_url || null,
        faqs: editForm.faqs || null,
        featured_image: editForm.featured_image || null,
        is_published: editForm.is_published ?? true,
      });
      
      setEditDialogOpen(false);
      setEditingPage(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCreatePage = async () => {
    if (!createForm.pageType) {
      toast.error('Please select a page type');
      return;
    }

    let pageUrl = '';
    let pageName = '';
    let pageType = createForm.pageType;

    switch (createForm.pageType) {
      case 'state': {
        const state = states?.find(s => s.id === createForm.stateId);
        if (!state) {
          toast.error('Please select a state');
          return;
        }
        pageUrl = `/${state.slug}`;
        pageName = state.name;
        break;
      }
      case 'city': {
        const city = cities?.find(c => c.id === createForm.cityId);
        if (!city) {
          toast.error('Please select a city');
          return;
        }
        pageUrl = `/${city.state?.slug}/${city.slug}`;
        pageName = `${city.name}, ${city.state?.abbreviation || city.state?.name || ''}`;
        break;
      }
      case 'treatment': {
        const treatment = treatments?.find(t => t.id === createForm.treatmentId);
        if (!treatment) {
          toast.error('Please select a treatment');
          return;
        }
        pageUrl = `/services/${treatment.slug}`;
        pageName = treatment.name;
        break;
      }
      case 'service-location': {
        const city = cities?.find(c => c.id === createForm.cityId);
        const treatment = treatments?.find(t => t.id === createForm.treatmentId);
        if (!city || !treatment) {
          toast.error('Please select both city and treatment');
          return;
        }
        pageUrl = `/${city.state?.slug}/${city.slug}/${treatment.slug}`;
        pageName = `${treatment.name} in ${city.name}`;
        break;
      }
      case 'custom': {
        if (!createForm.customSlug || !createForm.customName) {
          toast.error('Please enter page name and slug');
          return;
        }
        pageUrl = `/${createForm.customSlug}`;
        pageName = createForm.customName;
        pageType = 'static';
        break;
      }
    }

    try {
      const defaultContent = getDefaultPageContent(pageType, null, pageUrl);
      
      await upsertPageContent.mutateAsync({
        page_slug: pageUrl,
        page_type: pageType,
        h1: pageName,
        hero_subtitle: defaultContent.hero_subtitle || '',
        is_published: true,
      });
      
      toast.success('Page created successfully');
      setCreateDialogOpen(false);
      setCreateForm({ pageType: '', stateId: '', cityId: '', treatmentId: '', customSlug: '', customName: '' });
    } catch (error) {
      // Error handled by hook
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'state': return <Map className="h-4 w-4" />;
      case 'city': return <MapPin className="h-4 w-4" />;
      case 'treatment': return <Stethoscope className="h-4 w-4" />;
      case 'service-location': return <Stethoscope className="h-4 w-4" />;
      case 'clinic': return <Building2 className="h-4 w-4" />;
      case 'blog': return <BookOpen className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'state': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'city': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'treatment': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'service-location': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'clinic': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'blog': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Check if page has content in DB
  const hasContent = (pageUrl: string) => {
    return pageContents?.some(p => p.page_slug === pageUrl);
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
          <h1 className="text-3xl font-display font-bold text-foreground">Page Manager (CMS)</h1>
          <p className="text-muted-foreground mt-1">Manage all website pages, content, and SEO settings</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Page
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { key: 'all', label: 'All', icon: Globe, color: 'bg-primary/10 text-primary' },
          { key: 'static', label: 'Static', icon: FileText, color: 'bg-muted text-muted-foreground' },
          { key: 'state', label: 'States', icon: Map, color: 'bg-orange-100 text-orange-600' },
          { key: 'city', label: 'Cities', icon: MapPin, color: 'bg-blue-100 text-blue-600' },
          { key: 'treatment', label: 'Services', icon: Stethoscope, color: 'bg-purple-100 text-purple-600' },
          { key: 'service-location', label: 'Svc+Loc', icon: Stethoscope, color: 'bg-indigo-100 text-indigo-600' },
          { key: 'clinic', label: 'Clinics', icon: Building2, color: 'bg-teal-100 text-teal-600' },
          { key: 'blog', label: 'Blog', icon: BookOpen, color: 'bg-amber-100 text-amber-600' },
        ].map(item => (
          <Card 
            key={item.key}
            className={`card-modern cursor-pointer hover:border-primary/50 transition-colors ${filters.type === item.key ? 'border-primary ring-1 ring-primary' : ''}`}
            onClick={() => setFilters({ ...filters, type: item.key })}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${item.color} flex items-center justify-center`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold">{pageCounts[item.key as keyof typeof pageCounts]}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pages by name or URL..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types ({pageCounts.all})</SelectItem>
                <SelectItem value="static">Static Pages ({pageCounts.static})</SelectItem>
                <SelectItem value="state">State Pages ({pageCounts.state})</SelectItem>
                <SelectItem value="city">City Pages ({pageCounts.city})</SelectItem>
                <SelectItem value="treatment">Service Pages ({pageCounts.treatment})</SelectItem>
                <SelectItem value="service-location">Service+Location ({pageCounts['service-location']})</SelectItem>
                <SelectItem value="clinic">Clinic Pages ({pageCounts.clinic})</SelectItem>
                <SelectItem value="blog">Blog Posts ({pageCounts.blog})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="text-lg">
            {filters.type === 'all' ? 'All Pages' : `${filters.type.charAt(0).toUpperCase() + filters.type.slice(1)} Pages`} 
            <span className="text-muted-foreground font-normal ml-2">({filteredPages.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Page Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Content</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPages.slice(0, displayLimit).map((page) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      {getTypeIcon(page.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{page.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${getTypeBadgeColor(page.type)}`}>
                      {page.type === 'service-location' ? 'Svc+Loc' : page.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-xs">
                    <code className="text-xs truncate block">{page.url}</code>
                  </TableCell>
                  <TableCell>
                    {page.published ? (
                      <Badge className="bg-primary text-primary-foreground"><Eye className="h-3 w-3 mr-1" />Published</Badge>
                    ) : (
                      <Badge variant="secondary"><EyeOff className="h-3 w-3 mr-1" />Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasContent(page.url) ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Has Content</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditPage(page)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={page.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No pages found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredPages.length > displayLimit && (
            <div className="p-4 text-center border-t">
              <Button 
                variant="outline" 
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                ) : (
                  <>Load More ({filteredPages.length - displayLimit} remaining)</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Page Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Custom Page
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Page Type</Label>
              <Select value={createForm.pageType} onValueChange={(v) => setCreateForm({ ...createForm, pageType: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select page type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="state">
                    <div className="flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      State Page
                    </div>
                  </SelectItem>
                  <SelectItem value="city">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      City Page
                    </div>
                  </SelectItem>
                  <SelectItem value="treatment">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Service/Treatment Page
                    </div>
                  </SelectItem>
                  <SelectItem value="service-location">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Service + Location Page
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Custom Static Page
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createForm.pageType === 'state' && (
              <div className="space-y-2">
                <Label>Select State</Label>
                <Select value={createForm.stateId} onValueChange={(v) => setCreateForm({ ...createForm, stateId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a state..." />
                  </SelectTrigger>
                  <SelectContent>
                    {states?.map(state => (
                      <SelectItem key={state.id} value={state.id}>{state.name} ({state.abbreviation})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createForm.stateId && (
                  <p className="text-xs text-muted-foreground">
                    URL: <code>/{states?.find(s => s.id === createForm.stateId)?.slug}</code>
                  </p>
                )}
              </div>
            )}

            {(createForm.pageType === 'city' || createForm.pageType === 'service-location') && (
              <div className="space-y-2">
                <Label>Select City</Label>
                <Select value={createForm.cityId} onValueChange={(v) => setCreateForm({ ...createForm, cityId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a city..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cities?.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}, {city.state?.abbreviation || city.state?.name || ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createForm.cityId && createForm.pageType === 'city' && (
                  <p className="text-xs text-muted-foreground">
                    URL: <code>/{cities?.find(c => c.id === createForm.cityId)?.state?.slug}/{cities?.find(c => c.id === createForm.cityId)?.slug}</code>
                  </p>
                )}
              </div>
            )}

            {(createForm.pageType === 'treatment' || createForm.pageType === 'service-location') && (
              <div className="space-y-2">
                <Label>Select Service/Treatment</Label>
                <Select value={createForm.treatmentId} onValueChange={(v) => setCreateForm({ ...createForm, treatmentId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {treatments?.map(treatment => (
                      <SelectItem key={treatment.id} value={treatment.id}>{treatment.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createForm.treatmentId && createForm.pageType === 'treatment' && (
                  <p className="text-xs text-muted-foreground">
                    URL: <code>/services/{treatments?.find(t => t.id === createForm.treatmentId)?.slug}</code>
                  </p>
                )}
                {createForm.cityId && createForm.treatmentId && createForm.pageType === 'service-location' && (
                  <p className="text-xs text-muted-foreground">
                    URL: <code>/{cities?.find(c => c.id === createForm.cityId)?.state?.slug}/{cities?.find(c => c.id === createForm.cityId)?.slug}/{treatments?.find(t => t.id === createForm.treatmentId)?.slug}</code>
                  </p>
                )}
              </div>
            )}

            {createForm.pageType === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Page Name</Label>
                  <Input 
                    value={createForm.customName}
                    onChange={(e) => setCreateForm({ ...createForm, customName: e.target.value })}
                    placeholder="e.g., Our Team"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input 
                    value={createForm.customSlug}
                    onChange={(e) => setCreateForm({ ...createForm, customSlug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="e.g., our-team"
                  />
                  {createForm.customSlug && (
                    <p className="text-xs text-muted-foreground">
                      URL: <code>/{createForm.customSlug}</code>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePage} disabled={upsertPageContent.isPending}>
              {upsertPageContent.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Page: {editingPage?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-3 rounded-xl bg-muted/50 mb-4">
            <p className="text-sm text-muted-foreground">URL: <code className="text-primary font-mono">{editingPage?.url}</code></p>
          </div>
          
          <Tabs value={activeEditTab} onValueChange={setActiveEditTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="seo" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                SEO
              </TabsTrigger>
              <TabsTrigger value="hero" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Hero
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="media" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Media
              </TabsTrigger>
            </TabsList>
            
            {/* SEO Tab */}
            <TabsContent value="seo" className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  SEO Title (Browser Tab)
                </Label>
                <Input 
                  value={editForm.meta_title || ''} 
                  onChange={(e) => setEditForm({ ...editForm, meta_title: e.target.value })} 
                  placeholder="Page title for SEO (max 60 chars)"
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Appears in browser tab and search results</span>
                  <span className={(editForm.meta_title?.length || 0) > 60 ? 'text-destructive' : 'text-muted-foreground'}>
                    {editForm.meta_title?.length || 0}/60
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea 
                  value={editForm.meta_description || ''} 
                  onChange={(e) => setEditForm({ ...editForm, meta_description: e.target.value })} 
                  placeholder="Meta description for SEO (max 160 chars)"
                  rows={3}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Appears in search engine results</span>
                  <span className={(editForm.meta_description?.length || 0) > 160 ? 'text-destructive' : 'text-muted-foreground'}>
                    {editForm.meta_description?.length || 0}/160
                  </span>
                </div>
              </div>
              
              {/* SEO Preview */}
              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-2">Google Preview</p>
                <div className="space-y-1">
                  <p className="text-blue-600 text-lg hover:underline cursor-pointer truncate">
                    {editForm.meta_title || editForm.h1 || 'Page Title'}
                  </p>
                  <p className="text-green-700 text-sm truncate">
                    appointpanda.com{editingPage?.url}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {editForm.meta_description || 'No meta description set...'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">No Index</Label>
                  <p className="text-xs text-muted-foreground">Hide from search engines</p>
                </div>
                <Switch 
                  checked={editForm.noindex || false} 
                  onCheckedChange={(v) => setEditForm({ ...editForm, noindex: v })} 
                />
              </div>
            </TabsContent>
            
            {/* Hero Tab */}
            <TabsContent value="hero" className="space-y-4">
              <div className="space-y-2">
                <Label>H1 Heading (Main Title)</Label>
                <Input 
                  value={editForm.h1 || ''} 
                  onChange={(e) => setEditForm({ ...editForm, h1: e.target.value })} 
                  placeholder="Main page heading visible to users"
                />
                <p className="text-xs text-muted-foreground">The main visible heading on the page</p>
              </div>
              
              <div className="space-y-2">
                <Label>Hero Subtitle</Label>
                <Textarea 
                  value={editForm.hero_subtitle || ''} 
                  onChange={(e) => setEditForm({ ...editForm, hero_subtitle: e.target.value })} 
                  placeholder="Subtitle or tagline shown below the main heading..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Introduction Text</Label>
                <Textarea 
                  value={editForm.hero_intro || ''} 
                  onChange={(e) => setEditForm({ ...editForm, hero_intro: e.target.value })} 
                  placeholder="Brief introduction or summary shown at the top of the page..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Hero Image URL</Label>
                <Input 
                  value={editForm.hero_image || ''} 
                  onChange={(e) => setEditForm({ ...editForm, hero_image: e.target.value })} 
                  placeholder="https://example.com/hero-image.jpg"
                />
              </div>
            </TabsContent>
            
            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Section 1 Title</Label>
                  <Input 
                    value={editForm.section_1_title || ''} 
                    onChange={(e) => setEditForm({ ...editForm, section_1_title: e.target.value })} 
                    placeholder="e.g., Why Choose Us"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Section 2 Title</Label>
                  <Input 
                    value={editForm.section_2_title || ''} 
                    onChange={(e) => setEditForm({ ...editForm, section_2_title: e.target.value })} 
                    placeholder="e.g., Our Services"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Section 1 Content</Label>
                <Textarea 
                  value={editForm.section_1_content || ''} 
                  onChange={(e) => setEditForm({ ...editForm, section_1_content: e.target.value })} 
                  placeholder="Content for section 1..."
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Section 2 Content</Label>
                <Textarea 
                  value={editForm.section_2_content || ''} 
                  onChange={(e) => setEditForm({ ...editForm, section_2_content: e.target.value })} 
                  placeholder="Content for section 2..."
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Main Body Content</Label>
                <Textarea 
                  value={editForm.body_content || ''} 
                  onChange={(e) => setEditForm({ ...editForm, body_content: e.target.value })} 
                  placeholder="Main page content. Supports Markdown formatting..."
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label>FAQ Content (JSON)</Label>
                <Textarea 
                  value={JSON.stringify(editForm.faqs || [], null, 2)} 
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditForm({ ...editForm, faqs: parsed });
                    } catch {
                      // Keep raw text for editing
                    }
                  }} 
                  placeholder='[{"question": "...", "answer": "..."}]'
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Enter FAQ items as JSON array</p>
              </div>
              
              <div className="space-y-2">
                <Label>Call-to-Action Text</Label>
                <Textarea 
                  value={editForm.cta_text || ''} 
                  onChange={(e) => setEditForm({ ...editForm, cta_text: e.target.value })} 
                  placeholder="Call-to-action or footer content..."
                  rows={2}
                />
              </div>
            </TabsContent>
            
            {/* Media Tab */}
            <TabsContent value="media" className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  Featured Image URL
                </Label>
                <Input 
                  value={editForm.featured_image || ''} 
                  onChange={(e) => setEditForm({ ...editForm, featured_image: e.target.value })} 
                  placeholder="https://example.com/image.jpg"
                />
                {editForm.featured_image && (
                  <div className="mt-2 rounded-xl overflow-hidden border">
                    <img 
                      src={editForm.featured_image} 
                      alt="Featured" 
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>OG Image URL (Social Share)</Label>
                <Input 
                  value={editForm.og_image || ''} 
                  onChange={(e) => setEditForm({ ...editForm, og_image: e.target.value })} 
                  placeholder="https://example.com/og-image.jpg"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                  <div>
                    <Label className="text-sm">Published</Label>
                    <p className="text-xs text-muted-foreground">Make page visible</p>
                  </div>
                  <Switch 
                    checked={editForm.is_published ?? true} 
                    onCheckedChange={(v) => setEditForm({ ...editForm, is_published: v })} 
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                  <div>
                    <Label className="text-sm">No Index (SEO)</Label>
                    <p className="text-xs text-muted-foreground">Hide from search</p>
                  </div>
                  <Switch 
                    checked={editForm.noindex || false} 
                    onCheckedChange={(v) => setEditForm({ ...editForm, noindex: v })} 
                  />
                </div>
              </div>
              
              <div className="p-4 rounded-xl border bg-muted/30">
                <p className="text-sm font-medium mb-2">
                  Page Type: <Badge variant="outline" className={`ml-2 capitalize ${getTypeBadgeColor(editingPage?.type || '')}`}>{editingPage?.type}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {editingPage?.type === 'static' && 'Core website page - content fully customizable'}
                  {editingPage?.type === 'state' && 'State location page - shows cities in this state'}
                  {editingPage?.type === 'city' && 'City location page - shows clinics in this city'}
                  {editingPage?.type === 'treatment' && 'Treatment/service page - describes this dental service'}
                  {editingPage?.type === 'service-location' && 'Service in Location - e.g., "Teeth Whitening in Los Angeles"'}
                  {editingPage?.type === 'clinic' && 'Clinic profile page - supplements clinic data'}
                  {editingPage?.type === 'blog' && 'Blog post - edit in Blog Manager for full control'}
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePage} disabled={upsertPageContent.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}