import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useGenerateAIReply } from '@/hooks/useAIReply';
import {
  Star,
  MessageSquare,
  ExternalLink,
  Send,
  Bot,
  Check,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  ThumbsUp,
  ThumbsDown,
  User,
  RefreshCw,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface UnifiedReviewsInboxProps {
  clinicId: string;
  googlePlaceId?: string;
  showAISuggestions?: boolean;
}

interface GoogleReview {
  id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text_content: string | null;
  review_time: string | null;
  reply_text: string | null;
  reply_time: string | null;
  reply_status: string;
  ai_suggested_reply: string | null;
}

interface InternalReview {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  rating: number;
  comment: string | null;
  status: string;
  resolution_notes: string | null;
  ai_suggested_response: string | null;
  created_at: string;
}

type ReviewItem = {
  type: 'google' | 'internal';
  id: string;
  authorName: string;
  rating: number;
  text: string | null;
  date: string;
  replyStatus: string;
  aiSuggestion: string | null;
  original: GoogleReview | InternalReview;
};

export default function UnifiedReviewsInbox({ clinicId, googlePlaceId, showAISuggestions = true }: UnifiedReviewsInboxProps) {
  const queryClient = useQueryClient();
  const generateAIReply = useGenerateAIReply();
  const [activeTab, setActiveTab] = useState<'all' | 'google' | 'internal'>('all');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Fetch clinic name for AI context
  const { data: clinic } = useQuery({
    queryKey: ['clinic', clinicId],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('name').eq('id', clinicId).single();
      return data;
    },
    enabled: !!clinicId,
  });

  // Fetch Google reviews
  const { data: googleReviews = [], isLoading: loadingGoogle } = useQuery({
    queryKey: ['google-reviews', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_reviews')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('review_time', { ascending: false });
      if (error) throw error;
      return (data || []) as GoogleReview[];
    },
    enabled: !!clinicId,
  });

  // Fetch internal reviews
  const { data: internalReviews = [], isLoading: loadingInternal } = useQuery({
    queryKey: ['internal-reviews', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_reviews')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InternalReview[];
    },
    enabled: !!clinicId,
  });

  // Update internal review mutation
  const updateInternalReview = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (notes) {
        updates.resolution_notes = notes;
      }
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('internal_reviews')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-reviews', clinicId] });
      toast.success('Review updated');
      setSelectedReview(null);
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  // Combine and normalize reviews
  const allReviews = useMemo(() => {
    const items: ReviewItem[] = [];

    googleReviews.forEach(r => {
      items.push({
        type: 'google',
        id: r.id,
        authorName: r.author_name,
        rating: r.rating,
        text: r.text_content,
        date: r.review_time || '',
        replyStatus: r.reply_status,
        aiSuggestion: r.ai_suggested_reply,
        original: r,
      });
    });

    internalReviews.forEach(r => {
      items.push({
        type: 'internal',
        id: r.id,
        authorName: r.patient_name,
        rating: r.rating,
        text: r.comment,
        date: r.created_at,
        replyStatus: r.status,
        aiSuggestion: r.ai_suggested_response,
        original: r,
      });
    });

    // Sort by date descending
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return items;
  }, [googleReviews, internalReviews]);

  // Filter reviews
  const filteredReviews = useMemo(() => {
    let items = allReviews;

    // Filter by tab
    if (activeTab === 'google') {
      items = items.filter(r => r.type === 'google');
    } else if (activeTab === 'internal') {
      items = items.filter(r => r.type === 'internal');
    }

    // Filter by rating
    if (filterRating !== 'all') {
      const rating = parseInt(filterRating);
      items = items.filter(r => r.rating === rating);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      items = items.filter(r => r.replyStatus === filterStatus);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(r => 
        r.authorName.toLowerCase().includes(query) ||
        r.text?.toLowerCase().includes(query)
      );
    }

    return items;
  }, [allReviews, activeTab, filterRating, filterStatus, searchQuery]);

  const handleOpenReview = (review: ReviewItem) => {
    setSelectedReview(review);
    setReplyText(review.aiSuggestion || '');
  };

  const handleReply = async () => {
    if (!selectedReview || !replyText.trim()) return;
    setIsReplying(true);

    try {
      if (selectedReview.type === 'internal') {
        await updateInternalReview.mutateAsync({
          id: selectedReview.id,
          status: 'resolved',
          notes: replyText,
        });
      } else {
        // For Google reviews, we'd need to use the Google My Business API
        // For now, just update the local status
        await supabase
          .from('google_reviews')
          .update({
            reply_status: 'replied',
            reply_text: replyText,
            reply_time: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', selectedReview.id);
        
        queryClient.invalidateQueries({ queryKey: ['google-reviews', clinicId] });
        toast.success('Reply saved (note: post to Google manually)');
        setSelectedReview(null);
      }
    } finally {
      setIsReplying(false);
    }
  };

  const useAISuggestion = () => {
    if (selectedReview?.aiSuggestion) {
      setReplyText(selectedReview.aiSuggestion);
    }
  };

  const handleGenerateAIReply = async () => {
    if (!selectedReview) return;
    
    const result = await generateAIReply.mutateAsync({
      review_id: selectedReview.id,
      review_type: selectedReview.type,
      author_name: selectedReview.authorName,
      rating: selectedReview.rating,
      text_content: selectedReview.text || '',
      clinic_name: clinic?.name,
    });

    if (result.reply) {
      setReplyText(result.reply);
      // Update selected review's AI suggestion
      setSelectedReview(prev => prev ? { ...prev, aiSuggestion: result.reply } : null);
    }
  };

  const isLoading = loadingGoogle || loadingInternal;

  const getStatusBadge = (review: ReviewItem) => {
    if (review.type === 'google') {
      switch (review.replyStatus) {
        case 'replied':
          return <Badge className="bg-teal/10 text-teal border-0"><Check className="h-3 w-3 mr-1" />Replied</Badge>;
        case 'pending':
        default:
          return <Badge className="bg-gold/10 text-gold border-0"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      }
    } else {
      switch (review.replyStatus) {
        case 'resolved':
          return <Badge className="bg-teal/10 text-teal border-0"><Check className="h-3 w-3 mr-1" />Resolved</Badge>;
        case 'follow_up':
          return <Badge className="bg-primary/10 text-primary border-0"><MessageSquare className="h-3 w-3 mr-1" />Follow Up</Badge>;
        case 'flagged_fake':
          return <Badge className="bg-coral/10 text-coral border-0"><AlertTriangle className="h-3 w-3 mr-1" />Flagged</Badge>;
        case 'new':
        default:
          return <Badge className="bg-gold/10 text-gold border-0"><Clock className="h-3 w-3 mr-1" />New</Badge>;
      }
    }
  };

  const getRatingStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= rating ? 'text-gold fill-gold' : 'text-muted'}`} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-shrink-0">
          <TabsList className="rounded-xl">
            <TabsTrigger value="all" className="rounded-xl">All ({allReviews.length})</TabsTrigger>
            <TabsTrigger value="google" className="rounded-xl">Google ({googleReviews.length})</TabsTrigger>
            <TabsTrigger value="internal" className="rounded-xl">Internal ({internalReviews.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Select value={filterRating} onValueChange={setFilterRating}>
          <SelectTrigger className="w-[130px]">
            <Star className="h-4 w-4 mr-2" />
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

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews List */}
      <Card className="card-modern">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Reviews Inbox
            </span>
            <Badge variant="outline">{filteredReviews.length} reviews</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No reviews match your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredReviews.map((review) => (
                <button
                  key={`${review.type}-${review.id}`}
                  onClick={() => handleOpenReview(review)}
                  className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      review.type === 'google' ? 'bg-blue-100' : 'bg-coral/10'
                    }`}>
                      {review.type === 'google' ? (
                        <ExternalLink className="h-5 w-5 text-blue-600" />
                      ) : (
                        <User className="h-5 w-5 text-coral" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{review.authorName}</span>
                          {getRatingStars(review.rating)}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusBadge(review)}
                          <Badge variant="outline" className="text-xs">
                            {review.type === 'google' ? 'Google' : 'Private'}
                          </Badge>
                        </div>
                      </div>
                      {review.text && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{review.text}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {review.date && format(new Date(review.date), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-2xl">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    selectedReview.type === 'google' ? 'bg-blue-100' : 'bg-coral/10'
                  }`}>
                    {selectedReview.type === 'google' ? (
                      <ExternalLink className="h-5 w-5 text-blue-600" />
                    ) : (
                      <User className="h-5 w-5 text-coral" />
                    )}
                  </div>
                  <div>
                    <span>{selectedReview.authorName}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {getRatingStars(selectedReview.rating)}
                      {getStatusBadge(selectedReview)}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Review Content */}
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">
                    {selectedReview.date && format(new Date(selectedReview.date), 'MMMM d, yyyy')}
                  </p>
                  {selectedReview.text ? (
                    <p>{selectedReview.text}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No comment provided</p>
                  )}
                </div>

                {/* Contact info for internal reviews */}
                {selectedReview.type === 'internal' && (
                  <div className="p-4 rounded-xl border border-border">
                    <p className="text-sm font-medium mb-2">Contact Information</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Email: {(selectedReview.original as InternalReview).patient_email || 'Not provided'}</p>
                      <p>Phone: {(selectedReview.original as InternalReview).patient_phone || 'Not provided'}</p>
                    </div>
                  </div>
                )}

                {/* AI Suggestion */}
                {showAISuggestions && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        AI Suggested Response
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleGenerateAIReply}
                          disabled={generateAIReply.isPending}
                        >
                          {generateAIReply.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-1" />
                              Generate AI Reply
                            </>
                          )}
                        </Button>
                        {selectedReview.aiSuggestion && (
                          <Button size="sm" variant="outline" onClick={useAISuggestion}>
                            Use This
                          </Button>
                        )}
                      </div>
                    </div>
                    {selectedReview.aiSuggestion ? (
                      <p className="text-sm text-muted-foreground">{selectedReview.aiSuggestion}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Click "Generate AI Reply" to create an AI-suggested response for this review.
                      </p>
                    )}
                  </div>
                )}

                {/* Reply Box */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {selectedReview.type === 'google' ? 'Reply (for reference)' : 'Resolution Notes'}
                  </label>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={selectedReview.type === 'google' 
                      ? 'Write your reply here (post to Google manually)...'
                      : 'Add resolution notes...'}
                    rows={4}
                  />
                </div>

                {/* Status update for internal */}
                {selectedReview.type === 'internal' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateInternalReview.mutate({ id: selectedReview.id, status: 'follow_up' })}
                    >
                      Mark Follow Up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-coral border-coral hover:bg-coral hover:text-white"
                      onClick={() => updateInternalReview.mutate({ id: selectedReview.id, status: 'flagged_fake' })}
                    >
                      Flag as Fake
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedReview(null)}>
                  Cancel
                </Button>
                <Button onClick={handleReply} disabled={isReplying || !replyText.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {selectedReview.type === 'google' ? 'Save Reply' : 'Resolve'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
