import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Link as LinkIcon,
  QrCode,
  Copy,
  ExternalLink,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Eye,
  Send,
  CheckCircle,
  Lock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import QRCodeGenerator from './QRCodeGenerator';
import { useHasFeature, useClinicSubscription } from '@/hooks/useClinicFeatures';

interface ReviewManagerProps {
  clinicId: string;
  clinicName: string;
  googlePlaceId?: string;
}

interface ReviewFunnelEvent {
  id: string;
  clinic_id: string;
  source: string;
  event_type: 'thumbs_up' | 'thumbs_down';
  rating?: number;
  comment?: string;
  created_at: string;
}

export default function ReviewManager({ clinicId, clinicName, googlePlaceId }: ReviewManagerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Feature gating
  const { hasAccess: canAccessReviewManager, isLoading: featuresLoading } = useHasFeature(clinicId, 'review_manager');
  const { data: subscription } = useClinicSubscription(clinicId);

  // Fetch clinic slug for review link
  const { data: clinic } = useQuery({
    queryKey: ['clinic-slug', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('slug')
        .eq('id', clinicId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const clinicSlug = clinic?.slug || clinicId;
  
  // Generate review link using slug
  const reviewLink = `${window.location.origin}/review/${clinicId}/`;
  const googleReviewLink = googlePlaceId 
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : null;

  // Fetch funnel events from database
  const { data: funnelEvents = [], isLoading } = useQuery({
    queryKey: ['review-funnel', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ReviewFunnelEvent[];
    },
  });

  // Copy link to clipboard
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewLink);
      setLinkCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // Stats
  const totalEvents = funnelEvents?.length || 0;
  const thumbsUp = funnelEvents?.filter(e => e.event_type === 'thumbs_up').length || 0;
  const thumbsDown = funnelEvents?.filter(e => e.event_type === 'thumbs_down').length || 0;
  const avgRating = funnelEvents?.filter(e => e.rating)
    .reduce((acc, e, _, arr) => acc + (e.rating || 0) / arr.length, 0) || 0;

  // Negative feedback list
  const negativeFeedback = funnelEvents?.filter(e => e.event_type === 'thumbs_down') || [];

  // Feature gating - show upgrade prompt for free clinics
  if (!featuresLoading && !canAccessReviewManager) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold">Review Manager</h2>
            <p className="text-muted-foreground">Collect and manage patient feedback</p>
          </div>
        </div>
        
        <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Upgrade to Access Review Manager</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              The Review Manager helps you collect Google reviews, capture private feedback, 
              and send bulk review requests via SMS/WhatsApp. Available on Verified and Pro plans.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Upgrade Now
              </Button>
              <Button variant="outline" size="lg">
                View Plans
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Current plan: {subscription?.plan?.name || 'Free'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Review Manager</h2>
          <p className="text-muted-foreground">Collect and manage patient feedback for {clinicName}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <QrCode className="h-4 w-4 mr-2" />
                Get QR Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Review QR Code</DialogTitle>
              </DialogHeader>
              <QRCodeGenerator 
                clinicName={clinicName} 
                clinicSlug={clinicSlug}
                googlePlaceId={googlePlaceId}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={copyLink}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Copy Review Link
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Eye className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalEvents}</p>
              <p className="text-sm text-muted-foreground">Total Responses</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <ThumbsUp className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{thumbsUp}</p>
              <p className="text-sm text-muted-foreground">Happy Patients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <ThumbsDown className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{thumbsDown}</p>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Star className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Avg Rating (Private)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Link Card */}
      <Card className="card-modern border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg">Your Review Collection Link</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Share this link with patients to collect reviews. Happy patients go to Google, unhappy patients give private feedback.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input value={reviewLink} readOnly className="w-80 bg-background" />
              <Button onClick={copyLink}>
                {linkCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              {googleReviewLink && (
                <Button variant="outline" asChild>
                  <a href={googleReviewLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
          <TabsTrigger value="feedback" className="rounded-xl">Private Feedback</TabsTrigger>
          <TabsTrigger value="funnel" className="rounded-xl">Funnel Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Patient Opens Link</p>
                    <p className="text-sm text-muted-foreground">Share the link via SMS, email, or QR code</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Thumbs Up or Down</p>
                    <p className="text-sm text-muted-foreground">Patient indicates their satisfaction</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-teal-light flex items-center justify-center flex-shrink-0">
                    <ThumbsUp className="h-4 w-4 text-teal" />
                  </div>
                  <div>
                    <p className="font-medium">Happy → Google Review</p>
                    <p className="text-sm text-muted-foreground">Redirected to leave a public Google review</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-coral-light flex items-center justify-center flex-shrink-0">
                    <ThumbsDown className="h-4 w-4 text-coral" />
                  </div>
                  <div>
                    <p className="font-medium">Unhappy → Private Feedback</p>
                    <p className="text-sm text-muted-foreground">Captures feedback privately for you to address</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Funnel Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Conversion Rate</span>
                    <span className="font-bold text-teal">
                      {totalEvents > 0 ? ((thumbsUp / totalEvents) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="h-4 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-teal to-primary rounded-full transition-all"
                      style={{ width: `${totalEvents > 0 ? (thumbsUp / totalEvents) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {thumbsUp} out of {totalEvents} patients directed to Google
                  </p>

                  <div className="pt-4 border-t border-border">
                    <p className="font-medium mb-2">Tips to Improve</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Send link right after appointment</li>
                      <li>• Include personalized message</li>
                      <li>• Follow up on private feedback quickly</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Private Feedback ({negativeFeedback.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {negativeFeedback.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ThumbsUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No negative feedback yet. Great job!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {negativeFeedback.map((event) => (
                    <div key={event.id} className="p-4 rounded-xl bg-muted/50 border border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {event.rating && (
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < event.rating! ? 'text-gold fill-gold' : 'text-muted'}`}
                                />
                              ))}
                            </div>
                          )}
                          <Badge variant="outline" className="capitalize">{event.source}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      {event.comment && (
                        <p className="mt-3 text-sm">{event.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : funnelEvents?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No funnel activity yet. Share your review link to get started!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {funnelEvents?.slice(0, 20).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        {event.event_type === 'thumbs_up' ? (
                          <div className="h-8 w-8 rounded-full bg-teal-light flex items-center justify-center">
                            <ThumbsUp className="h-4 w-4 text-teal" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-coral-light flex items-center justify-center">
                            <ThumbsDown className="h-4 w-4 text-coral" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {event.event_type === 'thumbs_up' ? 'Redirected to Google' : 'Private Feedback'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">via {event.source}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
