-- Create AI Search logs table for analytics
CREATE TABLE public.ai_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  original_query TEXT NOT NULL,
  extracted_intent JSONB,
  results_shown JSONB,
  results_count INTEGER DEFAULT 0,
  clicked_result_id UUID,
  clicked_result_type TEXT,
  search_duration_ms INTEGER,
  fallback_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create AI Search settings table for admin controls
CREATE TABLE public.ai_search_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_search_settings ENABLE ROW LEVEL SECURITY;

-- RLS for search logs - admins can view, system can insert
CREATE POLICY "Admins can view search logs"
ON public.ai_search_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert search logs"
ON public.ai_search_logs
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- RLS for settings - admins only
CREATE POLICY "Admins can manage search settings"
ON public.ai_search_settings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Insert default settings
INSERT INTO public.ai_search_settings (setting_key, setting_value) VALUES
('ai_search_enabled', '{"enabled": true}'::jsonb),
('ranking_weights', '{"service_match": 0.25, "budget_fit": 0.20, "location_proximity": 0.20, "rating": 0.15, "profile_completeness": 0.10, "paid_bonus": 0.10}'::jsonb),
('paid_priority_enabled', '{"enabled": true}'::jsonb);

-- Create indexes for performance
CREATE INDEX idx_ai_search_logs_created_at ON public.ai_search_logs(created_at DESC);
CREATE INDEX idx_ai_search_logs_session ON public.ai_search_logs(session_id);
CREATE INDEX idx_ai_search_settings_key ON public.ai_search_settings(setting_key);