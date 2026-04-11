import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GeoExpansionStats {
  states: {
    total: number;
    live: number;
    draft: number;
    inactive: number;
  };
  cities: {
    total: number;
    live: number;
    draft: number;
    inactive: number;
  };
  queue: {
    pending: number;
    generated: number;
    published: number;
    failed: number;
  };
  recentChanges: any[];
}

export interface QueueItem {
  id: string;
  page_type: "state" | "city";
  entity_id: string;
  entity_slug: string;
  state_slug: string | null;
  status: string;
  triggered_by: string;
  triggered_by_user: string | null;
  triggered_by_clinic: string | null;
  priority: number;
  content_generated: any;
  ai_confidence_score: number | null;
  seo_validation_passed: boolean | null;
  seo_validation_errors: string[] | null;
  generation_attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeoExpansionSettings {
  auto_publish_enabled: boolean;
  auto_publish_threshold: number;
  max_daily_generations: number;
  content_min_words: number;
  content_max_words: number;
  require_admin_approval: boolean;
}

// Fetch expansion statistics
export function useGeoExpansionStats() {
  return useQuery({
    queryKey: ["geo-expansion-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "get_stats" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch stats");
      return data.data as GeoExpansionStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Fetch queue items
export function useGeoExpansionQueue(filters?: {
  status?: string;
  pageType?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["geo-expansion-queue", filters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "get_queue", filters },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch queue");
      return data.data as QueueItem[];
    },
    refetchInterval: 10000,
  });
}

// Fetch settings
export function useGeoExpansionSettings() {
  return useQuery({
    queryKey: ["geo-expansion-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "get_settings" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch settings");
      return data.data as GeoExpansionSettings;
    },
  });
}

// Enqueue a page for generation
export function useEnqueuePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
    }: {
      entityType: "state" | "city";
      entityId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "enqueue_page", entityType, entityId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to enqueue page");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-queue"] });
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-stats"] });
      toast.success("Page enqueued for generation");
    },
    onError: (error: any) => {
      toast.error(`Failed to enqueue: ${error.message}`);
    },
  });
}

// Generate content for a page
export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      queueId,
    }: {
      entityType: "state" | "city";
      entityId: string;
      queueId?: string;
    }) => {
      const action = entityType === "state" ? "generate_state_content" : "generate_city_content";
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action, entityId, queueId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to generate content");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-queue"] });
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-stats"] });
      toast.success("Content generated successfully");
    },
    onError: (error: any) => {
      toast.error(`Generation failed: ${error.message}`);
    },
  });
}

// Approve/publish a page
export function usePublishPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueId: string) => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "publish_page", queueId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to publish page");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-queue"] });
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
      toast.success("Page published successfully");
    },
    onError: (error: any) => {
      toast.error(`Publish failed: ${error.message}`);
    },
  });
}

// Reject a page
export function useRejectPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueId: string) => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "reject_page", queueId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to reject page");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-queue"] });
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-stats"] });
      toast.success("Page rejected");
    },
    onError: (error: any) => {
      toast.error(`Reject failed: ${error.message}`);
    },
  });
}

// Rollback a page
export function useRollbackPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seoPageId,
      versionId,
    }: {
      seoPageId: string;
      versionId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "rollback_page", entityId: seoPageId, queueId: versionId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to rollback page");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-queue"] });
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
      toast.success("Page rolled back successfully");
    },
    onError: (error: any) => {
      toast.error(`Rollback failed: ${error.message}`);
    },
  });
}

// Update settings
export function useUpdateGeoExpansionSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      settingKey,
      settingValue,
    }: {
      settingKey: string;
      settingValue: any;
    }) => {
      const { data, error } = await supabase.functions.invoke("geo-expansion", {
        body: { action: "update_settings", settingKey, settingValue },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to update settings");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-settings"] });
      toast.success("Settings updated");
    },
    onError: (error: any) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });
}

// Bulk generate content
export function useBulkGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityIds,
    }: {
      entityType: "state" | "city";
      entityIds: string[];
    }) => {
      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const entityId of entityIds) {
        try {
          // First enqueue
          const enqueueRes = await supabase.functions.invoke("geo-expansion", {
            body: { action: "enqueue_page", entityType, entityId },
          });

          if (!enqueueRes.data?.success) {
            results.push({ id: entityId, success: false, error: enqueueRes.data?.error });
            continue;
          }

          // Then generate
          const action = entityType === "state" ? "generate_state_content" : "generate_city_content";
          const genRes = await supabase.functions.invoke("geo-expansion", {
            body: { action, entityId, queueId: enqueueRes.data.queueId },
          });

          results.push({
            id: entityId,
            success: genRes.data?.success || false,
            error: genRes.data?.error,
          });
        } catch (error: any) {
          results.push({ id: entityId, success: false, error: error.message });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-queue"] });
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-stats"] });
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      if (failed > 0) {
        toast.warning(`Generated ${successful} pages, ${failed} failed`);
      } else {
        toast.success(`Generated ${successful} pages successfully`);
      }
    },
    onError: (error: any) => {
      toast.error(`Bulk generation failed: ${error.message}`);
    },
  });
}

// Bulk publish content
export function useBulkPublishContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueIds: string[]) => {
      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const queueId of queueIds) {
        try {
          const { data, error } = await supabase.functions.invoke("geo-expansion", {
            body: { action: "publish_page", queueId },
          });

          results.push({
            id: queueId,
            success: data?.success || false,
            error: error?.message || data?.error,
          });
        } catch (error: any) {
          results.push({ id: queueId, success: false, error: error.message });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-queue"] });
      queryClient.invalidateQueries({ queryKey: ["geo-expansion-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
      const successful = results.filter((r) => r.success).length;
      toast.success(`Published ${successful} pages`);
    },
    onError: (error: any) => {
      toast.error(`Bulk publish failed: ${error.message}`);
    },
  });
}
