import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHasFeature } from '@/hooks/useClinicFeatures';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Send, 
  Phone, 
  MessageSquare, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  Plus,
  Filter,
  Lock,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ReviewRequestsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug, google_place_id')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch patients
  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['clinic-patients-for-review', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone, email, last_visit_at, is_opted_in_sms, is_opted_in_whatsapp')
        .eq('clinic_id', clinic!.id)
        .eq('is_opted_in_sms', true)
        .order('last_visit_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Fetch sent requests
  const { data: sentRequests = [] } = useQuery({
    queryKey: ['review-requests', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select('*')
        .eq('clinic_id', clinic!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  // Send review requests mutation
  const sendRequests = useMutation({
    mutationFn: async (recipients: { name: string; phone: string; patient_id?: string }[]) => {
      if (!clinic) throw new Error('No clinic');
      
      const reviewLink = `${window.location.origin}/review/${clinic.id}/`;
      const messageContent = `Hi! Thanks for visiting ${clinic.name}. We'd love to hear your feedback! Please take a moment to share your experience: ${reviewLink}`;
      
      const requests = recipients.map(r => ({
        clinic_id: clinic.id,
        patient_id: r.patient_id || null,
        recipient_name: r.name,
        recipient_phone: r.phone,
        channel,
        template_type: 'review_request',
        message_content: messageContent,
        status: 'pending' as const,
      }));
      
      const { error } = await supabase
        .from('review_requests')
        .insert(requests);
      
      if (error) throw error;
      
      // In production, this would trigger an edge function to send via SMS/WhatsApp API
      // For now, we'll mark them as sent immediately
      return requests.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] });
      toast.success(`${count} review request(s) queued for sending`);
      setSelectedPatients([]);
      setSendDialogOpen(false);
    },
    onError: (e) => toast.error('Failed to send: ' + e.message),
  });

  // Toggle patient selection
  const togglePatient = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  // Handle bulk send
  const handleBulkSend = () => {
    const recipients = patients
      .filter(p => selectedPatients.includes(p.id))
      .map(p => ({
        name: p.name,
        phone: p.phone,
        patient_id: p.id,
      }));
    sendRequests.mutate(recipients);
  };

  // Handle manual add
  const handleManualSend = () => {
    if (!manualPhone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    sendRequests.mutate([{ name: manualName.trim() || 'Patient', phone: manualPhone.trim() }]);
    setManualDialogOpen(false);
    setManualPhone('');
    setManualName('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge className="bg-teal/10 text-teal border-teal/20"><CheckCircle className="h-3 w-3 mr-1" /> Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  // Check feature access
  const { hasAccess: hasReviewManager, isLoading: featureLoading } = useHasFeature(clinic?.id, 'review_manager');

  if (clinicLoading || featureLoading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  if (!clinic) {
    return (
      <Card className="card-modern">
        <CardContent className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Practice Linked</h2>
          <p className="text-muted-foreground">Claim your practice profile to send review requests.</p>
        </CardContent>
      </Card>
    );
  }

  // Feature locked for free plans
  if (!hasReviewManager) {
    return (
      <Card className="card-modern border-amber-200 bg-amber-50/50">
        <CardContent className="text-center py-16">
          <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Upgrade to Unlock Review Manager</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Send review requests to patients, collect feedback, and boost your Google reviews.
            Upgrade to the <span className="font-semibold text-amber-700">Verified</span> or <span className="font-semibold text-primary">Pro</span> plan to unlock this feature.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => toast.info('Payment gateway not connected. Please contact administrator to upgrade your plan.')}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-background border">
              <MessageSquare className="h-6 w-6 text-teal mb-2" />
              <h4 className="font-semibold text-sm">Collect Reviews</h4>
              <p className="text-xs text-muted-foreground">Send personalized requests via SMS/WhatsApp</p>
            </div>
            <div className="p-4 rounded-xl bg-background border">
              <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
              <h4 className="font-semibold text-sm">Filter Feedback</h4>
              <p className="text-xs text-muted-foreground">Happy → Google, unhappy → private feedback</p>
            </div>
            <div className="p-4 rounded-xl bg-background border">
              <Users className="h-6 w-6 text-primary mb-2" />
              <h4 className="font-semibold text-sm">Patient Selection</h4>
              <p className="text-xs text-muted-foreground">Choose from your patient list or add manually</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reviewLink = `${window.location.origin}/review/${clinic.id}/`;

  const copyReviewLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewLink);
      setLinkCopied(true);
      toast.success('Review link copied to clipboard');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="space-y-6">
      {/* Review Link Card */}
      <Card className="card-modern border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-lg">Your Review Collection Link</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Share this link with patients to collect reviews. Happy patients go to Google, unhappy patients give private feedback.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Input value={reviewLink} readOnly className="w-72 bg-background text-sm" />
              <Button onClick={copyReviewLink} variant={linkCopied ? "default" : "outline"}>
                {linkCopied ? <CheckCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Request Reviews</h2>
          <p className="text-muted-foreground">Send review requests to patients via SMS or WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Manually
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Recipient Manually</DialogTitle>
                <DialogDescription>Enter the phone number to send a review request</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Name (optional)</Label>
                  <Input 
                    value={manualName} 
                    onChange={(e) => setManualName(e.target.value)} 
                    placeholder="Patient name"
                  />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input 
                    value={manualPhone} 
                    onChange={(e) => setManualPhone(e.target.value)} 
                    placeholder="+971 50 123 4567"
                  />
                </div>
                <div>
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as 'sms' | 'whatsapp')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Preview for manual send */}
                {manualPhone.trim() && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-teal">
                      <CheckCircle className="h-4 w-4" />
                      Message Preview
                    </Label>
                    <Card className="bg-teal/5 border-teal/20">
                      <CardContent className="p-3 text-sm">
                        <p className="text-muted-foreground">
                          Hi! Thanks for visiting {clinic.name}. We'd love to hear your feedback! 
                          Please take a moment to share your experience: <span className="text-primary">{reviewLink}</span>
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Button onClick={handleManualSend} disabled={sendRequests.isPending || !manualPhone.trim()} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={selectedPatients.length === 0}>
                <Send className="h-4 w-4 mr-2" />
                Send to Selected ({selectedPatients.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Preview & Confirm</DialogTitle>
                <DialogDescription>
                  Review the message before sending to {selectedPatients.length} patient(s)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as 'sms' | 'whatsapp')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Message Preview Box */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-teal" />
                    Message Preview
                  </Label>
                  <Card className="bg-teal/5 border-teal/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-4 w-4 text-teal" />
                        </div>
                        <div className="text-sm space-y-2">
                          <p className="font-medium text-foreground">
                            Hi! Thanks for visiting {clinic.name}. 
                          </p>
                          <p className="text-muted-foreground">
                            We'd love to hear your feedback! Please take a moment to share your experience:
                          </p>
                          <div className="bg-background rounded-lg p-2 border">
                            <p className="text-xs text-primary break-all">{reviewLink}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recipients Summary */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">Recipients ({selectedPatients.length})</p>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-auto">
                    {patients.filter(p => selectedPatients.includes(p.id)).slice(0, 10).map(p => (
                      <Badge key={p.id} variant="secondary" className="text-xs">
                        {p.name}
                      </Badge>
                    ))}
                    {selectedPatients.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{selectedPatients.length - 10} more
                      </Badge>
                    )}
                  </div>
                </div>

                <Button onClick={handleBulkSend} disabled={sendRequests.isPending} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Confirm & Send to {selectedPatients.length} Patient(s)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Send className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sentRequests.length}</p>
              <p className="text-sm text-muted-foreground">Total Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sentRequests.filter(r => r.status === 'delivered').length}</p>
              <p className="text-sm text-muted-foreground">Delivered</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Users className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{patients.length}</p>
              <p className="text-sm text-muted-foreground">Eligible Patients</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Selection */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Patients
          </CardTitle>
          <CardDescription>Choose patients to send review requests to</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {patientsLoading ? (
            <div className="p-6"><Skeleton className="h-32" /></div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No patients found with messaging opt-in</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedPatients.length === patients.length}
                      onCheckedChange={(checked) => 
                        setSelectedPatients(checked ? patients.map(p => p.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Channels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedPatients.includes(patient.id)}
                        onCheckedChange={() => togglePatient(patient.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {patient.phone}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.last_visit_at 
                        ? format(new Date(patient.last_visit_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {patient.is_opted_in_sms && <Badge variant="outline">SMS</Badge>}
                        {patient.is_opted_in_whatsapp && <Badge variant="outline">WhatsApp</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sentRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No review requests sent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.recipient_name || '-'}</TableCell>
                    <TableCell>{request.recipient_phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{request.channel}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
