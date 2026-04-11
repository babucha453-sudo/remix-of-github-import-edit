import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  MessageSquare,
  Search,
  Building2,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  Pause,
  Play,
  Settings,
  AlertTriangle,
  TrendingUp,
  Mail,
  Eye,
  Smartphone,
  Monitor,
} from 'lucide-react';

interface Message {
  id: string;
  clinic_id: string;
  direction: string;
  channel: string;
  recipient_phone: string;
  message_content: string;
  template_type: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  clinic?: { id: string; name: string } | null;
}

interface AutomationSettings {
  id: string;
  clinic_id: string;
  is_messaging_enabled: boolean;
  daily_message_limit: number;
  clinic?: { id: string; name: string } | null;
}

// Message templates for preview
const messageTemplates = [
  {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    channel: 'sms',
    template: 'Hi {{patient_name}}, this is a reminder for your appointment at {{clinic_name}} on {{date}} at {{time}}. Reply CONFIRM to confirm or RESCHEDULE to change.\n\n– {{clinic_name}}',
  },
  {
    id: 'review_request',
    name: 'Review Request',
    channel: 'sms',
    template: 'Hi {{patient_name}}, thank you for visiting {{clinic_name}}. We\'d love your feedback! Please share your experience: {{review_link}}\n\n– {{clinic_name}}',
  },
  {
    id: 'booking_confirmation',
    name: 'Booking Confirmation',
    channel: 'sms',
    template: 'Your appointment is confirmed! ✓\n\n📍 {{clinic_name}}\n📅 {{date}} at {{time}}\n🦷 {{treatment}}\n\nTo reschedule: {{reschedule_link}}\nTo cancel: {{cancel_link}}',
  },
  {
    id: 'welcome_message',
    name: 'Welcome Message',
    channel: 'whatsapp',
    template: 'Welcome to {{clinic_name}}! 👋\n\nThank you for choosing us for your dental care. We\'re here to help you maintain a healthy smile.\n\nBook your next appointment: {{booking_link}}\n\n– The {{clinic_name}} Team',
  },
  {
    id: 'followup',
    name: 'Post-Treatment Follow-up',
    channel: 'sms',
    template: 'Hi {{patient_name}}, we hope you\'re feeling great after your visit to {{clinic_name}}! If you have any questions or concerns, please don\'t hesitate to contact us.\n\nReply HELP for assistance.',
  },
];

