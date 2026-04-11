import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClinicSubscription, useHasFeature } from '@/hooks/useClinicFeatures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  MessageSquare,
  Send,
  Inbox,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  AlertCircle,
  Megaphone,
  Users,
  FileText,
  Lock,
  Crown,
} from 'lucide-react';
import { NoPracticeLinked } from './NoPracticeLinked';
import UpgradePrompt from '@/components/subscription/UpgradePrompt';

interface Message {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  direction: string;
  channel: string;
  recipient_phone: string;
  message_content: string;
  template_type: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface CrmNumber {
  id: string;
  phone_number: string;
  is_active: boolean;
  is_whatsapp_enabled: boolean;
}

const MESSAGE_TEMPLATES = [
  { id: 'appointment_reminder', name: 'Appointment Reminder', text: 'Hi {name}, this is a reminder for your appointment at {clinic} on {date}. Reply YES to confirm or call us to reschedule.' },
  { id: 'review_request', name: 'Review Request', text: 'Hi {name}, thank you for visiting {clinic}! We value your feedback. Please share your experience: {link}' },
  { id: 'followup', name: 'Follow-up', text: 'Hi {name}, thank you for your visit to {clinic}. How are you feeling? Let us know if you need anything!' },
  { id: 'promotion', name: 'Special Offer', text: 'Hi {name}! {clinic} has a special offer for you. Visit us this month and get 20% off your next treatment!' },
];

export default function MessagesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-messages', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch CRM number
  const { data: crmNumber } = useQuery({
    queryKey: ['clinic-crm-number', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_numbers')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as CrmNumber | null;
    },
    enabled: !!clinic?.id,
  });

