import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ACTIVE_STATE_SLUGS } from '@/lib/constants/activeStates';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
  Eye,
  Check,
  X,
  ExternalLink,
  Building2,
  AlertCircle,
  Database,
  Zap,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface EnrichmentSession {
  id: string;
  state_id: string | null;
  city_id: string | null;
  status: string;
  total_to_process: number;
  processed_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
}

interface EnrichmentResult {
  id: string;
  session_id: string;
  clinic_id: string;
  website_url: string | null;
  emails_found: string[];
  email_selected: string | null;
  match_confidence: number;
  match_method: string | null;
  status: string;
  error_message: string | null;
  needs_review: boolean;
  applied_at: string | null;
  clinic?: {
    id: string;
    name: string;
    website: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city?: { name: string } | null;
  };
}

interface ClinicStats {
  total: number;
  withEmail: number;
  withoutEmail: number;
  withWebsite: number;
  withWebsiteNoEmail: number;
}

// Local storage key for persisting state
const STORAGE_KEY = 'email-enrichment-state';

interface SavedState {
  sessionId: string | null;
  isRunning: boolean;
  isPaused: boolean;
}

export default function EmailEnrichmentBotTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedStateId, setSelectedStateId] = useState<string>('all');
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<{ time: Date; type: string; message: string }[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<EnrichmentResult | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  
  // Ref for polling interval
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Load saved state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: SavedState = JSON.parse(saved);
        if (state.sessionId) {
          setActiveSessionId(state.sessionId);
          // Don't auto-resume, let user click Resume
        }
      }
    } catch (e) {
      console.error('Error loading saved state:', e);
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    const state: SavedState = {
      sessionId: activeSessionId,
      isRunning,
      isPaused,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [activeSessionId, isRunning, isPaused]);

  // Fetch states (active states only)
  const { data: states } = useQuery({
    queryKey: ['states-active'],
    queryFn: async () => {
      const { data } = await supabase.from('states').select('*').eq('is_active', true).in('slug', ACTIVE_STATE_SLUGS).order('name');
      return data || [];
    },
  });

  // Fetch cities for state
  const { data: cities } = useQuery({
    queryKey: ['cities-for-enrichment', selectedStateId],
    queryFn: async () => {
      if (selectedStateId === 'all') return [];
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('state_id', selectedStateId)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: selectedStateId !== 'all',
  });

  // Fetch clinic stats using count queries to avoid 1000 row limit
  const { data: clinicStats, refetch: refetchStats } = useQuery({
    queryKey: ['clinic-email-stats', selectedStateId, selectedCityId],
    queryFn: async (): Promise<ClinicStats> => {
      // Build base filter conditions
      const buildQuery = (baseQuery: any) => {
        let q = baseQuery.eq('is_active', true).eq('is_duplicate', false);
        if (selectedStateId !== 'all') {
          const cityIds = cities?.map(c => c.id) || [];
          if (selectedCityId !== 'all') {
            q = q.eq('city_id', selectedCityId);
          } else if (cityIds.length > 0) {
            q = q.in('city_id', cityIds);
          }
        }
        return q;
      };

      // Run all count queries in parallel for efficiency
      const [totalResult, withEmailResult, withoutEmailResult, withWebsiteResult, withWebsiteNoEmailResult] = await Promise.all([
        // Total clinics
        buildQuery(supabase.from('clinics').select('id', { count: 'exact', head: true })),
        // With email
        buildQuery(supabase.from('clinics').select('id', { count: 'exact', head: true })).not('email', 'is', null),
        // Without email  
        buildQuery(supabase.from('clinics').select('id', { count: 'exact', head: true })).is('email', null),
        // With website
        buildQuery(supabase.from('clinics').select('id', { count: 'exact', head: true })).not('website', 'is', null),
        // With website but no email
        buildQuery(supabase.from('clinics').select('id', { count: 'exact', head: true })).not('website', 'is', null).is('email', null),
      ]);

      return {
        total: totalResult.count || 0,
        withEmail: withEmailResult.count || 0,
        withoutEmail: withoutEmailResult.count || 0,
        withWebsite: withWebsiteResult.count || 0,
        withWebsiteNoEmail: withWebsiteNoEmailResult.count || 0,
      };
    },
  });

  // Fetch sessions - poll for updates on running sessions
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['enrichment-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_enrichment_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as EnrichmentSession[];
    },
    refetchInterval: isRunning ? 2000 : 10000,
  });

  // Fetch results for active session
  const { data: sessionResults, refetch: refetchResults } = useQuery({
    queryKey: ['enrichment-results', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      const { data } = await supabase
        .from('email_enrichment_results')
        .select(`
          *,
          clinic:clinics(id, name, website, email, phone, address, city:cities(name))
        `)
        .eq('session_id', activeSessionId)
        .order('match_confidence', { ascending: false });
      return (data || []) as EnrichmentResult[];
    },
    enabled: !!activeSessionId,
    refetchInterval: isRunning ? 2000 : false,
  });

  // Fetch items needing review
  const { data: reviewQueue } = useQuery({
    queryKey: ['enrichment-review-queue'],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_enrichment_results')
        .select(`
          *,
          clinic:clinics(id, name, website, email, phone, address, city:cities(name))
        `)
        .eq('needs_review', true)
        .is('applied_at', null)
        .order('match_confidence', { ascending: false })
        .limit(50);
      return (data || []) as EnrichmentResult[];
    },
  });

  const addLog = useCallback((type: string, message: string) => {
    setLogs(prev => [...prev.slice(-100), { time: new Date(), type, message }]);
  }, []);

  // Process a single batch - called repeatedly by the polling loop
  const processBatch = useCallback(async (sessionId: string): Promise<{ hasMore: boolean; processed: number }> => {
    try {
      const { data, error } = await supabase.functions.invoke('email-enrichment', {
        body: { action: 'process-batch', sessionId, batchSize: 5 },
      });

      if (error) {
        addLog('error', `Batch error: ${error.message}`);
        return { hasMore: true, processed: 0 };
      }

      if (!data.success) {
        if (data.message === 'No pending items') {
          return { hasMore: false, processed: 0 };
        }
        addLog('error', `Batch failed: ${data.error}`);
        return { hasMore: true, processed: 0 };
      }

      const {
        processed,
        successCount,
        failedCount,
        noEmailCount,
        pauseRecommended,
        pauseReason,
        retryAfterSeconds,
        results,
      } = data;

      setCurrentBatch((prev) => prev + 1);

      if (successCount > 0) {
        addLog('success', `✓ Found ${successCount} email(s)`);
      }

      if (failedCount > 0) {
        const firstError = Array.isArray(results)
          ? results.find((r: any) => r?.status === 'failed' || r?.status === 'rate_limited' || r?.status === 'credits_exhausted')?.error
          : null;
        const suffix = firstError ? ` (e.g. ${String(firstError).slice(0, 120)})` : '';
        addLog('warning', `⚠ ${failedCount} failed to scrape${suffix}`);
      }

      // Check for credits exhausted (402 error)
      const hasCreditsIssue = Array.isArray(results) && results.some((r: any) => r?.creditsExhausted);
      
      if (hasCreditsIssue) {
        addLog('error', `🚫 Firecrawl credits exhausted! Please upgrade at firecrawl.dev/pricing`);
        toast.error('Firecrawl credits exhausted', {
          description: 'Please upgrade your plan at firecrawl.dev/pricing to continue scraping.',
          duration: 10000,
        });
        
        // Stop the loop
        isProcessingRef.current = false;
        setIsRunning(false);
        setIsPaused(true);
        refetchSessions();

        return { hasMore: false, processed };
      }

      if (pauseRecommended) {
        const retryMsg = retryAfterSeconds ? ` Retry in ~${retryAfterSeconds}s.` : '';
        addLog('warning', `⏸️ Rate limited by Firecrawl.${retryMsg} ${pauseReason ? String(pauseReason).slice(0, 160) : ''}`);

        // Stop the loop and leave the session resumable.
        isProcessingRef.current = false;
        setIsRunning(false);
        setIsPaused(true);
        refetchSessions();

        return { hasMore: true, processed };
      }

      return { hasMore: processed > 0, processed };
    } catch (err) {
      addLog('error', `Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      return { hasMore: true, processed: 0 };
    }
  }, [addLog]);

  // Main processing loop
  const runProcessingLoop = useCallback(async (sessionId: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (isProcessingRef.current) {
      // Check if paused or stopped
      if (!isProcessingRef.current) break;

      const result = await processBatch(sessionId);
      
      if (!result.hasMore) {
        addLog('success', '🎉 Enrichment complete!');
        setIsRunning(false);
        isProcessingRef.current = false;
        refetchStats();
        refetchSessions();
        break;
      }

      // Refetch results to update UI
      refetchResults();
      refetchSessions();

      // Wait before next batch
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, [processBatch, addLog, refetchStats, refetchSessions, refetchResults]);

  // Start enrichment - create session and begin processing
  const startEnrichment = async () => {
    if (!user) return;

    try {
      setIsRunning(true);
      setIsPaused(false);
      setLogs([]);
      setCurrentBatch(0);
      addLog('info', '🚀 Starting email enrichment session...');

      // Call the edge function to create session
      const { data, error } = await supabase.functions.invoke('email-enrichment', {
        body: { 
          action: 'start-session', 
          stateId: selectedStateId !== 'all' ? selectedStateId : null,
          cityId: selectedCityId !== 'all' ? selectedCityId : null,
          cityIds: selectedStateId !== 'all' && selectedCityId === 'all' ? cities?.map(c => c.id) : null,
          userId: user.id,
        },
      });

      if (error) {
        if (error.message?.includes('not configured')) {
          addLog('error', '⚠️ Firecrawl API key not configured. Please add it in Settings.');
          setIsRunning(false);
          return;
        }
        throw error;
      }

      if (!data.success) {
        addLog('error', `✗ Error: ${data.error}`);
        setIsRunning(false);
        return;
      }

      setActiveSessionId(data.sessionId);
      addLog('success', `✓ Session started: ${data.sessionId.slice(0, 8)}`);
      addLog('info', `📋 Processing ${data.totalClinics} clinics...`);

      // Refetch to get new session
      refetchSessions();
      refetchResults();

      // Start the processing loop
      runProcessingLoop(data.sessionId);

    } catch (err) {
      console.error('Start enrichment error:', err);
      addLog('error', `✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsRunning(false);
    }
  };

  // Resume a paused/stopped session
  const resumeEnrichment = async () => {
    if (!activeSessionId) return;

    setIsRunning(true);
    setIsPaused(false);
    addLog('info', '▶️ Resuming enrichment...');

    // Update session status
    await supabase
      .from('email_enrichment_sessions')
      .update({ status: 'running' })
      .eq('id', activeSessionId);

    refetchSessions();
    runProcessingLoop(activeSessionId);
  };

  // Pause enrichment
  const pauseEnrichment = async () => {
    isProcessingRef.current = false;
    setIsPaused(true);
    setIsRunning(false);
    addLog('info', '⏸️ Paused enrichment');

    if (activeSessionId) {
      await supabase
        .from('email_enrichment_sessions')
        .update({ status: 'paused' })
        .eq('id', activeSessionId);
      refetchSessions();
    }
  };

  // Stop enrichment completely
  const stopEnrichment = async () => {
    isProcessingRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    addLog('info', '⏹️ Stopped enrichment');

    if (activeSessionId) {
      await supabase
        .from('email_enrichment_sessions')
        .update({ status: 'stopped' })
        .eq('id', activeSessionId);
      refetchSessions();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      isProcessingRef.current = false;
    };
  }, []);

  // Get current session
  const currentSession = sessions?.find(s => s.id === activeSessionId);
  const canResume = currentSession && ['paused', 'stopped', 'running'].includes(currentSession.status) && 
    currentSession.processed_count < currentSession.total_to_process && !isRunning;

  // Bulk apply selected emails
  const applySelectedEmails = async () => {
    if (selectedResults.size === 0) return;

    setIsApplyingBulk(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Get all selected results that can be applied
      const resultsToApply = sessionResults?.filter(r => 
        selectedResults.has(r.id) && 
        r.status === 'success' && 
        !r.applied_at && 
        r.email_selected
      ) || [];

      for (const result of resultsToApply) {
        try {
          const { error } = await supabase.functions.invoke('email-enrichment', {
            body: { action: 'apply-email', resultId: result.id, email: result.email_selected },
          });
          
          if (!error) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      toast.success(`Applied ${successCount} emails${failCount > 0 ? `, ${failCount} failed` : ''}`);
      setSelectedResults(new Set());
      refetchResults();
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['enrichment-review-queue'] });

    } catch (err) {
      toast.error('Failed to apply emails');
    } finally {
      setIsApplyingBulk(false);
    }
  };

  // Select all applicable results
  const selectAllApplicable = () => {
    const applicableIds = sessionResults
      ?.filter(r => r.status === 'success' && !r.applied_at && r.email_selected)
      .map(r => r.id) || [];
    setSelectedResults(new Set(applicableIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedResults(new Set());
  };

  // Toggle single selection
  const toggleSelection = (id: string) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Apply email to clinic
  const applyEmail = async (resultId: string, email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('email-enrichment', {
        body: { action: 'apply-email', resultId, email },
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Failed to apply email');
      }

      toast.success('Email applied to clinic');
      refetchResults();
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['enrichment-review-queue'] });
      setReviewModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply email');
    }
  };

  // Skip result (mark as reviewed but don't apply)
  const skipResult = async (resultId: string) => {
    await supabase
      .from('email_enrichment_results')
      .update({ needs_review: false, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', resultId);

    toast.success('Marked as reviewed');
    queryClient.invalidateQueries({ queryKey: ['enrichment-review-queue'] });
    setReviewModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Success</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'no_email': return <Badge variant="secondary">No Email Found</Badge>;
      case 'pending': return <Badge variant="outline">Pending</Badge>;
      case 'processing': return <Badge className="bg-blue-500">Processing</Badge>;
      case 'skipped': return <Badge variant="secondary">Skipped</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return <Badge className="bg-green-500">{confidence}%</Badge>;
    if (confidence >= 70) return <Badge className="bg-yellow-500">{confidence}%</Badge>;
    return <Badge variant="destructive">{confidence}%</Badge>;
  };

  const getSessionStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500">Completed</Badge>;
      case 'running': return <Badge className="bg-blue-500">Running</Badge>;
      case 'paused': return <Badge className="bg-yellow-500">Paused</Badge>;
      case 'stopped': return <Badge variant="destructive">Stopped</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{clinicStats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Clinics</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{clinicStats?.withEmail || 0}</p>
                <p className="text-xs text-muted-foreground">Have Email</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{clinicStats?.withoutEmail || 0}</p>
                <p className="text-xs text-muted-foreground">Missing Email</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{clinicStats?.withWebsite || 0}</p>
                <p className="text-xs text-muted-foreground">Have Website</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">{clinicStats?.withWebsiteNoEmail || 0}</p>
                <p className="text-xs text-muted-foreground">Can Enrich</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Email Enrichment Bot
          </CardTitle>
          <CardDescription>
            Scrape clinic websites to discover email addresses and enrich profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">State Filter</label>
              <Select value={selectedStateId} onValueChange={setSelectedStateId} disabled={isRunning}>
                <SelectTrigger>
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states?.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedStateId !== 'all' && cities && cities.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1 block">City Filter</label>
                <Select value={selectedCityId} onValueChange={setSelectedCityId} disabled={isRunning}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities ({cities.length})</SelectItem>
                    {cities.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end gap-2">
              {!isRunning && !canResume && (
                <Button
                  onClick={startEnrichment}
                  disabled={(clinicStats?.withWebsiteNoEmail || 0) === 0}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Enrichment
                </Button>
              )}
              {canResume && (
                <>
                  <Button onClick={resumeEnrichment} className="gap-2 bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4" />
                    Resume ({currentSession.total_to_process - currentSession.processed_count} remaining)
                  </Button>
                  <Button variant="destructive" onClick={stopEnrichment} className="gap-2">
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}
              {isRunning && (
                <>
                  <Button variant="outline" onClick={pauseEnrichment} className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                  <Button variant="destructive" onClick={stopEnrichment} className="gap-2">
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress */}
          {activeSessionId && currentSession && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
              {(() => {
                const progress = currentSession.total_to_process > 0 
                  ? (currentSession.processed_count / currentSession.total_to_process) * 100 
                  : 0;
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
                        Progress: {currentSession.processed_count} / {currentSession.total_to_process}
                      </span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> {currentSession.success_count} success
                      </span>
                      <span className="text-yellow-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {currentSession.skipped_count} skipped
                      </span>
                      <span className="text-red-600 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> {currentSession.failed_count} failed
                      </span>
                      <span className="ml-auto">
                        {getSessionStatusBadge(currentSession.status)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Activity Log */}
          {logs.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Activity Log</h4>
              <ScrollArea className="h-32 border rounded-md p-2 bg-muted/30">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs font-mono py-0.5">
                    <span className="text-muted-foreground">{log.time.toLocaleTimeString()}</span>
                    {' '}
                    <span className={
                      log.type === 'error' ? 'text-red-500' :
                      log.type === 'success' ? 'text-green-500' :
                      log.type === 'warning' ? 'text-yellow-500' : ''
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Results & Review */}
      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results" className="gap-2">
            <Database className="h-4 w-4" />
            Session Results
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Review Queue
            {(reviewQueue?.length || 0) > 0 && (
              <Badge variant="destructive" className="ml-1">{reviewQueue?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Zap className="h-4 w-4" />
            Past Sessions
          </TabsTrigger>
        </TabsList>

        {/* Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Enrichment Results</CardTitle>
                <CardDescription>
                  {sessionResults?.length || 0} results from current session
                  {selectedResults.size > 0 && (
                    <span className="ml-2 text-primary font-medium">
                      ({selectedResults.size} selected)
                    </span>
                  )}
                </CardDescription>
              </div>
              {activeSessionId && sessionResults && sessionResults.some(r => r.status === 'success' && !r.applied_at) && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={selectedResults.size > 0 ? clearSelection : selectAllApplicable}
                  >
                    {selectedResults.size > 0 ? 'Clear Selection' : 'Select All'}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={applySelectedEmails}
                    disabled={selectedResults.size === 0 || isApplyingBulk}
                    className="gap-2"
                  >
                    {isApplyingBulk ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Apply Selected ({selectedResults.size})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!activeSessionId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start an enrichment session to see results</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={
                              sessionResults?.filter(r => r.status === 'success' && !r.applied_at && r.email_selected).length > 0 &&
                              sessionResults?.filter(r => r.status === 'success' && !r.applied_at && r.email_selected).every(r => selectedResults.has(r.id))
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAllApplicable();
                              } else {
                                clearSelection();
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Clinic</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Emails Found</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionResults?.map(result => {
                        const canSelect = result.status === 'success' && !result.applied_at && result.email_selected;
                        return (
                          <TableRow key={result.id} className={selectedResults.has(result.id) ? 'bg-muted/50' : ''}>
                            <TableCell>
                              {canSelect ? (
                                <Checkbox 
                                  checked={selectedResults.has(result.id)}
                                  onCheckedChange={() => toggleSelection(result.id)}
                                />
                              ) : (
                                <span className="w-4" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{result.clinic?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{result.clinic?.city?.name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {result.website_url ? (
                                <a 
                                  href={result.website_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline flex items-center gap-1"
                                >
                                  <Globe className="h-3 w-3" />
                                  Visit
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {result.emails_found?.length > 0 ? (
                                <div className="space-y-1">
                                  {result.emails_found.slice(0, 2).map((email, i) => (
                                    <Badge 
                                      key={i} 
                                      variant={i === 0 ? "default" : "outline"}
                                      className="text-xs"
                                    >
                                      {email}
                                    </Badge>
                                  ))}
                                  {result.emails_found.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{result.emails_found.length - 2} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {result.match_confidence > 0 && getConfidenceBadge(result.match_confidence)}
                            </TableCell>
                            <TableCell title={result.error_message || undefined}>
                              {getStatusBadge(result.status)}
                            </TableCell>
                            <TableCell>
                              {result.status === 'success' && !result.applied_at && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedResult(result);
                                    setManualEmail(result.email_selected || '');
                                    setReviewModalOpen(true);
                                  }}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Review
                                </Button>
                              )}
                              {result.applied_at && (
                                <Badge className="bg-green-500">Applied</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Queue Tab */}
        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>Manual Review Queue</CardTitle>
              <CardDescription>
                {reviewQueue?.length || 0} items need manual verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(reviewQueue?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p>No items need review</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Clinic</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Suggested Email</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewQueue?.map(result => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{result.clinic?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{result.clinic?.city?.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {result.clinic?.website ? (
                              <a 
                                href={result.clinic.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Visit
                              </a>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge>{result.email_selected}</Badge>
                          </TableCell>
                          <TableCell>{getConfidenceBadge(result.match_confidence)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => {
                                  setSelectedResult(result);
                                  setManualEmail(result.email_selected || '');
                                  setReviewModalOpen(true);
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Review
                              </Button>
                            </div>
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

        {/* Past Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Past Enrichment Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Success</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions?.map(session => {
                    const canResumeSession = ['paused', 'stopped', 'running'].includes(session.status) && 
                      session.processed_count < session.total_to_process;
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono text-xs">{session.id.slice(0, 8)}</TableCell>
                        <TableCell>{getSessionStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          {session.processed_count} / {session.total_to_process}
                          <Progress 
                            value={(session.processed_count / session.total_to_process) * 100} 
                            className="h-1 mt-1 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-green-600">{session.success_count}</TableCell>
                        <TableCell className="text-red-600">{session.failed_count}</TableCell>
                        <TableCell>{new Date(session.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveSessionId(session.id);
                                refetchResults();
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            {canResumeSession && session.id !== activeSessionId && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setActiveSessionId(session.id);
                                  resumeEnrichment();
                                }}
                                className="gap-1"
                              >
                                <Play className="h-3 w-3" />
                                Resume
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Email Match</DialogTitle>
            <DialogDescription>
              Verify the email before applying to the clinic profile
            </DialogDescription>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p className="font-medium">{selectedResult.clinic?.name}</p>
                {selectedResult.clinic?.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedResult.clinic.address}
                  </p>
                )}
                {selectedResult.clinic?.website && (
                  <a 
                    href={selectedResult.clinic.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-3 w-3" />
                    {selectedResult.clinic.website}
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Emails Found:</label>
                <div className="flex flex-wrap gap-2">
                  {selectedResult.emails_found?.map((email, i) => (
                    <Badge 
                      key={i}
                      variant={email === manualEmail ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setManualEmail(email)}
                    >
                      {email}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email to Apply:</label>
                <Input 
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span>Confidence:</span>
                {getConfidenceBadge(selectedResult.match_confidence)}
                {selectedResult.match_method && (
                  <Badge variant="outline">{selectedResult.match_method}</Badge>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => selectedResult && skipResult(selectedResult.id)}>
              <X className="h-4 w-4 mr-1" />
              Skip
            </Button>
            <Button 
              onClick={() => selectedResult && applyEmail(selectedResult.id, manualEmail)}
              disabled={!manualEmail}
            >
              <Check className="h-4 w-4 mr-1" />
              Apply Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
