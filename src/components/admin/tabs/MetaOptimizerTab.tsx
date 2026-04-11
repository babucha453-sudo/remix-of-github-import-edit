import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ACTIVE_STATES } from '@/lib/constants/activeStates';
import { 
  Sparkles, 
  Search,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Pencil,
  Play,
  StopCircle,
  Filter,
  Globe,
  MapPin,
  Stethoscope,
  Building2,
  BookOpen,
  ChevronRight,
  Zap,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SeoPage {
  id: string;
  slug: string;
  page_type: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  word_count: number | null;
  seo_score: number | null;
  last_audited_at: string | null;
  optimized_at: string | null;
}

interface OptimizationLog {
  timestamp: Date;
  page: string;
  action: 'started' | 'completed' | 'error' | 'skipped';
  message: string;
  oldMeta?: { title?: string; description?: string };
  newMeta?: { title?: string; description?: string };
}

const PAGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Page Types', icon: Globe },
  { value: 'city', label: 'City Pages', icon: MapPin },
  { value: 'state', label: 'State Pages', icon: MapPin },
  { value: 'service', label: 'Service Pages', icon: Stethoscope },
  { value: 'service-location', label: 'Service + Location', icon: MapPin },
  { value: 'clinic', label: 'Clinic Profiles', icon: Building2 },
  { value: 'dentist', label: 'Dentist Profiles', icon: Building2 },
  { value: 'blog', label: 'Blog Posts', icon: BookOpen },
  { value: 'static', label: 'Static Pages', icon: FileText },
];

const META_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'missing_both', label: 'Missing Both' },
  { value: 'missing_title', label: 'Missing Title' },
  { value: 'missing_description', label: 'Missing Description' },
  { value: 'has_both', label: 'Has Both (Complete)' },
  { value: 'title_too_long', label: 'Title Too Long (>60)' },
  { value: 'desc_too_long', label: 'Description Too Long (>160)' },
];

