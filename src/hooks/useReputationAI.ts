import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SentimentAnalysis {
  sentiment_score: number;
  sentiment_label: 'positive' | 'neutral' | 'negative';
  hipaa_flagged: boolean;
  hipaa_flag_reason: string | null;
  summary?: string;
  key_themes?: string[];
  recommended_action?: string;
}

export function useAnalyzeFeedback(feedbackId: string | null | undefined) {
  return useQuery({
    queryKey: ['feedback-sentiment', feedbackId],
    queryFn: async (): Promise<SentimentAnalysis | null> => {
      if (!feedbackId) return null;

      const { data: feedback } = await supabase
        .from('review_funnel_events')
        .select('id, comment, rating')
        .eq('id', feedbackId)
        .single();

      if (!feedback?.comment) return null;

      try {
        const response = await supabase.functions.invoke('analyze-review-sentiment', {
          body: {
            reviewId: feedback.id,
            reviewType: 'internal',
            content: feedback.comment,
          },
        });

        if (response.data) {
          return response.data as SentimentAnalysis;
        }
        return null;
      } catch (error) {
        console.error('Error analyzing sentiment:', error);
        return null;
      }
    },
    enabled: !!feedbackId,
    staleTime: 300000,
  });
}

export function useBatchAnalyzeFeedback(clinicId: string | null | undefined) {
  const analyzeMutation = useMutation({
    mutationFn: async (): Promise<SentimentAnalysis[]> => {
      if (!clinicId) throw new Error('No clinic ID');

      const { data: feedbackEvents } = await supabase
        .from('review_funnel_events')
        .select('id, comment, rating, created_at')
        .eq('clinic_id', clinicId)
        .eq('event_type', 'thumbs_down')
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!feedbackEvents || feedbackEvents.length === 0) return [];

      const results: SentimentAnalysis[] = [];

      for (const event of feedbackEvents) {
        try {
          const response = await supabase.functions.invoke('analyze-review-sentiment', {
            body: {
              reviewId: event.id,
              reviewType: 'internal',
              content: event.comment || '',
            },
          });

          if (response.data) {
            results.push({
              ...response.data,
              feedbackId: event.id,
            } as SentimentAnalysis);
          }
        } catch (error) {
          console.error('Error analyzing feedback:', event.id, error);
        }
      }

      return results;
    },
  });

  return analyzeMutation;
}

export function useAIReputationInsights(clinicId: string | null | undefined) {
  return useQuery({
    queryKey: ['ai-reputation-insights', clinicId],
    queryFn: async () => {
      if (!clinicId) return null;

      const { data: feedbackEvents } = await supabase
        .from('review_funnel_events')
        .select('id, comment, rating, created_at, visitor_name')
        .eq('clinic_id', clinicId)
        .eq('event_type', 'thumbs_down')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!feedbackEvents || feedbackEvents.length === 0) return null;

      const pendingFeedback = feedbackEvents.filter(f => f.comment);
      if (pendingFeedback.length === 0) return null;

      const commentsText = pendingFeedback
        .map((f, i) => `${i + 1}. [Rating: ${f.rating || 'N/A'}] ${f.comment}`)
        .join('\n\n');

      try {
        const AIMLAPI_KEY = 'demo-key';
        const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIMLAPI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemini-2.0-flash',
            messages: [
              {
                role: 'system',
                content: `You are a dental practice reputation analyst. Analyze the following negative feedback from dental patients and provide:
1. A summary of the main issues (in 2-3 sentences)
2. Key themes/problems (list 3-5 themes)
3. Recommended actions to improve (3-5 specific actions)

Respond ONLY in JSON format:
{
  "summary": "...",
  "themes": ["theme1", "theme2", "theme3"],
  "recommendations": ["action1", "action2", "action3"],
  "severity": "high|medium|low",
  "priority_patients": ["patient names if available"]
}`
              },
              {
                role: 'user',
                content: `Analyze these patient feedback comments:\n\n${commentsText}`
              }
            ],
            temperature: 0.3,
          }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (content) {
          try {
            return JSON.parse(content);
          } catch {
            return { summary: content };
          }
        }
        return null;
      } catch (error) {
        console.error('AI insights error:', error);
        return null;
      }
    },
    enabled: !!clinicId,
    staleTime: 600000,
  });
}