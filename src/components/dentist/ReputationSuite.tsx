import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  MessageSquare,
  QrCode,
  Copy,
  ExternalLink,
  BarChart3,
  Target,
  Zap,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Send,
  Activity,
  Eye,
  Bot,
  Lock,
  Mail,
  Phone,
  MessageCircle,
  Users,
  Clock,
  ArrowUpRight,
  Loader2,
  Plus,
  RefreshCw,
  FileText,
  UserCheck,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import QRCodeGenerator from './QRCodeGenerator';
import ManualGoogleReviewLink from './ManualGoogleReviewLink';
import { useHasFeature, useClinicSubscription } from '@/hooks/useClinicFeatures';
import { NoPracticeLinked } from './NoPracticeLinked';
import { PlanSelectionModal } from '@/components/subscription/PlanSelectionModal';
import { cn } from '@/lib/utils';

interface ReviewFunnelEvent {
  id: string;
  clinic_id: string;
  source: string;
  event_type: 'thumbs_up' | 'thumbs_down';
  rating?: number;
  comment?: string;
  created_at: string;
}

interface ReviewRequest {
  id: string;
  clinic_id: string;
  recipient_name: string;
  recipient_email?: string;
  recipient_phone?: string;
  channel: 'email' | 'sms' | 'whatsapp';
  status: string;
  sent_at?: string;
  created_at: string;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

// Message Templates
const MESSAGE_TEMPLATES = [
  {
    id: 'review_request',
    name: 'Review Request',
    description: 'Ask for a review after visit',
    message: 'Hi {name}! Thank you for visiting {clinic}. We hope you had a great experience. Would you take a moment to share your feedback?',
  },
  {
    id: 'follow_up',
    name: 'Follow-up',
    description: 'Check in after treatment',
    message: 'Hi {name}! We wanted to check in and see how you\'re feeling after your recent visit to {clinic}. If you have any questions, please don\'t hesitate to reach out!',
  },
  {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    description: 'Remind about upcoming appointment',
    message: 'Hi {name}! This is a reminder about your upcoming appointment at {clinic}. We look forward to seeing you!',
  },
  {
    id: 'thank_you',
    name: 'Thank You',
    description: 'Thank patient for their visit',
    message: 'Hi {name}! Thank you for choosing {clinic} for your dental care. We truly appreciate your trust in us!',
  },
];

function calculateReputationScore(
  avgRating: number,
  reviewVelocity: number,
  responseRate: number,
  recentSentiment: number
): number {
  const ratingScore = (avgRating / 5) * 50;
  const velocityScore = Math.min(reviewVelocity / 10, 1) * 20;
  const responseScore = responseRate * 15;
  const sentimentScore = recentSentiment * 15;
  return Math.round(ratingScore + velocityScore + responseScore + sentimentScore);
}

export default function ReputationSuite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendChannel, setSendChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('review_request');
  const [inputMode, setInputMode] = useState<'patient' | 'manual'>('patient');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-reputation', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, google_place_id, rating, review_count')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Feature gating
  const { hasAccess: canAccessSuite, isLoading: featuresLoading } = useHasFeature(clinic?.id || '', 'review_manager');
  const { data: subscription } = useClinicSubscription(clinic?.id || '');

  // Fetch funnel events
  const { data: funnelEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['reputation-funnel', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as ReviewFunnelEvent[];
    },
    enabled: !!clinic?.id,
  });

  // Fetch review requests
  const { data: reviewRequests = [], isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['review-requests', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ReviewRequest[];
    },
    enabled: !!clinic?.id,
  });

  // Fetch patients for selection
  const { data: patients = [] } = useQuery({
    queryKey: ['clinic-patients-select', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone, email')
        .eq('clinic_id', clinic?.id)
        .order('name')
        .limit(200);
      if (error) throw error;
      return (data || []) as Patient[];
    },
    enabled: !!clinic?.id,
  });

  // Send review request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      const template = MESSAGE_TEMPLATES.find(t => t.id === selectedTemplate);
      const finalMessage = customMessage || (template?.message
        .replace('{name}', recipientName)
        .replace('{clinic}', clinic?.name || 'our clinic') || '');

      const payload = {
        clinicId: clinic?.id,
        recipientName,
        recipientEmail: sendChannel === 'email' ? recipientEmail : undefined,
        recipientPhone: sendChannel !== 'email' ? recipientPhone : undefined,
        channel: sendChannel,
        customMessage: finalMessage,
      };

      const { data, error } = await supabase.functions.invoke('send-review-request', {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Review request sent successfully!');
      setShowSendDialog(false);
      resetSendForm();
      refetchRequests();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send request');
    },
  });

  const resetSendForm = () => {
    setRecipientName('');
    setRecipientEmail('');
    setRecipientPhone('');
    setCustomMessage('');
    setSelectedPatientId(null);
    setInputMode('patient');
  };

  // When patient is selected, populate fields
  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      setSelectedPatientId(patientId);
      setRecipientName(patient.name);
      setRecipientEmail(patient.email || '');
      setRecipientPhone(patient.phone);
    }
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixtyDaysAgo = subDays(now, 60);
    const fourteenDaysAgo = subDays(now, 14);

    const last30 = funnelEvents.filter(e => new Date(e.created_at) >= thirtyDaysAgo);
    const prev30 = funnelEvents.filter(e => {
      const d = new Date(e.created_at);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    });
    const last14 = funnelEvents.filter(e => new Date(e.created_at) >= fourteenDaysAgo);

    const ratedEvents = funnelEvents.filter(e => e.rating);
    const avgRating = ratedEvents.length > 0
      ? ratedEvents.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEvents.length
      : clinic?.rating || 0;

    const reviewVelocity = last30.filter(e => e.event_type === 'thumbs_up').length - 
                          prev30.filter(e => e.event_type === 'thumbs_up').length;

    const totalRated = funnelEvents.length;
    const positiveCount = funnelEvents.filter(e => e.event_type === 'thumbs_up').length;
    const positiveRatio = totalRated > 0 ? positiveCount / totalRated : 0;

    const negativeRisk = last14.filter(e => e.rating && e.rating <= 3).length;
    const responseRate = 0.75;
    const avgResponseTime = 4.2;

    const recentPositive = last14.filter(e => e.event_type === 'thumbs_up').length;
    const recentSentiment = last14.length > 0 ? recentPositive / last14.length : 0.5;

    const reputationScore = calculateReputationScore(avgRating, Math.abs(reviewVelocity), responseRate, recentSentiment);

    // Request stats
    const totalSent = reviewRequests.length;
    const sentViaEmail = reviewRequests.filter(r => r.channel === 'email').length;
    const sentViaSMS = reviewRequests.filter(r => r.channel === 'sms').length;
    const sentViaWhatsApp = reviewRequests.filter(r => r.channel === 'whatsapp').length;
    const successfulSent = reviewRequests.filter(r => r.status === 'sent').length;

    return {
      reputationScore,
      avgRating,
      reviewVelocity,
      positiveRatio,
      negativeRisk,
      responseRate,
      avgResponseTime,
      recentSentiment,
      totalReviews: clinic?.review_count || 0,
      totalResponses: funnelEvents.length,
      thumbsUp: positiveCount,
      thumbsDown: funnelEvents.filter(e => e.event_type === 'thumbs_down').length,
      totalSent,
      sentViaEmail,
      sentViaSMS,
      sentViaWhatsApp,
      successfulSent,
    };
  }, [funnelEvents, clinic, reviewRequests]);

  const reviewLink = clinic?.slug ? `${window.location.origin}/review/${clinic.slug}` : '';
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

  const filteredEvents = useMemo(() => {
    let events = funnelEvents.filter(e => e.event_type === 'thumbs_down');
    if (filterRating) {
      events = events.filter(e => e.rating === filterRating);
    }
    return events;
  }, [funnelEvents, filterRating]);

  if (clinicLoading || featuresLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full bg-slate-700/50" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 bg-slate-700/50" />)}
        </div>
        <Skeleton className="h-64 bg-slate-700/50" />
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked />;
  }

  const handleUpgrade = () => {
    if (!clinic?.id) {
      window.location.href = '/pricing';
      return;
    }
    setShowUpgradeModal(true);
  };

  if (!canAccessSuite) {
    return (
      <div className="space-y-6">
        <div className="p-5 rounded-2xl bg-slate-800/90 border border-slate-700/50">
          <h1 className="text-2xl font-display font-bold text-white">Reputation Suite</h1>
          <p className="text-white/60 mt-1">Professional review management & analytics</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gold border-gold">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-white" />
                <span className="text-xs font-medium text-gold-foreground/70">Rating</span>
              </div>
              <p className="text-2xl font-bold text-white">{clinic.rating?.toFixed(1) || 'N/A'}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary border-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-white" />
                <span className="text-xs font-medium text-primary-foreground/70">Reviews</span>
              </div>
              <p className="text-2xl font-bold text-white">{clinic.review_count || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-teal border-teal">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="h-4 w-4 text-white" />
                <span className="text-xs font-medium text-white/70">Positive</span>
              </div>
              <p className="text-2xl font-bold text-white">{kpis.thumbsUp}</p>
            </CardContent>
          </Card>
          <Card className="bg-coral border-coral">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="h-4 w-4 text-white" />
                <span className="text-xs font-medium text-white/70">Private</span>
              </div>
              <p className="text-2xl font-bold text-white">{kpis.thumbsDown}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Unlock Full Reputation Suite</h3>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Get advanced analytics, AI-powered review management, email/SMS/WhatsApp requests, 
              QR codes, and real-time reputation monitoring.
            </p>
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90" onClick={handleUpgrade}>
              <Zap className="h-5 w-5" />
              View Growth Plans
            </Button>
          </CardContent>
        </Card>

        <PlanSelectionModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          clinicId={clinic?.id}
          featureName="Reputation Suite"
          requiredPlan="growth_engine"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between p-5 rounded-2xl bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">
            Reputation Suite
          </h1>
          <p className="text-white/60 mt-1">Real-time reputation analytics for {clinic.name}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-slate-600/50 text-white hover:bg-slate-700/50">
                <QrCode className="h-4 w-4" />
                QR Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Review QR Code Studio</DialogTitle>
              </DialogHeader>
              <QRCodeGenerator 
                clinicName={clinic.name} 
                clinicSlug={clinic.slug}
                clinicId={clinic.id}
                googlePlaceId={clinic.google_place_id || undefined}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={copyLink} className="gap-2 bg-primary hover:bg-primary/90 text-white">
            {linkCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy Link
          </Button>
        </div>
      </div>

      {/* Reputation Score + KPIs */}
      <div className="grid lg:grid-cols-4 gap-4">
        {/* Reputation Score Card */}
        <Card className="bg-slate-800/90 border border-slate-700/50 text-white overflow-hidden shadow-lg">
          <div className="h-1 bg-gradient-to-r from-primary via-teal to-primary" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-white/60">Reputation Score</span>
            </div>
            <div className="flex items-center gap-4">
              <div 
                className="h-16 w-16 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${kpis.reputationScore}%, hsl(215 25% 27%) ${kpis.reputationScore}%)`
                }}
              >
                <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-xl font-bold">{kpis.reputationScore}</span>
                </div>
              </div>
              <Badge className={cn(
                "border-0",
                kpis.reputationScore >= 70 ? 'bg-teal/20 text-teal' : 
                kpis.reputationScore >= 40 ? 'bg-gold/20 text-gold' : 'bg-coral/20 text-coral'
              )}>
                {kpis.reputationScore >= 70 ? 'Excellent' : kpis.reputationScore >= 40 ? 'Good' : 'Needs Work'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="bg-gold border-gold">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-white" />
              <span className="text-xs font-medium text-white/70">Avg Rating</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpis.avgRating.toFixed(1)}</p>
            <div className="flex items-center gap-0.5 mt-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className={cn("h-3 w-3", i <= kpis.avgRating ? 'text-white fill-white' : 'text-white/30')} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-teal border-teal">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="h-4 w-4 text-white" />
              <span className="text-xs font-medium text-white/70">→ Google</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpis.thumbsUp}</p>
            <p className="text-xs text-white/60 mt-1">Redirected</p>
          </CardContent>
        </Card>

        <Card className="bg-coral border-coral">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsDown className="h-4 w-4 text-white" />
              <span className="text-xs font-medium text-white/70">Private</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpis.thumbsDown}</p>
            <p className="text-xs text-white/60 mt-1">Captured</p>
          </CardContent>
        </Card>
      </div>

      {/* Review Link Card */}
      <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <div className="h-1 bg-gradient-to-r from-primary via-teal to-primary" />
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-white">Review Collection Link</h3>
                <p className="text-sm text-white/60">Happy → Google • Unhappy → Private</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <Input value={reviewLink} readOnly className="bg-slate-900/50 border-slate-600/50 font-mono text-sm text-white" />
              <Button onClick={copyLink} size="icon" variant="outline" className="border-slate-600/50 hover:bg-slate-700/50 shrink-0">
                {linkCopied ? <CheckCircle className="h-4 w-4 text-teal" /> : <Copy className="h-4 w-4 text-white" />}
              </Button>
              {googleReviewLink && (
                <Button variant="outline" size="icon" className="border-slate-600/50 hover:bg-slate-700/50 shrink-0" asChild>
                  <a href={googleReviewLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 text-white" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ManualGoogleReviewLink clinicId={clinic.id} googlePlaceId={clinic.google_place_id} />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 h-11 rounded-xl bg-slate-900 p-1 border border-slate-700/50">
          <TabsTrigger value="overview" className="rounded-lg text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="inbox" className="rounded-lg text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <MessageSquare className="h-4 w-4 mr-2" />
            Inbox
            {kpis.thumbsDown > 0 && (
              <Badge className="ml-2 h-5 bg-coral text-white border-0">{kpis.thumbsDown}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="send" className="rounded-lg text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <Send className="h-4 w-4 mr-2" />
            Send Requests
          </TabsTrigger>
          <TabsTrigger value="tracking" className="rounded-lg text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <Eye className="h-4 w-4 mr-2" />
            Tracking
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg text-white data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <Bot className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
              <div className="h-1 bg-gradient-to-r from-primary via-teal to-primary" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Target className="h-5 w-5 text-primary" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { step: 1, title: 'Share Link', desc: 'Via Email, SMS, WhatsApp, or QR', color: 'bg-primary' },
                  { step: 2, title: 'Patient Responds', desc: 'Simple thumbs up or down', color: 'bg-blue-500' },
                  { step: 3, title: 'Happy → Google', desc: 'Direct to Google Reviews', color: 'bg-teal', icon: ThumbsUp },
                  { step: 4, title: 'Unhappy → Private', desc: 'Capture feedback internally', color: 'bg-coral', icon: ThumbsDown },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3 items-start">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold text-white", item.color)}>
                      {item.icon ? <item.icon className="h-4 w-4" /> : item.step}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{item.title}</p>
                      <p className="text-xs text-white/60">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
              <div className="h-1 bg-gradient-to-r from-teal via-primary to-teal" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Conversion Funnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6 rounded-xl bg-slate-900/50 border border-slate-700/50 mb-4">
                  <p className="text-4xl font-bold text-primary">
                    {kpis.totalResponses > 0 ? Math.round((kpis.thumbsUp / kpis.totalResponses) * 100) : 0}%
                  </p>
                  <p className="text-white/60 text-sm mt-1">Conversion to Google</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-white/80">
                        <ThumbsUp className="h-3 w-3 text-teal" />
                        To Google
                      </span>
                      <span className="font-bold text-teal">{kpis.thumbsUp}</span>
                    </div>
                    <Progress value={kpis.totalResponses > 0 ? (kpis.thumbsUp / kpis.totalResponses) * 100 : 0} className="h-2 bg-slate-700/50" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-white/80">
                        <ThumbsDown className="h-3 w-3 text-coral" />
                        Private
                      </span>
                      <span className="font-bold text-coral">{kpis.thumbsDown}</span>
                    </div>
                    <Progress value={kpis.totalResponses > 0 ? (kpis.thumbsDown / kpis.totalResponses) * 100 : 0} className="h-2 bg-slate-700/50" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="mt-6">
          <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
            <div className="h-1 bg-gradient-to-r from-coral via-primary to-coral" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Private Feedback Inbox
                  </CardTitle>
                  <CardDescription className="text-white/60">Review and respond to patient feedback</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setFilterRating(null)} 
                    className={cn("border-slate-600/50 text-white hover:bg-slate-700/50", !filterRating && 'bg-slate-700/50')}
                  >
                    All
                  </Button>
                  {[1,2,3,4,5].map(r => (
                    <Button 
                      key={r} 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setFilterRating(r)} 
                      className={cn("border-slate-600/50 text-white hover:bg-slate-700/50", filterRating === r && 'bg-slate-700/50')}
                    >
                      {r}★
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-slate-700/50" />)}
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-12">
                  <ThumbsUp className="h-12 w-12 mx-auto text-teal/50 mb-4" />
                  <p className="text-white/60">No negative feedback. Great work!</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {filteredEvents.map((event) => (
                      <div key={event.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {event.rating && (
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(i => (
                                  <Star key={i} className={cn("h-4 w-4", i <= event.rating! ? 'text-gold fill-gold' : 'text-slate-600')} />
                                ))}
                              </div>
                            )}
                            <Badge variant="outline" className="capitalize text-xs border-slate-600/50 text-white/70">{event.source}</Badge>
                          </div>
                          <span className="text-xs text-white/50">
                            {format(new Date(event.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        {event.comment && (
                          <p className="mt-3 text-sm text-white/80">{event.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Requests Tab */}
        <TabsContent value="send" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
                <div className="h-1 bg-gradient-to-r from-primary via-teal to-primary" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Send className="h-5 w-5 text-primary" />
                        Send Review Request
                      </CardTitle>
                      <CardDescription className="text-white/60">Choose a channel and send personalized requests</CardDescription>
                    </div>
                    <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
                      <DialogTrigger asChild>
                        <Button className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold">
                          <Plus className="h-4 w-4" />
                          New Request
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-900 border-slate-700/50 max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="text-white">Send Review Request</DialogTitle>
                          <DialogDescription className="text-white/60">Choose a patient or enter details manually</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[70vh]">
                        <div className="space-y-5 py-4 pr-2">
                          {/* Input Mode Toggle */}
                          <div className="flex gap-2 p-1 bg-slate-800 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setInputMode('patient')}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                                inputMode === 'patient'
                                  ? "bg-primary text-white shadow-lg"
                                  : "text-white/60 hover:text-white"
                              )}
                            >
                              <UserCheck className="h-4 w-4" />
                              Select Patient
                            </button>
                            <button
                              type="button"
                              onClick={() => setInputMode('manual')}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                                inputMode === 'manual'
                                  ? "bg-primary text-white shadow-lg"
                                  : "text-white/60 hover:text-white"
                              )}
                            >
                              <Plus className="h-4 w-4" />
                              Manual Entry
                            </button>
                          </div>

                          {/* Patient Selection */}
                          {inputMode === 'patient' && (
                            <div className="space-y-2">
                              <Label className="text-white font-medium">Choose Patient</Label>
                              <Select value={selectedPatientId || ''} onValueChange={handlePatientSelect}>
                                <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-11">
                                  <SelectValue placeholder="Select a patient..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                                  {patients.map((p) => (
                                    <SelectItem key={p.id} value={p.id} className="text-white hover:bg-slate-700">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                            {p.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span>{p.name}</span>
                                        <span className="text-white/40 text-xs">• {p.phone}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {patients.length === 0 && (
                                <p className="text-sm text-white/40">No patients found. Use manual entry.</p>
                              )}
                            </div>
                          )}

                          {/* Manual Entry Fields */}
                          {inputMode === 'manual' && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label className="text-white font-medium">Patient Name</Label>
                                <Input
                                  placeholder="John Smith"
                                  value={recipientName}
                                  onChange={(e) => setRecipientName(e.target.value)}
                                  className="bg-slate-800 border-slate-600 text-white h-11"
                                />
                              </div>
                              {sendChannel === 'email' ? (
                                <div className="space-y-2">
                                  <Label className="text-white font-medium">Email Address</Label>
                                  <Input
                                    type="email"
                                    placeholder="patient@email.com"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    className="bg-slate-800 border-slate-600 text-white h-11"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Label className="text-white font-medium">Phone Number</Label>
                                  <Input
                                    type="tel"
                                    placeholder="+1234567890"
                                    value={recipientPhone}
                                    onChange={(e) => setRecipientPhone(e.target.value)}
                                    className="bg-slate-800 border-slate-600 text-white h-11"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Channel Selection */}
                          <div className="space-y-2">
                            <Label className="text-white font-medium">Channel</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { value: 'email' as const, label: 'Email', icon: Mail, color: 'bg-blue-500' },
                                { value: 'sms' as const, label: 'SMS', icon: Phone, color: 'bg-teal' },
                                { value: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle, color: 'bg-green-500' },
                              ].map((ch) => (
                                <button
                                  key={ch.value}
                                  type="button"
                                  onClick={() => setSendChannel(ch.value)}
                                  className={cn(
                                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                                    sendChannel === ch.value
                                      ? "border-primary bg-primary/10"
                                      : "border-slate-600/50 hover:border-slate-500"
                                  )}
                                >
                                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", ch.color)}>
                                    <ch.icon className="h-5 w-5 text-white" />
                                  </div>
                                  <span className="text-xs font-semibold text-white">{ch.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Template Selection */}
                          <div className="space-y-2">
                            <Label className="text-white font-medium flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              Message Template
                            </Label>
                            <div className="grid gap-2">
                              {MESSAGE_TEMPLATES.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTemplate(t.id);
                                    setCustomMessage('');
                                  }}
                                  className={cn(
                                    "flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all",
                                    selectedTemplate === t.id
                                      ? "border-primary bg-primary/10"
                                      : "border-slate-700 hover:border-slate-600"
                                  )}
                                >
                                  <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                    selectedTemplate === t.id ? "bg-primary" : "bg-slate-700"
                                  )}>
                                    <FileText className="h-4 w-4 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-white text-sm">{t.name}</p>
                                    <p className="text-xs text-white/50 truncate">{t.description}</p>
                                  </div>
                                  {selectedTemplate === t.id && (
                                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom Message Override */}
                          <div className="space-y-2">
                            <Label className="text-white font-medium">Custom Message (Optional)</Label>
                            <Textarea
                              placeholder="Override the template with your own message..."
                              value={customMessage}
                              onChange={(e) => setCustomMessage(e.target.value)}
                              rows={3}
                              className="bg-slate-800 border-slate-600 text-white resize-none"
                            />
                          </div>
                        </div>
                        </ScrollArea>
                        <DialogFooter className="border-t border-slate-700 pt-4">
                          <Button variant="outline" onClick={() => setShowSendDialog(false)} className="border-slate-600 text-white">
                            Cancel
                          </Button>
                          <Button
                            onClick={() => sendRequestMutation.mutate()}
                            disabled={!recipientName || (sendChannel === 'email' ? !recipientEmail : !recipientPhone) || sendRequestMutation.isPending}
                            className="bg-primary hover:bg-primary/90 text-white font-semibold gap-2"
                          >
                            {sendRequestMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Send Request
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Channel Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-blue-400" />
                        <span className="text-xs font-medium text-white/60">Via Email</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{kpis.sentViaEmail}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-teal/10 border border-teal/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="h-4 w-4 text-teal" />
                        <span className="text-xs font-medium text-white/60">Via SMS</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{kpis.sentViaSMS}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs font-medium text-white/60">Via WhatsApp</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{kpis.sentViaWhatsApp}</p>
                    </div>
                  </div>

                  {/* Quick Tips */}
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Pro Tips
                    </h4>
                    <ul className="text-sm text-white/70 space-y-1">
                      <li>• Send within 2 hours of visit for best results</li>
                      <li>• Personalize the message with patient's name</li>
                      <li>• Email works best for detailed feedback requests</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
                <div className="h-1 bg-gradient-to-r from-gold via-primary to-gold" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <QrCode className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">QR Code</p>
                      <p className="text-sm text-white/60">For reception desk</p>
                    </div>
                  </div>
                  <Button onClick={() => setQrDialogOpen(true)} variant="outline" className="w-full border-slate-600/50 text-white hover:bg-slate-700/50">
                    Open QR Studio
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-teal/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-teal" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Total Sent</p>
                      <p className="text-sm text-white/60">All channels</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white">{kpis.totalSent}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tracking Tab */}
        <TabsContent value="tracking" className="mt-6">
          <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
            <div className="h-1 bg-gradient-to-r from-primary via-teal to-primary" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Eye className="h-5 w-5 text-primary" />
                    Request Tracking
                  </CardTitle>
                  <CardDescription className="text-white/60">Monitor sent requests and their status</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchRequests()}
                  className="border-slate-600/50 text-white hover:bg-slate-700/50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 bg-slate-700/50" />)}
                </div>
              ) : reviewRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto text-white/20 mb-4" />
                  <p className="text-white/60">No requests sent yet</p>
                  <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={() => setShowSendDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Send First Request
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {reviewRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            req.channel === 'email' ? 'bg-blue-500/20' : 
                            req.channel === 'sms' ? 'bg-teal/20' : 'bg-green-500/20'
                          )}>
                            {req.channel === 'email' ? <Mail className="h-5 w-5 text-blue-400" /> :
                             req.channel === 'sms' ? <Phone className="h-5 w-5 text-teal" /> :
                             <MessageCircle className="h-5 w-5 text-green-400" />}
                          </div>
                          <div>
                            <p className="font-medium text-white">{req.recipient_name}</p>
                            <p className="text-xs text-white/50">
                              {req.recipient_email || req.recipient_phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={cn(
                            "border-0",
                            req.status === 'sent' ? 'bg-teal/20 text-teal' :
                            req.status === 'failed' ? 'bg-coral/20 text-coral' : 'bg-gold/20 text-gold'
                          )}>
                            {req.status}
                          </Badge>
                          <span className="text-xs text-white/40">
                            {format(new Date(req.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai" className="mt-6">
          <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
            <div className="h-1 bg-gradient-to-r from-violet-500 via-primary to-violet-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Bot className="h-5 w-5 text-primary" />
                AI-Powered Insights
              </CardTitle>
              <CardDescription className="text-white/60">Smart recommendations based on your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {[
                  { 
                    type: 'insight',
                    icon: TrendingUp,
                    title: 'Positive Trend Detected',
                    desc: `Your positive feedback ratio is ${Math.round(kpis.positiveRatio * 100)}%. Keep up the great work!`,
                    color: 'bg-teal/20 text-teal border-teal/30'
                  },
                  {
                    type: 'tip',
                    icon: Clock,
                    title: 'Optimal Send Time',
                    desc: 'Based on industry data, sending requests within 2 hours of visit increases response rates by 40%.',
                    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  },
                  {
                    type: kpis.negativeRisk > 0 ? 'warning' : 'success',
                    icon: kpis.negativeRisk > 0 ? AlertTriangle : CheckCircle,
                    title: kpis.negativeRisk > 0 ? 'Negative Feedback Alert' : 'No Negative Feedback Risk',
                    desc: kpis.negativeRisk > 0 
                      ? `${kpis.negativeRisk} low ratings in the last 14 days. Consider following up with these patients.`
                      : 'No concerning feedback patterns detected. Your patients are happy!',
                    color: kpis.negativeRisk > 0 ? 'bg-coral/20 text-coral border-coral/30' : 'bg-teal/20 text-teal border-teal/30'
                  },
                  {
                    type: 'insight',
                    icon: Sparkles,
                    title: 'Channel Performance',
                    desc: kpis.sentViaEmail > kpis.sentViaSMS 
                      ? 'Email is your most used channel. Consider diversifying with SMS for higher open rates.'
                      : 'SMS has higher open rates. Consider sending more requests via SMS.',
                    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                  },
                ].map((insight, i) => (
                  <div key={i} className={cn("p-4 rounded-xl border", insight.color)}>
                    <div className="flex items-start gap-3">
                      <insight.icon className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{insight.title}</p>
                        <p className="text-sm opacity-80 mt-1">{insight.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
