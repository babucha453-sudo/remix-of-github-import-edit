import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Send,
  Plus,
  Copy,
  ExternalLink,
  CheckCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Eye,
  MessageSquare,
  Mail,
  Phone,
  Sparkles,
  TrendingUp,
  Users,
  BarChart3,
  Zap,
} from 'lucide-react';

interface ReviewRequestManagerProps {
  clinicId: string;
  clinicSlug: string;
}

interface ReviewRequest {
  id: string;
  patient_name: string | null;
  patient_email: string | null;
  recipient_phone: string;
  channel: string;
  status: string;
  short_code: string | null;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string;
}

export default function ReviewRequestManager({ clinicId, clinicSlug }: ReviewRequestManagerProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeView, setActiveView] = useState('all');
  const [newRequest, setNewRequest] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    channel: 'email',
    customMessage: '',
  });

  // Fetch review requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['review-requests', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ReviewRequest[];
    },
    enabled: !!clinicId,
  });

  // Create request mutation with email sending
  const createRequest = useMutation({
    mutationFn: async () => {
      const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const reviewLink = `${window.location.origin}/review/rq/${shortCode}`;
      
      // Insert the request
      const { data, error } = await supabase
        .from('review_requests')
        .insert({
          clinic_id: clinicId,
          patient_name: newRequest.patientName || null,
          patient_email: newRequest.patientEmail || null,
          recipient_name: newRequest.patientName || null,
          recipient_phone: newRequest.patientPhone || '',
          channel: newRequest.channel,
          short_code: shortCode,
          status: 'pending',
        } as any)
        .select()
        .single();

      if (error) throw error;

      // If email channel, send the email
      if (newRequest.channel === 'email' && newRequest.patientEmail) {
        await supabase.functions.invoke('send-booking-email', {
          body: {
            type: 'review_request',
            to: newRequest.patientEmail,
            patientName: newRequest.patientName || 'Valued Patient',
            clinicName: clinicSlug,
            reviewLink,
            customMessage: newRequest.customMessage || undefined,
          },
        });
        
        // Update status to sent
        await supabase
          .from('review_requests')
          .update({ status: 'sent', sent_at: new Date().toISOString() } as any)
          .eq('id', data.id);
      }

      return { ...data, short_code: shortCode };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-requests', clinicId] });
      toast.success(newRequest.channel === 'email' ? 'Review request sent via email!' : 'Review request created');
      setCreateOpen(false);
      setNewRequest({ patientName: '', patientEmail: '', patientPhone: '', channel: 'email', customMessage: '' });
      
      if (data?.short_code && newRequest.channel !== 'email') {
        const link = `${window.location.origin}/review/rq/${data.short_code}`;
        navigator.clipboard.writeText(link);
        toast.info('Review link copied to clipboard');
      }
    },
    onError: (error) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Mark as sent mutation
  const markAsSent = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('review_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-requests', clinicId] });
      toast.success('Marked as sent');
    },
  });

  // Send reminder mutation
  const sendReminder = useMutation({
    mutationFn: async (request: ReviewRequest) => {
      if (!request.patient_email || !request.short_code) {
        throw new Error('Cannot send reminder - missing email or link');
      }
      
      const reviewLink = `${window.location.origin}/review/rq/${request.short_code}`;
      
      await supabase.functions.invoke('send-booking-email', {
        body: {
          type: 'review_reminder',
          to: request.patient_email,
          patientName: request.patient_name || 'Valued Patient',
          clinicName: clinicSlug,
          reviewLink,
        },
      });
    },
    onSuccess: () => {
      toast.success('Reminder sent!');
    },
    onError: (error) => {
      toast.error('Failed to send reminder: ' + error.message);
    },
  });

  const copyLink = (shortCode: string) => {
    const link = `${window.location.origin}/review/rq/${shortCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied');
  };

  const getStatusBadge = (request: ReviewRequest) => {
    if (request.outcome === 'positive') {
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-0"><ThumbsUp className="h-3 w-3 mr-1" />Positive</Badge>;
    }
    if (request.outcome === 'negative') {
      return <Badge className="bg-coral/10 text-coral border-0"><ThumbsDown className="h-3 w-3 mr-1" />Negative</Badge>;
    }
    if (request.completed_at) {
      return <Badge className="bg-teal/10 text-teal border-0"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (request.opened_at) {
      return <Badge className="bg-primary/10 text-primary border-0"><Eye className="h-3 w-3 mr-1" />Opened</Badge>;
    }
    if (request.sent_at) {
      return <Badge className="bg-purple/10 text-purple border-0"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
    }
    return <Badge className="bg-muted text-muted-foreground border-0"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4 text-primary" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-emerald-600" />;
      default: return <Phone className="h-4 w-4 text-purple" />;
    }
  };

  // Stats
  const stats = {
    total: requests.length,
    sent: requests.filter(r => r.sent_at).length,
    opened: requests.filter(r => r.opened_at).length,
    completed: requests.filter(r => r.completed_at).length,
    positive: requests.filter(r => r.outcome === 'positive').length,
    byEmail: requests.filter(r => r.channel === 'email').length,
    bySms: requests.filter(r => r.channel === 'sms').length,
    byWhatsapp: requests.filter(r => r.channel === 'whatsapp').length,
  };

  const conversionRate = stats.sent > 0 ? Math.round((stats.positive / stats.sent) * 100) : 0;
  const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (activeView === 'all') return true;
    if (activeView === 'pending') return !r.sent_at;
    if (activeView === 'sent') return r.sent_at && !r.opened_at;
    if (activeView === 'opened') return r.opened_at && !r.completed_at;
    if (activeView === 'completed') return r.completed_at;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-slate-400">Total Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple to-purple/80 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-xs text-purple-100">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary to-teal border-0 text-white shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openRate}%</p>
                <p className="text-xs text-teal-100">Open Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.positive}</p>
                <p className="text-xs text-emerald-100">→ Google</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gold to-amber-500 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conversionRate}%</p>
                <p className="text-xs text-amber-100">Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-sm"><strong>{stats.byEmail}</strong> Email</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-purple" />
                <span className="text-sm"><strong>{stats.bySms}</strong> SMS</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <span className="text-sm"><strong>{stats.byWhatsapp}</strong> WhatsApp</span>
              </div>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-primary to-teal hover:from-primary/90 hover:to-teal/90">
                  <Sparkles className="h-4 w-4" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Send Review Request
                  </DialogTitle>
                  <DialogDescription>
                    Request a review from your patient via email, SMS, or WhatsApp
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select
                      value={newRequest.channel}
                      onValueChange={(v) => setNewRequest({ ...newRequest, channel: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-primary" /> Email (Recommended)
                          </div>
                        </SelectItem>
                        <SelectItem value="sms">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-purple" /> SMS
                          </div>
                        </SelectItem>
                        <SelectItem value="whatsapp">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-600" /> WhatsApp
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Patient Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={newRequest.patientName}
                      onChange={(e) => setNewRequest({ ...newRequest, patientName: e.target.value })}
                    />
                  </div>

                  {newRequest.channel === 'email' ? (
                    <div className="space-y-2">
                      <Label>Email Address *</Label>
                      <Input
                        type="email"
                        placeholder="patient@email.com"
                        value={newRequest.patientEmail}
                        onChange={(e) => setNewRequest({ ...newRequest, patientEmail: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={newRequest.patientPhone}
                        onChange={(e) => setNewRequest({ ...newRequest, patientPhone: e.target.value })}
                      />
                    </div>
                  )}

                  {newRequest.channel === 'email' && (
                    <div className="space-y-2">
                      <Label>Personal Message (Optional)</Label>
                      <Textarea
                        placeholder="Thank you for visiting our practice..."
                        value={newRequest.customMessage}
                        onChange={(e) => setNewRequest({ ...newRequest, customMessage: e.target.value })}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createRequest.mutate()}
                    disabled={
                      (newRequest.channel === 'email' && !newRequest.patientEmail) ||
                      (newRequest.channel !== 'email' && !newRequest.patientPhone) ||
                      createRequest.isPending
                    }
                    className="gap-2"
                  >
                    {createRequest.isPending ? (
                      <>Sending...</>
                    ) : newRequest.channel === 'email' ? (
                      <>
                        <Send className="h-4 w-4" />
                        Send Email
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Create & Copy Link
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="opened">Opened</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <Card className="card-modern overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Patient</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                        <Send className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="font-medium mb-1">No requests yet</p>
                      <p className="text-sm">Start collecting reviews by sending your first request</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.patient_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.patient_email || request.recipient_phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getChannelIcon(request.channel)}
                        <span className="capitalize text-sm">{request.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(request)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {request.short_code && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => copyLink(request.short_code!)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`/review/rq/${request.short_code}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </>
                        )}
                        {request.channel === 'email' && request.patient_email && request.sent_at && !request.completed_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendReminder.mutate(request)}
                            disabled={sendReminder.isPending}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                        )}
                        {!request.sent_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsSent.mutate(request.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
