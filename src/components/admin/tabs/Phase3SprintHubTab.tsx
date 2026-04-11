import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ACTIVE_STATE_SLUGS } from '@/lib/constants/activeStates';
import { 
  BookOpen, MapPin, Wrench, Mail, Play, Pause, CheckCircle, 
  Clock, FileText, BarChart3, Loader2, Target, Sparkles,
  ChevronRight, Eye, AlertCircle, RefreshCw, Layers, Filter,
  Send, Users, Calculator, Shield, Zap, TrendingUp, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ============================================================
// PHASE 3: ADVANCED CONTENT & LINK BUILDING (Weeks 13-24)
// ============================================================

// Sprint 3.1: Content Scaling (100+ blog posts)
const SPRINT_3_1_CATEGORIES = {
  'informational': {
    name: 'Informational Deep Dives',
    weeks: 'Week 13-16',
    targetCount: 16,
    targetWordCount: 2000,
    templates: [
      'What to Expect During Your First [Specialty] Visit',
      'Complete Guide to [Procedure]: Process, Cost, Recovery',
    ],
  },
  'problem-solving': {
    name: 'Problem-Solving Content',
    weeks: 'Week 17-20',
    targetCount: 12,
    targetWordCount: 1500,
    templates: [
      'Toothache Relief', 'Crown Falls Off', 'Root Canal Signs',
      'Bleeding After Extraction', 'Wisdom Tooth Pain', 'Dental Abscess',
      'Broken Tooth Repair', 'Gum Disease Stages', 'Sensitive Teeth',
      'Dental Numbness', 'Bridge Fell Out', 'Post-Root Canal Care',
    ],
  },
  'insurance': {
    name: 'Insurance & Financial',
    weeks: 'Week 21-24',
    targetCount: 20,
    targetWordCount: 1800,
    templates: [
      'Cigna Coverage', 'Aetna Coverage', 'Delta Dental Coverage',
      'MetLife Coverage', 'United Healthcare Coverage', 'Dental Financing',
      'CareCredit Worth It', 'HSA FSA Guide',
    ],
  },
};

// Sprint 3.2: Neighborhood Pages
const NEIGHBORHOOD_TARGETS = {
  'los-angeles': ['hollywood', 'santa-monica', 'beverly-hills', 'downtown', 'pasadena', 'long-beach', 'venice', 'west-hollywood', 'silver-lake', 'los-feliz', 'culver-city', 'marina-del-rey', 'westwood', 'brentwood', 'century-city'],
  'san-francisco': ['financial-district', 'soma', 'mission-district', 'castro', 'pacific-heights', 'nob-hill', 'russian-hill', 'marina', 'haight-ashbury', 'sunset', 'richmond', 'presidio'],
  'boston': ['back-bay', 'beacon-hill', 'north-end', 'south-end', 'fenway', 'cambridge', 'brookline', 'jamaica-plain', 'somerville', 'allston'],
  'san-diego': ['downtown', 'la-jolla', 'pacific-beach', 'ocean-beach', 'hillcrest', 'north-park', 'gaslamp', 'del-mar'],
  'san-jose': ['downtown', 'willow-glen', 'almaden', 'evergreen', 'campbell', 'santa-clara', 'cupertino', 'sunnyvale'],
};

// Sprint 3.3: Free Tools & Outreach
const FREE_TOOLS = [
  { id: 'cost-calculator', name: 'Dental Cost Calculator', url: '/tools/dental-cost-calculator', icon: Calculator },
  { id: 'insurance-checker', name: 'Insurance Coverage Checker', url: '/tools/insurance-checker', icon: Shield },
  { id: 'emergency-finder', name: 'Emergency Dentist Finder', url: '/emergency-dentist', icon: Zap },
];

interface GenerationJob {
  id: string;
  status: 'running' | 'completed' | 'stopped' | 'error';
  total: number;
  processed: number;
  success: number;
  errors: number;
  currentItem?: string;
  logs: { timestamp: Date; item: string; action: string; message: string }[];
  startedAt: Date;
}

interface OutreachCampaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  totalRecipients: number;
  sent: number;
  opened: number;
  claimed: number;
  createdAt: Date;
}

