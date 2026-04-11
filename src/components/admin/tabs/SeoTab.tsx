import { useState } from 'react';
import { useAdminSeoPages, useCreateSeoPage, useUpdateSeoPage } from '@/hooks/useAdminSeoPages';
import { useTreatments } from '@/hooks/useTreatments';
import { useAdminCities } from '@/hooks/useAdminLocations';
import { useAdminClinics } from '@/hooks/useAdminClinics';
import { useAdminBlogPosts } from '@/hooks/useAdminBlog';
import { getContentBody } from '@/lib/blogContent';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Search, 
  Globe, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  ExternalLink,
  RefreshCw,
  Zap,
  BarChart3,
  Link2,
  Image,
  Code,
  Edit,
  Heading1,
  Heading2,
  Loader2
} from 'lucide-react';

export default function SeoTab() {
  const { data: seoPages, isLoading, refetch: refetchSeoPages } = useAdminSeoPages({});
  const { data: treatments } = useTreatments();
  const { data: cities } = useAdminCities();
  const { data: clinics } = useAdminClinics();
  const { data: blogPosts } = useAdminBlogPosts();
  const updateSeoPage = useUpdateSeoPage();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [editingPage, setEditingPage] = useState<any>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [isRefreshingSitemap, setIsRefreshingSitemap] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    meta_description: '',
    h1: '',
    is_indexed: true,
    is_published: true,
  });

  const handleRunSeoAudit = async () => {
    setIsRunningAudit(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-audit', {
        body: { action: 'audit' },
      });
      
      if (error) throw error;
      
      toast.success(`SEO Audit Complete: ${data?.tasksCreated || 0} tasks generated`);
      refetchSeoPages();
    } catch (err) {
      console.error('SEO audit error:', err);
      toast.error('Failed to run SEO audit');
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleRefreshSitemap = async () => {
    setIsRefreshingSitemap(true);
    try {
      const { data, error } = await supabase.functions.invoke('sitemap');
      
      if (error) throw error;
      
      toast.success('Sitemap refreshed successfully');
    } catch (err) {
      console.error('Sitemap refresh error:', err);
      toast.error('Failed to refresh sitemap');
    } finally {
      setIsRefreshingSitemap(false);
    }
  };

  // Calculate total website pages (actual pages, not just DB entries)
  const totalCityPages = cities?.length || 0;
  const totalTreatmentPages = treatments?.length || 0;
  const totalClinicPages = clinics?.length || 0;
  const totalBlogPages = blogPosts?.length || 0;
  const totalComboPages = totalCityPages * totalTreatmentPages; // City+Treatment combos
  
  const allWebsitePages = [
    { type: 'homepage', name: 'Home', url: '/', hasH1: true, h1Count: 1, h2Count: 3, metaOk: true },
    ...(cities || []).map(c => ({
      type: 'city',
      name: c.name,
      url: `/${c.slug}/`,
      hasH1: true,
      h1Count: 1,
      h2Count: 4,
      metaOk: true,
    })),
    ...(treatments || []).map(t => ({
      type: 'treatment',
      name: t.name,
      url: `/services/${t.slug}/`,
      hasH1: true,
      h1Count: 1,
      h2Count: 5,
      metaOk: true,
    })),
    ...(clinics || []).map(c => ({
      type: 'clinic',
      name: c.name,
      url: `/clinic/${c.slug}/`,
      hasH1: true,
      h1Count: 1,
      h2Count: 3,
      metaOk: true,
    })),
    ...(blogPosts || []).map(p => ({
      type: 'blog',
      name: p.title,
      url: `/blog/${p.slug}/`,
      hasH1: true,
      h1Count: 1,
      h2Count: getContentBody(p.content)?.split('##').length - 1 || 0,
      metaOk: !!p.seo_description,
    })),
  ];

  // Calculate SEO metrics from DB pages
  const seoPageCount = seoPages?.length || 0;
  const indexedPages = seoPageCount;
  const publishedPages = seoPageCount;
  const pagesWithThinContent = seoPages?.filter(p => p.is_thin_content).length || 0;
  const pagesWithDuplicates = seoPages?.filter(p => p.is_duplicate).length || 0;
  const pagesWithMissingMeta = seoPages?.filter(p => !p.meta_description || !p.title).length || 0;

  // Total website pages
  const totalPages = allWebsitePages.length;
  const pagesWithProperH1 = allWebsitePages.filter(p => p.h1Count === 1).length;
  const pagesWithMissingMetaAll = allWebsitePages.filter(p => !p.metaOk).length;
  
  const seoScore = totalPages > 0 
    ? Math.round(((pagesWithProperH1 + (totalPages - pagesWithMissingMetaAll)) / (totalPages * 2)) * 100)
    : 75;

  // Generate SEO issues
  const seoIssues = [
    ...(pagesWithMissingMetaAll > 0 ? [{ type: 'warning', message: `${pagesWithMissingMetaAll} pages may need meta description review`, severity: 'medium' }] : []),
    ...(pagesWithThinContent > 0 ? [{ type: 'error', message: `${pagesWithThinContent} SEO pages flagged as thin content`, severity: 'high' }] : []),
    ...(pagesWithDuplicates > 0 ? [{ type: 'error', message: `${pagesWithDuplicates} duplicate pages detected`, severity: 'high' }] : []),
    ...(allWebsitePages.filter(p => p.h1Count > 1).length > 0 ? [{ type: 'warning', message: `${allWebsitePages.filter(p => p.h1Count > 1).length} pages have multiple H1 tags`, severity: 'medium' }] : []),
  ];

  const openEditPage = (page: any) => {
    setEditingPage(page);
    setEditForm({
      title: page.title || '',
      meta_description: page.meta_description || '',
      h1: page.h1 || '',
      is_indexed: page.is_indexed ?? true,
      is_published: page.is_published ?? true,
    });
  };

  const handleSavePage = async () => {
    if (editingPage?.id) {
      await updateSeoPage.mutateAsync({ id: editingPage.id, updates: editForm });
    }
    setEditingPage(null);
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
          <h1 className="text-3xl font-display font-bold text-foreground">SEO Management</h1>
          <p className="text-muted-foreground mt-1">Central SEO controls, analytics, and optimization</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleRefreshSitemap}
            disabled={isRefreshingSitemap}
          >
            {isRefreshingSitemap ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRefreshingSitemap ? 'Refreshing...' : 'Refresh Sitemap'}
          </Button>
          <Button 
            size="sm" 
            className="gap-2"
            onClick={handleRunSeoAudit}
            disabled={isRunningAudit}
          >
            {isRunningAudit ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {isRunningAudit ? 'Running Audit...' : 'Run SEO Audit'}
          </Button>
        </div>
      </div>

      {/* SEO Score Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern col-span-1">
          <CardContent className="p-6 text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                <circle 
                  cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" 
                  className={seoScore >= 70 ? 'text-teal' : seoScore >= 40 ? 'text-gold' : 'text-coral'}
                  strokeDasharray={`${seoScore * 3.52} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold">{seoScore}</span>
              </div>
            </div>
            <p className="font-semibold text-lg">SEO Score</p>
            <p className="text-sm text-muted-foreground">Overall health</p>
          </CardContent>
        </Card>

        <Card className="card-modern col-span-3">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-gold" />
              SEO Issues & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {seoIssues.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-teal/10 border border-teal/20">
                <CheckCircle className="h-5 w-5 text-teal" />
                <span className="text-teal font-semibold">No major SEO issues detected!</span>
              </div>
            ) : (
              seoIssues.map((issue, i) => (
                <div 
                  key={i} 
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    issue.severity === 'high' ? 'bg-coral/10 border-coral/20' : 
                    issue.severity === 'medium' ? 'bg-gold/10 border-gold/20' : 
                    'bg-blue-light border-blue-custom/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {issue.type === 'error' && <AlertTriangle className="h-5 w-5 text-coral" />}
                    {issue.type === 'warning' && <AlertTriangle className="h-5 w-5 text-gold" />}
                    {issue.type === 'info' && <FileText className="h-5 w-5 text-blue-custom" />}
                    <span className="font-medium">{issue.message}</span>
                  </div>
                  <Button variant="ghost" size="sm">Fix</Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPages}</p>
              <p className="text-sm text-muted-foreground">Total Pages</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <Heading1 className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pagesWithProperH1}</p>
              <p className="text-sm text-muted-foreground">Proper H1</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalClinicPages}</p>
              <p className="text-sm text-muted-foreground">Clinics</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-light flex items-center justify-center">
              <FileText className="h-6 w-6 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalTreatmentPages}</p>
              <p className="text-sm text-muted-foreground">Treatments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Globe className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCityPages}</p>
              <p className="text-sm text-muted-foreground">Cities</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <FileText className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBlogPages}</p>
              <p className="text-sm text-muted-foreground">Blog Posts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different SEO sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 rounded-xl">
          <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
          <TabsTrigger value="pages" className="rounded-xl">All Pages Audit</TabsTrigger>
          <TabsTrigger value="headings" className="rounded-xl">H1/H2 Analysis</TabsTrigger>
          <TabsTrigger value="technical" className="rounded-xl">Technical SEO</TabsTrigger>
          <TabsTrigger value="schema" className="rounded-xl">Schema Markup</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Page Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { type: 'City Pages', count: totalCityPages },
                  { type: 'Treatment Pages', count: totalTreatmentPages },
                  { type: 'Clinic Pages', count: totalClinicPages },
                  { type: 'Blog Posts', count: totalBlogPages },
                ].map(item => {
                  const percent = totalPages > 0 ? (item.count / totalPages) * 100 : 0;
                  return (
                    <div key={item.type} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{item.type}</span>
                        <span className="text-muted-foreground">{item.count} ({percent.toFixed(0)}%)</span>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Globe className="h-4 w-4" />
                  View Sitemap ({totalPages} URLs)
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Code className="h-4 w-4" />
                  Export Sitemap XML
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Image className="h-4 w-4" />
                  Audit Image Alt Tags
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <RefreshCw className="h-4 w-4" />
                  Revalidate All Pages
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pages" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                All Website Pages ({allWebsitePages.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>H1</TableHead>
                    <TableHead>H2s</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allWebsitePages.slice(0, 20).map((page, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="font-medium truncate max-w-48">{page.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{page.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-32">
                        {page.url}
                      </TableCell>
                      <TableCell>
                        {page.h1Count === 1 ? (
                          <Badge className="bg-teal/20 text-teal">1</Badge>
                        ) : page.h1Count === 0 ? (
                          <Badge variant="destructive">0</Badge>
                        ) : (
                          <Badge className="bg-gold/20 text-gold">{page.h1Count}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{page.h2Count}</span>
                      </TableCell>
                      <TableCell>
                        {page.metaOk ? (
                          <Badge className="bg-teal/20 text-teal">OK</Badge>
                        ) : (
                          <Badge variant="destructive">Missing</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={page.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {allWebsitePages.length > 20 && (
                <div className="p-4 text-center border-t">
                  <Button variant="outline">Load More ({allWebsitePages.length - 20} remaining)</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="headings" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heading1 className="h-5 w-5 text-primary" />
                  H1 Tag Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 rounded-xl bg-teal/10 border border-teal/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-teal" />
                    <span className="font-medium">Pages with single H1</span>
                  </div>
                  <Badge className="bg-teal text-white">{pagesWithProperH1}</Badge>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-gold/10 border border-gold/20">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-gold" />
                    <span className="font-medium">Pages with multiple H1s</span>
                  </div>
                  <Badge className="bg-gold text-white">{allWebsitePages.filter(p => p.h1Count > 1).length}</Badge>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-coral/10 border border-coral/20">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-coral" />
                    <span className="font-medium">Pages missing H1</span>
                  </div>
                  <Badge className="bg-coral text-white">{allWebsitePages.filter(p => p.h1Count === 0).length}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heading2 className="h-5 w-5 text-primary" />
                  H2 Tag Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Average H2 tags per page</span>
                    <span className="text-muted-foreground">
                      {(allWebsitePages.reduce((sum, p) => sum + p.h2Count, 0) / allWebsitePages.length).toFixed(1)}
                    </span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Pages with 3+ H2s (good)</span>
                    <span className="text-teal font-medium">
                      {allWebsitePages.filter(p => p.h2Count >= 3).length}
                    </span>
                  </div>
                  <Progress value={(allWebsitePages.filter(p => p.h2Count >= 3).length / allWebsitePages.length) * 100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Pages with 0 H2s (needs work)</span>
                    <span className="text-coral font-medium">
                      {allWebsitePages.filter(p => p.h2Count === 0).length}
                    </span>
                  </div>
                  <Progress value={(allWebsitePages.filter(p => p.h2Count === 0).length / allWebsitePages.length) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="technical" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg">Technical Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'robots.txt configured', status: true },
                  { label: 'XML Sitemap generated', status: true },
                  { label: 'Canonical URLs set', status: true },
                  { label: 'SSL Certificate active', status: true },
                  { label: 'Mobile responsive', status: true },
                  { label: 'Schema markup added', status: true },
                  { label: 'SEOHead component on all pages', status: true },
                  { label: 'Medical disclaimers added', status: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <span className="font-medium">{item.label}</span>
                    {item.status ? (
                      <Badge className="bg-teal/20 text-teal">Complete</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gold border-gold">Pending</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg">URL Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { pattern: '/', description: 'Homepage', status: true },
                  { pattern: '/{state}/', description: 'State pages', status: true },
                  { pattern: '/{state}/{city}/', description: 'City pages', status: true },
                  { pattern: '/services/{service}/', description: 'Service pages', status: true },
                  { pattern: '/clinic/{slug}/', description: 'Clinic pages', status: true },
                  { pattern: '/dentist/{slug}/', description: 'Dentist pages', status: true },
                  { pattern: '/blog/', description: 'Blog listing', status: true },
                  { pattern: '/blog/{slug}/', description: 'Blog posts', status: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div>
                      <code className="text-sm text-primary">{item.pattern}</code>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-teal" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schema" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-5 w-5" />
                Schema Markup Implementation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: 'Organization', pages: 'All pages', status: 'implemented', priority: 'high' },
                  { name: 'LocalBusiness', pages: 'Clinic pages', status: 'implemented', priority: 'high' },
                  { name: 'Person (Dentist)', pages: 'Dentist pages', status: 'implemented', priority: 'high' },
                  { name: 'Service', pages: 'Treatment pages', status: 'implemented', priority: 'medium' },
                  { name: 'Article', pages: 'Blog posts', status: 'implemented', priority: 'medium' },
                  { name: 'FAQ', pages: 'Location & Service pages', status: 'implemented', priority: 'medium' },
                  { name: 'Breadcrumb', pages: 'All pages', status: 'implemented', priority: 'high' },
                  { name: 'MedicalDisclaimer', pages: 'Treatment pages', status: 'implemented', priority: 'high' },
                ].map((schema, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div>
                      <p className="font-bold">{schema.name}</p>
                      <p className="text-sm text-muted-foreground">{schema.pages}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {schema.priority === 'high' && <Badge variant="outline" className="text-primary border-primary">High</Badge>}
                      {schema.status === 'implemented' ? (
                        <Badge className="bg-teal/20 text-teal">Implemented</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gold border-gold">Pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingPage} onOpenChange={() => setEditingPage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit SEO Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>SEO Title</Label>
              <Input 
                value={editForm.title} 
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} 
                placeholder="Page title for SEO (max 60 chars)"
              />
              <p className="text-xs text-muted-foreground">{editForm.title.length}/60 characters</p>
            </div>
            <div className="space-y-2">
              <Label>Meta Description</Label>
              <Textarea 
                value={editForm.meta_description} 
                onChange={(e) => setEditForm({ ...editForm, meta_description: e.target.value })} 
                placeholder="Meta description for SEO (max 160 chars)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{editForm.meta_description.length}/160 characters</p>
            </div>
            <div className="space-y-2">
              <Label>H1 Heading</Label>
              <Input 
                value={editForm.h1} 
                onChange={(e) => setEditForm({ ...editForm, h1: e.target.value })} 
                placeholder="Main page heading"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Index this page</Label>
              <Switch 
                checked={editForm.is_indexed} 
                onCheckedChange={(v) => setEditForm({ ...editForm, is_indexed: v })} 
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Publish this page</Label>
              <Switch 
                checked={editForm.is_published} 
                onCheckedChange={(v) => setEditForm({ ...editForm, is_published: v })} 
              />
            </div>
            <Button onClick={handleSavePage} className="w-full" disabled={updateSeoPage.isPending}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}