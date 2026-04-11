import { useState, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building2, 
  FileText, 
  Image, 
  CheckCircle, 
  AlertCircle,
  Play,
  StopCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Edit,
  Trash2,
  Search,
  Wand2,
  Save,
  ExternalLink,
  Eye,
  CheckSquare,
  Square,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import LocationEnrichmentSection from './LocationEnrichmentSection';
import ServiceLocationEnrichmentSection from './ServiceLocationEnrichmentSection';

const WORD_COUNT_OPTIONS = [
  { value: 100, label: '100 words (Brief)' },
  { value: 150, label: '150 words (Standard)' },
  { value: 200, label: '200 words (Detailed)' },
  { value: 300, label: '300 words (Comprehensive)' },
  { value: 400, label: '400 words (Extended)' },
  { value: 500, label: '500 words (Full)' },
  { value: 750, label: '750 words (Extended)' },
  { value: 1000, label: '1000 words (Long-form)' },
  { value: 1500, label: '1500 words (Comprehensive)' },
];

const THIN_CONTENT_THRESHOLD = 800;
const NO_CONTENT_THRESHOLD = 400;

interface EnrichmentLog {
  timestamp: Date;
  clinic: string;
  action: 'started' | 'completed' | 'error';
  message: string;
}

interface EnrichmentProgress {
  status: 'running' | 'completed' | 'stopped';
  total: number;
  processed: number;
  errors: number;
  logs: EnrichmentLog[];
}

interface ClinicForEnrichment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  cover_image_url: string | null;
  city: { name: string; state?: { abbreviation: string } } | null;
}

