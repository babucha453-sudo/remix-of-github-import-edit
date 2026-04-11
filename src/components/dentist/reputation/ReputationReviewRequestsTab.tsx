import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send,
  Mail,
  Phone,
  MessageCircle,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Plus,
  Search,
  Filter,
  Loader2,
  Link2,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

interface ReputationReviewRequestsTabProps {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  googlePlaceId?: string | null;
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

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail, description: 'Send via email' },
  { id: 'sms', label: 'SMS', icon: Phone, description: 'Send text message' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, description: 'Send WhatsApp message' },
];

export default function ReputationReviewRequestsTab({
  clinicId,
  clinicName,
  clinicSlug,
  googlePlaceId,
}: ReputationReviewRequestsTabProps) {
  const queryClient = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch review requests
  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['review-requests-tab', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ReviewRequest[];
    },
  });

  // Fetch patients
  const { data: patients = [] } = useQuery({
    queryKey: ['patients-for-requests', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone, email')
        .eq('clinic_id', clinicId)
        .order('name')
        .limit(200);
      if (error) throw error;
      return (data || []) as Patient[];
    },
  });

  // Send request mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('send-review-request', {
        body: {
          clinicId,
          recipientName,
          recipientEmail: channel === 'email' ? recipientEmail : undefined,
          recipientPhone: channel !== 'email' ? recipientPhone : undefined,
          channel,
          customMessage: customMessage || undefined,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review request sent!');
      setSendDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send request');
    },
  });

  const resetForm = () => {
    setRecipientName('');
    setRecipientEmail('');
    setRecipientPhone('');
    setCustomMessage('');
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

  const reviewLink = clinicSlug ? `${window.location.origin}/review/${clinicSlug}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewLink);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const last30 = requests.filter((r) => new Date(r.created_at) >= thirtyDaysAgo);

    return {
      total: requests.length,
      last30: last30.length,
      sentViaEmail: requests.filter((r) => r.channel === 'email').length,
      sentViaSMS: requests.filter((r) => r.channel === 'sms').length,
      sentViaWhatsApp: requests.filter((r) => r.channel === 'whatsapp').length,
      successful: requests.filter((r) => r.status === 'sent').length,
      pending: requests.filter((r) => r.status === 'pending').length,
      failed: requests.filter((r) => r.status === 'failed').length,
    };
  }, [requests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    let result = requests;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.recipient_name.toLowerCase().includes(term) ||
          r.recipient_email?.toLowerCase().includes(term) ||
          r.recipient_phone?.includes(term)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    return result;
  }, [requests, searchTerm, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.successful}</p>
                <p className="text-sm text-muted-foreground">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.last30}</p>
                <p className="text-sm text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shareable Link Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-teal/5 border-primary/20">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Your Review Collection Link</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this link to collect reviews. Positive feedback redirects to Google.
              </p>
            </div>
            <div className="flex gap-2 flex-1">
              <Input value={reviewLink} readOnly className="bg-background" />
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
              {reviewLink && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(reviewLink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Review Requests
              </CardTitle>
              <CardDescription>Send and track review requests</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setSendDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Send Request
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Delivered</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Request List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No requests yet</p>
                  <p className="text-sm">Send your first review request</p>
                </div>
              ) : (
                filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center">
                      {request.channel === 'email' && <Mail className="h-5 w-5 text-blue-500" />}
                      {request.channel === 'sms' && <Phone className="h-5 w-5 text-emerald-500" />}
                      {request.channel === 'whatsapp' && (
                        <MessageCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.recipient_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {request.recipient_email || request.recipient_phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={
                          request.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : request.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }
                      >
                        {request.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(request.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Review Request
            </DialogTitle>
            <DialogDescription>
              Request a review from your patient via their preferred channel
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Channel Selection */}
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id as 'email' | 'sms' | 'whatsapp')}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    channel === ch.id
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <ch.icon
                    className={`h-5 w-5 mx-auto mb-1 ${
                      channel === ch.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  <p className="text-sm font-medium">{ch.label}</p>
                </button>
              ))}
            </div>

            {/* Patient Selection */}
            <div className="space-y-2">
              <Label>Select Patient</Label>
              <Select value={selectedPatientId || ''} onValueChange={handlePatientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a patient or enter manually" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manual Entry */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Recipient Name</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Patient name"
                />
              </div>
              {channel === 'email' ? (
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="patient@example.com"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Custom Message (optional)</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personalized message..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={
                sendMutation.isPending ||
                !recipientName ||
                (channel === 'email' ? !recipientEmail : !recipientPhone)
              }
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
