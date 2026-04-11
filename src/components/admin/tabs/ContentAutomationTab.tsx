'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Bot, Zap, Play, Pause, Plus, Edit, Trash2, Clock, Calendar, Settings,
  Activity, CheckCircle, XCircle, AlertTriangle, TrendingUp, RefreshCw,
  Search, FileSearch, Timer, Loader2, Lightbulb, Target, Globe, MapPin,
  Stethoscope, Rss, Send, Eye, Link2, Brain, Sparkles, ArrowRight,
  ChevronRight, BookOpen, FileText, Database, SendHorizontal
} from 'lucide-react';
import { format, formatDistanceToNow, addHours, addDays } from 'date-fns';
import { toast } from 'sonner';

type AutomationJob = {
  id: string;
  name: string;
  type: 'topic_research' | 'content_generation' | 'interlinking' | 'scheduled_post';
  status: 'idle' | 'running' | 'completed' | 'failed';
  schedule_type: 'manual' | 'hourly' | 'daily' | 'weekly';
  schedule_interval?: number;
  last_run_at: string | null;
  next_run_at: string | null;
  config: Record<string, any>;
  results?: {
    topics_researched?: number;
    content_generated?: number;
    links_created?: number;
    posts_published?: number;
  };
  created_at: string;
};

type TopicSuggestion = {
  id: string;
  topic: string;
  category: string;
  keywords: string[];
  search_volume?: string;
  difficulty?: string;
  interlinking_targets: string[];
  suggested_links: { slug: string; title: string; page_type: string }[];
  status: 'pending' | 'researching' | 'generating' | 'ready' | 'published' | 'failed';
  generated_content?: string;
};

type InterlinkingRule = {
  id: string;
  source_type: 'blog' | 'location' | 'service';
  target_type: 'city' | 'state' | 'service' | 'service_location';
  pattern: string;
  is_active: boolean;
};

