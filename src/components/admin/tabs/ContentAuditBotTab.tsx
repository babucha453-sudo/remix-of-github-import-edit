import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Copy, 
  TrendingUp,
  RefreshCw,
  Eye,
  Zap,
  BarChart3,
  AlertOctagon,
  FileWarning,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { ACTIVE_STATES } from '@/lib/constants/activeStates';

interface AuditResult {
  id: string;
  slug: string;
  page_type: string;
  word_count: number;
  content_status: 'excellent' | 'good' | 'thin' | 'missing';
  duplication_score: number;
  similar_pages: { slug: string; similarity: number }[];
  quality_score: number;
  issues: string[];
  recommendations: string[];
  eeat_compliance: boolean;
  has_unique_content: boolean;
}

interface AuditSummary {
  total_audited: number;
  excellent_content: number;
  good_content: number;
  thin_content: number;
  missing_content: number;
  duplicate_issues: number;
  eeat_compliant: number;
  avg_quality_score: number;
  avg_word_count: number;
}

interface DuplicateGroup {
  page_type: string;
  primary_slug: string;
  duplicates: { slug: string; similarity: number }[];
}

const PAGE_TYPES = [
  { value: 'all', label: 'All Page Types' },
  { value: 'state', label: 'State Pages' },
  { value: 'city', label: 'City Pages' },
  { value: 'service', label: 'Service Pages' },
  { value: 'service_location', label: 'Service Location Pages' },
  { value: 'clinic', label: 'Clinic Pages' },
  { value: 'dentist', label: 'Dentist Pages' },
];

const statusColors = {
  excellent: 'bg-emerald-500',
  good: 'bg-green-500',
  thin: 'bg-amber-500',
  missing: 'bg-red-500',
};

const statusLabels = {
  excellent: 'Excellent (1500+ words)',
  good: 'Good (800+ words)',
  thin: 'Thin (< 800 words)',
  missing: 'Missing Content',
};

