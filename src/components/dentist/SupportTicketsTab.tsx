import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  HelpCircle,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Building2,
  Sparkles,
  Loader2,
}from 'lucide-react';

const TICKET_CATEGORIES = [
  { value: 'billing', label: 'Billing & Subscription', icon: '💳' },
  { value: 'technical', label: 'Technical Issue', icon: '🔧' },
  { value: 'profile', label: 'Profile Help', icon: '👤' },
  { value: 'review', label: 'Review Management', icon: '⭐' },
  { value: 'integration', label: 'Integration (GMB/SMS)', icon: '🔗' },
  { value: 'feature', label: 'Feature Request', icon: '💡' },
  { value: 'other', label: 'Other', icon: '📝' },
];

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Closed', color: 'bg-muted text-muted-foreground' },
};

interface SupportTicket {
  id: string;
  user_id: string;
  clinic_id?: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  admin_response?: string;
  responded_at?: string;
}

export default function SupportTicketsTab() {
  const { user } = useAuth();
  const { data: siteSettings } = useSiteSettings();
  const supportEmail = siteSettings?.contactDetails?.support_email || 'support@appointpanda.com';
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    description: '',
  });

  // Fetch clinic
  const { data: clinic } = useQuery({
    queryKey: ['support-clinic', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch tickets from support_tickets table
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SupportTicket[];
    },
    enabled: !!clinic?.id,
  });

  // AI-assisted category suggestion
  const suggestCategory = (text: string) => {
    const lowered = text.toLowerCase();
    if (lowered.includes('pay') || lowered.includes('bill') || lowered.includes('subscri') || lowered.includes('price')) {
      return 'billing';
    }
    if (lowered.includes('error') || lowered.includes('bug') || lowered.includes('not working') || lowered.includes('broken')) {
      return 'technical';
    }
    if (lowered.includes('review') || lowered.includes('feedback') || lowered.includes('rating')) {
      return 'review';
    }
    if (lowered.includes('google') || lowered.includes('gmb') || lowered.includes('sms') || lowered.includes('whatsapp')) {
      return 'integration';
    }
    if (lowered.includes('profile') || lowered.includes('photo') || lowered.includes('image') || lowered.includes('hours')) {
      return 'profile';
    }
    return '';
  };

  const handleDescriptionChange = (value: string) => {
    setFormData({ ...formData, description: value });
    if (!formData.category) {
      const suggested = suggestCategory(value);
      if (suggested) {
        setFormData(prev => ({ ...prev, category: suggested }));
      }
    }
  };

  // Create ticket mutation
  const createTicket = useMutation({
    mutationFn: async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');
      
      const { error } = await supabase.from('support_tickets').insert({
        clinic_id: clinic?.id,
        user_id: currentUser.id,
        category: formData.category,
        subject: formData.subject,
        description: formData.description,
        ai_suggested_category: suggestCategory(formData.description) || null,
        status: 'open',
        priority: 'medium',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setCreateDialogOpen(false);
      setFormData({ category: '', subject: '', description: '' });
      toast.success('Support ticket created! Our team will respond within 24 hours.');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create ticket'),
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            Support & Help
          </h2>
          <p className="text-muted-foreground">Get help from our team</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.category && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Sparkles className="h-3 w-3" />
                    AI suggested based on your description
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Brief summary of your issue"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="Describe your issue in detail. The more info, the faster we can help!"
                  rows={5}
                />
              </div>

              <Button 
                onClick={() => createTicket.mutate()}
                disabled={!formData.category || !formData.subject || !formData.description || createTicket.isPending}
                className="w-full gap-2"
              >
                {createTicket.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Help */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-white border-primary hover:bg-primary/90 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-lg">📚</span>
            </div>
            <div>
              <p className="font-medium text-white">Help Center</p>
              <p className="text-xs text-primary-foreground/70">Browse FAQs and guides</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-teal text-white border-teal hover:bg-teal/90 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-lg">💬</span>
            </div>
            <div>
              <p className="font-medium text-white">Live Chat</p>
              <p className="text-xs text-teal-100">Chat with support (9AM-6PM)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 text-white border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-lg">📧</span>
            </div>
            <div>
              <p className="font-medium text-white">Email Us</p>
              <p className="text-xs text-slate-400">{supportEmail}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Your Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-2">No Tickets Yet</h3>
              <p className="text-muted-foreground mb-4">
                Have a question or issue? Create a support ticket and our team will help.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                        {TICKET_CATEGORIES.find(c => c.value === ticket.category)?.icon || '📝'}
                      </div>
                      <div>
                        <p className="font-medium">{ticket.subject}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{ticket.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={STATUS_CONFIG[ticket.status].color}>
                            {STATUS_CONFIG[ticket.status].label}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {ticket.admin_response && (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Replied
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
