import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Zap, Play, Eye, Heading1, FileText, AlignLeft, Link2, HelpCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export interface RegenerationConfig {
  regenerateH1: boolean;
  regenerateH2: boolean;
  regenerateMetaTitle: boolean;
  regenerateMetaDescription: boolean;
  regenerateIntro: boolean;
  regenerateSections: boolean;
  regenerateFaq: boolean;
  addInternalLinks: boolean;
  rewriteForUniqueness: boolean;
  expandContent: boolean;
  targetWordCount: number;
}

export interface BulkActionsPanelProps {
  selectedPageIds: string[];
  onJobStarted?: (jobId: string) => void;
}

const DEFAULT_CONFIG: RegenerationConfig = {
  regenerateH1: true,
  regenerateH2: false,
  regenerateMetaTitle: true,
  regenerateMetaDescription: true,
  regenerateIntro: false,
  regenerateSections: false,
  regenerateFaq: false,
  addInternalLinks: false,
  rewriteForUniqueness: false,
  expandContent: false,
  targetWordCount: 500,
};

export function BulkActionsPanel({ selectedPageIds, onJobStarted }: BulkActionsPanelProps) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<RegenerationConfig>(DEFAULT_CONFIG);
  const [applyMode, setApplyMode] = useState<'draft' | 'auto_apply' | 'quality_gated'>('draft');
  const [qualityThreshold, setQualityThreshold] = useState(70);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [jobProgress, setJobProgress] = useState<{
    isRunning: boolean;
    jobId: string | null;
    total: number;
    processed: number;
    successful: number;
    failed: number;
    currentSlug: string;
    logs: { timestamp: Date; message: string; type: 'info' | 'success' | 'error' }[];
  } | null>(null);

  const toggleConfig = (key: keyof RegenerationConfig) => {
    if (typeof config[key] === 'boolean') {
      setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // Create and run bulk job
  const startBulkJob = useMutation({
    mutationFn: async () => {
      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('seo_fix_jobs')
        .insert([{
          job_type: 'bulk_regenerate',
          status: 'pending',
          filters: JSON.parse(JSON.stringify({ selected_page_ids: selectedPageIds })),
          regeneration_config: JSON.parse(JSON.stringify(config)),
          target_word_count: config.targetWordCount,
          apply_mode: applyMode,
          quality_threshold: qualityThreshold,
          total_pages: selectedPageIds.length,
          notes: customPrompt || null,
        }])
        .select('id')
        .single();

      if (jobError) throw jobError;

      setJobProgress({
        isRunning: true,
        jobId: job.id,
        total: selectedPageIds.length,
        processed: 0,
        successful: 0,
        failed: 0,
        currentSlug: '',
        logs: [{ timestamp: new Date(), message: `Starting job with ${selectedPageIds.length} pages...`, type: 'info' }],
      });

      if (onJobStarted) onJobStarted(job.id);

      // Process pages via edge function
      const { data, error } = await supabase.functions.invoke('seo-bulk-processor', {
        body: {
          action: 'process_job',
          job_id: job.id,
          page_ids: selectedPageIds,
          config,
          apply_mode: applyMode,
          quality_threshold: qualityThreshold,
          custom_prompt: customPrompt || undefined,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setJobProgress(prev => prev ? {
        ...prev,
        isRunning: false,
        processed: data.processed || prev.total,
        successful: data.successful || 0,
        failed: data.failed || 0,
        logs: [...prev.logs, { timestamp: new Date(), message: `Job completed: ${data.successful} successful, ${data.failed} failed`, type: 'success' }],
      } : null);
      
      queryClient.invalidateQueries({ queryKey: ['seo-pages-picker'] });
      queryClient.invalidateQueries({ queryKey: ['seo-fix-jobs'] });
      toast.success(`Bulk job completed! ${data.successful} pages processed.`);
    },
    onError: (error: Error) => {
      setJobProgress(prev => prev ? {
        ...prev,
        isRunning: false,
        logs: [...prev.logs, { timestamp: new Date(), message: `Error: ${error.message}`, type: 'error' }],
      } : null);
      toast.error(`Job failed: ${error.message}`);
    },
  });

  // Preview single page
  const previewPage = useMutation({
    mutationFn: async (pageId: string) => {
      const { data, error } = await supabase.functions.invoke('seo-content-optimizer', {
        body: {
          action: 'preview_optimization',
          page_id: pageId,
          config,
          custom_prompt: customPrompt || undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreview(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getActiveCount = () => {
    let count = 0;
    if (config.regenerateH1) count++;
    if (config.regenerateH2) count++;
    if (config.regenerateMetaTitle) count++;
    if (config.regenerateMetaDescription) count++;
    if (config.regenerateIntro) count++;
    if (config.regenerateSections) count++;
    if (config.regenerateFaq) count++;
    if (config.addInternalLinks) count++;
    if (config.rewriteForUniqueness) count++;
    if (config.expandContent) count++;
    return count;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Bulk Actions
        </CardTitle>
        <CardDescription>
          Configure what to regenerate for {selectedPageIds.length} selected pages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Regeneration Toggles */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm flex items-center gap-2">
            Regeneration Options
            <Badge variant="outline">{getActiveCount()} active</Badge>
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="h1" checked={config.regenerateH1} onCheckedChange={() => toggleConfig('regenerateH1')} />
              <Label htmlFor="h1" className="flex items-center gap-1 cursor-pointer">
                <Heading1 className="h-4 w-4" /> H1 Heading
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="h2" checked={config.regenerateH2} onCheckedChange={() => toggleConfig('regenerateH2')} />
              <Label htmlFor="h2" className="cursor-pointer">H2/H3 Outline</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="metaTitle" checked={config.regenerateMetaTitle} onCheckedChange={() => toggleConfig('regenerateMetaTitle')} />
              <Label htmlFor="metaTitle" className="flex items-center gap-1 cursor-pointer">
                <FileText className="h-4 w-4" /> Meta Title
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="metaDesc" checked={config.regenerateMetaDescription} onCheckedChange={() => toggleConfig('regenerateMetaDescription')} />
              <Label htmlFor="metaDesc" className="cursor-pointer">Meta Description</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="intro" checked={config.regenerateIntro} onCheckedChange={() => toggleConfig('regenerateIntro')} />
              <Label htmlFor="intro" className="flex items-center gap-1 cursor-pointer">
                <AlignLeft className="h-4 w-4" /> Intro Section
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sections" checked={config.regenerateSections} onCheckedChange={() => toggleConfig('regenerateSections')} />
              <Label htmlFor="sections" className="cursor-pointer">Core Sections (2-5)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="faq" checked={config.regenerateFaq} onCheckedChange={() => toggleConfig('regenerateFaq')} />
              <Label htmlFor="faq" className="flex items-center gap-1 cursor-pointer">
                <HelpCircle className="h-4 w-4" /> FAQ (3-6)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="links" checked={config.addInternalLinks} onCheckedChange={() => toggleConfig('addInternalLinks')} />
              <Label htmlFor="links" className="flex items-center gap-1 cursor-pointer">
                <Link2 className="h-4 w-4" /> Internal Links
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="unique" checked={config.rewriteForUniqueness} onCheckedChange={() => toggleConfig('rewriteForUniqueness')} />
              <Label htmlFor="unique" className="flex items-center gap-1 cursor-pointer">
                <Sparkles className="h-4 w-4" /> High Uniqueness
              </Label>
            </div>
          </div>

          {/* Expand Content Option */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Checkbox id="expand" checked={config.expandContent} onCheckedChange={() => toggleConfig('expandContent')} />
              <Label htmlFor="expand" className="cursor-pointer">Expand Thin Content to:</Label>
            </div>
            <Select 
              value={String(config.targetWordCount)} 
              onValueChange={(v) => setConfig(prev => ({ ...prev, targetWordCount: parseInt(v) }))}
              disabled={!config.expandContent}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">500 words</SelectItem>
                <SelectItem value="700">700 words</SelectItem>
                <SelectItem value="1000">1000 words</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Apply Mode */}
        <div className="space-y-2">
          <Label>Apply Mode</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={applyMode === 'draft' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setApplyMode('draft')}
            >
              Draft Only
            </Button>
            <Button
              variant={applyMode === 'quality_gated' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setApplyMode('quality_gated')}
            >
              Quality Gated
            </Button>
            <Button
              variant={applyMode === 'auto_apply' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setApplyMode('auto_apply')}
            >
              Auto Apply
            </Button>
          </div>
          {applyMode === 'quality_gated' && (
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-sm">Apply only if score ≥</Label>
              <Input
                type="number"
                value={qualityThreshold}
                onChange={(e) => setQualityThreshold(parseInt(e.target.value) || 70)}
                className="w-20"
                min={0}
                max={100}
              />
            </div>
          )}
        </div>

        {/* Custom Prompt */}
        <div className="space-y-2">
          <Label>Custom Instructions (Optional)</Label>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Add specific instructions for the AI, e.g., 'Focus on emergency dental services' or 'Mention insurance options'"
            className="min-h-[80px]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t">
          {selectedPageIds.length === 1 && (
            <Button variant="outline" onClick={() => previewPage.mutate(selectedPageIds[0])} disabled={previewPage.isPending}>
              <Eye className="h-4 w-4 mr-2" />
              Preview Changes
            </Button>
          )}
          <Button 
            onClick={() => startBulkJob.mutate()} 
            disabled={selectedPageIds.length === 0 || startBulkJob.isPending || jobProgress?.isRunning}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            {applyMode === 'draft' ? 'Generate Drafts' : applyMode === 'auto_apply' ? 'Apply Live' : 'Run with Quality Gate'}
            ({selectedPageIds.length} pages)
          </Button>
        </div>

        {/* Progress Display */}
        {jobProgress && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="font-medium">Job Progress</span>
              <Badge variant={jobProgress.isRunning ? 'default' : 'outline'}>
                {jobProgress.isRunning ? 'Running' : 'Completed'}
              </Badge>
            </div>
            <Progress value={(jobProgress.processed / jobProgress.total) * 100} />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{jobProgress.processed} / {jobProgress.total} processed</span>
              <span className="flex items-center gap-2">
                <span className="text-teal">✓ {jobProgress.successful}</span>
                <span className="text-coral">✗ {jobProgress.failed}</span>
              </span>
            </div>
            {jobProgress.currentSlug && (
              <p className="text-xs text-muted-foreground">Processing: {jobProgress.currentSlug}</p>
            )}
            <ScrollArea className="h-24 border rounded p-2">
              {jobProgress.logs.map((log, i) => (
                <p key={i} className={`text-xs ${log.type === 'error' ? 'text-destructive' : log.type === 'success' ? 'text-teal' : 'text-muted-foreground'}`}>
                  [{log.timestamp.toLocaleTimeString()}] {log.message}
                </p>
              ))}
            </ScrollArea>
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview Changes</DialogTitle>
              <DialogDescription>Review generated content before applying</DialogDescription>
            </DialogHeader>
            {previewData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-muted-foreground">Before</h4>
                    <div className="p-3 rounded border bg-muted/50 space-y-2">
                      <p><strong>Title:</strong> {previewData.before?.meta_title || '—'}</p>
                      <p><strong>Description:</strong> {previewData.before?.meta_description || '—'}</p>
                      <p><strong>H1:</strong> {previewData.before?.h1 || '—'}</p>
                      <p><strong>Words:</strong> {previewData.before?.word_count || 0}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-teal">After</h4>
                    <div className="p-3 rounded border border-teal/30 bg-teal/5 space-y-2">
                      <p><strong>Title:</strong> {previewData.after?.meta_title}</p>
                      <p><strong>Description:</strong> {previewData.after?.meta_description}</p>
                      <p><strong>H1:</strong> {previewData.after?.h1}</p>
                      <p><strong>Words:</strong> {previewData.after?.word_count || 0}</p>
                    </div>
                  </div>
                </div>
                {previewData.after?.h2_sections && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Generated Sections</h4>
                    <div className="p-3 rounded border space-y-2 text-sm">
                      {previewData.after.h2_sections.map((section: any, i: number) => (
                        <div key={i}>
                          <p className="font-medium">{section.heading}</p>
                          <p className="text-muted-foreground text-xs">{section.content?.slice(0, 100)}...</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
