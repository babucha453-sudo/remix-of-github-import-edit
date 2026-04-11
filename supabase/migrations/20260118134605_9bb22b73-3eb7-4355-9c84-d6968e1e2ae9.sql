-- Create progress tracking table for static page generation
CREATE TABLE IF NOT EXISTS public.static_page_generation_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_type text NOT NULL UNIQUE,
  current_offset integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'idle',
  last_error text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.static_page_generation_progress ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role can manage progress"
ON public.static_page_generation_progress
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert initial rows for each page type
INSERT INTO public.static_page_generation_progress (page_type) VALUES 
  ('state'),
  ('city'),
  ('service'),
  ('service_location'),
  ('clinic')
ON CONFLICT (page_type) DO NOTHING;

-- Add trigger to update updated_at
CREATE TRIGGER update_static_page_generation_progress_updated_at
BEFORE UPDATE ON public.static_page_generation_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();