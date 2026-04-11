import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Search,
  Wand2,
  CheckSquare,
  Square,
  Globe,
  Building,
  Play,
  Pause,
  Clock,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const WORD_COUNT_OPTIONS = [
  { value: 200, label: '200 words (Standard)' },
  { value: 300, label: '300 words (Detailed)' },
  { value: 400, label: '400 words (Comprehensive)' },
  { value: 500, label: '500 words (Full)' },
  { value: 750, label: '750 words (Extended)' },
  { value: 1000, label: '1000 words (Long-form)' },
  { value: 1500, label: '1500 words (Comprehensive)' },
];

const THIN_CONTENT_THRESHOLD = 800;
const NO_CONTENT_THRESHOLD = 400;

interface EnrichmentLog {
  timestamp: Date;
  item: string;
  action: 'started' | 'completed' | 'error' | 'paused' | 'resumed' | 'info';
  message: string;
}

interface LocationItem {
  id: string;
  name: string;
  slug: string;
  type: 'state' | 'city';
  stateAbbr?: string;
  stateSlug?: string;
  hasContent: boolean;
  clinicCount?: number;
}

interface EnrichmentProgress {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  total: number;
  processed: number;
  errors: number;
  startedAt: Date | null;
  logs: EnrichmentLog[];
  estimatedTimeRemaining: string;
}

// Storage key for persisting progress
const STORAGE_KEY = 'location-enrichment-progress';

