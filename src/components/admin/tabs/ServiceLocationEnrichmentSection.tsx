import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  Stethoscope,
  Settings,
  ChevronDown,
  Play,
  Pause,
  Square,
  Clock,
  Zap,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const WORD_COUNT_OPTIONS = [
  { value: 300, label: '300 words (Standard)' },
  { value: 400, label: '400 words (Detailed)' },
  { value: 500, label: '500 words (Comprehensive)' },
  { value: 750, label: '750 words (Full)' },
  { value: 1000, label: '1000 words (Extended)' },
  { value: 1500, label: '1500 words (Comprehensive)' },
];

const THIN_CONTENT_THRESHOLD = 800;
const NO_CONTENT_THRESHOLD = 400;

const DEFAULT_SEO_PROMPT = `Generate unique, human-written SEO content that:

1. LOCATION FOCUS:
   - Include specific details about the city and surrounding area
   - Mention local landmarks, neighborhoods, or community context
   - Add location-specific dental care insights

2. SERVICE FOCUS:
   - Explain the dental service/treatment in detail
   - Include benefits, procedure overview, and what patients can expect
   - Add cost considerations and insurance information

3. GOOGLE E-E-A-T COMPLIANCE:
   - Experience: Include patient experience perspectives
   - Expertise: Demonstrate dental knowledge and best practices
   - Authoritativeness: Reference established dental guidelines
   - Trustworthiness: Be accurate, helpful, and patient-focused

4. SEO BEST PRACTICES:
   - Natural keyword usage (no stuffing)
   - Proper heading hierarchy (H1 > H2 > H3)
   - Include relevant FAQs (3-5)
   - Compelling meta title (<60 chars) and description (<155 chars)

5. CONTENT QUALITY:
   - 100% unique content - no duplicates
   - Written for humans first, search engines second
   - Actionable and valuable information
   - Clear call-to-action to book appointments`;

interface EnrichmentLog {
  timestamp: Date;
  item: string;
  action: 'started' | 'completed' | 'error' | 'paused' | 'resumed' | 'info';
  message: string;
}

interface ServiceLocationItem {
  id: string;
  cityName: string;
  citySlug: string;
  stateAbbr: string;
  stateSlug: string;
  serviceName: string;
  serviceSlug: string;
  hasContent: boolean;
  slug: string;
}

interface EnrichmentProgress {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'stopped';
  total: number;
  processed: number;
  errors: number;
  startedAt: Date | null;
  logs: EnrichmentLog[];
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining: string;
}

// Storage key for persisting progress
const STORAGE_KEY = 'service-location-enrichment-progress';

