import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, RefreshCw, FileText, CheckCircle, AlertCircle, Globe, Play, Square, Eye, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface ProgressInfo {
  page_type: string;
  current_offset: number;
  total_count: number;
  status: string;
  last_error: string | null;
}

interface StaticPageStats {
  cached: number;
  stale: number;
  totalPossible: number;
  breakdown: {
    states: number;
    cities: number;
    treatments: number;
    serviceLocations: number;
    clinics: number;
  };
  cachedByType?: {
    state: number;
    city: number;
    service: number;
    service_location: number;
    clinic: number;
  };
  progress?: ProgressInfo[];
}

interface CacheEntry {
  id: string;
  path: string;
  page_type: string;
  storage_path: string;
  generated_at: string;
  is_stale: boolean;
}

interface ProgressCardProps {
  title: string;
  generated: number;
  cached: number;
  total: number;
  isLoading: boolean;
  status?: string;
  onGenerate: () => void;
  onReset: () => void;
  isGenerating: boolean;
  isAutoRunning: boolean;
}

function ProgressCard({
  title,
  generated,
  cached,
  total,
  isLoading,
  status,
  onGenerate,
  onReset,
  isGenerating,
  isAutoRunning,
}: ProgressCardProps) {
  const percentage = total > 0 ? Math.round((generated / total) * 100) : 0;
  const isComplete = generated >= total && total > 0;
  const isRunning = status === "running";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          {title}
          <div className="flex items-center gap-1">
            {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
            {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{isLoading ? "..." : generated}</span>
          <span className="text-sm text-muted-foreground">/ {isLoading ? "..." : total}</span>
        </div>
        <Progress value={percentage} className="h-2" />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {percentage}% • {Math.max(0, total - generated)} left
          </p>
          <p className="text-[11px] text-muted-foreground">Cached: {isLoading ? "..." : cached}</p>
        </div>
        <div className="flex gap-1 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={onGenerate}
            disabled={isGenerating || isComplete}
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onReset}
            disabled={isGenerating}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaticPagesTab() {
  const queryClient = useQueryClient();
  const [selectedPageType, setSelectedPageType] = useState<string>("all");
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [autoRunning, setAutoRunning] = useState<string | null>(null);
  const [testPath, setTestPath] = useState<string>("");
  const [testResult, setTestResult] = useState<{ html: string; status: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const autoRunRef = useRef<boolean>(false);
  const autoRunTypeRef = useRef<string | null>(null);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeType, setPurgeType] = useState<string>("all");
  const [seoEmergencyDialogOpen, setSeoEmergencyDialogOpen] = useState(false);
  const [seoFixResult, setSeoFixResult] = useState<any>(null);
  const [seoFixLoading, setSeoFixLoading] = useState(false);

  // Fetch stats from edge function
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["static-pages-stats"],
    queryFn: async (): Promise<StaticPageStats> => {
      const { data, error } = await supabase.functions.invoke("generate-static-pages", {
        body: { action: "stats" },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: autoRunning ? 1500 : 10000, // Faster refresh when generating, slower otherwise
  });

  // Fetch cached pages from database
  const { data: cachedPages, isLoading: pagesLoading } = useQuery({
    queryKey: ["static-pages-cache", selectedPageType],
    queryFn: async (): Promise<CacheEntry[]> => {
      let query = supabase
        .from("static_page_cache")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(100);

      if (selectedPageType !== "all") {
        query = query.eq("page_type", selectedPageType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CacheEntry[];
    },
  });

  // Generate batch mutation
  const generateBatchMutation = useMutation({
    mutationFn: async ({ pageType, reset }: { pageType: string; reset?: boolean }) => {
      setGeneratingType(pageType);
      const { data, error } = await supabase.functions.invoke("generate-static-pages", {
        body: { pageType, batchSize: 50, reset },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Immediately refetch stats to show updated numbers
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ["static-pages-cache"] });

      // Log progress for visibility
      console.log(`Batch result: ${data.generated} generated, ${data.currentOffset}/${data.totalCount}, ${data.remaining} remaining`);

      // If auto-running and not done, continue
      if (autoRunRef.current && !data.done && autoRunTypeRef.current === data.pageType) {
        setTimeout(() => {
          if (autoRunRef.current && autoRunTypeRef.current === data.pageType) {
            generateBatchMutation.mutate({ pageType: data.pageType });
          }
        }, 300); // Faster continuation
      } else {
        setGeneratingType(null);
        if (data.done) {
          toast.success(`Completed ${data.pageType}: ${data.currentOffset} pages cached`);
          setAutoRunning(null);
          autoRunRef.current = false;
          autoRunTypeRef.current = null;
        }
      }
    },
    onError: (error: Error) => {
      toast.error(`Generation failed: ${error.message}`);
      setGeneratingType(null);
      setAutoRunning(null);
      autoRunRef.current = false;
      autoRunTypeRef.current = null;
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async (pageType?: string) => {
      const { data, error } = await supabase.functions.invoke("generate-static-pages", {
        body: { action: "reset", pageType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Progress reset");
      queryClient.invalidateQueries({ queryKey: ["static-pages-stats"] });
    },
  });

  // Purge cache mutation
  const purgeCacheMutation = useMutation({
    mutationFn: async (pageType?: string) => {
      const { data, error } = await supabase.functions.invoke("generate-static-pages", {
        body: { action: "clear_cache", pageType: pageType === "all" ? undefined : pageType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Purged ${data.deleted || 0} cache entries`);
      queryClient.invalidateQueries({ queryKey: ["static-pages-stats"] });
      queryClient.invalidateQueries({ queryKey: ["static-pages-cache"] });
      setPurgeDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Purge failed: ${error.message}`);
    },
  });

  // SEO Emergency Fix mutation
  const seoFixMutation = useMutation({
    mutationFn: async (action: string) => {
      setSeoFixLoading(true);
      setSeoFixResult(null);
      const { data, error } = await supabase.functions.invoke("seo-emergency-fix", {
        body: { action },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSeoFixResult(data);
      setSeoFixLoading(false);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      // Refresh stats if we modified cache
      if (data.action?.includes('clear') || data.action?.includes('stale')) {
        queryClient.invalidateQueries({ queryKey: ["static-pages-stats"] });
        queryClient.invalidateQueries({ queryKey: ["static-pages-cache"] });
      }
    },
    onError: (error: Error) => {
      setSeoFixLoading(false);
      toast.error(`SEO fix failed: ${error.message}`);
    },
  });

  const startAutoGenerate = (pageType: string) => {
    setAutoRunning(pageType);
    autoRunRef.current = true;
    autoRunTypeRef.current = pageType;
    generateBatchMutation.mutate({ pageType });
  };

  const stopAutoGenerate = () => {
    setAutoRunning(null);
    autoRunRef.current = false;
    autoRunTypeRef.current = null;
    setGeneratingType(null);
  };

  const handleTestBotView = async () => {
    if (!testPath) return;
    setTestLoading(true);
    setTestResult(null);

    try {
      // Use direct fetch for test mode
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/serve-static?path=${encodeURIComponent(testPath)}&test=1`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      });

      const html = await res.text();
      const cacheStatus = res.headers.get('x-static-cache') || 'unknown';

      setTestResult({ html, status: cacheStatus });
    } catch (err) {
      toast.error(`Test failed: ${err}`);
    } finally {
      setTestLoading(false);
    }
  };

  const isGenerating = generateBatchMutation.isPending;

  // Get progress per type
  const progressMap = new Map<string, ProgressInfo>();
  if (stats?.progress) {
    for (const p of stats.progress) {
      progressMap.set(p.page_type, p);
    }
  }

  const cachedByType = stats?.cachedByType || { state: 0, city: 0, service: 0, service_location: 0, clinic: 0 };
  const totalByType = {
    state: stats?.breakdown?.states || 0,
    city: stats?.breakdown?.cities || 0,
    service: stats?.breakdown?.treatments || 0,
    service_location: stats?.breakdown?.serviceLocations || 0,
    clinic: stats?.breakdown?.clinics || 0,
  };

  const pageTypes = ['state', 'city', 'service', 'service_location', 'clinic'] as const;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {pageTypes.map((type) => {
          const progress = progressMap.get(type);
          const processed = progress?.status === "running" || progress?.status === "complete"
            ? progress.current_offset
            : cachedByType[type];
          const total = progress?.total_count && progress.total_count > 0
            ? progress.total_count
            : totalByType[type];

          return (
            <ProgressCard
              key={type}
              title={type === "service_location" ? "Service-Locations" : type.charAt(0).toUpperCase() + type.slice(1) + "s"}
              generated={processed}
              cached={cachedByType[type]}
              total={total}
              isLoading={statsLoading}
              status={progress?.status}
              onGenerate={() => startAutoGenerate(type)}
              onReset={() => resetMutation.mutate(type)}
              isGenerating={generatingType === type}
              isAutoRunning={autoRunning === type}
            />
          );
        })}
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            Overall Progress
            {autoRunning && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Auto-generating {autoRunning}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold">{statsLoading ? "..." : stats?.cached || 0}</span>
            <span className="text-lg text-muted-foreground">/ {statsLoading ? "..." : stats?.totalPossible || 0} pages</span>
          </div>
          <Progress
            value={stats?.totalPossible ? Math.round(((stats?.cached || 0) / stats.totalPossible) * 100) : 0}
            className="h-3"
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {stats?.totalPossible ? Math.round(((stats?.cached || 0) / stats.totalPossible) * 100) : 0}% complete • {(stats?.totalPossible || 0) - (stats?.cached || 0)} pages remaining
            </p>
            {autoRunning && (
              <Button size="sm" variant="destructive" onClick={stopAutoGenerate}>
                <Square className="h-3 w-3 mr-1" /> Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Bot View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Test Bot View
          </CardTitle>
          <CardDescription>
            Preview what bots see for a given path (uses test mode to bypass user-agent check)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="/ca/los-angeles/"
              value={testPath}
              onChange={(e) => setTestPath(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleTestBotView} disabled={testLoading || !testPath}>
              {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
              Test
            </Button>
          </div>

          {testResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={testResult.status === 'hit' ? 'default' : testResult.status === 'stale' ? 'secondary' : 'destructive'}>
                  Cache: {testResult.status}
                </Badge>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50 max-h-96 overflow-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {testResult.html.substring(0, 3000)}
                  {testResult.html.length > 3000 && '...'}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEO Emergency Fix Section */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            SEO Emergency Fixes
          </CardTitle>
          <CardDescription>
            Critical fixes for noindex cache poisoning and thin content issues. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => seoFixMutation.mutate('status')}
              disabled={seoFixLoading}
              className="h-auto py-3"
            >
              <FileText className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Check SEO Status</div>
                <div className="text-xs text-muted-foreground">View cache and content health</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => seoFixMutation.mutate('mark_all_stale')}
              disabled={seoFixLoading}
              className="h-auto py-3"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Mark All Stale</div>
                <div className="text-xs text-muted-foreground">Force regeneration on next visit</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => seoFixMutation.mutate('clear_stale_cache')}
              disabled={seoFixLoading}
              className="h-auto py-3"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Clear Stale Cache</div>
                <div className="text-xs text-muted-foreground">Remove outdated cached pages</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => seoFixMutation.mutate('identify_thin_content')}
              disabled={seoFixLoading}
              className="h-auto py-3"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Find Thin Content</div>
                <div className="text-xs text-muted-foreground">Identify pages needing content</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => seoFixMutation.mutate('force_regenerate_top_pages')}
              disabled={seoFixLoading}
              className="h-auto py-3"
            >
              <Play className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Regenerate Top Pages</div>
                <div className="text-xs text-muted-foreground">Force refresh of critical pages</div>
              </div>
            </Button>
            <Button
              variant="destructive"
              onClick={() => setSeoEmergencyDialogOpen(true)}
              disabled={seoFixLoading}
              className="h-auto py-3"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">CLEAR ALL CACHE</div>
                <div className="text-xs text-destructive-foreground">Emergency: Fix noindex poisoning</div>
              </div>
            </Button>
          </div>

          {seoFixResult && (
            <div className={`p-3 rounded-lg border ${seoFixResult.success ? 'bg-green-50 border-green-200' : 'bg-destructive/10 border-destructive/20'}`}>
              <p className="font-medium text-sm mb-1">{seoFixResult.message}</p>
              {seoFixResult.next_steps && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Next Steps:</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {seoFixResult.next_steps.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
              {seoFixResult.sample_pages && seoFixResult.sample_pages.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground">Sample Pages:</p>
                  <div className="mt-1 space-y-1 max-h-32 overflow-auto">
                    {seoFixResult.sample_pages.map((page: any, i: number) => (
                      <div key={i} className="text-xs font-mono bg-background p-1 rounded">
                        {page.slug} ({page.content_length} chars)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Batch Generation
          </CardTitle>
          <CardDescription>
            Click a category above to auto-generate pages in batches of 50. Generation will continue until complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => resetMutation.mutate(undefined)}
              variant="outline"
              disabled={isGenerating}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset All Progress
            </Button>
            <Button
              variant="outline"
              onClick={() => refetchStats()}
              disabled={statsLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
              Refresh Stats
            </Button>
            <Button
              variant="destructive"
              onClick={() => setPurgeDialogOpen(true)}
              disabled={isGenerating}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Purge Cache
            </Button>
          </div>

          {/* Show current progress/errors */}
          {stats?.progress && stats.progress.some((p: ProgressInfo) => p.last_error) && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-1">Recent Errors:</p>
              {stats.progress.filter((p: ProgressInfo) => p.last_error).map((p: ProgressInfo) => (
                <p key={p.page_type} className="text-xs text-muted-foreground">
                  <strong>{p.page_type}:</strong> {p.last_error}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cached Pages List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cached Pages
              </CardTitle>
              <CardDescription>
                View generated static HTML files
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedPageType} onValueChange={setSelectedPageType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="state">States</SelectItem>
                  <SelectItem value="city">Cities</SelectItem>
                  <SelectItem value="service">Services</SelectItem>
                  <SelectItem value="service_location">Service-Locations</SelectItem>
                  <SelectItem value="clinic">Clinics</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetchStats()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : cachedPages && cachedPages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cachedPages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-mono text-sm">
                      <a
                        href={`https://www.appointpanda.com${page.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {page.path}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{page.page_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {page.generated_at
                        ? format(new Date(page.generated_at), "MMM d, yyyy HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {page.is_stale ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Stale
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Fresh
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No cached pages found. Generate some pages to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purge Cache Dialog */}
      <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Purge Cache
            </DialogTitle>
            <DialogDescription>
              This will delete cached HTML files from the static page cache.
              Pages will be regenerated on the next crawl or manual generation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">What to purge:</label>
              <Select value={purgeType} onValueChange={setPurgeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cache ({stats?.cached || 0} pages)</SelectItem>
                  <SelectItem value="stale">Stale Only ({stats?.stale || 0} pages)</SelectItem>
                  <SelectItem value="state">States Only ({stats?.cachedByType?.state || 0})</SelectItem>
                  <SelectItem value="city">Cities Only ({stats?.cachedByType?.city || 0})</SelectItem>
                  <SelectItem value="service">Services Only ({stats?.cachedByType?.service || 0})</SelectItem>
                  <SelectItem value="service_location">Service Locations ({stats?.cachedByType?.service_location || 0})</SelectItem>
                  <SelectItem value="clinic">Clinics Only ({stats?.cachedByType?.clinic || 0})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                ⚠️ This action cannot be undone. Bots will see minimal HTML until pages are regenerated.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => purgeCacheMutation.mutate(purgeType === "stale" ? undefined : purgeType)}
              disabled={purgeCacheMutation.isPending}
            >
              {purgeCacheMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Purge {purgeType === "all" ? "All" : purgeType === "stale" ? "Stale" : purgeType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEO Emergency Clear All Cache Dialog */}
      <Dialog open={seoEmergencyDialogOpen} onOpenChange={setSeoEmergencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              EMERGENCY: Clear All Cache
            </DialogTitle>
            <DialogDescription>
              This will DELETE ALL cached HTML files. This is an emergency fix for noindex poisoning.
              All pages will be regenerated on next bot visit. Use only if you have noindex issues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-2">⚠️ WARNING: Critical Action</p>
              <ul className="text-sm text-destructive/80 list-disc list-inside space-y-1">
                <li>This will clear all {stats?.cached || 0} cached pages</li>
                <li>Bots will see minimal HTML until pages regenerate</li>
                <li>May temporarily impact search rankings</li>
                <li>Pages will regenerate over 1-2 weeks as bots crawl</li>
              </ul>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">When to use this:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>Google Search Console shows pages excluded by "noindex tag"</li>
                <li>Prerender.io cached pages in loading/skeleton state</li>
                <li>Pages have wrong robots meta tags in cache</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSeoEmergencyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                seoFixMutation.mutate('clear_all_cache');
                setSeoEmergencyDialogOpen(false);
              }}
              disabled={seoFixLoading}
            >
              {seoFixLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              YES, Clear All Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
