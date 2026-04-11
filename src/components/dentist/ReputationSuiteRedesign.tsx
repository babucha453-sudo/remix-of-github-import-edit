import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  QrCode,
  Copy,
  ExternalLink,
  CheckCircle,
  Sparkles,
  Send,
  Mail,
  Phone,
  MessageCircle,
  Users,
  Loader2,
  Eye,
  BarChart3,
  Target,
  Activity,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import QRCodeGenerator from './QRCodeGenerator';
import { NoPracticeLinked } from './NoPracticeLinked';
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

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export default function ReputationSuiteRedesign() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendChannel, setSendChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['reputation-clinic-v2', user?.id],
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

  // Fetch funnel events
  const { data: funnelEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['reputation-funnel-v2', clinic?.id],
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

  // Fetch patients
  const { data: patients = [] } = useQuery({
    queryKey: ['reputation-patients-v2', clinic?.id],
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

  // Send review request
  const sendRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('send-review-request', {
        body: {
          clinicId: clinic?.id,
          recipientName,
          recipientEmail: sendChannel === 'email' ? recipientEmail : undefined,
          recipientPhone: sendChannel !== 'email' ? recipientPhone : undefined,
          channel: sendChannel,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review request sent!');
      setSendDialogOpen(false);
      resetSendForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send');
    },
  });

  const resetSendForm = () => {
    setRecipientName('');
    setRecipientEmail('');
    setRecipientPhone('');
    setSelectedPatientId(null);
  };

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
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
    const last30 = funnelEvents.filter((e) => new Date(e.created_at) >= thirtyDaysAgo);

    const thumbsUp = funnelEvents.filter((e) => e.event_type === 'thumbs_up').length;
    const thumbsDown = funnelEvents.filter((e) => e.event_type === 'thumbs_down').length;
    const total = funnelEvents.length;
    const positiveRate = total > 0 ? Math.round((thumbsUp / total) * 100) : 0;

    const last30Up = last30.filter((e) => e.event_type === 'thumbs_up').length;
    const last30Down = last30.filter((e) => e.event_type === 'thumbs_down').length;

    // Reputation score calculation
    const avgRating = clinic?.rating || 0;
    const ratingScore = (avgRating / 5) * 50;
    const velocityScore = Math.min(last30Up / 10, 1) * 25;
    const sentimentScore = (last30.length > 0 ? last30Up / last30.length : 0.5) * 25;
    const reputationScore = Math.round(ratingScore + velocityScore + sentimentScore);

    return {
      reputationScore,
      avgRating,
      thumbsUp,
      thumbsDown,
      positiveRate,
      totalEvents: total,
      last30Up,
      last30Down,
      reviewCount: clinic?.review_count || 0,
    };
  }, [funnelEvents, clinic]);

  const reviewLink = clinic?.slug ? `${window.location.origin}/review/${clinic.slug}` : '';
  const googleReviewLink = clinic?.google_place_id
    ? `https://search.google.com/local/writereview?placeid=${clinic.google_place_id}`
    : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewLink);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (clinicLoading || eventsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!clinic) return <NoPracticeLinked />;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-teal';
    if (score >= 60) return 'from-primary to-teal';
    if (score >= 40) return 'from-gold to-amber-500';
    return 'from-coral to-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Reputation Suite</h1>
          <p className="text-white/60 mt-1">Manage reviews & grow your online presence</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setQrDialogOpen(true)}
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
          <Button
            className="gap-2 bg-gradient-to-r from-primary to-teal text-white"
            onClick={() => setSendDialogOpen(true)}
          >
            <Send className="h-4 w-4" />
            Send Request
          </Button>
        </div>
      </div>

      {/* Reputation Score Hero */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score Card */}
        <Card className="lg:col-span-1 bg-gradient-to-br from-white/10 to-white/5 border-white/10 overflow-hidden">
          <div className={`h-1 bg-gradient-to-r ${getScoreColor(kpis.reputationScore)}`} />
          <CardContent className="p-6 text-center">
            <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  className="text-white/10"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="56"
                  cx="64"
                  cy="64"
                />
                <circle
                  className={`text-primary`}
                  strokeWidth="8"
                  strokeDasharray={`${(kpis.reputationScore / 100) * 352} 352`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="56"
                  cx="64"
                  cy="64"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white">{kpis.reputationScore}</span>
                <span className="text-xs text-white/50">/ 100</span>
              </div>
            </div>
            <Badge className={`bg-gradient-to-r ${getScoreColor(kpis.reputationScore)} text-white border-0`}>
              {getScoreLabel(kpis.reputationScore)}
            </Badge>
            <p className="text-white/50 text-sm mt-3">Reputation Score</p>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-gold/20 to-gold/5 border-gold/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center">
                  <Star className="h-5 w-5 text-gold fill-gold" />
                </div>
                <div>
                  <p className="text-xs text-white/50">Average Rating</p>
                  <p className="text-2xl font-bold text-white">
                    {kpis.avgRating ? kpis.avgRating.toFixed(1) : 'N/A'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-white/40">{kpis.reviewCount} Google reviews</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <ThumbsUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-white/50">Positive Feedback</p>
                  <p className="text-2xl font-bold text-white">{kpis.thumbsUp}</p>
                </div>
              </div>
              <p className="text-sm text-white/40">+{kpis.last30Up} this month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-coral/20 to-coral/5 border-coral/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-coral/20 flex items-center justify-center">
                  <ThumbsDown className="h-5 w-5 text-coral" />
                </div>
                <div>
                  <p className="text-xs text-white/50">Private Feedback</p>
                  <p className="text-2xl font-bold text-white">{kpis.thumbsDown}</p>
                </div>
              </div>
              <p className="text-sm text-white/40">{kpis.last30Down} this month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-white/50">Positive Rate</p>
                  <p className="text-2xl font-bold text-white">{kpis.positiveRate}%</p>
                </div>
              </div>
              <Progress value={kpis.positiveRate} className="h-2 bg-white/10" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review Link Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-teal/5 border-primary/20">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">Your Review Collection Link</h3>
              <p className="text-sm text-white/50">Share this link to collect patient feedback</p>
            </div>
            <div className="flex gap-2 flex-1">
              <Input
                value={reviewLink}
                readOnly
                className="bg-white/5 border-white/10 text-white"
              />
              <Button
                variant="outline"
                size="icon"
                className="border-white/10 text-white hover:bg-white/10"
                onClick={copyLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
              {reviewLink && (
                <Button
                  variant="outline"
                  size="icon"
                  className="border-white/10 text-white hover:bg-white/10"
                  onClick={() => window.open(reviewLink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger
            value="overview"
            className="text-white/60 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="feedback"
            className="text-white/60 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Private Feedback
          </TabsTrigger>
          <TabsTrigger
            value="funnel"
            className="text-white/60 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* How It Works */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { step: '1', title: 'Share Link', desc: 'Send your review link to patients' },
                  { step: '2', title: 'Collect Feedback', desc: 'Patients give thumbs up/down' },
                  { step: '3', title: 'Smart Routing', desc: 'Happy patients go to Google' },
                  { step: '4', title: 'Improve', desc: 'Private feedback stays private' },
                ].map((item) => (
                  <div key={item.step} className="text-center p-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl font-bold text-primary">{item.step}</span>
                    </div>
                    <p className="font-semibold text-white mb-1">{item.title}</p>
                    <p className="text-sm text-white/50">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="mt-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Private Feedback Inbox</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelEvents.filter((e) => e.event_type === 'thumbs_down').length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p className="text-white/60">No negative feedback yet</p>
                  <p className="text-white/40 text-sm mt-1">Keep up the great work!</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {funnelEvents
                      .filter((e) => e.event_type === 'thumbs_down')
                      .slice(0, 20)
                      .map((event) => (
                        <div key={event.id} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-coral/20 flex items-center justify-center">
                              <ThumbsDown className="h-5 w-5 text-coral" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-coral/20 text-coral border-0 text-xs">
                                  {event.rating ? `${event.rating}/5` : 'Negative'}
                                </Badge>
                                <span className="text-xs text-white/40">
                                  {format(new Date(event.created_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {event.comment && <p className="text-white/80 text-sm">{event.comment}</p>}
                              <p className="text-xs text-white/40 mt-1">Via {event.source}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="mt-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelEvents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="text-white/60">No activity yet</p>
                  <p className="text-white/40 text-sm mt-1">Start sharing your review link</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {funnelEvents.slice(0, 30).map((event) => (
                      <div key={event.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                        <div
                          className={cn(
                            'h-10 w-10 rounded-full flex items-center justify-center',
                            event.event_type === 'thumbs_up' ? 'bg-emerald-500/20' : 'bg-coral/20'
                          )}
                        >
                          {event.event_type === 'thumbs_up' ? (
                            <ThumbsUp className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <ThumbsDown className="h-5 w-5 text-coral" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {event.event_type === 'thumbs_up' ? 'Positive Feedback' : 'Private Feedback'}
                          </p>
                          <p className="text-xs text-white/50">Via {event.source}</p>
                        </div>
                        <span className="text-xs text-white/40">
                          {format(new Date(event.created_at), 'MMM d')}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Review QR Code</DialogTitle>
          </DialogHeader>
          <QRCodeGenerator
            clinicName={clinic.name}
            clinicSlug={clinic.slug}
            clinicId={clinic.id}
            googlePlaceId={clinic.google_place_id || undefined}
          />
        </DialogContent>
      </Dialog>

      {/* Send Request Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Review Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Patient Selection */}
            <div className="space-y-2">
              <Label className="text-white">Select Patient (Optional)</Label>
              <Select value={selectedPatientId || ''} onValueChange={handlePatientSelect}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Choose a patient..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-white hover:bg-white/10">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <Label className="text-white">Delivery Channel</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'email', icon: Mail, label: 'Email' },
                  { id: 'sms', icon: Phone, label: 'SMS' },
                  { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp' },
                ].map((ch) => (
                  <Button
                    key={ch.id}
                    variant="outline"
                    className={cn(
                      'flex-col gap-1 h-auto py-3',
                      sendChannel === ch.id
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    )}
                    onClick={() => setSendChannel(ch.id as any)}
                  >
                    <ch.icon className="h-4 w-4" />
                    <span className="text-xs">{ch.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Recipient Details */}
            <div className="space-y-2">
              <Label className="text-white">Recipient Name</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Doe"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {sendChannel === 'email' ? (
              <div className="space-y-2">
                <Label className="text-white">Email Address</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-white">Phone Number</Label>
                <Input
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendRequest.mutate()}
              disabled={!recipientName || sendRequest.isPending}
              className="bg-gradient-to-r from-primary to-teal text-white"
            >
              {sendRequest.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
