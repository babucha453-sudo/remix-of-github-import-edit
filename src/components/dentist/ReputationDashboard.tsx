import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { subDays } from 'date-fns';
import {
  Building2,
  Copy,
  QrCode,
  CheckCircle,
  Lock,
  Zap,
  BarChart3,
  MessageSquare,
  Send,
  Settings,
  ExternalLink,
} from 'lucide-react';

import ReputationKPIHero, { ReputationKPIs } from '@/components/reputation/ReputationKPIHero';
import UnifiedReviewsInbox from '@/components/reputation/UnifiedReviewsInbox';
import ReviewRequestManager from '@/components/reputation/ReviewRequestManager';
import GMBConnectionCard from '@/components/reputation/GMBConnectionCard';
import QRCodeGenerator from '@/components/dentist/QRCodeGenerator';
import { useHasFeature, useClinicSubscription } from '@/hooks/useClinicFeatures';

export default function ReputationDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch clinic (without sensitive gmb fields)
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-reputation', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, google_place_id, rating, review_count, verification_status, gmb_connected')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch oauth tokens separately for last sync info
  const { data: oauthTokens } = useQuery({
    queryKey: ['clinic-oauth-tokens-reputation', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_last_sync_at, gmb_data')
        .eq('clinic_id', clinic?.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  // Feature gating
  const { hasAccess: canAccessSuite, isLoading: featuresLoading } = useHasFeature(clinic?.id || '', 'review_manager');
  const { data: subscription } = useClinicSubscription(clinic?.id || '');

  // Fetch review funnel events
  const { data: funnelEvents = [] } = useQuery({
    queryKey: ['reputation-funnel-events', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch google reviews
  const { data: googleReviews = [] } = useQuery({
    queryKey: ['google-reviews-count', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_reviews')
        .select('id, rating, reply_status, review_time')
        .eq('clinic_id', clinic?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch internal reviews
  const { data: internalReviews = [] } = useQuery({
    queryKey: ['internal-reviews-count', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_reviews')
        .select('id, rating, status, created_at')
        .eq('clinic_id', clinic?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Calculate KPIs
  const kpis: ReputationKPIs = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixtyDaysAgo = subDays(now, 60);
    const fourteenDaysAgo = subDays(now, 14);

    const last30 = funnelEvents.filter((e: any) => new Date(e.created_at) >= thirtyDaysAgo);
    const prev30 = funnelEvents.filter((e: any) => {
      const d = new Date(e.created_at);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    });
    const last14 = funnelEvents.filter((e: any) => new Date(e.created_at) >= fourteenDaysAgo);

    // Average Rating (from Google or internal)
    const avgRating = clinic?.rating || 
      (googleReviews.length > 0 
        ? googleReviews.reduce((sum, r) => sum + r.rating, 0) / googleReviews.length 
        : 0);

    // Review Velocity (positive events in 30 days vs previous)
    const reviewVelocity = last30.filter((e: any) => e.event_type === 'thumbs_up').length - 
                          prev30.filter((e: any) => e.event_type === 'thumbs_up').length;

    // Positive Ratio
    const totalRated = funnelEvents.length;
    const positiveCount = funnelEvents.filter((e: any) => e.event_type === 'thumbs_up').length;
    const positiveRatio = totalRated > 0 ? positiveCount / totalRated : 0;

    // Negative Risk Index (1-3★ in last 14 days)
    const negativeRisk = last14.filter((e: any) => e.rating && e.rating <= 3).length;

    // Response Rate (from google reviews with replies)
    const repliedCount = googleReviews.filter(r => r.reply_status === 'replied').length;
    const responseRate = googleReviews.length > 0 ? repliedCount / googleReviews.length : 0.75;

    // Pending Replies
    const pendingReplies = googleReviews.filter(r => r.reply_status === 'pending').length +
                          internalReviews.filter(r => r.status === 'new').length;

    // Average Response Time (simulated)
    const avgResponseTime = 4.2;

    // Recent Sentiment
    const recentPositive = last14.filter((e: any) => e.event_type === 'thumbs_up').length;
    const recentSentiment = last14.length > 0 ? recentPositive / last14.length : 0.5;

    // Reputation Score Calculation
    const ratingScore = (avgRating / 5) * 50;
    const velocityScore = Math.min(Math.abs(reviewVelocity) / 10, 1) * 20;
    const responseScore = responseRate * 15;
    const sentimentScore = recentSentiment * 15;
    const reputationScore = Math.round(ratingScore + velocityScore + responseScore + sentimentScore);

    return {
      reputationScore,
      avgRating,
      reviewVelocity,
      positiveRatio,
      negativeRisk,
      responseRate,
      avgResponseTime,
      totalResponses: funnelEvents.length,
      thumbsUp: positiveCount,
      thumbsDown: funnelEvents.filter((e: any) => e.event_type === 'thumbs_down').length,
      googleReviewCount: clinic?.review_count || googleReviews.length,
      pendingReplies,
    };
  }, [funnelEvents, googleReviews, internalReviews, clinic]);

  const reviewLink = clinic?.id ? `${window.location.origin}/review/${clinic.id}/` : '';
  const googleReviewLink = clinic?.google_place_id
    ? `https://search.google.com/local/writereview?placeid=${clinic.google_place_id}`
    : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewLink);
      setLinkCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (clinicLoading || featuresLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="text-center py-16">
        <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Practice Linked</h2>
        <p className="text-muted-foreground mb-6">Please claim your practice profile first.</p>
        <Button asChild><Link to="/claim-profile">Claim Your Profile</Link></Button>
      </div>
    );
  }

  if (!canAccessSuite) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Reputation Suite</h1>
          <p className="text-muted-foreground mt-1">Professional review management & analytics</p>
        </div>
        <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-teal/5">
          <CardContent className="py-16 text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-teal/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Unlock Your Reputation Suite</h3>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Get BirdEye-style analytics, AI-powered review management, bulk SMS/WhatsApp review requests, 
              branded QR codes, and real-time reputation monitoring.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-teal">
                <Zap className="h-5 w-5" />
                Upgrade to Pro
              </Button>
              <Button variant="outline" size="lg">View All Plans</Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Current plan: <span className="font-semibold">{subscription?.plan?.name || 'Free'}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with dark theme */}
      <div className="flex flex-col md:flex-row items-start justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-teal/30 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">
              Reputation Suite
            </h1>
          </div>
          <p className="text-white/60 ml-13">Real-time reputation analytics for {clinic.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-slate-800 border-slate-600 text-white hover:bg-slate-700">
                <QrCode className="h-4 w-4" />
                QR Studio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  Review QR Code Studio
                </DialogTitle>
              </DialogHeader>
              <QRCodeGenerator 
                clinicName={clinic.name} 
                clinicSlug={clinic.slug}
                googlePlaceId={clinic.google_place_id || undefined}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={copyLink} className="gap-2 bg-gradient-to-r from-primary to-teal hover:opacity-90 shadow-lg shadow-primary/20">
            {linkCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy Review Link
          </Button>
        </div>
      </div>

      {/* KPI Hero */}
      <ReputationKPIHero kpis={kpis} clinicName={clinic.name} />

      {/* Review Link Card - Dark Theme */}
      <Card className="bg-gradient-to-r from-slate-800/80 via-slate-800/60 to-slate-800/80 border-slate-700/50 shadow-lg">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-primary" />
                Your Review Collection Link
              </h3>
              <p className="text-sm text-white/60 mt-1">
                Share with patients. Happy → Google, Unhappy → Private feedback
              </p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input value={reviewLink} readOnly className="flex-1 md:w-80 bg-slate-900/50 border-slate-600 text-white" />
              <Button onClick={copyLink} size="icon" variant="outline" className="bg-slate-700 border-slate-600 hover:bg-slate-600">
                {linkCopied ? <CheckCircle className="h-4 w-4 text-teal" /> : <Copy className="h-4 w-4" />}
              </Button>
              {googleReviewLink && (
                <Button variant="outline" size="icon" className="bg-slate-700 border-slate-600 hover:bg-slate-600" asChild>
                  <a href={googleReviewLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs - Dark Theme */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50">
          <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-2 text-white/60">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="inbox" className="rounded-xl data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-2 text-white/60">
            <MessageSquare className="h-4 w-4" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-2 text-white/60">
            <Send className="h-4 w-4" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="gmb" className="rounded-xl data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-2 text-white/60">
            <img src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" alt="G" className="h-4 w-4" />
            GMB
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-2 text-white/60">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* How It Works - Dark Theme */}
            <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/50 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary text-lg">1</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Patient Opens Link</p>
                    <p className="text-sm text-white/60">Share via SMS, email, or QR code</p>
                  </div>
                </div>
                <div className="flex gap-4 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary text-lg">2</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Thumbs Up or Down</p>
                    <p className="text-sm text-white/60">Patient indicates satisfaction</p>
                  </div>
                </div>
                <div className="flex gap-4 p-3 rounded-xl bg-teal/10 hover:bg-teal/20 transition-colors border border-teal/20">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal/30 to-teal/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-teal" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Happy → Google Review</p>
                    <p className="text-sm text-white/60">Redirected to leave a public review</p>
                  </div>
                </div>
                <div className="flex gap-4 p-3 rounded-xl bg-coral/10 hover:bg-coral/20 transition-colors border border-coral/20">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-coral/30 to-coral/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-coral" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Unhappy → Private Feedback</p>
                    <p className="text-sm text-white/60">Captured privately for you to address</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GMB Connection Status */}
            <GMBConnectionCard
              clinicId={clinic.id}
              clinicName={clinic.name}
              googlePlaceId={clinic.google_place_id}
              lastSyncAt={(oauthTokens?.gmb_data as any)?.fetched_at || oauthTokens?.gmb_last_sync_at}
            />
          </div>
        </TabsContent>

        <TabsContent value="inbox" className="mt-6">
          <UnifiedReviewsInbox clinicId={clinic.id} />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <ReviewRequestManager clinicId={clinic.id} clinicSlug={clinic.slug} />
        </TabsContent>

        <TabsContent value="gmb" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <GMBConnectionCard
              clinicId={clinic.id}
              clinicName={clinic.name}
              googlePlaceId={clinic.google_place_id}
              lastSyncAt={(oauthTokens?.gmb_data as any)?.fetched_at || oauthTokens?.gmb_last_sync_at}
            />
            <Card className="bg-slate-800/80 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Google Reviews Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/50 text-center">
                    <p className="text-3xl font-bold text-white">{clinic.rating?.toFixed(1) || '-'}</p>
                    <p className="text-sm text-white/60">Average Rating</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/50 text-center">
                    <p className="text-3xl font-bold text-white">{clinic.review_count || 0}</p>
                    <p className="text-sm text-white/60">Total Reviews</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card className="bg-slate-800/80 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white">Reputation Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/60">Configure your review collection and automation settings here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}