export default function ServiceLocationEnrichmentSection() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedWordCount, setSelectedWordCount] = useState(400);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SEO_PROMPT);
  const [showPromptSettings, setShowPromptSettings] = useState(false);
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
    currentBatch: 0,
    totalBatches: 0,
    estimatedTimeRemaining: '-',
  });

  // Load persisted progress on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.status === 'running' || parsed.status === 'paused') {
          // Restore progress but mark as paused (session was interrupted)
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

  // Fetch states for filter
  const { data: states = [] } = useQuery({
    queryKey: ['enrichment-states-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('states')
        .select('id, name, slug, abbreviation')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch treatments for filter
  const { data: treatments = [] } = useQuery({
    queryKey: ['enrichment-treatments-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch service-location combinations (only from active states and active cities)
  const { data: serviceLocations = [], refetch: refetchServiceLocations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ['service-location-enrichment', selectedStateFilter, selectedServiceFilter, searchTerm],
    queryFn: async () => {
      // Get cities only from active states using !inner join
      let cityQuery = supabase
        .from('cities')
        .select(`
          id, name, slug, dentist_count,
          state:states!inner(id, name, slug, abbreviation, is_active)
        `)
        .eq('is_active', true)
        .eq('state.is_active', true);
      
      if (selectedStateFilter !== 'all') {
        cityQuery = cityQuery.eq('state.slug', selectedStateFilter);
      }
      
      if (searchTerm) {
        cityQuery = cityQuery.ilike('name', `%${searchTerm}%`);
      }
      
      const { data: cities, error: cityError } = await cityQuery;
      if (cityError) throw cityError;

      // Get treatments
      let treatmentQuery = supabase
        .from('treatments')
        .select('id, name, slug')
        .eq('is_active', true);
      
      if (selectedServiceFilter !== 'all') {
        treatmentQuery = treatmentQuery.eq('slug', selectedServiceFilter);
      }
      
      const { data: treatmentsData } = await treatmentQuery;

      // Generate combinations
      const combinations: ServiceLocationItem[] = [];
      for (const city of cities || []) {
        const state = city.state as unknown as { id: string; name: string; slug: string; abbreviation: string };
        for (const treatment of treatmentsData || []) {
          combinations.push({
            id: `${city.id}-${treatment.id}`,
            cityName: city.name,
            citySlug: city.slug,
            stateAbbr: state.abbreviation,
            stateSlug: state.slug,
            serviceName: treatment.name,
            serviceSlug: treatment.slug,
            hasContent: false,
            slug: `/${state.slug}/${city.slug}/${treatment.slug}`,
          });
        }
      }

      // Check which have SEO content
      const slugs = combinations.map(c => c.slug);
      if (slugs.length > 0) {
        // Check in batches of 500
        const batchSize = 500;
        const hasGoodContent = new Set<string>();
        
        for (let i = 0; i < slugs.length; i += batchSize) {
          const batch = slugs.slice(i, i + batchSize);
          // Check for pages with word_count >= NO_CONTENT_THRESHOLD (400)
          const { data: seoPages } = await supabase
            .from('seo_pages')
            .select('slug, word_count')
            .in('slug', batch)
            .gte('word_count', 400);
          
          seoPages?.forEach(p => hasGoodContent.add(p.slug));
        }

        combinations.forEach(c => {
          c.hasContent = hasGoodContent.has(c.slug);
        });
      }

      return combinations;
    },
  });

  const itemsWithoutContent = serviceLocations.filter(i => !i.hasContent);
  const itemsWithContent = serviceLocations.filter(i => i.hasContent);
  const completionPercentage = serviceLocations.length > 0 
    ? Math.round((itemsWithContent.length / serviceLocations.length) * 100) 
    : 0;

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchServiceLocations();
    setIsRefreshing(false);
    toast.success('Data refreshed!');
  };

  // Selection handlers - NO LIMIT
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
      logs: [{ ...log, timestamp: new Date() }, ...prev.logs].slice(0, 500), // Keep last 500 logs
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

  // Reset prompt to default
  const resetPrompt = () => {
    setCustomPrompt(DEFAULT_SEO_PROMPT);
    toast.success('Prompt reset to default');
  };

  // Bulk generate content with resilience
  const handleBulkGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one service-location');
      return;
    }

    setIsBulkGenerating(true);
    setShowBulkDialog(false);
    stopRef.current = false;
    pauseRef.current = false;
    setIsPaused(false);

    const selectedItems = serviceLocations.filter(i => selectedIds.has(i.id));
    const CHUNK_SIZE = 5; // Process 5 at a time
    const chunks: ServiceLocationItem[][] = [];
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
      currentBatch: 0,
      totalBatches: chunks.length,
      estimatedTimeRemaining: 'Calculating...',
    });

    addLog({
      item: '',
      action: 'started',
      message: `Starting bulk generation for ${selectedItems.length} service-location pages with ${selectedWordCount} words...`,
    });

    let processedTotal = 0;
    let errorsTotal = 0;
    let successTotal = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        // Check for stop signal
        if (stopRef.current) {
          break;
        }

        // Wait while paused
        while (pauseRef.current && !stopRef.current) {
          await new Promise(r => setTimeout(r, 500));
        }

        if (stopRef.current) break;

        setProgress(prev => ({ ...prev, currentBatch: i + 1 }));

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
            // Generate content using AI with custom prompt
            const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
              body: {
                action: 'generate_service_location_content',
                pageType: 'service_location',
                slug: item.slug,
                cityName: item.cityName,
                stateAbbr: item.stateAbbr,
                stateSlug: item.stateSlug,
                serviceName: item.serviceName,
                serviceSlug: item.serviceSlug,
                wordCount: selectedWordCount,
                customPrompt: customPrompt,
              },
            });

            if (error) throw error;

            addLog({
              item: `${item.serviceName} in ${item.cityName}`,
              action: 'completed',
              message: 'Content generated successfully',
            });

            processedTotal++;
            successTotal++;
          } catch (err) {
            addLog({
              item: `${item.serviceName} in ${item.cityName}`,
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

          // Delay to avoid rate limits (reduced since we're processing in batches)
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
        message: `${finalStatus === 'completed' ? 'Complete!' : 'Stopped.'} Generated: ${successTotal}, Errors: ${errorsTotal}`,
      });

      if (finalStatus === 'completed') {
        toast.success(`Generated content for ${successTotal} service-location pages`);
        // Clear persisted progress on success
        localStorage.removeItem(STORAGE_KEY);
      }
      
      clearSelection();
      refetchServiceLocations();
    } catch (error) {
      setProgress(prev => ({ ...prev, status: 'stopped' }));
      addLog({
        item: '',
        action: 'error',
        message: `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
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
      {/* Live Progress Banner - Always visible when running */}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePauseResume}
                >
                  {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{progress.processed}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{progress.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-teal">{progress.processed - progress.errors}</p>
                <p className="text-xs text-muted-foreground">Success</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-coral">{progress.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{progress.estimatedTimeRemaining}</p>
                <p className="text-xs text-muted-foreground">ETA</p>
              </div>
            </div>

            <Progress value={(progress.processed / progress.total) * 100} className="h-3 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Batch {progress.currentBatch}/{progress.totalBatches}</span>
              <span>{Math.round((progress.processed / progress.total) * 100)}% complete</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Service-Location Pages Content
          </h3>
          <p className="text-sm text-muted-foreground">
            Generate unique SEO content for service + city combination pages (e.g., /ca/los-angeles/teeth-cleaning)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoadingLocations}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{serviceLocations.length.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Pages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-coral" />
              <div>
                <p className="text-2xl font-bold">{itemsWithoutContent.length.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Need Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-teal" />
              <div>
                <p className="text-2xl font-bold">{itemsWithContent.length.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Have Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Stethoscope className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{treatments.length}</p>
                <p className="text-xs text-muted-foreground">Services</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{completionPercentage}%</p>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEO Prompt Settings */}
      <Collapsible open={showPromptSettings} onOpenChange={setShowPromptSettings}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -my-2 px-6 py-2 rounded">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">SEO Content Generation Prompt</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${showPromptSettings ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CardDescription>
              Customize the AI prompt used to generate SEO content. This prompt ensures content follows Google's E-E-A-T guidelines.
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Enter your custom SEO prompt..."
              />
              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={resetPrompt}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {customPrompt.length} characters
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedStateFilter} onValueChange={setSelectedStateFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {states.map(s => (
              <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedServiceFilter} onValueChange={setSelectedServiceFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {treatments.map(t => (
              <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {selectedIds.size.toLocaleString()} selected
            </Badge>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear selection
            </Button>
          </div>
          <Button
            onClick={() => setShowBulkDialog(true)}
            disabled={isBulkGenerating}
            size="lg"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Content for Selected
          </Button>
        </div>
      )}

      {/* Progress Log (when generation has started) */}
      {progress.logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Generation Log
                <Badge variant="outline" className={getStatusColor(progress.status) + ' text-white'}>
                  {progress.status}
                </Badge>
              </CardTitle>
              {progress.status === 'completed' || progress.status === 'stopped' ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setProgress(prev => ({ ...prev, logs: [], status: 'idle' }));
                    localStorage.removeItem(STORAGE_KEY);
                  }}
                >
                  Clear Log
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 border rounded p-2">
              {progress.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-muted last:border-0">
                  {getLogIcon(log.action)}
                  <span className="text-muted-foreground whitespace-nowrap">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  {log.item && <span className="font-medium truncate max-w-[200px]">{log.item}:</span>}
                  <span className={log.action === 'error' ? 'text-coral' : ''}>{log.message}</span>
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
            <div>
              <CardTitle className="text-base">
                Service-Location Pages Needing Content
              </CardTitle>
              <CardDescription>
                {itemsWithoutContent.length.toLocaleString()} pages need unique SEO content
              </CardDescription>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              onClick={selectAll}
              disabled={itemsWithoutContent.length === 0 || isBulkGenerating}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Select All ({itemsWithoutContent.length.toLocaleString()})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingLocations ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">Loading service-location pages...</p>
                    </TableCell>
                  </TableRow>
                ) : itemsWithoutContent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-teal" />
                      All visible service-location pages have content!
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsWithoutContent.slice(0, 500).map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.serviceName}</TableCell>
                      <TableCell>{item.cityName}</TableCell>
                      <TableCell>{item.stateAbbr}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-coral border-coral">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          No Content
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={item.slug}
                          target="_blank"
                          className="text-primary hover:underline text-sm"
                        >
                          View Page
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {itemsWithoutContent.length > 500 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-sm">
                      Showing 500 of {itemsWithoutContent.length.toLocaleString()} items. 
                      Use "Select All" to generate content for all {itemsWithoutContent.length.toLocaleString()} pages.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bulk Generate Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Content for {selectedIds.size.toLocaleString()} Service-Location Pages</DialogTitle>
            <DialogDescription>
              This will generate unique SEO content for each selected service-location page.
              Each page will receive {selectedWordCount} words of unique content about the specific service in that city.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Selected pages:</span>
                <span className="font-semibold">{selectedIds.size.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Word count per page:</span>
                <span className="font-semibold">{selectedWordCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated time:</span>
                <span className="font-semibold">~{Math.ceil(selectedIds.size * 3 / 60)} minutes</span>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-600 mb-1">Resilient Generation</p>
              <p className="text-muted-foreground">
                You can pause, resume, or stop the process at any time. Progress is saved automatically 
                and will resume if the page is refreshed or you lose connection.
              </p>
            </div>
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
