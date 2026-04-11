import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ACTIVE_STATE_SLUGS, isPageInActiveState } from '@/lib/constants/activeStates';
import { 
  HelpCircle,
  Sparkles, 
  CheckCircle, 
  Clock,
  Play,
  Search,
  Filter,
  Globe,
  RefreshCw,
  X,
  Eye,
  BarChart3,
  Loader2,
  Building2,
  MapPin,
  Stethoscope,
  Layers,
  AlertCircle,
  CheckSquare,
  Square,
  ListFilter,
  PenTool,
  Copy,
  Trash2,
  Plus,
  FileQuestion,
  AlertTriangle,
  TrendingUp,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Types
interface SeoPage {
  id: string;
  slug: string;
  page_type: string;
  title: string | null;
  h1: string | null;
  content: string | null;
  faqs: Array<{ question: string; answer: string }> | null;
  word_count: number | null;
  updated_at: string;
}

interface GenerationJob {
  id: string;
  status: 'running' | 'completed' | 'stopped' | 'error';
  total: number;
  processed: number;
  success: number;
  errors: number;
  currentPage?: string;
  logs: GenerationLog[];
  startedAt: Date;
}

interface GenerationLog {
  timestamp: Date;
  page: string;
  action: 'started' | 'completed' | 'error' | 'skipped';
  message: string;
  details?: any;
}

interface FAQAudit {
  totalPages: number;
  pagesWithFAQs: number;
  pagesWithoutFAQs: number;
  avgFAQCount: number;
  duplicateIssues: number;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  state: 'State Pages',
  city: 'City Pages',
  treatment: 'Service Pages',
  service_location: 'Service + Location',
  city_treatment: 'City + Treatment',
  clinic: 'Clinic Pages',
  dentist: 'Dentist Profiles',
};

const PAGE_TYPE_ICONS: Record<string, any> = {
  state: Globe,
  city: MapPin,
  treatment: Stethoscope,
  service_location: Layers,
  city_treatment: Layers,
  clinic: Building2,
  dentist: Building2,
};

export default function FAQGenerationStudioTab() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'selection' | 'generation' | 'preview'>('selection');
  
  // Selection state
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  
  // Filter state
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('__all__');
  const [stateFilter, setStateFilter] = useState<string>('__all__');
  const [faqStatusFilter, setFaqStatusFilter] = useState<string>('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Generation config
  const [faqCount, setFaqCount] = useState(10);
  
  // Job state
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const stopFlagRef = useRef(false);
  const logsScrollRef = useRef<HTMLDivElement>(null);
  
  // Preview state
  const [previewPage, setPreviewPage] = useState<SeoPage | null>(null);
  const [previewFAQs, setPreviewFAQs] = useState<Array<{ question: string; answer: string }> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [currentJob?.logs]);

  // Fetch all SEO pages
  const { data: seoPages, isLoading: pagesLoading, refetch: refetchPages } = useQuery({
    queryKey: ['faq-studio-pages'],
    queryFn: async () => {
      const pageSize = 1000;
      const all: SeoPage[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('seo_pages')
          .select('id, slug, page_type, title, h1, content, faqs, word_count, updated_at')
          .order('updated_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const batch = (data || []) as unknown as SeoPage[];
        // Filter to only pages in active states
        const filtered = batch.filter(page => isPageInActiveState(page.slug, page.page_type));
        all.push(...filtered);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      return all;
    },
  });

  // Fetch states for filter (active states only)
  const { data: states } = useQuery({
    queryKey: ['faq-studio-states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('states')
        .select('id, name, abbreviation')
        .eq('is_active', true)
        .in('slug', ACTIVE_STATE_SLUGS)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Audit FAQs
  const { data: faqAudit, refetch: refetchAudit } = useQuery({
    queryKey: ['faq-audit'],
    queryFn: async (): Promise<FAQAudit> => {
      if (!seoPages) return { totalPages: 0, pagesWithFAQs: 0, pagesWithoutFAQs: 0, avgFAQCount: 0, duplicateIssues: 0 };
      
      const pagesWithFAQs = seoPages.filter(p => p.faqs && Array.isArray(p.faqs) && p.faqs.length > 0);
      const pagesWithoutFAQs = seoPages.filter(p => !p.faqs || !Array.isArray(p.faqs) || p.faqs.length === 0);
      
      let totalFAQCount = 0;
      const allQuestions = new Map<string, string[]>();
      
      for (const page of pagesWithFAQs) {
        if (page.faqs && Array.isArray(page.faqs)) {
          totalFAQCount += page.faqs.length;
          
          for (const faqItem of page.faqs) {
            if (faqItem?.question) {
              const normalized = faqItem.question.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .trim();
              
              if (!allQuestions.has(normalized)) {
                allQuestions.set(normalized, []);
              }
              allQuestions.get(normalized)!.push(page.slug);
            }
          }
        }
      }
      
      const duplicateIssues = [...allQuestions.values()].filter(slugs => slugs.length > 1).length;
      
      return {
        totalPages: seoPages.length,
        pagesWithFAQs: pagesWithFAQs.length,
        pagesWithoutFAQs: pagesWithoutFAQs.length,
        avgFAQCount: pagesWithFAQs.length > 0 ? Math.round(totalFAQCount / pagesWithFAQs.length) : 0,
        duplicateIssues
      };
    },
    enabled: !!seoPages,
  });

  // Calculate stats by page type
  const statsByType = useMemo(() => {
    if (!seoPages) return [];
    
    return Object.entries(PAGE_TYPE_LABELS).map(([type, label]) => {
      const pages = seoPages.filter(p => p.page_type === type);
      const withFAQs = pages.filter(p => p.faqs && Array.isArray(p.faqs) && p.faqs.length > 0);
      
      return {
        type,
        label,
        total: pages.length,
        withFAQs: withFAQs.length,
        withoutFAQs: pages.length - withFAQs.length,
        coverage: pages.length > 0 ? Math.round((withFAQs.length / pages.length) * 100) : 0
      };
    }).filter(t => t.total > 0);
  }, [seoPages]);

  // Filter pages based on criteria
  const filteredPages = useMemo(() => {
    if (!seoPages) return [];
    
    return seoPages.filter(page => {
      // Page type filter
      if (pageTypeFilter !== '__all__' && page.page_type !== pageTypeFilter) return false;
      
      // State filter (check slug pattern)
      if (stateFilter !== '__all__') {
        const state = states?.find(s => s.id === stateFilter);
        if (state && !page.slug.toLowerCase().includes(`/${state.abbreviation?.toLowerCase()}/`) &&
            !page.slug.toLowerCase().startsWith(`${state.abbreviation?.toLowerCase()}/`)) {
          return false;
        }
      }
      
      // FAQ status filter
      const hasFAQs = page.faqs && Array.isArray(page.faqs) && page.faqs.length > 0;
      if (faqStatusFilter === 'has_faqs' && !hasFAQs) return false;
      if (faqStatusFilter === 'no_faqs' && hasFAQs) return false;
      if (faqStatusFilter === 'few_faqs' && (!hasFAQs || page.faqs!.length >= 5)) return false;
      
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!page.slug.toLowerCase().includes(q) && 
            !(page.title || '').toLowerCase().includes(q) &&
            !(page.h1 || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      
      return true;
    });
  }, [seoPages, pageTypeFilter, stateFilter, faqStatusFilter, searchQuery, states]);

  // Select all filtered
  const selectAllFiltered = () => {
    setSelectedPages(filteredPages.map(p => p.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedPages([]);
  };

  // Toggle page selection
  const togglePageSelection = (pageId: string) => {
    setSelectedPages(prev => 
      prev.includes(pageId) 
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  };

  // Add log entry
  const addLog = (log: Omit<GenerationLog, 'timestamp'>) => {
    setCurrentJob(prev => prev ? {
      ...prev,
      logs: [...prev.logs, { ...log, timestamp: new Date() }],
    } : null);
  };

  // Stop generation
  const stopGeneration = () => {
    stopFlagRef.current = true;
    toast.info('Stopping generation... Please wait for current page to complete.');
  };

  // Start FAQ generation
  const startGeneration = async () => {
    if (selectedPages.length === 0) {
      toast.error('Please select at least one page');
      return;
    }

    setIsGenerating(true);
    stopFlagRef.current = false;
    setActiveView('generation');
    
    const jobId = `job_${Date.now()}`;
    setCurrentJob({
      id: jobId,
      status: 'running',
      total: selectedPages.length,
      processed: 0,
      success: 0,
      errors: 0,
      logs: [],
      startedAt: new Date(),
    });

    addLog({ page: '', action: 'started', message: `Starting FAQ generation for ${selectedPages.length} pages (${faqCount} FAQs each)...` });
    
    let success = 0;
    let errors = 0;

    for (let i = 0; i < selectedPages.length; i++) {
      if (stopFlagRef.current) {
        addLog({ page: '', action: 'skipped', message: `Generation stopped. ${selectedPages.length - i} pages skipped.` });
        setCurrentJob(prev => prev ? { ...prev, status: 'stopped' } : null);
        break;
      }

      const pageId = selectedPages[i];
      const page = seoPages?.find(p => p.id === pageId);
      const pageName = page?.slug || pageId;

      setCurrentJob(prev => prev ? {
        ...prev,
        processed: i,
        currentPage: pageName,
      } : null);

      addLog({ page: pageName, action: 'started', message: `Generating ${faqCount} FAQs...` });

      try {
        const { data, error } = await supabase.functions.invoke('faq-generation-studio', {
          body: {
            action: 'generate_faqs',
            page_id: pageId,
            config: {
              faq_count: faqCount,
              use_paa_style: true,
              include_local_context: true,
              make_unique: true,
            },
          },
        });

        if (error) throw error;

        success++;
        const uniqueStatus = data?.uniqueness?.isUnique ? '✓ Unique' : `⚠ ${data?.uniqueness?.duplicateCount || 0} potential duplicates`;
        addLog({ 
          page: pageName, 
          action: 'completed', 
          message: `Generated ${data?.faq_count || 0} FAQs. ${uniqueStatus}`,
          details: data,
        });

      } catch (err) {
        errors++;
        addLog({ 
          page: pageName, 
          action: 'error', 
          message: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }

      setCurrentJob(prev => prev ? {
        ...prev,
        processed: i + 1,
        success,
        errors,
      } : null);

      // Rate limiting delay
      if (i < selectedPages.length - 1 && !stopFlagRef.current) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    if (!stopFlagRef.current) {
      setCurrentJob(prev => prev ? { ...prev, status: 'completed' } : null);
      addLog({ 
        page: '', 
        action: 'completed', 
        message: `Generation complete! Success: ${success}, Errors: ${errors}`,
      });
    }

    stopFlagRef.current = false;
    setIsGenerating(false);
    queryClient.invalidateQueries({ queryKey: ['faq-studio-pages'] });
    toast.success(`FAQ generation complete! ${success} pages processed, ${errors} errors`);
  };

  // Preview FAQs for a page
  const previewPageFAQs = async (page: SeoPage) => {
    setPreviewPage(page);
    setShowPreview(true);
    setIsLoadingPreview(true);
    setPreviewFAQs(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('faq-generation-studio', {
        body: {
          action: 'preview_faqs',
          page_id: page.id,
          config: {
            faq_count: faqCount,
          },
        },
      });

      if (error) throw error;
      setPreviewFAQs(data?.faqs || []);
    } catch (err) {
      toast.error(`Preview failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Apply preview FAQs
  const applyPreviewFAQs = async () => {
    if (!previewPage || !previewFAQs) return;
    
    try {
      const { error } = await supabase.functions.invoke('faq-generation-studio', {
        body: {
          action: 'apply_faqs',
          page_id: previewPage.id,
          faqs: previewFAQs,
        },
      });

      if (error) throw error;
      toast.success('FAQs applied successfully!');
      setShowPreview(false);
      setPreviewPage(null);
      setPreviewFAQs(null);
      queryClient.invalidateQueries({ queryKey: ['faq-studio-pages'] });
    } catch (err) {
      toast.error(`Apply failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileQuestion className="h-6 w-6 text-primary" />
            FAQ Generation Studio
          </h2>
          <p className="text-muted-foreground mt-1">
            Generate unique, "People Also Ask" style FAQs for every page
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetchPages()} disabled={pagesLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${pagesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {faqAudit && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{faqAudit.totalPages.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Pages</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{faqAudit.pagesWithFAQs.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">With FAQs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{faqAudit.pagesWithoutFAQs.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">No FAQs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{faqAudit.avgFAQCount}</div>
              <div className="text-sm text-muted-foreground">Avg FAQs/Page</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{faqAudit.duplicateIssues}</div>
              <div className="text-sm text-muted-foreground">Duplicate Issues</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Coverage by Page Type */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            FAQ Coverage by Page Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statsByType.map((stat) => {
              const Icon = PAGE_TYPE_ICONS[stat.type] || Globe;
              return (
                <div key={stat.type} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{stat.label}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">{stat.coverage}%</span>
                    <span className="text-sm text-muted-foreground">
                      {stat.withFAQs}/{stat.total}
                    </span>
                  </div>
                  <Progress value={stat.coverage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList>
          <TabsTrigger value="selection" className="flex items-center gap-2">
            <ListFilter className="h-4 w-4" />
            Page Selection
          </TabsTrigger>
          <TabsTrigger value="generation" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generation
            {isGenerating && <Loader2 className="h-3 w-3 animate-spin" />}
          </TabsTrigger>
        </TabsList>

        {/* Page Selection Tab */}
        <TabsContent value="selection" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Page Selection
              </CardTitle>
              <CardDescription>
                Select pages by type, location, or FAQ status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Page Type</Label>
                  <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Types</SelectItem>
                      {Object.entries(PAGE_TYPE_LABELS).map(([type, label]) => (
                        <SelectItem key={type} value={type}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All States</SelectItem>
                      {states?.map(state => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name} ({state.abbreviation})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>FAQ Status</Label>
                  <Select value={faqStatusFilter} onValueChange={setFaqStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Status</SelectItem>
                      <SelectItem value="no_faqs">No FAQs</SelectItem>
                      <SelectItem value="few_faqs">Few FAQs (&lt;5)</SelectItem>
                      <SelectItem value="has_faqs">Has FAQs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search pages..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Selection Actions */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {filteredPages.length.toLocaleString()} pages match
                  </Badge>
                  <Badge variant={selectedPages.length > 0 ? "default" : "outline"} className="text-base px-3 py-1">
                    {selectedPages.length.toLocaleString()} selected
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedPages.length === 0}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                  <Button variant="secondary" size="sm" onClick={selectAllFiltered}>
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Select All ({filteredPages.length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generation Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Generation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label>FAQs per Page: {faqCount}</Label>
                  <Slider
                    value={[faqCount]}
                    onValueChange={([v]) => setFaqCount(v)}
                    min={5}
                    max={15}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 10 FAQs for SEO
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <Button 
                  size="lg" 
                  onClick={startGeneration} 
                  disabled={selectedPages.length === 0 || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Generate FAQs ({selectedPages.length} pages)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Page List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedPages.length === filteredPages.length && filteredPages.length > 0}
                          onCheckedChange={(checked) => checked ? selectAllFiltered() : clearSelection()}
                        />
                      </TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">FAQs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPages.slice(0, 100).map((page) => {
                      const Icon = PAGE_TYPE_ICONS[page.page_type] || Globe;
                      const faqCount = page.faqs?.length || 0;
                      
                      return (
                        <TableRow key={page.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedPages.includes(page.id)}
                              onCheckedChange={() => togglePageSelection(page.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md truncate font-mono text-sm">
                              /{page.slug}
                            </div>
                            {page.title && (
                              <div className="text-xs text-muted-foreground truncate">
                                {page.title}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Icon className="h-3 w-3" />
                              {PAGE_TYPE_LABELS[page.page_type] || page.page_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {faqCount > 0 ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                {faqCount} FAQs
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-200">
                                No FAQs
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => previewPageFAQs(page)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filteredPages.length > 100 && (
                  <div className="p-4 text-center text-muted-foreground">
                    Showing 100 of {filteredPages.length} pages. Use filters to narrow down.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generation Tab */}
        <TabsContent value="generation" className="space-y-4">
          {currentJob && (
            <>
              {/* Progress */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {currentJob.status === 'running' ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : currentJob.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : currentJob.status === 'stopped' ? (
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      FAQ Generation Progress
                    </CardTitle>
                    {currentJob.status === 'running' && (
                      <Button variant="destructive" size="sm" onClick={stopGeneration}>
                        Stop
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress: {currentJob.processed}/{currentJob.total}</span>
                    <span>{Math.round((currentJob.processed / currentJob.total) * 100)}%</span>
                  </div>
                  <Progress value={(currentJob.processed / currentJob.total) * 100} />
                  
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{currentJob.success}</div>
                      <div className="text-sm text-muted-foreground">Success</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{currentJob.errors}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{currentJob.total - currentJob.processed}</div>
                      <div className="text-sm text-muted-foreground">Remaining</div>
                    </div>
                  </div>
                  
                  {currentJob.currentPage && currentJob.status === 'running' && (
                    <div className="text-sm text-muted-foreground">
                      Processing: <span className="font-mono">{currentJob.currentPage}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Logs */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Generation Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]" ref={logsScrollRef}>
                    <div className="p-4 space-y-2">
                      {currentJob.logs.map((log, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-3 p-2 rounded text-sm ${
                            log.action === 'error' ? 'bg-red-50 text-red-800' :
                            log.action === 'completed' ? 'bg-green-50 text-green-800' :
                            log.action === 'skipped' ? 'bg-amber-50 text-amber-800' :
                            'bg-muted'
                          }`}
                        >
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(log.timestamp, 'HH:mm:ss')}
                          </span>
                          {log.page && (
                            <span className="font-mono text-xs max-w-[200px] truncate">
                              {log.page}
                            </span>
                          )}
                          <span className="flex-1">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
          
          {!currentJob && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No generation job in progress.</p>
                <p className="text-sm">Select pages and start generating FAQs.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              FAQ Preview
            </DialogTitle>
            <DialogDescription>
              {previewPage?.slug && <span className="font-mono">/{previewPage.slug}</span>}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            {isLoadingPreview ? (
              <div className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Generating {faqCount} FAQs...</p>
              </div>
            ) : previewFAQs && previewFAQs.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-2">
                {previewFAQs.map((faq, idx) => (
                  <AccordionItem 
                    key={idx} 
                    value={`faq-${idx}`}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-left hover:no-underline">
                      <span className="flex items-start gap-2">
                        <HelpCircle className="h-4 w-4 mt-1 text-primary shrink-0" />
                        <span>{faq.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pl-6">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-4 opacity-50" />
                <p>No FAQs generated. Try again.</p>
              </div>
            )}
            
            {/* Existing FAQs comparison */}
            {previewPage?.faqs && previewPage.faqs.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Existing FAQs ({previewPage.faqs.length})
                </h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {previewPage.faqs.map((faq, idx) => (
                    <div key={idx} className="p-2 bg-muted rounded">
                      <strong>Q:</strong> {faq.question}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button 
              onClick={applyPreviewFAQs}
              disabled={!previewFAQs || previewFAQs.length === 0 || isLoadingPreview}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Apply {previewFAQs?.length || 0} FAQs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
