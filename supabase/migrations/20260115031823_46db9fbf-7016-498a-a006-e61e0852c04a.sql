-- Fix overly permissive admin RLS policies by requiring admin role checks
-- This provides defense-in-depth by enforcing role checks at the database level

-- 1. Drop and recreate clinic_automation_settings admin policy
DROP POLICY IF EXISTS "Admin all clinic_automation_settings" ON public.clinic_automation_settings;
CREATE POLICY "Admin all clinic_automation_settings" ON public.clinic_automation_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. Drop and recreate clinic_messages admin policy  
DROP POLICY IF EXISTS "Admin all clinic_messages" ON public.clinic_messages;
CREATE POLICY "Admin all clinic_messages" ON public.clinic_messages
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. Drop and recreate patients admin policy
DROP POLICY IF EXISTS "Admin all patients" ON public.patients;
CREATE POLICY "Admin all patients" ON public.patients
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Drop and recreate seo_pages admin policy
DROP POLICY IF EXISTS "Admin all seo_pages" ON public.seo_pages;
CREATE POLICY "Admin all seo_pages" ON public.seo_pages
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Drop and recreate seo_tasks admin policy
DROP POLICY IF EXISTS "Admin all seo_tasks" ON public.seo_tasks;
CREATE POLICY "Admin all seo_tasks" ON public.seo_tasks
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Create a rate limiting table for AI assistant requests
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  identifier_type text NOT NULL CHECK (identifier_type IN ('ip', 'session', 'visitor')),
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_lookup 
  ON public.ai_rate_limits (identifier, identifier_type, window_start);

-- RLS for rate limits table - allow anonymous inserts/updates for tracking
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert rate limits" ON public.ai_rate_limits
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update rate limits" ON public.ai_rate_limits
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow select rate limits" ON public.ai_rate_limits
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin can delete rate limit records
CREATE POLICY "Admin delete rate limits" ON public.ai_rate_limits
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  p_identifier text,
  p_identifier_type text,
  p_max_requests integer DEFAULT 30,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamp with time zone;
  v_current_count integer;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- Get current request count in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM public.ai_rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND window_start >= v_window_start;
  
  -- Check if over limit
  IF v_current_count >= p_max_requests THEN
    RETURN false;
  END IF;
  
  -- Record this request
  INSERT INTO public.ai_rate_limits (identifier, identifier_type, request_count, window_start)
  VALUES (p_identifier, p_identifier_type, 1, date_trunc('minute', now()))
  ON CONFLICT DO NOTHING;
  
  -- Update count if record exists
  UPDATE public.ai_rate_limits
  SET request_count = request_count + 1
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND window_start = date_trunc('minute', now());
  
  RETURN true;
END;
$$;

-- Create function to clean up old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;