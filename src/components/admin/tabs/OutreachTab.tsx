import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Mail, 
  Send, 
  Plus, 
  Edit, 
  Play,
  Pause,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Eye,
  Smartphone,
  Monitor,
  Sparkles,
  TestTube,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  html_content: string;
  plain_content: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  target_filter: Record<string, unknown>;
  schedule_config: Record<string, unknown>;
  max_sends_per_day: number;
  max_sends_per_clinic: number;
  is_active: boolean;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  created_at: string;
}

// Professional email template generator
const generateProfessionalTemplate = (type: string, clinicName = '{{clinic_name}}') => {
  const templates: Record<string, string> = {
    welcome: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#14b8a6 100%);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Welcome to AppointPanda</h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Your clinic listing is now live!</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Hi ${clinicName} Team,</p>
              <p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Congratulations! Your dental practice is now visible to thousands of patients searching for quality dental care in your area.</p>
              <div style="background-color:#f0fdfa;border-left:4px solid #0d9488;padding:20px;margin:24px 0;border-radius:0 8px 8px 0;">
                <p style="margin:0;font-size:14px;color:#0d9488;font-weight:600;">🎉 Your listing is live and ready to attract new patients!</p>
              </div>
              <p style="margin:0 0 30px;font-size:16px;color:#334155;line-height:1.6;">To maximize your visibility and start receiving bookings, we recommend claiming your profile to unlock premium features.</p>
              <a href="{{claim_link}}" style="display:inline-block;background:linear-gradient(135deg,#0d9488 0%,#14b8a6 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;">Claim Your Profile →</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center;">© 2026 AppointPanda. All rights reserved.</p>
              <p style="margin:10px 0 0;font-size:12px;color:#64748b;text-align:center;"><a href="{{unsubscribe_link}}" style="color:#0d9488;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    claim_reminder: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Don't Miss Out!</h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Claim your profile to unlock premium features</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Hi ${clinicName} Team,</p>
              <p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Your clinic profile on AppointPanda is getting noticed! To take full control and access all features, claim your profile now.</p>
              <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:20px;margin:24px 0;border-radius:0 8px 8px 0;">
                <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">⏰ Limited time: Get 30% off your first month when you claim today!</p>
              </div>
              <a href="{{claim_link}}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;">Claim Your Profile →</a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center;">© 2026 AppointPanda. All rights reserved.</p>
              <p style="margin:10px 0 0;font-size:12px;color:#64748b;text-align:center;"><a href="{{unsubscribe_link}}" style="color:#0d9488;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    review_request: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">How Was Your Visit?</h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Your feedback helps us improve</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;text-align:center;">
              <p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Hi {{patient_name}},</p>
              <p style="margin:0 0 30px;font-size:16px;color:#334155;line-height:1.6;">Thank you for visiting ${clinicName}! We'd love to hear about your experience.</p>
              <div style="margin:30px 0;">
                <a href="{{review_link}}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;padding:18px 40px;border-radius:8px;font-weight:600;font-size:16px;">Leave a Review ⭐</a>
              </div>
              <p style="margin:30px 0 0;font-size:14px;color:#64748b;">It only takes 30 seconds and helps other patients find great care!</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center;">© 2026 AppointPanda. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
  return templates[type] || templates.welcome;
};

// Additional professional templates
const additionalTemplates: Record<string, { name: string; subject: string; html: string }> = {
  booking_notification: {
    name: 'New Booking Alert',
    subject: '🎉 New Patient Inquiry for {{clinic_name}}',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);"><tr><td style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);padding:40px 40px 30px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">🎉 New Patient Inquiry!</h1><p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Someone is interested in your services</p></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Hi {{clinic_name}} Team,</p><p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Great news! A patient has just submitted a booking request through AppointPanda.</p><div style="background-color:#f0fdf4;border-left:4px solid #22c55e;padding:20px;margin:24px 0;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#166534;font-weight:600;">📋 Check your dashboard to view and respond to this inquiry</p></div><p style="margin:0 0 30px;font-size:16px;color:#334155;line-height:1.6;">Quick response times lead to higher conversion rates. We recommend responding within 1 hour.</p><a href="{{claim_link}}" style="display:inline-block;background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;">View Dashboard →</a></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:12px;color:#64748b;text-align:center;">© 2026 AppointPanda. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`
  },
  verification_complete: {
    name: 'Verification Complete',
    subject: '✅ Congratulations! {{clinic_name}} is Now Verified',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);"><tr><td style="background:linear-gradient(135deg,#0d9488 0%,#14b8a6 100%);padding:40px 40px 30px;text-align:center;"><div style="font-size:48px;margin-bottom:10px;">✅</div><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">You're Verified!</h1><p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Your clinic profile is now fully verified</p></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Hi {{clinic_name}} Team,</p><p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Congratulations! Your clinic has been successfully verified on AppointPanda. You now have access to all premium features.</p><div style="background-color:#f0fdfa;padding:24px;margin:24px 0;border-radius:12px;"><h3 style="margin:0 0 15px;font-size:16px;color:#0d9488;">What you can do now:</h3><ul style="margin:0;padding:0 0 0 20px;font-size:14px;color:#334155;line-height:2;"><li>✅ Receive and manage bookings</li><li>✅ Respond to patient reviews</li><li>✅ Access analytics dashboard</li><li>✅ Display verified badge on your profile</li><li>✅ Priority listing in search results</li></ul></div><a href="{{claim_link}}" style="display:inline-block;background:linear-gradient(135deg,#0d9488 0%,#14b8a6 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;">Access Your Dashboard →</a></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:12px;color:#64748b;text-align:center;">© 2026 AppointPanda. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`
  },
  profile_incomplete: {
    name: 'Complete Your Profile',
    subject: '⚡ {{clinic_name}} - Complete Your Profile for Better Results',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);"><tr><td style="background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);padding:40px 40px 30px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Almost There!</h1><p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Complete your profile to attract more patients</p></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Hi {{clinic_name}} Team,</p><p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Your clinic profile is live, but it's missing some key information that helps patients choose you.</p><div style="background-color:#eff6ff;border-left:4px solid #3b82f6;padding:20px;margin:24px 0;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">📈 Complete profiles receive 3x more bookings!</p></div><p style="margin:0 0 30px;font-size:16px;color:#334155;line-height:1.6;">Add photos, services, insurance information, and business hours to stand out from competitors.</p><a href="{{claim_link}}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;">Complete Profile →</a></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:12px;color:#64748b;text-align:center;">© 2026 AppointPanda. All rights reserved.</p><p style="margin:10px 0 0;font-size:12px;color:#64748b;text-align:center;"><a href="{{unsubscribe_link}}" style="color:#0d9488;">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`
  },
  weekly_stats: {
    name: 'Weekly Performance',
    subject: '📊 Your Weekly Performance Report - {{clinic_name}}',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);"><tr><td style="background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);padding:40px 40px 30px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">📊 Weekly Report</h1><p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Your performance summary for this week</p></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">Hi {{clinic_name}} Team,</p><p style="margin:0 0 30px;font-size:16px;color:#334155;line-height:1.6;">Here's how your clinic performed on AppointPanda this week:</p><table width="100%" style="margin-bottom:30px;"><tr><td style="background:#f8fafc;padding:20px;border-radius:12px;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#8b5cf6;">247</div><div style="font-size:14px;color:#64748b;">Profile Views</div></td><td width="20"></td><td style="background:#f8fafc;padding:20px;border-radius:12px;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#0d9488;">12</div><div style="font-size:14px;color:#64748b;">Inquiries</div></td><td width="20"></td><td style="background:#f8fafc;padding:20px;border-radius:12px;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#f59e0b;">4.8</div><div style="font-size:14px;color:#64748b;">Rating</div></td></tr></table><a href="{{claim_link}}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;">View Full Analytics →</a></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:12px;color:#64748b;text-align:center;">© 2026 AppointPanda. All rights reserved.</p><p style="margin:10px 0 0;font-size:12px;color:#64748b;text-align:center;"><a href="{{unsubscribe_link}}" style="color:#0d9488;">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`
  }
};

