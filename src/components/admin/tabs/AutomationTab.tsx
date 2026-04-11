import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  Zap, 
  Play, 
  Pause, 
  Plus, 
  Edit, 
  Trash2,
  Clock,
  Mail,
  Bell,
  MessageSquare,
  Calendar,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  RefreshCw,
  Database,
  Search,
  FileSearch,
  Timer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

type AutomationRule = {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  trigger_config: Record<string, any>;
  action_config: Record<string, any>;
  is_enabled: boolean;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
};

type AutomationLog = {
  id: string;
  rule_id: string | null;
  status: string;
  error_message: string | null;
  details: Record<string, any> | null;
  executed_at: string;
};

// Pre-defined job presets
const JOB_PRESETS = [
  {
    name: 'GMB Import Job',
    description: 'Import new clinic listings from Google Business Profile',
    rule_type: 'gmb_import',
    trigger_config: { schedule: 'daily', time: '02:00' },
    action_config: { max_per_run: 100, cities: ['los-angeles', 'san-francisco', 'boston'] },
  },
  {
    name: 'Unclaimed Outreach',
    description: 'Send outreach emails to unclaimed GMB listings',
    rule_type: 'unclaimed_outreach',
    trigger_config: { schedule: 'daily', time: '10:00', days_since_import: 3 },
    action_config: { max_sends_per_day: 50, template: 'claim_invitation' },
  },
  {
    name: 'Duplicate Detection',
    description: 'Scan for potential duplicate clinic listings',
    rule_type: 'duplicate_detection',
    trigger_config: { schedule: 'weekly', day: 'monday', time: '03:00' },
    action_config: { similarity_threshold: 0.8 },
  },
  {
    name: 'SEO Audit Job',
    description: 'Run SEO audits on location and service pages',
    rule_type: 'seo_audit',
    trigger_config: { schedule: 'weekly', day: 'sunday', time: '04:00' },
    action_config: { check_meta: true, check_content: true, check_links: true },
  },
  {
    name: 'Review Funnel Report',
    description: 'Generate weekly report on review funnel performance',
    rule_type: 'review_report',
    trigger_config: { schedule: 'weekly', day: 'monday', time: '08:00' },
    action_config: { send_email: true, recipients: ['admin@appointpanda.com'] },
  },
  {
    name: 'Verification Expiry Reminder',
    description: 'Remind clinics about expiring verifications',
    rule_type: 'verification_reminder',
    trigger_config: { schedule: 'daily', time: '09:00', days_before_expiry: 30 },
    action_config: { template: 'verification_reminder', max_sends: 20 },
  },
  {
    name: 'Lead Follow-up',
    description: 'Follow up on leads that have not been contacted',
    rule_type: 'lead_followup',
    trigger_config: { hours_since_created: 24 },
    action_config: { max_per_run: 50 },
  },
];