export default function ContentAuditBotTab() {
  const [pageType, setPageType] = useState('all');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedPage, setSelectedPage] = useState<AuditResult | null>(null);
  const [activeTab, setActiveTab] = useState('audit');

  // Run content audit
  const auditMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('content-audit-bot', {
        body: {
          action: 'run_audit',
          page_type: pageType,
          state_filter: stateFilter,
          limit: 1000,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Audit complete! Analyzed ${data.summary.total_audited} pages.`);
    },
    onError: (error) => {
      toast.error(`Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Get duplication report
  const duplicationQuery = useQuery({
    queryKey: ['content-duplication-report'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('content-audit-bot', {
        body: { action: 'get_duplication_report' },
      });
      if (error) throw error;
      return data as { 
        summary: { total_pages: number; duplicate_groups: number; total_duplicate_pages: number; by_type: Record<string, { total: number; with_duplicates: number }> };
        groups: DuplicateGroup[];
      };
    },
    enabled: activeTab === 'duplicates',
  });

  // Analyze single page
  const analyzePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const { data, error } = await supabase.functions.invoke('content-audit-bot', {
        body: { action: 'analyze_page', page_id: pageId },
      });
      if (error) throw error;
      return data;
    },
  });

  // Filter results
  const filteredResults = useMemo(() => {
    if (!auditMutation.data?.results) return [];
    let results = auditMutation.data.results as AuditResult[];
    
    if (statusFilter) {
      results = results.filter(r => r.content_status === statusFilter);
    }
    
    return results;
  }, [auditMutation.data?.results, statusFilter]);

  const summary = auditMutation.data?.summary as AuditSummary | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            Content Audit Bot
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered content analysis with duplication detection and E-E-A-T compliance checking
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Content Audit
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Duplication Report
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2" disabled={!selectedPage}>
            <Eye className="h-4 w-4" />
            Page Details
          </TabsTrigger>
        </TabsList>

        {/* Content Audit Tab */}
        <TabsContent value="audit" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Controls</CardTitle>
              <CardDescription>Configure filters and run the content audit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Page Type</label>
                  <Select value={pageType} onValueChange={setPageType}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Active States</SelectItem>
                      {ACTIVE_STATES.map(state => (
                        <SelectItem key={state.slug} value={state.slug}>
                          {state.name} ({state.abbr})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={() => auditMutation.mutate()}
                  disabled={auditMutation.isPending}
                  className="gap-2"
                >
                  {auditMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Auditing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Run Audit
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Dashboard */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.total_audited}</p>
                      <p className="text-xs text-muted-foreground">Pages Audited</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.excellent_content + summary.good_content}</p>
                      <p className="text-xs text-muted-foreground">Good+ Content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <FileWarning className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.thin_content}</p>
                      <p className="text-xs text-muted-foreground">Thin Content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <XCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.missing_content}</p>
                      <p className="text-xs text-muted-foreground">Missing Content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Copy className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.duplicate_issues}</p>
                      <p className="text-xs text-muted-foreground">Duplicates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quality Metrics */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Average Quality Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Progress value={summary.avg_quality_score} className="flex-1" />
                    <span className="text-lg font-bold">{summary.avg_quality_score}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Content Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {['excellent', 'good', 'thin', 'missing'].map(status => {
                      const count = summary[`${status}_content` as keyof AuditSummary] as number;
                      const pct = summary.total_audited > 0 
                        ? Math.round((count / summary.total_audited) * 100) 
                        : 0;
                      return (
                        <div 
                          key={status}
                          className={`h-8 ${statusColors[status as keyof typeof statusColors]} rounded`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                          title={`${status}: ${count} (${pct}%)`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Excellent: {summary.excellent_content}</span>
                    <span>Good: {summary.good_content}</span>
                    <span>Thin: {summary.thin_content}</span>
                    <span>Missing: {summary.missing_content}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Results Filter */}
          {auditMutation.data?.results && (
            <div className="flex gap-2">
              <Button
                variant={statusFilter === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('')}
              >
                All ({auditMutation.data.results.length})
              </Button>
              {['missing', 'thin', 'good', 'excellent'].map(status => {
                const count = (auditMutation.data.results as AuditResult[]).filter(
                  r => r.content_status === status
                ).length;
                return (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                  </Button>
                );
              })}
            </div>
          )}

          {/* Results Table */}
          {filteredResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Audit Results</CardTitle>
                <CardDescription>
                  Showing {filteredResults.length} pages sorted by priority
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left p-2">Page</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-center p-2">Words</th>
                        <th className="text-center p-2">Status</th>
                        <th className="text-center p-2">Quality</th>
                        <th className="text-center p-2">Duplicates</th>
                        <th className="text-center p-2">E-E-A-T</th>
                        <th className="text-center p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((result) => (
                        <tr key={result.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              /{result.slug}
                            </code>
                          </td>
                          <td className="p-2">
                            <Badge variant="outline">{result.page_type}</Badge>
                          </td>
                          <td className="p-2 text-center font-mono">
                            {result.word_count}
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={statusColors[result.content_status]}>
                              {result.content_status}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <span className={
                              result.quality_score >= 70 ? 'text-green-500' :
                              result.quality_score >= 40 ? 'text-amber-500' : 'text-red-500'
                            }>
                              {result.quality_score}%
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {result.duplication_score > 0.7 ? (
                              <Badge variant="destructive">
                                {Math.round(result.duplication_score * 100)}%
                              </Badge>
                            ) : result.duplication_score > 0.5 ? (
                              <Badge variant="secondary">
                                {Math.round(result.duplication_score * 100)}%
                              </Badge>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {result.eeat_compliance ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <AlertOctagon className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPage(result);
                                setActiveTab('details');
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Duplication Report Tab */}
        <TabsContent value="duplicates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Copy className="h-5 w-5" />
                    Duplication Analysis
                  </CardTitle>
                  <CardDescription>
                    Identifies pages with &gt;70% content similarity
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicationQuery.refetch()}
                  disabled={duplicationQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${duplicationQuery.isFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {duplicationQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : duplicationQuery.data ? (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-3xl font-bold">{duplicationQuery.data.summary.total_pages}</p>
                        <p className="text-sm text-muted-foreground">Total Pages</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-3xl font-bold text-amber-500">
                          {duplicationQuery.data.summary.duplicate_groups}
                        </p>
                        <p className="text-sm text-muted-foreground">Duplicate Groups</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-3xl font-bold text-red-500">
                          {duplicationQuery.data.summary.total_duplicate_pages}
                        </p>
                        <p className="text-sm text-muted-foreground">Affected Pages</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Duplicate Groups */}
                  {duplicationQuery.data.groups.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {duplicationQuery.data.groups.map((group, idx) => (
                          <Card key={idx} className="border-amber-500/30">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <Badge variant="outline" className="mb-2">{group.page_type}</Badge>
                                  <p className="font-medium">/{group.primary_slug}</p>
                                </div>
                                <Badge variant="destructive">
                                  {group.duplicates.length} duplicates
                                </Badge>
                              </div>
                              <div className="mt-3 space-y-1">
                                {group.duplicates.map((dup, dupIdx) => (
                                  <div key={dupIdx} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                                    <code className="text-xs">/{dup.slug}</code>
                                    <Badge variant="secondary">
                                      {Math.round(dup.similarity * 100)}% similar
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p className="text-lg font-medium">No Duplicate Content Found</p>
                      <p className="text-sm">All pages have unique content above the 70% threshold.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Page Details Tab */}
        <TabsContent value="details" className="space-y-6">
          {selectedPage && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Page Analysis</CardTitle>
                    <code className="text-sm text-muted-foreground">/{selectedPage.slug}</code>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      analyzePageMutation.mutate(selectedPage.id);
                    }}
                    disabled={analyzePageMutation.isPending}
                  >
                    {analyzePageMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Deep AI Analysis
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{selectedPage.word_count}</p>
                    <p className="text-xs text-muted-foreground">Words</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Badge className={statusColors[selectedPage.content_status]}>
                      {selectedPage.content_status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Status</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{selectedPage.quality_score}%</p>
                    <p className="text-xs text-muted-foreground">Quality Score</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${
                      selectedPage.duplication_score > 0.7 ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {Math.round(selectedPage.duplication_score * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Duplication</p>
                  </div>
                </div>

                {/* Issues */}
                {selectedPage.issues.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Issues Found ({selectedPage.issues.length})
                    </h4>
                    <ul className="space-y-1">
                      {selectedPage.issues.map((issue, idx) => (
                        <li key={idx} className="text-sm bg-red-500/10 text-red-700 dark:text-red-400 px-3 py-2 rounded">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {selectedPage.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Recommendations
                    </h4>
                    <ul className="space-y-1">
                      {selectedPage.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm bg-primary/10 text-primary-foreground dark:text-primary px-3 py-2 rounded">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Similar Pages */}
                {selectedPage.similar_pages.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Copy className="h-4 w-4 text-purple-500" />
                      Similar Pages
                    </h4>
                    <div className="space-y-1">
                      {selectedPage.similar_pages.map((page, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-muted px-3 py-2 rounded">
                          <code>/{page.slug}</code>
                          <Badge variant={page.similarity > 0.8 ? 'destructive' : 'secondary'}>
                            {Math.round(page.similarity * 100)}% similar
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* E-E-A-T Status */}
                <div className="flex items-center gap-4 p-4 rounded-lg border">
                  {selectedPage.eeat_compliance ? (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="font-medium text-green-600">E-E-A-T Compliant</p>
                        <p className="text-sm text-muted-foreground">
                          This page meets Google's Experience, Expertise, Authoritativeness, and Trustworthiness guidelines.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertOctagon className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="font-medium text-red-600">E-E-A-T Issues Detected</p>
                        <p className="text-sm text-muted-foreground">
                          This page needs improvement to meet Google's content quality standards.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