export default function MetaOptimizerTab() {
  const queryClient = useQueryClient();
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [pageTypeFilter, setPageTypeFilter] = useState('all');
  const [metaStatusFilter, setMetaStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, fixed: 0, errors: 0 });
  const [logs, setLogs] = useState<OptimizationLog[]>([]);
  const [previewPage, setPreviewPage] = useState<SeoPage | null>(null);
  const [editPage, setEditPage] = useState<SeoPage | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const stopFlagRef = useRef(false);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Fetch all SEO pages - filter by active states only
  const { data: seoPages, refetch: refetchPages, isLoading } = useQuery({
    queryKey: ['meta-optimizer-pages'],
    queryFn: async () => {
      const pageSize = 1000;
      const all: SeoPage[] = [];
      let from = 0;

      // Build state slug patterns for active states only
      const activeStateSlugs = ACTIVE_STATES.map(s => s.slug);

      while (true) {
        const { data, error } = await supabase
          .from('seo_pages')
          .select('id, slug, page_type, title, meta_title, meta_description, h1, word_count, seo_score, last_audited_at, optimized_at')
          .order('page_type')
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const batch = (data || []) as unknown as SeoPage[];
        
        // Filter to only include pages from active states
        const filteredBatch = batch.filter(page => {
          const slug = page.slug || '';
          // Check if the page slug starts with an active state
          // e.g., "/ca/", "/ma/", "/ct/", "/nj/"
          // Or if it's a state page like "/ca", "/ma", etc.
          const slugParts = slug.split('/').filter(Boolean);
          if (slugParts.length === 0) return true; // Keep root pages
          
          const firstPart = slugParts[0].toLowerCase();
          
          // If the first part is a state slug, check if it's active
          if (activeStateSlugs.includes(firstPart as any)) return true;
          
          // Keep pages that don't have state prefixes (like /services, /blog, etc.)
          const isStatePrefixed = /^[a-z]{2}$/.test(firstPart);
          if (!isStatePrefixed) return true;
          
          // It's a state-prefixed page but not active - filter out
          return false;
        });
        
        all.push(...filteredBatch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // Calculate stats
  const stats = {
    total: seoPages?.length || 0,
    missingBoth: seoPages?.filter(p => !p.meta_title && !p.meta_description).length || 0,
    missingTitle: seoPages?.filter(p => !p.meta_title).length || 0,
    missingDescription: seoPages?.filter(p => !p.meta_description).length || 0,
    complete: seoPages?.filter(p => p.meta_title && p.meta_description).length || 0,
    titleTooLong: seoPages?.filter(p => p.meta_title && p.meta_title.length > 60).length || 0,
    descTooLong: seoPages?.filter(p => p.meta_description && p.meta_description.length > 160).length || 0,
  };

  // Filter pages
  const filteredPages = seoPages?.filter(page => {
    // Page type filter
    if (pageTypeFilter !== 'all' && page.page_type !== pageTypeFilter) return false;

    // State filter
    if (stateFilter !== 'all') {
      const slugParts = (page.slug || '').split('/').filter(Boolean);
      const firstPart = slugParts[0]?.toLowerCase() || '';
      if (firstPart !== stateFilter) return false;
    }

    // Meta status filter
    switch (metaStatusFilter) {
      case 'missing_both':
        if (page.meta_title || page.meta_description) return false;
        break;
      case 'missing_title':
        if (page.meta_title) return false;
        break;
      case 'missing_description':
        if (page.meta_description) return false;
        break;
      case 'has_both':
        if (!page.meta_title || !page.meta_description) return false;
        break;
      case 'title_too_long':
        if (!page.meta_title || page.meta_title.length <= 60) return false;
        break;
      case 'desc_too_long':
        if (!page.meta_description || page.meta_description.length <= 160) return false;
        break;
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!page.slug.toLowerCase().includes(q) && 
          !(page.title || '').toLowerCase().includes(q) &&
          !(page.meta_title || '').toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  }) || [];

  // Toggle selection
  const toggleSelection = (pageId: string) => {
    setSelectedPages(prev => 
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    );
  };

  // Select all filtered
  const selectAll = () => {
    if (selectedPages.length === filteredPages.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(filteredPages.map(p => p.id));
    }
  };

  // Add log entry
  const addLog = (log: Omit<OptimizationLog, 'timestamp'>) => {
    setLogs(prev => [...prev, { ...log, timestamp: new Date() }]);
  };

  // Optimize single page using edge function with Lovable AI
  const optimizeSinglePage = async (pageId: string): Promise<{ success: boolean; newMeta?: { title?: string; description?: string } }> => {
    try {
      const { data, error } = await supabase.functions.invoke('optimize-meta', {
        body: { page_id: pageId },
      });

      if (error) throw error;
      return { success: true, newMeta: { title: data?.meta_title, description: data?.meta_description } };
    } catch (err) {
      console.error('Optimize error:', err);
      return { success: false };
    }
  };

  // Batch optimize selected pages
  const batchOptimize = async () => {
    if (selectedPages.length === 0) {
      toast.info('No pages selected');
      return;
    }

    setIsOptimizing(true);
    stopFlagRef.current = false;
    setProgress({ current: 0, total: selectedPages.length, fixed: 0, errors: 0 });
    setLogs([]);
    addLog({ page: '', action: 'started', message: `Starting optimization of ${selectedPages.length} pages...` });

    let fixed = 0;
    let errors = 0;

    for (let i = 0; i < selectedPages.length; i++) {
      if (stopFlagRef.current) {
        addLog({ page: '', action: 'skipped', message: `Stopped by user. ${selectedPages.length - i} pages skipped.` });
        break;
      }

      const pageId = selectedPages[i];
      const page = seoPages?.find(p => p.id === pageId);
      const oldMeta = { title: page?.meta_title || undefined, description: page?.meta_description || undefined };

      setProgress(prev => ({ ...prev, current: i + 1 }));
      addLog({ page: page?.slug || pageId, action: 'started', message: `Optimizing: ${page?.slug}` });

      const result = await optimizeSinglePage(pageId);

      if (result.success) {
        fixed++;
        addLog({ 
          page: page?.slug || pageId, 
          action: 'completed', 
          message: `✓ Optimized successfully`,
          oldMeta,
          newMeta: result.newMeta
        });
      } else {
        errors++;
        addLog({ page: page?.slug || pageId, action: 'error', message: `✗ Failed to optimize` });
      }

      setProgress(prev => ({ ...prev, fixed, errors }));

      // Rate limiting delay
      if (i < selectedPages.length - 1 && !stopFlagRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }

    addLog({ page: '', action: 'completed', message: `Optimization complete! Fixed: ${fixed}, Errors: ${errors}` });
    setIsOptimizing(false);
    stopFlagRef.current = false;
    queryClient.invalidateQueries({ queryKey: ['meta-optimizer-pages'] });
    setSelectedPages([]);
    toast.success(`Optimization complete! Fixed: ${fixed}, Errors: ${errors}`);
  };

  // Manual save
  const saveManualEdit = async () => {
    if (!editPage) return;

    try {
      const { error } = await supabase
        .from('seo_pages')
        .update({
          meta_title: editTitle || null,
          meta_description: editDescription || null,
          optimized_at: new Date().toISOString(),
        })
        .eq('id', editPage.id);

      if (error) throw error;
      toast.success('Meta tags saved successfully');
      setEditPage(null);
      queryClient.invalidateQueries({ queryKey: ['meta-optimizer-pages'] });
    } catch (err) {
      toast.error('Failed to save meta tags');
    }
  };

  // Quick fix by filter
  const quickFixByFilter = () => {
    const pagesToFix = filteredPages.filter(p => !p.meta_title || !p.meta_description).map(p => p.id);
    if (pagesToFix.length === 0) {
      toast.info('No pages need fixing with current filter');
      return;
    }
    setSelectedPages(pagesToFix);
    toast.info(`Selected ${pagesToFix.length} pages. Click "Optimize Selected" to start.`);
  };

  const getPageTypeIcon = (type: string) => {
    const option = PAGE_TYPE_OPTIONS.find(o => o.value === type);
    if (option) {
      const Icon = option.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getMetaStatus = (page: SeoPage) => {
    if (!page.meta_title && !page.meta_description) {
      return <Badge variant="destructive" className="text-xs">Missing Both</Badge>;
    }
    if (!page.meta_title) {
      return <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">No Title</Badge>;
    }
    if (!page.meta_description) {
      return <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">No Desc</Badge>;
    }
    if (page.meta_title.length > 60 || page.meta_description.length > 160) {
      return <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700">Too Long</Badge>;
    }
    return <Badge variant="outline" className="text-xs border-green-400 text-green-600">Complete</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Meta Optimizer
          </h2>
          <p className="text-muted-foreground mt-1">
            Bulk fix meta titles & descriptions using AI (Google policy compliant)
          </p>
        </div>
        <Button onClick={() => refetchPages()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Pages</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMetaStatusFilter('missing_both')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.missingBoth}</p>
            <p className="text-xs text-red-700">Missing Both</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMetaStatusFilter('missing_title')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.missingTitle}</p>
            <p className="text-xs text-orange-700">No Title</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMetaStatusFilter('missing_description')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.missingDescription}</p>
            <p className="text-xs text-amber-700">No Description</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMetaStatusFilter('has_both')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.complete}</p>
            <p className="text-xs text-green-700">Complete</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMetaStatusFilter('title_too_long')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.titleTooLong}</p>
            <p className="text-xs text-yellow-700">Title &gt;60</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMetaStatusFilter('desc_too_long')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.descTooLong}</p>
            <p className="text-xs text-purple-700">Desc &gt;160</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {ACTIVE_STATES.map(state => (
                    <SelectItem key={state.slug} value={state.slug}>
                      {state.name} ({state.abbr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className="h-4 w-4" />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={metaStatusFilter} onValueChange={setMetaStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {META_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by slug, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={quickFixByFilter} disabled={isOptimizing}>
                <Zap className="h-4 w-4 mr-1" />
                Select Incomplete
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={batchOptimize} 
                disabled={isOptimizing || selectedPages.length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                {isOptimizing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Optimize Selected ({selectedPages.length})
              </Button>
              {isOptimizing && (
                <Button variant="destructive" size="sm" onClick={() => { stopFlagRef.current = true; }}>
                  <StopCircle className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isOptimizing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Processing {progress.current} of {progress.total}...
                </span>
                <span className="font-medium">
                  <span className="text-green-600">{progress.fixed} fixed</span>
                  {progress.errors > 0 && <span className="text-red-600 ml-2">{progress.errors} errors</span>}
                </span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pages Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Pages ({filteredPages.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedPages.length === filteredPages.length && filteredPages.length > 0 ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pages match the current filters</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedPages.length === filteredPages.length && filteredPages.length > 0}
                          onCheckedChange={selectAll}
                        />
                      </TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPages.slice(0, 100).map(page => (
                      <TableRow key={page.id} className={selectedPages.includes(page.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPages.includes(page.id)}
                            onCheckedChange={() => toggleSelection(page.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="font-medium text-sm truncate">{page.title || page.slug}</p>
                            <p className="text-xs text-muted-foreground truncate">{page.slug.startsWith('/') ? page.slug : `/${page.slug}`}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            {getPageTypeIcon(page.page_type)}
                            <span className="text-xs capitalize">{page.page_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getMetaStatus(page)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => setPreviewPage(page)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => {
                                setEditPage(page);
                                setEditTitle(page.meta_title || '');
                                setEditDescription(page.meta_description || '');
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filteredPages.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Showing first 100 of {filteredPages.length} pages. Use filters to narrow down.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Logs Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Optimization Log
            </CardTitle>
            <CardDescription>Real-time progress and results</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px]" ref={logsScrollRef}>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select pages and click "Optimize Selected" to start</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`text-xs p-2 rounded-lg border ${
                        log.action === 'error' ? 'bg-red-50 border-red-200' :
                        log.action === 'completed' ? 'bg-green-50 border-green-200' :
                        log.action === 'skipped' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {log.action === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />}
                        {log.action === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />}
                        {log.action === 'started' && <ChevronRight className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />}
                        {log.action === 'skipped' && <AlertCircle className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{log.message}</p>
                          {log.newMeta?.title && (
                            <p className="text-muted-foreground mt-1 truncate">
                              Title: {log.newMeta.title}
                            </p>
                          )}
                          <p className="text-muted-foreground opacity-60">
                            {format(log.timestamp, 'HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewPage} onOpenChange={() => setPreviewPage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Meta Preview</DialogTitle>
            <DialogDescription>{previewPage?.slug?.startsWith('/') ? previewPage.slug : `/${previewPage?.slug}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <p className="text-blue-700 text-lg font-medium hover:underline cursor-pointer truncate">
                {previewPage?.meta_title || previewPage?.title || 'No Title Set'}
              </p>
              <p className="text-green-700 text-sm">
                https://www.appointpanda.com{previewPage?.slug?.startsWith('/') ? previewPage.slug : `/${previewPage?.slug}`}
              </p>
              <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                {previewPage?.meta_description || 'No description set. This page needs a meta description for better SEO.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Title Length</p>
                <Badge variant={previewPage?.meta_title && previewPage.meta_title.length <= 60 ? 'outline' : 'destructive'}>
                  {previewPage?.meta_title?.length || 0} / 60 chars
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Description Length</p>
                <Badge variant={previewPage?.meta_description && previewPage.meta_description.length <= 160 ? 'outline' : 'destructive'}>
                  {previewPage?.meta_description?.length || 0} / 160 chars
                </Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPage} onOpenChange={() => setEditPage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Meta Tags</DialogTitle>
            <DialogDescription>{editPage?.slug?.startsWith('/') ? editPage.slug : `/${editPage?.slug}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Meta Title</label>
                <Badge variant={editTitle.length <= 60 ? 'outline' : 'destructive'}>
                  {editTitle.length} / 60
                </Badge>
              </div>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter meta title..."
                className={editTitle.length > 60 ? 'border-red-300' : ''}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Meta Description</label>
                <Badge variant={editDescription.length <= 160 ? 'outline' : 'destructive'}>
                  {editDescription.length} / 160
                </Badge>
              </div>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter meta description..."
                rows={3}
                className={editDescription.length > 160 ? 'border-red-300' : ''}
              />
            </div>
            {/* Google Preview */}
            <div className="p-4 bg-slate-50 border rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Google Preview:</p>
              <p className="text-blue-700 font-medium truncate">{editTitle || 'No Title'}</p>
              <p className="text-green-700 text-sm">https://www.appointpanda.com{editPage?.slug?.startsWith('/') ? editPage.slug : `/${editPage?.slug}`}</p>
              <p className="text-gray-600 text-sm mt-1 line-clamp-2">{editDescription || 'No description'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPage(null)}>Cancel</Button>
            <Button onClick={saveManualEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
