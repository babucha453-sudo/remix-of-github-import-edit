import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditFilters {
  action?: string;
  entityType?: string;
  userId?: string;
  userRole?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useAuditLogs(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.action) query = query.eq('action', filters.action);
      if (filters.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.userRole) query = query.eq('user_role', filters.userRole);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as AuditLog[];
    },
  });
}

export function useAuditLogActions() {
  return useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action')
        .limit(1000);
      if (error) throw error;
      const actions = [...new Set(data.map(d => d.action))];
      return actions.sort();
    },
  });
}

export function useAuditLogEntityTypes() {
  return useQuery({
    queryKey: ['audit-log-entity-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('entity_type')
        .limit(1000);
      if (error) throw error;
      const types = [...new Set(data.map(d => d.entity_type))];
      return types.sort();
    },
  });
}
