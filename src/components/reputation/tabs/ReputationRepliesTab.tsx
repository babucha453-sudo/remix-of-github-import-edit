import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MessageSquare, Sparkles, Send, Clock, Check, X, AlertCircle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { createAuditLog } from '@/lib/audit';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationRepliesTab({ clinicId, isAdmin }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Google reviews with reply status
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['replies-google', clinicId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('google_reviews')
        .select('*, clinic:clinics(id, name, slug, google_place_id)')
        .order('review_time', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      if (statusFilter !== 'all') query = query.eq('reply_status', statusFilter);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Generate AI reply
  const generateAiReply = async () => {
    if (!selectedReview) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-reply', {
        body: {
          review_id: selectedReview.id,
          review_type: 'google',
          author_name: selectedReview.author_name,
          rating: selectedReview.rating,
          text_content: selectedReview.text_content,
          clinic_name: selectedReview.clinic?.name,
        },
      });
      if (error) throw error;
      setReplyText(data.reply);
      toast.success('AI reply generated');
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Save reply (mark as pending post or ready)
  const saveReply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('google_reviews')
        .update({
          ai_suggested_reply: replyText,
          reply_status: 'ready_to_post',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedReview.id);
      if (error) throw error;
      await createAuditLog({
        action: 'save_reply',
        entityType: 'google_review',
        entityId: selectedReview.id,
        newValues: { reply_status: 'ready_to_post' },
      });
    },
    onSuccess: () => {
      toast.success('Reply saved');
      queryClient.invalidateQueries({ queryKey: ['replies-google'] });
      setSelectedReview(null);
      setReplyText('');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });

  // Mark as posted (manual confirmation)
  const markPosted = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase
        .from('google_reviews')
        .update({
          reply_status: 'posted',
          reply_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId);
      if (error) throw error;
      await createAuditLog({
        action: 'mark_reply_posted',
        entityType: 'google_review',
        entityId: reviewId,
      });
    },
    onSuccess: () => {
      toast.success('Marked as posted');
      queryClient.invalidateQueries({ queryKey: ['replies-google'] });
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      pending: { className: 'bg-amber-100 text-amber-700', label: 'Needs Reply' },
      ready_to_post: { className: 'bg-blue-100 text-blue-700', label: 'Ready to Post' },
      posted: { className: 'bg-emerald-100 text-emerald-700', label: 'Posted' },
      failed: { className: 'bg-red-100 text-red-700', label: 'Failed' },
    };
    const c = config[status] || config.pending;
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Replies</SelectItem>
              <SelectItem value="pending">Needs Reply</SelectItem>
              <SelectItem value="ready_to_post">Ready to Post</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            {reviews.length} reviews
          </div>
        </CardContent>
      </Card>

      {/* Replies List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Reply Operations
          </CardTitle>
          <CardDescription>Manage Google review replies</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No reviews matching filter</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {reviews.map((review: any) => (
                  <div
                    key={review.id}
                    className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-medium">{review.author_name}</span>
                          {getStatusBadge(review.reply_status)}
                          {isAdmin && review.clinic?.name && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Building2 className="h-3 w-3" />
                              {review.clinic.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {review.text_content || 'No comment'}
                        </p>
                        {review.ai_suggested_reply && (
                          <div className="p-2 rounded bg-primary/5 border border-primary/20 text-sm">
                            <span className="text-xs text-muted-foreground block mb-1">Reply:</span>
                            <p className="line-clamp-2">{review.ai_suggested_reply}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedReview(review);
                            setReplyText(review.ai_suggested_reply || '');
                          }}
                        >
                          {review.reply_status === 'pending' ? 'Compose' : 'Edit'}
                        </Button>
                        {review.reply_status === 'ready_to_post' && (
                          <Button
                            size="sm"
                            onClick={() => markPosted.mutate(review.id)}
                            disabled={markPosted.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Posted
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Compose Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-xl">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle>Compose Reply</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{selectedReview.author_name}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(selectedReview.review_time), 'PPp')}
                    </span>
                  </div>
                  <p className="text-sm">{selectedReview.text_content || 'No comment'}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Your Reply</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateAiReply}
                      disabled={aiLoading}
                      className="gap-2"
                    >
                      <Sparkles className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
                      AI Generate
                    </Button>
                  </div>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="min-h-[120px]"
                  />
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Note: Replies cannot be auto-posted to Google. You must post manually via Google Business Profile.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedReview(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveReply.mutate()}
                  disabled={!replyText.trim() || saveReply.isPending}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Save Reply
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
