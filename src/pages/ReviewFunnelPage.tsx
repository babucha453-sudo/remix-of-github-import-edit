import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, CheckCircle, Building2, Sparkles, Heart, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function ReviewFunnelPage() {
  const { clinicId, clinicSlug } = useParams<{ clinicId?: string; clinicSlug?: string }>();
  const [source, setSource] = useState('link');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setSource(params.get('source') || 'link');
    }
  }, []);
  
  // Debug: Log what params we received
  useEffect(() => {
    console.log('[ReviewFunnel] Component mounted with params:', { clinicId, clinicSlug, source });
  }, [clinicId, clinicSlug]);

  const [step, setStep] = useState<'initial' | 'negative' | 'success'>('initial');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch clinic info
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic-review', clinicId || clinicSlug],
    queryFn: async () => {
      const identifier = clinicId || clinicSlug;
      if (!identifier) throw new Error('No clinic identifier provided');
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      let query = supabase.from('clinics').select('id, name, slug, google_place_id, cover_image_url');
      
      if (isUUID) {
        query = query.eq('id', identifier);
      } else {
        query = query.eq('slug', identifier);
      }
      
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!(clinicId || clinicSlug),
  });
  
  // Debug: Log clinic data when it loads
  useEffect(() => {
    console.log('[ReviewFunnel] Clinic data loaded:', clinic);
  }, [clinic]);

  // Fetch custom review URL from clinic_oauth_tokens
  const { data: oauthData, isLoading: oauthLoading, error: oauthError } = useQuery({
    queryKey: ['clinic-oauth-review-url', clinic?.id],
    queryFn: async () => {
      console.log('[ReviewFunnel] Fetching oauth data for clinic:', clinic!.id);
      const { data, error } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_data')
        .eq('clinic_id', clinic!.id)
        .maybeSingle();
      if (error) {
        console.error('[ReviewFunnel] Error fetching oauth data:', error);
        throw error;
      }
      console.log('[ReviewFunnel] OAuth query returned:', data);
      return data;
    },
    enabled: !!clinic?.id,
    retry: 2,
    staleTime: 0, // Always fetch fresh data
  });
  
  // Debug: Log OAuth data when it loads  
  useEffect(() => {
    console.log('[ReviewFunnel] OAuth state - data:', oauthData, 'loading:', oauthLoading, 'error:', oauthError);
    console.log('[ReviewFunnel] Clinic data:', clinic);
  }, [oauthData, oauthLoading, oauthError, clinic]);

  const getGoogleReviewUrl = (): string | null => {
    console.log('[ReviewFunnel] getGoogleReviewUrl called');
    console.log('[ReviewFunnel] oauthData:', oauthData);
    console.log('[ReviewFunnel] clinic:', clinic);
    
    // Priority 1: Custom review URL from GMB setup (manual or OAuth)
    if (oauthData?.gmb_data) {
      let gmbData: { custom_review_url?: string } = {};
      
      // Handle both object and string forms of gmb_data
      if (typeof oauthData.gmb_data === 'string') {
        try {
          gmbData = JSON.parse(oauthData.gmb_data);
        } catch (e) {
          console.error('[ReviewFunnel] Failed to parse gmb_data string:', e);
        }
      } else if (typeof oauthData.gmb_data === 'object') {
        gmbData = oauthData.gmb_data as { custom_review_url?: string };
      }
      
      console.log('[ReviewFunnel] gmb_data parsed:', gmbData);
      if (gmbData.custom_review_url && gmbData.custom_review_url.trim()) {
        const url = gmbData.custom_review_url.trim();
        console.log('[ReviewFunnel] Using custom review URL:', url);
        return url;
      }
    }
    
    // Priority 2: Google Place ID to construct review URL
    if (clinic?.google_place_id && clinic.google_place_id.trim()) {
      const url = `https://search.google.com/local/writereview?placeid=${clinic.google_place_id.trim()}`;
      console.log('[ReviewFunnel] Using Google Place ID URL:', url);
      return url;
    }
    
    console.log('[ReviewFunnel] No review URL found - oauth data:', oauthData, 'clinic place id:', clinic?.google_place_id);
    return null;
  };

  // Record click
  const recordClick = useMutation({
    mutationFn: async (action: string) => {
      if (!clinic?.id) return;
      await supabase.from('review_clicks').insert({
        clinic_id: clinic.id,
        action,
        user_agent: navigator.userAgent,
        metadata: { source, slug: clinicSlug || clinicId },
      } as any);
    },
  });

  // Record funnel event
  const recordEvent = useMutation({
    mutationFn: async (event: { event_type: 'thumbs_up' | 'thumbs_down'; rating?: number; comment?: string }) => {
      if (!clinic?.id) throw new Error('Clinic not loaded');
      
      const { error } = await supabase.from('review_funnel_events').insert({
        clinic_id: clinic.id,
        source,
        event_type: event.event_type,
        rating: event.rating,
        comment: event.comment,
      });
      if (error) throw error;

      if (event.event_type === 'thumbs_down' && event.rating) {
        await supabase.from('internal_reviews').insert({
          clinic_id: clinic.id,
          patient_name: patientName || 'Anonymous',
          visitor_email: patientEmail || null,
          visitor_phone: patientPhone || null,
          rating: event.rating,
          comment: event.comment || null,
        } as any);
      }
    },
  });

  // Set noindex
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => { meta?.setAttribute('content', 'index, follow'); };
  }, []);

  // Record link opened
  useEffect(() => {
    if (clinic?.id) {
      recordClick.mutate('link_opened');
    }
  }, [clinic?.id]);

  const handleThumbsUp = async () => {
    if (!clinic) {
      console.error('[ReviewFunnel] Cannot proceed - clinic data not loaded');
      toast.error('Please wait while we load clinic information...');
      return;
    }
    
    // Wait for OAuth data to be ready if it's still loading
    if (oauthLoading) {
      console.log('[ReviewFunnel] Waiting for OAuth data to load...');
      toast.info('Loading review settings...');
      return;
    }
    
    setIsRedirecting(true);
    recordClick.mutate('thumbs_up');
    
    try {
      await recordEvent.mutateAsync({ event_type: 'thumbs_up' });
    } catch (err) {
      console.error('[ReviewFunnel] Failed to record event:', err);
    }
    
    // Get the Google review URL with comprehensive fallback
    let googleReviewUrl = getGoogleReviewUrl();
    
    // If no URL found and we have a place ID, construct it directly
    if (!googleReviewUrl && clinic.google_place_id) {
      googleReviewUrl = `https://search.google.com/local/writereview?placeid=${clinic.google_place_id}`;
      console.log('[ReviewFunnel] Using fallback place ID URL:', googleReviewUrl);
    }
    
    console.log('[ReviewFunnel] Thumbs up clicked, final Google URL:', googleReviewUrl);
    
    if (googleReviewUrl) {
      recordClick.mutate('google_redirect');
      toast.success('Redirecting to Google Reviews...');
      // Redirect immediately without timeout
      console.log('[ReviewFunnel] Redirecting now to:', googleReviewUrl);
      window.location.href = googleReviewUrl;
    } else {
      // No Google review URL configured - show thank you page
      console.warn('[ReviewFunnel] No Google review URL configured for clinic:', clinic.id, clinic.name);
      toast.info('Thank you for your feedback! Google review link not yet configured.');
      setStep('success');
      setIsRedirecting(false);
    }
  };

  const handleThumbsDown = () => {
    recordClick.mutate('thumbs_down');
    setStep('negative');
  };

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    recordClick.mutate('feedback_submitted');
    await recordEvent.mutateAsync({
      event_type: 'thumbs_down',
      rating,
      comment: comment.trim() || undefined,
    });
    setStep('success');
    toast.success('Thank you for your feedback');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-sm w-full text-center p-8 bg-white rounded-3xl shadow-xl">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Link Not Found</h1>
          <p className="text-muted-foreground text-sm">This review link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const clinicLogo = clinic.cover_image_url;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary/5 flex flex-col">
      {/* Compact Header with Branding */}
      <header className="w-full py-4 px-4 flex justify-center">
        <div className="flex items-center gap-3">
          {clinicLogo ? (
            <img src={clinicLogo} alt={clinic.name} className="h-10 w-10 rounded-xl object-cover shadow-md" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-md">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">{clinic.name}</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" /> Verified Practice
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-[360px]">
          
          {step === 'initial' && (
            <div className="text-center animate-fade-in">
              {/* Question */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full text-xs font-medium text-primary mb-4">
                  <Sparkles className="h-3 w-3" />
                  Quick Feedback
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-1">How was your visit?</h2>
                <p className="text-muted-foreground text-sm">Your feedback helps us improve</p>
              </div>

              {/* Choice Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleThumbsUp}
                  disabled={recordEvent.isPending || isRedirecting}
                  className="w-full group relative flex items-center gap-4 p-5 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all duration-300 shadow-sm hover:shadow-lg active:scale-[0.98]"
                >
                  {isRedirecting ? (
                    <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-emerald-100">
                      <div className="w-6 h-6 border-3 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-200 transition-transform group-hover:scale-110">
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 10v12" />
                        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                      </svg>
                    </div>
                  )}
                  <div className="text-left flex-1">
                    <span className="text-lg font-bold text-emerald-700 block">Great Experience!</span>
                    <span className="text-xs text-emerald-600/70">I loved my visit</span>
                  </div>
                  <Heart className="h-5 w-5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  onClick={handleThumbsDown}
                  disabled={recordEvent.isPending}
                  className="w-full group relative flex items-center gap-4 p-5 rounded-2xl bg-white border-2 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all duration-300 shadow-sm hover:shadow-lg active:scale-[0.98]"
                >
                  <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200 transition-transform group-hover:scale-110">
                    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 14V2" />
                      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L14 22h0a3.13 3.13 0 0 1-3-3.88Z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <span className="text-lg font-bold text-slate-700 block">Could Be Better</span>
                    <span className="text-xs text-slate-500">Share what we can improve</span>
                  </div>
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground mt-6">
                Your response is confidential
              </p>
            </div>
          )}

          {step === 'negative' && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 14V2" />
                    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L14 22h0a3.13 3.13 0 0 1-3-3.88Z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">We're sorry to hear that</h2>
                <p className="text-muted-foreground text-sm">Help us improve your next visit</p>
              </div>

              <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
                {/* Star Rating */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Your Rating</Label>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1.5 transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          className={`h-9 w-9 transition-colors ${
                            star <= (hoveredRating || rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Your Name (optional)</Label>
                  <Input
                    placeholder="Enter your name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                {/* Email */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Email (optional, so we can contact you)</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                {/* Phone */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Phone (optional)</Label>
                  <Input
                    type="tel"
                    placeholder="(123) 456-7890"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                {/* Comment */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">What can we improve?</Label>
                  <Textarea
                    placeholder="Please share your experience..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="rounded-xl resize-none"
                  />
                </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={rating === 0 || recordEvent.isPending}
                  className="w-full h-12 rounded-xl font-semibold"
                >
                  {recordEvent.isPending ? 'Submitting...' : 'Submit Feedback'}
                </Button>

                <button
                  onClick={() => setStep('initial')}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Go back
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center animate-fade-in">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-2xl opacity-30 animate-pulse" />
                <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto shadow-xl">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Thank You!</h2>
              <p className="text-muted-foreground mb-6">
                Your feedback helps us serve you better.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                <Heart className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">We appreciate you</span>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 text-center">
        <p className="text-[10px] text-muted-foreground">
          Powered by smart reputation management
        </p>
      </footer>
    </div>
  );
}
