import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  History, RotateCcw, AlertTriangle, Trash2, Database,
  Users, Building2, Loader2, CheckCircle2, XCircle, Shield
} from 'lucide-react';

interface AuditAction {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_email: string | null;
  user_role: string | null;
  created_at: string;
  new_values: Record<string, unknown> | null;
  old_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface RevertProgress {
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
  running: boolean;
}

const ACTION_SEVERITY: Record<string, 'destructive' | 'warning' | 'info'> = {
  DELETE_ALL: 'destructive',
  BULK_DELETE: 'destructive',
  DELETE: 'warning',
  UPDATE: 'info',
  ROLE_CHANGE: 'warning',
};

const ENTITY_ICONS: Record<string, typeof Building2> = {
  clinic: Building2,
  dentist: Users,
  default: Database,
};

function getActionBadgeVariant(action: string) {
  const severity = ACTION_SEVERITY[action];
  if (severity === 'destructive') return 'destructive' as const;
  if (severity === 'warning') return 'secondary' as const;
  return 'outline' as const;
}

function getRevertDescription(log: AuditAction): string {
  const count = (log.new_values as any)?.count;
  switch (log.action) {
    case 'DELETE_ALL':
      return `Mass deletion of ${count ? count.toLocaleString() : 'all'} ${log.entity_type}s. Revert will trigger full recovery from Google Places API.`;
    case 'BULK_DELETE':
      return `Bulk deletion of ${count ? count.toLocaleString() : 'multiple'} ${log.entity_type}s. Revert will re-import affected records.`;
    case 'DELETE':
      return `Single ${log.entity_type} deleted (ID: ${log.entity_id?.slice(0, 8)}...). Revert will restore this record.`;
    default:
      return `${log.action} on ${log.entity_type}. Review details before reverting.`;
  }
}

function canRevert(log: AuditAction): boolean {
  return ['DELETE_ALL', 'BULK_DELETE', 'DELETE'].includes(log.action) &&
    ['clinic', 'dentist'].includes(log.entity_type);
}

export default function AdminRevertTab() {
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<AuditAction | null>(null);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [revertResults, setRevertResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [revertProgress, setRevertProgress] = useState<Record<string, RevertProgress>>({});
  const cancelRef = useRef<Set<string>>(new Set());

  // Fetch recent destructive actions (last 48 hours)
  const { data: recentActions, isLoading } = useQuery({
    queryKey: ['admin-revert-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .in('action', ['DELETE_ALL', 'BULK_DELETE', 'DELETE', 'ROLE_CHANGE', 'UPDATE'])
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditAction[];
    },
  });

  // Revert mutation with full pagination - NO limits
  const revertMutation = useMutation({
    mutationFn: async (log: AuditAction) => {
      setRevertingIds(prev => new Set(prev).add(log.id));
      cancelRef.current.delete(log.id);
      
      if (log.entity_type === 'clinic') {
        if (log.action === 'DELETE_ALL' || log.action === 'BULK_DELETE') {
          // Step 1: Get ALL place IDs (edge function now paginates internally)
          const { data: scanData, error: scanErr } = await supabase.functions.invoke('recover-clinics', {
            body: { action: 'get-place-ids' },
          });
          if (scanErr) throw scanErr;
          
          const placeIds: string[] = scanData.place_ids || [];
          const total = placeIds.length;
          
          setRevertProgress(prev => ({ ...prev, [log.id]: { total, processed: 0, imported: 0, skipped: 0, errors: 0, running: true } }));
          
          let imported = 0, skipped = 0, errors = 0;
          const BATCH = 10;
          
          // Process ALL place IDs in batches - no limit
          for (let i = 0; i < placeIds.length; i += BATCH) {
            // Check for cancellation
            if (cancelRef.current.has(log.id)) {
              setRevertProgress(prev => ({ ...prev, [log.id]: { ...prev[log.id], running: false } }));
              return { success: true, message: `Cancelled after recovering ${imported} clinics (${skipped} skipped, ${errors} errors). ${placeIds.length - i} remaining.` };
            }

            const batch = placeIds.slice(i, i + BATCH);
            try {
              const { data, error } = await supabase.functions.invoke('recover-clinics', {
                body: { action: 'recover-batch', placeIds: batch },
              });
              if (error) { errors += batch.length; } else {
                imported += data.imported || 0;
                skipped += data.skipped || 0;
                errors += data.errors || 0;
              }
            } catch {
              errors += batch.length;
            }
            
            setRevertProgress(prev => ({
              ...prev,
              [log.id]: { total, processed: Math.min(i + BATCH, total), imported, skipped, errors, running: true },
            }));
            
            // Small delay between batches
            if (i + BATCH < placeIds.length) {
              await new Promise(r => setTimeout(r, 300));
            }
          }
          
          setRevertProgress(prev => ({ ...prev, [log.id]: { total, processed: total, imported, skipped, errors, running: false } }));
          return { success: true, message: `Recovered ${imported} clinics (${skipped} skipped, ${errors} errors) out of ${total} total` };
        }
      }
      
      if (log.entity_type === 'dentist') {
        return { success: false, message: 'Dentist recovery requires manual re-creation. Use the Data Recovery tab for bulk clinic restoration which will also restore associated data.' };
      }
      
      return { success: false, message: 'This action type cannot be automatically reverted. Please use the Data Recovery tab.' };
    },
    onSuccess: (result, log) => {
      setRevertResults(prev => ({ ...prev, [log.id]: result }));
      setRevertingIds(prev => { const s = new Set(prev); s.delete(log.id); return s; });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-revert-actions'] });
    },
    onError: (err: any, log) => {
      setRevertResults(prev => ({ ...prev, [log.id]: { success: false, message: err.message } }));
      setRevertingIds(prev => { const s = new Set(prev); s.delete(log.id); return s; });
      setRevertProgress(prev => {
        if (prev[log.id]) return { ...prev, [log.id]: { ...prev[log.id], running: false } };
        return prev;
      });
      toast.error(`Revert failed: ${err.message}`);
    },
  });

  const destructiveActions = recentActions?.filter(a =>
    ['DELETE_ALL', 'BULK_DELETE', 'DELETE'].includes(a.action)
  ) || [];

  const otherActions = recentActions?.filter(a =>
    !['DELETE_ALL', 'BULK_DELETE', 'DELETE'].includes(a.action)
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          Admin Action Revert Center
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and revert recent admin actions. Destructive actions from the last 48 hours are shown below.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">{destructiveActions.length}</div>
              <div className="text-sm text-muted-foreground">Destructive Actions</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {destructiveActions.reduce((sum, a) => sum + ((a.new_values as any)?.count || 1), 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Records Affected</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {Object.values(revertResults).filter(r => r.success).length}
              </div>
              <div className="text-sm text-muted-foreground">Successfully Reverted</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Destructive Actions Table */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Destructive Actions (Deletions)
          </CardTitle>
          <CardDescription>
            These are delete operations that removed data. Click "Revert" to restore.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {destructiveActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>No destructive actions in the last 48 hours</p>
                  </TableCell>
                </TableRow>
              ) : (
                destructiveActions.map((log) => {
                  const EntityIcon = ENTITY_ICONS[log.entity_type] || ENTITY_ICONS.default;
                  const count = (log.new_values as any)?.count || 1;
                  const isReverting = revertingIds.has(log.id);
                  const result = revertResults[log.id];
                  const progress = revertProgress[log.id];
                  const progressPct = progress && progress.total > 0
                    ? Math.round((progress.processed / progress.total) * 100) : 0;

                  return (
                    <TableRow key={log.id} className="hover:bg-destructive/5">
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <EntityIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium capitalize">{log.entity_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-bold text-destructive">{count.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.user_email || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(log.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        {progress && progress.running ? (
                          <div className="space-y-1 min-w-[140px]">
                            <Progress value={progressPct} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {progress.processed}/{progress.total} — {progress.imported} recovered
                            </div>
                          </div>
                        ) : result ? (
                          result.success ? (
                            <Badge className="bg-green-600 text-white">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Reverted
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" /> Manual
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-xs">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isReverting && progress?.running ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelRef.current.add(log.id)}
                          >
                            Cancel
                          </Button>
                        ) : canRevert(log) && !result?.success ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isReverting}
                            onClick={() => setSelectedAction(log)}
                          >
                            {isReverting ? (
                              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Reverting...</>
                            ) : (
                              <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Revert</>
                            )}
                          </Button>
                        ) : !canRevert(log) ? (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Other Recent Actions */}
      {otherActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Other Recent Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherActions.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{log.entity_type}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{log.user_email || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(log.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Revert Action
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{selectedAction && getRevertDescription(selectedAction)}</p>
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <p><strong>Action:</strong> {selectedAction?.action}</p>
                <p><strong>Entity:</strong> {selectedAction?.entity_type}</p>
                <p><strong>By:</strong> {selectedAction?.user_email}</p>
                <p><strong>When:</strong> {selectedAction && format(new Date(selectedAction.created_at), 'MMM d, yyyy HH:mm:ss')}</p>
              </div>
              {selectedAction?.entity_type === 'clinic' && (
                <p className="text-orange-600 text-sm font-medium">
                  ⚠️ This will call Google Places API for each clinic. Large reverts may take several minutes and incur API costs.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (selectedAction) {
                  revertMutation.mutate(selectedAction);
                  setSelectedAction(null);
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Confirm Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
