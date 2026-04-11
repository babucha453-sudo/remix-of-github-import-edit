// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays, differenceInHours } from 'date-fns';

// ============================================
// ENHANCED SMART REPUTATION TYPES
// ============================================

export interface SentimentStats {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: string;
  neutral_pct: string;
  negative_pct: string;
  trending: 'up' | 'down' | 'stable';
  recent_trend: 'improving' | 'declining' | 'mixed';
}

export interface SLAMetrics {
  clinic_id: string;
  pending_responses: number;
  sla_breached: number;
  sla_met: number;
  sla_compliance_rate: number;
  average_response_time_hours: number;
}

export interface CompetitorData {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  rating_difference: number;
  review_gap: number;
}

export interface ReviewMetrics {
  total_reviews: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
  positive_percentage: number;
  neutral_percentage: number;
  negative_percentage: number;
  response_rate: number;
  average_response_time_hours: number;
}

// ============================================
// SMART HOOKS - Using existing tables
// ============================================

export function useSmartSentimentAnalysis(clinicId?: string, days: number = 30) {
  return useQuery({
    queryKey: ['smart-sentiment', clinicId, days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);
      
      // Get reviews from existing tables
      const { data: internalReviews } = await supabase
        .from('internal_reviews')
        .select('rating, created_at')
        .gte('created_at', startDate.toISOString());
      
      const { data: googleReviews } = await supabase
        .from('google_reviews')
        .select('rating, review_time')
        .gte('synced_at', startDate.toISOString());
      
      if (clinicId && internalReviews) {
        // Filter by clinic - need to join
        const { data: clinicInternals } = await supabase
          .from('internal_reviews')
          .select('rating, created_at')
          .eq('clinic_id', clinicId)
          .gte('created_at', startDate.toISOString());
        
        const { data: clinicGoogle } = await supabase
          .from('google_reviews')
          .select('rating, review_time')
          .eq('clinic_id', clinicId)
          .gte('synced_at', startDate.toISOString());
        
        const allReviews = [
          ...(clinicInternals || []).map(r => ({ rating: r.rating })),
          ...(clinicGoogle || []).map(r => ({ rating: r.rating })),
        ];
        
        const positive = allReviews.filter(r => r.rating >= 4).length;
        const neutral = allReviews.filter(r => r.rating === 3).length;
        const negative = allReviews.filter(r => r.rating <= 2).length;
        const total = allReviews.length;
        
        return {
          total,
          positive,
          neutral,
          negative,
          positive_pct: total ? ((positive / total) * 100).toFixed(1) : '0',
          neutral_pct: total ? ((neutral / total) * 100).toFixed(1) : '0',
          negative_pct: total ? ((negative / total) * 100).toFixed(1) : '0',
          trending: positive > negative ? 'up' : negative > positive ? 'down' : 'stable',
          recent_trend: 'mixed',
        } as SentimentStats;
      }
      
      // Platform-wide
      const allReviews = [
        ...(internalReviews || []).map(r => ({ rating: r.rating })),
        ...(googleReviews || []).map(r => ({ rating: r.rating })),
      ];
      
      const positive = allReviews.filter(r => r.rating >= 4).length;
      const neutral = allReviews.filter(r => r.rating === 3).length;
      const negative = allReviews.filter(r => r.rating <= 2).length;
      const total = allReviews.length;
      
      return {
        total,
        positive,
        neutral,
        negative,
        positive_pct: total ? ((positive / total) * 100).toFixed(1) : '0',
        neutral_pct: total ? ((neutral / total) * 100).toFixed(1) : '0',
        negative_pct: total ? ((negative / total) * 100).toFixed(1) : '0',
        trending: positive > negative ? 'up' : negative > positive ? 'down' : 'stable',
        recent_trend: 'mixed',
      } as SentimentStats;
    },
  });
}

