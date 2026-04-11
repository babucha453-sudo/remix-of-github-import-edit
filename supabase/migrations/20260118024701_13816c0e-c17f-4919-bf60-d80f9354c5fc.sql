-- Create the increment_session_pageviews function for visitor tracking
CREATE OR REPLACE FUNCTION public.increment_session_pageviews(p_session_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.visitor_sessions
  SET 
    total_pageviews = COALESCE(total_pageviews, 0) + 1,
    last_seen_at = NOW()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.increment_session_pageviews(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_session_pageviews(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_session_pageviews(TEXT) TO service_role;