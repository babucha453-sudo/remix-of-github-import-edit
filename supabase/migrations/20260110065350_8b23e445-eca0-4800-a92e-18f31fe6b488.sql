-- Create a table to persist GMB scraper search results
CREATE TABLE public.gmb_scraper_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id),
  state_name TEXT,
  city_ids UUID[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'cancelled')),
  total_found INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table to store individual search results
CREATE TABLE public.gmb_scraper_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.gmb_scraper_sessions(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  rating NUMERIC,
  reviews_count INTEGER,
  lat NUMERIC,
  lng NUMERIC,
  city_id UUID REFERENCES public.cities(id),
  city_name TEXT,
  category TEXT,
  import_status TEXT DEFAULT 'pending' CHECK (import_status IN ('pending', 'importing', 'imported', 'duplicate', 'error')),
  error_message TEXT,
  clinic_id UUID REFERENCES public.clinics(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, place_id)
);

-- Enable RLS
ALTER TABLE public.gmb_scraper_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmb_scraper_results ENABLE ROW LEVEL SECURITY;

-- Policies for sessions - admins only
CREATE POLICY "Admins can view sessions"
ON public.gmb_scraper_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can create sessions"
ON public.gmb_scraper_sessions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can update sessions"
ON public.gmb_scraper_sessions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

-- Policies for results - admins only
CREATE POLICY "Admins can view results"
ON public.gmb_scraper_results FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can create results"
ON public.gmb_scraper_results FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can update results"
ON public.gmb_scraper_results FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can delete results"
ON public.gmb_scraper_results FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

-- Indexes for performance
CREATE INDEX idx_gmb_scraper_results_session ON public.gmb_scraper_results(session_id);
CREATE INDEX idx_gmb_scraper_results_status ON public.gmb_scraper_results(import_status);
CREATE INDEX idx_gmb_scraper_sessions_user ON public.gmb_scraper_sessions(user_id);
CREATE INDEX idx_gmb_scraper_sessions_status ON public.gmb_scraper_sessions(status);

-- Trigger to update updated_at
CREATE TRIGGER update_gmb_scraper_sessions_updated_at
BEFORE UPDATE ON public.gmb_scraper_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();