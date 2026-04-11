import { useState, useEffect, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Bot, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Play,
  Search,
  TrendingUp,
  FileText,
  Globe,
  RefreshCw,
  Target,
  Wrench,
  X,
  Eye,
  Sparkles,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  StopCircle,
  History,
  Loader2,
  Activity,
  Building2,
  MapPin,
  Settings2,
  Heading1
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SeoIssueSection, SEO_ISSUE_CONFIG } from '@/components/admin/seo/SeoIssueSection';

interface SeoPage {
  id: string;
  slug: string;
  page_type: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  content: string | null;
  word_count: number | null;
  seo_score: number | null;
  is_thin_content: boolean | null;
  is_duplicate: boolean | null;
  is_optimized: boolean | null;
  needs_optimization: boolean | null;
  last_audited_at: string | null;
  optimized_at: string | null;
}

interface OptimizationLog {
  timestamp: Date;
  page: string;
  action: 'started' | 'completed' | 'error' | 'skipped';
  message: string;
  details?: {
    old_title?: string;
    new_title?: string;
    old_description?: string;
    new_description?: string;
    old_h1?: string;
    new_h1?: string;
    content_added?: boolean;
    score_change?: string;
  };
}

interface OptimizationProgress {
  runId: string;
  status: 'running' | 'completed' | 'stopped' | 'error';
  total: number;
  processed: number;
  fixed: number;
  errors: number;
  currentPage?: string;
  logs: OptimizationLog[];
}

