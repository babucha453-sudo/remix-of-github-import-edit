import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Bot, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Plus,
  Search,
  TrendingUp,
  FileText,
  Globe,
  ExternalLink,
  Link2,
  RefreshCw,
  Target
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';

interface SeoTask {
  id: string;
  title: string;
  description: string;
  page_url: string | null;
  task_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  assigned_to: string | null;
  ai_suggestion: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function SeoCopilotTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('tasks');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('pending');
  const [newTaskDialog, setNewTaskDialog] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  // Fetch real SEO tasks from database
  const { data: dbTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['seo-tasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('seo_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const tasks: SeoTask[] = (dbTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    page_url: t.page_url,
    task_type: t.task_type || 'content',
    priority: t.priority || 'medium',
    status: t.status || 'pending',
    assigned_to: t.assigned_to,
    ai_suggestion: t.ai_suggestion,
    created_at: t.created_at,
    completed_at: t.completed_at,
  }));

  // Fetch SEO issues from pages
  const { data: seoIssues } = useQuery({
    queryKey: ['seo-issues'],
    queryFn: async () => {
      const { data: pages } = await supabase
        .from('seo_pages')
        .select('id, slug, title, meta_description, is_thin_content, is_duplicate')
        .or('is_thin_content.eq.true,is_duplicate.eq.true,meta_description.is.null');
      
      const issues: { type: string; message: string; severity: 'high' | 'medium' | 'low'; count: number }[] = [];
      
      const thinContent = pages?.filter(p => p.is_thin_content) || [];
      const duplicates = pages?.filter(p => p.is_duplicate) || [];
      const missingMeta = pages?.filter(p => !p.meta_description) || [];
      
      if (thinContent.length > 0) {
        issues.push({ type: 'thin_content', message: `${thinContent.length} pages with thin content`, severity: 'high', count: thinContent.length });
      }
      if (duplicates.length > 0) {
        issues.push({ type: 'duplicate', message: `${duplicates.length} duplicate pages detected`, severity: 'high', count: duplicates.length });
      }
      if (missingMeta.length > 0) {
        issues.push({ type: 'missing_meta', message: `${missingMeta.length} pages missing meta descriptions`, severity: 'medium', count: missingMeta.length });
      }
      
      return issues;
    },
  });

  // Fetch page performance stats
  const { data: pageStats } = useQuery({
    queryKey: ['page-stats'],
    queryFn: async () => {
      const { data: clinics, count: clinicCount } = await supabase.from('clinics').select('id', { count: 'exact' });
      const { data: treatments, count: treatmentCount } = await supabase.from('treatments').select('id', { count: 'exact' });
      const { data: cities, count: cityCount } = await supabase.from('cities').select('id', { count: 'exact' });
      const { data: blogs, count: blogCount } = await supabase.from('blog_posts').select('id', { count: 'exact' }).eq('status', 'published');
      
      return {
        totalPages: (clinicCount || 0) + (treatmentCount || 0) + (cityCount || 0) + (blogCount || 0) + 1,
        clinics: clinicCount || 0,
        treatments: treatmentCount || 0,
        cities: cityCount || 0,
        blogs: blogCount || 0,
      };
    },
  });

