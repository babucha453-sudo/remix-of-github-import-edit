import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface AIEvent {
  id: string;
  event_type: string;
  module: string;
  clinic_id: string | null;
  user_id: string | null;
  triggered_by: string;
  status: string;
  confidence_score: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface AIOutput {
  id: string;
  event_id: string;
  output_type: string;
  output_data: Record<string, unknown>;
  explanation: string | null;
  created_at: string;
}

export interface AIModuleSetting {
  id: string;
  module: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  thresholds: Record<string, unknown>;
  last_run_at: string | null;
}

export interface AIPromptTemplate {
  id: string;
  name: string;
  module: string;
  description: string | null;
  prompt_template: string;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  is_active: boolean;
  version: number;
}

export interface AIError {
  id: string;
  event_id: string | null;
  error_code: string | null;
  error_message: string;
  context_data: Record<string, unknown> | null;
  created_at: string;
}

// Hooks for AI Events
export function useAIEvents(filters?: { module?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['ai-events', filters],
    queryFn: async () => {
      let query = supabase
        .from('ai_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.module) query = query.eq('module', filters.module);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.limit) query = query.limit(filters.limit);
      else query = query.limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return data as AIEvent[];
    },
  });
}

export function useAIEventWithOutputs(eventId: string) {
  return useQuery({
    queryKey: ['ai-event', eventId],
    queryFn: async () => {
      const [eventResult, outputsResult, inputsResult] = await Promise.all([
        supabase.from('ai_events').select('*').eq('id', eventId).single(),
        supabase.from('ai_outputs').select('*').eq('event_id', eventId),
        supabase.from('ai_inputs').select('*').eq('event_id', eventId),
      ]);
      
      if (eventResult.error) throw eventResult.error;
      return {
        event: eventResult.data as AIEvent,
        outputs: outputsResult.data as AIOutput[],
        inputs: inputsResult.data || [],
      };
    },
    enabled: !!eventId,
  });
}

// Hooks for AI Module Settings
export function useAIModuleSettings() {
  return useQuery({
    queryKey: ['ai-module-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_module_settings')
        .select('*')
        .order('module');
      if (error) throw error;
      return data as AIModuleSetting[];
    },
  });
}

export function useUpdateAIModuleSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { is_enabled?: boolean; config?: object; thresholds?: object } }) => {
      const { error } = await supabase
        .from('ai_module_settings')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-module-settings'] });
      toast.success('AI module setting updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

// Hooks for AI Prompt Templates
export function useAIPromptTemplates() {
  return useQuery({
    queryKey: ['ai-prompt-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .order('module', { ascending: true });
      if (error) throw error;
      return data as AIPromptTemplate[];
    },
  });
}

export function useUpdatePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { prompt_template?: string; is_active?: boolean } }) => {
      const { error } = await supabase
        .from('ai_prompt_templates')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompt-templates'] });
      toast.success('Prompt template updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

// Hooks for AI Errors
export function useAIErrors(limit = 50) {
  return useQuery({
    queryKey: ['ai-errors', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as AIError[];
    },
  });
}

// AI Stats for dashboard
export function useAIStats() {
  return useQuery({
    queryKey: ['ai-stats'],
    queryFn: async () => {
      const [
        { count: totalEvents },
        { count: completedEvents },
        { count: failedEvents },
        { count: pendingEvents },
        { count: totalErrors },
      ] = await Promise.all([
        supabase.from('ai_events').select('*', { count: 'exact', head: true }),
        supabase.from('ai_events').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('ai_events').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('ai_events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('ai_errors').select('*', { count: 'exact', head: true }),
      ]);

      // Get average confidence score
      const { data: avgData } = await supabase
        .from('ai_events')
        .select('confidence_score')
        .not('confidence_score', 'is', null);

      const avgConfidence = avgData?.length
        ? avgData.reduce((sum, e) => sum + (e.confidence_score || 0), 0) / avgData.length
        : 0;

      return {
        total: totalEvents || 0,
        completed: completedEvents || 0,
        failed: failedEvents || 0,
        pending: pendingEvents || 0,
        errors: totalErrors || 0,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        successRate: totalEvents ? Math.round(((completedEvents || 0) / totalEvents) * 100) : 0,
      };
    },
  });
}

// Submit AI feedback
export function useSubmitAIFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, action, notes }: { eventId: string; action: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('ai_feedback').insert({
        event_id: eventId,
        user_id: user?.id,
        action,
        feedback_notes: notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-events'] });
      toast.success('Feedback submitted');
    },
  });
}
