import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Copy,
  QrCode,
  Send,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Target,
  BarChart3,
  Clock,
  Users,
  Sparkles,
  ExternalLink,
  Lock,
  Building2,
  Brain,
  Zap,
  Eye,
} from 'lucide-react';
import QRCodeGenerator from './QRCodeGenerator';
import { useHasFeature, useClinicSubscription } from '@/hooks/useClinicFeatures';

interface ReviewFunnelEvent {
  id: string;
  clinic_id: string;
  source: string;
  event_type: 'thumbs_up' | 'thumbs_down';
  rating?: number;
  comment?: string;
  created_at: string;
}

export default function ReputationGrowthTab() {
  const { user } = useAuth();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch clinic
  const { data: clinic, isLoading } = useQuery({
    queryKey: ['reputation-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, google_place_id, rating, review_count, verification_status')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Feature gating
  const { hasAccess: canAccessReputation } = useHasFeature(clinic?.id, 'review_manager');
  const { data: subscription } = useClinicSubscription(clinic?.id);

  // Fetch funnel events
  const { data: funnelEvents = [] } = useQuery({
    queryKey: ['reputation-funnel', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []) as ReviewFunnelEvent[];
    },
    enabled: !!clinic?.id,
  });

  // Fetch review requests
  const { data: reviewRequests = [] } = useQuery({
    queryKey: ['reputation-requests', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_requests')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!clinic?.id && canAccessReputation,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No Practice Linked</h2>
        <p className="text-muted-foreground mb-6">
          Please claim your practice profile first.
        </p>
        <Button asChild>
          <Link to="/claim-profile">Claim Your Profile</Link>
        </Button>
      </div>
    );
  }

  // Calculate metrics
  const rating = Number(clinic.rating) || 0;
  const reviewCount = clinic.review_count || 0;
  const thumbsUp = funnelEvents.filter(e => e.event_type === 'thumbs_up').length;
  const thumbsDown = funnelEvents.filter(e => e.event_type === 'thumbs_down').length;
  const totalEvents = funnelEvents.length;
  const conversionRate = totalEvents > 0 ? Math.round((thumbsUp / totalEvents) * 100) : 0;
  const negativeFeedback = funnelEvents.filter(e => e.event_type === 'thumbs_down');
  const avgPrivateRating = negativeFeedback.filter(e => e.rating)
    .reduce((acc, e, _, arr) => acc + (e.rating || 0) / arr.length, 0) || 0;

  // Calculate reputation score (internal)
  const reputationScore = Math.min(100, Math.round(
    (rating / 5 * 40) + 
    (conversionRate * 0.3) + 
    (reviewCount > 50 ? 20 : reviewCount * 0.4) + 
    (clinic.verification_status === 'verified' ? 10 : 0)
  ));

  const reviewLink = `${window.location.origin}/review/${clinic.id}/`;
  const googleReviewLink = clinic.google_place_id 
    ? `https://search.google.com/local/writereview?placeid=${clinic.google_place_id}`
    : null;

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

  // AI Insights
  const aiInsights = [
    negativeFeedback.some(f => f.comment?.toLowerCase().includes('wait')) ? {
      type: 'insight',
      icon: Clock,
      title: 'Common complaint: Wait times',
      description: 'Multiple patients mentioned long waiting times. Consider optimizing scheduling.',
    } : null,
    thumbsDown > thumbsUp * 0.5 ? {
      type: 'warning',
      icon: AlertCircle,
      title: 'High negative feedback rate',
      description: 'Your negative feedback rate is above average. Review common issues.',
    } : null,
    conversionRate > 70 ? {
      type: 'success',
      icon: CheckCircle,
      title: 'Great conversion rate!',
      description: 'Most patients are leaving positive feedback. Keep it up!',
    } : null,
    reviewCount < 20 ? {
      type: 'action',
      icon: Target,
      title: 'Build your review base',
      description: `You have ${reviewCount} reviews. Aim for 50+ to rank higher in search.`,
    } : null,
    {
      type: 'tip',
      icon: Lightbulb,
      title: 'Best time to ask for reviews',
      description: 'Send review requests within 2 hours of appointment completion.',
    },
  ].filter(Boolean).slice(0, 4);

  // Show locked state for free users
  if (!canAccessReputation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Reputation & Growth
            </h2>
            <p className="text-muted-foreground">AI-powered reputation management</p>
          </div>
        </div>

        <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-16 text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-teal flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Lock className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Unlock Reputation Management</h3>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Get access to AI-powered reputation insights, review collection tools, 
              branded QR codes, and bulk review request campaigns. Available on Verified and Pro plans.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-teal">
                <Zap className="h-4 w-4" />
                Upgrade Now
              </Button>
              <Button variant="outline" size="lg">
                View All Plans
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Current plan: <span className="font-medium">{subscription?.plan?.name || 'Free'}</span>
            </p>
          </CardContent>
        </Card>

        {/* Preview of what they'd get */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50">
          <Card>
            <CardContent className="p-4 text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">AI Insights</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <QrCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Branded QR Codes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Send className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Bulk Requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Analytics</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Reputation & Growth
          </h2>
          <p className="text-muted-foreground">AI-powered reputation management for {clinic.name}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <QrCode className="h-4 w-4 mr-2" />
                QR Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Review QR Code</DialogTitle>
              </DialogHeader>
              <QRCodeGenerator 
                clinicName={clinic.name} 
                clinicSlug={clinic.slug}
                googlePlaceId={clinic.google_place_id || undefined}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={copyLink} className="bg-gradient-to-r from-primary to-teal">
            {linkCopied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy Review Link
          </Button>
        </div>
      </div>

      {/* Reputation Score & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Reputation Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center mb-4">
                <svg className="h-32 w-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="url(#gradient)"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${reputationScore * 3.52} 352`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute text-4xl font-bold">{reputationScore}</span>
              </div>
              <Badge variant={reputationScore >= 70 ? 'default' : reputationScore >= 50 ? 'secondary' : 'destructive'}>
                {reputationScore >= 70 ? 'Excellent' : reputationScore >= 50 ? 'Good' : 'Needs Work'}
              </Badge>
              <p className="text-xs text-muted-foreground mt-3">
                Based on Google rating, conversion rate, reviews, and verification status
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-gold" />
                    Google Rating
                  </span>
                  <span className="font-bold">{rating.toFixed(1)}/5</span>
                </div>
                <Progress value={rating * 20} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-teal" />
                    Conversion Rate
                  </span>
                  <span className="font-bold">{conversionRate}%</span>
                </div>
                <Progress value={conversionRate} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    Review Count
                  </span>
                  <span className="font-bold">{reviewCount}</span>
                </div>
                <Progress value={Math.min(100, reviewCount * 2)} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-coral" />
                    Private Feedback Avg
                  </span>
                  <span className="font-bold">{avgPrivateRating.toFixed(1)}/5</span>
                </div>
                <Progress value={avgPrivateRating * 20} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Link Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-teal/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-display font-bold text-lg">Your Review Collection Link</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Share with patients. Happy → Google, Unhappy → Private feedback
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input value={reviewLink} readOnly className="w-80 bg-background" />
              <Button onClick={copyLink} size="icon" variant="outline">
                {linkCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              {googleReviewLink && (
                <Button variant="outline" size="icon" asChild>
                  <a href={googleReviewLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="analytics">
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="analytics" className="rounded-xl">Analytics</TabsTrigger>
          <TabsTrigger value="feedback" className="rounded-xl">Private Feedback</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl">Requests Sent</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Funnel Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-xl bg-muted/50">
                      <Eye className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">{totalEvents}</p>
                      <p className="text-xs text-muted-foreground">Total Views</p>
                    </div>
                    <div className="p-4 rounded-xl bg-teal/10">
                      <ThumbsUp className="h-6 w-6 mx-auto mb-2 text-teal" />
                      <p className="text-2xl font-bold text-teal">{thumbsUp}</p>
                      <p className="text-xs text-muted-foreground">Positive</p>
                    </div>
                    <div className="p-4 rounded-xl bg-coral/10">
                      <ThumbsDown className="h-6 w-6 mx-auto mb-2 text-coral" />
                      <p className="text-2xl font-bold text-coral">{thumbsDown}</p>
                      <p className="text-xs text-muted-foreground">Negative</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Conversion Rate</span>
                      <span className="font-bold text-teal">{conversionRate}%</span>
                    </div>
                    <div className="h-4 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-teal to-primary rounded-full transition-all"
                        style={{ width: `${conversionRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {thumbsUp} out of {totalEvents} directed to Google
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {funnelEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No activity yet. Share your review link!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {funnelEvents.slice(0, 10).map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          {event.event_type === 'thumbs_up' ? (
                            <div className="h-6 w-6 rounded-full bg-teal/20 flex items-center justify-center">
                              <ThumbsUp className="h-3 w-3 text-teal" />
                            </div>
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-coral/20 flex items-center justify-center">
                              <ThumbsDown className="h-3 w-3 text-coral" />
                            </div>
                          )}
                          <span className="text-sm capitalize">{event.event_type.replace('_', ' ')}</span>
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
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <Card>
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
                    <div key={event.id} className="p-4 rounded-xl bg-muted/50 border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {event.rating && (
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < event.rating! ? 'text-gold fill-gold' : 'text-muted'}`}
                                />
                              ))}
                            </div>
                          )}
                          <Badge variant="outline" className="text-xs capitalize">{event.source}</Badge>
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

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Review Requests Sent ({reviewRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviewRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="mb-4">No review requests sent yet</p>
                  <Button>Send Your First Request</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviewRequests.map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {req.recipient_name?.charAt(0) || 'P'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{req.recipient_name || req.recipient_phone}</p>
                          <p className="text-xs text-muted-foreground">{req.recipient_phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs uppercase">{req.channel}</Badge>
                        <Badge 
                          className={`text-xs ${
                            req.status === 'delivered' ? 'bg-teal/20 text-teal' :
                            req.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                            req.status === 'failed' ? 'bg-red-100 text-red-600' :
                            'bg-muted'
                          }`}
                        >
                          {req.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(req.created_at), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI-Powered Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {aiInsights.map((insight, index) => {
                  if (!insight) return null;
                  const Icon = insight.icon;
                  return (
                    <div 
                      key={index}
                      className={`p-4 rounded-xl border ${
                        insight.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                        insight.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
                        insight.type === 'action' ? 'bg-blue-50 border-blue-200' :
                        'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          insight.type === 'warning' ? 'bg-amber-100' :
                          insight.type === 'success' ? 'bg-emerald-100' :
                          insight.type === 'action' ? 'bg-blue-100' :
                          'bg-muted'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            insight.type === 'warning' ? 'text-amber-600' :
                            insight.type === 'success' ? 'text-emerald-600' :
                            insight.type === 'action' ? 'text-blue-600' :
                            'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{insight.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-xl">
                <p className="text-sm text-muted-foreground text-center">
                  <Sparkles className="h-4 w-4 inline mr-1" />
                  AI insights are generated based on your feedback patterns and industry benchmarks. 
                  AI never sends messages automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
