import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Bot, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Play,
  Pause,
  RefreshCw,
  FileText,
  Globe,
  Link2,
  Target,
  Zap,
  Shield,
  TrendingUp,
  ChevronRight,
  ExternalLink,
  Filter,
  BookOpen,
  Loader2,
  MapPin,
  Building,
  FileSearch,
  Sparkles,
  Copy,
  Check,
  Activity,
  BarChart3,
  Settings,
  Clock,
  AlertCircle,
  ArrowRight,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const PAGE_TYPE_LABELS: Record<string, string> = {
  state: 'State Pages',
  city: 'City Pages',
  city_treatment: 'Service + Location',
  treatment: 'Service Pages',
  clinic: 'Clinic Profiles',
  blog: 'Blog Posts',
  static: 'Static Pages',
  dentist: 'Dentist Profiles'
};

const ISSUE_CATEGORIES = [
  { id: 'meta_title', label: 'Meta Title Issues', icon: FileText, severity: 'high', color: 'text-coral' },
  { id: 'meta_description', label: 'Meta Description Issues', icon: FileText, severity: 'high', color: 'text-gold' },
  { id: 'h1', label: 'H1 Heading Issues', icon: Target, severity: 'medium', color: 'text-primary' },
  { id: 'content', label: 'Thin Content', icon: BookOpen, severity: 'critical', color: 'text-destructive' },
  { id: 'duplicate', label: 'Duplicate Content', icon: Copy, severity: 'critical', color: 'text-coral' },
];

interface AuditStats {
  total_pages: number;
  by_type: Record<string, number>;
  issues: {
    no_meta_title: number;
    meta_title_too_long: number;
    meta_title_too_short: number;
    no_meta_description: number;
    meta_desc_too_long: number;
    meta_desc_too_short: number;
    no_h1: number;
    h1_too_long: number;
    no_content: number;
    thin_content: number;
    duplicate_content: number;
  };
  avg_seo_score: number;
  needs_optimization: number;
  optimized: number;
}

interface PageIssue {
  id: string;
  slug: string;
  page_type: string;
  current_title: string | null;
  current_description: string | null;
  current_h1: string | null;
  word_count: number | null;
  seo_score: number;
  issues: {
    category: string;
    severity: string;
    issue: string;
    current_value?: string;
    recommendation: string;
    google_policy: string;
  }[];
  passed_checks: string[];
}

interface GooglePolicy {
  lastUpdated: string;
  coreUpdates: string[];
  contentGuidelines: {
    helpful_content: string[];
    eeat: string[];
    onPage: {
      meta_title: { maxLength: number; minLength: number; rules: string[] };
      meta_description: { maxLength: number; minLength: number; rules: string[] };
      h1: { rules: string[] };
      headingStructure: { rules: string[] };
      content: { minWords: number; idealWords: number; rules: string[] };
    };
    technical: { rules: string[] };
  };
}

