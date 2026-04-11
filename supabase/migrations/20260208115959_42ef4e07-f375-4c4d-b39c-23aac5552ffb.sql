-- Insert default analytics settings
INSERT INTO public.global_settings (key, value, description)
VALUES (
  'analytics_settings',
  '{"ga4_measurement_id": "", "enable_analytics": true}'::jsonb,
  'Google Analytics 4 configuration. Set ga4_measurement_id to your G-XXXXXXXXXX code.'
)
ON CONFLICT (key) DO NOTHING;