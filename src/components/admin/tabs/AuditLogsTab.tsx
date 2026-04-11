import { useState } from 'react';
import { useAuditLogs, useAuditLogActions, useAuditLogEntityTypes } from '@/hooks/useAdminAuditLogs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Search, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export default function AuditLogsTab() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: logs, isLoading } = useAuditLogs({
    action: actionFilter || undefined,
    entityType: entityTypeFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: actions } = useAuditLogActions();
  const { data: entityTypes } = useAuditLogEntityTypes();

  const filteredLogs = logs?.filter(l => {
    const matchesSearch = !search || 
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
      l.user_email?.toLowerCase().includes(search.toLowerCase());
    
    const matchesRole = !roleFilter || l.user_role === roleFilter;
    
    return matchesSearch && matchesRole;
  }) || [];

  const uniqueRoles = [...new Set(logs?.map(l => l.user_role).filter(Boolean) || [])];

  const clearFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityTypeFilter('');
    setRoleFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = search || actionFilter || entityTypeFilter || roleFilter || dateFrom || dateTo;

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
        <h1 className="text-3xl font-display font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">Security and activity tracking across all users</p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by action, entity, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Actions</SelectItem>
              {actions?.map((action: string) => (
                <SelectItem key={action} value={action}>{action}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={entityTypeFilter}
            onValueChange={(v) => setEntityTypeFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Entities</SelectItem>
              {entityTypes?.map((type: string) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Roles</SelectItem>
              {uniqueRoles.map(role => (
                <SelectItem key={role} value={role!}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Date range:</span>
          </div>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px]"
            placeholder="From"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[160px]"
            placeholder="To"
          />
          
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <Card className="card-modern">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{log.entity_type}</span>
                    {log.entity_id && <span className="text-xs text-muted-foreground ml-2">{log.entity_id.slice(0, 8)}...</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.user_email || '-'}</TableCell>
                  <TableCell>
                    {log.user_role ? (
                      <Badge variant="secondary" className="text-xs">{log.user_role}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No audit logs found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Showing {filteredLogs.length} of {logs?.length || 0} logs
      </p>
    </div>
  );
}