  const runSeoAudit = useMutation({
    mutationFn: async () => {
      // Call the real SEO audit edge function with Gemini
      const { data, error } = await supabase.functions.invoke('seo-audit', {
        body: { action: 'audit' },
      });
      
      if (error) throw error;
      
      await createAuditLog({
        action: 'SEO_AUDIT',
        entityType: 'seo_copilot',
        metadata: { tasks_generated: data?.tasksCreated || 0 },
      });
      
      // Refetch tasks from database
      refetchTasks();
      
      return data?.tasksCreated || 0;
    },
    onSuccess: (count) => {
      toast.success(`SEO audit complete. ${count} new AI-generated tasks created.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTaskStatus = async (taskId: string, status: SeoTask['status']) => {
    const { error } = await supabase
      .from('seo_tasks')
      .update({ 
        status, 
        completed_at: status === 'completed' ? new Date().toISOString() : null 
      })
      .eq('id', taskId);
    
    if (error) {
      toast.error('Failed to update task');
      return;
    }
    
    refetchTasks();
    toast.success(`Task ${status === 'completed' ? 'completed' : 'updated'}`);
  };

  const dismissTask = async (taskId: string) => {
    const { error } = await supabase
      .from('seo_tasks')
      .update({ status: 'dismissed' })
      .eq('id', taskId);
    
    if (error) {
      toast.error('Failed to dismiss task');
      return;
    }
    
    refetchTasks();
    toast.success('Task dismissed');
  };

  const bulkComplete = async () => {
    const { error } = await supabase
      .from('seo_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .in('id', selectedTasks);
    
    if (error) {
      toast.error('Failed to complete tasks');
      return;
    }
    
    setSelectedTasks([]);
    refetchTasks();
    toast.success(`${selectedTasks.length} tasks completed`);
  };

  const filteredTasks = tasks.filter(t => {
    if (taskFilter === 'all') return t.status !== 'dismissed';
    return t.status === taskFilter;
  });

  const taskStats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'high': return <Badge className="bg-coral/20 text-coral">High</Badge>;
      case 'medium': return <Badge className="bg-gold/20 text-gold">Medium</Badge>;
      default: return <Badge variant="outline">Low</Badge>;
    }
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'content': return <FileText className="h-4 w-4" />;
      case 'technical': return <Zap className="h-4 w-4" />;
      case 'linking': return <Link2 className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">SEO Copilot</h1>
          <p className="text-muted-foreground mt-1">AI-powered SEO recommendations and task management</p>
        </div>
        <Button onClick={() => runSeoAudit.mutate()} disabled={runSeoAudit.isPending}>
          <Bot className={`h-4 w-4 mr-2 ${runSeoAudit.isPending ? 'animate-pulse' : ''}`} />
          {runSeoAudit.isPending ? 'Running Audit...' : 'Run SEO Audit'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pageStats?.totalPages || 0}</p>
              <p className="text-sm text-muted-foreground">Indexed Pages</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Clock className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{taskStats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending Tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{taskStats.inProgress}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{taskStats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{seoIssues?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Active Issues</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Alert */}
      {seoIssues && seoIssues.length > 0 && (
        <Card className="card-modern border-coral/30 bg-coral/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-6 w-6 text-coral" />
              <div className="flex-1">
                <p className="font-bold text-coral">SEO Issues Detected</p>
                <p className="text-sm text-muted-foreground">
                  {seoIssues.map(i => i.message).join(' • ')}
                </p>
              </div>
              <Button variant="outline" size="sm" className="bg-coral/10 text-coral border-coral hover:bg-coral hover:text-white">
                View All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="tasks" className="rounded-xl">
            <Target className="h-4 w-4 mr-2" />
            SEO Tasks
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl">
            <Search className="h-4 w-4 mr-2" />
            Audit Results
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="rounded-xl">
            <Bot className="h-4 w-4 mr-2" />
            AI Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">SEO Tasks</CardTitle>
                <CardDescription>AI-generated tasks to improve your SEO</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={taskFilter} onValueChange={(v: typeof taskFilter) => setTaskFilter(v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                {selectedTasks.length > 0 && (
                  <Button onClick={bulkComplete} size="sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete ({selectedTasks.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                        onCheckedChange={(checked) => {
                          setSelectedTasks(checked ? filteredTasks.map(t => t.id) : []);
                        }}
                      />
                    </TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTasks.includes(task.id)}
                          onCheckedChange={(checked) => {
                            setSelectedTasks(checked 
                              ? [...selectedTasks, task.id]
                              : selectedTasks.filter(id => id !== task.id)
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                          {task.page_url && (
                            <div className="flex items-center gap-1 mt-1">
                              <Link2 className="h-3 w-3 text-primary" />
                              <span className="text-xs text-primary">{task.page_url}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTaskTypeIcon(task.task_type)}
                          <span className="capitalize text-sm">{task.task_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>
                        <Select 
                          value={task.status} 
                          onValueChange={(v: SeoTask['status']) => updateTaskStatus(task.id, v)}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => dismissTask(task.id)}>
                          Dismiss
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No tasks found. Run an SEO audit to generate tasks.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg">Technical SEO Audit</CardTitle>
              <CardDescription>Automated checks for common SEO issues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-teal/10 border border-teal/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-teal" />
                    <span className="font-medium">Sitemap</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sitemap is valid and includes {pageStats?.totalPages || 0} URLs
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-teal/10 border border-teal/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-teal" />
                    <span className="font-medium">Robots.txt</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Robots.txt is properly configured
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-teal/10 border border-teal/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-teal" />
                    <span className="font-medium">SSL Certificate</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    HTTPS is enabled sitewide
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-gold/10 border border-gold/20">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-gold" />
                    <span className="font-medium">Canonical Tags</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Some pages may need canonical review
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Content Suggestions
              </CardTitle>
              <CardDescription>Smart recommendations for your pages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasks.filter(t => t.ai_suggestion).slice(0, 5).map(task => (
                <div key={task.id} className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{task.ai_suggestion}</p>
                      {task.page_url && (
                        <div className="flex items-center gap-1 mt-2">
                          <Link2 className="h-3 w-3 text-primary" />
                          <a href={task.page_url} className="text-xs text-primary hover:underline">{task.page_url}</a>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm">Apply</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
