import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ACTIVE_STATE_SLUGS, isPageInActiveState } from '@/lib/constants/activeStates';
import { 
  FileEdit, 
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
  Users,
  FileText,
  History,
  RotateCcw,
  Save,
  Wand2,
  CheckSquare,
  Square,
  ListFilter,
  Layers,
  PenTool,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  LayoutGrid,
  Settings2,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { parseMarkdownContent } from '@/hooks/useSeoPageContent';

// Types
interface SeoPage {
  id: string;
  slug: string;
  page_type: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  h1: string | null;
  page_intro: string | null;
  content: string | null;
  h2_sections: any | null;
  internal_links_intro: string | null;
  faqs: any | null;
  word_count: number | null;
  seo_score: number | null;
  is_thin_content: boolean | null;
  is_duplicate: boolean | null;
  is_optimized: boolean | null;
  is_indexed: boolean | null;
  needs_optimization: boolean | null;
  last_audited_at: string | null;
  optimized_at: string | null;
  updated_at: string;
}

interface ContentVersion {
  id: string;
  seo_page_id: string;
  version_number: number;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  content: string | null;
  word_count: number | null;
  seo_score: number | null;
  faq: any[] | null;
  change_source: string | null;
  change_reason: string | null;
  is_current: boolean;
  created_at: string;
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

// STRICT TOOL SEPARATION: Content Studio generates BODY CONTENT ONLY
// - FAQs are handled by FAQ Studio (separate tab)
// - Meta title/description are handled by Meta Optimizer (separate tab)
interface GenerationConfig {
  wordCount: number;
  rewriteEntire: boolean;
  generateIntro: boolean;
  generateSections: boolean;
  // generateFaqs REMOVED - FAQ Studio responsibility
  generateInternalLinks: boolean;
  expandExisting: boolean;
  saveAsDraft: boolean;
  // New controls for strict separation
  doNotOverwriteExisting: boolean;
  rewriteOnlyThinSections: boolean;
  generateH1: boolean;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  static: 'Static Pages',
  state: 'State Pages',
  city: 'City Pages',
  treatment: 'Service Pages',
  service_location: 'Service + Location',
  city_treatment: 'City + Treatment',
  clinic: 'Clinic/Dentist Pages',
  dentist: 'Dentist Profiles',
  blog: 'Blog Posts',
};

const PAGE_TYPE_ICONS: Record<string, any> = {
  static: FileText,
  state: Globe,
  city: MapPin,
  treatment: Stethoscope,
  service_location: Layers,
  city_treatment: Layers,
  clinic: Building2,
  dentist: Users,
  blog: BookOpen,
};

export default function ContentGenerationStudioTab() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'selection' | 'generation' | 'history'>('selection');
  
  // Selection state
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<'single' | 'bulk'>('bulk');
  
  // Filter state
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('__all__');
  const [stateFilter, setStateFilter] = useState<string>('__all__');
  const [cityFilter, setCityFilter] = useState<string>('__all__');
  const [serviceFilter, setServiceFilter] = useState<string>('__all__');
  const [contentStatusFilter, setContentStatusFilter] = useState<string>('__all__');
  const [wordCountRange, setWordCountRange] = useState<[number, number]>([0, 5000]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Generation config - STRICT SEPARATION: No FAQ generation (handled by FAQ Studio)
  const [config, setConfig] = useState<GenerationConfig>({
    wordCount: 700,
    rewriteEntire: false,
    generateIntro: true,
    generateSections: true,
    // generateFaqs REMOVED - FAQ Studio responsibility
    generateInternalLinks: true,
    expandExisting: false,
    saveAsDraft: false,
    // New controls
    doNotOverwriteExisting: false,
    rewriteOnlyThinSections: false,
    generateH1: true,
  });
  
  // Job state
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const stopFlagRef = useRef(false);
  const logsScrollRef = useRef<HTMLDivElement>(null);
  
  // Preview state
  const [previewPage, setPreviewPage] = useState<SeoPage | null>(null);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Edit state
  const [editingPage, setEditingPage] = useState<SeoPage | null>(null);
  const [editActiveTab, setEditActiveTab] = useState('seo');
  const [editContent, setEditContent] = useState({
    meta_title: '',
    meta_description: '',
    og_title: '',
    og_description: '',
    canonical_url: '',
    h1: '',
    page_intro: '',
    content: '',
    h2_sections: '' as string,
    internal_links_intro: '',
    faqs: '' as string,
    is_indexed: true,
  });

  // Auto-scroll logs
  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [currentJob?.logs]);

  // Fetch all SEO pages
  const { data: seoPages, isLoading: pagesLoading, refetch: refetchPages } = useQuery({
    queryKey: ['content-studio-pages'],
    queryFn: async () => {
      const pageSize = 1000;
      const all: SeoPage[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('seo_pages')
          .select('*')
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
    queryKey: ['content-studio-states'],
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

  // Fetch cities for filter (filtered by state)
  const { data: cities } = useQuery({
    queryKey: ['content-studio-cities', stateFilter],
    queryFn: async () => {
      let query = supabase.from('cities').select('id, name, state_id').eq('is_active', true).order('name').limit(500);
      if (stateFilter && stateFilter !== '__all__') {
        query = query.eq('state_id', stateFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch treatments/services for filter
  const { data: treatments } = useQuery({
    queryKey: ['content-studio-treatments'],
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

  // Fetch content versions for history
  const { data: contentVersions } = useQuery({
    queryKey: ['content-versions', previewPage?.id],
    queryFn: async () => {
      if (!previewPage?.id) return [];
      const { data, error } = await supabase
        .from('seo_content_versions')
        .select('*')
        .eq('seo_page_id', previewPage.id)
        .order('version_number', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as ContentVersion[];
    },
    enabled: !!previewPage?.id,
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!seoPages) return null;
    return {
      total: seoPages.length,
      withContent: seoPages.filter(p => p.content && (p.word_count || 0) >= 100).length,
      noContent: seoPages.filter(p => !p.content || (p.word_count || 0) < 50).length,
      thinContent: seoPages.filter(p => p.is_thin_content).length,
      optimized: seoPages.filter(p => p.is_optimized).length,
      byType: Object.entries(PAGE_TYPE_LABELS).map(([type, label]) => ({
        type,
        label,
        count: seoPages.filter(p => p.page_type === type).length,
        withContent: seoPages.filter(p => p.page_type === type && p.content && (p.word_count || 0) >= 100).length,
      })).filter(t => t.count > 0),
    };
  }, [seoPages]);

  // Filter pages based on all criteria
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
      
      // Service filter (check slug pattern)
      if (serviceFilter !== '__all__') {
        const treatment = treatments?.find(t => t.id === serviceFilter);
        if (treatment && !page.slug.toLowerCase().includes(treatment.slug.toLowerCase())) {
          return false;
        }
      }
      
      // Content status filter
      if (contentStatusFilter === 'has_content' && (!page.content || (page.word_count || 0) < 100)) return false;
      if (contentStatusFilter === 'no_content' && page.content && (page.word_count || 0) >= 50) return false;
      if (contentStatusFilter === 'thin_content' && !page.is_thin_content) return false;
      if (contentStatusFilter === 'optimized' && !page.is_optimized) return false;
      if (contentStatusFilter === 'not_optimized' && page.is_optimized) return false;
      if (contentStatusFilter === 'has_meta' && (!page.meta_title || !page.meta_description)) return false;
      if (contentStatusFilter === 'no_meta' && page.meta_title && page.meta_description) return false;
      
      // Word count range
      const wc = page.word_count || 0;
      if (wc < wordCountRange[0] || wc > wordCountRange[1]) return false;
      
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
  }, [seoPages, pageTypeFilter, stateFilter, serviceFilter, contentStatusFilter, wordCountRange, searchQuery, states, treatments]);

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

  // Start content generation
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

    addLog({ page: '', action: 'started', message: `Starting content generation for ${selectedPages.length} pages...` });
    
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

      addLog({ page: pageName, action: 'started', message: `Generating content...` });

      try {
        const { data, error } = await supabase.functions.invoke('content-generation-studio', {
          body: {
            action: 'generate_content',
            page_id: pageId,
            config: {
              word_count: config.wordCount,
              rewrite_entire: config.rewriteEntire,
              generate_intro: config.generateIntro,
              generate_sections: config.generateSections,
              // generate_faqs REMOVED - FAQ Studio responsibility
              generate_internal_links: config.generateInternalLinks,
              expand_existing: config.expandExisting,
              save_as_draft: config.saveAsDraft,
              do_not_overwrite_existing: config.doNotOverwriteExisting,
              rewrite_only_thin_sections: config.rewriteOnlyThinSections,
            },
          },
        });

        if (error) throw error;

        success++;
        addLog({ 
          page: pageName, 
          action: 'completed', 
          message: `Content generated successfully! Word count: ${data?.word_count || 'N/A'}`,
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
    queryClient.invalidateQueries({ queryKey: ['content-studio-pages'] });
    toast.success(`Generation complete! ${success} pages processed, ${errors} errors`);
  };

  // Preview content before applying
  const previewGeneration = async (page: SeoPage) => {
    setPreviewPage(page);
    setShowPreview(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('content-generation-studio', {
        body: {
          action: 'preview_content',
          page_id: page.id,
          config: {
            word_count: config.wordCount,
            // generate_faqs REMOVED - FAQ Studio responsibility
          },
        },
      });

      if (error) throw error;
      setPreviewContent(data);
    } catch (err) {
      toast.error(`Preview failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Apply content from preview
  const applyPreviewContent = async () => {
    if (!previewPage || !previewContent) return;
    
    try {
      const { error } = await supabase.functions.invoke('content-generation-studio', {
        body: {
          action: 'apply_content',
          page_id: previewPage.id,
          content: previewContent,
          save_as_draft: config.saveAsDraft,
        },
      });

      if (error) throw error;
      toast.success('Content applied successfully!');
      setShowPreview(false);
      setPreviewPage(null);
      setPreviewContent(null);
      queryClient.invalidateQueries({ queryKey: ['content-studio-pages'] });
    } catch (err) {
      toast.error(`Apply failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Rollback to previous version
  const rollbackVersion = async (versionId: string) => {
    if (!previewPage) return;
    
    try {
      const { error } = await supabase.functions.invoke('content-generation-studio', {
        body: {
          action: 'rollback_version',
          page_id: previewPage.id,
          version_id: versionId,
        },
      });

      if (error) throw error;
      toast.success('Rolled back successfully!');
      queryClient.invalidateQueries({ queryKey: ['content-studio-pages'] });
      queryClient.invalidateQueries({ queryKey: ['content-versions'] });
    } catch (err) {
      toast.error(`Rollback failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Open manual edit dialog
  const openEditDialog = async (page: SeoPage) => {
    // Fetch full page data from DB to get all fields
    const { data: fullPage } = await supabase.from('seo_pages').select('*').eq('id', page.id).single();
    const p = fullPage || page;
    
    // Parse the content markdown to extract real intro and sections
    // This is the SAME parsing the live pages use, so the editor shows exactly what's on the site
    const rawContent = (p as any).content || '';
    const parsed = rawContent ? parseMarkdownContent(rawContent) : { intro: '', sections: [] };
    
    // Use dedicated page_intro if available, otherwise use parsed intro from content
    const introText = (p as any).page_intro || parsed.intro || '';
    
    // Use dedicated h2_sections if available, otherwise convert parsed sections
    const h2Sections = (p as any).h2_sections 
      ? (p as any).h2_sections 
      : parsed.sections.length > 0 
        ? parsed.sections.map((s: any) => ({ title: s.heading, content: s.content?.trim() || '' }))
        : [];
    
    setEditingPage(page);
    setEditActiveTab('seo');
    setEditContent({
      meta_title: (p as any).meta_title || '',
      meta_description: (p as any).meta_description || '',
      og_title: (p as any).og_title || '',
      og_description: (p as any).og_description || '',
      canonical_url: (p as any).canonical_url || '',
      h1: (p as any).h1 || '',
      page_intro: introText,
      content: rawContent,
      h2_sections: JSON.stringify(h2Sections, null, 2),
      internal_links_intro: (p as any).internal_links_intro || '',
      faqs: (p as any).faqs ? JSON.stringify((p as any).faqs, null, 2) : '[]',
      is_indexed: (p as any).is_indexed ?? true,
    });
  };

  // Save manual edits - direct DB update for full control
  const saveManualEdits = async () => {
    if (!editingPage) return;
    
    try {
      // Parse JSON fields
      let parsedH2: any = null;
      let parsedFaqs: any = null;
      try { parsedH2 = JSON.parse(editContent.h2_sections); } catch { parsedH2 = null; }
      try { parsedFaqs = JSON.parse(editContent.faqs); } catch { parsedFaqs = null; }

      // CRITICAL: Reconstruct the `content` markdown from edited parts
      // This is what the live pages actually read via parseMarkdownContent()
      let reconstructedContent = '';
      
      // Add intro paragraph
      if (editContent.page_intro) {
        reconstructedContent += editContent.page_intro.trim() + '\n\n';
      }
      
      // Add H2 sections from the JSON editor
      if (parsedH2 && Array.isArray(parsedH2) && parsedH2.length > 0) {
        for (const section of parsedH2) {
          if (section.title) {
            reconstructedContent += `## ${section.title}\n\n`;
          }
          if (section.content) {
            reconstructedContent += section.content.trim() + '\n\n';
          }
        }
      }

      // If user also edited the raw content directly, use that instead
      // (check if it differs from what we'd reconstruct)
      const useRawContent = editContent.content.trim().length > 0 && 
        editContent.content.trim() !== reconstructedContent.trim();
      
      const finalContent = useRawContent ? editContent.content : reconstructedContent.trim();
      const wordCount = finalContent ? finalContent.split(/\s+/).filter(Boolean).length : 0;

      const { error } = await supabase
        .from('seo_pages')
        .update({
          meta_title: editContent.meta_title || null,
          meta_description: editContent.meta_description || null,
          og_title: editContent.og_title || null,
          og_description: editContent.og_description || null,
          canonical_url: editContent.canonical_url || null,
          h1: editContent.h1 || null,
          page_intro: editContent.page_intro || null,
          content: finalContent || null,
          h2_sections: parsedH2,
          internal_links_intro: editContent.internal_links_intro || null,
          faqs: parsedFaqs,
          is_indexed: editContent.is_indexed,
          word_count: wordCount,
          is_thin_content: wordCount < 100,
          is_optimized: wordCount >= 200 && (editContent.meta_title?.length || 0) > 0,
          last_content_edit_source: 'manual_studio',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', editingPage.id);

      if (error) throw error;
      toast.success('All changes saved successfully! Changes will appear on the live page.');
      setEditingPage(null);
      queryClient.invalidateQueries({ queryKey: ['content-studio-pages'] });
      // Also invalidate the SEO content cache so live pages pick up changes immediately
      queryClient.invalidateQueries({ queryKey: ['seo-page-content'] });
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // State setup mutation
  const setupStateMutation = useMutation({
    mutationFn: async (stateId: string) => {
      const { data, error } = await supabase.functions.invoke('setup-state-seo-pages', {
        body: { state_id: stateId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'State SEO pages created successfully!');
      queryClient.invalidateQueries({ queryKey: ['content-studio-pages'] });
      refetchPages();
    },
    onError: (err) => {
      toast.error(`Setup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            Content Generation Studio
          </h2>
          <p className="text-muted-foreground mt-1">
            Generate high-quality, SEO-optimized content for any page type
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetchPages()} disabled={pagesLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${pagesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions: State Setup */}
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Actions: State Setup
          </CardTitle>
          <CardDescription>
            Create all city + service pages for a state with one click
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {states?.map(state => (
              <Button
                key={state.id}
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Create all city and service+city SEO pages for ${state.name}? This may create hundreds of pages.`)) {
                    setupStateMutation.mutate(state.id);
                  }
                }}
                disabled={setupStateMutation.isPending}
              >
                {setupStateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4 mr-1" />
                )}
                {state.name} ({state.abbreviation})
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Each state setup creates city pages + service+city pages for all services.
            After setup, select pages above and generate content.
          </p>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Pages</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.withContent.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">With Content</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.noContent.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">No Content</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{stats.thinContent.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Thin Content</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.optimized.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Optimized</div>
            </CardContent>
          </Card>
        </div>
      )}

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
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Page Selection Tab */}
        <TabsContent value="selection" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Page Selection Engine
              </CardTitle>
              <CardDescription>
                Select pages by type, location, service, or content status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primary Filters */}
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
                  <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setCityFilter('__all__'); }}>
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
                  <Label>Service/Treatment</Label>
                  <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Services</SelectItem>
                      {treatments?.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Content Status</Label>
                  <Select value={contentStatusFilter} onValueChange={setContentStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Status</SelectItem>
                      <SelectItem value="no_content">No Content</SelectItem>
                      <SelectItem value="thin_content">Thin Content</SelectItem>
                      <SelectItem value="has_content">Has Content</SelectItem>
                      <SelectItem value="no_meta">Missing Meta</SelectItem>
                      <SelectItem value="has_meta">Has Meta</SelectItem>
                      <SelectItem value="optimized">Optimized</SelectItem>
                      <SelectItem value="not_optimized">Not Optimized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced Filters */}
              <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    {showAdvancedFilters ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                    Advanced Filters
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Search (URL, Title, H1)</Label>
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
                    <div className="space-y-2">
                      <Label>Word Count Range: {wordCountRange[0]} - {wordCountRange[1]}</Label>
                      <Slider
                        value={wordCountRange}
                        onValueChange={(v) => setWordCountRange(v as [number, number])}
                        min={0}
                        max={5000}
                        step={50}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Selection Actions */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {filteredPages.length.toLocaleString()} pages match filters
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
                    Select All Filtered ({filteredPages.length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generation Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Generation Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Content Length</Label>
                  <Select 
                    value={config.wordCount.toString()} 
                    onValueChange={(v) => setConfig(prev => ({ ...prev, wordCount: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="500">500 words</SelectItem>
                      <SelectItem value="700">700 words</SelectItem>
                      <SelectItem value="1000">1000 words</SelectItem>
                      <SelectItem value="1500">1500 words</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* STRICT TOOL SEPARATION: Content Studio generates BODY CONTENT ONLY */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border mb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  <span>Content Studio generates <strong>body content only</strong>. Use <strong>FAQ Studio</strong> for FAQs and <strong>Meta Optimizer</strong> for meta tags.</span>
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* H1 Generation Toggle (NEW) */}
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="h1" 
                    checked={config.generateH1}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, generateH1: v }))}
                  />
                  <Label htmlFor="h1">Generate H1</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="rewrite" 
                    checked={config.rewriteEntire}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, rewriteEntire: v }))}
                  />
                  <Label htmlFor="rewrite">Rewrite Entire Page</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="intro" 
                    checked={config.generateIntro}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, generateIntro: v }))}
                  />
                  <Label htmlFor="intro">Generate Intro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="sections" 
                    checked={config.generateSections}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, generateSections: v }))}
                  />
                  <Label htmlFor="sections">Generate Sections</Label>
                </div>
                {/* FAQ toggle REMOVED - FAQ Studio is responsible for FAQs */}
                <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed">
                  <Switch 
                    id="faqs-disabled" 
                    checked={false}
                    disabled={true}
                  />
                  <Label htmlFor="faqs-disabled" className="text-muted-foreground">
                    FAQs <span className="text-xs">(FAQ Studio)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="links" 
                    checked={config.generateInternalLinks}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, generateInternalLinks: v }))}
                  />
                  <Label htmlFor="links">Internal Links Intro</Label>
                </div>
              </div>
              
              {/* Protection Controls (NEW) */}
              <div className="grid grid-cols-2 gap-3 mt-4 p-3 bg-muted/30 rounded-lg border border-dashed">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="no-overwrite" 
                    checked={config.doNotOverwriteExisting}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, doNotOverwriteExisting: v }))}
                  />
                  <Label htmlFor="no-overwrite" className="text-sm">Don't Overwrite Existing</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="thin-only" 
                    checked={config.rewriteOnlyThinSections}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, rewriteOnlyThinSections: v }))}
                  />
                  <Label htmlFor="thin-only" className="text-sm">Rewrite Thin Sections Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="expand" 
                    checked={config.expandExisting}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, expandExisting: v }))}
                  />
                  <Label htmlFor="expand" className="text-sm">Expand (Don't Replace)</Label>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="draft" 
                    checked={config.saveAsDraft}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, saveAsDraft: v }))}
                  />
                  <Label htmlFor="draft">Save as Draft (Don't Apply Live)</Label>
                </div>
                <Button 
                  onClick={startGeneration} 
                  disabled={selectedPages.length === 0 || isGenerating}
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Content ({selectedPages.length} pages)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Page Type Distribution */}
          {stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Page Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stats.byType.map(({ type, label, count, withContent }) => {
                    const Icon = PAGE_TYPE_ICONS[type] || FileText;
                    const pct = count > 0 ? Math.round((withContent / count) * 100) : 0;
                    return (
                      <button
                        key={type}
                        onClick={() => setPageTypeFilter(type)}
                        className={`p-3 rounded-lg border text-left transition-colors hover:bg-muted ${pageTypeFilter === type ? 'border-primary bg-primary/5' : ''}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{label}</span>
                        </div>
                        <div className="text-xl font-bold">{count.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {pct}% with content
                        </div>
                        <Progress value={pct} className="h-1 mt-1" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pages Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pages ({filteredPages.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={filteredPages.length > 0 && filteredPages.every(p => selectedPages.includes(p.id))}
                          onCheckedChange={(checked) => {
                            if (checked) selectAllFiltered();
                            else clearSelection();
                          }}
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
                    {pagesLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading pages...
                        </TableCell>
                      </TableRow>
                    ) : filteredPages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No pages match the current filters
                        </TableCell>
                      </TableRow>
                    ) : filteredPages.slice(0, 100).map((page) => {
                      const Icon = PAGE_TYPE_ICONS[page.page_type] || FileText;
                      const hasContent = page.content && (page.word_count || 0) >= 100;
                      const hasMeta = page.meta_title && page.meta_description;
                      
                      return (
                        <TableRow key={page.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedPages.includes(page.id)}
                              onCheckedChange={() => togglePageSelection(page.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <div className="font-medium truncate" title={page.h1 || page.title || page.slug}>
                                {page.h1 || page.title || page.slug}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                /{page.slug}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Icon className="h-3 w-3" />
                              {PAGE_TYPE_LABELS[page.page_type] || page.page_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={page.word_count && page.word_count >= 300 ? 'text-green-600' : 'text-amber-600'}>
                              {page.word_count?.toLocaleString() || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {hasContent ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200 w-fit">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Content
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-200 w-fit">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  No Content
                                </Badge>
                              )}
                              {page.is_optimized && (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200 w-fit">
                                  Optimized
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {page.updated_at ? format(new Date(page.updated_at), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => previewGeneration(page)}
                                title="Preview & Generate"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEditDialog(page)}
                                title="Manual Edit"
                              >
                                <PenTool className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filteredPages.length > 100 && (
                  <div className="text-center py-4 text-muted-foreground">
                    Showing 100 of {filteredPages.length} pages. Use filters to narrow down.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generation Tab */}
        <TabsContent value="generation" className="space-y-4">
          {currentJob ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {currentJob.status === 'running' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : currentJob.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : currentJob.status === 'stopped' ? (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    Generation Job
                  </CardTitle>
                  {currentJob.status === 'running' && (
                    <Button variant="destructive" size="sm" onClick={stopGeneration}>
                      Stop Generation
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Started {format(currentJob.startedAt, 'PPpp')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress: {currentJob.processed} / {currentJob.total}</span>
                    <span>{Math.round((currentJob.processed / currentJob.total) * 100)}%</span>
                  </div>
                  <Progress value={(currentJob.processed / currentJob.total) * 100} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-green-600">{currentJob.success}</div>
                    <div className="text-sm text-muted-foreground">Success</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-red-600">{currentJob.errors}</div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold">{currentJob.total - currentJob.processed}</div>
                    <div className="text-sm text-muted-foreground">Remaining</div>
                  </div>
                </div>

                {currentJob.currentPage && currentJob.status === 'running' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Currently processing: <span className="font-mono">{currentJob.currentPage}</span>
                  </div>
                )}

                <div className="border rounded-lg">
                  <div className="p-2 bg-muted font-medium text-sm border-b">Generation Logs</div>
                  <ScrollArea className="h-[300px]" ref={logsScrollRef}>
                    <div className="p-2 space-y-1">
                      {currentJob.logs.map((log, i) => (
                        <div 
                          key={i} 
                          className={`text-xs font-mono p-1.5 rounded ${
                            log.action === 'completed' ? 'bg-green-500/10 text-green-700' :
                            log.action === 'error' ? 'bg-red-500/10 text-red-700' :
                            log.action === 'skipped' ? 'bg-amber-500/10 text-amber-700' :
                            'bg-muted'
                          }`}
                        >
                          <span className="opacity-60">[{format(log.timestamp, 'HH:mm:ss')}]</span>{' '}
                          {log.page && <span className="font-semibold">{log.page}</span>}{' '}
                          {log.message}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Active Generation Job</h3>
                <p className="text-muted-foreground mb-4">
                  Select pages and start generation from the Page Selection tab
                </p>
                <Button onClick={() => setActiveView('selection')}>
                  Go to Page Selection
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Content Version History
              </CardTitle>
              <CardDescription>
                View and rollback to previous versions of any page
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewPage ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{previewPage.h1 || previewPage.slug}</h4>
                      <p className="text-sm text-muted-foreground">/{previewPage.slug}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPreviewPage(null)}>
                      <X className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Words</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contentVersions?.map((version) => (
                        <TableRow key={version.id}>
                          <TableCell>
                            <Badge variant={version.is_current ? "default" : "outline"}>
                              v{version.version_number}
                              {version.is_current && ' (Current)'}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">
                            {version.change_source || 'Unknown'}
                          </TableCell>
                          <TableCell>{version.word_count || 0}</TableCell>
                          <TableCell>{version.seo_score || '-'}</TableCell>
                          <TableCell>
                            {version.created_at ? format(new Date(version.created_at), 'MMM d, HH:mm') : '-'}
                          </TableCell>
                          <TableCell>
                            {!version.is_current && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => rollbackVersion(version.id)}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Rollback
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select a page from the Page Selection tab and click the preview icon to view its history
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Content Preview</DialogTitle>
            <DialogDescription>
              Preview generated content before applying to: {previewPage?.slug}
            </DialogDescription>
          </DialogHeader>
          
          {previewContent ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Current H1</Label>
                  <div className="p-2 bg-muted rounded text-sm">{previewPage?.h1 || 'None'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">New H1</Label>
                  <div className="p-2 bg-green-500/10 rounded text-sm font-medium">{previewContent.h1}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Current Meta Title</Label>
                  <div className="p-2 bg-muted rounded text-sm">{previewPage?.meta_title || 'None'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">New Meta Title</Label>
                  <div className="p-2 bg-green-500/10 rounded text-sm">{previewContent.meta_title}</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">New Content Preview</Label>
                <div className="p-3 bg-muted rounded text-sm max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                  {previewContent.intro_paragraph}
                </div>
              </div>

              {previewContent.faq && previewContent.faq.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">FAQs ({previewContent.faq.length})</Label>
                  <div className="p-3 bg-muted rounded space-y-2">
                    {previewContent.faq.slice(0, 3).map((faq: any, i: number) => (
                      <div key={i} className="text-sm">
                        <div className="font-medium">Q: {faq.question}</div>
                        <div className="text-muted-foreground truncate">A: {faq.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowPreview(false); setPreviewContent(null); }}>
                  Cancel
                </Button>
                <Button onClick={applyPreviewContent}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Content
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Page Editor Dialog */}
      <Dialog open={!!editingPage} onOpenChange={(open) => !open && setEditingPage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              Edit Page Content
            </DialogTitle>
            <DialogDescription>
              <code className="text-primary font-mono">/{editingPage?.slug}</code>
              <span className="ml-2">
                <Badge variant="outline" className="capitalize">{editingPage?.page_type}</Badge>
              </span>
            </DialogDescription>
          </DialogHeader>

          <Tabs value={editActiveTab} onValueChange={setEditActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="seo" className="flex items-center gap-1 text-xs">
                <Search className="h-3 w-3" />
                SEO & Meta
              </TabsTrigger>
              <TabsTrigger value="hero" className="flex items-center gap-1 text-xs">
                <FileEdit className="h-3 w-3" />
                Hero & Intro
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-1 text-xs">
                <BookOpen className="h-3 w-3" />
                Body Content
              </TabsTrigger>
              <TabsTrigger value="faqs" className="flex items-center gap-1 text-xs">
                <Layers className="h-3 w-3" />
                FAQs
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1 text-xs">
                <Settings2 className="h-3 w-3" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* SEO & Meta Tab */}
            <TabsContent value="seo" className="space-y-4">
              <div className="space-y-2">
                <Label>Meta Title (max 60 chars)</Label>
                <Input 
                  value={editContent.meta_title}
                  onChange={(e) => setEditContent(prev => ({ ...prev, meta_title: e.target.value }))}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Appears in browser tab & search results</span>
                  <span className={editContent.meta_title.length > 60 ? 'text-destructive' : 'text-muted-foreground'}>
                    {editContent.meta_title.length}/60
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Meta Description (max 155 chars)</Label>
                <Textarea 
                  value={editContent.meta_description}
                  onChange={(e) => setEditContent(prev => ({ ...prev, meta_description: e.target.value }))}
                  rows={3}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Appears in search engine snippets</span>
                  <span className={editContent.meta_description.length > 155 ? 'text-destructive' : 'text-muted-foreground'}>
                    {editContent.meta_description.length}/155
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>OG Title (Social Share)</Label>
                  <Input 
                    value={editContent.og_title}
                    onChange={(e) => setEditContent(prev => ({ ...prev, og_title: e.target.value }))}
                    placeholder="Defaults to meta title if empty"
                  />
                </div>
                <div className="space-y-2">
                  <Label>OG Description</Label>
                  <Input 
                    value={editContent.og_description}
                    onChange={(e) => setEditContent(prev => ({ ...prev, og_description: e.target.value }))}
                    placeholder="Defaults to meta description if empty"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Canonical URL</Label>
                <Input 
                  value={editContent.canonical_url}
                  onChange={(e) => setEditContent(prev => ({ ...prev, canonical_url: e.target.value }))}
                  placeholder="Leave empty for default (self-referencing)"
                />
              </div>

              {/* Google Preview */}
              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-2">Google Search Preview</p>
                <div className="space-y-1">
                  <p className="text-blue-600 text-lg hover:underline cursor-pointer truncate">
                    {editContent.meta_title || editContent.h1 || 'Page Title'}
                  </p>
                  <p className="text-green-700 text-sm truncate">
                    appointpanda.com/{editingPage?.slug}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {editContent.meta_description || 'No meta description set...'}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Hero & Intro Tab */}
            <TabsContent value="hero" className="space-y-4">
              <div className="space-y-2">
                <Label>H1 Heading (Main Title)</Label>
                <Input 
                  value={editContent.h1}
                  onChange={(e) => setEditContent(prev => ({ ...prev, h1: e.target.value }))}
                  placeholder="Main visible heading on the page"
                />
                <p className="text-xs text-muted-foreground">The primary heading users see on the page</p>
              </div>

              <div className="space-y-2">
                <Label>Page Introduction / Intro Paragraph</Label>
                <Textarea 
                  value={editContent.page_intro}
                  onChange={(e) => setEditContent(prev => ({ ...prev, page_intro: e.target.value }))}
                  placeholder="Introduction text shown after the hero section. Supports Markdown..."
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Displayed in the PageIntroSection below the hero. Supports Markdown formatting.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Internal Links Intro</Label>
                <Textarea 
                  value={editContent.internal_links_intro}
                  onChange={(e) => setEditContent(prev => ({ ...prev, internal_links_intro: e.target.value }))}
                  placeholder="Introductory text for the internal links section..."
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>

            {/* Body Content Tab */}
            <TabsContent value="content" className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-primary flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  <strong>How it works:</strong> The raw markdown below is what appears on the live site. 
                  Editing "Page Intro" or "H2 Sections" in other tabs will update this field when you save.
                  If you edit this raw content directly, it takes priority.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Raw Content (Markdown) — <span className="text-muted-foreground font-normal">This is what the live page renders</span></Label>
                <Textarea 
                  value={editContent.content}
                  onChange={(e) => setEditContent(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Main page content. Supports Markdown formatting..."
                  rows={18}
                  className="font-mono text-sm"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Supports: **bold**, *italic*, ## H2 headings, ### H3, - lists, [links](url)</span>
                  <span>~{editContent.content.split(/\s+/).filter(Boolean).length} words</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>H2 Sections (JSON) — <span className="text-muted-foreground font-normal">Auto-extracted from content above</span></Label>
                <Textarea 
                  value={editContent.h2_sections}
                  onChange={(e) => setEditContent(prev => ({ ...prev, h2_sections: e.target.value }))}
                  placeholder='[{"title": "Section Title", "content": "Section content..."}]'
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  These sections are automatically parsed from the content. You can edit them here to restructure the page.
                </p>
              </div>
            </TabsContent>

            {/* FAQs Tab */}
            <TabsContent value="faqs" className="space-y-4">
              <div className="space-y-2">
                <Label>FAQ Content (JSON Array)</Label>
                <Textarea 
                  value={editContent.faqs}
                  onChange={(e) => setEditContent(prev => ({ ...prev, faqs: e.target.value }))}
                  placeholder='[{"question": "What is...?", "answer": "It is..."}]'
                  rows={14}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  JSON array of FAQ objects. Each must have "question" and "answer" string properties.
                </p>
              </div>
              
              {/* FAQ Preview */}
              {(() => {
                try {
                  const parsed = JSON.parse(editContent.faqs);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    return (
                      <div className="border rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Preview ({parsed.length} FAQs)</p>
                        {parsed.slice(0, 5).map((faq: any, i: number) => (
                          <div key={i} className="border-l-2 border-primary/30 pl-3">
                            <p className="font-medium text-sm">Q: {faq.question}</p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">A: {faq.answer}</p>
                          </div>
                        ))}
                        {parsed.length > 5 && (
                          <p className="text-xs text-muted-foreground">...and {parsed.length - 5} more</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                } catch {
                  return (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Invalid JSON format. Please fix before saving.
                      </p>
                    </div>
                  );
                }
              })()}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                <div>
                  <Label className="text-sm font-medium">Indexed by Search Engines</Label>
                  <p className="text-xs text-muted-foreground mt-1">When enabled, search engines will index this page</p>
                </div>
                <Switch 
                  checked={editContent.is_indexed}
                  onCheckedChange={(v) => setEditContent(prev => ({ ...prev, is_indexed: v }))}
                />
              </div>

              <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                <p className="text-sm font-medium">Page Info</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Page Type:</span>
                  <Badge variant="outline" className="capitalize w-fit">{editingPage?.page_type}</Badge>
                  <span className="text-muted-foreground">Slug:</span>
                  <code className="text-xs">/{editingPage?.slug}</code>
                  <span className="text-muted-foreground">Word Count:</span>
                  <span>{editContent.content.split(/\s+/).filter(Boolean).length}</span>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>{editingPage?.updated_at ? format(new Date(editingPage.updated_at), 'MMM d, yyyy HH:mm') : '-'}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-200">
                <p className="text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  Changes are saved directly to the database. Use version history to rollback if needed.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              ~{editContent.content.split(/\s+/).filter(Boolean).length} words
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingPage(null)}>
                Cancel
              </Button>
              <Button onClick={saveManualEdits}>
                <Save className="h-4 w-4 mr-2" />
                Save All Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
