import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ThumbsUp, ThumbsDown, Star, CheckCircle, Building2, Heart, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'initial' | 'negative_form' | 'success' | 'expired';

interface RequestData {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_email: string | null;
  recipient_name: string | null;
  short_code: string | null;
  status: string;
  expires_at: string | null;
  clinic: {
    id: string;
    name: string;
    slug: string;
    google_place_id: string | null;
    cover_image_url: string | null;
  } | null;
}

export default function ReviewRequestPage() {
  const { requestCode } = useParams<{ requestCode: string }>();
  const [step, setStep] = useState<Step>('initial');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);

  // Fetch request by short code
  const { data: request, isLoading, error } = useQuery({
    queryKey: ['review-request', requestCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select(`
          id, clinic_id, patient_id, patient_name, patient_email, recipient_name, short_code, status, expires_at,
          clinic:clinics(id, name, slug, google_place_id, cover_image_url)
        `)
        .eq('short_code', requestCode)
        .single();
      
      if (error) throw error;
      return data as unknown as RequestData;
    },
    enabled: !!requestCode,
  });

  // Set noindex for review request pages - they should not be indexed
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    
    return () => {
      meta?.setAttribute('content', 'index, follow');
    };
  }, []);

  // Check if request is expired
  useEffect(() => {
    if (request?.expires_at && new Date(request.expires_at) < new Date()) {
      setStep('expired');
    }
    // Use patient_name or recipient_name
    const name = request?.patient_name || request?.recipient_name;
    if (name) {
      setPatientName(name);
    }
    if (request?.patient_email) {
      setPatientEmail(request.patient_email);
    }
  }, [request]);

  // Record click action
  const recordClick = useMutation({
    mutationFn: async (action: string) => {
      if (!request?.clinic?.id) return;
      
      const { error } = await supabase.from('review_clicks').insert({
        request_id: request.id,
        clinic_id: request.clinic.id,
        action,
        user_agent: navigator.userAgent,
        metadata: { source: 'review_request_page' },
      } as any);
      
      if (error) console.error('Failed to record click:', error);
    },
  });

  // Update request status
  const updateRequest = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!request?.id) return;
      
      const { error } = await supabase
        .from('review_requests')
        .update(updates as any)
        .eq('id', request.id);
      
      if (error) console.error('Failed to update request:', error);
    },
  });

  // Submit internal review (negative feedback)
  const submitInternalReview = useMutation({
    mutationFn: async () => {
      if (!request?.clinic?.id) throw new Error('No clinic');
      
      const { error } = await supabase.from('internal_reviews').insert({
        clinic_id: request.clinic.id,
        request_id: request.id,
        patient_id: request.patient_id,
        patient_name: patientName,
        patient_email: patientEmail || null,
        rating,
        comment: comment.trim() || null,
      } as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      recordClick.mutate('feedback_submitted');
      updateRequest.mutate({
        status: 'completed',
        completed_at: new Date().toISOString(),
        outcome: 'negative',
      });
      setStep('success');
      toast.success('Thank you for your feedback');
    },
    onError: (error) => {
      toast.error('Failed to submit: ' + error.message);
    },
  });

  // Record link opened on mount
  useEffect(() => {
    if (request?.id && request?.status === 'sent') {
      recordClick.mutate('link_opened');
      updateRequest.mutate({
        status: 'opened',
        opened_at: new Date().toISOString(),
      });
    }
  }, [request?.id]);

  // Handle thumbs up - redirect to Google
  const handleThumbsUp = async () => {
    recordClick.mutate('thumbs_up');
    
    if (request?.clinic?.google_place_id) {
      recordClick.mutate('google_redirect');
      updateRequest.mutate({
        status: 'completed',
        completed_at: new Date().toISOString(),
        outcome: 'positive',
        google_redirect_clicked: true,
      });
      
      // Also record to legacy funnel events for compatibility
      await supabase.from('review_funnel_events').insert({
        clinic_id: request.clinic.id,
        source: 'review_request',
        event_type: 'thumbs_up',
      });
      
      window.location.href = `https://search.google.com/local/writereview?placeid=${request.clinic.google_place_id}`;
    } else {
      toast.success('Thank you for your positive feedback!');
      setStep('success');
    }
  };

  // Handle thumbs down - show feedback form
  const handleThumbsDown = () => {
    recordClick.mutate('thumbs_down');
    setStep('negative_form');
  };

  // Submit negative feedback
  const handleSubmitFeedback = async () => {
    if (!patientName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    // Also record to legacy funnel events for compatibility
    await supabase.from('review_funnel_events').insert({
      clinic_id: request?.clinic?.id,
      source: 'review_request',
      event_type: 'thumbs_down',
      rating,
      comment: comment.trim() || null,
    });

    submitInternalReview.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-teal/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-teal/5 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
            <p className="text-muted-foreground">This review link is invalid or has been used.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-teal/5 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
            <p className="text-muted-foreground">This review request has expired. Please contact the clinic for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clinic = request.clinic;
  const displayName = request.patient_name || request.recipient_name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-teal/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-teal/10 rounded-full blur-3xl" />
        </div>

        {/* Main Content */}
        <div className="relative z-10">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            {clinic?.cover_image_url ? (
              <img 
                src={clinic.cover_image_url} 
                alt={clinic.name}
                className="h-20 w-20 rounded-2xl object-cover mx-auto mb-4 shadow-lg border-2 border-white"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-teal flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Building2 className="h-10 w-10 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">
              {clinic?.name}
            </h1>
            <p className="text-muted-foreground mt-2">We value your feedback!</p>
            {displayName && (
              <p className="text-sm text-primary mt-1">Hi {displayName}!</p>
            )}
          </div>

          {/* Main Card */}
          <Card className="shadow-2xl border-0 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary via-teal to-primary" />
            
            <CardContent className="p-8">
              {step === 'initial' && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary mb-6">
                    <Sparkles className="h-4 w-4" />
                    Your opinion matters
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-2">How was your experience?</h2>
                  <p className="text-muted-foreground mb-8">Your feedback helps us serve you better</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleThumbsUp}
                      disabled={recordClick.isPending}
                      className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br from-teal/10 to-teal/5 hover:from-teal/20 hover:to-teal/10 border-2 border-teal/20 hover:border-teal/40 transition-all duration-300 hover:shadow-lg hover:shadow-teal/20 hover:-translate-y-1"
                    >
                      <div className="h-24 w-24 rounded-full bg-gradient-to-br from-teal/30 to-teal/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <ThumbsUp className="h-12 w-12 text-teal" />
                      </div>
                      <div>
                        <span className="text-xl font-bold text-teal block">Great!</span>
                        <span className="text-sm text-muted-foreground">Love it</span>
                      </div>
                      <Heart className="absolute top-4 right-4 h-5 w-5 text-teal/40 group-hover:text-teal group-hover:scale-125 transition-all" />
                    </button>

                    <button
                      onClick={handleThumbsDown}
                      disabled={recordClick.isPending}
                      className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br from-coral/10 to-coral/5 hover:from-coral/20 hover:to-coral/10 border-2 border-coral/20 hover:border-coral/40 transition-all duration-300 hover:shadow-lg hover:shadow-coral/20 hover:-translate-y-1"
                    >
                      <div className="h-24 w-24 rounded-full bg-gradient-to-br from-coral/30 to-coral/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <ThumbsDown className="h-12 w-12 text-coral" />
                      </div>
                      <div>
                        <span className="text-xl font-bold text-coral block">Not Great</span>
                        <span className="text-sm text-muted-foreground">Could improve</span>
                      </div>
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-8">
                    Your response is tracked and helps us improve
                  </p>
                </div>
              )}

              {step === 'negative_form' && (
                <div>
                  <div className="text-center mb-6">
                    <div className="h-14 w-14 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-3">
                      <ThumbsDown className="h-7 w-7 text-coral" />
                    </div>
                    <h2 className="text-xl font-bold mb-1">We're sorry to hear that</h2>
                    <p className="text-sm text-muted-foreground">Your feedback will help us do better</p>
                  </div>
                  
                  {/* Patient Name (required) */}
                  <div className="mb-4">
                    <Label htmlFor="patientName" className="text-sm font-semibold">
                      Your Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="patientName"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter your name"
                      className="mt-1"
                    />
                  </div>

                  {/* Email (optional) */}
                  <div className="mb-4">
                    <Label htmlFor="patientEmail" className="text-sm font-semibold">
                      Email <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="patientEmail"
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="mt-1"
                    />
                  </div>
                  
                  {/* Star Rating */}
                  <div className="mb-6">
                    <Label className="text-sm font-semibold mb-3 block">
                      Rate your experience <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="p-1 transition-all duration-200 hover:scale-110"
                        >
                          <Star
                            className={`h-10 w-10 transition-all duration-200 ${
                              star <= (hoveredRating || rating)
                                ? 'text-gold fill-gold'
                                : 'text-muted hover:text-gold/50'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <p className="text-center text-sm text-muted-foreground mt-2">
                        {rating === 1 && "Very Dissatisfied"}
                        {rating === 2 && "Dissatisfied"}
                        {rating === 3 && "Neutral"}
                        {rating === 4 && "Satisfied"}
                        {rating === 5 && "Very Satisfied"}
                      </p>
                    )}
                  </div>

                  {/* Comment */}
                  <div className="mb-6">
                    <Label htmlFor="comment" className="text-sm font-semibold">
                      What could we do better? <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us about your experience..."
                      rows={3}
                      className="mt-1 resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('initial')}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSubmitFeedback}
                      disabled={submitInternalReview.isPending || !patientName.trim() || rating === 0}
                      className="flex-1 bg-gradient-to-r from-primary to-teal"
                    >
                      Submit Feedback
                    </Button>
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="text-center py-6">
                  <div className="relative inline-block mb-6">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-teal to-primary flex items-center justify-center mx-auto shadow-lg">
                      <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                    <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-gold animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Your feedback is invaluable and helps us deliver better care.
                  </p>
                  <div className="mt-6 p-4 bg-primary/5 rounded-xl">
                    <p className="text-sm text-primary font-medium">
                      We appreciate you taking the time to share your thoughts.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-xs text-muted-foreground">
              Request ID: {request.short_code || request.id.slice(0, 8)} • Powered by <span className="font-semibold text-primary">AppointPanda</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
