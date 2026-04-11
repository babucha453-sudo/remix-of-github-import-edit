import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, RotateCcw, Eye, CheckCircle, XCircle, Clock, 
  ChevronDown, ChevronRight, Play, Pause
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SeoFixJob {
  id: string;
  job_type: string;
  status: string;
  total_pages: number;
  processed_pages: number;
  successful_pages: number;
  failed_pages: number;
  apply_mode: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
  regeneration_config: Record<string, any>;
}

interface JobItem {
  id: string;
  page_slug: string;
  page_type: string;
  status: string;
  before_snapshot: Record<string, any> | null;
  after_snapshot: Record<string, any> | null;
  before_score: number | null;
  after_score: number | null;
  is_applied: boolean;
  is_rolled_back: boolean;
  error_message: string | null;
}

export function JobsHistoryPanel() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<SeoFixJob | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Fetch jobs
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['seo-fix-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_fix_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SeoFixJob[];
    },
  });

  // Fetch job items
  const { data: jobItems } = useQuery({
    queryKey: ['seo-fix-job-items', selectedJob?.id],
    queryFn: async () => {
      if (!selectedJob) return [];
      const { data, error } = await supabase
        .from('seo_fix_job_items')
        .select('*')
        .eq('job_id', selectedJob.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as JobItem[];
    },
    enabled: !!selectedJob,
  });

  // Rollback single item
  const rollbackItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.functions.invoke('seo-bulk-processor', {
        body: { action: 'rollback_item', item_id: itemId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-fix-job-items'] });
      queryClient.invalidateQueries({ queryKey: ['seo-pages-picker'] });
      toast.success('Changes rolled back successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Rollback entire job
  const rollbackJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke('seo-bulk-processor', {
        body: { action: 'rollback_job', job_id: jobId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seo-fix-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['seo-fix-job-items'] });
      queryClient.invalidateQueries({ queryKey: ['seo-pages-picker'] });
      toast.success(`Rolled back ${data.rolled_back_count} pages`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Apply pending items
  const applyPendingItems = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke('seo-bulk-processor', {
        body: { action: 'apply_pending', job_id: jobId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seo-fix-job-items'] });
      queryClient.invalidateQueries({ queryKey: ['seo-pages-picker'] });
      toast.success(`Applied ${data.applied_count} changes`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-teal/20 text-teal border-teal/30"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'running':
        return <Badge className="bg-primary/20 text-primary border-primary/30"><Play className="h-3 w-3 mr-1" />Running</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline"><Pause className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getJobTypeBadge = (type: string) => {
    const types: Record<string, string> = {
      bulk_regenerate: 'Bulk Regenerate',
      meta_optimization: 'Meta Fix',
      content_enrichment: 'Content Enrichment',
      indexing_fix: 'Indexing Fix',
    };
    return <Badge variant="outline">{types[type] || type}</Badge>;
  };

  const toggleItemExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Jobs History & Rollback
        </CardTitle>
        <CardDescription>View past optimization jobs and rollback changes</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Pages</TableHead>
                <TableHead className="text-center">Success</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : jobs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No jobs yet. Run a bulk optimization to see history.
                  </TableCell>
                </TableRow>
              ) : (
                jobs?.map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="text-sm">
                      {format(new Date(job.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell>{getJobTypeBadge(job.job_type)}</TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-center">{job.total_pages}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-teal">{job.successful_pages}</span>
                      {job.failed_pages > 0 && (
                        <span className="text-coral"> / {job.failed_pages}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{job.apply_mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setSelectedJob(job); setShowJobDetails(true); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {job.status === 'completed' && job.successful_pages > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-coral hover:text-coral"
                            onClick={() => rollbackJob.mutate(job.id)}
                            disabled={rollbackJob.isPending}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Job Details Dialog */}
        <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Job Details</DialogTitle>
              <DialogDescription>
                {selectedJob && (
                  <span>
                    {getJobTypeBadge(selectedJob.job_type)} • {format(new Date(selectedJob.created_at), 'PPp')}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedJob && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                {/* Summary */}
                <div className="flex items-center gap-4">
                  {getStatusBadge(selectedJob.status)}
                  <span className="text-sm">
                    Processed: {selectedJob.processed_pages}/{selectedJob.total_pages}
                  </span>
                  <span className="text-sm text-teal">✓ {selectedJob.successful_pages}</span>
                  <span className="text-sm text-coral">✗ {selectedJob.failed_pages}</span>
                </div>

                {/* Config */}
                {selectedJob.regeneration_config && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(selectedJob.regeneration_config)
                      .filter(([_, v]) => v === true)
                      .map(([k]) => (
                        <Badge key={k} variant="outline" className="text-xs">
                          {k.replace(/regenerate|add/, '').replace(/([A-Z])/g, ' $1').trim()}
                        </Badge>
                      ))}
                  </div>
                )}

                {/* Items */}
                <ScrollArea className="flex-1 border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobItems?.map(item => (
                        <>
                          <TableRow key={item.id}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleItemExpand(item.id)}
                              >
                                {expandedItems.has(item.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[200px] truncate">
                              {item.page_slug}
                            </TableCell>
                            <TableCell>
                              {item.status === 'completed' ? (
                                <CheckCircle className="h-4 w-4 text-teal" />
                              ) : item.status === 'failed' ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell>
                              {item.before_score} → {item.after_score}
                            </TableCell>
                            <TableCell>
                              {item.is_applied ? (
                                item.is_rolled_back ? (
                                  <Badge variant="outline" className="text-xs">Rolled Back</Badge>
                                ) : (
                                  <Badge className="bg-teal/20 text-teal text-xs">Applied</Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-xs">Draft</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.is_applied && !item.is_rolled_back && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => rollbackItem.mutate(item.id)}
                                  disabled={rollbackItem.isPending}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Rollback
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedItems.has(item.id) && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/50">
                                <div className="grid grid-cols-2 gap-4 p-3 text-sm">
                                  <div>
                                    <h5 className="font-medium text-muted-foreground mb-2">Before</h5>
                                    <p><strong>Title:</strong> {item.before_snapshot?.meta_title || '—'}</p>
                                    <p><strong>Desc:</strong> {item.before_snapshot?.meta_description?.slice(0, 60) || '—'}...</p>
                                    <p><strong>H1:</strong> {item.before_snapshot?.h1 || '—'}</p>
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-teal mb-2">After</h5>
                                    <p><strong>Title:</strong> {item.after_snapshot?.meta_title || '—'}</p>
                                    <p><strong>Desc:</strong> {item.after_snapshot?.meta_description?.slice(0, 60) || '—'}...</p>
                                    <p><strong>H1:</strong> {item.after_snapshot?.h1 || '—'}</p>
                                  </div>
                                </div>
                                {item.error_message && (
                                  <p className="text-destructive text-sm p-3 pt-0">Error: {item.error_message}</p>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Bulk actions for draft items */}
                {selectedJob.apply_mode === 'draft' && jobItems?.some(i => !i.is_applied && i.status === 'completed') && (
                  <div className="flex justify-end pt-2 border-t">
                    <Button onClick={() => applyPendingItems.mutate(selectedJob.id)} disabled={applyPendingItems.isPending}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Apply All Pending Changes
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowJobDetails(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
