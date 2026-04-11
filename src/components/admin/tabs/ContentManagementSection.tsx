import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllWithRange } from '@/lib/api/fetchAllWithRange';
import { sanitizeHtml } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { 
  FileText, AlertTriangle, CheckCircle, XCircle, Search, 
  Play, Square, RefreshCw, Loader2, Eye, Edit, RotateCcw,
  FileCheck, FileWarning, FileX, Sparkles, Filter, CheckSquare,
  ChevronLeft, ChevronRight, Settings2
} from 'lucide-react';

interface ContentHealthStats {
  total: number;
  good: number;
  thin: number;
  missing: number;
  byType: {
    page_type: string;
    total: number;
    good: number;
    thin: number;
    missing: number;
  }[];
}

interface SeoPage {
  id: string;
  page_type: string;
  slug: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  content: string | null;
  word_count: number | null;
  is_thin_content: boolean | null;
  is_duplicate: boolean | null;
  is_indexed: boolean | null;
  updated_at: string;
  last_generated_at: string | null;
}

export default function ContentManagementSection() {
  const queryClient = useQueryClient();
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, status: '' });
  const [previewPage, setPreviewPage] = useState<SeoPage | null>(null);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Filters
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('all');
  const [contentStatusFilter, setContentStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  type RowsOption = 'all' | '25' | '50' | '100' | '200' | '500' | '1000' | '2500' | '5000';
  const [rowsOption, setRowsOption] = useState<RowsOption>('all');
  
  // Generation settings
  const [targetWordCount, setTargetWordCount] = useState<number>(700);
  const [showSettings, setShowSettings] = useState(false);

  // Virtualized list state (used when rowsOption === 'all')
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Helper: determine content status with STRICT SEO rules
  // Good >= 300, Thin = 1-299, Missing = null/empty (0 words)
  const classifyWordCount = (wc: number | null | undefined): 'good' | 'thin' | 'missing' => {
    const count = wc ?? 0;
    if (count >= 300) return 'good';
    if (count >= 1) return 'thin';
    return 'missing';
  };

  // Hardcoded active state slugs (abbreviations used in database)
  // This ensures consistent filtering regardless of database state
  const ACTIVE_STATE_SLUGS = ['ca', 'ct', 'ma', 'nj'];

  // Check if a seo_pages slug belongs to an active state
  const isActiveStateSlug = useCallback((slug: string, pageType: string): boolean => {
    if (!slug) return false;
    
    // Non-location page types are always valid
    if (['static', 'blog', 'treatment', 'clinic'].includes(pageType)) return true;
    
    const normalized = slug.toLowerCase().replace(/^\//, ''); // Remove leading slash
    
    // Check for clinic/dentist paths (always valid)
    if (normalized.startsWith('clinic/') || normalized.startsWith('dentist/')) return true;
    if (normalized.startsWith('services') || normalized.startsWith('blog') || normalized.startsWith('insurance')) return true;
    
    // Location pages must start with an active state abbreviation
    for (const stateSlug of ACTIVE_STATE_SLUGS) {
      if (normalized === stateSlug || normalized.startsWith(`${stateSlug}/`)) {
        return true;
      }
    }
    
    return false;
  }, []);

  // Fetch content health stats (seo_pages + blog_posts)
  const { data: healthStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['content-health-stats-v2'],
    queryFn: async (): Promise<ContentHealthStats> => {
      // 1. Fetch seo_pages (excluding orphans)
      const seoPages = await fetchAllWithRange<{ page_type: string | null; word_count: number | null; slug: string }>(
        async (from, to) => {
          const { data, error } = await supabase
            .from('seo_pages')
            .select('page_type, word_count, slug')
            .range(from, to);
          if (error) throw error;
          return data || [];
        }
      );

      // 2. Fetch published blog_posts for accurate blog auditing
      const { data: blogPosts, error: blogErr } = await supabase
        .from('blog_posts')
        .select('id, slug, content, status')
        .eq('status', 'published');
      if (blogErr) throw blogErr;

      const stats: ContentHealthStats = {
        total: 0,
        good: 0,
        thin: 0,
        missing: 0,
        byType: []
      };

      const typeMap = new Map<string, { total: number; good: number; thin: number; missing: number }>();

      // Process seo_pages (exclude inactive states and exclude 'blog' type – we'll use blog_posts instead)
      for (const page of seoPages) {
        const pageType = page.page_type || 'unknown';
        // Skip blog type from seo_pages – we use blog_posts directly
        if (pageType === 'blog') continue;
        // Skip pages from inactive states
        if (!isActiveStateSlug(page.slug, pageType)) continue;

        const status = classifyWordCount(page.word_count);
        stats.total++;
        stats[status]++;

        if (!typeMap.has(pageType)) {
          typeMap.set(pageType, { total: 0, good: 0, thin: 0, missing: 0 });
        }
        const ts = typeMap.get(pageType)!;
        ts.total++;
        ts[status]++;
      }

      // Process blog_posts – extract word count from JSON content
      for (const post of blogPosts || []) {
        let wordCount = 0;
        if (post.content) {
          // content is JSONB with { body: "<html>..." }
          const bodyHtml = typeof post.content === 'object' && (post.content as any).body
            ? (post.content as any).body
            : '';
          // Strip HTML tags and count words
          const textOnly = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          wordCount = textOnly ? textOnly.split(' ').length : 0;
        }
        const status = classifyWordCount(wordCount);
        stats.total++;
        stats[status]++;

        const pt = 'blog';
        if (!typeMap.has(pt)) {
          typeMap.set(pt, { total: 0, good: 0, thin: 0, missing: 0 });
        }
        const ts = typeMap.get(pt)!;
        ts.total++;
        ts[status]++;
      }

      stats.byType = Array.from(typeMap.entries())
        .map(([page_type, counts]) => ({ page_type, ...counts }))
        .sort((a, b) => b.missing - a.missing);

      return stats;
    },
    staleTime: 60000,
  });

  // Fetch pages for the table with pagination - NO LIMIT
  // Excludes inactive state pages and uses blog_posts for blog type
  const { data: allFilteredPages, isLoading: pagesLoading, refetch: refetchPages } = useQuery({
    queryKey: ['content-management-pages-v2', pageTypeFilter, contentStatusFilter, searchQuery],
    queryFn: async (): Promise<SeoPage[]> => {
      const results: SeoPage[] = [];

      // If blog filter is selected, fetch from blog_posts instead of seo_pages
      if (pageTypeFilter === 'blog' || pageTypeFilter === 'all') {
        const { data: blogPosts, error: blogErr } = await supabase
          .from('blog_posts')
          .select('id, slug, title, seo_title, seo_description, content, status, updated_at, published_at')
          .eq('status', 'published');
        if (blogErr) throw blogErr;

        for (const post of blogPosts || []) {
          // Calculate word count from JSON content
          let wordCount = 0;
          if (post.content) {
            const bodyHtml = typeof post.content === 'object' && (post.content as any).body
              ? (post.content as any).body
              : '';
            const textOnly = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            wordCount = textOnly ? textOnly.split(' ').length : 0;
          }

          // Apply content status filter (strict SEO rules)
          const status = classifyWordCount(wordCount);
          if (contentStatusFilter === 'good' && status !== 'good') continue;
          if (contentStatusFilter === 'thin' && status !== 'thin') continue;
          if (contentStatusFilter === 'missing' && status !== 'missing') continue;

          // Apply search filter
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!post.slug?.toLowerCase().includes(q) && !post.title?.toLowerCase().includes(q)) continue;
          }

          results.push({
            id: post.id,
            page_type: 'blog',
            slug: `/blog/${post.slug}`,
            title: post.title,
            meta_title: post.seo_title,
            meta_description: post.seo_description,
            h1: post.title,
            content: null, // don't load full content in list
            word_count: wordCount,
            is_thin_content: wordCount > 0 && wordCount < 300,
            is_duplicate: false,
            is_indexed: true,
            updated_at: post.updated_at || post.published_at || '',
            last_generated_at: null,
          });
        }
      }

      // If blog-only filter, return early
      if (pageTypeFilter === 'blog') {
        return results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      }

      // Fetch seo_pages (excluding 'blog' type – handled above)
      const fetchChunk = async (from: number, to: number) => {
        let query = supabase
          .from('seo_pages')
          .select('id, page_type, slug, title, h1, word_count, is_thin_content, is_duplicate, is_indexed, updated_at, last_generated_at')
          .neq('page_type', 'blog') // exclude blog – we use blog_posts
          .order('updated_at', { ascending: false });

        if (pageTypeFilter !== 'all') {
          query = query.eq('page_type', pageTypeFilter);
        }

        if (searchQuery) {
          query = query.or(`slug.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`);
        }

        // Strict SEO rules: Good >=300, Thin 1-299, Missing = 0/null
        if (contentStatusFilter === 'good') {
          query = query.gte('word_count', 300);
        } else if (contentStatusFilter === 'thin') {
          query = query.gte('word_count', 1).lt('word_count', 300);
        } else if (contentStatusFilter === 'missing') {
          query = query.or('word_count.is.null,word_count.eq.0');
        }

        const { data, error } = await query.range(from, to);
        if (error) throw error;
        return (data || []) as SeoPage[];
      };

      const seoPages = await fetchAllWithRange<SeoPage>(fetchChunk, { chunkSize: 1000 });

      // Filter out pages from inactive states client-side
      for (const page of seoPages) {
        if (isActiveStateSlug(page.slug, page.page_type)) {
          results.push(page);
        }
      }

      return results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    },
  });

  const rowsLimit = useMemo(() => {
    if (rowsOption === 'all') return Infinity;
    return Number(rowsOption);
  }, [rowsOption]);

  const displayPages = useMemo(() => {
    if (!allFilteredPages) return [];
    if (!Number.isFinite(rowsLimit)) return allFilteredPages;
    return allFilteredPages.slice(0, rowsLimit);
  }, [allFilteredPages, rowsLimit]);

  // Virtualization calculations (only when showing ALL)
  const virtual = useMemo(() => {
    const total = displayPages.length;
    const isVirtual = rowsOption === 'all' && total > 0;
    if (!isVirtual) {
      return {
        isVirtual: false,
        total,
        start: 0,
        end: total,
        topSpacer: 0,
        bottomSpacer: 0,
        visible: displayPages,
      };
    }

    const rowHeight = 56; // px (approx)
    const overscan = 12;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(total, start + visibleCount);
    const topSpacer = start * rowHeight;
    const bottomSpacer = (total - end) * rowHeight;

    return {
      isVirtual: true,
      total,
      start,
      end,
      topSpacer,
      bottomSpacer,
      visible: displayPages.slice(start, end),
    };
  }, [displayPages, rowsOption, scrollTop, viewportHeight]);
  
  // Reset to page 1 when filters change
  const handleFilterChange = useCallback((setter: (val: string) => void, value: string) => {
    setter(value);
    setSelectedPages(new Set());
  }, []);

  // Keep viewport height in sync for virtualization
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight || 600);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Generate content mutation
  const generateContentMutation = useMutation({
    mutationFn: async (pageIds: string[]) => {
      setIsGenerating(true);
      setGenerationProgress({ current: 0, total: pageIds.length, status: 'Starting...' });
      
      const results = { success: 0, failed: 0, errors: [] as string[] };
      
      for (let i = 0; i < pageIds.length; i++) {
        const pageId = pageIds[i];
        setGenerationProgress({ 
          current: i + 1, 
          total: pageIds.length, 
          status: `Generating content for page ${i + 1}/${pageIds.length}...` 
        });
        
        try {
          const { data: session } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke('content-generation-studio', {
            body: {
              action: 'generate_content',
              page_id: pageId,
              config: { word_count: targetWordCount }
            },
            headers: {
              Authorization: `Bearer ${session?.session?.access_token}`
            }
          });
          
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push(`Page ${pageId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        
        // Small delay to avoid rate limits
        if (i < pageIds.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      setIsGenerating(false);
      setSelectedPages(new Set());
      refetchPages();
      refetchStats();
      
      if (results.failed === 0) {
        toast.success(`Successfully generated content for ${results.success} pages`);
      } else {
        toast.warning(`Generated ${results.success} pages, ${results.failed} failed`);
        console.error('Generation errors:', results.errors);
      }
    },
    onError: (error) => {
      setIsGenerating(false);
      toast.error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Preview content mutation
  const previewContentMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('content-generation-studio', {
        body: {
          action: 'preview_content',
          page_id: pageId,
          config: { word_count: 700 }
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setPreviewContent(data);
      setPreviewLoading(false);
    },
    onError: (error) => {
      setPreviewLoading(false);
      toast.error(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Apply content mutation
  const applyContentMutation = useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: any }) => {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('content-generation-studio', {
        body: {
          action: 'apply_content',
          page_id: pageId,
          content
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setPreviewPage(null);
      setPreviewContent(null);
      refetchPages();
      refetchStats();
      toast.success('Content applied successfully');
    },
    onError: (error) => {
      toast.error(`Apply failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Handlers
  const handleSelectAllVisible = () => {
    // In "Show all" mode we treat the header checkbox as "select all filtered"
    // (because virtualization only renders part of the list at a time).
    if (rowsOption === 'all') {
      handleSelectAllFiltered();
      return;
    }

    if (!displayPages) return;
    const visibleIds = displayPages.map(p => p.id);
    const allVisibleSelected = visibleIds.every(id => selectedPages.has(id));
    
    if (allVisibleSelected) {
      // Deselect all visible
      const newSelected = new Set(selectedPages);
      visibleIds.forEach(id => newSelected.delete(id));
      setSelectedPages(newSelected);
    } else {
      // Select all visible
      const newSelected = new Set(selectedPages);
      visibleIds.forEach(id => newSelected.add(id));
      setSelectedPages(newSelected);
    }
  };
  
  const handleSelectAllFiltered = () => {
    if (!allFilteredPages) return;
    const allIds = allFilteredPages.map(p => p.id);
    if (selectedPages.size === allIds.length) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(allIds));
    }
    toast.success(`Selected ${allIds.length} pages matching current filters`);
  };

  const handleSelectPage = (pageId: string) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageId)) {
      newSelected.delete(pageId);
    } else {
      newSelected.add(pageId);
    }
    setSelectedPages(newSelected);
  };

  const handleGenerateSelected = () => {
    if (selectedPages.size === 0) {
      toast.error('Please select at least one page');
      return;
    }
    generateContentMutation.mutate(Array.from(selectedPages));
  };

  const handlePreview = (page: SeoPage) => {
    setPreviewPage(page);
    setPreviewLoading(true);
    setPreviewContent(null);
    previewContentMutation.mutate(page.id);
  };

  const handleApplyContent = () => {
    if (!previewPage || !previewContent) return;
    applyContentMutation.mutate({ pageId: previewPage.id, content: previewContent });
  };

  // Strict SEO content status: Good >=300, Thin 1-299, Missing = 0/null
  const getContentStatus = (wordCount: number | null) => {
    const count = wordCount ?? 0;
    if (count >= 300) return { status: 'good', label: 'Good', color: 'bg-green-500' };
    if (count >= 1) return { status: 'thin', label: 'Thin', color: 'bg-yellow-500' };
    return { status: 'missing', label: 'Missing', color: 'bg-red-500' };
  };

  const overallProgress = healthStats 
    ? Math.round((healthStats.good / healthStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Content Health Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsLoading ? '...' : healthStats?.total || 0}</p>
              <p className="text-sm text-muted-foreground">Total Pages</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{statsLoading ? '...' : healthStats?.good || 0}</p>
              <p className="text-sm text-muted-foreground">Good (≥300 words)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-yellow-100 flex items-center justify-center">
              <FileWarning className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{statsLoading ? '...' : healthStats?.thin || 0}</p>
              <p className="text-sm text-muted-foreground">Thin (1-299 words)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
              <FileX className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{statsLoading ? '...' : healthStats?.missing || 0}</p>
              <p className="text-sm text-muted-foreground">Missing (no content)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Content Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold">{overallProgress}%</span>
            <span className="text-sm text-muted-foreground">
              {healthStats?.good || 0} of {healthStats?.total || 0} pages have quality content
            </span>
          </div>
          <Progress value={overallProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Content by Page Type */}
      {healthStats?.byType && healthStats.byType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Content Health by Page Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {healthStats.byType.map((type) => (
                <div 
                  key={type.page_type} 
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setPageTypeFilter(type.page_type)}
                >
                  <p className="font-medium text-sm capitalize">{type.page_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-green-600">{type.good}</span>
                    {' / '}
                    <span className="text-yellow-600">{type.thin}</span>
                    {' / '}
                    <span className="text-red-600">{type.missing}</span>
                  </p>
                  <div className="flex gap-0.5 mt-2">
                    <div 
                      className="h-1.5 bg-green-500 rounded-l" 
                      style={{ width: `${(type.good / type.total) * 100}%` }}
                    />
                    <div 
                      className="h-1.5 bg-yellow-500" 
                      style={{ width: `${(type.thin / type.total) * 100}%` }}
                    />
                    <div 
                      className="h-1.5 bg-red-500 rounded-r" 
                      style={{ width: `${(type.missing / type.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Controls */}
      {isGenerating && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">Generating Content...</span>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setIsGenerating(false)}
              >
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{generationProgress.status}</p>
            <Progress 
              value={(generationProgress.current / generationProgress.total) * 100} 
              className="h-2" 
            />
            <p className="text-xs text-muted-foreground">
              {generationProgress.current} of {generationProgress.total} pages
            </p>
          </CardContent>
        </Card>
      )}

      {/* Page Picker */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Content Generation
              </CardTitle>
              <CardDescription>
                Select pages to generate unique, SEO-optimized content • {allFilteredPages?.length || 0} pages match filters
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="h-4 w-4 mr-1" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllFiltered}
                disabled={!allFilteredPages || allFilteredPages.length === 0}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All ({allFilteredPages?.length || 0})
              </Button>
              <Button
                onClick={handleGenerateSelected}
                disabled={selectedPages.size === 0 || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Generate ({selectedPages.size})
              </Button>
              <Button variant="outline" onClick={() => { refetchPages(); refetchStats(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Generation Settings Panel */}
          {showSettings && (
            <Card className="mt-4 border-dashed">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Target Word Count</Label>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[targetWordCount]}
                        onValueChange={(v) => setTargetWordCount(v[0])}
                        min={300}
                        max={2000}
                        step={100}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono w-16 text-right">{targetWordCount}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Words per page (300-2000)</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Rows Per Page</Label>
                    <Select value={rowsOption} onValueChange={(v) => setRowsOption(v as RowsOption)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All (single scroll)</SelectItem>
                        <SelectItem value="25">25 rows</SelectItem>
                        <SelectItem value="50">50 rows</SelectItem>
                        <SelectItem value="100">100 rows</SelectItem>
                        <SelectItem value="200">200 rows</SelectItem>
                        <SelectItem value="500">500 rows</SelectItem>
                        <SelectItem value="1000">1,000 rows</SelectItem>
                        <SelectItem value="2500">2,500 rows</SelectItem>
                        <SelectItem value="5000">5,000 rows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quick Actions</Label>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedPages(new Set())}
                        disabled={selectedPages.size === 0}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by slug or title..." 
                value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={pageTypeFilter} onValueChange={(v) => handleFilterChange(setPageTypeFilter, v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Page Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="state">State</SelectItem>
                <SelectItem value="city">City</SelectItem>
                <SelectItem value="treatment">Treatment</SelectItem>
                <SelectItem value="service_location">Service Location</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="dentist">Dentist</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contentStatusFilter} onValueChange={(v) => handleFilterChange(setContentStatusFilter, v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Content Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="good">Good (≥300 words)</SelectItem>
                <SelectItem value="thin">Thin (1-299 words)</SelectItem>
                <SelectItem value="missing">Missing (no content)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {pagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <div
                  ref={listContainerRef}
                  className={rowsOption === 'all' ? 'max-h-[70vh] overflow-y-auto' : undefined}
                  onScroll={(e) => {
                    if (rowsOption !== 'all') return;
                    setScrollTop((e.currentTarget as HTMLDivElement).scrollTop);
                  }}
                >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={displayPages && displayPages.length > 0 && (rowsOption === 'all'
                            ? selectedPages.size === displayPages.length
                            : displayPages.every(p => selectedPages.has(p.id)))}
                          onCheckedChange={handleSelectAllVisible}
                        />
                      </TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Words</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {virtual.topSpacer > 0 && (
                      <TableRow>
                        <TableCell colSpan={7} style={{ height: virtual.topSpacer }} />
                      </TableRow>
                    )}

                    {virtual.visible?.map((page) => {
                      const contentStatus = getContentStatus(page.word_count);
                      return (
                        <TableRow key={page.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedPages.has(page.id)}
                              onCheckedChange={() => handleSelectPage(page.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <p className="font-medium truncate">{page.title || page.h1 || page.slug}</p>
                              <p className="text-xs text-muted-foreground truncate">{page.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {page.page_type?.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={contentStatus.status === 'missing' ? 'text-red-600' : contentStatus.status === 'thin' ? 'text-yellow-600' : 'text-green-600'}>
                              {page.word_count || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={contentStatus.status === 'good' ? 'default' : contentStatus.status === 'thin' ? 'secondary' : 'destructive'}
                            >
                              {contentStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(page.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(page)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {virtual.bottomSpacer > 0 && (
                      <TableRow>
                        <TableCell colSpan={7} style={{ height: virtual.bottomSpacer }} />
                      </TableRow>
                    )}

                    {(!displayPages || displayPages.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No pages found matching your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>

              {allFilteredPages && allFilteredPages.length > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  Showing {displayPages.length} of {allFilteredPages.length} pages
                  {rowsOption === 'all' ? ' (single scroll)' : ''}
                  {selectedPages.size > 0 ? ` • ${selectedPages.size} selected` : ''}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewPage} onOpenChange={() => { setPreviewPage(null); setPreviewContent(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Content Preview</DialogTitle>
            <DialogDescription>
              {previewPage?.slug}
            </DialogDescription>
          </DialogHeader>
          
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3">Generating preview...</span>
            </div>
          ) : previewContent ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Meta Title</label>
                  <p className="text-sm text-muted-foreground border rounded p-2 mt-1">
                    {previewContent.meta_title}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">H1</label>
                  <p className="text-sm text-muted-foreground border rounded p-2 mt-1">
                    {previewContent.h1}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Meta Description</label>
                <p className="text-sm text-muted-foreground border rounded p-2 mt-1">
                  {previewContent.meta_description}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  Content
                  <Badge variant="outline">{previewContent.word_count} words</Badge>
                </label>
                <div className="border rounded p-4 mt-1 max-h-[400px] overflow-y-auto prose prose-sm dark:prose-invert">
                  <div dangerouslySetInnerHTML={{ 
                    __html: sanitizeHtml(previewContent.content
                      ?.replace(/^## (.+)$/gm, '<h2>$1</h2>')
                      ?.replace(/^### (.+)$/gm, '<h3>$1</h3>')
                      ?.replace(/\n\n/g, '</p><p>')
                      ?.replace(/^/gm, '<p>')
                      ?.replace(/$/gm, '</p>') || '')
                  }} />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setPreviewPage(null); setPreviewContent(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleApplyContent} disabled={applyContentMutation.isPending}>
                  {applyContentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Apply Content
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to generate preview
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
