/**
 * AnalyticsProvider - Wrapper component for analytics initialization
 * 
 * Fetches GA4 measurement ID from settings and initializes tracking.
 * Also provides analytics context for the app.
 */

import { useEffect, useState } from 'react';
import { GoogleAnalytics } from './GoogleAnalytics';
import { supabase } from '@/integrations/supabase/client';

interface GoogleAnalyticsSettings {
  measurement_id?: string;
  gtm_id?: string;
  enabled?: boolean;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [measurementId, setMeasurementId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch GA4 settings from global_settings (key: google_analytics)
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'google_analytics')
          .single();

        if (error) {
          console.debug('[Analytics] No google_analytics settings found in DB');
          return;
        }

        const settings = data?.value as GoogleAnalyticsSettings;
        if (settings?.enabled !== false && settings?.measurement_id) {
          setMeasurementId(settings.measurement_id);
          console.log('[Analytics] Loaded measurement ID from settings');
        }
      } catch (err) {
        console.error('[Analytics] Error fetching settings:', err);
      }
    };

    fetchSettings();
  }, []);

  return (
    <>
      {measurementId && <GoogleAnalytics measurementId={measurementId} />}
      {children}
    </>
  );
}

export default AnalyticsProvider;
