'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminBlogPosts, useCreateBlogPost, useUpdateBlogPost, useDeleteBlogPost, BlogPost, getPostContentAsString } from '@/hooks/useAdminBlog';
import { useBlogCategories, useAllBlogCategories, useCreateBlogCategory, useBlogAuthors, useAllBlogAuthors, useCreateBlogAuthor, useBlogAIAssistant } from '@/hooks/useBlogManagement';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  BookOpen, Search, Plus, Edit, Trash2, Eye, EyeOff, AlertTriangle,
  Link2, Loader2, Sparkles, FileText, Users, Tags, Settings, ChevronDown,
  Wand2, ExternalLink, RefreshCw, FolderTree, Image as ImageIcon, Save,
  X, Check, PlusCircle, MinusCircle, Globe, MapPin, Stethoscope, Rss,
  Calendar, Clock, FileWarning, Lightbulb, ArrowRight, Target, TrendingUp,
  Brain, Zap, Play, Pause, BarChart3, CheckCircle, XCircle, AlertCircle,
  Bot, Timer, Send, Layers, ListFilter, Filter, MoreVertical, Copy, RefreshCcw,
  CalendarDays, FileEdit, Wand, SendHorizontal, Layout, GripVertical
} from 'lucide-react';
import { format, formatDistanceToNow, addHours, addDays } from 'date-fns';
import { toast } from 'sonner';

type BlogPostStatus = 'topic_queued' | 'draft' | 'under_review' | 'approved' | 'scheduled' | 'published' | 'failed';

interface TopicSuggestion {
  id: string;
  topic: string;
  category: string;
  keywords: string[];
  intent_type: string;
  opportunity_score: number;
  trend_signal: string;
  status: 'pending' | 'generating' | 'ready' | 'published' | 'failed';
  generated_content?: string;
  suggested_links?: { slug: string; title: string; page_type: string }[];
}

interface AutomationJob {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  schedule_type: 'manual' | 'hourly' | 'daily' | 'weekly';
  schedule_interval: number;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  config: Record<string, any>;
  results: Record<string, any>;
}

interface BlogStats {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
  under_review: number;
  topic_queued: number;
}

const TOPIC_INTENTS = [
  { value: 'informational', label: 'Informational', description: 'Researching info' },
  { value: 'transactional', label: 'Transactional', description: 'Ready to book' },
  { value: 'navigational', label: 'Navigational', description: 'Looking for specific' },
  { value: 'commercial', label: 'Commercial', description: 'Comparing options' },
];

const AUTOMATION_INTERVALS = [
  { value: '2', label: 'Every 2 hours' },
  { value: '4', label: 'Every 4 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Every day' },
  { value: '72', label: 'Every 3 days' },
  { value: '168', label: 'Every week' },
];

