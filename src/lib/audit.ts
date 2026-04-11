import { supabase } from '@/integrations/supabase/client';

interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog({
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  metadata,
}: AuditLogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('audit_logs').insert([{
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      old_values: oldValues as unknown as null,
      new_values: newValues as unknown as null,
      metadata: metadata as unknown as null,
      user_agent: navigator.userAgent,
    }]);
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
