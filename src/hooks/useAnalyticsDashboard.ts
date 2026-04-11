import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsSummary {
  totalVisitors: number;
  totalPageviews: number;
  totalEvents: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversionRate: number;
  topPages: Array<{ page: string; views: number; type: string }>;
  topCountries: Array<{ country: string; visitors: number }>;
  topCities: Array<{ city: string; visitors: number }>;
  deviceBreakdown: Array<{ device: string; count: number }>;
  browserBreakdown: Array<{ browser: string; count: number }>;
  sourceBreakdown: Array<{ source: string; visitors: number }>;
  hourlyVisitors: Array<{ hour: number; visitors: number }>;
  dailyVisitors: Array<{ date: string; visitors: number; pageviews: number }>;
  appointmentSources: Array<{ source: string; page: string; count: number }>;
  visitorJourneys: Array<{
    sessionId: string;
    patientName: string | null;
    pages: string[];
    converted: boolean;
    appointmentId: string | null;
  }>;
}

interface UseAnalyticsDashboardOptions {
  dateFrom?: string;
  dateTo?: string;
  clinicId?: string;
  pageType?: string;
  country?: string;
  city?: string;
}

export function useAnalyticsDashboard(options: UseAnalyticsDashboardOptions = {}) {
  const { dateFrom, dateTo, clinicId, pageType, country, city } = options;
  
  const defaultDateFrom = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const defaultDateTo = dateTo || new Date().toISOString();

  return useQuery({
    queryKey: ['analytics-dashboard', defaultDateFrom, defaultDateTo, clinicId, pageType, country, city],
    queryFn: async (): Promise<AnalyticsSummary> => {
      // Fetch visitor sessions
      let sessionsQuery = supabase
        .from('visitor_sessions')
        .select('*')
        .gte('created_at', defaultDateFrom)
        .lte('created_at', defaultDateTo)
        .eq('is_bot', false);

      if (country) sessionsQuery = sessionsQuery.eq('country', country);
      if (city) sessionsQuery = sessionsQuery.eq('city', city);

      const { data: sessions, error: sessionsError } = await sessionsQuery;
      if (sessionsError) throw sessionsError;

      // Fetch page views
      let pageViewsQuery = supabase
        .from('page_views')
        .select('*')
        .gte('created_at', defaultDateFrom)
        .lte('created_at', defaultDateTo);

      if (clinicId) pageViewsQuery = pageViewsQuery.eq('clinic_id', clinicId);
      if (pageType) pageViewsQuery = pageViewsQuery.eq('page_type', pageType);

      const { data: pageViews, error: pvError } = await pageViewsQuery;
      if (pvError) throw pvError;

      // Fetch events
      const { data: events, error: evError } = await supabase
        .from('visitor_events')
        .select('*')
        .gte('created_at', defaultDateFrom)
        .lte('created_at', defaultDateTo);
      if (evError) throw evError;

      // Fetch journeys
      const { data: journeys, error: jError } = await supabase
        .from('visitor_journeys')
        .select('*')
        .gte('created_at', defaultDateFrom)
        .lte('created_at', defaultDateTo);
      if (jError) throw jError;

      // Fetch appointments with source tracking
      const { data: appointments, error: aError } = await supabase
        .from('appointments')
        .select('id, source, booking_page_path, booking_session_id, patient_name, created_at')
        .gte('created_at', defaultDateFrom)
        .lte('created_at', defaultDateTo);
      if (aError) throw aError;

      const safeSession = sessions || [];
      const safePageViews = pageViews || [];
      const safeEvents = events || [];
      const safeJourneys = journeys || [];
      const safeAppointments = appointments || [];

      // Calculate metrics
      const totalVisitors = safeSession.length;
      const uniqueVisitors = new Set(safeSession.map(s => s.ip_hash)).size;
      const totalPageviews = safePageViews.length;
      const totalEvents = safeEvents.length;

      // Bounce rate (sessions with only 1 pageview)
      const sessionPageCounts = new Map<string, number>();
      safePageViews.forEach(pv => {
        const count = sessionPageCounts.get(pv.session_id) || 0;
        sessionPageCounts.set(pv.session_id, count + 1);
      });
      const bouncedSessions = Array.from(sessionPageCounts.values()).filter(c => c === 1).length;
      const bounceRate = sessionPageCounts.size > 0 ? (bouncedSessions / sessionPageCounts.size) * 100 : 0;

      // Avg session duration
      const durations = safeSession.map(s => s.session_duration_seconds || 0).filter(d => d > 0);
      const avgSessionDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;

      // Conversion rate
      const convertedSessions = safeSession.filter(s => s.linked_at).length;
      const conversionRate = totalVisitors > 0 ? (convertedSessions / totalVisitors) * 100 : 0;

      // Top pages
      const pageCounts = new Map<string, { views: number; type: string }>();
      safePageViews.forEach(pv => {
        const key = pv.page_path;
        const existing = pageCounts.get(key) || { views: 0, type: pv.page_type || 'other' };
        pageCounts.set(key, { views: existing.views + 1, type: existing.type });
      });
      const topPages = Array.from(pageCounts.entries())
        .map(([page, data]) => ({ page, views: data.views, type: data.type }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20);

      // Top countries
      const countryCounts = new Map<string, number>();
      safeSession.forEach(s => {
        if (s.country) {
          countryCounts.set(s.country, (countryCounts.get(s.country) || 0) + 1);
        }
      });
      const topCountries = Array.from(countryCounts.entries())
        .map(([country, visitors]) => ({ country, visitors }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);

      // Top cities
      const cityCounts = new Map<string, number>();
      safeSession.forEach(s => {
        if (s.city) {
          cityCounts.set(s.city, (cityCounts.get(s.city) || 0) + 1);
        }
      });
      const topCities = Array.from(cityCounts.entries())
        .map(([city, visitors]) => ({ city, visitors }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);

      // Device breakdown
      const deviceCounts = new Map<string, number>();
      safeSession.forEach(s => {
        const device = s.device_type || 'unknown';
        deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
      });
      const deviceBreakdown = Array.from(deviceCounts.entries())
        .map(([device, count]) => ({ device, count }));

      // Browser breakdown
      const browserCounts = new Map<string, number>();
      safeSession.forEach(s => {
        const browser = s.browser || 'unknown';
        browserCounts.set(browser, (browserCounts.get(browser) || 0) + 1);
      });
      const browserBreakdown = Array.from(browserCounts.entries())
        .map(([browser, count]) => ({ browser, count }));

      // Source breakdown (UTM + referrer)
      const sourceCounts = new Map<string, number>();
      safeSession.forEach(s => {
        const source = s.utm_source || (s.referrer ? new URL(s.referrer).hostname : 'direct');
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      });
      const sourceBreakdown = Array.from(sourceCounts.entries())
        .map(([source, visitors]) => ({ source, visitors }))
        .sort((a, b) => b.visitors - a.visitors);

      // Hourly visitors
      const hourCounts = new Map<number, number>();
      safeSession.forEach(s => {
        const hour = new Date(s.created_at).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });
      const hourlyVisitors = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        visitors: hourCounts.get(i) || 0,
      }));

      // Daily visitors
      const dailyCounts = new Map<string, { visitors: number; pageviews: number }>();
      safeSession.forEach(s => {
        const date = s.created_at.split('T')[0];
        const existing = dailyCounts.get(date) || { visitors: 0, pageviews: 0 };
        dailyCounts.set(date, { visitors: existing.visitors + 1, pageviews: existing.pageviews });
      });
      safePageViews.forEach(pv => {
        const date = pv.created_at.split('T')[0];
        const existing = dailyCounts.get(date) || { visitors: 0, pageviews: 0 };
        dailyCounts.set(date, { visitors: existing.visitors, pageviews: existing.pageviews + 1 });
      });
      const dailyVisitors = Array.from(dailyCounts.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Appointment sources
      const appointmentSourceCounts = new Map<string, number>();
      safeAppointments.forEach(a => {
        const key = `${a.source || 'website'}|${a.booking_page_path || '/'}`;
        appointmentSourceCounts.set(key, (appointmentSourceCounts.get(key) || 0) + 1);
      });
      const appointmentSources = Array.from(appointmentSourceCounts.entries())
        .map(([key, count]) => {
          const [source, page] = key.split('|');
          return { source, page, count };
        })
        .sort((a, b) => b.count - a.count);

      // Visitor journeys (group by session)
      const journeysBySession = new Map<string, {
        pages: string[];
        converted: boolean;
        appointmentId: string | null;
      }>();
      
      safeJourneys.forEach(j => {
        const existing = journeysBySession.get(j.session_id) || {
          pages: [],
          converted: false,
          appointmentId: null,
        };
        existing.pages.push(j.page_path);
        if (j.converted) {
          existing.converted = true;
          existing.appointmentId = j.appointment_id;
        }
        journeysBySession.set(j.session_id, existing);
      });

      const visitorJourneys = Array.from(journeysBySession.entries())
        .map(([sessionId, data]) => {
          const session = safeSession.find(s => s.session_id === sessionId);
          return {
            sessionId,
            patientName: session?.patient_name || null,
            pages: data.pages,
            converted: data.converted,
            appointmentId: data.appointmentId,
          };
        })
        .slice(0, 50);

      return {
        totalVisitors,
        totalPageviews,
        totalEvents,
        uniqueVisitors,
        bounceRate: Math.round(bounceRate * 10) / 10,
        avgSessionDuration: Math.round(avgSessionDuration),
        conversionRate: Math.round(conversionRate * 100) / 100,
        topPages,
        topCountries,
        topCities,
        deviceBreakdown,
        browserBreakdown,
        sourceBreakdown,
        hourlyVisitors,
        dailyVisitors,
        appointmentSources,
        visitorJourneys,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