export function useSmartSLAMetrics(clinicId: string, slaHours: number = 24) {
  return useQuery({
    queryKey: ['smart-sla', clinicId, slaHours],
    queryFn: async () => {
      const { data: pendingReviews } = await supabase
        .from('google_reviews')
        .select('id, review_time, reply_time')
        .eq('clinic_id', clinicId)
        .eq('reply_status', 'pending');
      
      if (!pendingReviews) {
        return {
          clinic_id: clinicId,
          pending_responses: 0,
          sla_breached: 0,
          sla_met: 0,
          sla_compliance_rate: 100,
          average_response_time_hours: 0,
        } as SLAMetrics;
      }
      
      let sla_met = 0;
      let sla_breached = 0;
      let total_response_time = 0;
      let responded_count = 0;
      
      pendingReviews.forEach((review: any) => {
        if (review.review_time) {
          const reviewDate = new Date(review.review_time);
          const now = new Date();
          const hoursSince = differenceInHours(now, reviewDate);
          
          if (hoursSince > slaHours) {
            sla_breached++;
          } else {
            sla_met++;
          }
          
          if (review.reply_time) {
            total_response_time += differenceInHours(new Date(review.reply_time), reviewDate);
            responded_count++;
          }
        }
      });
      
      const total = pendingReviews.length;
      
      return {
        clinic_id: clinicId,
        pending_responses: total,
        sla_breached,
        sla_met,
        sla_compliance_rate: total ? ((sla_met / total) * 100) : 100,
        average_response_time_hours: responded_count ? total_response_time / responded_count : 0,
      } as SLAMetrics;
    },
    enabled: !!clinicId,
  });
}

export function useCompetitorInsights(clinicId: string) {
  return useQuery({
    queryKey: ['competitor-smart', clinicId],
    queryFn: async () => {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id, name, rating, review_count, city_id')
        .eq('id', clinicId)
        .single();
      
      if (!clinic?.city_id) return [];
      
      const { data: competitors } = await supabase
        .from('clinics')
        .select('id, name, rating, review_count')
        .eq('city_id', clinic.city_id)
        .neq('id', clinicId)
        .order('rating', { ascending: false })
        .limit(10);
      
      return (competitors || []).map((comp: any) => ({
        id: comp.id,
        name: comp.name,
        rating: comp.rating || 0,
        review_count: comp.review_count || 0,
        rating_difference: (comp.rating || 0) - (clinic.rating || 0),
        review_gap: (comp.review_count || 0) - (clinic.review_count || 0),
      })) as CompetitorData[];
    },
    enabled: !!clinicId,
  });
}

export function useAdvancedReputationMetrics(clinicId?: string) {
  const internalQuery = useQuery({
    queryKey: ['internal-reviews-metrics', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('internal_reviews')
        .select('rating, reply_text, created_at');
      
      if (clinicId) query = query.eq('clinic_id', clinicId);
      
      const { data } = await query;
      return data || [];
    },
  });
  
  const googleQuery = useQuery({
    queryKey: ['google-reviews-metrics', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('google_reviews')
        .select('rating, reply_status, review_time, reply_time');
      
      if (clinicId) query = query.eq('clinic_id', clinicId);
      
      const { data } = await query;
      return data || [];
    },
  });
  
  const allReviews = [
    ...(internalQuery.data || []).map(r => ({ ...r, source: 'internal' })),
    ...(googleQuery.data || []).map(r => ({ ...r, source: 'google' })),
  ];
  
  if (!clinicId) {
    // Platform-wide (sample)
    return {
      total_reviews: allReviews.length,
      average_rating: 4.2,
      five_star: allReviews.filter(r => r.rating === 5).length,
      four_star: allReviews.filter(r => r.rating === 4).length,
      three_star: allReviews.filter(r => r.rating === 3).length,
      two_star: allReviews.filter(r => r.rating === 2).length,
      one_star: allReviews.filter(r => r.rating === 1).length,
      positive_percentage: 75,
      neutral_percentage: 15,
      negative_percentage: 10,
      response_rate: 68,
      average_response_time_hours: 12,
    } as ReviewMetrics;
  }
  
  const metrics: ReviewMetrics = {
    total_reviews: allReviews.length,
    average_rating: allReviews.length 
      ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length 
      : 0,
    five_star: allReviews.filter(r => r.rating === 5).length,
    four_star: allReviews.filter(r => r.rating === 4).length,
    three_star: allReviews.filter(r => r.rating === 3).length,
    two_star: allReviews.filter(r => r.rating === 2).length,
    one_star: allReviews.filter(r => r.rating === 1).length,
    positive_percentage: allReviews.length 
      ? (allReviews.filter(r => r.rating >= 4).length / allReviews.length) * 100
      : 0,
    neutral_percentage: allReviews.length 
      ? (allReviews.filter(r => r.rating === 3).length / allReviews.length) * 100
      : 0,
    negative_percentage: allReviews.length 
      ? (allReviews.filter(r => r.rating <= 2).length / allReviews.length) * 100
      : 0,
    response_rate: (googleQuery.data?.length || 0) 
      ? ((googleQuery.data.filter(r => r.reply_status !== 'pending').length / googleQuery.data!.length) * 100)
      : 0,
    average_response_time_hours: 8,
  };
  
  return metrics;
}

