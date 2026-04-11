import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ACTIVE_STATE_SLUGS, isPageInActiveState } from '@/lib/constants/activeStates';
import { 
  Stethoscope, MapPin, BookOpen, Play, Pause, CheckCircle, 
  Clock, FileText, BarChart3, Loader2, Target, Sparkles,
  ChevronRight, Eye, AlertCircle, RefreshCw, Layers, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Sprint definitions matching the roadmap
const SPRINT_DEFINITIONS = {
  '2.1': {
    name: 'Service Page Optimization',
    weeks: 'Week 5-7',
    pageType: 'treatment',
    targetWordCount: 3500,
    maxWordCount: 5000,
    priority: [
      'dental-implants', 'teeth-whitening', 'invisalign', 'root-canal', 'dental-crowns',
      'veneers', 'cosmetic-dentistry', 'emergency-dental-care', 'dentures', 'dental-bridges'
    ],
    template: 'service',
  },
  '2.2': {
    name: 'City Page Transformation',
    weeks: 'Week 8-10',
    pageType: 'city',
    targetWordCount: 2500,
    maxWordCount: 3500,
    priority: [
      'los-angeles', 'san-francisco', 'san-diego', 'boston', 'san-jose',
      'newark', 'hartford', 'sacramento', 'oakland', 'fresno'
    ],
    template: 'city',
  },
  '2.3': {
    name: 'Blog Content Engine',
    weeks: 'Week 11-12',
    pageType: 'blog',
    targetWordCount: 2000,
    maxWordCount: 2800,
    priority: [],
    template: 'blog',
    categories: {
      'cost-guides': 5,
      'comparisons': 5,
      'how-to': 5,
      'local-content': 5,
    },
  },
};

interface SeoPage {
  id: string;
  slug: string;
  page_type: string;
  h1: string | null;
  content: string | null;
  word_count: number | null;
  is_optimized: boolean | null;
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
  logs: { timestamp: Date; page: string; action: string; message: string }[];
  startedAt: Date;
}

export default function Phase2SprintHubTab() {
  const queryClient = useQueryClient();
  const [activeSprint, setActiveSprint] = useState<'2.1' | '2.2' | '2.3'>('2.1');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [contentFilter, setContentFilter] = useState<string>('__all__');
  const [wordCountRange, setWordCountRange] = useState<[number, number]>([0, 10000]);
  
  // Generation state
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const stopFlagRef = useRef(false);
  const logsScrollRef = useRef<HTMLDivElement>(null);
  
  // Preview state
  const [previewPage, setPreviewPage] = useState<SeoPage | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const sprintDef = SPRINT_DEFINITIONS[activeSprint];

  // Auto-scroll logs
  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [currentJob?.logs]);

  // Fetch pages for current sprint
  const { data: sprintPages, isLoading: pagesLoading, refetch: refetchPages } = useQuery({
    queryKey: ['phase2-sprint-pages', activeSprint],
    queryFn: async () => {
      if (activeSprint === '2.3') {
        // Blog posts come from blog_posts table
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, slug, title, content, status, updated_at')
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        
        // Transform to match SeoPage interface
        return (data || []).map(post => ({
          id: post.id,
          slug: `blog/${post.slug}`,
          page_type: 'blog',
          h1: post.title,
          content: typeof post.content === 'object' && post.content !== null 
            ? (post.content as any).body || '' 
            : '',
          word_count: typeof post.content === 'object' && post.content !== null
            ? ((post.content as any).body || '').split(/\s+/).filter(Boolean).length
            : 0,
          is_optimized: post.status === 'published',
          updated_at: post.updated_at,
        })) as SeoPage[];
      }

      // SEO pages for services/cities
      const pageSize = 1000;
      const all: SeoPage[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('seo_pages')
          .select('id, slug, page_type, h1, content, word_count, is_optimized, updated_at')
          .eq('page_type', sprintDef.pageType)
          .order('updated_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const batch = (data || []) as SeoPage[];
        const filtered = batch.filter(page => isPageInActiveState(page.slug, page.page_type));
        all.push(...filtered);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      return all;
    },
  });

  // Calculate sprint stats
  const stats = useMemo(() => {
    if (!sprintPages) return null;
    
    const total = sprintPages.length;
    const goodContent = sprintPages.filter(p => (p.word_count || 0) >= sprintDef.targetWordCount).length;
    const thinContent = sprintPages.filter(p => (p.word_count || 0) > 0 && (p.word_count || 0) < sprintDef.targetWordCount).length;
    const noContent = sprintPages.filter(p => !p.content || (p.word_count || 0) === 0).length;
    
    // Priority pages status
    const priorityPages = sprintPages.filter(p => 
      sprintDef.priority.some(slug => p.slug.toLowerCase().includes(slug.toLowerCase()))
    );
    const priorityComplete = priorityPages.filter(p => (p.word_count || 0) >= sprintDef.targetWordCount).length;
    
    return {
      total,
      goodContent,
      thinContent,
      noContent,
      priorityPages: priorityPages.length,
      priorityComplete,
      completionRate: total > 0 ? Math.round((goodContent / total) * 100) : 0,
      avgWordCount: total > 0 
        ? Math.round(sprintPages.reduce((sum, p) => sum + (p.word_count || 0), 0) / total)
        : 0,
    };
  }, [sprintPages, sprintDef]);

  // Filter pages
  const filteredPages = useMemo(() => {
    if (!sprintPages) return [];
    
    return sprintPages.filter(page => {
      // Content filter
      if (contentFilter === 'good' && (page.word_count || 0) < sprintDef.targetWordCount) return false;
      if (contentFilter === 'thin' && ((page.word_count || 0) === 0 || (page.word_count || 0) >= sprintDef.targetWordCount)) return false;
      if (contentFilter === 'missing' && (page.word_count || 0) > 0) return false;
      if (contentFilter === 'priority') {
        if (!sprintDef.priority.some(slug => page.slug.toLowerCase().includes(slug.toLowerCase()))) return false;
      }
      
      // Word count range
      const wc = page.word_count || 0;
      if (wc < wordCountRange[0] || wc > wordCountRange[1]) return false;
      
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!page.slug.toLowerCase().includes(q) && !(page.h1 || '').toLowerCase().includes(q)) return false;
      }
      
      return true;
    });
  }, [sprintPages, contentFilter, wordCountRange, searchQuery, sprintDef]);

  // Select/deselect handlers
  const selectAllFiltered = () => setSelectedPages(filteredPages.map(p => p.id));
  const clearSelection = () => setSelectedPages([]);
  const togglePage = (id: string) => {
    setSelectedPages(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Add log entry
  const addLog = (log: Omit<GenerationJob['logs'][0], 'timestamp'>) => {
    setCurrentJob(prev => prev ? {
      ...prev,
      logs: [...prev.logs, { ...log, timestamp: new Date() }],
    } : null);
  };

  // Stop generation
  const stopGeneration = () => {
    stopFlagRef.current = true;
    toast.info('Stopping generation...');
  };

  // Start generation with Phase 2 templates
  const startGeneration = async () => {
    if (selectedPages.length === 0) {
      toast.error('Please select at least one page');
      return;
    }

    setIsGenerating(true);
    stopFlagRef.current = false;
    
    const jobId = `phase2_${activeSprint}_${Date.now()}`;
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

    addLog({ page: '', action: 'started', message: `Starting Sprint ${activeSprint} generation for ${selectedPages.length} pages...` });
    
    let success = 0;
    let errors = 0;

    for (let i = 0; i < selectedPages.length; i++) {
      if (stopFlagRef.current) {
        addLog({ page: '', action: 'stopped', message: `Generation stopped. ${selectedPages.length - i} pages skipped.` });
        setCurrentJob(prev => prev ? { ...prev, status: 'stopped' } : null);
        break;
      }

      const pageId = selectedPages[i];
      const page = sprintPages?.find(p => p.id === pageId);
      const pageName = page?.slug || pageId;

      setCurrentJob(prev => prev ? {
        ...prev,
        processed: i,
        currentPage: pageName,
      } : null);

      addLog({ page: pageName, action: 'generating', message: `Generating Phase 2 content (target: ${sprintDef.targetWordCount}+ words)...` });

      try {
        const { data, error } = await supabase.functions.invoke('phase2-content-generator', {
          body: {
            action: 'generate',
            page_id: pageId,
            sprint: activeSprint,
            template: sprintDef.template,
            target_word_count: sprintDef.targetWordCount,
            max_word_count: sprintDef.maxWordCount,
          },
        });

        if (error) throw error;

        success++;
        addLog({ 
          page: pageName, 
          action: 'completed', 
          message: `✓ Generated ${data?.word_count || 'N/A'} words, ${data?.sections_count || 0} sections`,
        });

      } catch (err) {
        errors++;
        addLog({ 
          page: pageName, 
          action: 'error', 
          message: `✗ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }

      setCurrentJob(prev => prev ? {
        ...prev,
        processed: i + 1,
        success,
        errors,
      } : null);

      // Small delay between pages
      if (i < selectedPages.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!stopFlagRef.current) {
      setCurrentJob(prev => prev ? { ...prev, status: 'completed' } : null);
      addLog({ page: '', action: 'completed', message: `Sprint ${activeSprint} generation complete: ${success} success, ${errors} errors` });
      toast.success(`Generated content for ${success} pages`);
    }

    setIsGenerating(false);
    refetchPages();
  };

  const getWordCountBadge = (wc: number | null) => {
    const count = wc || 0;
    if (count >= sprintDef.targetWordCount) {
      return <Badge className="bg-green-500/20 text-green-400">{count.toLocaleString()} words</Badge>;
    }
    if (count > 0) {
      return <Badge className="bg-amber-500/20 text-amber-400">{count.toLocaleString()} words (thin)</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400">No content</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Phase 2: Content Architecture
          </h2>
          <p className="text-muted-foreground">Sprint-based content development for services, cities, and blog</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchPages()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Sprint Tabs */}
      <Tabs value={activeSprint} onValueChange={(v) => { setActiveSprint(v as any); setSelectedPages([]); }}>
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="2.1" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden sm:inline">Sprint 2.1:</span> Services
          </TabsTrigger>
          <TabsTrigger value="2.2" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Sprint 2.2:</span> Cities
          </TabsTrigger>
          <TabsTrigger value="2.3" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Sprint 2.3:</span> Blog
          </TabsTrigger>
        </TabsList>

        {/* Sprint Content */}
        <TabsContent value={activeSprint} className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Stats & Controls */}
            <div className="space-y-4">
              {/* Sprint Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {activeSprint === '2.1' && <Stethoscope className="h-5 w-5" />}
                    {activeSprint === '2.2' && <MapPin className="h-5 w-5" />}
                    {activeSprint === '2.3' && <BookOpen className="h-5 w-5" />}
                    {sprintDef.name}
                  </CardTitle>
                  <CardDescription>{sprintDef.weeks} • Target: {sprintDef.targetWordCount.toLocaleString()}+ words</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Completion</span>
                        <span className="font-medium">{stats.completionRate}%</span>
                      </div>
                      <Progress value={stats.completionRate} className="h-2" />
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span>Good: {stats.goodContent}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span>Thin: {stats.thinContent}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span>Missing: {stats.noContent}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-3 w-3 text-muted-foreground" />
                          <span>Avg: {stats.avgWordCount}</span>
                        </div>
                      </div>

                      {sprintDef.priority.length > 0 && (
                        <div className="pt-2 border-t">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Priority Pages</span>
                            <span className="font-medium">{stats.priorityComplete}/{stats.priorityPages}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Filters */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Content Status</Label>
                    <Select value={contentFilter} onValueChange={setContentFilter}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Pages</SelectItem>
                        <SelectItem value="missing">Missing Content</SelectItem>
                        <SelectItem value="thin">Thin Content</SelectItem>
                        <SelectItem value="good">Good Content</SelectItem>
                        {sprintDef.priority.length > 0 && (
                          <SelectItem value="priority">Priority Pages Only</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Search</Label>
                    <Input 
                      className="mt-1" 
                      placeholder="Search pages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Word Count Range: {wordCountRange[0]} - {wordCountRange[1]}</Label>
                    <Slider
                      value={wordCountRange}
                      onValueChange={(v) => setWordCountRange(v as [number, number])}
                      min={0}
                      max={10000}
                      step={100}
                      className="mt-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Generation Controls */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Generate Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Selected</span>
                    <Badge variant="outline">{selectedPages.length} pages</Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={selectAllFiltered}>
                      Select All ({filteredPages.length})
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={startGeneration}
                    disabled={isGenerating || selectedPages.length === 0}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Generate Phase 2 Content
                      </>
                    )}
                  </Button>

                  {isGenerating && (
                    <Button variant="outline" className="w-full" onClick={stopGeneration}>
                      <Pause className="h-4 w-4 mr-2" />
                      Stop Generation
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Middle: Page List */}
            <div className="lg:col-span-2">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-sm">
                    {sprintDef.pageType === 'blog' ? 'Blog Posts' : `${sprintDef.name} Pages`}
                    <Badge variant="outline" className="ml-2">{filteredPages.length} pages</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  {pagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Page</TableHead>
                            <TableHead className="text-right">Word Count</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPages.map(page => {
                            const isPriority = sprintDef.priority.some(s => 
                              page.slug.toLowerCase().includes(s.toLowerCase())
                            );
                            return (
                              <TableRow 
                                key={page.id}
                                className={selectedPages.includes(page.id) ? 'bg-muted/50' : ''}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedPages.includes(page.id)}
                                    onCheckedChange={() => togglePage(page.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isPriority && (
                                      <Badge variant="secondary" className="text-xs">Priority</Badge>
                                    )}
                                    <div>
                                      <div className="font-medium text-sm truncate max-w-[300px]">
                                        {page.h1 || page.slug}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                        /{page.slug}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {getWordCountBadge(page.word_count)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setPreviewPage(page); setShowPreview(true); }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Generation Progress */}
          {currentJob && (
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {currentJob.status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {currentJob.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {currentJob.status === 'stopped' && <AlertCircle className="h-4 w-4 text-amber-500" />}
                    {currentJob.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    Generation Progress
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-500">{currentJob.success} success</span>
                    <span className="text-red-500">{currentJob.errors} errors</span>
                    <span className="text-muted-foreground">{currentJob.processed}/{currentJob.total}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={(currentJob.processed / currentJob.total) * 100} className="h-2 mb-4" />
                
                <div 
                  ref={logsScrollRef}
                  className="bg-muted/50 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs space-y-1"
                >
                  {currentJob.logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground">{format(log.timestamp, 'HH:mm:ss')}</span>
                      <span className={
                        log.action === 'error' ? 'text-red-400' :
                        log.action === 'completed' ? 'text-green-400' :
                        'text-foreground'
                      }>
                        {log.page && `[${log.page}] `}{log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewPage?.h1 || previewPage?.slug}</DialogTitle>
            <DialogDescription>/{previewPage?.slug}</DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {previewPage?.content ? (
              <pre className="whitespace-pre-wrap text-sm">{previewPage.content}</pre>
            ) : (
              <p className="text-muted-foreground italic">No content generated yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
