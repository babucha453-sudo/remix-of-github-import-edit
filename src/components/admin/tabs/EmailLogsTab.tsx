import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Search, Filter, X, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const statusColors: Record<string, string> = {
  sent: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export default function EmailLogsTab() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: logs, isLoading } = useQuery({
    queryKey: ['email-logs', typeFilter, statusFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      let query = supabase
        .from('email_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (typeFilter) query = query.eq('type', typeFilter);
      if (statusFilter) query = query.eq('status', statusFilter);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const { data: types } = useQuery({
    queryKey: ['email-log-types'],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_logs')
        .select('type')
        .order('type');
      return [...new Set((data || []).map(l => l.type))] as string[];
    },
  });

  const filteredLogs = logs?.data.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.recipient?.toLowerCase().includes(q) ||
      l.subject?.toLowerCase().includes(q) ||
      l.type?.toLowerCase().includes(q) ||
      l.resend_id?.toLowerCase().includes(q)
    );
  }) || [];

  const totalPages = Math.ceil((logs?.count || 0) / PAGE_SIZE);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const hasFilters = search || typeFilter || statusFilter || dateFrom || dateTo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Email Logs</h1>
        <p className="text-muted-foreground mt-1">Track all outgoing email communications</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by recipient, subject, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(types || []).map(t => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[140px]"
              placeholder="From"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[140px]"
              placeholder="To"
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Recipient</TableHead>
                <TableHead className="min-w-[250px]">Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No email logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="font-medium">{log.recipient}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{log.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[log.status] || 'bg-gray-100 text-gray-800'}>
                        {log.status === 'sent' && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                        {log.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                        {log.status === 'pending' && <Clock className="h-3 w-3 mr-1 inline" />}
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, logs?.count || 0)} of {logs?.count}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Recipient:</span>
                <span className="col-span-2 font-medium">{selectedLog.recipient}</span>
                <span className="text-muted-foreground">Subject:</span>
                <span className="col-span-2">{selectedLog.subject}</span>
                <span className="text-muted-foreground">Type:</span>
                <span className="col-span-2">
                  <Badge variant="outline">{selectedLog.type.replace(/_/g, ' ')}</Badge>
                </span>
                <span className="text-muted-foreground">Status:</span>
                <span className="col-span-2">
                  <Badge className={statusColors[selectedLog.status]}>
                    {selectedLog.status}
                  </Badge>
                </span>
                <span className="text-muted-foreground">Sent at:</span>
                <span className="col-span-2">
                  {selectedLog.created_at ? format(new Date(selectedLog.created_at), 'MMM d, yyyy HH:mm:ss') : '-'}
                </span>
                {selectedLog.resend_id && (
                  <>
                    <span className="text-muted-foreground">Resend ID:</span>
                    <span className="col-span-2 font-mono text-xs">{selectedLog.resend_id}</span>
                  </>
                )}
                {selectedLog.clinic_id && (
                  <>
                    <span className="text-muted-foreground">Clinic ID:</span>
                    <span className="col-span-2 font-mono text-xs">{selectedLog.clinic_id}</span>
                  </>
                )}
              </div>
              {selectedLog.error_message && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">Error</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{selectedLog.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