export default function SeoContentOptimizerTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('all');
  const [issueFilter, setIssueFilter] = useState<string>('all');
  const [contentFilter, setContentFilter] = useState<string>('all'); // 'all' | 'has_content' | 'no_content' | 'has_meta' | 'no_meta'
  const [searchQuery, setSearchQuery] = useState('');
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0, currentPage: '' });
  const [viewHistoryItem, setViewHistoryItem] = useState<any>(null);
  const stopFlagRef = useRef(false);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [progress?.logs]);

  // Fetch all SEO pages with issues
  const { data: seoPages, refetch: refetchPages, isLoading } = useQuery({
    queryKey: ['seo-pages-optimizer'],
    queryFn: async () => {
      // IMPORTANT: PostgREST defaults to 1000 rows; we must paginate to fetch everything.
      const pageSize = 1000;
      const all: SeoPage[] = [];

      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('seo_pages')
          .select('*')
          .order('seo_score', { ascending: true, nullsFirst: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = (data || []) as unknown as SeoPage[];
        all.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      return all;
    },
  });

  // Calculate issues summary
  const issuesSummary = {
    missingTitle: seoPages?.filter(p => !p.meta_title).length || 0,
    missingDescription: seoPages?.filter(p => !p.meta_description).length || 0,
    missingH1: seoPages?.filter(p => !p.h1).length || 0,
    thinContent: seoPages?.filter(p => p.is_thin_content).length || 0,
    duplicates: seoPages?.filter(p => p.is_duplicate).length || 0,
    lowScore: seoPages?.filter(p => (p.seo_score || 0) < 50).length || 0,
    noContent: seoPages?.filter(p => !p.content || (p.word_count || 0) < 50).length || 0,
    hasContent: seoPages?.filter(p => p.content && (p.word_count || 0) >= 50).length || 0,
    hasMeta: seoPages?.filter(p => p.meta_title && p.meta_description).length || 0,
    staticPages: seoPages?.filter(p => p.page_type === 'static').length || 0,
    needsOptimization: seoPages?.filter(p => p.needs_optimization).length || 0,
    optimized: seoPages?.filter(p => p.is_optimized).length || 0,
    total: seoPages?.length || 0,
  };

  const totalIssues = issuesSummary.missingTitle + issuesSummary.missingDescription + 
    issuesSummary.missingH1 + issuesSummary.thinContent + issuesSummary.duplicates + issuesSummary.noContent;

  // Filter pages based on criteria
  const filteredPages = seoPages?.filter(page => {
    // Page type filter
    if (pageTypeFilter !== 'all' && page.page_type !== pageTypeFilter) return false;
    
    // Issue-based filter
    if (issueFilter === 'missing_title' && page.meta_title) return false;
    if (issueFilter === 'missing_description' && page.meta_description) return false;
    if (issueFilter === 'missing_h1' && page.h1) return false;
    if (issueFilter === 'thin_content' && !page.is_thin_content) return false;
    if (issueFilter === 'no_content' && page.content && (page.word_count || 0) >= 50) return false;
    if (issueFilter === 'has_content' && (!page.content || (page.word_count || 0) < 50)) return false;
    if (issueFilter === 'duplicate' && !page.is_duplicate) return false;
    if (issueFilter === 'needs_fix' && !page.needs_optimization) return false;
    if (issueFilter === 'low_score' && (page.seo_score || 100) >= 50) return false;
    
    // Content status filter
    if (contentFilter === 'has_content' && (!page.content || (page.word_count || 0) < 50)) return false;
    if (contentFilter === 'no_content' && page.content && (page.word_count || 0) >= 50) return false;
    if (contentFilter === 'has_meta' && (!page.meta_title || !page.meta_description)) return false;
    if (contentFilter === 'no_meta' && page.meta_title && page.meta_description) return false;
    if (contentFilter === 'has_h1' && !page.h1) return false;
    if (contentFilter === 'no_h1' && page.h1) return false;
    if (contentFilter === 'optimized' && !page.is_optimized) return false;
    if (contentFilter === 'not_optimized' && page.is_optimized) return false;
    
    // Search filter
    if (searchQuery && !page.slug.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(page.title || '').toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  }) || [];

  // Stop optimization
  const stopOptimization = () => {
    stopFlagRef.current = true;
    toast.info('Stopping optimization... Please wait for current page to complete.');
  };

  // Add log entry
  const addLog = (log: Omit<OptimizationLog, 'timestamp'>) => {
    setProgress(prev => prev ? {
      ...prev,
      logs: [...prev.logs, { ...log, timestamp: new Date() }],
    } : null);
  };

  // Audit a single page
  const auditPage = useMutation({
    mutationFn: async (pageId: string) => {
      const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
        body: { action: 'audit_page', page_id: pageId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-pages-optimizer'] });
      toast.success('Page audited successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Optimize a single page
  const optimizePage = useMutation({
    mutationFn: async (pageId: string) => {
      const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
        body: { action: 'optimize_page', page_id: pageId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seo-pages-optimizer'] });
      queryClient.invalidateQueries({ queryKey: ['seo-optimization-history'] });
      toast.success(`Page optimized! SEO Score: ${data.seo_score}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Deep Audit - audit all pages in sequence with progress
  const runDeepAudit = async () => {
    if (!seoPages || seoPages.length === 0) {
      toast.info('No pages to audit');
      return;
    }

    setIsAuditing(true);
    stopFlagRef.current = false;
    const total = seoPages.length;
    let audited = 0;
    let errors = 0;

    toast.info(`Starting deep audit of ${total} pages...`);

    for (let i = 0; i < seoPages.length; i++) {
      if (stopFlagRef.current) {
        toast.info(`Audit stopped after ${audited} pages`);
        break;
      }

      const page = seoPages[i];
      setAuditProgress({ current: i + 1, total, currentPage: page.slug });

      try {
        await supabase.functions.invoke('seo-content-optimizer', {
          body: { action: 'audit_page', page_id: page.id },
        });
        audited++;
      } catch {
        errors++;
      }

      // Small delay to avoid rate limiting
      if (i < seoPages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsAuditing(false);
    stopFlagRef.current = false;
    queryClient.invalidateQueries({ queryKey: ['seo-pages-optimizer'] });
    toast.success(`Deep audit complete! Audited: ${audited}, Errors: ${errors}`);
  };

  // Batch optimize with detailed logging
  const batchOptimize = useMutation({
    mutationFn: async (pageIds: string[]) => {
      setIsOptimizing(true);
      stopFlagRef.current = false;
      
      const runId = `run_${Date.now()}`;
      setProgress({
        runId,
        status: 'running',
        total: pageIds.length,
        processed: 0,
        fixed: 0,
        errors: 0,
        logs: [],
      });

      addLog({ page: '', action: 'started', message: `Starting optimization of ${pageIds.length} pages...` });

      const results = { fixed: 0, errors: 0 };
      
      for (let i = 0; i < pageIds.length; i++) {
        if (stopFlagRef.current) {
          addLog({ page: '', action: 'skipped', message: `Optimization stopped by user. Remaining ${pageIds.length - i} pages skipped.` });
          setProgress(prev => prev ? { ...prev, status: 'stopped' } : null);
          break;
        }

        const pageId = pageIds[i];
        const page = seoPages?.find(p => p.id === pageId);
        const pageName = page?.title || page?.slug || pageId;
        
        setProgress(prev => prev ? {
          ...prev,
          processed: i,
          currentPage: page?.slug || pageId,
        } : null);

        addLog({ page: pageName, action: 'started', message: `Optimizing: ${page?.slug}` });

        try {
          const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
            body: { action: 'optimize_page', page_id: pageId },
          });
          
          if (error) {
            results.errors++;
            addLog({ 
              page: pageName, 
              action: 'error', 
              message: `Failed: ${error.message}` 
            });
          } else {
            results.fixed++;
            addLog({ 
              page: pageName, 
              action: 'completed', 
              message: `Optimized successfully! Score: ${data?.seo_score || 'N/A'}`,
              details: {
                new_title: data?.optimized?.meta_title,
                new_description: data?.optimized?.meta_description,
                new_h1: data?.optimized?.h1,
                content_added: !!data?.optimized?.intro_paragraph,
                score_change: `→ ${data?.seo_score || 'N/A'}`,
              }
            });
          }
        } catch (err) {
          results.errors++;
          addLog({ 
            page: pageName, 
            action: 'error', 
            message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` 
          });
        }

        setProgress(prev => prev ? {
          ...prev,
          processed: i + 1,
          fixed: results.fixed,
          errors: results.errors,
        } : null);

        // Delay to avoid rate limiting
        if (i < pageIds.length - 1 && !stopFlagRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      if (!stopFlagRef.current) {
        setProgress(prev => prev ? { ...prev, status: 'completed' } : null);
        addLog({ page: '', action: 'completed', message: `Optimization complete! Fixed: ${results.fixed}, Errors: ${results.errors}` });
      }
      
      stopFlagRef.current = false;
      setIsOptimizing(false);
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['seo-pages-optimizer'] });
      queryClient.invalidateQueries({ queryKey: ['seo-optimization-history'] });
      toast.success(`Optimization complete! Fixed: ${results.fixed}, Errors: ${results.errors}`);
      setSelectedPages([]);
    },
    onError: (e: Error) => {
      setIsOptimizing(false);
      stopFlagRef.current = false;
      toast.error(e.message);
    },
  });

  const fixAllIssues = () => {
    const pagesToFix = seoPages?.filter(p => 
      !p.meta_title || !p.meta_description || !p.h1 || p.is_thin_content || 
      p.needs_optimization || !p.content || (p.word_count || 0) < 50
    ).map(p => p.id) || [];
    
    if (pagesToFix.length === 0) {
      toast.info('No issues to fix!');
      return;
    }
    
    batchOptimize.mutate(pagesToFix);
  };

  const fixSelected = () => {
    if (selectedPages.length === 0) {
      toast.info('No pages selected');
      return;
    }
    batchOptimize.mutate(selectedPages);
  };

  // Map issue types for the new edge function
  const issueTypeMap: Record<string, "meta_title" | "meta_description" | "h1" | "h2" | "content"> = {
    'missing_title': 'meta_title',
    'missing_description': 'meta_description',
    'missing_h1': 'h1',
    'thin_content': 'content',
    'no_content': 'content',
  };

  const fixByIssueType = (issueType: string, customPrompt?: string) => {
    let pages: string[] = [];
    
    switch (issueType) {
      case 'missing_title':
      case 'meta_title':
        pages = seoPages?.filter(p => !p.meta_title).map(p => p.id) || [];
        break;
      case 'missing_description':
      case 'meta_description':
        pages = seoPages?.filter(p => !p.meta_description).map(p => p.id) || [];
        break;
      case 'missing_h1':
      case 'h1':
        pages = seoPages?.filter(p => !p.h1).map(p => p.id) || [];
        break;
      case 'thin_content':
      case 'content':
        pages = seoPages?.filter(p => p.is_thin_content).map(p => p.id) || [];
        break;
      case 'no_content':
        pages = seoPages?.filter(p => !p.content || (p.word_count || 0) < 50).map(p => p.id) || [];
        break;
      case 'low_score':
        pages = seoPages?.filter(p => (p.seo_score || 0) < 50).map(p => p.id) || [];
        break;
      case 'h2':
        // H2 structure issues - pages without proper content structure
        pages = seoPages?.filter(p => p.content && !p.content.includes('##')).map(p => p.id) || [];
        break;
    }
    
    if (pages.length === 0) {
      toast.info('No pages with this issue');
      return;
    }
    
    // If custom prompt is provided, use the enhanced fix_by_issue_type action
    if (customPrompt || issueTypeMap[issueType]) {
      fixByIssueTypeWithPrompt.mutate({ 
        issueType: issueTypeMap[issueType] || 'content', 
        pageIds: pages, 
        customPrompt 
      });
    } else {
      batchOptimize.mutate(pages);
    }
  };

  // Fix by issue type with page type filter applied
  const fixByIssueTypeFiltered = (issueType: string, customPrompt?: string) => {
    // Get pages filtered by current pageTypeFilter
    const basePages = pageTypeFilter === 'all' ? seoPages : seoPages?.filter(p => p.page_type === pageTypeFilter);
    
    let pages: string[] = [];
    
    switch (issueType) {
      case 'meta_title':
        pages = basePages?.filter(p => !p.meta_title).map(p => p.id) || [];
        break;
      case 'meta_description':
        pages = basePages?.filter(p => !p.meta_description).map(p => p.id) || [];
        break;
      case 'h1':
        pages = basePages?.filter(p => !p.h1).map(p => p.id) || [];
        break;
      case 'content':
        pages = basePages?.filter(p => !p.content || (p.word_count || 0) < 50 || p.is_thin_content).map(p => p.id) || [];
        break;
      case 'h2':
        pages = basePages?.filter(p => p.content && !p.content.includes('##')).map(p => p.id) || [];
        break;
    }
    
    if (pages.length === 0) {
      toast.info(`No ${pageTypeFilter !== 'all' ? pageTypeFilter : ''} pages with this issue`);
      return;
    }
    
    // Use the enhanced fix_by_issue_type action
    if (customPrompt || issueTypeMap[issueType]) {
      fixByIssueTypeWithPrompt.mutate({ 
        issueType: issueTypeMap[issueType] || 'content', 
        pageIds: pages, 
        customPrompt 
      });
    } else {
      batchOptimize.mutate(pages);
    }
  };

  const fixByIssueTypeWithPrompt = useMutation({
    mutationFn: async ({ issueType, pageIds, customPrompt }: { 
      issueType: "meta_title" | "meta_description" | "h1" | "h2" | "content";
      pageIds: string[];
      customPrompt?: string;
    }) => {
      setIsOptimizing(true);
      stopFlagRef.current = false;
      
      const runId = `run_${Date.now()}`;
      setProgress({
        runId,
        status: 'running',
        total: pageIds.length,
        processed: 0,
        fixed: 0,
        errors: 0,
        logs: [],
      });

      addLog({ page: '', action: 'started', message: `Starting ${issueType} optimization for ${pageIds.length} pages${customPrompt ? ' with custom instructions' : ''}...` });

      const results = { fixed: 0, errors: 0 };
      
      // Process in smaller batches to show progress
      const batchSize = 5;
      for (let i = 0; i < pageIds.length; i += batchSize) {
        if (stopFlagRef.current) {
          addLog({ page: '', action: 'skipped', message: `Optimization stopped by user. Remaining ${pageIds.length - i} pages skipped.` });
          setProgress(prev => prev ? { ...prev, status: 'stopped' } : null);
          break;
        }

        const batch = pageIds.slice(i, i + batchSize);
        
        for (const pageId of batch) {
          const page = seoPages?.find(p => p.id === pageId);
          const pageName = page?.title || page?.slug || pageId;
          
          setProgress(prev => prev ? {
            ...prev,
            processed: i + batch.indexOf(pageId),
            currentPage: page?.slug || pageId,
          } : null);

          addLog({ page: pageName, action: 'started', message: `Optimizing: ${page?.slug}` });

          try {
            const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
              body: { 
                action: 'optimize_page', 
                page_id: pageId,
                issue_type: issueType,
                custom_prompt: customPrompt,
              },
            });
            
            if (error) {
              results.errors++;
              addLog({ 
                page: pageName, 
                action: 'error', 
                message: `Failed: ${error.message}` 
              });
            } else {
              results.fixed++;
              addLog({ 
                page: pageName, 
                action: 'completed', 
                message: `Optimized successfully! Score: ${data?.seo_score || 'N/A'}`,
                details: {
                  new_title: data?.optimized?.meta_title,
                  new_description: data?.optimized?.meta_description,
                  new_h1: data?.optimized?.h1,
                  content_added: !!data?.optimized?.intro_paragraph,
                  score_change: `→ ${data?.seo_score || 'N/A'}`,
                }
              });
            }
          } catch (err) {
            results.errors++;
            addLog({ 
              page: pageName, 
              action: 'error', 
              message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` 
            });
          }

          setProgress(prev => prev ? {
            ...prev,
            processed: i + batch.indexOf(pageId) + 1,
            fixed: results.fixed,
            errors: results.errors,
          } : null);

          // Delay between individual pages
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      if (!stopFlagRef.current) {
        setProgress(prev => prev ? { ...prev, status: 'completed' } : null);
        addLog({ page: '', action: 'completed', message: `Optimization complete! Fixed: ${results.fixed}, Errors: ${results.errors}` });
      }
      
      stopFlagRef.current = false;
      setIsOptimizing(false);
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['seo-pages-optimizer'] });
      queryClient.invalidateQueries({ queryKey: ['seo-optimization-history'] });
      toast.success(`Optimization complete! Fixed: ${results.fixed}, Errors: ${results.errors}`);
    },
    onError: (e: Error) => {
      setIsOptimizing(false);
      stopFlagRef.current = false;
      toast.error(e.message);
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <Badge variant="outline">Not Audited</Badge>;
    if (score >= 80) return <Badge className="bg-teal/20 text-teal">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-gold/20 text-gold">{score}</Badge>;
    return <Badge className="bg-coral/20 text-coral">{score}</Badge>;
  };

  const getLogIcon = (action: OptimizationLog['action']) => {
    switch (action) {
      case 'started': return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      case 'completed': return <CheckCircle className="h-3 w-3 text-teal" />;
      case 'error': return <X className="h-3 w-3 text-coral" />;
      case 'skipped': return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">SEO Content Optimizer</h1>
          <p className="text-muted-foreground mt-1">AI-powered deep content audit and optimization</p>
        </div>
        <div className="flex gap-2">
          {(isOptimizing || isAuditing) ? (
            <Button 
              variant="destructive" 
              onClick={stopOptimization}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Stop Process
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={runDeepAudit}
                disabled={isLoading}
              >
                <Search className="h-4 w-4 mr-2" />
                Deep Audit
              </Button>
              <Button 
                onClick={fixAllIssues} 
                disabled={totalIssues === 0}
                className="bg-gradient-to-r from-primary to-teal"
              >
                <Wrench className="h-4 w-4 mr-2" />
                Fix All Issues ({totalIssues})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Deep Audit Progress */}
      {isAuditing && (
        <Card className="border-blue-300 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <Search className="h-5 w-5 text-blue-600 animate-pulse" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900">Deep Audit in Progress</p>
                <p className="text-sm text-blue-700 truncate max-w-[400px]">
                  Scanning: {auditProgress.currentPage || '...'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{auditProgress.current}/{auditProgress.total}</p>
              </div>
            </div>
            <Progress value={(auditProgress.current / auditProgress.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Optimization Progress with Real-time Logs */}
      {progress && (isOptimizing || progress.status === 'completed' || progress.status === 'stopped') && (
        <Card className={`border-primary/30 ${progress.status === 'running' ? 'bg-primary/5' : progress.status === 'stopped' ? 'bg-yellow-50' : 'bg-teal/5'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 mb-3">
              {progress.status === 'running' ? (
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              ) : progress.status === 'stopped' ? (
                <StopCircle className="h-5 w-5 text-yellow-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-teal" />
              )}
              <div className="flex-1">
                <p className="font-semibold">
                  {progress.status === 'running' ? 'AI Optimization in Progress' : 
                   progress.status === 'stopped' ? 'Optimization Stopped' : 'Optimization Complete'}
                </p>
                {progress.status === 'running' && (
                  <p className="text-sm text-muted-foreground truncate max-w-[400px]">
                    Processing: {progress.currentPage || '...'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{progress.processed}/{progress.total}</p>
                <p className="text-xs text-muted-foreground">
                  Fixed: <span className="text-teal">{progress.fixed}</span> | Errors: <span className="text-coral">{progress.errors}</span>
                </p>
              </div>
            </div>
            <Progress value={(progress.processed / progress.total) * 100} className="h-2 mb-4" />
            
            {/* Real-time Logs */}
            <div className="border rounded-lg bg-background/50">
              <div className="px-3 py-2 border-b flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Live Activity Log</span>
              </div>
              <ScrollArea className="h-[150px]" ref={logsScrollRef}>
                <div className="p-2 space-y-1">
                  {progress.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground w-16 flex-shrink-0">
                        {format(log.timestamp, 'HH:mm:ss')}
                      </span>
                      {getLogIcon(log.action)}
                      <span className={`flex-1 ${log.action === 'error' ? 'text-coral' : log.action === 'completed' ? 'text-teal' : ''}`}>
                        {log.message}
                      </span>
                      {log.details && log.action === 'completed' && (
                        <Badge variant="outline" className="text-[10px]">
                          +content
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {progress.status !== 'running' && (
              <div className="mt-3 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setProgress(null)}>
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-8 gap-2">
        <Card className="card-modern cursor-pointer hover:border-primary/30 transition-colors" onClick={() => { setIssueFilter('all'); setContentFilter('all'); setActiveTab('pages'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-modern cursor-pointer hover:border-teal/30 transition-colors" onClick={() => { setContentFilter('has_content'); setIssueFilter('all'); setActiveTab('pages'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-teal" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.hasContent}</p>
              <p className="text-[10px] text-muted-foreground">Has Content</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-modern cursor-pointer hover:border-coral/30 transition-colors" onClick={() => { setIssueFilter('missing_title'); setContentFilter('all'); setActiveTab('pages'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-coral/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-coral" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.missingTitle}</p>
              <p className="text-[10px] text-muted-foreground">No Title</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-modern cursor-pointer hover:border-gold/30 transition-colors" onClick={() => { setIssueFilter('missing_description'); setContentFilter('all'); setActiveTab('pages'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-gold" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.missingDescription}</p>
              <p className="text-[10px] text-muted-foreground">No Meta</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-modern cursor-pointer hover:border-orange-300 transition-colors" onClick={() => { setIssueFilter('missing_h1'); setContentFilter('all'); setActiveTab('pages'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.missingH1}</p>
              <p className="text-[10px] text-muted-foreground">No H1</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-modern cursor-pointer hover:border-red-300 transition-colors" onClick={() => { setIssueFilter('thin_content'); setContentFilter('all'); setActiveTab('pages'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
              <X className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.thinContent}</p>
              <p className="text-[10px] text-muted-foreground">Thin</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern cursor-pointer hover:border-purple-300 transition-colors" onClick={() => { setContentFilter('no_content'); setIssueFilter('all'); setActiveTab('pages'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.noContent}</p>
              <p className="text-[10px] text-muted-foreground">No Content</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-modern cursor-pointer hover:border-blue-300 transition-colors" onClick={() => { setActiveTab('static'); }}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Settings2 className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{issuesSummary.staticPages}</p>
              <p className="text-[10px] text-muted-foreground">Static</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 rounded-xl">
          <TabsTrigger value="overview" className="rounded-xl">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="pages" className="rounded-xl">
            <FileText className="h-4 w-4 mr-2" />
            All Pages ({issuesSummary.total})
          </TabsTrigger>
          <TabsTrigger value="static" className="rounded-xl">
            <Globe className="h-4 w-4 mr-2" />
            Static Pages ({issuesSummary.staticPages})
          </TabsTrigger>
          <TabsTrigger value="issues" className="rounded-xl">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Issues ({totalIssues})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Issues Breakdown */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-coral" />
                  Issues to Fix
                </CardTitle>
                <CardDescription>Click on any issue to filter and fix</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Missing Meta Title', count: issuesSummary.missingTitle, severity: 'critical', filter: 'missing_title' },
                  { label: 'Missing Meta Description', count: issuesSummary.missingDescription, severity: 'high', filter: 'missing_description' },
                  { label: 'Missing H1 Heading', count: issuesSummary.missingH1, severity: 'high', filter: 'missing_h1' },
                  { label: 'No/Empty Content', count: issuesSummary.noContent, severity: 'critical', filter: 'no_content' },
                  { label: 'Thin Content (<250 words)', count: issuesSummary.thinContent, severity: 'medium', filter: 'thin_content' },
                  { label: 'Low SEO Score (<50)', count: issuesSummary.lowScore, severity: 'medium', filter: 'low_score' },
                ].map((issue) => (
                  <div 
                    key={issue.filter}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => {
                      setIssueFilter(issue.filter);
                      setActiveTab('pages');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(issue.severity)}>{issue.severity}</Badge>
                      <span className="font-medium">{issue.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{issue.count}</span>
                      {issue.count > 0 && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            fixByIssueType(issue.filter);
                          }}
                          disabled={isOptimizing}
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Fix
                        </Button>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>AI-powered bulk optimization tools</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start h-auto py-4" 
                  variant="outline"
                  onClick={runDeepAudit}
                  disabled={isOptimizing || isAuditing}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Search className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Run Deep Audit</p>
                      <p className="text-xs text-muted-foreground">Scan all {issuesSummary.total} pages for SEO issues</p>
                    </div>
                  </div>
                </Button>

                <Button 
                  className="w-full justify-start h-auto py-4" 
                  variant="outline"
                  onClick={() => fixByIssueType('no_content')}
                  disabled={isOptimizing || issuesSummary.noContent === 0}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Generate Business Content</p>
                      <p className="text-xs text-muted-foreground">Add overview, services & location info for {issuesSummary.noContent} pages</p>
                    </div>
                  </div>
                </Button>

                <Button 
                  className="w-full justify-start h-auto py-4" 
                  variant="outline"
                  onClick={() => fixByIssueType('thin_content')}
                  disabled={isOptimizing || issuesSummary.thinContent === 0}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Expand Thin Content</p>
                      <p className="text-xs text-muted-foreground">Enrich {issuesSummary.thinContent} pages with more sections</p>
                    </div>
                  </div>
                </Button>

                <Button 
                  className="w-full justify-start h-auto py-4 bg-gradient-to-r from-primary/10 to-teal/10 border-primary/30" 
                  variant="outline"
                  onClick={fixAllIssues}
                  disabled={isOptimizing || totalIssues === 0}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Fix All Issues</p>
                      <p className="text-xs text-muted-foreground">AI will optimize all {totalIssues} pages with issues</p>
                    </div>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pages Tab */}
        <TabsContent value="pages" className="mt-4">
          <Card className="card-modern">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <CardTitle className="text-lg">All SEO Pages</CardTitle>
                  <CardDescription>Select and optimize individual pages - filter by type, content status, or issues. Use "Select All Filtered" to bulk generate content for any pages.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setSelectedPages(filteredPages.map(p => p.id))}
                    disabled={filteredPages.length === 0}
                    className="bg-gradient-to-r from-primary to-teal"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Select All Filtered ({filteredPages.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedPages([])}
                    disabled={selectedPages.length === 0}
                  >
                    Clear Selection
                  </Button>
                  {selectedPages.length > 0 && (
                    <Button onClick={fixSelected} disabled={isOptimizing} size="sm" className="bg-primary">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Content ({selectedPages.length})
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Enhanced Filters Row */}
              <div className="flex flex-wrap gap-2 items-center">
                <Input 
                  placeholder="Search pages..." 
                  className="w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Page Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Page Types</SelectItem>
                    <SelectItem value="static">Static Pages ({seoPages?.filter(p => p.page_type === 'static').length || 0})</SelectItem>
                    <SelectItem value="state">State Pages ({seoPages?.filter(p => p.page_type === 'state').length || 0})</SelectItem>
                    <SelectItem value="city">City Pages ({seoPages?.filter(p => p.page_type === 'city').length || 0})</SelectItem>
                    <SelectItem value="treatment">Service Pages ({seoPages?.filter(p => p.page_type === 'treatment').length || 0})</SelectItem>
                    <SelectItem value="city_treatment">Service-Location ({seoPages?.filter(p => p.page_type === 'city_treatment').length || 0})</SelectItem>
                    <SelectItem value="clinic">Clinic Profiles ({seoPages?.filter(p => p.page_type === 'clinic').length || 0})</SelectItem>
                    <SelectItem value="blog">Blog Posts ({seoPages?.filter(p => p.page_type === 'blog').length || 0})</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={contentFilter} onValueChange={setContentFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Content Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Content Status</SelectItem>
                    <SelectItem value="has_content">✓ Has Content ({issuesSummary.hasContent})</SelectItem>
                    <SelectItem value="no_content">✗ No Content ({issuesSummary.noContent})</SelectItem>
                    <SelectItem value="has_meta">✓ Has Meta Tags ({issuesSummary.hasMeta})</SelectItem>
                    <SelectItem value="no_meta">✗ Missing Meta ({issuesSummary.total - issuesSummary.hasMeta})</SelectItem>
                    <SelectItem value="has_h1">✓ Has H1 ({issuesSummary.total - issuesSummary.missingH1})</SelectItem>
                    <SelectItem value="no_h1">✗ Missing H1 ({issuesSummary.missingH1})</SelectItem>
                    <SelectItem value="optimized">✓ Optimized ({issuesSummary.optimized})</SelectItem>
                    <SelectItem value="not_optimized">✗ Not Optimized ({issuesSummary.total - issuesSummary.optimized})</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={issueFilter} onValueChange={setIssueFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Issue Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Issues</SelectItem>
                    <SelectItem value="missing_title">Missing Title</SelectItem>
                    <SelectItem value="missing_description">Missing Meta</SelectItem>
                    <SelectItem value="missing_h1">Missing H1</SelectItem>
                    <SelectItem value="thin_content">Thin Content</SelectItem>
                    <SelectItem value="low_score">Low Score</SelectItem>
                    <SelectItem value="duplicate">Duplicates</SelectItem>
                    <SelectItem value="needs_fix">Needs Fix</SelectItem>
                  </SelectContent>
                </Select>

                {(pageTypeFilter !== 'all' || contentFilter !== 'all' || issueFilter !== 'all' || searchQuery) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setPageTypeFilter('all');
                      setContentFilter('all');
                      setIssueFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>
              
              {/* Active Filters Summary */}
              {(pageTypeFilter !== 'all' || contentFilter !== 'all' || issueFilter !== 'all') && (
                <div className="flex items-center gap-2 mt-3 text-sm">
                  <span className="text-muted-foreground">Showing:</span>
                  {pageTypeFilter !== 'all' && (
                    <Badge variant="secondary" className="capitalize">{pageTypeFilter.replace('_', ' ')}</Badge>
                  )}
                  {contentFilter !== 'all' && (
                    <Badge variant="secondary" className="capitalize">{contentFilter.replace('_', ' ')}</Badge>
                  )}
                  {issueFilter !== 'all' && (
                    <Badge variant="secondary" className="capitalize">{issueFilter.replace('_', ' ')}</Badge>
                  )}
                  <span className="font-semibold text-primary">{filteredPages.length} pages</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedPages.length === filteredPages.length && filteredPages.length > 0}
                          onCheckedChange={(checked) => {
                            setSelectedPages(checked ? filteredPages.map(p => p.id) : []);
                          }}
                        />
                      </TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>H1</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPages.map((page) => (
                      <TableRow key={page.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPages.includes(page.id)}
                            onCheckedChange={(checked) => {
                              setSelectedPages(checked 
                                ? [...selectedPages, page.id]
                                : selectedPages.filter(id => id !== page.id)
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="font-medium truncate">{page.title || page.slug}</p>
                            <p className="text-xs text-muted-foreground truncate">{page.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{page.page_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {page.meta_title ? (
                            <CheckCircle className="h-4 w-4 text-teal" />
                          ) : (
                            <X className="h-4 w-4 text-coral" />
                          )}
                        </TableCell>
                        <TableCell>
                          {page.h1 ? (
                            <CheckCircle className="h-4 w-4 text-teal" />
                          ) : (
                            <X className="h-4 w-4 text-coral" />
                          )}
                        </TableCell>
                        <TableCell>
                          {page.content && (page.word_count || 0) >= 50 ? (
                            <span className="text-xs text-muted-foreground">{page.word_count}w</span>
                          ) : (
                            <X className="h-4 w-4 text-coral" />
                          )}
                        </TableCell>
                        <TableCell>{getScoreBadge(page.seo_score)}</TableCell>
                        <TableCell>
                          {page.is_optimized ? (
                            <Badge className="bg-teal/20 text-teal">Optimized</Badge>
                          ) : page.needs_optimization ? (
                            <Badge className="bg-coral/20 text-coral">Needs Fix</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => auditPage.mutate(page.id)}
                              disabled={auditPage.isPending || isOptimizing}
                              title="Audit"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => optimizePage.mutate(page.id)}
                              disabled={optimizePage.isPending || isOptimizing}
                              title="Optimize"
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPages.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {isLoading ? 'Loading pages...' : 'No pages found matching your filters'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Static Pages Tab */}
        <TabsContent value="static" className="mt-4">
          <div className="space-y-4">
            <Card className="card-modern border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-600" />
                      Static Pages SEO Management
                    </CardTitle>
                    <CardDescription>
                      Manage SEO meta titles, descriptions, and H1 headings for static pages like About, Contact, FAQ, etc.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Google Policies Reference */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Meta Tag Rules & Google Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-coral" />
                      Meta Title Rules
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Maximum 60 characters (avoid truncation)</li>
                      <li>• Include primary keyword near the beginning</li>
                      <li>• Unique for each page</li>
                      <li>• Format: [Primary Keyword] - [Context] | Brand</li>
                      <li>• Avoid keyword stuffing</li>
                    </ul>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gold" />
                      Meta Description Rules
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Maximum 155 characters</li>
                      <li>• Accurate page content summary</li>
                      <li>• Include call-to-action</li>
                      <li>• Use active voice, compelling copy</li>
                      <li>• Include target keywords naturally</li>
                    </ul>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Heading1 className="h-4 w-4 text-orange-600" />
                    H1 Heading Rules
                  </h4>
                  <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
                    <li>• Exactly ONE H1 per page</li>
                    <li>• Contains primary keyword</li>
                    <li>• 20-70 characters optimal</li>
                    <li>• Visible near top of content</li>
                    <li>• Different from meta title (related topic)</li>
                    <li>• Avoid generic text like "Welcome"</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Static Pages List */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Static Pages ({seoPages?.filter(p => p.page_type === 'static').length || 0})</CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const staticIds = seoPages?.filter(p => p.page_type === 'static').map(p => p.id) || [];
                        setSelectedPages(staticIds);
                      }}
                    >
                      Select All Static
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => {
                        const staticPages = seoPages?.filter(p => p.page_type === 'static' && (!p.meta_title || !p.meta_description || !p.h1)).map(p => p.id) || [];
                        if (staticPages.length === 0) {
                          toast.info('All static pages have complete meta tags');
                          return;
                        }
                        batchOptimize.mutate(staticPages);
                      }}
                      disabled={isOptimizing}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Fix All Static Pages
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedPages.length > 0 && seoPages?.filter(p => p.page_type === 'static').every(p => selectedPages.includes(p.id))}
                            onCheckedChange={(checked) => {
                              const staticIds = seoPages?.filter(p => p.page_type === 'static').map(p => p.id) || [];
                              setSelectedPages(checked ? staticIds : []);
                            }}
                          />
                        </TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>Meta Title</TableHead>
                        <TableHead>Meta Description</TableHead>
                        <TableHead>H1</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seoPages?.filter(p => p.page_type === 'static').map((page) => (
                        <TableRow key={page.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPages.includes(page.id)}
                              onCheckedChange={(checked) => {
                                setSelectedPages(checked 
                                  ? [...selectedPages, page.id]
                                  : selectedPages.filter(id => id !== page.id)
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[150px]">
                              <p className="font-medium truncate">{page.title || page.slug}</p>
                              <p className="text-xs text-muted-foreground truncate">{page.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {page.meta_title ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4 text-teal" />
                                <span className="text-xs text-muted-foreground">{page.meta_title.length}c</span>
                              </div>
                            ) : (
                              <X className="h-4 w-4 text-coral" />
                            )}
                          </TableCell>
                          <TableCell>
                            {page.meta_description ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4 text-teal" />
                                <span className="text-xs text-muted-foreground">{page.meta_description.length}c</span>
                              </div>
                            ) : (
                              <X className="h-4 w-4 text-coral" />
                            )}
                          </TableCell>
                          <TableCell>
                            {page.h1 ? (
                              <CheckCircle className="h-4 w-4 text-teal" />
                            ) : (
                              <X className="h-4 w-4 text-coral" />
                            )}
                          </TableCell>
                          <TableCell>{getScoreBadge(page.seo_score)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => auditPage.mutate(page.id)}
                                disabled={auditPage.isPending || isOptimizing}
                                title="Audit"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => optimizePage.mutate(page.id)}
                                disabled={optimizePage.isPending || isOptimizing}
                                title="Optimize"
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!seoPages || seoPages.filter(p => p.page_type === 'static').length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No static pages found. Static pages are auto-detected when you run a deep audit.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Issues Tab - Enhanced with Google SEO Policies */}
        <TabsContent value="issues" className="mt-4">
          <div className="space-y-4">
            <Card className="card-modern border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-primary" />
                      SEO Issue Fixer with Google Policies
                    </CardTitle>
                    <CardDescription>
                      Each section shows Google's SEO policies and best practices. Add custom prompts to guide the AI optimization.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Fix pages of type:</span>
                    <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Page Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Page Types</SelectItem>
                        <SelectItem value="state">State Pages ({seoPages?.filter(p => p.page_type === 'state').length || 0})</SelectItem>
                        <SelectItem value="city">City Pages ({seoPages?.filter(p => p.page_type === 'city').length || 0})</SelectItem>
                        <SelectItem value="city_treatment">Service-Location ({seoPages?.filter(p => p.page_type === 'city_treatment').length || 0})</SelectItem>
                        <SelectItem value="clinic">Clinic Profiles ({seoPages?.filter(p => p.page_type === 'clinic').length || 0})</SelectItem>
                        <SelectItem value="treatment">Service Pages ({seoPages?.filter(p => p.page_type === 'treatment').length || 0})</SelectItem>
                        <SelectItem value="static">Static Pages ({seoPages?.filter(p => p.page_type === 'static').length || 0})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Filtered Issues Count */}
            {pageTypeFilter !== 'all' && (
              <Card className="card-modern bg-muted/30">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Showing issues for <strong>{pageTypeFilter}</strong> pages only. </span>
                    <span className="text-muted-foreground">
                      ({filteredPages.length} pages)
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 ml-2" onClick={() => setPageTypeFilter('all')}>
                      Clear filter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <SeoIssueSection
              type="meta_title"
              count={filteredPages.filter(p => !p.meta_title).length}
              onFix={(customPrompt) => fixByIssueTypeFiltered('meta_title', customPrompt)}
              disabled={isOptimizing}
              {...SEO_ISSUE_CONFIG.meta_title}
            />

            <SeoIssueSection
              type="meta_description"
              count={filteredPages.filter(p => !p.meta_description).length}
              onFix={(customPrompt) => fixByIssueTypeFiltered('meta_description', customPrompt)}
              disabled={isOptimizing}
              {...SEO_ISSUE_CONFIG.meta_description}
            />

            <SeoIssueSection
              type="h1"
              count={filteredPages.filter(p => !p.h1).length}
              onFix={(customPrompt) => fixByIssueTypeFiltered('h1', customPrompt)}
              disabled={isOptimizing}
              {...SEO_ISSUE_CONFIG.h1}
            />

            <SeoIssueSection
              type="content"
              count={filteredPages.filter(p => !p.content || (p.word_count || 0) < 50 || p.is_thin_content).length}
              onFix={(customPrompt) => fixByIssueTypeFiltered('content', customPrompt)}
              disabled={isOptimizing}
              {...SEO_ISSUE_CONFIG.content}
            />

            {filteredPages.filter(p => !p.meta_title || !p.meta_description || !p.h1 || !p.content || (p.word_count || 0) < 50 || p.is_thin_content).length === 0 && (
              <Card className="card-modern">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-16 w-16 text-teal mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-teal">All Clear!</h3>
                  <p className="text-muted-foreground">
                    {pageTypeFilter !== 'all' 
                      ? `No SEO issues detected for ${pageTypeFilter} pages.` 
                      : 'No SEO issues detected. Your pages are optimized.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <OptimizationHistory onViewItem={setViewHistoryItem} />
        </TabsContent>
      </Tabs>

      {/* View History Item Modal */}
      <HistoryDetailModal 
        item={viewHistoryItem} 
        onClose={() => setViewHistoryItem(null)} 
      />
    </div>
  );
}

function IssueCard({ 
  severity, 
  title, 
  count, 
  description, 
  onFix, 
  disabled,
  icon 
}: { 
  severity: 'critical' | 'high' | 'medium';
  title: string;
  count: number;
  description: string;
  onFix: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const colors = {
    critical: 'border-red-200 bg-red-50',
    high: 'border-orange-200 bg-orange-50',
    medium: 'border-yellow-200 bg-yellow-50',
  };
  
  const badgeColors = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-600 text-white',
    medium: 'bg-yellow-600 text-white',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[severity]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={badgeColors[severity]}>{severity}</Badge>
          {icon}
          <span className="font-semibold">{title}</span>
        </div>
        <span className="text-xl font-bold">{count}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <Button size="sm" onClick={onFix} disabled={disabled}>
        <Sparkles className="h-4 w-4 mr-2" />
        Fix All {count} Pages
      </Button>
    </div>
  );
}

function OptimizationHistory({ onViewItem }: { onViewItem: (item: any) => void }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['seo-optimization-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_metadata_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading history...</div>;
  }

  return (
    <Card className="card-modern">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Optimization History
        </CardTitle>
        <CardDescription>View what content was added or changed on each page</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Changes Made</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium truncate max-w-[200px]">{item.slug}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {item.new_title && <Badge variant="outline" className="text-xs bg-teal/10">Title</Badge>}
                      {item.new_meta_description && <Badge variant="outline" className="text-xs bg-blue-100">Meta</Badge>}
                      {item.new_h1 && <Badge variant="outline" className="text-xs bg-purple-100">H1</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {item.change_reason || 'Manual update'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.created_at ? format(new Date(item.created_at), 'MMM d, HH:mm') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onViewItem(item)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!history || history.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No optimization history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function HistoryDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Optimization Details
          </DialogTitle>
          <DialogDescription>
            Changes made to: <span className="font-medium">{item.slug}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Meta Title */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Badge variant="outline">Meta Title</Badge>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Before</p>
                <p className="text-sm">{item.previous_title || <span className="text-coral italic">Empty</span>}</p>
              </div>
              <div className="p-3 rounded-lg bg-teal/10 border border-teal/20">
                <p className="text-xs text-teal mb-1">After</p>
                <p className="text-sm font-medium">{item.new_title || <span className="text-muted-foreground italic">No change</span>}</p>
              </div>
            </div>
          </div>

          {/* Meta Description */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Badge variant="outline">Meta Description</Badge>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Before</p>
                <p className="text-sm">{item.previous_meta_description || <span className="text-coral italic">Empty</span>}</p>
              </div>
              <div className="p-3 rounded-lg bg-teal/10 border border-teal/20">
                <p className="text-xs text-teal mb-1">After</p>
                <p className="text-sm">{item.new_meta_description || <span className="text-muted-foreground italic">No change</span>}</p>
              </div>
            </div>
          </div>

          {/* H1 */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Badge variant="outline">H1 Heading</Badge>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Before</p>
                <p className="text-sm">{item.previous_h1 || <span className="text-coral italic">Empty</span>}</p>
              </div>
              <div className="p-3 rounded-lg bg-teal/10 border border-teal/20">
                <p className="text-xs text-teal mb-1">After</p>
                <p className="text-sm font-medium">{item.new_h1 || <span className="text-muted-foreground italic">No change</span>}</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t flex justify-between text-sm text-muted-foreground">
            <span>Reason: {item.change_reason || 'Not specified'}</span>
            <span>{item.created_at ? format(new Date(item.created_at), 'PPp') : '-'}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
