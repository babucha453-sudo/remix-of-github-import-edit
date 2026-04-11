'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ACTIVE_STATE_SLUGS } from '@/lib/constants/activeStates';
import {
  FileEdit, Sparkles, CheckCircle, Clock, Play, Search, Filter, Globe,
  RefreshCw, X, Eye, BarChart3, Loader2, Building2, MapPin, Stethoscope,
  Layers, AlertCircle, CheckSquare, Square, ListFilter, Wand2, Zap,
  FileText, History, RotateCcw, Save, Plus, Trash2, Edit, EyeOff,
  HelpCircle, FileQuestion, AlertTriangle, TrendingUp, Copy, Settings,
  ChevronDown, ChevronRight, Bug, Shield, Target, Lightbulb, Download,
  Upload, Check, Ban, ArrowRight, Database, Bot, Timer, Calendar,
  Bell, Flag, Link2, ExternalLink, Image as ImageIcon, Tags, Users,
  BookOpen, Rss, Send, Pause, PlayCircle, Trash, FileWarning
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const THIN_CONTENT_THRESHOLD = 800;
const NO_CONTENT_THRESHOLD = 400;

interface SeoPage {
  id: string;
  slug: string;
  page_type: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  page_intro: string | null;
  content: string | null;
  h2_sections: any | null;
  faqs: any | null;
  word_count: number | null;
  seo_score: number | null;
  is_thin_content: boolean | null;
  is_duplicate: boolean | null;
  is_optimized: boolean | null;
  needs_optimization: boolean | null;
  last_audited_at: string | null;
  optimized_at: string | null;
  updated_at: string;
}

interface AuditIssue {
  type: 'meta_title' | 'meta_description' | 'h1' | 'content' | 'faq' | 'structure' | 'duplicate';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  recommendation: string;
}

interface AuditResult {
  page: SeoPage;
  issues: AuditIssue[];
  overallScore: number;
  wordCount: number;
  isThinContent: boolean;
}

interface GenerationJob {
  id: string;
  status: 'running' | 'completed' | 'stopped' | 'error';
  total: number;
  processed: number;
  success: number;
  errors: number;
  currentPage?: string;
  startedAt: Date;
}

type ContentType = 'all' | 'state' | 'city' | 'treatment' | 'service_location' | 'city_treatment';
type AuditIssueType = 'meta_title' | 'meta_description' | 'h1' | 'content' | 'faq' | 'structure' | 'duplicate';
type SeverityType = 'critical' | 'warning' | 'info';

const PAGE_TYPE_LABELS: Record<string, string> = {
  state: 'State Pages',
  city: 'City Pages',
  treatment: 'Service Pages',
  service: 'Service Pages',
  service_location: 'Service + Location',
  city_treatment: 'City + Treatment',
  clinic: 'Clinic Pages',
  all: 'All Pages'
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  meta_title: 'Meta Title Issues',
  meta_description: 'Meta Description Issues',
  h1: 'H1 Heading Issues',
  content: 'Content Quality Issues',
  faq: 'FAQ Issues',
  structure: 'Structure Issues',
  duplicate: 'Duplicate Content'
};

export default function ContentHubTab() {
  const queryClient = useQueryClient();
  const [activeMainTab, setActiveMainTab] = useState('generate');
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Generation Settings
  const [generationConfig, setGenerationConfig] = useState({
    minWordCount: 1000,
    maxWordCount: 2000,
    generateIntro: true,
    generateSections: true,
    generateFAQs: true,
    generateInternalLinks: true,
    rewriteExisting: false,
    contentType: 'all' as ContentType,
    stateFilter: '',
    statusFilter: 'all' as 'all' | 'thin' | 'low' | 'none' | 'needs_work'
  });
  
  // Audit Settings
  const [auditConfig, setAuditConfig] = useState({
    thinContentThreshold: THIN_CONTENT_THRESHOLD,
    checkDuplicates: true,
    checkEeat: true,
    checkStructure: true,
    contentType: 'all' as ContentType,
    stateFilter: ''
  });
  
  // Fix Settings
  const [fixConfig, setFixConfig] = useState({
    fixMetaTitle: true,
    fixMetaDescription: true,
    fixH1: true,
    fixContent: false,
    fixFAQs: true,
    fixStructure: false,
    minWordCount: 1000
  });
  
  // Modal states
  const [previewPage, setPreviewPage] = useState<SeoPage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationJob | null>(null);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [fixQueue, setFixQueue] = useState<AuditResult[]>([]);
  
  // Fetch pages
  const { data: pages, isLoading: pagesLoading, refetch: refetchPages } = useQuery({
    queryKey: ['seo-pages-hub', generationConfig.contentType, generationConfig.stateFilter],
    queryFn: async () => {
      let query = supabase.from('seo_pages').select('*');
      
      if (generationConfig.contentType !== 'all') {
        query = query.eq('page_type', generationConfig.contentType);
      }
      
      if (generationConfig.stateFilter) {
        query = query.like('slug', `${generationConfig.stateFilter}%`);
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data as SeoPage[];
    }
  });
  
  // Fetch active states for filter
  const { data: states } = useQuery({
    queryKey: ['active-states'],
    queryFn: async () => {
      const { data, error } = await supabase.from('states').select('slug, name').order('name');
      if (error) throw error;
      return data;
    }
  });
  
  // Fetch treatments for filter
  const { data: treatments } = useQuery({
    queryKey: ['treatments-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('treatments').select('slug, name').order('name');
      if (error) throw error;
      return data;
    }
  });
  
  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(pages?.map(p => p.id) || []));
    }
    setSelectAll(!selectAll);
  }, [selectAll, pages]);
  
  const handleSelectPage = useCallback((pageId: string) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageId)) {
      newSelected.delete(pageId);
    } else {
      newSelected.add(pageId);
    }
    setSelectedPages(newSelected);
  }, [selectedPages]);
  
  // Content Generation
  const generateContentMutation = useMutation({
    mutationFn: async (pageIds: string[]) => {
      const results = [];
      for (const pageId of pageIds) {
        try {
          const page = pages?.find(p => p.id === pageId);
          if (!page) continue;
          
          const { data, error } = await supabase.functions.invoke('content-generation-studio', {
            body: {
              action: 'generate_content',
              page_id: pageId,
              config: {
                word_count: Math.floor((generationConfig.minWordCount + generationConfig.maxWordCount) / 2),
                generate_intro: generationConfig.generateIntro,
                generate_sections: generationConfig.generateSections,
                generate_faq: generationConfig.generateFAQs,
                generate_internal_links: generationConfig.generateInternalLinks,
                rewrite_entire: generationConfig.rewriteExisting
              }
            }
          });
          
          if (error) throw error;
          results.push({ pageId, success: true, data });
        } catch (e: any) {
          results.push({ pageId, success: false, error: e.message });
        }
      }
      return results;
    },
    onSuccess: () => {
      toast.success('Content generation completed');
      refetchPages();
      setSelectedPages(new Set());
    },
    onError: (error) => {
      toast.error(`Content generation failed: ${error.message}`);
    }
  });
  
  // FAQ Generation
  const generateFAQsMutation = useMutation({
    mutationFn: async (pageIds: string[]) => {
      const results = [];
      for (const pageId of pageIds) {
        try {
          const { data, error } = await supabase.functions.invoke('faq-generation-studio', {
            body: {
              action: 'generate_faqs',
              page_id: pageId,
              config: {
                num_faqs: 8,
                regenerate: false
              }
            }
          });
          
          if (error) throw error;
          results.push({ pageId, success: true, data });
        } catch (e: any) {
          results.push({ pageId, success: false, error: e.message });
        }
      }
      return results;
    },
    onSuccess: () => {
      toast.success('FAQ generation completed');
      refetchPages();
    },
    onError: (error) => {
      toast.error(`FAQ generation failed: ${error.message}`);
    }
  });
  
  // Meta Optimization
  const optimizeMetaMutation = useMutation({
    mutationFn: async (pageIds: string[]) => {
      const results = [];
      for (const pageId of pageIds) {
        try {
          const page = pages?.find(p => p.id === pageId);
          if (!page) continue;
          
          const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
            body: {
              action: 'optimize_page',
              page_id: pageId,
              issue_type: page.needs_optimization ? 'meta_title' : undefined
            }
          });
          
          if (error) throw error;
          results.push({ pageId, success: true, data });
        } catch (e: any) {
          results.push({ pageId, success: false, error: e.message });
        }
      }
      return results;
    },
    onSuccess: () => {
      toast.success('Meta optimization completed');
      refetchPages();
    },
    onError: (error) => {
      toast.error(`Meta optimization failed: ${error.message}`);
    }
  });
  
  // Run Content Audit
  const runAudit = useCallback(async () => {
    setIsAuditing(true);
    setAuditResults([]);
    
    const results: AuditResult[] = [];
    
    try {
      const pagesToAudit = pages || [];
      
      for (const page of pagesToAudit) {
        const issues: AuditIssue[] = [];
        let overallScore = 100;
        const wordCount = page.word_count || 0;
        const isThinContent = wordCount < auditConfig.thinContentThreshold;
        
        // Check meta title
        if (!page.meta_title || page.meta_title.length < 30) {
          issues.push({
            type: 'meta_title',
            severity: 'critical',
            message: 'Meta title is missing or too short',
            recommendation: 'Create a compelling meta title between 40-60 characters'
          });
          overallScore -= 15;
        } else if (page.meta_title.length > 60) {
          issues.push({
            type: 'meta_title',
            severity: 'warning',
            message: 'Meta title exceeds 60 characters',
            recommendation: 'Shorten meta title to under 60 characters'
          });
          overallScore -= 5;
        }
        
        // Check meta description
        if (!page.meta_description || page.meta_description.length < 70) {
          issues.push({
            type: 'meta_description',
            severity: 'critical',
            message: 'Meta description is missing or too short',
            recommendation: 'Write a compelling meta description between 120-155 characters'
          });
          overallScore -= 15;
        } else if (page.meta_description.length > 155) {
          issues.push({
            type: 'meta_description',
            severity: 'warning',
            message: 'Meta description exceeds 155 characters',
            recommendation: 'Shorten meta description to under 155 characters'
          });
          overallScore -= 5;
        }
        
        // Check H1
        if (!page.h1) {
          issues.push({
            type: 'h1',
            severity: 'critical',
            message: 'H1 heading is missing',
            recommendation: 'Add a descriptive H1 that includes your primary keyword'
          });
          overallScore -= 10;
        }
        
        // Check content
        if (isThinContent) {
          issues.push({
            type: 'content',
            severity: 'critical',
            message: `Content is thin (${wordCount} words, threshold: ${auditConfig.thinContentThreshold})`,
            recommendation: `Expand content to at least ${auditConfig.thinContentThreshold} words for better SEO`
          });
          overallScore -= 30;
        } else if (wordCount < 1500) {
          issues.push({
            type: 'content',
            severity: 'warning',
            message: `Content could be longer (${wordCount} words)`,
            recommendation: 'Consider expanding to 1500+ words for comprehensive coverage'
          });
          overallScore -= 10;
        }
        
        // Check FAQs
        if (!page.faqs || page.faqs.length === 0) {
          issues.push({
            type: 'faq',
            severity: 'warning',
            message: 'No FAQs found on page',
            recommendation: 'Add 5-8 FAQs to improve E-E-A-T signals and featured snippet chances'
          });
          overallScore -= 10;
        } else if (page.faqs.length < 5) {
          issues.push({
            type: 'faq',
            severity: 'info',
            message: `Only ${page.faqs.length} FAQs found`,
            recommendation: 'Consider adding more FAQs (5-8 recommended)'
          });
          overallScore -= 5;
        }
        
        // Check structure
        if (!page.h2_sections || page.h2_sections.length < 3) {
          issues.push({
            type: 'structure',
            severity: 'warning',
            message: 'Limited H2 section structure',
            recommendation: 'Add more H2 sections to improve content organization'
          });
          overallScore -= 10;
        }
        
        // Check duplicate
        if (page.is_duplicate) {
          issues.push({
            type: 'duplicate',
            severity: 'critical',
            message: 'Content flagged as duplicate',
            recommendation: 'Rewrite content to make it unique and different from similar pages'
          });
          overallScore -= 25;
        }
        
        results.push({
          page,
          issues,
          overallScore: Math.max(0, overallScore),
          wordCount,
          isThinContent
        });
      }
      
      setAuditResults(results);
      
      // Auto-populate fix queue with pages having critical issues
      const pagesToFix = results.filter(r => 
        r.issues.some(i => i.severity === 'critical') && r.overallScore < 60
      );
      setFixQueue(pagesToFix);
      
      toast.success(`Audit complete: ${results.length} pages analyzed`);
    } catch (error: any) {
      toast.error(`Audit failed: ${error.message}`);
    } finally {
      setIsAuditing(false);
    }
  }, [pages, auditConfig.thinContentThreshold]);
  
  // Apply Fixes
  const applyFixes = useCallback(async (pageIds: string[]) => {
    setIsFixing(true);
    
    try {
      for (const pageId of pageIds) {
        const result = auditResults.find(r => r.page.id === pageId);
        if (!result) continue;
        
        const criticalIssues = result.issues.filter(i => i.severity === 'critical');
        
        for (const issue of criticalIssues) {
          switch (issue.type) {
            case 'meta_title':
            case 'meta_description':
            case 'h1':
              await optimizeMetaMutation.mutateAsync([pageId]);
              break;
            case 'content':
              await generateContentMutation.mutateAsync([pageId]);
              break;
            case 'faq':
              await generateFAQsMutation.mutateAsync([pageId]);
              break;
          }
        }
      }
      
      toast.success('Fixes applied successfully');
      refetchPages();
    } catch (error: any) {
      toast.error(`Failed to apply fixes: ${error.message}`);
    } finally {
      setIsFixing(false);
    }
  }, [auditResults, optimizeMetaMutation, generateContentMutation, generateFAQsMutation, refetchPages]);
  
  // Stats calculation
  const stats = useMemo(() => {
    if (!pages) return { total: 0, thinContent: 0, optimized: 0, needsWork: 0, avgWords: 0 };
    
    const thinContent = pages.filter(p => (p.word_count || 0) < THIN_CONTENT_THRESHOLD).length;
    const optimized = pages.filter(p => p.is_optimized).length;
    const needsWork = pages.filter(p => p.needs_optimization || p.is_duplicate || thinContent > 0).length;
    const totalWords = pages.reduce((sum, p) => sum + (p.word_count || 0), 0);
    
    return {
      total: pages.length,
      thinContent,
      optimized,
      needsWork,
      avgWords: pages.length > 0 ? Math.round(totalWords / pages.length) : 0
    };
  }, [pages]);
  
  // Filter pages based on selection
  const filteredPages = useMemo(() => {
    if (!pages) return [];
    
    return pages.filter(page => {
      if (generationConfig.contentType !== 'all' && page.page_type !== generationConfig.contentType) {
        return false;
      }
      if (generationConfig.stateFilter && !page.slug.startsWith(generationConfig.stateFilter)) {
        return false;
      }
      
      const wordCount = page.word_count || 0;
      
      if (generationConfig.statusFilter === 'thin') {
        return wordCount < THIN_CONTENT_THRESHOLD && wordCount >= NO_CONTENT_THRESHOLD;
      }
      if (generationConfig.statusFilter === 'low') {
        return wordCount < NO_CONTENT_THRESHOLD && wordCount > 0;
      }
      if (generationConfig.statusFilter === 'none') {
        return wordCount === 0;
      }
      if (generationConfig.statusFilter === 'needs_work') {
        return page.needs_optimization || page.is_duplicate || wordCount < THIN_CONTENT_THRESHOLD;
      }
      
      return true;
    });
  }, [pages, generationConfig.contentType, generationConfig.stateFilter, generationConfig.statusFilter]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Content Hub
          </h2>
          <p className="text-muted-foreground">
            Unified content generation, auditing, and optimization center
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchPages()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Pages</p>
          </CardContent>
        </Card>
        <Card className={stats.thinContent > 0 ? 'border-red-500' : ''}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{stats.thinContent}</div>
            <p className="text-xs text-muted-foreground">Thin Content ({`<${THIN_CONTENT_THRESHOLD}w`})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats.optimized}</div>
            <p className="text-xs text-muted-foreground">Optimized</p>
          </CardContent>
        </Card>
        <Card className={stats.needsWork > 0 ? 'border-amber-500' : ''}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{stats.needsWork}</div>
            <p className="text-xs text-muted-foreground">Needs Work</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avgWords}</div>
            <p className="text-xs text-muted-foreground">Avg Words</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate">Content Gen</TabsTrigger>
          <TabsTrigger value="audit">Content Audit</TabsTrigger>
          <TabsTrigger value="fix">Fix Issues</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        {/* Content Generation Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Generate Content
              </CardTitle>
              <CardDescription>
                Generate unique, SEO-optimized content for selected pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generation Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Content Type</Label>
                  <Select 
                    value={generationConfig.contentType} 
                    onValueChange={(v) => setGenerationConfig({...generationConfig, contentType: v as ContentType})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Page Types</SelectItem>
                      <SelectItem value="state">State Pages</SelectItem>
                      <SelectItem value="city">City Pages</SelectItem>
                      <SelectItem value="treatment">Service Pages</SelectItem>
                      <SelectItem value="service_location">Service + Location</SelectItem>
                      <SelectItem value="city_treatment">City + Treatment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>State Filter</Label>
                  <Select 
                    value={generationConfig.stateFilter} 
                    onValueChange={(v) => setGenerationConfig({...generationConfig, stateFilter: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All States</SelectItem>
                      {states?.map(s => (
                        <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Content Status Filter</Label>
                  <Select 
                    value={generationConfig.statusFilter} 
                    onValueChange={(v) => setGenerationConfig({...generationConfig, statusFilter: v as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Content</SelectItem>
                      <SelectItem value="thin">Thin Content ({`<${THIN_CONTENT_THRESHOLD}w`})</SelectItem>
                      <SelectItem value="low">Low Content ({`<${NO_CONTENT_THRESHOLD}w`})</SelectItem>
                      <SelectItem value="none">No Content (0w)</SelectItem>
                      <SelectItem value="needs_work">Needs Work</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Word Count Range */}
              <div className="space-y-2">
                <Label>Target Word Count: {generationConfig.minWordCount} - {generationConfig.maxWordCount} words</Label>
                <div className="flex gap-4">
                  <Slider 
                    value={[generationConfig.minWordCount]} 
                    onValueChange={([v]) => setGenerationConfig({...generationConfig, minWordCount: v})}
                    min={300} 
                    max={2000} 
                    step={100}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground w-20 text-center">to</span>
                  <Slider 
                    value={[generationConfig.maxWordCount]} 
                    onValueChange={([v]) => setGenerationConfig({...generationConfig, maxWordCount: v})}
                    min={500} 
                    max={5000} 
                    step={100}
                    className="flex-1"
                  />
                </div>
              </div>
              
              {/* Generation Options */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="gen-intro" 
                    checked={generationConfig.generateIntro}
                    onCheckedChange={(v) => setGenerationConfig({...generationConfig, generateIntro: !!v})}
                  />
                  <Label htmlFor="gen-intro">Generate Introduction</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="gen-sections" 
                    checked={generationConfig.generateSections}
                    onCheckedChange={(v) => setGenerationConfig({...generationConfig, generateSections: !!v})}
                  />
                  <Label htmlFor="gen-sections">Generate Sections</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="gen-faqs" 
                    checked={generationConfig.generateFAQs}
                    onCheckedChange={(v) => setGenerationConfig({...generationConfig, generateFAQs: !!v})}
                  />
                  <Label htmlFor="gen-faqs">Generate FAQs</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="gen-links" 
                    checked={generationConfig.generateInternalLinks}
                    onCheckedChange={(v) => setGenerationConfig({...generationConfig, generateInternalLinks: !!v})}
                  />
                  <Label htmlFor="gen-links">Internal Links</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="gen-rewrite" 
                    checked={generationConfig.rewriteExisting}
                    onCheckedChange={(v) => setGenerationConfig({...generationConfig, rewriteExisting: !!v})}
                  />
                  <Label htmlFor="gen-rewrite">Rewrite Existing Content</Label>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => generateContentMutation.mutate(Array.from(selectedPages))}
                  disabled={selectedPages.size === 0 || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Content ({selectedPages.size})
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => generateFAQsMutation.mutate(Array.from(selectedPages))}
                  disabled={selectedPages.size === 0}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Generate FAQs
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => optimizeMetaMutation.mutate(Array.from(selectedPages))}
                  disabled={selectedPages.size === 0}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Optimize Meta
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Page Selection Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Pages ({selectedPages.size} selected)</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectAll ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                      </TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Words</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPages.map(page => (
                      <TableRow key={page.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedPages.has(page.id)}
                            onCheckedChange={() => handleSelectPage(page.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium truncate max-w-[200px]">{page.title || page.slug}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{page.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{PAGE_TYPE_LABELS[page.page_type] || page.page_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={page.word_count && page.word_count < THIN_CONTENT_THRESHOLD ? 'text-red-500' : ''}>
                            {page.word_count || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={page.seo_score && page.seo_score >= 70 ? 'default' : 'secondary'}>
                            {page.seo_score || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {page.is_thin_content && <Badge variant="destructive">Thin</Badge>}
                            {page.is_duplicate && <Badge variant="destructive">Duplicate</Badge>}
                            {page.needs_optimization && <Badge variant="warning">Needs Work</Badge>}
                            {page.is_optimized && <Badge variant="default">Optimized</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setPreviewPage(page)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Content Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Content Audit
              </CardTitle>
              <CardDescription>
                Analyze content quality using Google SEO guidelines (E-E-A-T, thin content, uniqueness)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audit Settings */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Content Type</Label>
                  <Select 
                    value={auditConfig.contentType} 
                    onValueChange={(v) => setAuditConfig({...auditConfig, contentType: v as ContentType})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="state">State</SelectItem>
                      <SelectItem value="city">City</SelectItem>
                      <SelectItem value="treatment">Service</SelectItem>
                      <SelectItem value="service_location">Service + Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Thin Content Threshold: {auditConfig.thinContentThreshold} words</Label>
                  <Slider 
                    value={[auditConfig.thinContentThreshold]} 
                    onValueChange={([v]) => setAuditConfig({...auditConfig, thinContentThreshold: v})}
                    min={300} 
                    max={1500} 
                    step={100}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <Label>Audit Options</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={auditConfig.checkDuplicates}
                        onCheckedChange={(v) => setAuditConfig({...auditConfig, checkDuplicates: !!v})}
                      />
                      <Label className="text-sm">Duplicates</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={auditConfig.checkEeat}
                        onCheckedChange={(v) => setAuditConfig({...auditConfig, checkEeat: !!v})}
                      />
                      <Label className="text-sm">E-E-A-T</Label>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={runAudit} 
                disabled={isAuditing || !pages?.length}
                className="w-full"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Auditing {pages?.length || 0} pages...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Run Full Audit
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          
          {/* Audit Results */}
          {auditResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Audit Results ({auditResults.length} pages)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {auditResults.map((result, idx) => (
                      <Accordion key={result.page.id} type="single" collapsible>
                        <AccordionItem value={result.page.id}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-4 w-full pr-4">
                              <span className={`w-3 h-3 rounded-full ${
                                result.overallScore >= 80 ? 'bg-green-500' :
                                result.overallScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`} />
                              <span className="flex-1 text-left truncate">{result.page.title || result.page.slug}</span>
                              <Badge>{result.overallScore}/100</Badge>
                              <Badge variant={result.isThinContent ? 'destructive' : 'secondary'}>
                                {result.wordCount} words
                              </Badge>
                              <Badge variant="outline">{result.issues.length} issues</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 pl-4">
                              {/* Issues List */}
                              {result.issues.map((issue, i) => (
                                <Alert key={i} variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertTitle className="flex items-center gap-2">
                                    {ISSUE_TYPE_LABELS[issue.type]}
                                    <Badge variant="outline" className="text-xs">{issue.severity}</Badge>
                                  </AlertTitle>
                                  <AlertDescription>
                                    <p>{issue.message}</p>
                                    <p className="text-xs mt-1 text-muted-foreground">
                                      <Lightbulb className="h-3 w-3 inline mr-1" />
                                      {issue.recommendation}
                                    </p>
                                  </AlertDescription>
                                </Alert>
                              ))}
                              
                              {/* Actions */}
                              <div className="flex gap-2 pt-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setFixQueue(prev => [...prev.filter(r => r.page.id !== result.page.id), result]);
                                    setActiveMainTab('fix');
                                  }}
                                >
                                  <Flag className="h-4 w-4 mr-2" />
                                  Add to Fix Queue
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setPreviewPage(result.page)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          
          {/* Issue Summary */}
          {auditResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Issue Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {(['meta_title', 'meta_description', 'content', 'faq'] as AuditIssueType[]).map(type => {
                    const count = auditResults.reduce((sum, r) => 
                      sum + r.issues.filter(i => i.type === type).length, 0
                    );
                    return (
                      <div key={type} className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">{ISSUE_TYPE_LABELS[type]}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Fix Issues Tab */}
        <TabsContent value="fix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Fix Content Issues
              </CardTitle>
              <CardDescription>
                Automatically fix identified issues using AI generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fix Configuration */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fix-meta" 
                    checked={fixConfig.fixMetaTitle}
                    onCheckedChange={(v) => setFixConfig({...fixConfig, fixMetaTitle: !!v})}
                  />
                  <Label htmlFor="fix-meta">Fix Meta Title/Description</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fix-h1" 
                    checked={fixConfig.fixH1}
                    onCheckedChange={(v) => setFixConfig({...fixConfig, fixH1: !!v})}
                  />
                  <Label htmlFor="fix-h1">Fix H1 Heading</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fix-content" 
                    checked={fixConfig.fixContent}
                    onCheckedChange={(v) => setFixConfig({...fixConfig, fixContent: !!v})}
                  />
                  <Label htmlFor="fix-content">Fix Thin Content</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fix-faq" 
                    checked={fixConfig.fixFAQs}
                    onCheckedChange={(v) => setFixConfig({...fixConfig, fixFAQs: !!v})}
                  />
                  <Label htmlFor="fix-faq">Add/Fix FAQs</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fix-structure" 
                    checked={fixConfig.fixStructure}
                    onCheckedChange={(v) => setFixConfig({...fixConfig, fixStructure: !!v})}
                  />
                  <Label htmlFor="fix-structure">Improve Structure</Label>
                </div>
                <div className="space-y-2">
                  <Label>Min Word Count After Fix</Label>
                  <Input 
                    type="number" 
                    value={fixConfig.minWordCount}
                    onChange={(e) => setFixConfig({...fixConfig, minWordCount: parseInt(e.target.value) || 800})}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => applyFixes(fixQueue.map(r => r.page.id))}
                  disabled={fixQueue.length === 0 || isFixing}
                >
                  {isFixing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Applying Fixes...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Apply Fixes ({fixQueue.length} pages)
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setFixQueue([])}>
                  Clear Queue
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Fix Queue */}
          {fixQueue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fix Queue ({fixQueue.length} pages)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fixQueue.map(result => (
                      <TableRow key={result.page.id}>
                        <TableCell>
                          <div className="font-medium">{result.page.title || result.page.slug}</div>
                          <div className="text-xs text-muted-foreground">{result.page.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={result.overallScore >= 60 ? 'default' : 'destructive'}>
                            {result.overallScore}/100
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {result.issues.slice(0, 3).map((issue, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {ISSUE_TYPE_LABELS[issue.type]}
                              </Badge>
                            ))}
                            {result.issues.length > 3 && (
                              <Badge variant="outline">+{result.issues.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFixQueue(prev => prev.filter(r => r.page.id !== result.page.id))}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          
          {fixQueue.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileWarning className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pages in fix queue</p>
                <p className="text-sm">Run an audit to identify issues, or add pages manually</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Generation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Min Word Count</Label>
                  <Input 
                    type="number" 
                    value={generationConfig.minWordCount}
                    onChange={(e) => setGenerationConfig({...generationConfig, minWordCount: parseInt(e.target.value) || 1000})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Max Word Count</Label>
                  <Input 
                    type="number" 
                    value={generationConfig.maxWordCount}
                    onChange={(e) => setGenerationConfig({...generationConfig, maxWordCount: parseInt(e.target.value) || 2000})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Thin Content Threshold</Label>
                <Input 
                  type="number" 
                  value={auditConfig.thinContentThreshold}
                  onChange={(e) => setAuditConfig({...auditConfig, thinContentThreshold: parseInt(e.target.value) || 800})}
                />
                <p className="text-xs text-muted-foreground">
                  Pages with word count below this threshold will be flagged as thin content
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Google SEO Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>E-E-A-T Guidelines</AlertTitle>
                  <AlertDescription>
                    All generated content follows Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) guidelines
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">Experience</h4>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>Real-world dental care insights</li>
                      <li>Patient-centric perspectives</li>
                      <li>Practical advice based on common scenarios</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Expertise</h4>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>Accurate dental terminology</li>
                      <li>Proper procedural explanations</li>
                      <li>Cost and insurance considerations</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Authoritativeness</h4>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>Clear source citations where applicable</li>
                      <li>Platform role clarity</li>
                      <li>No unfounded claims</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Trustworthiness</h4>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>No "best dentist" language</li>
                      <li>No guarantees or promises</li>
                      <li>Cautious, balanced claims</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Preview Modal */}
      <Dialog open={!!previewPage} onOpenChange={() => setPreviewPage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Page Preview</DialogTitle>
            <DialogDescription>
              {previewPage?.title || previewPage?.slug}
            </DialogDescription>
          </DialogHeader>
          {previewPage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Slug:</span> {previewPage.slug}
                </div>
                <div>
                  <span className="font-semibold">Type:</span> {previewPage.page_type}
                </div>
                <div>
                  <span className="font-semibold">Words:</span> {previewPage.word_count || 0}
                </div>
                <div>
                  <span className="font-semibold">Score:</span> {previewPage.seo_score || 'N/A'}
                </div>
              </div>
              
              {previewPage.meta_title && (
                <div>
                  <h4 className="font-semibold mb-1">Meta Title</h4>
                  <p className="text-sm bg-muted p-2 rounded">{previewPage.meta_title}</p>
                </div>
              )}
              
              {previewPage.meta_description && (
                <div>
                  <h4 className="font-semibold mb-1">Meta Description</h4>
                  <p className="text-sm bg-muted p-2 rounded">{previewPage.meta_description}</p>
                </div>
              )}
              
              {previewPage.h1 && (
                <div>
                  <h4 className="font-semibold mb-1">H1</h4>
                  <p className="text-sm bg-muted p-2 rounded">{previewPage.h1}</p>
                </div>
              )}
              
              {previewPage.content && (
                <div>
                  <h4 className="font-semibold mb-1">Content Preview</h4>
                  <ScrollArea className="h-[300px]">
                    <div className="text-sm bg-muted p-4 rounded whitespace-pre-wrap">
                      {previewPage.content.slice(0, 2000)}
                      {previewPage.content.length > 2000 && '...'}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {previewPage.faqs && previewPage.faqs.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1">FAQs ({previewPage.faqs.length})</h4>
                  <Accordion type="multiple">
                    {previewPage.faqs.slice(0, 5).map((faq: any, i: number) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger>{faq.question}</AccordionTrigger>
                        <AccordionContent>{faq.answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewPage(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