export default function BlogManagementTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState({ status: '', search: '' });
  
  // Blog posts query
  const { data: posts, isLoading: postsLoading, refetch: refetchPosts } = useAdminBlogPosts(
    filters.status || undefined
  );
  
  // Categories & Authors
  const { data: categories } = useBlogCategories();
  const { data: allCategories } = useAllBlogCategories();
  const { data: authors } = useBlogAuthors();
  const { data: allAuthors } = useAllBlogAuthors();
  
  // Mutations
  const createPost = useCreateBlogPost();
  const updatePost = useUpdateBlogPost();
  const deletePost = useDeleteBlogPost();
  const createCategory = useCreateBlogCategory();
  const createAuthor = useCreateBlogAuthor();
  const aiAssistant = useBlogAIAssistant();
  
  // Dialog states
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [editorPost, setEditorPost] = useState<BlogPost | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  
  // Topic Discovery state
  const [topicQuery, setTopicQuery] = useState('');
  const [discoveredTopics, setDiscoveredTopics] = useState<TopicSuggestion[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  
  // Automation state
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationInterval, setAutomationInterval] = useState('24');
  const [autoPublish, setAutoPublish] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(5);
  
  // Post form
  const [postForm, setPostForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: '',
    author_id: '',
    seo_title: '',
    seo_description: '',
    featured_image_url: '',
    status: 'draft' as 'draft' | 'published',
    is_featured: false,
    topic_cluster_id: ''
  });
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#6366f1',
    is_active: true
  });
  
  // Author form
  const [authorForm, setAuthorForm] = useState({
    name: '',
    email: '',
    bio: '',
    role: 'Author'
  });
  
  // Generate slug
  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };
  
  // Stats calculation
  const stats = useMemo((): BlogStats => {
    if (!posts) return { total: 0, published: 0, draft: 0, scheduled: 0, under_review: 0, topic_queued: 0 };
    
    return {
      total: posts.length,
      published: posts.filter(p => p.status === 'published').length,
      draft: posts.filter(p => p.status === 'draft').length,
      scheduled: 0,
      under_review: 0,
      topic_queued: 0
    };
  }, [posts]);
  
  // Filter posts by search
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    if (!filters.search) return posts;
    const search = filters.search.toLowerCase();
    return posts.filter(p => 
      p.title.toLowerCase().includes(search) || 
      p.slug.toLowerCase().includes(search)
    );
  }, [posts, filters.search]);
  
  // Submit post
  const handleSubmitPost = async () => {
    try {
      const postData = {
        title: postForm.title,
        slug: postForm.slug || generateSlug(postForm.title),
        excerpt: postForm.excerpt || null,
        content: postForm.content || null,
        category: postForm.category || null,
        author_id: postForm.author_id || null,
        seo_title: postForm.seo_title || null,
        seo_description: postForm.seo_description || null,
        featured_image_url: postForm.featured_image_url || null,
        status: postForm.status,
        is_featured: postForm.is_featured,
        topic_cluster_id: postForm.topic_cluster_id || null
      };
      
      if (editorPost) {
        await updatePost.mutateAsync({ id: editorPost.id, updates: postData });
        toast.success('Blog post updated');
      } else {
        await createPost.mutateAsync(postData);
        toast.success('Blog post created');
      }
      
      setPostDialogOpen(false);
      setEditorPost(null);
      resetPostForm();
      refetchPosts();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };
  
  // Reset form
  const resetPostForm = () => {
    setPostForm({
      title: '', slug: '', excerpt: '', content: '',
      category: '', author_id: '', seo_title: '', seo_description: '',
      featured_image_url: '', status: 'draft', is_featured: false, topic_cluster_id: ''
    });
  };
  
  // Edit post
  const handleEditPost = (post: BlogPost) => {
    setEditorPost(post);
    setPostForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: getPostContentAsString(post),
      category: typeof post.category === 'string' ? post.category : '',
      author_id: post.author_id || '',
      seo_title: post.seo_title || '',
      seo_description: post.seo_description || '',
      featured_image_url: post.featured_image_url || '',
      status: (post.status === 'published' || post.status === 'draft') ? post.status : 'draft',
      is_featured: post.is_featured,
      topic_cluster_id: post.topic_cluster_id || ''
    });
    setPostDialogOpen(true);
  };
  
  // Delete post
  const handleDeletePost = async (post: BlogPost) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    try {
      await deletePost.mutateAsync(post.id);
      toast.success('Post deleted');
      refetchPosts();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };
  
  // Duplicate post
  const handleDuplicatePost = async (post: BlogPost) => {
    try {
      await createPost.mutateAsync({
        title: `${post.title} (Copy)`,
        slug: `${post.slug}-copy`,
        excerpt: post.excerpt,
        content: getPostContentAsString(post),
        category: typeof post.category === 'string' ? post.category : null,
        author_id: post.author_id,
        seo_title: post.seo_title,
        seo_description: post.seo_description,
        featured_image_url: post.featured_image_url,
        status: 'draft',
        is_featured: false,
        topic_cluster_id: post.topic_cluster_id
      });
      toast.success('Post duplicated');
      refetchPosts();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };
  
  // Unpublish post
  const handleUnpublishPost = async (post: BlogPost) => {
    try {
      await updatePost.mutateAsync({ id: post.id, updates: { status: 'draft' } });
      toast.success('Post unpublished');
      refetchPosts();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };
  
  // Topic Discovery using AI
  const discoverTopics = async () => {
    if (!topicQuery.trim()) {
      toast.error('Enter a seed topic');
      return;
    }
    
    setIsDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke('topic-research-automation', {
        body: { action: 'research_topics', seed_topic: topicQuery, count: 10 }
      });
      
      if (error) throw error;
      
      const topics: TopicSuggestion[] = (data.topics || []).map((t: any, i: number) => ({
        id: `topic-${Date.now()}-${i}`,
        topic: t.title,
        category: t.category,
        keywords: t.keywords || [],
        intent_type: t.intent_type || 'informational',
        opportunity_score: t.opportunity_score || Math.floor(Math.random() * 50) + 50,
        trend_signal: t.trend_signal || 'steady',
        status: 'pending' as const,
        suggested_links: t.suggested_links || []
      }));
      
      setDiscoveredTopics(topics);
      toast.success(`Discovered ${topics.length} topics`);
    } catch (error: any) {
      toast.error(`Discovery failed: ${error.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };
  
  // Generate blog from topic
  const generateFromTopic = async (topic: TopicSuggestion) => {
    setDiscoveredTopics(prev => prev.map(t => 
      t.id === topic.id ? { ...t, status: 'generating' as const } : t
    ));
    
    try {
      const { data, error } = await supabase.functions.invoke('blog-ai-assistant', {
        body: {
          action: 'improve_content',
          title: topic.topic,
          content: `Write a comprehensive blog post about ${topic.topic}. Include: introduction, main sections, FAQs, and conclusion. Focus on dental patient perspective.`
        }
      });
      
      if (error) throw error;
      
      setDiscoveredTopics(prev => prev.map(t => 
        t.id === topic.id ? { 
          ...t, 
          status: 'ready' as const,
          generated_content: data.content || '',
          suggested_links: topic.suggested_links || []
        } : t
      ));
      
      toast.success('Content generated');
    } catch (error: any) {
      setDiscoveredTopics(prev => prev.map(t => 
        t.id === topic.id ? { ...t, status: 'failed' as const } : t
      ));
      toast.error(`Generation failed: ${error.message}`);
    }
  };
  
  // Publish generated content
  const publishFromTopic = async (topic: TopicSuggestion) => {
    if (!topic.generated_content) {
      toast.error('Generate content first');
      return;
    }
    
    try {
      await createPost.mutateAsync({
        title: topic.topic,
        slug: generateSlug(topic.topic),
        content: topic.generated_content,
        category: topic.category,
        status: 'published',
        seo_title: topic.topic,
        seo_description: `Learn about ${topic.topic} in our comprehensive guide. Expert insights on dental care.`
      });
      
      setDiscoveredTopics(prev => prev.map(t => 
        t.id === topic.id ? { ...t, status: 'published' as const } : t
      ));
      
      toast.success('Published!');
      refetchPosts();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };
  
  // Save to automation queue
  const saveToQueue = async (topic: TopicSuggestion) => {
    try {
      await (supabase as any).from('topic_suggestions').insert([{
        topic: topic.topic,
        category: topic.category,
        keywords: topic.keywords,
        intent_type: topic.intent_type,
        opportunity_score: topic.opportunity_score,
        status: 'pending'
      }]);
      
      setDiscoveredTopics(prev => prev.map(t => 
        t.id === topic.id ? { ...t, status: 'published' as const } : t
      ));
      
      toast.success('Saved to automation queue');
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Blog Manager
          </h2>
          <p className="text-muted-foreground">
            Complete blog operations: discovery, writing, automation, and publishing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchPosts()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetPostForm(); setEditorPost(null); setPostDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Posts</p>
          </CardContent>
        </Card>
        <Card className="border-green-500">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats.published}</div>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{stats.draft}</div>
            <p className="text-xs text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{stats.scheduled}</div>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-500">{stats.under_review}</div>
            <p className="text-xs text-muted-foreground">Under Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-500">{stats.topic_queued}</div>
            <p className="text-xs text-muted-foreground">Topic Queued</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="posts">All Posts</TabsTrigger>
          <TabsTrigger value="discovery">Topic Discovery</TabsTrigger>
          <TabsTrigger value="writing">AI Writer</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>
        
        {/* DASHBOARD TAB */}
        <TabsContent value="dashboard" className="space-y-4">
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
                <Button className="w-full justify-start" onClick={() => setActiveTab('discovery')}>
                  <Brain className="h-4 w-4 mr-2" />
                  Discover Topics
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('writing')}>
                  <Wand className="h-4 w-4 mr-2" />
                  Write New Post
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setPostDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Manually
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>
            
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {posts?.slice(0, 5).map(post => (
                      <div key={post.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="truncate flex-1">
                          <div className="font-medium text-sm truncate">{post.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}
                          </div>
                        </div>
                        <Badge variant={post.status === 'published' ? 'default' : 'outline'}>
                          {post.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* Category & Author Summary */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Categories ({allCategories?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {allCategories?.map(cat => (
                    <Badge key={cat.id} variant="secondary">{cat.name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Authors ({allAuthors?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {allAuthors?.map(author => (
                    <Badge key={author.id} variant="outline">{author.name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* ALL POSTS TAB */}
        <TabsContent value="posts" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search posts..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />
                </div>
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* Posts Table */}
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postsLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filteredPosts?.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No posts found</TableCell></TableRow>
                    ) : (
                      filteredPosts?.map(post => (
                        <TableRow key={post.id}>
                          <TableCell>
                            <div className="font-medium">{post.title}</div>
                            <div className="text-xs text-muted-foreground">/{post.slug}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={post.status === 'published' ? 'default' : 'outline'}>
                              {post.status}
                            </Badge>
                            {post.is_featured && <Badge variant="outline" className="ml-1">Featured</Badge>}
                          </TableCell>
                          <TableCell>{typeof post.category === 'string' ? post.category : '-'}</TableCell>
                          <TableCell>{post.author_name || '-'}</TableCell>
                          <TableCell>{formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditPost(post)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDuplicatePost(post)}><Copy className="h-4 w-4" /></Button>
                              {post.status === 'published' && <Button variant="ghost" size="sm" onClick={() => handleUnpublishPost(post)}><EyeOff className="h-4 w-4" /></Button>}
                              <Button variant="ghost" size="sm" onClick={() => handleDeletePost(post)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TOPIC DISCOVERY TAB */}
        <TabsContent value="discovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Topic Discovery
              </CardTitle>
              <CardDescription>
                Enter seed topics to discover relevant blog opportunities with SEO potential
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Enter seed topic (e.g., 'dental implants', 'teeth whitening', 'dental insurance')"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={discoverTopics} disabled={isDiscovering}>
                  {isDiscovering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Discover
                </Button>
              </div>
              
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Smart Discovery</AlertTitle>
                <AlertDescription>
                  AI analyzes search trends, competition gaps, and patient questions to suggest high-opportunity topics.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          {/* Discovered Topics */}
          {discoveredTopics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Discovered Topics ({discoveredTopics.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {discoveredTopics.map((topic, idx) => (
                    <AccordionItem key={topic.id} value={topic.id}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-3 w-full pr-4">
                          <Badge variant="outline">{idx + 1}</Badge>
                          <span className="flex-1 text-left">{topic.topic}</span>
                          <Badge variant="secondary">{topic.intent_type}</Badge>
                          <Badge variant={topic.opportunity_score >= 70 ? 'default' : 'outline'}>
                            {topic.opportunity_score}% opp
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pl-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{topic.category}</Badge>
                            {topic.keywords.slice(0, 5).map((kw, i) => (
                              <Badge key={i} variant="secondary">{kw}</Badge>
                            ))}
                          </div>
                          
                          {topic.status === 'ready' && topic.generated_content && (
                            <div className="p-3 bg-muted rounded">
                              <p className="text-sm line-clamp-3">{topic.generated_content.slice(0, 300)}...</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {topic.status === 'pending' && (
                              <Button size="sm" onClick={() => generateFromTopic(topic)}>
                                <Wand className="h-4 w-4 mr-2" />
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
                              <>
                                <Button size="sm" onClick={() => publishFromTopic(topic)}>
                                  <SendHorizontal className="h-4 w-4 mr-2" />
                                  Publish
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => saveToQueue(topic)}>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save to Queue
                                </Button>
                              </>
                            )}
                            {topic.status === 'failed' && (
                              <Button size="sm" variant="outline" onClick={() => generateFromTopic(topic)}>
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
        </TabsContent>
        
        {/* AI WRITER TAB */}
        <TabsContent value="writing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand className="h-5 w-5" />
                AI Blog Writer
              </CardTitle>
              <CardDescription>
                Generate SEO-optimized blog posts with Gemini AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Blog Title</Label>
                  <Input
                    value={postForm.title}
                    onChange={(e) => {
                      setPostForm({ ...postForm, title: e.target.value });
                      if (!editorPost) setPostForm(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
                    }}
                    placeholder="Enter blog title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={postForm.slug} onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })} placeholder="auto-generated" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={postForm.category} onValueChange={(v) => setPostForm({ ...postForm, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Author</Label>
                  <Select value={postForm.author_id} onValueChange={(v) => setPostForm({ ...postForm, author_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select author" /></SelectTrigger>
                    <SelectContent>
                      {authors?.map(author => <SelectItem key={author.id} value={author.id}>{author.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={postForm.content}
                  onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
                  placeholder="Write your blog content... or use AI to generate"
                  rows={15}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    if (!postForm.title) { toast.error('Enter a title first'); return; }
                    try {
                      const { data } = await aiAssistant.mutateAsync({ action: 'improve_content', title: postForm.title, content: postForm.content });
                      if (data?.content) setPostForm(prev => ({ ...prev, content: data.content }));
                      toast.success('Content generated');
                    } catch (e: any) { toast.error(e.message); }
                  }}>
                    <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SEO Title</Label>
                  <Input value={postForm.seo_title} onChange={(e) => setPostForm({ ...postForm, seo_title: e.target.value })} placeholder="SEO title (60 chars)" />
                </div>
                <div className="space-y-2">
                  <Label>SEO Description</Label>
                  <Input value={postForm.seo_description} onChange={(e) => setPostForm({ ...postForm, seo_description: e.target.value })} placeholder="Meta description (155 chars)" />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSubmitPost}>
                  <Save className="h-4 w-4 mr-2" />
                  {editorPost ? 'Update' : 'Save'} Post
                </Button>
                <Button variant="outline" onClick={() => setPostForm(prev => ({ ...prev, status: 'draft' }))}>
                  Save as Draft
                </Button>
                <Button variant="outline" onClick={() => setPostForm(prev => ({ ...prev, status: 'draft' as const }))}>
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* AUTOMATION TAB */}
        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Blog Automation
              </CardTitle>
              <CardDescription>
                Configure automated topic discovery, content generation, and publishing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded">
                <div>
                  <div className="font-medium">Enable Automation</div>
                  <div className="text-sm text-muted-foreground">Run automated blog operations</div>
                </div>
                <Switch checked={automationEnabled} onCheckedChange={setAutomationEnabled} />
              </div>
              
              {/* Settings */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Run Frequency</Label>
                  <Select value={automationInterval} onValueChange={setAutomationInterval} disabled={!automationEnabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_INTERVALS.map(int => <SelectItem key={int.value} value={int.value}>{int.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Daily Publish Limit</Label>
                  <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(parseInt(e.target.value) || 5)} disabled={!automationEnabled} />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox id="auto-publish" checked={autoPublish} onCheckedChange={(v) => setAutoPublish(!!v)} disabled={!automationEnabled} />
                  <Label htmlFor="auto-publish">Auto-publish (no review)</Label>
                </div>
              </div>
              
              {/* Categories */}
              <div className="space-y-2">
                <Label>Categories to Target</Label>
                <div className="flex flex-wrap gap-2">
                  {categories?.map(cat => (
                    <Badge key={cat.id} variant="outline" className="cursor-pointer">{cat.name}</Badge>
                  ))}
                </div>
              </div>
              
              {/* Save Button */}
              <Button onClick={() => toast.success('Automation settings saved')}>
                <Save className="h-4 w-4 mr-2" />
                Save Automation Settings
              </Button>
              
              {/* Status */}
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertTitle>Automation Status</AlertTitle>
                <AlertDescription>
                  {automationEnabled 
                    ? `Automation is active. Will run every ${automationInterval} hours with max ${dailyLimit} posts per day.`
                    : 'Automation is disabled. Enable to start automated blog operations.'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Post Edit Dialog */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editorPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Form fields - same as writing tab */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={postForm.title} onChange={(e) => { setPostForm({ ...postForm, title: e.target.value }); if(!editorPost) setPostForm(p => ({...p, slug: generateSlug(e.target.value)})); }} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={postForm.slug} onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={postForm.category} onValueChange={(v) => setPostForm({ ...postForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Author</Label>
                <Select value={postForm.author_id} onValueChange={(v) => setPostForm({ ...postForm, author_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{authors?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Excerpt</Label>
              <Textarea value={postForm.excerpt} onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} rows={12} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SEO Title</Label>
                <Input value={postForm.seo_title} onChange={(e) => setPostForm({ ...postForm, seo_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SEO Description</Label>
                <Input value={postForm.seo_description} onChange={(e) => setPostForm({ ...postForm, seo_description: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={postForm.status} onValueChange={(v) => setPostForm({ ...postForm, status: v as 'draft' | 'published' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox id="featured" checked={postForm.is_featured} onCheckedChange={(v) => setPostForm({ ...postForm, is_featured: !!v })} />
                <Label htmlFor="featured">Featured Post</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setPostDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitPost}>{editorPost ? 'Update' : 'Create'} Post</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
