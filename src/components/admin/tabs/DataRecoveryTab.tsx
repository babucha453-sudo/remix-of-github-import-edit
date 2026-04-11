import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Database, Play, Pause, RotateCcw, CheckCircle2, XCircle, 
  AlertTriangle, Loader2, RefreshCw, BarChart3 
} from 'lucide-react';

interface RecoveryState {
  phase: 'idle' | 'loading' | 'recovering' | 'paused' | 'done' | 'error';
  totalPlaceIds: number;
  alreadyRestored: number;
  remaining: number;
  placeIds: string[];
  batchIndex: number;
  imported: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
  logs: string[];
}

interface DbCounts {
  clinics: number;
  clinic_hours: number;
  google_reviews: number;
  dentists: number;
}

const BATCH_SIZE = 10;

export default function DataRecoveryTab() {
  const [state, setState] = useState<RecoveryState>({
    phase: 'idle',
    totalPlaceIds: 0,
    alreadyRestored: 0,
    remaining: 0,
    placeIds: [],
    batchIndex: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    logs: [],
  });
  const [counts, setCounts] = useState<DbCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const pauseRef = useRef(false);
  const runningRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setState(prev => ({ ...prev, logs: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.logs.slice(0, 499)] }));
  }, []);

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const { data } = await supabase.functions.invoke('recover-clinics', { body: { action: 'status' } });
      if (data?.counts) setCounts(data.counts);
    } catch { /* ignore */ }
    setLoadingCounts(false);
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const loadPlaceIds = async () => {
    setState(prev => ({ ...prev, phase: 'loading' }));
    addLog('Scanning audit logs for recoverable Place IDs...');
    try {
      const { data, error } = await supabase.functions.invoke('recover-clinics', { body: { action: 'get-place-ids' } });
      if (error) throw error;
      setState(prev => ({
        ...prev,
        phase: 'idle',
        totalPlaceIds: data.total_place_ids,
        alreadyRestored: data.already_restored,
        remaining: data.remaining,
        placeIds: data.place_ids,
        batchIndex: 0,
        imported: 0,
        skipped: 0,
        errors: 0,
        errorDetails: [],
      }));
      addLog(`Found ${data.total_place_ids} total Place IDs. ${data.already_restored} already restored. ${data.remaining} remaining.`);
    } catch (err: any) {
      setState(prev => ({ ...prev, phase: 'error' }));
      addLog(`Error loading place IDs: ${err.message}`);
      toast.error('Failed to load place IDs');
    }
  };

  const runRecovery = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    pauseRef.current = false;
    setState(prev => ({ ...prev, phase: 'recovering' }));
    addLog('🚀 Starting recovery...');

    let idx = state.batchIndex;
    const ids = state.placeIds;

    while (idx < ids.length && !pauseRef.current) {
      const batch = ids.slice(idx, idx + BATCH_SIZE);
      addLog(`Processing batch ${Math.floor(idx / BATCH_SIZE) + 1} (${idx + 1}–${Math.min(idx + BATCH_SIZE, ids.length)} of ${ids.length})...`);

      try {
        const { data, error } = await supabase.functions.invoke('recover-clinics', {
          body: { action: 'recover-batch', placeIds: batch },
        });
        if (error) throw error;

        setState(prev => ({
          ...prev,
          batchIndex: idx + BATCH_SIZE,
          imported: prev.imported + (data.imported || 0),
          skipped: prev.skipped + (data.skipped || 0),
          errors: prev.errors + (data.errors || 0),
          errorDetails: [...prev.errorDetails, ...(data.error_details || [])].slice(-100),
        }));

        addLog(`✅ Batch done: ${data.imported} imported, ${data.skipped} skipped, ${data.errors} errors`);
        if (data.error_details?.length) {
          data.error_details.forEach((e: string) => addLog(`  ⚠️ ${e}`));
        }
      } catch (err: any) {
        addLog(`❌ Batch error: ${err.message}`);
        setState(prev => ({ ...prev, errors: prev.errors + batch.length }));
      }

      idx += BATCH_SIZE;
      // Small delay between batches to avoid rate limiting
      if (!pauseRef.current && idx < ids.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    runningRef.current = false;
    if (pauseRef.current) {
      setState(prev => ({ ...prev, phase: 'paused', batchIndex: idx }));
      addLog('⏸️ Recovery paused by user.');
    } else {
      setState(prev => ({ ...prev, phase: 'done', batchIndex: idx }));
      addLog('🎉 Recovery complete!');
      toast.success('Recovery complete!');
      fetchCounts();
    }
  };

  const pauseRecovery = () => {
    pauseRef.current = true;
    addLog('Pausing after current batch...');
  };

  const resetRecovery = () => {
    runningRef.current = false;
    pauseRef.current = false;
    setState({
      phase: 'idle',
      totalPlaceIds: 0,
      alreadyRestored: 0,
      remaining: 0,
      placeIds: [],
      batchIndex: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      logs: [],
    });
    addLog('Reset complete.');
  };

  const progress = state.placeIds.length > 0
    ? Math.round((state.batchIndex / state.placeIds.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Data Recovery Center
        </h2>
        <p className="text-muted-foreground mt-1">
          Recover deleted clinics, reviews, and hours from Google Places API using audit log records.
        </p>
      </div>

      {/* DB Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Clinics', value: counts?.clinics ?? '—', icon: '🏥' },
          { label: 'Hours', value: counts?.clinic_hours ?? '—', icon: '🕐' },
          { label: 'Reviews', value: counts?.google_reviews ?? '—', icon: '⭐' },
          { label: 'Dentists', value: counts?.dentists ?? '—', icon: '🦷' },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-2xl font-bold">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </CardContent>
          </Card>
        ))}
        <div className="col-span-2 md:col-span-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={fetchCounts} disabled={loadingCounts}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingCounts ? 'animate-spin' : ''}`} />
            Refresh Counts
          </Button>
        </div>
      </div>

      {/* Recovery Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recovery Engine
          </CardTitle>
          <CardDescription>
            Step 1: Scan audit logs → Step 2: Start recovery → Clinics are re-imported from Google in batches of {BATCH_SIZE}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scan Info */}
          {state.totalPlaceIds > 0 && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{state.totalPlaceIds.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Place IDs</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-green-600">{state.alreadyRestored.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Already Restored</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-orange-600">{state.remaining.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>
          )}

          {/* Progress */}
          {state.phase !== 'idle' && state.placeIds.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {state.batchIndex} / {state.placeIds.length}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {state.imported} imported
                </span>
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> {state.skipped} skipped
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-3.5 w-3.5" /> {state.errors} errors
                </span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 flex-wrap">
            {state.phase === 'idle' && state.placeIds.length === 0 && (
              <Button onClick={loadPlaceIds}>
                <Database className="h-4 w-4 mr-2" />
                Step 1: Scan Audit Logs
              </Button>
            )}

            {(state.phase === 'idle' || state.phase === 'paused') && state.placeIds.length > 0 && state.batchIndex < state.placeIds.length && (
              <Button onClick={runRecovery} className="bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4 mr-2" />
                {state.phase === 'paused' ? 'Resume Recovery' : 'Step 2: Start Recovery'}
              </Button>
            )}

            {state.phase === 'recovering' && (
              <Button variant="outline" onClick={pauseRecovery}>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}

            {state.phase === 'loading' && (
              <Button disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </Button>
            )}

            {state.phase === 'done' && (
              <Badge variant="default" className="bg-green-600 text-white text-sm px-4 py-2">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Recovery Complete — {state.imported} clinics restored
              </Badge>
            )}

            <Button variant="ghost" size="sm" onClick={resetRecovery}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recovery Log</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-3">
            {state.logs.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">No activity yet. Click "Scan Audit Logs" to begin.</p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {state.logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground">{log}</div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