export default function MessagingControlTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<typeof messageTemplates[0] | null>(null);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  
  // Sample data for preview
  const sampleData = {
    patient_name: 'Sarah Johnson',
    clinic_name: 'Premium Dental Care',
    date: 'January 15, 2026',
    time: '10:30 AM',
    treatment: 'Teeth Cleaning',
    review_link: 'https://appointpanda.com/review/abc123',
    booking_link: 'https://appointpanda.com/book/abc123',
    reschedule_link: 'https://appointpanda.com/reschedule/abc123',
    cancel_link: 'https://appointpanda.com/cancel/abc123',
  };
  
  const renderPreviewContent = (template: string) => {
    let content = template;
    Object.entries(sampleData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return content;
  };
  
  const openPreview = (template: typeof messageTemplates[0]) => {
    setPreviewTemplate(template);
    setPreviewDialog(true);
  };

  // Fetch all messages
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-all-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_messages')
        .select('*, clinic:clinics(id, name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as Message[];
    },
  });

  // Fetch clinic automation settings
  const { data: automationSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_automation_settings')
        .select('*, clinic:clinics(id, name)')
        .order('clinic_id');

      if (error) throw error;
      return data as AutomationSettings[];
    },
  });

  // Toggle messaging for clinic
  const toggleMessaging = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('clinic_automation_settings')
        .update({ is_messaging_enabled: enabled })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-automation-settings'] });
      toast.success('Messaging status updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  // Update daily limit
  const updateLimit = useMutation({
    mutationFn: async ({ id, limit }: { id: string; limit: number }) => {
      const { error } = await supabase
        .from('clinic_automation_settings')
        .update({ daily_message_limit: limit })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-automation-settings'] });
      toast.success('Limit updated');
    },
  });

  // Filter messages
  const filteredMessages = messages?.filter((m) =>
    !searchQuery ||
    m.recipient_phone.includes(searchQuery) ||
    m.clinic?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.message_content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalMessages: messages?.length || 0,
    delivered: messages?.filter((m) => m.status === 'delivered').length || 0,
    failed: messages?.filter((m) => m.status === 'failed').length || 0,
    clinicsMessaging: automationSettings?.filter((s) => s.is_messaging_enabled).length || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800">Sent</Badge>;
      case 'pending':
      case 'queued':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Messaging Control</h1>
          <p className="text-muted-foreground mt-1">Monitor and control all clinic messaging</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalMessages}</p>
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
                <p className="text-2xl font-bold">{stats.delivered}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.clinicsMessaging}</p>
                <p className="text-xs text-muted-foreground">Clinics Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="overview" className="rounded-xl">
            <TrendingUp className="h-4 w-4 mr-2" />
            Message Log
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl">
            <MessageSquare className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="clinics" className="rounded-xl">
            <Building2 className="h-4 w-4 mr-2" />
            Clinic Controls
          </TabsTrigger>
          <TabsTrigger value="failures" className="rounded-xl">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Failures
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Preview and manage message templates</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messageTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <span className="font-medium">{template.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-xs">
                          {template.channel}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {template.template.substring(0, 50)}...
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openPreview(template)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Message Log</CardTitle>
              <CardDescription>All messages sent from the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Search by phone, clinic, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messagesLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredMessages && filteredMessages.length > 0 ? (
                      filteredMessages.slice(0, 50).map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(msg.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {msg.clinic?.name || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{msg.recipient_phone}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase text-xs">
                              {msg.channel}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm">
                            {msg.message_content}
                          </TableCell>
                          <TableCell>{getStatusBadge(msg.status)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No messages found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clinics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Clinic Messaging Controls</CardTitle>
              <CardDescription>
                Enable/disable messaging and set limits per clinic
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Messaging</TableHead>
                    <TableHead>Daily Limit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settingsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : automationSettings && automationSettings.length > 0 ? (
                    automationSettings.map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {setting.clinic?.name || 'Unknown Clinic'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={setting.is_messaging_enabled}
                            onCheckedChange={(checked) =>
                              toggleMessaging.mutate({ id: setting.id, enabled: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-24"
                            value={setting.daily_message_limit}
                            onChange={(e) =>
                              updateLimit.mutate({
                                id: setting.id,
                                limit: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {setting.is_messaging_enabled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                toggleMessaging.mutate({ id: setting.id, enabled: false })
                              }
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() =>
                                toggleMessaging.mutate({ id: setting.id, enabled: true })
                              }
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Enable
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No clinic settings configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failures" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Failed Messages
              </CardTitle>
              <CardDescription>Messages that failed to deliver</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages?.filter((m) => m.status === 'failed').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No failed messages
                      </TableCell>
                    </TableRow>
                  ) : (
                    messages
                      ?.filter((m) => m.status === 'failed')
                      .slice(0, 50)
                      .map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(msg.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>{msg.clinic?.name || 'Unknown'}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {msg.recipient_phone}
                          </TableCell>
                          <TableCell className="text-red-500 text-sm">
                            {msg.error_message || 'Unknown error'}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Preview: {previewTemplate?.name}</span>
              <div className="flex gap-2">
                <Button 
                  variant={previewMode === 'mobile' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
                <Button 
                  variant={previewMode === 'desktop' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-center">
              <div 
                className={`bg-muted rounded-2xl p-4 ${
                  previewMode === 'mobile' 
                    ? 'w-80 min-h-96' 
                    : 'w-full min-h-48'
                }`}
              >
                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    {previewTemplate?.channel === 'whatsapp' ? (
                      <MessageSquare className="h-4 w-4 text-green-600" />
                    ) : (
                      <Phone className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {previewTemplate?.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                    </p>
                    <p className="text-xs text-muted-foreground">+971 50 123 4567</p>
                  </div>
                </div>
                <div className="bg-background rounded-xl p-4 shadow-sm">
                  <p className="whitespace-pre-wrap text-sm">
                    {previewTemplate ? renderPreviewContent(previewTemplate.template) : ''}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-right mt-2">
                  {format(new Date(), 'HH:mm')}
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">Variables used:</p>
              <div className="flex flex-wrap gap-1">
                {Object.keys(sampleData).map((key) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {`{{${key}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