  // Fetch messages
  const { data: messages, isLoading: messagesLoading, refetch } = useQuery({
    queryKey: ['clinic-messages', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_messages')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!clinic?.id,
  });

  // Fetch patients for quick selection
  const { data: patients } = useQuery({
    queryKey: ['clinic-patients-quick', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone, is_opted_in_sms')
        .eq('clinic_id', clinic?.id)
        .eq('is_opted_in_sms', true)
        .order('last_visit_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  // Real-time updates for messages
  useEffect(() => {
    if (!clinic?.id) return;

    const channel = supabase
      .channel('clinic-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clinic_messages',
          filter: `clinic_id=eq.${clinic.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinic?.id, refetch]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error('No clinic found');
      if (!recipientPhone.trim()) throw new Error('Phone number is required');
      if (!messageContent.trim()) throw new Error('Message is required');

      const { error } = await supabase.from('clinic_messages').insert({
        clinic_id: clinic.id,
        recipient_phone: recipientPhone.trim(),
        message_content: messageContent.trim(),
        channel: channel,
        direction: 'outbound',
        status: crmNumber ? 'queued' : 'pending',
        template_type: selectedTemplate || null,
        crm_number_id: crmNumber?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Message queued for delivery');
      setComposeOpen(false);
      setRecipientPhone('');
      setMessageContent('');
      setSelectedTemplate('');
      queryClient.invalidateQueries({ queryKey: ['clinic-messages'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to send message'),
  });

  // Filter messages
  const filteredMessages = messages?.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.recipient_phone.includes(searchQuery) ||
      m.message_content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'sent' && m.direction === 'outbound') ||
      (activeTab === 'received' && m.direction === 'inbound') ||
      (activeTab === 'failed' && m.status === 'failed');

    return matchesSearch && matchesTab;
  });

  const stats = {
    total: messages?.length || 0,
    sent: messages?.filter((m) => m.direction === 'outbound' && m.status === 'delivered').length || 0,
    pending: messages?.filter((m) => m.status === 'pending' || m.status === 'queued').length || 0,
    failed: messages?.filter((m) => m.status === 'failed').length || 0,
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setMessageContent(template.text.replace('{clinic}', clinic?.name || 'our clinic'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800 border-0">Delivered</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800 border-0">Sent</Badge>;
      case 'pending':
      case 'queued':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Check feature access
  const { data: subscription } = useClinicSubscription(clinic?.id);
  const { hasAccess: hasSmsReminders, usageLimit: messageLimit } = useHasFeature(clinic?.id, 'sms_reminders');
  
  const planName = subscription?.plan?.name || 'Free';
  const isPaidPlan = planName !== 'Free' && planName !== 'Basic';

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  // Show upgrade prompt if not on paid plan
  if (!isPaidPlan) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold">Messages</h2>
          <p className="text-muted-foreground">SMS & WhatsApp communication center</p>
        </div>
        
        <UpgradePrompt 
          featureName="Messaging Center"
          featureDescription="Send SMS and WhatsApp messages to your patients for reminders, follow-ups, and promotions."
          requiredPlan="professional"
          clinicId={clinic.id}
        />
        
        {/* Preview of features (locked) */}
        <div className="grid md:grid-cols-2 gap-4 opacity-60 pointer-events-none">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                SMS Messages
                <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Send appointment reminders and follow-up messages via SMS</p>
            </CardContent>
          </Card>
          
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-teal" />
                WhatsApp Business
                <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Connect with patients through WhatsApp messaging</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Messages</h2>
          <p className="text-muted-foreground">SMS & WhatsApp communication center</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Crown className="h-3 w-3 mr-1" />
            {planName}
          </Badge>
          {messageLimit && (
            <Badge variant="outline" className="text-muted-foreground">
              {stats.total} / {messageLimit} messages
            </Badge>
          )}
        </div>
      </div>
      
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Compose Message
          </Button>
        </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Compose Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* CRM Number Status */}
              {!crmNumber ? (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">No CRM Number Assigned</p>
                    <p className="text-sm text-amber-700">Messages will be queued but cannot be sent until a number is assigned by admin.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Sending from: {crmNumber.phone_number}</p>
                    {crmNumber.is_whatsapp_enabled && (
                      <p className="text-xs text-green-700">WhatsApp enabled</p>
                    )}
                  </div>
                </div>
              )}

              {/* Channel Selection */}
              <div className="space-y-2">
                <Label>Channel</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={channel === 'sms' ? 'default' : 'outline'}
                    onClick={() => setChannel('sms')}
                    className="flex-1"
                  >
                    SMS
                  </Button>
                  <Button
                    type="button"
                    variant={channel === 'whatsapp' ? 'default' : 'outline'}
                    onClick={() => setChannel('whatsapp')}
                    disabled={!crmNumber?.is_whatsapp_enabled}
                    className="flex-1"
                  >
                    WhatsApp
                  </Button>
                </div>
              </div>

              {/* Quick Patient Select */}
              {patients && patients.length > 0 && (
                <div className="space-y-2">
                  <Label>Quick Select Patient</Label>
                  <Select onValueChange={(phone) => setRecipientPhone(phone)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a patient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.phone}>
                          {p.name} - {p.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Phone Number */}
              <div className="space-y-2">
                <Label>Recipient Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="+971 50 XXX XXXX"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Message Template (Optional)</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {messageContent.length} / 160 characters (SMS limit)
                </p>
              </div>

              {/* Message Preview */}
              {messageContent.trim() && recipientPhone.trim() && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Message Preview
                  </Label>
                  <Card className="bg-teal/5 border-teal/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          {channel === 'whatsapp' ? (
                            <MessageSquare className="h-4 w-4 text-green-600" />
                          ) : (
                            <Phone className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="text-sm space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">To: {recipientPhone}</span>
                            <Badge variant="outline" className="text-xs capitalize">{channel}</Badge>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap">{messageContent}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => sendMessage.mutate()}
                disabled={sendMessage.isPending || !recipientPhone.trim() || !messageContent.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendMessage.isPending ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      {/* CRM Number Status Banner */}
      {!crmNumber && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">No CRM Number Assigned</p>
              <p className="text-sm text-amber-700">Contact admin to get a dedicated phone number for sending messages.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Tabs */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by phone or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Message Log ({filteredMessages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messagesLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : filteredMessages && filteredMessages.length > 0 ? (
            <div className="space-y-3">
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start justify-between p-4 bg-muted/50 rounded-xl border hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        msg.direction === 'outbound'
                          ? 'bg-blue-100'
                          : 'bg-green-100'
                      }`}
                    >
                      {msg.direction === 'outbound' ? (
                        <ArrowUpRight className="h-5 w-5 text-blue-600" />
                      ) : (
                        <ArrowDownLeft className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{msg.recipient_phone}</span>
                        <Badge variant="outline" className="text-xs uppercase">
                          {msg.channel}
                        </Badge>
                        {msg.template_type && (
                          <Badge variant="secondary" className="text-xs">
                            {msg.template_type.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {msg.message_content}
                      </p>
                      {msg.error_message && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {msg.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(msg.status)}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(msg.created_at), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No messages found</p>
              <p className="text-sm mt-1">Send your first message to a patient</p>
              <Button className="mt-4" onClick={() => setComposeOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Compose Message
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