export default function OutreachTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('campaigns');
  const [templateDialog, setTemplateDialog] = useState(false);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [selectedTestTemplate, setSelectedTestTemplate] = useState('');
  const [bulkFilter, setBulkFilter] = useState({ claim_status: 'unclaimed', limit: 5 });

  const [templateForm, setTemplateForm] = useState({
    name: '',
    slug: '',
    subject: '',
    html_content: '',
    plain_content: '',
    category: 'outreach',
    is_active: true,
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    template_id: '',
    target_filter: '{"source": "gmb", "claim_status": "unclaimed"}',
    schedule_config: '{"frequency": "daily"}',
    max_sends_per_day: 50,
    max_sends_per_clinic: 3,
    is_active: false,
  });

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Fetch campaigns
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // Create template
  const createTemplate = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      const { error } = await supabase.from('email_templates').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setTemplateDialog(false);
      resetTemplateForm();
      toast.success('Template created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update template
  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof templateForm }) => {
      const { error } = await supabase.from('email_templates').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setTemplateDialog(false);
      setEditingTemplate(null);
      resetTemplateForm();
      toast.success('Template updated');
    },
  });

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async (data: typeof campaignForm) => {
      const { error } = await supabase.from('outreach_campaigns').insert([{
        ...data,
        target_filter: JSON.parse(data.target_filter),
        schedule_config: JSON.parse(data.schedule_config),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      setCampaignDialog(false);
      resetCampaignForm();
      toast.success('Campaign created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Toggle campaign
  const toggleCampaign = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('outreach_campaigns').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] }),
  });

  // Run campaign
  const runCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('send-outreach', {
        body: { action: 'run-campaign', campaignId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Queued ${data.queued} messages`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Send test email
  const sendTestEmail = useMutation({
    mutationFn: async ({ email, templateId }: { email: string; templateId?: string }) => {
      // Validate email client-side first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        throw new Error('Please enter a valid email address');
      }
      // Don't send "default" as templateId - only send valid UUIDs
      const validTemplateId = templateId && templateId !== 'default' ? templateId : undefined;
      const { data, error } = await supabase.functions.invoke('send-outreach', {
        body: { action: 'send-test', testEmail: email.trim(), templateId: validTemplateId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Test email sent successfully!');
      setTestEmail('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Send bulk emails
  const sendBulkEmails = useMutation({
    mutationFn: async ({ templateId, filter, limit }: { templateId: string; filter: Record<string, unknown>; limit: number }) => {
      const { data, error } = await supabase.functions.invoke('send-outreach', {
        body: { 
          action: 'send-bulk', 
          templateId, 
          targetFilter: filter,
          limit 
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sent ${data.sent} emails (${data.failed} failed)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      slug: '',
      subject: '',
      html_content: '',
      plain_content: '',
      category: 'outreach',
      is_active: true,
    });
  };

  const resetCampaignForm = () => {
    setCampaignForm({
      name: '',
      description: '',
      template_id: '',
      target_filter: '{"source": "gmb", "claim_status": "unclaimed"}',
      schedule_config: '{"frequency": "daily"}',
      max_sends_per_day: 50,
      max_sends_per_clinic: 3,
      is_active: false,
    });
  };

  const openEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      slug: template.slug,
      subject: template.subject,
      html_content: template.html_content,
      plain_content: template.plain_content || '',
      category: template.category || 'outreach',
      is_active: template.is_active,
    });
    setTemplateDialog(true);
  };

  const openPreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setPreviewDialog(true);
  };

  // Sample data for preview rendering
  const renderPreviewContent = (html: string) => {
    const sampleData: Record<string, string> = {
      clinic_name: 'Premium Dental Care',
      patient_name: 'Sarah Johnson',
      claim_link: 'https://appointpanda.com/claim/abc123',
      review_link: 'https://appointpanda.com/review/abc123',
      unsubscribe_link: 'https://appointpanda.com/unsubscribe',
    };
    let content = html;
    Object.entries(sampleData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return content;
  };

  const applyProfessionalTemplate = (type: string) => {
    const html = generateProfessionalTemplate(type);
    setTemplateForm(prev => ({
      ...prev,
      html_content: html,
    }));
    toast.success('Professional template applied');
  };

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data: templateForm });
    } else {
      createTemplate.mutate(templateForm);
    }
  };

  const handleSaveCampaign = () => {
    if (editingCampaign) {
      // Update campaign logic here
    } else {
      createCampaign.mutate(campaignForm);
    }
  };

  const totalSent = campaigns?.reduce((sum, c) => sum + (c.total_sent || 0), 0) || 0;
  const totalOpened = campaigns?.reduce((sum, c) => sum + (c.total_opened || 0), 0) || 0;
  const activeCampaigns = campaigns?.filter(c => c.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Outreach Center</h1>
          <p className="text-muted-foreground mt-1">Email campaigns and templates for clinic outreach</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{templates?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Templates</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <Play className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCampaigns}</p>
              <p className="text-sm text-muted-foreground">Active Campaigns</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <Send className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSent}</p>
              <p className="text-sm text-muted-foreground">Emails Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Eye className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOpened}</p>
              <p className="text-sm text-muted-foreground">Opened</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="campaigns" className="rounded-xl">Campaigns</TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl">Templates</TabsTrigger>
          <TabsTrigger value="testing" className="rounded-xl">
            <TestTube className="h-4 w-4 mr-1" />
            Test & Send
          </TabsTrigger>
          <TabsTrigger value="messages" className="rounded-xl">Message Log</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Email Campaigns</CardTitle>
              <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingCampaign(null); resetCampaignForm(); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={campaignForm.description} onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select value={campaignForm.template_id} onValueChange={(v) => setCampaignForm({ ...campaignForm, template_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates?.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Max Sends/Day</Label>
                        <Input type="number" value={campaignForm.max_sends_per_day} onChange={(e) => setCampaignForm({ ...campaignForm, max_sends_per_day: parseInt(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Per Clinic</Label>
                        <Input type="number" value={campaignForm.max_sends_per_clinic} onChange={(e) => setCampaignForm({ ...campaignForm, max_sends_per_clinic: parseInt(e.target.value) })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Target Filter (JSON)</Label>
                      <Textarea value={campaignForm.target_filter} onChange={(e) => setCampaignForm({ ...campaignForm, target_filter: e.target.value })} className="font-mono text-sm" rows={3} />
                    </div>
                    <Button onClick={handleSaveCampaign} className="w-full" disabled={createCampaign.isPending}>
                      {editingCampaign ? 'Update' : 'Create'} Campaign
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns?.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="font-medium">{campaign.name}</div>
                        {campaign.description && <p className="text-xs text-muted-foreground">{campaign.description}</p>}
                      </TableCell>
                      <TableCell>
                        {templates?.find(t => t.id === campaign.template_id)?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Sent:</span> {campaign.total_sent} | 
                          <span className="text-muted-foreground"> Opened:</span> {campaign.total_opened}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={campaign.is_active}
                          onCheckedChange={(v) => toggleCampaign.mutate({ id: campaign.id, active: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => runCampaign.mutate(campaign.id)} disabled={!campaign.is_active}>
                          <Send className="h-4 w-4 mr-1" />
                          Run
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!campaigns || campaigns.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No campaigns yet</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Email Templates</CardTitle>
                <CardDescription>Professional templates with live preview</CardDescription>
              </div>
              <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingTemplate(null); resetTemplateForm(); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Slug</Label>
                          <Input value={templateForm.slug} onChange={(e) => setTemplateForm({ ...templateForm, slug: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="Email subject line" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Quick Templates</Label>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => applyProfessionalTemplate('welcome')}>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Welcome
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => applyProfessionalTemplate('claim_reminder')}>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Claim
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => applyProfessionalTemplate('review_request')}>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Review
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>HTML Content</Label>
                        <Textarea value={templateForm.html_content} onChange={(e) => setTemplateForm({ ...templateForm, html_content: e.target.value })} rows={12} className="font-mono text-xs" placeholder="<html>...</html>" />
                        <p className="text-xs text-muted-foreground">Variables: {"{{clinic_name}}"}, {"{{claim_link}}"}, {"{{unsubscribe_link}}"}, {"{{patient_name}}"}, {"{{review_link}}"}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Active</Label>
                        <Switch checked={templateForm.is_active} onCheckedChange={(v) => setTemplateForm({ ...templateForm, is_active: v })} />
                      </div>
                      <Button onClick={handleSaveTemplate} className="w-full" disabled={createTemplate.isPending || updateTemplate.isPending}>
                        {editingTemplate ? 'Update' : 'Create'} Template
                      </Button>
                    </div>
                    {/* Live Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Live Preview</Label>
                        <div className="flex gap-1">
                          <Button 
                            type="button" 
                            variant={previewMode === 'mobile' ? 'default' : 'outline'} 
                            size="sm"
                            onClick={() => setPreviewMode('mobile')}
                          >
                            <Smartphone className="h-4 w-4" />
                          </Button>
                          <Button 
                            type="button" 
                            variant={previewMode === 'desktop' ? 'default' : 'outline'} 
                            size="sm"
                            onClick={() => setPreviewMode('desktop')}
                          >
                            <Monitor className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className={`border rounded-xl overflow-hidden bg-muted/30 ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''}`}>
                        <div className="bg-muted/50 px-3 py-2 border-b flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                          </div>
                          <span className="text-xs text-muted-foreground flex-1 text-center truncate">{templateForm.subject || 'Email Preview'}</span>
                        </div>
                        <div className="h-[400px] overflow-auto">
                          {templateForm.html_content ? (
                            <iframe
                              srcDoc={renderPreviewContent(templateForm.html_content)}
                              className="w-full h-full border-0"
                              title="Email Preview"
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                              <div className="text-center">
                                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Enter HTML to see preview</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates?.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <p className="text-xs text-muted-foreground">{template.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{template.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.category || 'outreach'}</Badge>
                      </TableCell>
                      <TableCell>
                        {template.is_active ? (
                          <Badge className="bg-teal/20 text-teal border-0">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => openPreview(template)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditTemplate(template)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!templates || templates.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No templates yet</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Template Preview Dialog */}
          <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Template Preview: {previewTemplate?.name}</DialogTitle>
                  <div className="flex gap-1">
                    <Button 
                      variant={previewMode === 'mobile' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setPreviewMode('mobile')}
                    >
                      <Smartphone className="h-4 w-4 mr-1" />
                      Mobile
                    </Button>
                    <Button 
                      variant={previewMode === 'desktop' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setPreviewMode('desktop')}
                    >
                      <Monitor className="h-4 w-4 mr-1" />
                      Desktop
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <div className={`border rounded-xl overflow-hidden bg-muted/30 ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''}`}>
                <div className="bg-muted/50 px-3 py-2 border-b flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-muted-foreground flex-1 text-center truncate">{previewTemplate?.subject}</span>
                </div>
                <div className="h-[500px] overflow-auto">
                  {previewTemplate?.html_content && (
                    <iframe
                      srcDoc={renderPreviewContent(previewTemplate.html_content)}
                      className="w-full h-full border-0"
                      title="Email Preview"
                    />
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="testing" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Test Single Email */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-primary" />
                  Send Test Email
                </CardTitle>
                <CardDescription>Test your SMTP configuration and templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    type="email" 
                    placeholder="test@example.com" 
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template (Optional)</Label>
                  <Select value={selectedTestTemplate} onValueChange={setSelectedTestTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Default test template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default Test Template</SelectItem>
                      {templates?.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => sendTestEmail.mutate({ email: testEmail, templateId: selectedTestTemplate || undefined })}
                  disabled={!testEmail || sendTestEmail.isPending}
                  className="w-full"
                >
                  {sendTestEmail.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Test Email
                </Button>
              </CardContent>
            </Card>

            {/* Bulk Send */}
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Bulk Send
                </CardTitle>
                <CardDescription>Send emails to multiple clinics at once</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target Clinics</Label>
                  <Select value={bulkFilter.claim_status} onValueChange={(v) => setBulkFilter({...bulkFilter, claim_status: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unclaimed">Unclaimed Profiles</SelectItem>
                      <SelectItem value="claimed">Claimed Profiles</SelectItem>
                      <SelectItem value="all">All Profiles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTestTemplate} onValueChange={setSelectedTestTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Limit (max emails)</Label>
                  <Input 
                    type="number" 
                    value={bulkFilter.limit}
                    onChange={(e) => setBulkFilter({...bulkFilter, limit: parseInt(e.target.value) || 5})}
                    min={1}
                    max={50}
                  />
                </div>
                <Button 
                  onClick={() => sendBulkEmails.mutate({ 
                    templateId: selectedTestTemplate, 
                    filter: { claim_status: bulkFilter.claim_status },
                    limit: bulkFilter.limit 
                  })}
                  disabled={!selectedTestTemplate || sendBulkEmails.isPending}
                  className="w-full"
                  variant="outline"
                >
                  {sendBulkEmails.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send to {bulkFilter.limit} Clinics
                </Button>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>SMTP Configuration</AlertTitle>
            <AlertDescription>
              Emails are sent using your configured SMTP server. Make sure your SMTP settings are correctly configured in Settings → Email tab.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <Card className="card-modern">
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Message Log Coming Soon</h3>
              <p className="text-muted-foreground">View delivery status and engagement metrics for all sent messages</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
