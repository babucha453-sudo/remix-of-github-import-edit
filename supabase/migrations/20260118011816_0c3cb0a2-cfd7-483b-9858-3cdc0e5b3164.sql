-- Create visitor_sessions table for tracking anonymous visitors
CREATE TABLE public.visitor_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  visitor_fingerprint TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_bot BOOLEAN DEFAULT false,
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  linked_at TIMESTAMP WITH TIME ZONE,
  total_pageviews INTEGER DEFAULT 0,
  total_events INTEGER DEFAULT 0,
  session_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create page_views table for detailed page tracking
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  visitor_session_id UUID REFERENCES public.visitor_sessions(id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  page_title TEXT,
  page_type TEXT,
  clinic_id UUID REFERENCES public.clinics(id),
  dentist_id UUID REFERENCES public.dentists(id),
  city_slug TEXT,
  state_slug TEXT,
  treatment_slug TEXT,
  referrer TEXT,
  time_on_page_seconds INTEGER,
  scroll_depth_percent INTEGER,
  exit_page BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create visitor_events table for detailed behavior tracking
CREATE TABLE public.visitor_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  visitor_session_id UUID REFERENCES public.visitor_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT,
  page_path TEXT,
  element_id TEXT,
  element_class TEXT,
  element_text TEXT,
  clinic_id UUID REFERENCES public.clinics(id),
  dentist_id UUID REFERENCES public.dentists(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create visitor_journeys table to track conversion funnels
CREATE TABLE public.visitor_journeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  visitor_session_id UUID REFERENCES public.visitor_sessions(id) ON DELETE CASCADE,
  journey_stage TEXT NOT NULL,
  page_path TEXT NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id),
  dentist_id UUID REFERENCES public.dentists(id),
  step_number INTEGER NOT NULL,
  time_at_step TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  converted BOOLEAN DEFAULT false,
  appointment_id UUID REFERENCES public.appointments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add booking_page_path to appointments to track source page
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS booking_page_path TEXT,
ADD COLUMN IF NOT EXISTS booking_session_id TEXT,
ADD COLUMN IF NOT EXISTS visitor_session_id UUID REFERENCES public.visitor_sessions(id);

-- Create indexes for performance
CREATE INDEX idx_visitor_sessions_session_id ON public.visitor_sessions(session_id);
CREATE INDEX idx_visitor_sessions_created_at ON public.visitor_sessions(created_at);
CREATE INDEX idx_visitor_sessions_country ON public.visitor_sessions(country);
CREATE INDEX idx_visitor_sessions_city ON public.visitor_sessions(city);
CREATE INDEX idx_page_views_session_id ON public.page_views(session_id);
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at);
CREATE INDEX idx_page_views_page_path ON public.page_views(page_path);
CREATE INDEX idx_page_views_page_type ON public.page_views(page_type);
CREATE INDEX idx_page_views_clinic_id ON public.page_views(clinic_id);
CREATE INDEX idx_visitor_events_session_id ON public.visitor_events(session_id);
CREATE INDEX idx_visitor_events_event_type ON public.visitor_events(event_type);
CREATE INDEX idx_visitor_events_created_at ON public.visitor_events(created_at);
CREATE INDEX idx_visitor_journeys_session_id ON public.visitor_journeys(session_id);
CREATE INDEX idx_appointments_booking_session ON public.appointments(booking_session_id);

-- Enable RLS
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_journeys ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin read access
CREATE POLICY "Admins can view all visitor sessions"
ON public.visitor_sessions FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all page views"
ON public.page_views FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all visitor events"
ON public.visitor_events FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all visitor journeys"
ON public.visitor_journeys FOR SELECT
USING (public.is_admin(auth.uid()));

-- Service role insert (for edge functions)
CREATE POLICY "Service can insert visitor sessions"
ON public.visitor_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can insert page views"
ON public.page_views FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can insert visitor events"
ON public.visitor_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can insert visitor journeys"
ON public.visitor_journeys FOR INSERT
WITH CHECK (true);

-- Service role update for visitor sessions
CREATE POLICY "Service can update visitor sessions"
ON public.visitor_sessions FOR UPDATE
USING (true);

-- Clinic owners can view analytics for their clinics
CREATE POLICY "Clinic owners can view page views for their clinics"
ON public.page_views FOR SELECT
USING (
  clinic_id IN (
    SELECT id FROM public.clinics WHERE claimed_by = auth.uid()
  )
);

CREATE POLICY "Clinic owners can view visitor events for their clinics"
ON public.visitor_events FOR SELECT
USING (
  clinic_id IN (
    SELECT id FROM public.clinics WHERE claimed_by = auth.uid()
  )
);