-- US-ONLY DIRECTORY RESTRUCTURE (Fixed)
-- Add states table for US states and update location hierarchy

-- 1. Create states table for US states
CREATE TABLE IF NOT EXISTS public.states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL DEFAULT 'US',
  image_url TEXT,
  dentist_count INTEGER DEFAULT 0,
  clinic_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Add state_id column to cities table
ALTER TABLE public.cities 
ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.states(id);

ALTER TABLE public.cities 
ADD COLUMN IF NOT EXISTS abbreviation TEXT;

-- 3. Enable RLS on states
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for states
CREATE POLICY "Public read states" ON public.states
FOR SELECT USING (true);

CREATE POLICY "Admin write states" ON public.states
FOR ALL USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_states_slug ON public.states(slug);
CREATE INDEX IF NOT EXISTS idx_states_active ON public.states(is_active);
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON public.cities(state_id);

-- 6. Seed US States (California and Massachusetts)
INSERT INTO public.states (name, slug, abbreviation, country_code, is_active, display_order)
VALUES 
  ('California', 'california', 'CA', 'US', true, 1),
  ('Massachusetts', 'massachusetts', 'MA', 'US', true, 2)
ON CONFLICT (slug) DO NOTHING;

-- 7. Insert California cities (use DO block to handle duplicates gracefully)
DO $$
DECLARE
  ca_state_id UUID;
  ma_state_id UUID;
BEGIN
  -- Get state IDs
  SELECT id INTO ca_state_id FROM public.states WHERE slug = 'california';
  SELECT id INTO ma_state_id FROM public.states WHERE slug = 'massachusetts';
  
  -- California cities - insert or update
  INSERT INTO public.cities (name, slug, state_id, is_active, country)
  VALUES 
    ('Los Angeles', 'los-angeles', ca_state_id, true, 'US'),
    ('San Francisco', 'san-francisco', ca_state_id, true, 'US'),
    ('San Diego', 'san-diego', ca_state_id, true, 'US'),
    ('San Jose', 'san-jose', ca_state_id, true, 'US'),
    ('Sacramento', 'sacramento', ca_state_id, true, 'US'),
    ('Fresno', 'fresno', ca_state_id, true, 'US'),
    ('Oakland', 'oakland', ca_state_id, true, 'US'),
    ('Long Beach', 'long-beach', ca_state_id, true, 'US'),
    ('Anaheim', 'anaheim', ca_state_id, true, 'US'),
    ('Irvine', 'irvine', ca_state_id, true, 'US'),
    ('Santa Monica', 'santa-monica', ca_state_id, true, 'US'),
    ('Beverly Hills', 'beverly-hills', ca_state_id, true, 'US'),
    ('Pasadena', 'pasadena', ca_state_id, true, 'US'),
    ('Burbank', 'burbank', ca_state_id, true, 'US')
  ON CONFLICT DO NOTHING;
  
  -- Massachusetts cities - insert or update  
  INSERT INTO public.cities (name, slug, state_id, is_active, country)
  VALUES 
    ('Boston', 'boston', ma_state_id, true, 'US'),
    ('Cambridge', 'cambridge', ma_state_id, true, 'US'),
    ('Worcester', 'worcester', ma_state_id, true, 'US'),
    ('Springfield', 'springfield', ma_state_id, true, 'US'),
    ('Lowell', 'lowell', ma_state_id, true, 'US'),
    ('Quincy', 'quincy', ma_state_id, true, 'US'),
    ('Newton', 'newton', ma_state_id, true, 'US'),
    ('Somerville', 'somerville', ma_state_id, true, 'US'),
    ('Brookline', 'brookline', ma_state_id, true, 'US'),
    ('Salem', 'salem', ma_state_id, true, 'US')
  ON CONFLICT DO NOTHING;
END $$;

-- 8. Deactivate non-US data (UAE cities/areas) by setting is_active = false
UPDATE public.cities SET is_active = false WHERE state_id IS NULL;
UPDATE public.areas SET is_active = false WHERE city_id IN (
  SELECT id FROM public.cities WHERE state_id IS NULL
);

-- 9. Create trigger for updated_at on states
CREATE OR REPLACE TRIGGER update_states_updated_at
BEFORE UPDATE ON public.states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();