export default function ClinicEnrichmentTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const stopFlagRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<ClinicForEnrichment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Bulk selection state
  const [selectedClinicIds, setSelectedClinicIds] = useState<Set<string>>(new Set());
  const [selectedWordCount, setSelectedWordCount] = useState(150);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Fetch clinic stats
  const { data: clinicStats, refetch: refetchStats } = useQuery({
    queryKey: ['clinic-enrichment-stats'],
    queryFn: async () => {
      const { count: totalCount } = await supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      const { count: noDescCount } = await supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('description', null);

      const { count: noImageCount } = await supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('cover_image_url', null);

      return {
        total: totalCount || 0,
        noDescription: noDescCount || 0,
        noImage: noImageCount || 0,
        withDescription: (totalCount || 0) - (noDescCount || 0),
        withImage: (totalCount || 0) - (noImageCount || 0),
      };
    },
  });

  // Fetch clinics without description with NO LIMIT
  const { data: clinicsNeedingDescription = [], refetch: refetchClinics } = useQuery({
    queryKey: ['clinics-needing-description', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          id, name, slug, description, address, rating, review_count, cover_image_url,
          city:cities(name, state:states(abbreviation))
        `)
        .eq('is_active', true)
        .is('description', null)
        .order('name');
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as unknown as ClinicForEnrichment[];
    },
  });

  // Fetch ALL clinics for management
  const { data: allClinics = [] } = useQuery({
    queryKey: ['all-clinics-enrichment', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          id, name, slug, description, address, rating, review_count, cover_image_url,
          city:cities(name, state:states(abbreviation))
        `)
        .eq('is_active', true)
        .order('name');
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(500);
      
      if (error) throw error;
      return (data || []) as unknown as ClinicForEnrichment[];
    },
  });

  // Master refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchClinics(),
      queryClient.invalidateQueries({ queryKey: ['all-clinics-enrichment'] }),
    ]);
    setIsRefreshing(false);
    toast.success('Data refreshed!');
  };

  // Add log entry
  const addLog = (log: Omit<EnrichmentLog, 'timestamp'>) => {
    setProgress(prev => prev ? {
      ...prev,
      logs: [...prev.logs, { ...log, timestamp: new Date() }],
    } : null);
  };

  // Stop enrichment
  const stopEnrichment = () => {
    stopFlagRef.current = true;
    toast.info('Stopping enrichment... Please wait for current batch to complete.');
  };

  // Generate descriptions using edge function
  const generateDescriptions = async (batchSize: number = 25) => {
    setIsEnriching(true);
    stopFlagRef.current = false;
    
    setProgress({
      status: 'running',
      total: batchSize,
      processed: 0,
      errors: 0,
      logs: [],
    });

    addLog({ clinic: '', action: 'started', message: `Starting batch description generation (${batchSize} clinics)...` });

    try {
      const { data, error } = await supabase.functions.invoke('batch-enrich-clinics', {
        body: { action: 'generate_descriptions', batchSize },
      });

      if (error) throw error;

      if (data.results) {
        for (const result of data.results) {
          addLog({
            clinic: result.name,
            action: result.success ? 'completed' : 'error',
            message: result.success 
              ? 'Description generated successfully' 
              : `Error: ${result.error || 'Unknown error'}`,
          });
        }
      }

      setProgress(prev => prev ? {
        ...prev,
        status: 'completed',
        processed: data.processed || 0,
        errors: data.errors || 0,
      } : null);

      addLog({ 
        clinic: '', 
        action: 'completed', 
        message: `Batch complete! Generated: ${data.processed || 0}, Errors: ${data.errors || 0}` 
      });

      toast.success(`Generated ${data.processed || 0} descriptions with ${data.errors || 0} errors`);
      
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['clinics-needing-description'] });
    } catch (error) {
      console.error('Enrichment error:', error);
      addLog({ 
        clinic: '', 
        action: 'error', 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      
      setProgress(prev => prev ? { ...prev, status: 'stopped' } : null);
      toast.error('Failed to generate descriptions');
    } finally {
      setIsEnriching(false);
      stopFlagRef.current = false;
    }
  };

  // Update clinic description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async ({ clinicId, description }: { clinicId: string; description: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({ description, updated_at: new Date().toISOString() })
        .eq('id', clinicId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinics-needing-description'] });
      queryClient.invalidateQueries({ queryKey: ['all-clinics-enrichment'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-enrichment-stats'] });
      toast.success('Description updated successfully!');
      setShowEditDialog(false);
      setSelectedClinic(null);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Generate AI description for single clinic
  const generateSingleDescription = async () => {
    if (!selectedClinic) return;
    
    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-enrich-clinics', {
        body: { 
          action: 'generate_single_description', 
          clinicId: selectedClinic.id,
          clinicName: selectedClinic.name,
          clinicAddress: selectedClinic.address,
          clinicCity: selectedClinic.city?.name,
          clinicState: selectedClinic.city?.state?.abbreviation,
        },
      });

      if (error) throw error;

      if (data.description) {
        setEditDescription(data.description);
        toast.success('AI description generated!');
      }
    } catch (error) {
      toast.error('Failed to generate AI description');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Add placeholder images
  const addPlaceholderImages = async () => {
    try {
      // Update all clinics without cover images
      const { data: clinicsWithoutImages } = await supabase
        .from('clinics')
        .select('id')
        .is('cover_image_url', null)
        .eq('is_active', true);
      
      if (!clinicsWithoutImages || clinicsWithoutImages.length === 0) {
        toast.info('All clinics already have images');
        return;
      }

      const placeholderImages = [
        'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800',
        'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800',
        'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800',
      ];

      let updated = 0;
      for (const clinic of clinicsWithoutImages) {
        const randomImage = placeholderImages[Math.floor(Math.random() * placeholderImages.length)];
        const { error } = await supabase
          .from('clinics')
          .update({ cover_image_url: randomImage })
          .eq('id', clinic.id);
        
        if (!error) updated++;
      }

      toast.success(`Added placeholder images to ${updated} clinics`);
      refetchStats();
    } catch (error) {
      toast.error('Failed to add placeholder images');
    }
  };

  // Handle edit clinic
  const handleEditClinic = (clinic: ClinicForEnrichment) => {
    setSelectedClinic(clinic);
    setEditDescription(clinic.description || '');
    setShowEditDialog(true);
  };

  // Save description
  const handleSaveDescription = () => {
    if (!selectedClinic) return;
    updateDescriptionMutation.mutate({
      clinicId: selectedClinic.id,
      description: editDescription,
    });
  };

  const getLogIcon = (action: EnrichmentLog['action']) => {
    switch (action) {
      case 'started': return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      case 'completed': return <CheckCircle className="h-3 w-3 text-teal" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-coral" />;
    }
  };

  // Bulk selection handlers
  const toggleSelectClinic = (clinicId: string) => {
    setSelectedClinicIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clinicId)) {
        newSet.delete(clinicId);
      } else {
        newSet.add(clinicId);
      }
      return newSet;
    });
  };

  const selectAllClinics = (clinics: ClinicForEnrichment[]) => {
    setSelectedClinicIds(new Set(clinics.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedClinicIds(new Set());
  };

  // Bulk generate descriptions
  const handleBulkGenerate = async () => {
    if (selectedClinicIds.size === 0) {
      toast.error('Please select at least one clinic');
      return;
    }

    setIsBulkGenerating(true);
    setShowBulkDialog(false);

    const CHUNK_SIZE = 25;
    const allIds = Array.from(selectedClinicIds);
    const chunks: string[][] = [];
    for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
      chunks.push(allIds.slice(i, i + CHUNK_SIZE));
    }

    setProgress({
      status: 'running',
      total: allIds.length,
      processed: 0,
      errors: 0,
      logs: [],
    });

    addLog({
      clinic: '',
      action: 'started',
      message: `Starting bulk generation for ${allIds.length} clinics with ${selectedWordCount} words...`,
    });

    let processedTotal = 0;
    let errorsTotal = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        addLog({
          clinic: '',
          action: 'started',
          message: `Processing batch ${i + 1}/${chunks.length} (${Math.min((i + 1) * CHUNK_SIZE, allIds.length)}/${allIds.length})...`,
        });

        const { data, error } = await supabase.functions.invoke('batch-enrich-clinics', {
          body: {
            action: 'generate_bulk_descriptions',
            clinicIds: chunks[i],
            wordCount: selectedWordCount,
          },
        });

        if (error) throw error;

        if (data?.results) {
          for (const result of data.results) {
            addLog({
              clinic: result.name,
              action: result.success ? 'completed' : 'error',
              message: result.success
                ? 'Description generated successfully'
                : `Error: ${result.error || 'Unknown error'}`,
            });
          }
        }

        processedTotal += data?.processed || 0;
        errorsTotal += data?.errors || 0;

        setProgress((prev) =>
          prev
            ? {
                ...prev,
                processed: processedTotal,
                errors: errorsTotal,
              }
            : null
        );

        // small pause to avoid rate-limit spikes
        await new Promise((r) => setTimeout(r, 150));
      }

      setProgress((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              processed: processedTotal,
              errors: errorsTotal,
            }
          : null
      );

      addLog({
        clinic: '',
        action: 'completed',
        message: `Bulk complete! Generated: ${processedTotal}, Errors: ${errorsTotal}`,
      });

      toast.success(`Generated ${processedTotal} descriptions with ${errorsTotal} errors`);

      clearSelection();
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['clinics-needing-description'] });
      queryClient.invalidateQueries({ queryKey: ['all-clinics-enrichment'] });
    } catch (error) {
      console.error('Bulk enrichment error:', error);
      addLog({
        clinic: '',
        action: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      setProgress((prev) => (prev ? { ...prev, status: 'stopped' } : null));
      toast.error('Failed to generate descriptions');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple/10 via-primary/10 to-teal/10 p-6 border border-primary/20">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-purple blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-teal blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple to-primary flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              Clinic Content Enrichment
            </h1>
            <p className="text-muted-foreground mt-2">
              AI-powered description generation and content management
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-primary/30"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clinics</p>
                <p className="text-3xl font-bold text-primary">{clinicStats?.total?.toLocaleString() || 0}</p>
              </div>
              <Building2 className="h-10 w-10 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal/10 to-teal/5 border-teal/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Descriptions</p>
                <p className="text-3xl font-bold text-teal">{clinicStats?.withDescription?.toLocaleString() || 0}</p>
                <p className="text-xs text-coral mt-1">
                  {clinicStats?.noDescription?.toLocaleString() || 0} missing
                </p>
              </div>
              <FileText className="h-10 w-10 text-teal/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple/10 to-purple/5 border-purple/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Images</p>
                <p className="text-3xl font-bold text-purple">{clinicStats?.withImage?.toLocaleString() || 0}</p>
                <p className="text-xs text-coral mt-1">
                  {clinicStats?.noImage?.toLocaleString() || 0} missing
                </p>
              </div>
              <Image className="h-10 w-10 text-purple/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion</p>
                <p className="text-3xl font-bold text-gold">
                  {clinicStats?.total ? Math.round(((clinicStats.withDescription || 0) / clinicStats.total) * 100) : 0}%
                </p>
              </div>
              <Sparkles className="h-10 w-10 text-gold/30" />
            </div>
            <Progress 
              value={clinicStats?.total ? ((clinicStats.withDescription || 0) / clinicStats.total) * 100 : 0} 
              className="mt-3 h-2 [&>div]:bg-gold" 
            />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 h-12">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden md:inline">Quick Actions</span>
          </TabsTrigger>
          <TabsTrigger value="descriptions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">Clinics</span> ({clinicStats?.noDescription || 0})
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden md:inline">Locations</span>
          </TabsTrigger>
          <TabsTrigger value="service-locations" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden md:inline">Services</span>
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            <span className="hidden md:inline">Manage</span>
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden md:inline">Images</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                Batch Enrichment Actions
              </CardTitle>
              <CardDescription>Generate content for multiple clinics at once using AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Generate Descriptions</h3>
                      <p className="text-sm text-muted-foreground">{clinicStats?.noDescription?.toLocaleString() || 0} clinics need descriptions</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use AI to generate unique, professional descriptions for clinics automatically.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {isEnriching ? (
                      <Button variant="destructive" onClick={stopEnrichment} className="flex-1">
                        <StopCircle className="h-4 w-4 mr-2" />
                        Stop
                      </Button>
                    ) : (
                      <>
                        <Button 
                          onClick={() => generateDescriptions(25)} 
                          disabled={(clinicStats?.noDescription || 0) === 0}
                          className="flex-1"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Generate 25
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => generateDescriptions(100)} 
                          disabled={(clinicStats?.noDescription || 0) === 0}
                          className="flex-1"
                        >
                          Generate 100
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-6 border-2 border-dashed border-purple/30 rounded-xl bg-purple/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-xl bg-purple/20 flex items-center justify-center">
                      <Image className="h-6 w-6 text-purple" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Add Placeholder Images</h3>
                      <p className="text-sm text-muted-foreground">{clinicStats?.noImage?.toLocaleString() || 0} clinics need images</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add professional dental clinic placeholder images to all clinics without cover photos.
                  </p>
                  <Button 
                    onClick={addPlaceholderImages} 
                    disabled={(clinicStats?.noImage || 0) === 0}
                    className="w-full bg-purple hover:bg-purple/90"
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Add Images to All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Panel */}
          {progress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {progress.status === 'running' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  {progress.status === 'completed' && <CheckCircle className="h-5 w-5 text-teal" />}
                  {progress.status === 'stopped' && <AlertCircle className="h-5 w-5 text-gold" />}
                  Enrichment Progress
                </CardTitle>
                <CardDescription>
                  {progress.processed} of {progress.total} processed ({progress.errors} errors)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={(progress.processed / progress.total) * 100} className="mb-4 h-3" />
                <ScrollArea className="h-64 border rounded-lg p-4 bg-muted/30">
                  <div className="space-y-2">
                    {progress.logs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {getLogIcon(log.action)}
                        <span className="text-muted-foreground font-mono text-xs">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        {log.clinic && <span className="font-medium">{log.clinic}</span>}
                        <span className="text-muted-foreground">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Location Pages Tab */}
        <TabsContent value="locations" className="space-y-4">
          <LocationEnrichmentSection />
        </TabsContent>

        {/* Service-Location Pages Tab */}
        <TabsContent value="service-locations" className="space-y-4">
          <ServiceLocationEnrichmentSection />
        </TabsContent>

        <TabsContent value="descriptions" className="space-y-4">
          {/* Bulk Action Bar */}
          {selectedClinicIds.size > 0 && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary text-white text-lg px-3 py-1">
                      {selectedClinicIds.size} selected
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Clear Selection
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select 
                      value={selectedWordCount.toString()} 
                      onValueChange={(v) => setSelectedWordCount(Number(v))}
                    >
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
                    <Button 
                      onClick={() => setShowBulkDialog(true)}
                      disabled={isBulkGenerating}
                      className="gap-2 bg-gradient-to-r from-primary to-teal"
                    >
                      {isBulkGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      Generate Descriptions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Clinics Needing Descriptions
                  </CardTitle>
                  <CardDescription>
                    {clinicsNeedingDescription.length.toLocaleString()} clinics without descriptions
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectAllClinics(clinicsNeedingDescription)}
                    className="gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Select All
                  </Button>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clinics..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={clinicsNeedingDescription.length > 0 && selectedClinicIds.size === clinicsNeedingDescription.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllClinics(clinicsNeedingDescription);
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="font-bold">Clinic Name</TableHead>
                      <TableHead className="font-bold">Location</TableHead>
                      <TableHead className="font-bold">Rating</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinicsNeedingDescription.map((clinic) => (
                      <TableRow key={clinic.id} className={`hover:bg-muted/30 ${selectedClinicIds.has(clinic.id) ? 'bg-primary/5' : ''}`}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedClinicIds.has(clinic.id)}
                            onCheckedChange={() => toggleSelectClinic(clinic.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{clinic.name}</TableCell>
                        <TableCell>
                          {clinic.city?.name}{clinic.city?.state?.abbreviation ? `, ${clinic.city.state.abbreviation}` : ''}
                        </TableCell>
                        <TableCell>
                          {clinic.rating ? (
                            <span className="flex items-center gap-1">
                              {clinic.rating} <span className="text-gold">★</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-coral border-coral/50">
                            Missing Description
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleEditClinic(clinic)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Write
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/clinic/${clinic.slug}`} target="_blank">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    All Clinics
                  </CardTitle>
                  <CardDescription>
                    Manage descriptions for all clinics
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clinics..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Clinic Name</TableHead>
                      <TableHead className="font-bold">Location</TableHead>
                      <TableHead className="font-bold">Description</TableHead>
                      <TableHead className="font-bold">Image</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allClinics.map((clinic) => (
                      <TableRow key={clinic.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{clinic.name}</TableCell>
                        <TableCell>
                          {clinic.city?.name}{clinic.city?.state?.abbreviation ? `, ${clinic.city.state.abbreviation}` : ''}
                        </TableCell>
                        <TableCell>
                          {clinic.description ? (
                            <Badge className="bg-teal/20 text-teal border-0">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Has Description
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-coral border-coral/50">
                              Missing
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {clinic.cover_image_url ? (
                            <Badge className="bg-purple/20 text-purple border-0">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Has Image
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-coral border-coral/50">
                              Missing
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleEditClinic(clinic)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/clinic/${clinic.slug}`} target="_blank">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-purple" />
                Image Management
              </CardTitle>
              <CardDescription>
                {clinicStats?.noImage?.toLocaleString() || 0} clinics without images
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 bg-muted/30 rounded-xl">
                <Image className="h-20 w-20 mx-auto text-muted-foreground/30 mb-6" />
                <h3 className="text-xl font-bold mb-2">Add Placeholder Images</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Click the button below to add professional dental clinic placeholder images to all clinics without cover photos. These are high-quality, royalty-free images.
                </p>
                <Button 
                  size="lg" 
                  onClick={addPlaceholderImages} 
                  disabled={(clinicStats?.noImage || 0) === 0}
                  className="bg-purple hover:bg-purple/90"
                >
                  <Image className="h-5 w-5 mr-2" />
                  Add Placeholder Images ({clinicStats?.noImage?.toLocaleString() || 0} clinics)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Description Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit Description
            </DialogTitle>
            <DialogDescription>
              {selectedClinic?.name} • {selectedClinic?.city?.name}{selectedClinic?.city?.state?.abbreviation ? `, ${selectedClinic.city.state.abbreviation}` : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={generateSingleDescription}
                disabled={isGeneratingAI}
              >
                {isGeneratingAI ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Generate with AI
              </Button>
            </div>
            <Textarea
              placeholder="Enter clinic description..."
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              {editDescription.length} characters
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveDescription}
              disabled={updateDescriptionMutation.isPending || !editDescription.trim()}
            >
              {updateDescriptionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Description
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Generation Confirmation Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Generate Descriptions
            </DialogTitle>
            <DialogDescription>
              You are about to generate AI descriptions for {selectedClinicIds.size} clinic(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Clinics Selected:</span>
                <Badge className="bg-primary">{selectedClinicIds.size}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Word Count Target:</span>
                <Badge variant="outline">{selectedWordCount} words</Badge>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> This will use AI to generate unique, professional descriptions for each selected clinic. 
                The process may take a few minutes depending on the number of clinics.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkGenerate}
              className="gap-2 bg-gradient-to-r from-primary to-teal"
            >
              <Sparkles className="h-4 w-4" />
              Start Generation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