export default function LocationEnrichmentSection() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'states' | 'cities'>('states');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedWordCount, setSelectedWordCount] = useState(300);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);
  
  const [progress, setProgress] = useState<EnrichmentProgress>({
    status: 'idle',
    total: 0,
    processed: 0,
    errors: 0,
    startedAt: null,
    logs: [],
    estimatedTimeRemaining: '-',
  });

  // Load persisted progress on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.status === 'running' || parsed.status === 'paused') {
          setProgress({
            ...parsed,
            status: 'paused',
            startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
            logs: parsed.logs.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) })),
          });
          toast.info('Previous generation was interrupted. You can resume or restart.');
        }
      }
    } catch (e) {
      console.error('Failed to load saved progress:', e);
    }
  }, []);

  // Persist progress changes
  useEffect(() => {
    if (progress.status !== 'idle') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch (e) {
        console.error('Failed to save progress:', e);
      }
    }
  }, [progress]);

  // Fetch states
  const { data: states = [], refetch: refetchStates } = useQuery({
    queryKey: ['location-enrichment-states', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('states')
        .select('id, name, slug, abbreviation')
        .eq('is_active', true)
        .order('name');
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // Check which states have SEO content (either optimized OR word_count >= NO_CONTENT_THRESHOLD)
      const slugs = data?.map(s => `/${s.slug}`) || [];
      const { data: seoPages } = await supabase
        .from('seo_pages')
        .select('slug, word_count')
        .in('slug', slugs);

      const hasGoodContent = new Set<string>();
      seoPages?.forEach(p => {
        if (p.word_count && p.word_count >= NO_CONTENT_THRESHOLD) {
          hasGoodContent.add(p.slug);
        }
      });

      return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        type: 'state' as const,
        stateAbbr: s.abbreviation,
        hasContent: hasGoodContent.has(`/${s.slug}`),
      })) as LocationItem[];
    },
  });

  // Fetch cities only from active states (using !inner join to filter)
  const { data: cities = [], refetch: refetchCities } = useQuery({
    queryKey: ['location-enrichment-cities', searchTerm],
    queryFn: async () => {
      // Use !inner join to only get cities where the parent state is also active
      let query = supabase
        .from('cities')
        .select(`
          id, name, slug, dentist_count,
          state:states!inner(id, name, slug, abbreviation, is_active)
        `)
        .eq('is_active', true)
        .eq('state.is_active', true)
        .order('name');
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // Check which cities have SEO content (either optimized OR word_count >= NO_CONTENT_THRESHOLD)
      const slugs = data?.map(c => {
        const state = c.state as unknown as { slug: string } | null;
        return `/${state?.slug}/${c.slug}`;
      }) || [];
      
      // Batch check for SEO pages
      const hasGoodContent = new Set<string>();
      if (slugs.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < slugs.length; i += batchSize) {
          const batch = slugs.slice(i, i + batchSize);
          const { data: seoPages } = await supabase
            .from('seo_pages')
            .select('slug, word_count')
            .in('slug', batch);
          seoPages?.forEach(p => {
            if (p.word_count && p.word_count >= NO_CONTENT_THRESHOLD) {
              hasGoodContent.add(p.slug);
            }
          });
        }
      }

      return (data || []).map(c => {
        const state = c.state as unknown as { name: string; slug: string; abbreviation: string } | null;
        const fullSlug = `/${state?.slug}/${c.slug}`;
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          type: 'city' as const,
          stateAbbr: state?.abbreviation,
          stateSlug: state?.slug,
          hasContent: hasGoodContent.has(fullSlug),
          clinicCount: c.dentist_count,
        };
      }) as LocationItem[];
    },
  });

  const currentItems = activeSubTab === 'states' ? states : cities;
  const itemsWithoutContent = currentItems.filter(i => !i.hasContent);
  const itemsWithContent = currentItems.filter(i => i.hasContent);

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStates(), refetchCities()]);
    setIsRefreshing(false);
    toast.success('Data refreshed!');
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select ALL items without content - NO LIMIT
  const selectAll = () => {
    const allIds = itemsWithoutContent.map(i => i.id);
    setSelectedIds(new Set(allIds));
    toast.success(`Selected all ${allIds.length} items needing content`);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Add log entry
  const addLog = (log: Omit<EnrichmentLog, 'timestamp'>) => {
    setProgress(prev => ({
      ...prev,
      logs: [{ ...log, timestamp: new Date() }, ...prev.logs].slice(0, 500),
    }));
  };

  // Calculate estimated time
  const calculateETA = (processed: number, total: number, startTime: Date): string => {
    if (processed === 0) return 'Calculating...';
    const elapsed = Date.now() - startTime.getTime();
    const avgTimePerItem = elapsed / processed;
    const remaining = (total - processed) * avgTimePerItem;
    
    if (remaining < 60000) return `${Math.ceil(remaining / 1000)}s`;
    if (remaining < 3600000) return `${Math.ceil(remaining / 60000)}m`;
    return `${(remaining / 3600000).toFixed(1)}h`;
  };

  // Stop generation
  const handleStop = () => {
    stopRef.current = true;
    setProgress(prev => ({ ...prev, status: 'stopped' }));
    addLog({ item: '', action: 'info', message: 'Generation stopped by user' });
    toast.info('Generation stopped');
  };

  // Pause/Resume generation
  const handlePauseResume = () => {
    if (isPaused) {
      pauseRef.current = false;
      setIsPaused(false);
      setProgress(prev => ({ ...prev, status: 'running' }));
      addLog({ item: '', action: 'resumed', message: 'Generation resumed' });
      toast.success('Generation resumed');
    } else {
      pauseRef.current = true;
      setIsPaused(true);
      setProgress(prev => ({ ...prev, status: 'paused' }));
      addLog({ item: '', action: 'paused', message: 'Generation paused' });
      toast.info('Generation paused');
    }
  };

  // Bulk generate content with pause/resume support
  const handleBulkGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one location');
      return;
    }

    setIsBulkGenerating(true);
    setShowBulkDialog(false);
    stopRef.current = false;
    pauseRef.current = false;
    setIsPaused(false);

    const selectedItems = currentItems.filter(i => selectedIds.has(i.id));
    const CHUNK_SIZE = 5;
    const chunks: LocationItem[][] = [];
    for (let i = 0; i < selectedItems.length; i += CHUNK_SIZE) {
      chunks.push(selectedItems.slice(i, i + CHUNK_SIZE));
    }

    const startTime = new Date();
    setProgress({
      status: 'running',
      total: selectedItems.length,
      processed: 0,
      errors: 0,
      startedAt: startTime,
      logs: [],
      estimatedTimeRemaining: 'Calculating...',
    });

    addLog({
      item: '',
      action: 'started',
      message: `Starting bulk generation for ${selectedItems.length} ${activeSubTab} with ${selectedWordCount} words...`,
    });

    let processedTotal = 0;
    let errorsTotal = 0;
    let successTotal = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        // Check for stop signal
        if (stopRef.current) break;

        // Wait while paused
        while (pauseRef.current && !stopRef.current) {
          await new Promise(r => setTimeout(r, 500));
        }

        if (stopRef.current) break;

        addLog({
          item: '',
          action: 'info',
          message: `Processing batch ${i + 1}/${chunks.length}...`,
        });

        for (const item of chunks[i]) {
          // Check for stop signal
          if (stopRef.current) break;

          // Wait while paused
          while (pauseRef.current && !stopRef.current) {
            await new Promise(r => setTimeout(r, 500));
          }

          if (stopRef.current) break;

          try {
            const pageSlug = item.type === 'state' 
              ? `/${item.slug}`
              : `/${item.stateSlug}/${item.slug}`;

            // Generate content using AI
            const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
              body: {
                action: 'generate_location_content',
                pageType: item.type,
                slug: pageSlug,
                locationName: item.name,
                stateAbbr: item.stateAbbr,
                wordCount: selectedWordCount,
              },
            });

            if (error) throw error;

            addLog({
              item: item.name,
              action: 'completed',
              message: 'Content generated successfully',
            });

            processedTotal++;
            successTotal++;
          } catch (err) {
            addLog({
              item: item.name,
              action: 'error',
              message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
            errorsTotal++;
            processedTotal++;
          }

          const eta = calculateETA(processedTotal, selectedItems.length, startTime);
          setProgress(prev => ({
            ...prev,
            processed: processedTotal,
            errors: errorsTotal,
            estimatedTimeRemaining: eta,
          }));

          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 200));
        }
      }

      const finalStatus = stopRef.current ? 'stopped' : 'completed';
      setProgress(prev => ({
        ...prev,
        status: finalStatus,
        estimatedTimeRemaining: '-',
      }));

      addLog({
        item: '',
        action: 'completed',
        message: `Complete! Generated: ${successTotal}, Errors: ${errorsTotal}`,
      });

      toast.success(`Generated content for ${successTotal} locations`);
      clearSelection();
      localStorage.removeItem(STORAGE_KEY);
      
      // Refresh data
      if (activeSubTab === 'states') {
        refetchStates();
      } else {
        refetchCities();
      }
    } catch (error) {
      setProgress(prev => ({ ...prev, status: 'stopped' }));
      toast.error('Bulk generation failed');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const getLogIcon = (action: EnrichmentLog['action']) => {
    switch (action) {
      case 'started': return <Play className="h-3 w-3 text-primary" />;
      case 'completed': return <CheckCircle className="h-3 w-3 text-teal" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-coral" />;
      case 'paused': return <Pause className="h-3 w-3 text-amber-500" />;
      case 'resumed': return <Play className="h-3 w-3 text-teal" />;
      case 'info': return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
    }
  };

  const getStatusColor = (status: EnrichmentProgress['status']) => {
    switch (status) {
      case 'running': return 'bg-primary';
      case 'paused': return 'bg-amber-500';
      case 'completed': return 'bg-teal';
      case 'stopped': return 'bg-coral';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Progress Banner */}
      {(progress.status === 'running' || progress.status === 'paused') && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${getStatusColor(progress.status)} ${progress.status === 'running' ? 'animate-pulse' : ''}`} />
                <span className="font-semibold text-lg">
                  {progress.status === 'running' ? 'Generating Content...' : 'Generation Paused'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePauseResume}>
                  {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleStop}>
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{progress.processed}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{progress.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-teal">{progress.processed - progress.errors}</p>
                <p className="text-xs text-muted-foreground">Success</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-coral">{progress.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
            <Progress value={(progress.processed / progress.total) * 100} className="h-3 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>ETA: {progress.estimatedTimeRemaining}</span>
              <span>{Math.round((progress.processed / progress.total) * 100)}% complete</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Location Pages Content
          </h3>
          <p className="text-sm text-muted-foreground">
            Generate unique SEO content for State and City pages
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{states.length}</p>
                <p className="text-xs text-muted-foreground">Total States</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-teal" />
              <div>
                <p className="text-2xl font-bold">{states.filter(s => s.hasContent).length}</p>
                <p className="text-xs text-muted-foreground">States with Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{cities.length}</p>
                <p className="text-xs text-muted-foreground">Total Cities</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-teal" />
              <div>
                <p className="text-2xl font-bold">{cities.filter(c => c.hasContent).length}</p>
                <p className="text-xs text-muted-foreground">Cities with Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={(v) => { setActiveSubTab(v as 'states' | 'cities'); clearSelection(); }}>
        <TabsList>
          <TabsTrigger value="states">
            <Globe className="h-4 w-4 mr-2" />
            States ({states.filter(s => !s.hasContent).length} need content)
          </TabsTrigger>
          <TabsTrigger value="cities">
            <Building className="h-4 w-4 mr-2" />
            Cities ({cities.filter(c => !c.hasContent).length} need content)
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeSubTab} className="mt-4">
          {/* Search and Actions */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeSubTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedWordCount.toString()} onValueChange={(v) => setSelectedWordCount(parseInt(v))}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Word count" />
                </SelectTrigger>
                <SelectContent>
                  {WORD_COUNT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-sm">
                  {selectedIds.size} selected
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear selection
                </Button>
              </div>
              <Button
                onClick={() => setShowBulkDialog(true)}
                disabled={isBulkGenerating}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Content for Selected
              </Button>
            </div>
          )}

          {/* Progress Display */}
          {progress && (
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {progress.status === 'running' ? 'Generating...' : 'Complete'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {progress.processed}/{progress.total} ({progress.errors} errors)
                  </span>
                </div>
                <Progress value={(progress.processed / progress.total) * 100} className="mb-4" />
                <ScrollArea className="h-32 border rounded p-2">
                  {progress.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs py-1">
                      {getLogIcon(log.action)}
                      <span className="text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      {log.item && <span className="font-medium">{log.item}:</span>}
                      <span>{log.message}</span>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {activeSubTab === 'states' ? 'States' : 'Cities'} Needing Content
                </CardTitle>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select All ({itemsWithoutContent.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      {activeSubTab === 'cities' && <TableHead>State</TableHead>}
                      {activeSubTab === 'cities' && <TableHead>Clinics</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsWithoutContent.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        {activeSubTab === 'cities' && (
                          <TableCell>{item.stateAbbr}</TableCell>
                        )}
                        {activeSubTab === 'cities' && (
                          <TableCell>{item.clinicCount}</TableCell>
                        )}
                        <TableCell>
                          <Badge variant="outline" className="text-coral border-coral">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No Content
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={item.type === 'state' ? `/${item.slug}` : `/${item.stateSlug}/${item.slug}`}
                            target="_blank"
                            className="text-primary hover:underline text-sm"
                          >
                            View Page
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                    {itemsWithoutContent.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={activeSubTab === 'cities' ? 6 : 4} className="text-center py-8 text-muted-foreground">
                          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-teal" />
                          All {activeSubTab} have content!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Generate Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Content for {selectedIds.size} Locations</DialogTitle>
            <DialogDescription>
              This will generate unique SEO content for each selected {activeSubTab === 'states' ? 'state' : 'city'} page.
              Each location will receive {selectedWordCount} words of unique content.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Estimated time: ~{Math.ceil(selectedIds.size * 3 / 60)} minutes
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkGenerate}>
              <Sparkles className="h-4 w-4 mr-2" />
              Start Generation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
