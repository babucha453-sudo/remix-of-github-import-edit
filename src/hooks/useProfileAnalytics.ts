import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format } from 'date-fns';

export interface AnalyticsSummary {
  totalViews: number;
  viewsTrend: number;
  totalClicks: number;
  clicksTrend: number;
  bookingStarts: number;
  bookingCompletes: number;
  conversionRate: number;
  calls: number;
  directions: number;
  websiteClicks: number;
  dailyViews: { date: string; views: number }[];
  eventBreakdown: { type: string; count: number }[];
}

export function useProfileAnalytics(clinicId?: string, days: number = 30) {
  return useQuery({
    queryKey: ['profile-analytics', clinicId, days],
    queryFn: async (): Promise<AnalyticsSummary> => {
      if (!clinicId) throw new Error('Clinic ID required');

      const startDate = subDays(new Date(), days);
      const previousStartDate = subDays(startDate, days);

      // Get current period analytics
      const { data: currentData, error } = await supabase
        .from('profile_analytics')
        .select('event_type, created_at')
        .eq('clinic_id', clinicId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get previous period for trend comparison
      const { data: previousData } = await supabase
        .from('profile_analytics')
        .select('event_type')
        .eq('clinic_id', clinicId)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      // Calculate metrics
      const events = currentData || [];
      const prevEvents = previousData || [];

      const countByType = (data: any[], type: string) => 
        data.filter(e => e.event_type === type).length;

      const currentViews = countByType(events, 'view');
      const previousViews = countByType(prevEvents, 'view');
      const viewsTrend = previousViews > 0 
        ? Math.round(((currentViews - previousViews) / previousViews) * 100) 
        : 0;

      const currentClicks = events.filter(e => 
        ['click', 'booking_start', 'call', 'direction', 'website'].includes(e.event_type)
      ).length;
      const previousClicks = prevEvents.filter(e => 
        ['click', 'booking_start', 'call', 'direction', 'website'].includes(e.event_type)
      ).length;
      const clicksTrend = previousClicks > 0 
        ? Math.round(((currentClicks - previousClicks) / previousClicks) * 100) 
        : 0;

      const bookingStarts = countByType(events, 'booking_start');
      const bookingCompletes = countByType(events, 'booking_complete');
      const conversionRate = bookingStarts > 0 
        ? Math.round((bookingCompletes / bookingStarts) * 100) 
        : 0;

      // Group views by day
      const viewsByDay = events
        .filter(e => e.event_type === 'view')
        .reduce((acc: Record<string, number>, event) => {
          const day = format(new Date(event.created_at), 'yyyy-MM-dd');
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {});

      const dailyViews = Array.from({ length: days }, (_, i) => {
        const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
        return { date, views: viewsByDay[date] || 0 };
      });

      // Event breakdown
      const eventCounts = events.reduce((acc: Record<string, number>, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {});

      const eventBreakdown = Object.entries(eventCounts).map(([type, count]) => ({
        type,
        count: count as number
      }));

      return {
        totalViews: currentViews,
        viewsTrend,
        totalClicks: currentClicks,
        clicksTrend,
        bookingStarts,
        bookingCompletes,
        conversionRate,
        calls: countByType(events, 'call'),
        directions: countByType(events, 'direction'),
        websiteClicks: countByType(events, 'website'),
        dailyViews,
        eventBreakdown
      };
    },
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Track a profile view/event
export async function trackProfileEvent(
  clinicId: string | undefined,
  dentistId: string | undefined,
  eventType: 'view' | 'click' | 'booking_start' | 'booking_complete' | 'call' | 'direction' | 'website',
  source?: string,
  metadata?: Record<string, any>
) {
  if (!clinicId && !dentistId) return;

  try {
    await supabase.functions.invoke('track-profile-view', {
      body: { clinicId, dentistId, eventType, source, metadata }
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}