const SCHEDULE_OPTIONS = [
  { value: 'hourly', label: 'Every Hour' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function AutomationTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('rules');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetDialog, setPresetDialog] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    rule_type: 'lead_followup',
    trigger_config: '{}',
    action_config: '{}',
    is_enabled: true,
  });

  // Fetch automation rules
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    },
  });

  // Fetch automation logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AutomationLog[];
    },
  });

  // Create rule mutation
  const createRule = useMutation({
    mutationFn: async (data: typeof form) => {
      const { error } = await supabase.from('automation_rules').insert({
        name: data.name,
        description: data.description || null,
        rule_type: data.rule_type,
        trigger_config: JSON.parse(data.trigger_config),
        action_config: JSON.parse(data.action_config),
        is_enabled: data.is_enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Rule created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error creating rule', description: error.message, variant: 'destructive' });
    },
  });

  // Update rule mutation
  const updateRule = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AutomationRule> }) => {
      const { error } = await supabase.from('automation_rules').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      toast({ title: 'Rule updated successfully' });
    },
  });

  // Toggle rule mutation
  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('automation_rules').update({ is_enabled: enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
  });

  // Delete rule mutation
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast({ title: 'Rule deleted successfully' });
    },
  });

  // Run rule manually
  const runRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { data, error } = await supabase.functions.invoke('run-automation', {
        body: { ruleId, action: 'execute-rule' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
      toast({ title: 'Rule executed', description: data.success ? 'Completed successfully' : data.error });
    },
    onError: (e: any) => toast({ title: 'Execution failed', description: e.message, variant: 'destructive' }),
  });

  // Run all enabled rules
  const runAllRules = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('run-automation', {
        body: { action: 'run-all' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
      toast({ title: 'All rules executed', description: `${data.executed} rules processed` });
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      rule_type: 'lead_followup',
      trigger_config: '{}',
      action_config: '{}',
      is_enabled: true,
    });
  };

  const openEdit = (rule: AutomationRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type,
      trigger_config: JSON.stringify(rule.trigger_config, null, 2),
      action_config: JSON.stringify(rule.action_config, null, 2),
      is_enabled: rule.is_enabled,
    });
    setDialogOpen(true);
  };

  const applyPreset = (preset: typeof JOB_PRESETS[0]) => {
    setForm({
      name: preset.name,
      description: preset.description,
      rule_type: preset.rule_type,
      trigger_config: JSON.stringify(preset.trigger_config, null, 2),
      action_config: JSON.stringify(preset.action_config, null, 2),
      is_enabled: false,
    });
    setPresetDialog(false);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      updateRule.mutate({
        id: editing.id,
        data: {
          name: form.name,
          description: form.description || null,
          rule_type: form.rule_type,
          trigger_config: JSON.parse(form.trigger_config),
          action_config: JSON.parse(form.action_config),
          is_enabled: form.is_enabled,
        },
      });
    } else {
      createRule.mutate(form);
    }
  };

  const getRuleTypeIcon = (type: string) => {
    switch (type) {
      case 'lead_followup': return <Users className="h-4 w-4" />;
      case 'appointment_reminder': return <Calendar className="h-4 w-4" />;
      case 'review_request': return <MessageSquare className="h-4 w-4" />;
      case 'email_notification': return <Mail className="h-4 w-4" />;
      case 'gmb_import': return <Database className="h-4 w-4" />;
      case 'unclaimed_outreach': return <Mail className="h-4 w-4" />;
      case 'duplicate_detection': return <Search className="h-4 w-4" />;
      case 'seo_audit': return <FileSearch className="h-4 w-4" />;
      case 'review_report': return <TrendingUp className="h-4 w-4" />;
      case 'verification_reminder': return <Bell className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getScheduleDisplay = (config: Record<string, any>) => {
    if (config.schedule === 'hourly') return 'Every hour';
    if (config.schedule === 'daily') return `Daily at ${config.time || '00:00'}`;
    if (config.schedule === 'weekly') return `${config.day || 'Monday'} at ${config.time || '00:00'}`;
    if (config.hours_since_created) return `${config.hours_since_created}h after event`;
    return 'Manual';
  };

  const successCount = logs?.filter(l => l.status === 'success').length || 0;
  const failedCount = logs?.filter(l => l.status === 'failed').length || 0;
  const activeRules = rules?.filter(r => r.is_enabled).length || 0;

  if (rulesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">AI Automation Center</h1>
          <p className="text-muted-foreground mt-1">Automate workflows and AI-assisted tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runAllRules.mutate()} disabled={runAllRules.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${runAllRules.isPending ? 'animate-spin' : ''}`} />
            Run All Enabled
          </Button>
          <Dialog open={presetDialog} onOpenChange={setPresetDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Zap className="h-4 w-4 mr-2" />
                Quick Setup
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Job Presets</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                {JOB_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => applyPreset(preset)}
                    className="p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {getRuleTypeIcon(preset.rule_type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{preset.name}</p>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        <Timer className="h-3 w-3 mr-1" />
                        {preset.trigger_config.schedule || 'event'}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Automation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Automation' : 'Create Automation'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Automation name" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
                </div>
                <div className="space-y-2">
                  <Label>Rule Type</Label>
                  <Select value={form.rule_type} onValueChange={(v) => setForm({ ...form, rule_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead_followup">Lead Follow-up</SelectItem>
                      <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                      <SelectItem value="review_request">Review Request</SelectItem>
                      <SelectItem value="email_notification">Email Notification</SelectItem>
                      <SelectItem value="data_cleanup">Data Cleanup</SelectItem>
                      <SelectItem value="report_generation">Report Generation</SelectItem>
                      <SelectItem value="gmb_import">GMB Import</SelectItem>
                      <SelectItem value="unclaimed_outreach">Unclaimed Outreach</SelectItem>
                      <SelectItem value="duplicate_detection">Duplicate Detection</SelectItem>
                      <SelectItem value="seo_audit">SEO Audit</SelectItem>
                      <SelectItem value="review_report">Review Report</SelectItem>
                      <SelectItem value="verification_reminder">Verification Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trigger Configuration (JSON)</Label>
                  <Textarea 
                    value={form.trigger_config} 
                    onChange={(e) => setForm({ ...form, trigger_config: e.target.value })} 
                    placeholder='{"schedule": "daily", "time": "10:00"}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Schedule options: hourly, daily (with time), weekly (with day + time)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Action Configuration (JSON)</Label>
                  <Textarea 
                    value={form.action_config} 
                    onChange={(e) => setForm({ ...form, action_config: e.target.value })} 
                    placeholder='{"max_per_run": 50, "template": "welcome"}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enabled</Label>
                  <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} />
                </div>
                <Button onClick={handleSave} className="w-full" disabled={createRule.isPending || updateRule.isPending}>
                  {editing ? 'Update' : 'Create'} Automation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rules?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Rules</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <Play className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeRules}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{successCount}</p>
              <p className="text-sm text-muted-foreground">Successful Runs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <XCircle className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{failedCount}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="rules" className="rounded-xl">Automation Rules</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl">Execution Logs</TabsTrigger>
          <TabsTrigger value="schedules" className="rounded-xl">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRuleTypeIcon(rule.rule_type)}
                          <span className="text-sm capitalize">{rule.rule_type.replace(/_/g, ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {getScheduleDisplay(rule.trigger_config)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.is_enabled}
                          onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, enabled: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.run_count}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {rule.last_run_at ? format(new Date(rule.last_run_at), 'MMM d, HH:mm') : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => runRule.mutate(rule.id)} disabled={runRule.isPending}>
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRule.mutate(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!rules || rules.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No automation rules configured</p>
                        <Button variant="outline" className="mt-3" onClick={() => setPresetDialog(true)}>
                          <Zap className="h-4 w-4 mr-2" />
                          Start with a Preset
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => {
                    const rule = rules?.find(r => r.id === log.rule_id);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.executed_at || ''), 'MMM d, HH:mm:ss')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {rule?.name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {log.status === 'success' ? (
                            <Badge className="bg-teal/20 text-teal">Success</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {log.details ? JSON.stringify(log.details) : '-'}
                        </TableCell>
                        <TableCell className="text-coral text-sm">
                          {log.error_message || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!logs || logs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No execution logs yet</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <div className="grid gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Scheduled Jobs Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rules?.filter(r => r.is_enabled && r.trigger_config.schedule).map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {getRuleTypeIcon(rule.rule_type)}
                        </div>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-sm text-muted-foreground">{getScheduleDisplay(rule.trigger_config)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{rule.run_count} runs</p>
                        <p className="text-xs text-muted-foreground">
                          Last: {rule.last_run_at ? format(new Date(rule.last_run_at), 'MMM d, HH:mm') : 'Never'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!rules || rules.filter(r => r.is_enabled && r.trigger_config.schedule).length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No scheduled jobs active</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Global Thresholds
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/50">
                    <Label className="text-sm text-muted-foreground">Max Emails/Day</Label>
                    <p className="text-2xl font-bold">100</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <Label className="text-sm text-muted-foreground">Max Actions/Hour</Label>
                    <p className="text-2xl font-bold">50</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <Label className="text-sm text-muted-foreground">Retry on Failure</Label>
                    <p className="text-2xl font-bold">3x</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <Label className="text-sm text-muted-foreground">Cool-down Period</Label>
                    <p className="text-2xl font-bold">5 min</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
