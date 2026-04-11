import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Brain,
  Bot,
  Sparkles,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Activity,
  Zap,
  Eye,
  RefreshCw,
  MessageSquare,
  Target,
  TrendingUp,
  Clock,
  Database,
  Cpu,
  ToggleLeft,
} from 'lucide-react';

interface AIModuleConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'reputation' | 'seo' | 'automation' | 'support';
}

interface AIDecisionLog {
  id: string;
  module: string;
  action: string;
  reason: string;
  data_used: Record<string, unknown>;
  confidence: number;
  created_at: string;
  status: 'applied' | 'pending' | 'rejected';
}

export default function AIControlsTab() {
  const queryClient = useQueryClient();
  const [thresholds, setThresholds] = useState({
    reputationAlert: 30,
    seoConfidence: 70,
    automationDelay: 5,
  });

  // Fetch AI settings from global_settings
  const { data: aiSettings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'ai_config')
        .maybeSingle();
      return data?.value as Record<string, unknown> || {};
    },
  });

  // Fetch audit logs that are AI-related
  const { data: aiLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['ai-decision-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .or('action.ilike.%ai%,action.ilike.%automated%,action.ilike.%suggestion%')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // AI Modules configuration
  const aiModules: AIModuleConfig[] = [
    {
      id: 'reputation_insights',
      name: 'Reputation Insights',
      description: 'AI analyzes review patterns and suggests actions',
      enabled: true,
      category: 'reputation',
    },
    {
      id: 'review_timing',
      name: 'Smart Review Timing',
      description: 'AI recommends optimal times to request reviews',
      enabled: true,
      category: 'reputation',
    },
    {
      id: 'feedback_analysis',
      name: 'Feedback Analysis',
      description: 'AI summarizes common themes in negative feedback',
      enabled: true,
      category: 'reputation',
    },
    {
      id: 'seo_copilot',
      name: 'SEO Copilot',
      description: 'AI suggests SEO improvements and content gaps',
      enabled: true,
      category: 'seo',
    },
    {
      id: 'ranking_optimizer',
      name: 'Ranking Optimizer',
      description: 'AI adjusts ranking weights based on performance',
      enabled: false,
      category: 'seo',
    },
    {
      id: 'lead_scorer',
      name: 'Lead Scoring',
      description: 'AI scores and prioritizes incoming leads',
      enabled: true,
      category: 'automation',
    },
    {
      id: 'duplicate_detector',
      name: 'Duplicate Detection',
      description: 'AI identifies potential duplicate listings',
      enabled: true,
      category: 'automation',
    },
    {
      id: 'support_categorizer',
      name: 'Support Ticket AI',
      description: 'AI categorizes and suggests responses for tickets',
      enabled: true,
      category: 'support',
    },
  ];

  const [moduleStates, setModuleStates] = useState<Record<string, boolean>>(
    Object.fromEntries(aiModules.map(m => [m.id, m.enabled]))
  );

  // Save AI settings
  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: 'ai_config',
          value: {
            modules: moduleStates,
            thresholds,
            updated_at: new Date().toISOString(),
          },
          description: 'AI module configuration and thresholds',
        }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success('AI settings saved');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  const toggleModule = (moduleId: string) => {
    setModuleStates(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const categoryIcons = {
    reputation: MessageSquare,
    seo: Target,
    automation: Zap,
    support: Shield,
  };

  const categoryColors = {
    reputation: 'bg-teal-100 text-teal-700',
    seo: 'bg-blue-100 text-blue-700',
    automation: 'bg-purple-100 text-purple-700',
    support: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Oversight & Controls
          </h2>
          <p className="text-muted-foreground">
            Configure AI modules, view decisions, and set thresholds
          </p>
        </div>
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
          <Settings className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Object.values(moduleStates).filter(Boolean).length}</p>
                <p className="text-xs text-muted-foreground">Active Modules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aiLogs.length}</p>
                <p className="text-xs text-muted-foreground">Decisions Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Pending Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Cpu className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Online</p>
                <p className="text-xs text-muted-foreground">System Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="modules">
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="modules" className="rounded-xl">
            <Bot className="h-4 w-4 mr-2" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="rounded-xl">
            <ToggleLeft className="h-4 w-4 mr-2" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl">
            <Database className="h-4 w-4 mr-2" />
            Decision Logs
          </TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules" className="mt-4">
          <div className="grid gap-4">
            {(['reputation', 'seo', 'automation', 'support'] as const).map(category => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 capitalize">
                    {(() => {
                      const Icon = categoryIcons[category];
                      return <Icon className="h-5 w-5" />;
                    })()}
                    {category} AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {aiModules.filter(m => m.category === category).map(module => (
                      <div
                        key={module.id}
                        className="flex items-center justify-between p-4 rounded-xl border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${categoryColors[category]}`}>
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{module.name}</p>
                            <p className="text-sm text-muted-foreground">{module.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={moduleStates[module.id] ? 'default' : 'secondary'}>
                            {moduleStates[module.id] ? 'Active' : 'Disabled'}
                          </Badge>
                          <Switch
                            checked={moduleStates[module.id]}
                            onCheckedChange={() => toggleModule(module.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Reputation Alert Threshold
                </CardTitle>
                <CardDescription>
                  Trigger alerts when reputation score drops below this value
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Threshold: {thresholds.reputationAlert}%</Label>
                  <Badge variant={thresholds.reputationAlert < 40 ? 'destructive' : 'secondary'}>
                    {thresholds.reputationAlert < 40 ? 'Aggressive' : 'Normal'}
                  </Badge>
                </div>
                <Slider
                  value={[thresholds.reputationAlert]}
                  onValueChange={([val]) => setThresholds(p => ({ ...p, reputationAlert: val }))}
                  max={100}
                  min={10}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Clinics with reputation score below {thresholds.reputationAlert}% will be flagged.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  SEO Confidence Threshold
                </CardTitle>
                <CardDescription>
                  Minimum AI confidence to auto-apply SEO suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Confidence: {thresholds.seoConfidence}%</Label>
                  <Badge variant={thresholds.seoConfidence > 80 ? 'default' : 'secondary'}>
                    {thresholds.seoConfidence > 80 ? 'Conservative' : 'Moderate'}
                  </Badge>
                </div>
                <Slider
                  value={[thresholds.seoConfidence]}
                  onValueChange={([val]) => setThresholds(p => ({ ...p, seoConfidence: val }))}
                  max={100}
                  min={50}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Only suggestions with ≥{thresholds.seoConfidence}% confidence will be shown.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-500" />
                  Automation Delay
                </CardTitle>
                <CardDescription>
                  Minutes to wait before executing automated actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Delay: {thresholds.automationDelay} minutes</Label>
                </div>
                <Slider
                  value={[thresholds.automationDelay]}
                  onValueChange={([val]) => setThresholds(p => ({ ...p, automationDelay: val }))}
                  max={30}
                  min={0}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Allows time to review and cancel before action is taken.
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Safety Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-medium">Require approval for bulk actions</p>
                    <p className="text-xs text-muted-foreground">AI cannot execute bulk changes without admin</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-medium">Log all AI decisions</p>
                    <p className="text-xs text-muted-foreground">Keep full audit trail of AI actions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-medium">Emergency stop</p>
                    <p className="text-xs text-muted-foreground">Pause all AI operations immediately</p>
                  </div>
                  <Button variant="destructive" size="sm">
                    <XCircle className="h-4 w-4 mr-2" />
                    Stop All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Decision Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                AI Decision Logs
              </CardTitle>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : aiLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No AI decision logs yet</p>
                  <p className="text-sm">AI actions will appear here when modules are active</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.entity_type}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell className="text-sm">{log.entity_id?.slice(0, 8) || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Logged</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
