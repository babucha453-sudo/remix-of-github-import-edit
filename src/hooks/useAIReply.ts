import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerateReplyParams {
  review_id: string;
  review_type: "google" | "internal";
  author_name: string;
  rating: number;
  text_content: string;
  clinic_name?: string;
}

interface CategorizeParams {
  type: "support_ticket" | "lead" | "review_sentiment";
  content: string;
  entity_id?: string;
}

export function useGenerateAIReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateReplyParams) => {
      const { data, error } = await supabase.functions.invoke("generate-ai-reply", {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to generate AI reply");

      return data;
    },
    onSuccess: (data) => {
      toast.success("AI reply generated successfully");
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["google-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["internal-reviews"] });
    },
    onError: (error: Error) => {
      if (error.message.includes("Rate limits")) {
        toast.error("AI rate limits exceeded. Please try again later.");
      } else if (error.message.includes("credits")) {
        toast.error("AI credits required. Please top up in workspace settings.");
      } else {
        toast.error(`Failed to generate AI reply: ${error.message}`);
      }
    },
  });
}

export function useAICategorize() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CategorizeParams) => {
      const { data, error } = await supabase.functions.invoke("ai-categorize", {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to categorize");

      return data;
    },
    onSuccess: (data) => {
      toast.success("AI analysis complete");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: Error) => {
      if (error.message.includes("Rate limits")) {
        toast.error("AI rate limits exceeded. Please try again later.");
      } else if (error.message.includes("credits")) {
        toast.error("AI credits required. Please top up in workspace settings.");
      } else {
        toast.error(`AI analysis failed: ${error.message}`);
      }
    },
  });
}

export function useTestAI() {
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("test-api", {
        body: { api: "gemini" },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`,
        } : undefined,
      });

      if (error) throw error;
      return data;
    },
  });
}