export default function Phase3SprintHubTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'content' | 'neighborhoods' | 'tools' | 'outreach'>('content');
  const [selectedCategory, setSelectedCategory] = useState<string>('informational');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Generation state
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const stopFlagRef = useRef(false);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  // Outreach state
  const [showOutreachDialog, setShowOutreachDialog] = useState(false);
  const [outreachEmailType, setOutreachEmailType] = useState<'claim' | 'followup' | 'final'>('claim');

  // Auto-scroll logs
  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [currentJob?.logs]);

  // Fetch blog posts for content scaling
  const { data: blogPosts, isLoading: postsLoading, refetch: refetchPosts } = useQuery({
    queryKey: ['phase3-blog-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, slug, title, content, category, status, tags, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch neighborhood pages
  const { data: neighborhoodPages, refetch: refetchNeighborhoods } = useQuery({
    queryKey: ['phase3-neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_pages')
        .select('id, slug, page_type, h1, word_count, updated_at')
        .eq('page_type', 'neighborhood')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch outreach campaigns
  const { data: outreachCampaigns, refetch: refetchOutreach } = useQuery({
    queryKey: ['phase3-outreach'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  // Fetch unclaimed clinics for outreach
  const { data: unclaimedClinics } = useQuery({
    queryKey: ['unclaimed-clinics-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('clinics')
        .select('id', { count: 'exact', head: true })
        .eq('claim_status', 'unclaimed')
        .not('email', 'is', null);
      if (error) return 0;
      return count || 0;
    },
  });

  // Calculate stats
  const contentStats = useMemo(() => {
    if (!blogPosts) return null;
    const categoryDef = SPRINT_3_1_CATEGORIES[selectedCategory as keyof typeof SPRINT_3_1_CATEGORIES];
    const categoryPosts = blogPosts.filter(p => p.category === selectedCategory);
    return {
      total: categoryPosts.length,
      target: categoryDef.targetCount,
      published: categoryPosts.filter(p => p.status === 'published').length,
      draft: categoryPosts.filter(p => p.status === 'draft').length,
    };
  }, [blogPosts, selectedCategory]);

  const neighborhoodStats = useMemo(() => {
    const totalTarget = Object.values(NEIGHBORHOOD_TARGETS).flat().length;
    const created = neighborhoodPages?.length || 0;
    const withContent = neighborhoodPages?.filter(p => (p.word_count || 0) >= 1500).length || 0;
    return { totalTarget, created, withContent };
  }, [neighborhoodPages]);

  // Add log entry
  const addLog = (log: Omit<GenerationJob['logs'][0], 'timestamp'>) => {
    setCurrentJob(prev => prev ? {
      ...prev,
      logs: [...prev.logs, { ...log, timestamp: new Date() }],
    } : null);
  };

  // Stop generation
  const stopGeneration = () => {
    stopFlagRef.current = true;
    toast.info('Stopping generation...');
  };

  // Generate blog content
  const startBlogGeneration = async (templates: string[]) => {
    if (templates.length === 0) {
      toast.error('Select at least one template');
      return;
    }

    setIsGenerating(true);
    stopFlagRef.current = false;

    const jobId = `phase3_content_${Date.now()}`;
    setCurrentJob({
      id: jobId,
      status: 'running',
      total: templates.length,
      processed: 0,
      success: 0,
      errors: 0,
      logs: [],
      startedAt: new Date(),
    });

    addLog({ item: '', action: 'started', message: `Starting Phase 3 content generation for ${templates.length} posts...` });

    let success = 0;
    let errors = 0;

    for (let i = 0; i < templates.length; i++) {
      if (stopFlagRef.current) {
        addLog({ item: '', action: 'stopped', message: 'Generation stopped by user.' });
        setCurrentJob(prev => prev ? { ...prev, status: 'stopped' } : null);
        break;
      }

      const template = templates[i];
      setCurrentJob(prev => prev ? { ...prev, processed: i, currentItem: template } : null);
      addLog({ item: template, action: 'generating', message: 'Generating content...' });

      try {
        const { data, error } = await supabase.functions.invoke('phase3-content-generator', {
          body: {
            action: 'generate-blog',
            category: selectedCategory,
            template,
            target_word_count: SPRINT_3_1_CATEGORIES[selectedCategory as keyof typeof SPRINT_3_1_CATEGORIES].targetWordCount,
          },
        });

        if (error) throw error;

        success++;
        addLog({ item: template, action: 'completed', message: `✓ Generated ${data?.word_count || 'N/A'} words` });
      } catch (err) {
        errors++;
        addLog({ item: template, action: 'error', message: `✗ ${err instanceof Error ? err.message : 'Unknown error'}` });
      }

      setCurrentJob(prev => prev ? { ...prev, processed: i + 1, success, errors } : null);

      if (i < templates.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!stopFlagRef.current) {
      setCurrentJob(prev => prev ? { ...prev, status: 'completed' } : null);
      addLog({ item: '', action: 'completed', message: `Complete: ${success} success, ${errors} errors` });
      toast.success(`Generated ${success} blog posts`);
    }

    setIsGenerating(false);
    refetchPosts();
  };

  // Generate neighborhood pages
  const generateNeighborhoods = async (city: string) => {
    const neighborhoods = NEIGHBORHOOD_TARGETS[city as keyof typeof NEIGHBORHOOD_TARGETS] || [];
    if (neighborhoods.length === 0) {
      toast.error('No neighborhoods defined for this city');
      return;
    }

    setIsGenerating(true);
    stopFlagRef.current = false;

    const jobId = `phase3_neighborhoods_${Date.now()}`;
    setCurrentJob({
      id: jobId,
      status: 'running',
      total: neighborhoods.length,
      processed: 0,
      success: 0,
      errors: 0,
      logs: [],
      startedAt: new Date(),
    });

    addLog({ item: '', action: 'started', message: `Creating ${neighborhoods.length} neighborhood pages for ${city}...` });

    let success = 0;
    let errors = 0;

    for (let i = 0; i < neighborhoods.length; i++) {
      if (stopFlagRef.current) {
        addLog({ item: '', action: 'stopped', message: 'Generation stopped.' });
        setCurrentJob(prev => prev ? { ...prev, status: 'stopped' } : null);
        break;
      }

      const neighborhood = neighborhoods[i];
      setCurrentJob(prev => prev ? { ...prev, processed: i, currentItem: neighborhood } : null);
      addLog({ item: neighborhood, action: 'generating', message: 'Creating page...' });

      try {
        const { data, error } = await supabase.functions.invoke('phase3-content-generator', {
          body: {
            action: 'generate-neighborhood',
            city,
            neighborhood,
            target_word_count: 1800,
          },
        });

        if (error) throw error;

        success++;
        addLog({ item: neighborhood, action: 'completed', message: `✓ Created with ${data?.word_count || 'N/A'} words` });
      } catch (err) {
        errors++;
        addLog({ item: neighborhood, action: 'error', message: `✗ ${err instanceof Error ? err.message : 'Unknown error'}` });
      }

      setCurrentJob(prev => prev ? { ...prev, processed: i + 1, success, errors } : null);

      if (i < neighborhoods.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!stopFlagRef.current) {
      setCurrentJob(prev => prev ? { ...prev, status: 'completed' } : null);
      addLog({ item: '', action: 'completed', message: `Complete: ${success} pages created` });
      toast.success(`Created ${success} neighborhood pages`);
    }

    setIsGenerating(false);
    refetchNeighborhoods();
  };

  // Launch outreach campaign
  const launchOutreachCampaign = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('phase3-outreach', {
        body: {
          action: 'create-campaign',
          emailType: outreachEmailType,
          targetFilter: { claim_status: 'unclaimed', has_email: true },
        },
      });

      if (error) throw error;

      toast.success(`Campaign created! ${data?.recipientCount || 0} recipients queued.`);
      setShowOutreachDialog(false);
      refetchOutreach();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Phase 3: Advanced Content & Link Building
          </h2>
          <p className="text-muted-foreground">Weeks 13-24: Content scaling, neighborhood pages, tools & outreach</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchPosts(); refetchNeighborhoods(); refetchOutreach(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Content Scaling
          </TabsTrigger>
          <TabsTrigger value="neighborhoods" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Neighborhoods
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Free Tools
          </TabsTrigger>
          <TabsTrigger value="outreach" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Outreach
          </TabsTrigger>
        </TabsList>

        {/* Sprint 3.1: Content Scaling */}
        <TabsContent value="content" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Selector */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Content Categories</CardTitle>
                  <CardDescription>Sprint 3.1: Scale to 100+ blog posts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(SPRINT_3_1_CATEGORIES).map(([key, cat]) => (
                    <div
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCategory === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">{cat.weeks}</p>
                        </div>
                        <Badge variant="outline">{cat.targetCount} posts</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {contentStats && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Completion</span>
                      <span>{Math.round((contentStats.published / contentStats.target) * 100)}%</span>
                    </div>
                    <Progress value={(contentStats.published / contentStats.target) * 100} />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        Published: {contentStats.published}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        Draft: {contentStats.draft}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Templates List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {SPRINT_3_1_CATEGORIES[selectedCategory as keyof typeof SPRINT_3_1_CATEGORIES]?.name}
                  </CardTitle>
                  <CardDescription>Select templates to generate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {SPRINT_3_1_CATEGORIES[selectedCategory as keyof typeof SPRINT_3_1_CATEGORIES]?.templates.map((template, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                        <Checkbox
                          checked={selectedItems.includes(template)}
                          onCheckedChange={(checked) => {
                            setSelectedItems(prev =>
                              checked ? [...prev, template] : prev.filter(t => t !== template)
                            );
                          }}
                        />
                        <span className="text-sm">{template}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedItems(SPRINT_3_1_CATEGORIES[selectedCategory as keyof typeof SPRINT_3_1_CATEGORIES]?.templates || [])}
                    >
                      Select All
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedItems([])}>
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => startBlogGeneration(selectedItems)}
                      disabled={isGenerating || selectedItems.length === 0}
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                      Generate {selectedItems.length} Posts
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Generation Logs */}
              {currentJob && (
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {currentJob.status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                        {currentJob.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        Generation Log
                      </CardTitle>
                      {currentJob.status === 'running' && (
                        <Button size="sm" variant="destructive" onClick={stopGeneration}>
                          <Pause className="h-4 w-4 mr-1" /> Stop
                        </Button>
                      )}
                    </div>
                    <Progress value={(currentJob.processed / currentJob.total) * 100} className="mt-2" />
                  </CardHeader>
                  <CardContent>
                    <ScrollArea ref={logsScrollRef} className="h-48">
                      <div className="space-y-1 font-mono text-xs">
                        {currentJob.logs.map((log, i) => (
                          <div key={i} className={`${log.action === 'error' ? 'text-red-400' : log.action === 'completed' ? 'text-green-400' : 'text-muted-foreground'}`}>
                            [{format(log.timestamp, 'HH:mm:ss')}] {log.item && `[${log.item}] `}{log.message}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Sprint 3.2: Neighborhood Pages */}
        <TabsContent value="neighborhoods" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Neighborhood Progress</CardTitle>
                <CardDescription>150-200 micro-local pages target</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Created</span>
                  <span>{neighborhoodStats.created}/{neighborhoodStats.totalTarget}</span>
                </div>
                <Progress value={(neighborhoodStats.created / neighborhoodStats.totalTarget) * 100} />
                <div className="flex justify-between text-sm">
                  <span>With Content (1,500+ words)</span>
                  <span>{neighborhoodStats.withContent}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Generate by City</CardTitle>
                <CardDescription>Create neighborhood pages for top cities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(NEIGHBORHOOD_TARGETS).map(([city, neighborhoods]) => (
                    <div key={city} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium capitalize">{city.replace(/-/g, ' ')}</p>
                        <Badge variant="outline">{neighborhoods.length}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => generateNeighborhoods(city)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        Generate
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sprint 3.3: Free Tools - Management Panel */}
        <TabsContent value="tools" className="mt-6 space-y-6">
          {/* Tool Cards with Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FREE_TOOLS.map(tool => (
              <Card key={tool.id} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <tool.icon className="h-5 w-5 text-primary" />
                      </div>
                      {tool.name}
                    </CardTitle>
                    <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px]">
                      Live
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs mt-1">{tool.url}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Indicators */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/50 rounded-lg text-center">
                      <p className="text-lg font-bold text-foreground">Active</p>
                      <p className="text-[10px] text-muted-foreground">Status</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-lg text-center">
                      <p className="text-lg font-bold text-foreground">SEO</p>
                      <p className="text-[10px] text-muted-foreground">Indexed</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="w-full justify-start" asChild>
                      <a href={tool.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-2" /> Preview Tool
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start" asChild>
                      <a href={`${tool.url}?admin_edit=true`} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-3.5 w-3.5 mr-2" /> Edit Content
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tool SEO & Performance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Tool Performance & Configuration
              </CardTitle>
              <CardDescription>Monitor and configure interactive SEO tools</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SEO Title</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FREE_TOOLS.map(tool => (
                    <TableRow key={tool.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <tool.icon className="h-4 w-4 text-primary" />
                          {tool.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tool.url}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">Live</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {tool.id === 'cost-calculator' && 'Dental Cost Calculator | Estimate Procedure Costs'}
                        {tool.id === 'insurance-checker' && 'Insurance Coverage Checker | Verify Dental Coverage'}
                        {tool.id === 'emergency-finder' && 'Emergency Dentist Near Me | 24/7 Dental Care'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">WebApplication</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                            <a href={tool.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Link Building Targets */}
          <Card>
            <CardHeader>
              <CardTitle>Tool Link Building Targets</CardTitle>
              <CardDescription>Expected: 30-50 links from .edu, .gov, .org</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">200</p>
                  <p className="text-sm text-muted-foreground">Outreach Targets</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-500">0</p>
                  <p className="text-sm text-muted-foreground">Links Acquired</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">.edu Links</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">.gov Links</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sprint 3.3: Outreach System */}
        <TabsContent value="outreach" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Dentist Partnership
                </CardTitle>
                <CardDescription>Automated email campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-3xl font-bold">{unclaimedClinics?.toLocaleString() || 0}</p>
                  <p className="text-sm text-muted-foreground">Unclaimed Clinics with Email</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Target Claim Rate</span>
                    <span>10-15%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Expected Backlinks</span>
                    <span>660-990</span>
                  </div>
                </div>

                <Button className="w-full" onClick={() => setShowOutreachDialog(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Launch Campaign
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Active Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                {outreachCampaigns && outreachCampaigns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead>Claimed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outreachCampaigns.map((campaign: any) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            <Badge variant={campaign.is_active ? 'default' : 'secondary'}>
                              {campaign.is_active ? 'Active' : 'Paused'}
                            </Badge>
                          </TableCell>
                          <TableCell>{campaign.stats?.sent || 0}</TableCell>
                          <TableCell>{campaign.stats?.opened || 0}</TableCell>
                          <TableCell>{campaign.stats?.claimed || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No active campaigns</p>
                    <p className="text-sm">Launch your first dentist partnership campaign</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Outreach Campaign Dialog */}
      <Dialog open={showOutreachDialog} onOpenChange={setShowOutreachDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch Outreach Campaign</DialogTitle>
            <DialogDescription>
              Send automated emails to unclaimed clinics inviting them to claim their profiles.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Email Type</Label>
              <Select value={outreachEmailType} onValueChange={(v) => setOutreachEmailType(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claim">Initial Claim Invitation</SelectItem>
                  <SelectItem value="followup">Follow-up (7 days)</SelectItem>
                  <SelectItem value="final">Final Reminder (14 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Recipients</p>
              <p className="text-2xl font-bold">{unclaimedClinics?.toLocaleString() || 0}</p>
              <p className="text-xs text-muted-foreground">Unclaimed clinics with valid email</p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-400">
                ⚠️ This will queue emails for all eligible recipients. Emails are sent gradually to avoid rate limits.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutreachDialog(false)}>
              Cancel
            </Button>
            <Button onClick={launchOutreachCampaign}>
              <Send className="h-4 w-4 mr-2" />
              Launch Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
