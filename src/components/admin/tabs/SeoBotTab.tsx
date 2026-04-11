import { useState } from 'react';
import { 
  useSeoBotSettings, 
  useUpdateSeoBotSetting, 
  useSeoAuditRuns,
  useSeoMetadataHistory,
  useGenerateMetadata,
  useCheckDuplicates,
  useRollbackBatch
} from '@/hooks/useSeoBotAdmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  Settings, 
  Zap, 
  History, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Copy,
  RotateCcw,
  Play,
  Pause,
  FileText,
  Search,
  Shield,
  DollarSign,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

export default function SeoBotTab() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useSeoBotSettings();
  const { data: runs, isLoading: runsLoading } = useSeoAuditRuns();
  const { data: history, isLoading: historyLoading } = useSeoMetadataHistory(selectedBatchId || undefined);
  
  const updateSetting = useUpdateSeoBotSetting();
  const generateMetadata = useGenerateMetadata();
  const checkDuplicates = useCheckDuplicates();
  const rollbackBatch = useRollbackBatch();

  const isRunning = generateMetadata.isPending || checkDuplicates.isPending;

  const handleRunAudit = async (type: 'generate_metadata' | 'check_duplicates') => {
    if (type === 'generate_metadata') {
      generateMetadata.mutate();
    } else {
      checkDuplicates.mutate();
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">SEO Bot</h1>
            <p className="text-muted-foreground">Automated metadata generation & duplicate enforcement</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleRunAudit('check_duplicates')}
            disabled={isRunning}
          >
            {checkDuplicates.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Check Duplicates
          </Button>
          <Button 
            onClick={() => handleRunAudit('generate_metadata')}
            disabled={isRunning}
          >
            {generateMetadata.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Generate Metadata
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{runs?.[0]?.fixed_pages || 0}</p>
              <p className="text-sm text-muted-foreground">Last Run Fixed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
              <Copy className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{runs?.[0]?.summary?.duplicate_titles || 0}</p>
              <p className="text-sm text-muted-foreground">Duplicates Found</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{runs?.[0]?.total_pages || 0}</p>
              <p className="text-sm text-muted-foreground">Total Pages</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral/10 flex items-center justify-center">
              <History className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{runs?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Runs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="dashboard" className="rounded-xl">Dashboard</TabsTrigger>
          <TabsTrigger value="runs" className="rounded-xl">Run History</TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl">Change Log</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl">Settings</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Run SEO bot operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3"
                  onClick={() => handleRunAudit('generate_metadata')}
                  disabled={isRunning}
                >
                  <FileText className="h-4 w-4" />
                  Generate Unique Metadata for All Pages
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3"
                  onClick={() => handleRunAudit('check_duplicates')}
                  disabled={isRunning}
                >
                  <Copy className="h-4 w-4" />
                  Scan for Duplicate Titles/Descriptions
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" disabled>
                  <Shield className="h-4 w-4" />
                  Validate Canonical URLs
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" disabled>
                  <RefreshCw className="h-4 w-4" />
                  Refresh Sitemap Index
                </Button>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-gold" />
                  Active Issues
                </CardTitle>
                <CardDescription>SEO problems requiring attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runs?.[0]?.summary?.duplicates?.slice(0, 3).map((dup: string, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-gold/10 border border-gold/20">
                    <p className="text-sm font-medium text-gold">Duplicate Title</p>
                    <p className="text-xs text-muted-foreground truncate">{dup}</p>
                  </div>
                )) || (
                  <div className="p-4 rounded-xl bg-teal/10 border border-teal/20 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-teal" />
                    <span className="text-teal font-medium">No active issues</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Run History Tab */}
        <TabsContent value="runs" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Run History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {runsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Pages</TableHead>
                      <TableHead>Fixed</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs?.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{run.run_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              run.status === 'completed' ? 'bg-teal/20 text-teal' :
                              run.status === 'running' ? 'bg-primary/20 text-primary' :
                              run.status === 'failed' ? 'bg-coral/20 text-coral' :
                              'bg-muted text-muted-foreground'
                            }
                          >
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {run.started_at ? format(new Date(run.started_at), 'MMM d, HH:mm') : '-'}
                        </TableCell>
                        <TableCell>{run.total_pages}</TableCell>
                        <TableCell className="text-teal font-medium">{run.fixed_pages}</TableCell>
                        <TableCell className={run.error_count > 0 ? 'text-coral' : ''}>
                          {run.error_count}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedBatchId(run.id);
                              setActiveTab('history');
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!runs?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No audit runs yet. Run your first audit above.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Change Log Tab */}
        <TabsContent value="history" className="mt-4">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Metadata Change History
                </CardTitle>
                <CardDescription>Track all metadata changes with rollback capability</CardDescription>
              </div>
              {selectedBatchId && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedBatchId(null)}
                >
                  Clear Filter
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Page</TableHead>
                        <TableHead>New Title</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Changed</TableHead>
                        <TableHead className="text-right">Rollback</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history?.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-mono text-sm truncate max-w-32">
                            {h.slug}
                          </TableCell>
                          <TableCell className="truncate max-w-48">
                            {h.new_title}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {h.change_reason}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(h.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => rollbackBatch.mutate({ pageSlug: h.slug })}
                              disabled={rollbackBatch.isPending}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!history?.length && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No change history yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Rate Limits
                </CardTitle>
                <CardDescription>Control API usage and batch sizes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Requests per Minute</Label>
                  <Input 
                    type="number" 
                    value={settings?.rate_limits?.requests_per_minute || 30}
                    onChange={(e) => updateSetting.mutate({
                      key: 'rate_limits',
                      value: { ...settings?.rate_limits, requests_per_minute: parseInt(e.target.value) }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pages per Batch</Label>
                  <Input 
                    type="number" 
                    value={settings?.rate_limits?.pages_per_batch || 100}
                    onChange={(e) => updateSetting.mutate({
                      key: 'rate_limits',
                      value: { ...settings?.rate_limits, pages_per_batch: parseInt(e.target.value) }
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Guardrails
                </CardTitle>
                <CardDescription>Prevent runaway costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Daily Budget (USD)</Label>
                  <Input 
                    type="number" 
                    value={settings?.cost_guardrails?.daily_budget_usd || 10}
                    onChange={(e) => updateSetting.mutate({
                      key: 'cost_guardrails',
                      value: { ...settings?.cost_guardrails, daily_budget_usd: parseInt(e.target.value) }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Pages per Run</Label>
                  <Input 
                    type="number" 
                    value={settings?.cost_guardrails?.max_pages_per_run || 500}
                    onChange={(e) => updateSetting.mutate({
                      key: 'cost_guardrails',
                      value: { ...settings?.cost_guardrails, max_pages_per_run: parseInt(e.target.value) }
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Metadata Constraints
                </CardTitle>
                <CardDescription>Title and description length limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Title Min</Label>
                    <Input 
                      type="number" 
                      value={settings?.generation_config?.title_min_length || 40}
                      onChange={(e) => updateSetting.mutate({
                        key: 'generation_config',
                        value: { ...settings?.generation_config, title_min_length: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title Max</Label>
                    <Input 
                      type="number" 
                      value={settings?.generation_config?.title_max_length || 60}
                      onChange={(e) => updateSetting.mutate({
                        key: 'generation_config',
                        value: { ...settings?.generation_config, title_max_length: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Description Min</Label>
                    <Input 
                      type="number" 
                      value={settings?.generation_config?.description_min_length || 120}
                      onChange={(e) => updateSetting.mutate({
                        key: 'generation_config',
                        value: { ...settings?.generation_config, description_min_length: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description Max</Label>
                    <Input 
                      type="number" 
                      value={settings?.generation_config?.description_max_length || 160}
                      onChange={(e) => updateSetting.mutate({
                        key: 'generation_config',
                        value: { ...settings?.generation_config, description_max_length: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Copy className="h-5 w-5" />
                  Duplicate Detection
                </CardTitle>
                <CardDescription>Similarity thresholds for detecting duplicates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title Similarity Threshold</Label>
                  <Input 
                    type="number" 
                    step="0.05"
                    min="0"
                    max="1"
                    value={settings?.similarity_threshold?.title || 0.85}
                    onChange={(e) => updateSetting.mutate({
                      key: 'similarity_threshold',
                      value: { ...settings?.similarity_threshold, title: parseFloat(e.target.value) }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">0.85 = 85% similar words triggers duplicate warning</p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <Label>Auto-fix Enabled</Label>
                    <p className="text-xs text-muted-foreground">Apply fixes without approval</p>
                  </div>
                  <Switch 
                    checked={settings?.auto_fix_enabled === true}
                    onCheckedChange={(v) => updateSetting.mutate({
                      key: 'auto_fix_enabled',
                      value: v
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
