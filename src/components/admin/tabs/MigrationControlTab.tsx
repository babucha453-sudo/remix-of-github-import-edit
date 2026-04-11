import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Database, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Server,
  ArrowRight,
  Copy,
  Terminal
} from "lucide-react";

interface TableStatus {
  name: string;
  sourceCount: number;
  targetCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  lastId?: string;
  error?: string;
}

interface MigrationLog {
  timestamp: string;
  table: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const MIGRATION_TABLES = [
  'states', 'insurances', 'subscription_plans', 'blog_categories', 'global_settings',
  'plan_features', 'cities', 'seo_pages', 'treatments', 'clinics', 'dentists',
  'patients', 'leads', 'appointments', 'reviews', 'blog_posts', 'visitor_sessions',
  'page_views', 'google_reviews', 'audit_logs', 'clinic_hours', 'seo_metadata_history',
  'outreach_campaigns', 'automation_rules'
];

export function MigrationControlTab() {
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [schemaScript, setSchemaScript] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);

  const addLog = (table: string, message: string, type: 'info' | 'success' | 'error') => {
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      table,
      message,
      type
    }, ...prev].slice(0, 100));
  };

  const fetchTableCounts = async () => {
    setIsAuditing(true);
    addLog('system', 'Starting table audit...', 'info');
    
    const statuses: TableStatus[] = [];
    
    for (const tableName of MIGRATION_TABLES) {
      try {
        const { count, error } = await supabase
          .from(tableName as any)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          statuses.push({
            name: tableName,
            sourceCount: 0,
            targetCount: 0,
            status: 'error',
            error: error.message
          });
        } else {
          statuses.push({
            name: tableName,
            sourceCount: count || 0,
            targetCount: 0, // Would need external DB query
            status: 'pending'
          });
        }
      } catch (err) {
        statuses.push({
          name: tableName,
          sourceCount: 0,
          targetCount: 0,
          status: 'error',
          error: String(err)
        });
      }
    }
    
    setTableStatuses(statuses);
    setIsAuditing(false);
    addLog('system', `Audit complete. Found ${statuses.length} tables.`, 'success');
  };

  const migrateTable = async (tableName: string, lastId?: string) => {
    try {
      const response = await supabase.functions.invoke('migrate-to-external', {
        body: {
          action: 'migrate-table',
          tableName,
          batchSize: 100,
          lastId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (err) {
      throw err;
    }
  };

  const runMigration = async () => {
    setIsRunning(true);
    addLog('system', 'Starting migration...', 'info');

    for (const tableStatus of tableStatuses) {
      if (tableStatus.status === 'completed') continue;

      let lastId = tableStatus.lastId;
      let hasMore = true;
      let totalMigrated = 0;

      setTableStatuses(prev => prev.map(t => 
        t.name === tableStatus.name ? { ...t, status: 'in_progress' } : t
      ));

      while (hasMore && isRunning) {
        try {
          const result = await migrateTable(tableStatus.name, lastId);
          
          if (result.success) {
            totalMigrated += result.recordsProcessed || 0;
            hasMore = result.hasMore;
            lastId = result.lastProcessedId;

            addLog(tableStatus.name, `Migrated ${result.recordsProcessed} records (total: ${totalMigrated})`, 'info');

            setTableStatuses(prev => prev.map(t => 
              t.name === tableStatus.name ? { 
                ...t, 
                lastId,
                targetCount: totalMigrated
              } : t
            ));
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (err: any) {
          addLog(tableStatus.name, `Error: ${err.message}`, 'error');
          
          // Check if it's a schema error
          if (err.message?.includes('Could not find')) {
            const columnMatch = err.message.match(/Could not find the '(\w+)' column/);
            if (columnMatch) {
              setSchemaScript(prev => prev + `\nALTER TABLE public.${tableStatus.name} ADD COLUMN IF NOT EXISTS ${columnMatch[1]} TEXT;`);
            }
          }

          setTableStatuses(prev => prev.map(t => 
            t.name === tableStatus.name ? { 
              ...t, 
              status: 'error',
              error: err.message 
            } : t
          ));
          hasMore = false;
        }
      }

      if (hasMore === false && !tableStatuses.find(t => t.name === tableStatus.name)?.error) {
        setTableStatuses(prev => prev.map(t => 
          t.name === tableStatus.name ? { ...t, status: 'completed' } : t
        ));
        addLog(tableStatus.name, `Migration complete! Total: ${totalMigrated} records`, 'success');
      }
    }

    setIsRunning(false);
    addLog('system', 'Migration process finished', 'success');
  };

  const copySchemaScript = () => {
    navigator.clipboard.writeText(schemaScript);
    toast.success('Schema script copied to clipboard');
  };

  const getStatusBadge = (status: TableStatus['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Complete</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case 'error':
        return <Badge className="bg-red-500"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const completedCount = tableStatuses.filter(t => t.status === 'completed').length;
  const totalCount = tableStatuses.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Migration Control Center
          </h2>
          <p className="text-muted-foreground">
            Migrate data from Lovable Cloud to external Supabase
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchTableCounts}
            disabled={isAuditing || isRunning}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAuditing ? 'animate-spin' : ''}`} />
            Audit Tables
          </Button>
          <Button 
            onClick={runMigration}
            disabled={isRunning || tableStatuses.length === 0}
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Migration
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {tableStatuses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="flex-1" />
              <span className="text-sm font-medium">
                {completedCount} / {totalCount} tables
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Table Status
            </CardTitle>
            <CardDescription>
              Current migration status for each table
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Migrated</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableStatuses.map((table) => (
                    <TableRow key={table.name}>
                      <TableCell className="font-mono text-sm">{table.name}</TableCell>
                      <TableCell>{table.sourceCount.toLocaleString()}</TableCell>
                      <TableCell>{table.targetCount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(table.status)}</TableCell>
                    </TableRow>
                  ))}
                  {tableStatuses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Click "Audit Tables" to start
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Migration Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Migration Logs
            </CardTitle>
            <CardDescription>
              Real-time migration activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] bg-muted/50 rounded-md p-4 font-mono text-sm">
              {logs.map((log, i) => (
                <div 
                  key={i} 
                  className={`mb-2 ${
                    log.type === 'error' ? 'text-red-500' : 
                    log.type === 'success' ? 'text-green-500' : 
                    'text-muted-foreground'
                  }`}
                >
                  <span className="text-xs opacity-50">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {' '}
                  <span className="text-primary">[{log.table}]</span>
                  {' '}
                  {log.message}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-muted-foreground text-center py-8">
                  No logs yet. Start a migration to see activity.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Schema Fix Script */}
      {schemaScript && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              Schema Fixes Required
            </CardTitle>
            <CardDescription>
              Run this SQL on your external Supabase to fix missing columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Textarea 
                value={schemaScript}
                readOnly
                className="font-mono text-sm h-48"
              />
              <Button 
                size="sm" 
                variant="outline" 
                className="absolute top-2 right-2"
                onClick={copySchemaScript}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
