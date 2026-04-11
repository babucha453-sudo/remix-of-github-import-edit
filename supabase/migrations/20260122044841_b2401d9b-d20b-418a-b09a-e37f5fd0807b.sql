-- Fix GMB importer failing with PGRST204: missing gmb_data column on public.clinics
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS gmb_data jsonb;

-- Performance: speed up duplicate checks during imports
CREATE INDEX IF NOT EXISTS idx_clinics_google_place_id
ON public.clinics (google_place_id);