export default function ContentAutomationTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AutomationJob | null>(null);
  
  // New job form
  const [jobForm, setJobForm] = useState({
    name: '',
    type: 'content_generation' as AutomationJob['type'],
    schedule_type: 'manual' as AutomationJob['schedule_type'],
    schedule_interval: 24,
    target_count: 5,
    include_location_specific: true,
    include_service_specific: true,
    auto_publish: false
  });
  
  // Topic form
  const [topicQuery, setTopicQuery] = useState('');
  const [researchedTopics, setResearchedTopics] = useState<TopicSuggestion[]>([]);
  
  // Fetch automation jobs
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['content-automation-jobs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('content_automation_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AutomationJob[];
    }
  });
  
  // Fetch topic suggestions
  const { data: topicSuggestions } = useQuery({
    queryKey: ['topic-suggestions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('topic_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as TopicSuggestion[];
    }
  });
  
  // Fetch interlinking rules
  const { data: interlinkingRules } = useQuery({
    queryKey: ['interlinking-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('interlinking_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InterlinkingRule[];
    }
  });
  
  // Fetch page stats for interlinking
  const { data: pageStats } = useQuery({
    queryKey: ['seo-pages-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('seo_pages')
        .select('page_type');
      if (error) throw error;
      
      const stats = {
        city: 0,
        state: 0,
        treatment: 0,
        service_location: 0
      };
      
      data?.forEach(page => {
        if (page.page_type in stats) {
          stats[page.page_type as keyof typeof stats]++;
        }
      });
      
      return stats;
    }
  });
  
  // Research topics with AI
  const researchTopics = async () => {
    if (!topicQuery.trim()) {
      toast.error('Please enter a topic or keyword to research');
      return;
    }
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('topic-research-automation', {
        body: {
          action: 'research_topics',
          seed_topic: topicQuery,
          count: 10
        }
      });
      
      if (error) throw error;
      
      const topics: TopicSuggestion[] = (data.topics || []).map((topic: any, idx: number) => ({
        id: `topic-${Date.now()}-${idx}`,
        topic: topic.title,
        category: topic.category,
        keywords: topic.keywords || [],
        interlinking_targets: topic.interlinking_targets || [],
        suggested_links: topic.suggested_links || [],
        status: 'pending' as const
      }));
      
      setResearchedTopics(topics);
      toast.success(`Researched ${topics.length} topic suggestions`);
    } catch (error: any) {
      toast.error(`Research failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Generate content for a topic
  const generateContent = async (topic: TopicSuggestion) => {
    setResearchedTopics(prev => 
      prev.map(t => t.id === topic.id ? { ...t, status: 'generating' as const } : t)
    );
    
    try {
      const { data, error } = await supabase.functions.invoke('content-automation', {
        body: {
          action: 'generate_content',
          topic: topic.topic,
          category: topic.category,
          keywords: topic.keywords,
          suggested_links: topic.suggested_links
        }
      });
      
      if (error) throw error;
      
      setResearchedTopics(prev => 
        prev.map(t => t.id === topic.id ? { 
          ...t, 
          status: 'ready' as const,
          generated_content: data.content 
        } : t)
      );
      
      toast.success('Content generated successfully');
    } catch (error: any) {
      setResearchedTopics(prev => 
        prev.map(t => t.id === topic.id ? { ...t, status: 'failed' as const } : t)
      );
      toast.error(`Generation failed: ${error.message}`);
    }
  };
  
  // Publish content
  const publishContent = async (topic: TopicSuggestion) => {
    if (!topic.generated_content) {
      toast.error('No content to publish. Generate content first.');
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('content-automation', {
        body: {
          action: 'publish_blog',
          title: topic.topic,
          content: topic.generated_content,
          category: topic.category,
          keywords: topic.keywords,
          internal_links: topic.suggested_links
        }
      });
      
      if (error) throw error;
      
      setResearchedTopics(prev => 
        prev.map(t => t.id === topic.id ? { ...t, status: 'published' as const } : t)
      );
      
      toast.success('Blog post published successfully');
    } catch (error: any) {
      toast.error(`Publish failed: ${error.message}`);
    }
  };
  
  // Create automation job
  const createJob = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('content_automation_jobs')
        .insert([{
          name: jobForm.name,
          type: jobForm.type,
          schedule_type: jobForm.schedule_type,
          schedule_interval: jobForm.schedule_interval,
          config: {
            target_count: jobForm.target_count,
            include_location_specific: jobForm.include_location_specific,
            include_service_specific: jobForm.include_service_specific,
            auto_publish: jobForm.auto_publish
          },
          status: 'idle',
          results: {}
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      toast.success('Automation job created');
      setIsCreatingJob(false);
      refetchJobs();
    } catch (error: any) {
      toast.error(`Failed to create job: ${error.message}`);
    }
  };
  
  // Run job
  const runJob = async (job: AutomationJob) => {
    try {
      const { error } = await supabase.functions.invoke('content-automation', {
        body: {
          action: 'run_job',
          job_id: job.id
        }
      });
      
      if (error) throw error;
      
      toast.success('Automation job started');
      refetchJobs();
    } catch (error: any) {
      toast.error(`Failed to run job: ${error.message}`);
    }
  };
  
  // Stats
  const stats = useMemo(() => ({
    totalJobs: jobs?.length || 0,
    activeJobs: jobs?.filter(j => j.status === 'running').length || 0,
    topicsResearched: topicSuggestions?.length || 0,
    pendingTopics: topicSuggestions?.filter(t => t.status === 'pending').length || 0
  }), [jobs, topicSuggestions]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Content Automation
          </h2>
          <p className="text-muted-foreground">
            Automated topic research, content generation, and smart interlinking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchJobs()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreatingJob(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Automation Job
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.totalJobs}</div>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.activeJobs}</div>
                <p className="text-xs text-muted-foreground">Active Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{stats.topicsResearched}</div>
                <p className="text-xs text-muted-foreground">Topics Researched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{stats.pendingTopics}</div>
                <p className="text-xs text-muted-foreground">Pending Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="research">Topic Research</TabsTrigger>
          <TabsTrigger value="jobs">Automation Jobs</TabsTrigger>
          <TabsTrigger value="interlinking">Interlinking</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" onClick={() => setActiveTab('research')}>
                  <Brain className="h-4 w-4 mr-2" />
                  Research New Topics
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setIsCreatingJob(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Automation Job
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('interlinking')}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Configure Interlinking
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>
            
            {/* Interlinking Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Pages Available for Interlinking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">State Pages</span>
                    <span className="ml-auto font-bold">{pageStats?.state || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span className="text-sm">City Pages</span>
                    <span className="ml-auto font-bold">{pageStats?.city || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Service Pages</span>
                    <span className="ml-auto font-bold">{pageStats?.treatment || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Service + Location</span>
                    <span className="ml-auto font-bold">{pageStats?.service_location || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {jobsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : jobs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No automation jobs yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs?.slice(0, 10).map(job => (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={job.status === 'running' ? 'default' : 'outline'}>
                            {job.status}
                          </Badge>
                          <div>
                            <div className="font-medium">{job.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {job.type.replace('_', ' ')} • {job.schedule_type}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {job.last_run_at && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true })}
                            </span>
                          )}
                          {job.status === 'idle' && (
                            <Button size="sm" variant="outline" onClick={() => runJob(job)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Topic Research Tab */}
        <TabsContent value="research" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Topic Research
              </CardTitle>
              <CardDescription>
                Enter a seed topic and let AI research related topics, keywords, and interlinking opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Enter a seed topic (e.g., 'dental implants', 'teeth whitening', 'dental care')"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={researchTopics} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Researching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Research Topics
                    </>
                  )}
                </Button>
              </div>
              
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Smart Interlinking</AlertTitle>
                <AlertDescription>
                  AI will analyze your existing pages and suggest interlinking targets based on content relevance.
                  Location-specific topics will link to city/service pages, while general topics will link to service pages.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          {/* Researched Topics */}
          {researchedTopics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Researched Topics ({researchedTopics.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {researchedTopics.map((topic, idx) => (
                    <AccordionItem key={topic.id} value={topic.id}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-3 w-full pr-4">
                          <Badge variant="outline">{idx + 1}</Badge>
                          <span className="flex-1 text-left">{topic.topic}</span>
                          <Badge
                            variant={
                              topic.status === 'ready' ? 'default' :
                              topic.status === 'generating' ? 'secondary' :
                              topic.status === 'published' ? 'default' :
                              topic.status === 'failed' ? 'destructive' : 'outline'
                            }
                          >
                            {topic.status}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pl-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{topic.category}</Badge>
                            {topic.keywords.slice(0, 5).map((kw, i) => (
                              <Badge key={i} variant="outline">{kw}</Badge>
                            ))}
                          </div>
                          
                          {topic.suggested_links.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Link2 className="h-4 w-4" />
                                Suggested Internal Links
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {topic.suggested_links.map((link, i) => (
                                  <Badge key={i} variant="secondary">
                                    {link.page_type}: /{link.slug}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {topic.status === 'pending' && (
                              <Button size="sm" onClick={() => generateContent(topic)}>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate Content
                              </Button>
                            )}
                            {topic.status === 'generating' && (
                              <Button size="sm" disabled>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </Button>
                            )}
                            {topic.status === 'ready' && (
                              <Button size="sm" onClick={() => publishContent(topic)}>
                                <SendHorizontal className="h-4 w-4 mr-2" />
                                Publish Blog Post
                              </Button>
                            )}
                            {topic.status === 'failed' && (
                              <Button size="sm" variant="outline" onClick={() => generateContent(topic)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry
                              </Button>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
          
          {/* Pending Topics from DB */}
          {topicSuggestions && topicSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Topic Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {topicSuggestions.map(topic => (
                      <div key={topic.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{topic.topic}</div>
                          <div className="text-xs text-muted-foreground">{topic.category}</div>
                        </div>
                        <Button size="sm" variant="outline">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Automation Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {jobsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : jobs?.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No automation jobs configured</p>
                    <Button className="mt-4" onClick={() => setIsCreatingJob(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Job
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs?.map(job => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.type.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{job.schedule_type}</Badge>
                            {job.schedule_interval && (
                              <span className="text-xs text-muted-foreground ml-2">
                                Every {job.schedule_interval}h
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={job.status === 'running' ? 'default' : job.status === 'failed' ? 'destructive' : 'outline'}
                            >
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {job.last_run_at
                              ? formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true })
                              : 'Never'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {job.status === 'idle' && (
                                <Button size="sm" variant="outline" onClick={() => runJob(job)}>
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Interlinking Tab */}
        <TabsContent value="interlinking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Smart Interlinking Rules
              </CardTitle>
              <CardDescription>
                Configure how blog content links to location and service pages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Interlinking Strategy</AlertTitle>
                <AlertDescription>
                  Location-specific blog posts will automatically link to city and service+location pages.
                  General dental blog posts will link to service directory pages.
                  The system analyzes content to determine the best linking targets.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Location-Based Interlinking</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span>Blog mentions "Los Angeles dental"</span>
                      <ArrowRight className="h-4 w-4 mx-2" />
                      <Badge variant="outline">/ca/los-angeles, /ca/los-angeles/dental-implants</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span>Blog mentions "Boston dentist"</span>
                      <ArrowRight className="h-4 w-4 mx-2" />
                      <Badge variant="outline">/ma/boston, /ma/boston/teeth-whitening</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold">Service-Based Interlinking</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span>Blog about "dental implants"</span>
                      <ArrowRight className="h-4 w-4 mx-2" />
                      <Badge variant="outline">/dental-implants, /dental-implants/cost</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span>Blog about "teeth whitening"</span>
                      <ArrowRight className="h-4 w-4 mx-2" />
                      <Badge variant="outline">/teeth-whitening, /teeth-whitening/near-me</Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="font-semibold mb-4">Available Linking Targets</h4>
                <div className="grid grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">States</span>
                    </div>
                    <div className="text-2xl font-bold">{pageStats?.state || 0}</div>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Cities</span>
                    </div>
                    <div className="text-2xl font-bold">{pageStats?.city || 0}</div>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Stethoscope className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Services</span>
                    </div>
                    <div className="text-2xl font-bold">{pageStats?.treatment || 0}</div>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Combined</span>
                    </div>
                    <div className="text-2xl font-bold">{pageStats?.service_location || 0}</div>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create Job Dialog */}
      <Dialog open={isCreatingJob} onOpenChange={setIsCreatingJob}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Automation Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Job Name</Label>
              <Input
                value={jobForm.name}
                onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })}
                placeholder="e.g., Weekly Dental Tips Blog"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Job Type</Label>
              <Select
                value={jobForm.type}
                onValueChange={(v) => setJobForm({ ...jobForm, type: v as AutomationJob['type'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="topic_research">Topic Research</SelectItem>
                  <SelectItem value="content_generation">Content Generation</SelectItem>
                  <SelectItem value="interlinking">Smart Interlinking</SelectItem>
                  <SelectItem value="scheduled_post">Scheduled Blog Posts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select
                value={jobForm.schedule_type}
                onValueChange={(v) => setJobForm({ ...jobForm, schedule_type: v as AutomationJob['schedule_type'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {jobForm.schedule_type !== 'manual' && (
              <div className="space-y-2">
                <Label>Run Every (hours)</Label>
                <Input
                  type="number"
                  value={jobForm.schedule_interval}
                  onChange={(e) => setJobForm({ ...jobForm, schedule_interval: parseInt(e.target.value) || 24 })}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Target Content Count</Label>
              <Input
                type="number"
                value={jobForm.target_count}
                onChange={(e) => setJobForm({ ...jobForm, target_count: parseInt(e.target.value) || 5 })}
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="location-specific"
                  checked={jobForm.include_location_specific}
                  onCheckedChange={(v) => setJobForm({ ...jobForm, include_location_specific: !!v })}
                />
                <Label htmlFor="location-specific">Include location-specific content</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="service-specific"
                  checked={jobForm.include_service_specific}
                  onCheckedChange={(v) => setJobForm({ ...jobForm, include_service_specific: !!v })}
                />
                <Label htmlFor="service-specific">Include service-specific content</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-publish"
                  checked={jobForm.auto_publish}
                  onCheckedChange={(v) => setJobForm({ ...jobForm, auto_publish: !!v })}
                />
                <Label htmlFor="auto-publish">Auto-publish generated content</Label>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreatingJob(false)}>
                Cancel
              </Button>
              <Button onClick={createJob}>
                Create Job
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
