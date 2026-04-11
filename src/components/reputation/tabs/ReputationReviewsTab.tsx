import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Star,
  MessageSquare,
  Sparkles,
  Flag,
  AlertTriangle,
  Search,
  Filter,
  ExternalLink,
  Eye,
  Check,
  X,
  Clock,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { createAuditLog } from '@/lib/audit';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationReviewsTab({ clinicId, isAdmin }: Props) {
  const [activeSource, setActiveSource] = useState<'all' | 'google' | 'platform' | 'funnel'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Google reviews
  const { data: googleReviews = [], isLoading: googleLoading } = useQuery({
    queryKey: ['reviews-google', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('google_reviews')
        .select('*, clinic:clinics(id, name, slug)')
        .order('review_time', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []).map((r) => ({ ...r, source: 'google' }));
    },
  });

  // Fetch internal reviews
  const { data: internalReviews = [], isLoading: internalLoading } = useQuery({
    queryKey: ['reviews-internal', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('internal_reviews')
        .select('*, clinic:clinics(id, name, slug)')
        .order('created_at', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []).map((r) => ({ ...r, source: 'platform' }));
    },
  });

  // Fetch funnel events (negative feedback)
  const { data: funnelFeedback = [], isLoading: funnelLoading } = useQuery({
    queryKey: ['reviews-funnel', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('review_funnel_events')
        .select('*, clinic:clinics(id, name)')
        .eq('event_type', 'thumbs_down')
        .order('created_at', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return (data || []).map((r) => ({ ...r, source: 'funnel', rating: r.rating || 1 }));
    },
  });

  // Combine and filter reviews
  const allReviews = useMemo(() => {
    let reviews: any[] = [];
    if (activeSource === 'all' || activeSource === 'google') reviews = [...reviews, ...googleReviews];
    if (activeSource === 'all' || activeSource === 'platform') reviews = [...reviews, ...internalReviews];
    if (activeSource === 'all' || activeSource === 'funnel') reviews = [...reviews, ...funnelFeedback];

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      reviews = reviews.filter(
        (r) =>
          r.author_name?.toLowerCase().includes(q) ||
          r.patient_name?.toLowerCase().includes(q) ||
          r.text_content?.toLowerCase().includes(q) ||
          r.comment?.toLowerCase().includes(q) ||
          r.clinic?.name?.toLowerCase().includes(q)
      );
    }

    // Filter by rating
    if (ratingFilter !== 'all') {
      const rating = parseInt(ratingFilter);
      reviews = reviews.filter((r) => r.rating === rating);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'unreplied') {
        reviews = reviews.filter((r) => r.source === 'google' && r.reply_status !== 'posted');
      } else if (statusFilter === 'new') {
        reviews = reviews.filter((r) => r.source === 'platform' && r.status === 'new');
      }
    }

    // Sort by date
    reviews.sort((a, b) => {
      const dateA = new Date(a.review_time || a.created_at);
      const dateB = new Date(b.review_time || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    return reviews;
  }, [googleReviews, internalReviews, funnelFeedback, activeSource, searchQuery, ratingFilter, statusFilter]);

  // Generate AI reply
  const generateAiReply = async (review: any) => {
    setAiReplyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-reply', {
        body: {
          review_id: review.id,
          review_type: review.source,
          author_name: review.author_name || review.patient_name,
          rating: review.rating,
          text_content: review.text_content || review.comment,
          clinic_name: review.clinic?.name,
        },
      });
      if (error) throw error;
      toast.success('AI reply generated');
      queryClient.invalidateQueries({ queryKey: ['reviews-google'] });
      queryClient.invalidateQueries({ queryKey: ['reviews-internal'] });
      setSelectedReview({ ...review, ai_suggested_reply: data.reply });
    } catch (e: any) {
      toast.error('Failed to generate reply: ' + e.message);
    } finally {
      setAiReplyLoading(false);
    }
  };

  // Update internal review status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('internal_reviews')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await createAuditLog({
        action: 'update_review_status',
        entityType: 'internal_review',
        entityId: id,
        newValues: { status },
      });
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['reviews-internal'] });
      setSelectedReview(null);
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });

  // Flag as fake
  const flagReview = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from('internal_reviews')
        .update({
          status: 'flagged_fake',
          is_fake_suspected: true,
          fake_review_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      await createAuditLog({
        action: 'flag_fake_review',
        entityType: 'internal_review',
        entityId: id,
        newValues: { is_fake_suspected: true, fake_review_reason: reason },
      });
    },
    onSuccess: () => {
      toast.success('Review flagged');
      queryClient.invalidateQueries({ queryKey: ['reviews-internal'] });
      setSelectedReview(null);
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });

  const isLoading = googleLoading || internalLoading || funnelLoading;

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'google':
        return <Badge className="bg-blue-100 text-blue-700">Google</Badge>;
      case 'platform':
        return <Badge className="bg-primary/10 text-primary">Platform</Badge>;
      case 'funnel':
        return <Badge className="bg-amber-100 text-amber-700">Private</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  const getStatusBadge = (review: any) => {
    if (review.source === 'google') {
      return review.reply_status === 'posted' ? (
        <Badge className="bg-emerald-100 text-emerald-700">Replied</Badge>
      ) : (
        <Badge variant="destructive">Needs Reply</Badge>
      );
    }
    if (review.source === 'platform') {
      const colors: Record<string, string> = {
        new: 'bg-blue-100 text-blue-700',
        acknowledged: 'bg-amber-100 text-amber-700',
        follow_up: 'bg-purple-100 text-purple-700',
        resolved: 'bg-emerald-100 text-emerald-700',
        flagged_fake: 'bg-red-100 text-red-700',
      };
      return <Badge className={colors[review.status] || 'bg-muted'}>{review.status}</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Source tabs */}
            <Tabs value={activeSource} onValueChange={(v: any) => setActiveSource(v)} className="flex-1">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All ({googleReviews.length + internalReviews.length + funnelFeedback.length})</TabsTrigger>
                <TabsTrigger value="google">Google ({googleReviews.length})</TabsTrigger>
                <TabsTrigger value="platform">Platform ({internalReviews.length})</TabsTrigger>
                <TabsTrigger value="funnel">Private ({funnelFeedback.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unreplied">Needs Reply</SelectItem>
                <SelectItem value="new">New Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Reviews ({allReviews.length})</CardTitle>
          <CardDescription>Unified inbox for all review types</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : allReviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No reviews found</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3 pr-4">
                {allReviews.map((review) => (
                  <div
                    key={review.id}
                    onClick={() => setSelectedReview(review)}
                    className="p-4 rounded-xl border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Rating */}
                      <div className="flex flex-col items-center gap-1">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white ${
                          review.rating >= 4 ? 'bg-emerald-500' : review.rating >= 3 ? 'bg-amber-500' : 'bg-red-500'
                        }`}>
                          {review.rating}
                        </div>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">
                            {review.author_name || review.patient_name || 'Anonymous'}
                          </span>
                          {getSourceBadge(review.source)}
                          {getStatusBadge(review)}
                          {review.hipaa_flagged && (
                            <Badge variant="destructive" className="text-xs">HIPAA</Badge>
                          )}
                          {review.is_fake_suspected && (
                            <Badge variant="destructive" className="text-xs">Fake</Badge>
                          )}
                          {isAdmin && review.clinic?.name && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Building2 className="h-3 w-3" />
                              {review.clinic.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {review.text_content || review.comment || 'No comment provided'}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{format(new Date(review.review_time || review.created_at), 'MMM d, yyyy')}</p>
                        <p>{format(new Date(review.review_time || review.created_at), 'HH:mm')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Review Details
                  {getSourceBadge(selectedReview.source)}
                  {getStatusBadge(selectedReview)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Review info */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${i < selectedReview.rating ? 'text-amber-500 fill-amber-500' : 'text-muted'}`}
                        />
                      ))}
                    </div>
                    <span className="font-medium">
                      {selectedReview.author_name || selectedReview.patient_name}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(selectedReview.review_time || selectedReview.created_at), 'PPp')}
                    </span>
                  </div>
                  <p>{selectedReview.text_content || selectedReview.comment || 'No comment provided'}</p>
                </div>

                {/* AI Reply Section */}
                {(selectedReview.source === 'google' || selectedReview.source === 'platform') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>AI-Suggested Reply</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateAiReply(selectedReview)}
                        disabled={aiReplyLoading}
                        className="gap-2"
                      >
                        <Sparkles className={`h-4 w-4 ${aiReplyLoading ? 'animate-spin' : ''}`} />
                        Generate Reply
                      </Button>
                    </div>
                    {(selectedReview.ai_suggested_reply || selectedReview.ai_suggested_response) && (
                      <Textarea
                        value={selectedReview.ai_suggested_reply || selectedReview.ai_suggested_response}
                        readOnly
                        className="min-h-[100px]"
                      />
                    )}
                  </div>
                )}

                {/* Sentiment Analysis */}
                {(selectedReview.sentiment_label || selectedReview.sentiment_score) && (
                  <div className="p-3 rounded-lg border">
                    <Label className="text-xs text-muted-foreground">AI Sentiment Analysis</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={
                        selectedReview.sentiment_label === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                        selectedReview.sentiment_label === 'negative' ? 'bg-red-100 text-red-700' :
                        'bg-muted'
                      }>
                        {selectedReview.sentiment_label || 'neutral'}
                      </Badge>
                      {selectedReview.sentiment_score && (
                        <span className="text-sm text-muted-foreground">
                          Score: {selectedReview.sentiment_score}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions for platform reviews */}
                {selectedReview.source === 'platform' && isAdmin && (
                  <div className="flex gap-2 pt-4 border-t">
                    {selectedReview.status !== 'resolved' && (
                      <Button
                        onClick={() => updateStatus.mutate({ id: selectedReview.id, status: 'resolved' })}
                        disabled={updateStatus.isPending}
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Mark Resolved
                      </Button>
                    )}
                    {selectedReview.status === 'new' && (
                      <Button
                        variant="outline"
                        onClick={() => updateStatus.mutate({ id: selectedReview.id, status: 'acknowledged' })}
                        disabled={updateStatus.isPending}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => flagReview.mutate({ id: selectedReview.id, reason: 'Flagged by admin' })}
                      disabled={flagReview.isPending}
                      className="gap-2"
                    >
                      <Flag className="h-4 w-4" />
                      Flag as Fake
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