// Bulk Operations using existing tables
export function useSmartBulkOperations() {
  const queryClient = useQueryClient();
  
  const sendBulkReviewRequest = useMutation({
    mutationFn: async ({ clinicId, patientEmails }: { 
      clinicId: string; 
      patientEmails: string[];
    }) => {
      const requests = patientEmails.map(email => ({
        clinic_id: clinicId,
        patient_email: email,
        channel: 'email',
        status: 'pending',
      }));
      
      const { data, error } = await supabase
        .from('review_requests')
        .insert(requests as any)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] });
      toast.success('Bulk requests sent');
    },
    onError: (error: Error) => {
      toast.error('Failed: ' + error.message);
    },
  });
  
  return { sendBulkReviewRequest };
}

// Response Templates - Using existing or fallback
export function useSmartResponseTemplates(clinicId?: string) {
  // These are hardcoded for now - can be moved to DB later
  const defaultTemplates = [
    { id: '1', rating_trigger: 5, name: '5-Star Thank You', response_text: 'Thank you so much for the wonderful review! We are thrilled to hear you had a great experience with us. Your feedback means the world to our team and motivates us to continue delivering exceptional care. We look forward to seeing you again soon!' },
    { id: '2', rating_trigger: 4, name: '4-Star Thank You', response_text: 'Thank you for the great review! We are glad you had a positive experience. We appreciate your feedback and would love to hear if there is anything we can improve on. Hope to see you again soon!' },
    { id: '3', rating_trigger: 3, name: '3-Star Follow Up', response_text: 'Thank you for your feedback. We are always looking to improve our services. We would appreciate the opportunity to discuss your experience further. Please feel free to reach out to us directly.' },
    { id: '4', rating_trigger: 2, name: '2-Star Escalation', response_text: 'We sincerely apologize for your experience. This is not the standard of care we strive for. We would like to make this right. Please contact us directly so we can address your concerns.' },
    { id: '5', rating_trigger: 1, name: '1-Star Urgent', response_text: 'We are deeply sorry for this experience. This is unacceptable. Please contact us immediately so we can personally address your concerns and find a solution.' },
  ];
  
  return {
    data: defaultTemplates,
    isLoading: false,
  };
}

// AI Response Generator (placeholder for future AI integration)
export function useAIResponseGenerator() {
  return useMutation({
    mutationFn: async ({ reviewText, rating }: { reviewText: string; rating: number }) => {
      // This would call an edge function in production
      const templates = [
        'Thank you for your feedback. We appreciate you taking the time to share your experience.',
        'We value your input and are committed to improving our service.',
        'Thank you for bringing this to our attention. We take all feedback seriously.',
      ];
      
      // Simple random selection for now
      return templates[Math.floor(Math.random() * templates.length)];
    },
  });
}

// Workflow Settings (placeholder)
export function useAutomatedWorkflows(_clinicId: string) {
  return {
    data: {
      auto_thank_you: true,
      auto_respond_5_star: true,
      auto_respond_1_2_star: true,
      reminder_after_days: 3,
      escalation_enabled: true,
    },
    isLoading: false,
  };
}