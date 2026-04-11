import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  useSeoExpertStats,
  useSeoExpertPolicies,
  useSeoExpertIssues,
  useSeoExpertFilterOptions,
  useRunSeoAudit,
  useFixSeoIssues,
  type PageIssue,
  type AuditSummary
} from '@/hooks/useSeoExpert';

const PAGE_TYPE_LABELS: Record<string, string> = {
  state: 'Location Pages (States)',
  city: 'Location Pages (Cities)',
  city_treatment: 'Service-Location Pages',
  treatment: 'Service Pages',
  clinic: 'Clinic Profiles',
  blog: 'Blog Posts',
  static: 'Static Pages',
  dentist: 'Dentist Profiles'
};

const ISSUE_CATEGORIES = [
  { id: 'meta_title', label: 'Meta Title Issues', icon: FileText, color: 'text-coral' },
  { id: 'meta_description', label: 'Meta Description Issues', icon: FileText, color: 'text-gold' },
  { id: 'h1', label: 'H1 Heading Issues', icon: Target, color: 'text-primary' },
  { id: 'content', label: 'Content Issues', icon: BookOpen, color: 'text-teal' },
  { id: 'duplicate', label: 'Duplicate Content', icon: Copy, color: 'text-coral' },
];

export default function SeoExpertTab() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPageTypes, setSelectedPageTypes] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [copiedPolicy, setCopiedPolicy] = useState<string | null>(null);

  // Fetch data
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useSeoExpertStats(selectedPageTypes.length > 0 ? selectedPageTypes : undefined);
  const { data: policies, isLoading: policiesLoading } = useSeoExpertPolicies();
  const { data: filterOptions } = useSeoExpertFilterOptions();
  const { data: issuesData, isLoading: issuesLoading, refetch: refetchIssues } = useSeoExpertIssues({
    category: selectedCategory,
    pageType: selectedPageTypes[0],
    stateFilter,
    cityFilter,
    limit: 100,
  });

  const runAudit = useRunSeoAudit();
  const fixIssues = useFixSeoIssues();

  const handleRunAudit = () => {
    runAudit.mutate({
      pageTypes: selectedPageTypes.length > 0 ? selectedPageTypes : undefined,
      stateFilter: stateFilter || undefined,
      cityFilter: cityFilter || undefined,
      limit: 5000,
    });
  };

  const handleFixSelected = async () => {
    if (selectedPages.length === 0) {
      toast.error('Please select pages to fix');
      return;
    }

    setIsFixing(true);
    setFixProgress(0);

    // Fix in batches of 10
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
        fixedTotal += result.fixedCount;
        failedTotal += result.failedCount;
      } catch (error) {
        console.error('Batch fix error:', error);
      }

      setFixProgress(((i + 1) / batches) * 100);
    }

    setIsFixing(false);
    setSelectedPages([]);
    refetchIssues();
    refetchStats();
    toast.success(`Fixed ${fixedTotal} pages. ${failedTotal} failed.`);
  };

  const handleFixAll = async (category: string, limit: number = 50) => {
    setIsFixing(true);
    setFixProgress(0);

    try {
      const result = await fixIssues.mutateAsync({
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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPolicy(id);
    setTimeout(() => setCopiedPolicy(null), 2000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-coral/20 text-coral">High</Badge>;
      case 'medium':
        return <Badge className="bg-gold/20 text-gold">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-teal/20 text-teal">{score}</Badge>;
    if (score >= 60) return <Badge className="bg-gold/20 text-gold">{score}</Badge>;
    return <Badge className="bg-coral/20 text-coral">{score}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">SEO Expert Bot</h1>
            <p className="text-muted-foreground">
              AI-powered SEO auditing & optimization following Google's latest guidelines
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
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
                      The SEO Expert Bot follows all these policies when auditing and fixing your pages.
                    </p>
                  </div>

                  <Accordion type="single" collapsible>
                    <AccordionItem value="updates">
                      <AccordionTrigger>Recent Core Updates</AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2">
                          {policies.coreUpdates.map((update, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
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
                              <CheckCircle className="h-4 w-4 mt-0.5 text-teal" />
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
                                <Check className="h-4 w-4 mt-0.5 text-teal" />
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
                                <Check className="h-4 w-4 mt-0.5 text-teal" />
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
                                <Check className="h-4 w-4 mt-0.5 text-teal" />
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
                              <Check className="h-4 w-4 mt-0.5 text-teal" />
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
            onClick={handleRunAudit} 
            disabled={runAudit.isPending}
          >
            {runAudit.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {runAudit.isPending ? 'Auditing...' : 'Run Full Audit'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
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
                {statsData?.pageTypes?.map(type => (
                  <SelectItem key={type} value={type}>
                    {PAGE_TYPE_LABELS[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stateFilter || 'all'} onValueChange={(v) => setStateFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {filterOptions?.states?.map(state => (
                  <SelectItem key={state.slug} value={state.slug}>
                    {state.name} ({state.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cityFilter || 'all'} onValueChange={(v) => setCityFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {filterOptions?.cities?.slice(0, 100).map(city => (
                  <SelectItem key={city.slug} value={city.slug}>
                    {city.name}, {city.state_abbr}
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

      {/* Stats Overview */}
      {statsData && (
        <div className="grid grid-cols-6 gap-4">
          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.total_pages.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Pages</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.avg_seo_score}</p>
                <p className="text-sm text-muted-foreground">Avg SEO Score</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-coral/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-coral" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.needs_optimization.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Need Fixes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {statsData.stats.issues.thin_content + statsData.stats.issues.no_content}
                </p>
                <p className="text-sm text-muted-foreground">Thin Content</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-coral/10 flex items-center justify-center">
                <Copy className="h-6 w-6 text-coral" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.issues.duplicate_content}</p>
                <p className="text-sm text-muted-foreground">Duplicates</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsData.stats.optimized.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Optimized</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 rounded-xl">
          <TabsTrigger value="dashboard" className="rounded-xl">
            <Target className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="issues" className="rounded-xl">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="fix" className="rounded-xl">
            <Sparkles className="h-4 w-4 mr-2" />
            Fix Issues
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-xl">
            <FileSearch className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-xl">
            <Link2 className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Issues by Category */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-coral" />
                  Issues by Category
                </CardTitle>
                <CardDescription>Click to view and fix issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ISSUE_CATEGORIES.map(cat => {
                  const count = cat.id === 'meta_title' 
                    ? (statsData?.stats.issues.no_meta_title || 0) + (statsData?.stats.issues.meta_title_too_long || 0) + (statsData?.stats.issues.meta_title_too_short || 0)
                    : cat.id === 'meta_description'
                    ? (statsData?.stats.issues.no_meta_description || 0) + (statsData?.stats.issues.meta_desc_too_long || 0) + (statsData?.stats.issues.meta_desc_too_short || 0)
                    : cat.id === 'h1'
                    ? (statsData?.stats.issues.no_h1 || 0) + (statsData?.stats.issues.h1_too_long || 0)
                    : cat.id === 'content'
                    ? (statsData?.stats.issues.no_content || 0) + (statsData?.stats.issues.thin_content || 0)
                    : statsData?.stats.issues.duplicate_content || 0;
                  
                  return (
                    <Button
                      key={cat.id}
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setActiveTab('issues');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <cat.icon className={`h-5 w-5 ${cat.color}`} />
                        <span>{cat.label}</span>
                      </div>
                      <Badge variant={count > 0 ? "destructive" : "secondary"}>
                        {count.toLocaleString()}
                      </Badge>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Pages by Type */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Pages by Type
                </CardTitle>
                <CardDescription>Distribution of indexed pages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statsData?.stats.by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {type === 'clinic' ? <Building className="h-4 w-4 text-muted-foreground" /> :
                         type === 'city' || type === 'state' ? <MapPin className="h-4 w-4 text-muted-foreground" /> :
                         <FileText className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm">{PAGE_TYPE_LABELS[type] || type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(count / (statsData?.stats.total_pages || 1)) * 100} 
                          className="w-24 h-2"
                        />
                        <span className="text-sm font-medium w-16 text-right">{count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Latest Audit */}
            {statsData?.latestAudit && (
              <Card className="card-modern col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSearch className="h-5 w-5 text-teal" />
                    Latest Audit Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold">{statsData.latestAudit.total_pages}</p>
                      <p className="text-sm text-muted-foreground">Pages Audited</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold">{statsData.latestAudit.processed_pages}</p>
                      <p className="text-sm text-muted-foreground">Processed</p>
                    </div>
                    <div className="p-4 rounded-xl bg-teal/10">
                      <p className="text-2xl font-bold text-teal">{statsData.latestAudit.fixed_pages}</p>
                      <p className="text-sm text-muted-foreground">Fixed</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-sm font-medium">
                        {statsData.latestAudit.completed_at 
                          ? format(new Date(statsData.latestAudit.completed_at), 'PPp')
                          : 'In Progress'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="mt-4">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedCategory ? ISSUE_CATEGORIES.find(c => c.id === selectedCategory)?.label : 'All Issues'}
                </CardTitle>
                <CardDescription>
                  {issuesData?.totalCount || 0} pages with issues
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Issue Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Issues</SelectItem>
                    {ISSUE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => refetchIssues()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {issuesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
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
                        <TableHead>Issues</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issuesData?.issues?.map((page) => (
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
                            <div className="max-w-xs">
                              <p className="font-mono text-sm truncate">{page.slug}</p>
                              {page.current_title && (
                                <p className="text-xs text-muted-foreground truncate">{page.current_title}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{PAGE_TYPE_LABELS[page.page_type] || page.page_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {page.issues.slice(0, 2).map((issue, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  {getSeverityBadge(issue.severity)}
                                  <span className="text-xs truncate max-w-32">{issue.issue}</span>
                                </div>
                              ))}
                              {page.issues.length > 2 && (
                                <span className="text-xs text-muted-foreground">+{page.issues.length - 2} more</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getScoreBadge(page.seo_score)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={page.slug} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!issuesData?.issues || issuesData.issues.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            {selectedCategory ? 'No issues found for this category' : 'Select an issue category to view'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fix Tab */}
        <TabsContent value="fix" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Fix Configuration */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Fix Configuration
                </CardTitle>
                <CardDescription>Configure how the AI should fix issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Issue Category</Label>
                  <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select issue type to fix" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Custom AI Instructions (Optional)</Label>
                  <Textarea
                    placeholder="Add specific instructions for the AI... e.g., 'Focus on local keywords for this city' or 'Include specific dental services mentioned'"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    The AI will follow Google SEO policies automatically. Add custom instructions for specific requirements.
                  </p>
                </div>

                {isFixing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Fixing progress...</span>
                      <span>{Math.round(fixProgress)}%</span>
                    </div>
                    <Progress value={fixProgress} />
                  </div>
                )}

                <div className="flex gap-2">
                  {selectedPages.length > 0 && (
                    <Button 
                      onClick={handleFixSelected}
                      disabled={isFixing || !selectedCategory}
                      className="flex-1"
                    >
                      {isFixing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Fix Selected ({selectedPages.length})
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => handleFixAll(selectedCategory, 50)}
                    disabled={isFixing || !selectedCategory}
                    className="flex-1"
                  >
                    {isFixing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Fix Next 50 Pages
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Google Policy Reference */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-teal" />
                  Google Policy Reference
                </CardTitle>
                <CardDescription>
                  The AI follows these policies when fixing issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCategory && policies?.contentGuidelines.onPage[selectedCategory as keyof typeof policies.contentGuidelines.onPage] && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <p className="font-medium text-sm">
                        {selectedCategory === 'meta_title' && `Length: 30-60 characters`}
                        {selectedCategory === 'meta_description' && `Length: 70-155 characters`}
                        {selectedCategory === 'h1' && `One H1 per page, 20-70 characters`}
                        {selectedCategory === 'content' && `Minimum: 300 words, Ideal: 800+ words`}
                      </p>
                    </div>
                    <ul className="space-y-2">
                      {(policies.contentGuidelines.onPage[selectedCategory as keyof typeof policies.contentGuidelines.onPage] as any)?.rules?.map((rule: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 mt-0.5 text-teal flex-shrink-0" />
                          <span className="text-muted-foreground">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!selectedCategory && (
                  <p className="text-muted-foreground text-sm">
                    Select an issue category to see relevant Google policies
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                Audit Reports
              </CardTitle>
              <CardDescription>
                Detailed breakdown of SEO health by page type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(statsData?.stats.by_type || {}).map(([type, count]) => (
                  <Card key={type} className="border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{PAGE_TYPE_LABELS[type] || type}</span>
                        <Badge variant="outline">{count} pages</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setSelectedPageTypes([type]);
                            setSelectedCategory('content');
                            setActiveTab('issues');
                          }}
                        >
                          View {type} Issues
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Google Search Console
                </CardTitle>
                <CardDescription>
                  Connect to fetch real search performance data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-gold/10 border border-gold/20">
                  <p className="text-sm font-medium text-gold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Coming Soon
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Google Search Console integration will allow the SEO Expert Bot to:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Fetch actual search queries and rankings</li>
                    <li>Identify pages losing traffic</li>
                    <li>Optimize based on real click-through rates</li>
                    <li>Detect indexing issues automatically</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label>Google Search Console API Key</Label>
                  <Input placeholder="Enter your GSC API key..." disabled />
                </div>
                <Button disabled className="w-full">
                  Connect Search Console
                </Button>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-teal" />
                  Google Analytics
                </CardTitle>
                <CardDescription>
                  Connect for traffic-based optimization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-gold/10 border border-gold/20">
                  <p className="text-sm font-medium text-gold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Coming Soon
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Google Analytics integration will enable:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Traffic-based page prioritization</li>
                    <li>Bounce rate optimization suggestions</li>
                    <li>Conversion tracking for SEO pages</li>
                    <li>User engagement analysis</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label>Google Analytics API Key</Label>
                  <Input placeholder="Enter your GA4 API key..." disabled />
                </div>
                <Button disabled className="w-full">
                  Connect Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
