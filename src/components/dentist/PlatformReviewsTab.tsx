import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Star,
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Calendar,
  User,
  CheckCircle,
  MessageSquare,
  Sparkles,
  Send,
  ThumbsUp,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { NoPracticeLinked } from './NoPracticeLinked';

interface PlatformReview {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  patient_name: string;
  rating: number;
  review_text: string | null;
  is_verified: boolean;
  is_public: boolean;
  created_at: string;
}

export default function PlatformReviewsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-reviews', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: patients } = useQuery({
    queryKey: ['clinic-patients', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, email')
        .eq('clinic_id', clinic?.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['platform-reviews', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_reviews')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PlatformReview[];
    },
    enabled: !!clinic?.id,
  });

  const addReview = useMutation({
    mutationFn: async () => {
      if (!clinic?.id || !patientName || !rating) {
        throw new Error('Patient name and rating are required');
      }
      const { error } = await supabase.from('platform_reviews').insert({
        clinic_id: clinic.id,
        patient_name: patientName,
        rating,
        review_text: reviewText || null,
        is_verified: true,
        is_public: isPublic,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reviews'] });
      setIsAddingReview(false);
      resetForm();
      toast.success('Review added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add review');
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from('platform_reviews')
        .update({ is_public: isPublic })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reviews'] });
      toast.success('Visibility updated');
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_reviews')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reviews'] });
      toast.success('Review deleted');
    },
  });

  const resetForm = () => {
    setPatientName('');
    setPatientEmail('');
    setRating(5);
    setReviewText('');
    setIsPublic(true);
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  const publicReviews = reviews?.filter(r => r.is_public) || [];
  const avgRating = reviews?.length 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 'N/A';

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
            <Star className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Platform Reviews</h2>
            <p className="text-sm text-muted-foreground">
              Verified patient reviews • {publicReviews.length} public
            </p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setIsAddingReview(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Review
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-teal/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgRating}</p>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviews?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold/20 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {reviews?.filter(r => r.rating >= 4).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">5-Star Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      {reviewsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : reviews?.length === 0 ? (
        <Card className="border-2 border-dashed border-primary/20">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No Reviews Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add verified reviews from your patients
            </p>
            <Button onClick={() => setIsAddingReview(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Review
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews?.map((review) => (
            <Card key={review.id} className={cn(!review.is_public && 'opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="p-0.5"
                        disabled
                      >
                        <Star
                          className={cn(
                            'h-4 w-4',
                            star <= review.rating
                              ? 'fill-gold text-gold'
                              : 'text-muted'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{review.patient_name}</h3>
                        {review.is_verified && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(review.created_at), 'MMM d, yyyy')}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleVisibility.mutate({ 
                            id: review.id, 
                            isPublic: !review.is_public 
                          })}
                        >
                          {review.is_public ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteReview.mutate(review.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-muted-foreground mt-2">
                        "{review.review_text}"
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Review Dialog */}
      <Dialog open={isAddingReview} onOpenChange={setIsAddingReview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Add Verified Review
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Patient Name *</Label>
              <Input
                placeholder="Enter patient name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Patient Email (optional)</Label>
              <Input
                type="email"
                placeholder="patient@email.com"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rating *</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        'h-8 w-8',
                        star <= rating
                          ? 'fill-gold text-gold'
                          : 'text-muted hover:text-gold'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Review (optional)</Label>
              <Textarea
                placeholder="Write their review..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingReview(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addReview.mutate()}
              disabled={addReview.isPending || !patientName || !rating}
            >
              {addReview.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Add Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}