export default function SeoCommandCenterTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPageTypes, setSelectedPageTypes] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [auditProgress, setAuditProgress] = useState(0);
  const [isAuditing, setIsAuditing] = useState(false);

  // Fetch active states and cities for filtering
  const { data: filterOptions } = useQuery({
    queryKey: ['seo-command-filter-options'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: { action: 'get_filter_options' },
      });
      if (error) throw error;
      return {
        states: data.states as { slug: string; name: string; abbreviation: string }[],
        cities: data.cities as { slug: string; name: string; state_abbr: string }[],
      };
    },
  });

  // Fetch Google SEO Policies
  const { data: policies, refetch: refetchPolicies } = useQuery({
    queryKey: ['google-seo-policies'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: { action: 'get_policies' },
      });
      if (error) throw error;
      return data.policies as GooglePolicy;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch SEO Stats - NO LIMIT
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['seo-command-stats', selectedPageTypes, stateFilter, cityFilter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: { 
          action: 'get_stats', 
          page_types: selectedPageTypes.length > 0 ? selectedPageTypes : undefined,
          state_filter: stateFilter || undefined,
          city_filter: cityFilter || undefined,
        },
      });
      if (error) throw error;
      return {
        stats: data.stats as AuditStats,
        pageTypes: data.page_types as string[],
        latestAudit: data.latest_audit,
      };
    },
  });

  // Fetch Issues for selected category - NO LIMIT
  const { data: issuesData, isLoading: issuesLoading, refetch: refetchIssues } = useQuery({
    queryKey: ['seo-command-issues', selectedCategory, selectedPageTypes, stateFilter, cityFilter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: {
          action: 'get_issues',
          category: selectedCategory,
          page_type: selectedPageTypes[0],
          state_filter: stateFilter || undefined,
          city_filter: cityFilter || undefined,
          limit: 50000, // Remove practical limit
          offset: 0,
        },
      });
      if (error) throw error;
      return {
        issues: data.issues as PageIssue[],
        totalCount: data.total_count as number,
        googlePolicy: data.google_policy,
      };
    },
    enabled: !!selectedCategory,
  });

  // Run Full Audit - NO LIMIT
  const runFullAudit = useMutation({
    mutationFn: async () => {
      setIsAuditing(true);
      setAuditProgress(0);
      
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: {
          action: 'full_audit',
          page_types: selectedPageTypes.length > 0 ? selectedPageTypes : undefined,
          state_filter: stateFilter || undefined,
          city_filter: cityFilter || undefined,
          limit: 100000, // Unlimited
        },
      });
      
      if (error) throw error;
      setAuditProgress(100);
      return data;
    },
    onSuccess: (data) => {
      setIsAuditing(false);
      queryClient.invalidateQueries({ queryKey: ['seo-command-stats'] });
      queryClient.invalidateQueries({ queryKey: ['seo-command-issues'] });
      toast.success(`Audit complete! ${data.summary.pages_with_issues} pages need attention.`);
    },
    onError: (error) => {
      setIsAuditing(false);
      toast.error(`Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Fix Issues with AI
  const fixIssues = useMutation({
    mutationFn: async (options: {
      pageIds?: string[];
      issueCategory?: string;
      pageType?: string;
      customPrompt?: string;
      limit?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('seo-expert', {
        body: {
          action: 'fix_issues',
          page_ids: options.pageIds,
          issue_category: options.issueCategory,
          page_type: options.pageType,
          custom_prompt: options.customPrompt,
          limit: options.limit || 50,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seo-command-stats'] });
      queryClient.invalidateQueries({ queryKey: ['seo-command-issues'] });
      toast.success(`Fixed ${data.fixed_count} pages. ${data.failed_count} failed.`);
    },
    onError: (error) => {
      toast.error(`Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleFixSelected = async () => {
    if (selectedPages.length === 0) {
      toast.error('Please select pages to fix');
      return;
    }

    setIsFixing(true);
    setFixProgress(0);

    const batchSize = 10;
    const batches = Math.ceil(selectedPages.length / batchSize);
    let fixedTotal = 0;
    let failedTotal = 0;

    for (let i = 0; i < batches; i++) {
      const batch = selectedPages.slice(i * batchSize, (i + 1) * batchSize);
      
      try {
        const result = await fixIssues.mutateAsync({
          pageIds: batch,
          issueCategory: selectedCategory,
          customPrompt: customPrompt || undefined,
        });
        fixedTotal += result.fixed_count;
        failedTotal += result.failed_count;
      } catch (error) {
        console.error('Batch fix error:', error);
      }

      setFixProgress(((i + 1) / batches) * 100);
    }

    setIsFixing(false);
    setSelectedPages([]);
    refetchIssues();
    refetchStats();
  };

  const handleFixAll = async (category: string, limit: number = 100) => {
    setIsFixing(true);
    setFixProgress(0);

    try {
      await fixIssues.mutateAsync({
        issueCategory: category,
        pageType: selectedPageTypes[0],
        customPrompt: customPrompt || undefined,
        limit,
      });
      
      setFixProgress(100);
      refetchIssues();
      refetchStats();
    } catch (error) {
      console.error('Fix all error:', error);
    }

    setIsFixing(false);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-coral/20 text-coral border-coral/30">High</Badge>;
      case 'medium':
        return <Badge className="bg-gold/20 text-gold border-gold/30">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-teal/20 text-teal border-teal/30">{score}</Badge>;
    if (score >= 60) return <Badge className="bg-gold/20 text-gold border-gold/30">{score}</Badge>;
    return <Badge className="bg-coral/20 text-coral border-coral/30">{score}</Badge>;
  };

  const totalIssues = statsData?.stats ? (
    statsData.stats.issues.no_meta_title +
    statsData.stats.issues.no_meta_description +
    statsData.stats.issues.no_h1 +
    statsData.stats.issues.thin_content +
    statsData.stats.issues.duplicate_content
  ) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">SEO Command Center</h1>
            <p className="text-muted-foreground">
              Professional SEO auditing & optimization following Google's latest guidelines
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                Google Policies
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Google SEO Policies & Guidelines
                </DialogTitle>
              </DialogHeader>
              {policies && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm font-medium">Last Updated: {policies.lastUpdated}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All audits and fixes follow these Google-approved guidelines.
                    </p>
                  </div>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="updates">
                      <AccordionTrigger>Recent Core Updates</AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2">
                          {policies.coreUpdates.map((update, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                              {update}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="eeat">
                      <AccordionTrigger>E-E-A-T Guidelines</AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2">
                          {policies.contentGuidelines.eeat.map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 mt-0.5 text-teal shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="meta-title">
                      <AccordionTrigger>Meta Title Rules</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p className="text-sm">
                            <strong>Length:</strong> {policies.contentGuidelines.onPage.meta_title.minLength}-{policies.contentGuidelines.onPage.meta_title.maxLength} characters
                          </p>
                          <ul className="space-y-1">
                            {policies.contentGuidelines.onPage.meta_title.rules.map((rule, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <Check className="h-4 w-4 mt-0.5 text-teal shrink-0" />
                                {rule}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="meta-desc">
                      <AccordionTrigger>Meta Description Rules</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p className="text-sm">
                            <strong>Length:</strong> {policies.contentGuidelines.onPage.meta_description.minLength}-{policies.contentGuidelines.onPage.meta_description.maxLength} characters
                          </p>
                          <ul className="space-y-1">
                            {policies.contentGuidelines.onPage.meta_description.rules.map((rule, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <Check className="h-4 w-4 mt-0.5 text-teal shrink-0" />
                                {rule}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="content">
                      <AccordionTrigger>Content Guidelines</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p className="text-sm">
                            <strong>Minimum:</strong> {policies.contentGuidelines.onPage.content.minWords} words | <strong>Ideal:</strong> {policies.contentGuidelines.onPage.content.idealWords}+ words
                          </p>
                          <ul className="space-y-1">
                            {policies.contentGuidelines.onPage.content.rules.map((rule, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <Check className="h-4 w-4 mt-0.5 text-teal shrink-0" />
                                {rule}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="technical">
                      <AccordionTrigger>Technical SEO</AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-1">
                          {policies.contentGuidelines.technical.rules.map((rule, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <Check className="h-4 w-4 mt-0.5 text-teal shrink-0" />
                              {rule}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button 
            onClick={() => runFullAudit.mutate()} 
            disabled={runFullAudit.isPending || isAuditing}
            className="bg-gradient-to-r from-primary to-teal"
          >
            {runFullAudit.isPending || isAuditing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {runFullAudit.isPending || isAuditing ? 'Auditing All Pages...' : 'Run Full Audit'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Target Filters:</span>
            </div>
            
            <Select 
              value={selectedPageTypes[0] || 'all'} 
              onValueChange={(v) => setSelectedPageTypes(v === 'all' ? [] : [v])}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Page Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Page Types</SelectItem>
                {Object.entries(PAGE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stateFilter || 'all'} onValueChange={(v) => {
              setStateFilter(v === 'all' ? '' : v);
              setCityFilter(''); // Reset city when state changes
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Active States</SelectItem>
                {filterOptions?.states?.map(state => (
                  <SelectItem key={state.slug} value={state.slug}>
                    {state.name} ({state.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={cityFilter || 'all'} 
              onValueChange={(v) => setCityFilter(v === 'all' ? '' : v)}
              disabled={!stateFilter}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={stateFilter ? "Select City" : "Select State First"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities in State</SelectItem>
                {filterOptions?.cities
                  ?.filter(c => !stateFilter || c.state_abbr === filterOptions.states?.find(s => s.slug === stateFilter)?.abbreviation)
                  .slice(0, 200)
                  .map(city => (
                    <SelectItem key={city.slug} value={city.slug}>
                      {city.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => {
              setSelectedPageTypes([]);
              setStateFilter('');
              setCityFilter('');
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {statsData && (
        <div className="grid grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.total_pages.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Pages</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal/10 to-teal/5 border-teal/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.avg_seo_score || 0}</p>
                <p className="text-sm text-muted-foreground">Avg SEO Score</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-coral/10 to-coral/5 border-coral/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-coral/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-coral" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalIssues.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Issues</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gold/20 flex items-center justify-center">
                <FileText className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.issues.thin_content}</p>
                <p className="text-sm text-muted-foreground">Thin Content</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <Copy className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.issues.duplicate_content}</p>
                <p className="text-sm text-muted-foreground">Duplicates</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.optimized}</p>
                <p className="text-sm text-muted-foreground">Optimized</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Issue Overview
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Search className="h-4 w-4 mr-2" />
            Deep Audit
          </TabsTrigger>
          <TabsTrigger value="fix">
            <Zap className="h-4 w-4 mr-2" />
            Fix Issues
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            Health Check
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {statsData && (
            <>
              {/* Issue Breakdown by Category */}
              <Card>
                <CardHeader>
                  <CardTitle>Issues by Category</CardTitle>
                  <CardDescription>Click on any category to view and fix issues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {ISSUE_CATEGORIES.map(cat => {
                      let count = 0;
                      switch (cat.id) {
                        case 'meta_title':
                          count = statsData.stats.issues.no_meta_title + statsData.stats.issues.meta_title_too_long + statsData.stats.issues.meta_title_too_short;
                          break;
                        case 'meta_description':
                          count = statsData.stats.issues.no_meta_description + statsData.stats.issues.meta_desc_too_long + statsData.stats.issues.meta_desc_too_short;
                          break;
                        case 'h1':
                          count = statsData.stats.issues.no_h1 + statsData.stats.issues.h1_too_long;
                          break;
                        case 'content':
                          count = statsData.stats.issues.thin_content + statsData.stats.issues.no_content;
                          break;
                        case 'duplicate':
                          count = statsData.stats.issues.duplicate_content;
                          break;
                      }
                      
                      return (
                        <Card 
                          key={cat.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${selectedCategory === cat.id ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setActiveTab('fix');
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <cat.icon className={`h-5 w-5 ${cat.color}`} />
                              {getSeverityBadge(cat.severity)}
                            </div>
                            <p className="text-2xl font-bold">{count.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">{cat.label}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Page Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Pages by Type</CardTitle>
                  <CardDescription>Distribution of SEO pages across content types</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(statsData.stats.by_type || {}).map(([type, count]) => (
                      <div 
                        key={type}
                        className="p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedPageTypes([type]);
                          refetchStats();
                        }}
                      >
                        <p className="text-lg font-semibold">{(count as number).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{PAGE_TYPE_LABELS[type] || type}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Deep Audit Tab */}
        <TabsContent value="audit" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Deep SEO Audit
              </CardTitle>
              <CardDescription>
                Run a comprehensive audit of all pages following Google's E-E-A-T guidelines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAuditing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Auditing pages...</span>
                    <span className="text-sm text-muted-foreground">{auditProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={auditProgress} />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">What's Checked</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Meta titles (30-60 chars)</li>
                    <li>• Meta descriptions (70-155 chars)</li>
                    <li>• H1 headings (unique, descriptive)</li>
                    <li>• Content quality (300+ words)</li>
                    <li>• Duplicate detection</li>
                  </ul>
                </Card>

                <Card className="p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">Google Policies Applied</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• E-E-A-T compliance</li>
                    <li>• Helpful content guidelines</li>
                    <li>• Core Web Vitals signals</li>
                    <li>• Mobile-first indexing</li>
                    <li>• Schema markup checks</li>
                  </ul>
                </Card>

                <Card className="p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">Audit Scope</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Pages to audit: <strong className="text-foreground">{statsData?.stats.total_pages.toLocaleString() || 'All'}</strong></p>
                    <p>Filter: <strong className="text-foreground">{stateFilter || 'All States'}</strong></p>
                    <p>Type: <strong className="text-foreground">{selectedPageTypes[0] ? PAGE_TYPE_LABELS[selectedPageTypes[0]] : 'All Types'}</strong></p>
                  </div>
                </Card>
              </div>

              <Button 
                onClick={() => runFullAudit.mutate()} 
                disabled={runFullAudit.isPending || isAuditing}
                size="lg"
                className="w-full"
              >
                {runFullAudit.isPending || isAuditing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Auditing All Pages...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Full Audit (No Limit)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fix Issues Tab */}
        <TabsContent value="fix" className="mt-4 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {/* Issue Category Selector */}
            <Card className="col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Issue Category</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1 p-2">
                  {ISSUE_CATEGORIES.map(cat => (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      <cat.icon className="h-4 w-4 mr-2" />
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Issues Table */}
            <Card className="col-span-3">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">
                    {selectedCategory ? ISSUE_CATEGORIES.find(c => c.id === selectedCategory)?.label : 'Select a Category'}
                  </CardTitle>
                  <CardDescription>
                    {issuesData ? `${issuesData.totalCount.toLocaleString()} pages with issues` : 'Choose an issue category to view affected pages'}
                  </CardDescription>
                </div>
                {selectedCategory && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleFixSelected}
                      disabled={selectedPages.length === 0 || isFixing}
                    >
                      Fix Selected ({selectedPages.length})
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleFixAll(selectedCategory, 500)}
                      disabled={isFixing}
                    >
                      {isFixing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                      Fix All ({issuesData?.totalCount?.toLocaleString() || 0})
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isFixing && (
                  <div className="px-4 py-2 border-b">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Fixing issues...</span>
                      <span className="text-sm text-muted-foreground">{fixProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={fixProgress} />
                  </div>
                )}

                {/* Custom Instructions */}
                {selectedCategory && (
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <Label className="text-sm">Custom AI Instructions (Optional)</Label>
                    <Textarea
                      placeholder="Add specific instructions for how AI should fix these issues..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="mt-1 h-16"
                    />
                  </div>
                )}

                <ScrollArea className="h-[500px]">
                  {issuesLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !selectedCategory ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mb-2" />
                      <p>Select an issue category to view affected pages</p>
                    </div>
                  ) : issuesData?.issues?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mb-2 text-teal" />
                      <p>No issues found in this category!</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedPages.length === (issuesData?.issues?.length || 0) && (issuesData?.issues?.length || 0) > 0}
                              onCheckedChange={(checked) => {
                                setSelectedPages(checked ? (issuesData?.issues?.map(i => i.id) || []) : []);
                              }}
                            />
                          </TableHead>
                          <TableHead>Page</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Current Value</TableHead>
                          <TableHead>Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {issuesData?.issues?.map(issue => (
                          <TableRow key={issue.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPages.includes(issue.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedPages(checked 
                                    ? [...selectedPages, issue.id]
                                    : selectedPages.filter(id => id !== issue.id)
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm truncate max-w-xs">{issue.slug}</p>
                                {issue.word_count !== null && (
                                  <p className="text-xs text-muted-foreground">{issue.word_count} words</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{PAGE_TYPE_LABELS[issue.page_type] || issue.page_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm truncate max-w-xs text-muted-foreground">
                                {selectedCategory === 'meta_title' && (issue.current_title || 'Missing')}
                                {selectedCategory === 'meta_description' && (issue.current_description?.slice(0, 50) || 'Missing')}
                                {selectedCategory === 'h1' && (issue.current_h1 || 'Missing')}
                                {selectedCategory === 'content' && `${issue.word_count || 0} words`}
                                {selectedCategory === 'duplicate' && 'Duplicate detected'}
                              </p>
                            </TableCell>
                            <TableCell>
                              {getScoreBadge(issue.seo_score)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Health Check Tab */}
        <TabsContent value="health" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Bot View Health Check
              </CardTitle>
              <CardDescription>
                Test how search engine bots see your pages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  For detailed bot view testing, use the dedicated SEO Health Check tab.
                </p>
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open SEO Health Check
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Policy Reference */}
          {policies && (
            <Card>
              <CardHeader>
                <CardTitle>Current Google Policies</CardTitle>
                <CardDescription>Last updated: {policies.lastUpdated}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Meta Title Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      {policies.contentGuidelines.onPage.meta_title.minLength}-{policies.contentGuidelines.onPage.meta_title.maxLength} characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Meta Description Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      {policies.contentGuidelines.onPage.meta_description.minLength}-{policies.contentGuidelines.onPage.meta_description.maxLength} characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Minimum Content</h4>
                    <p className="text-sm text-muted-foreground">
                      {policies.contentGuidelines.onPage.content.minWords}+ words minimum, {policies.contentGuidelines.onPage.content.idealWords}+ ideal
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">E-E-A-T Focus</h4>
                    <p className="text-sm text-muted-foreground">
                      Experience, Expertise, Authoritativeness, Trustworthiness
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
