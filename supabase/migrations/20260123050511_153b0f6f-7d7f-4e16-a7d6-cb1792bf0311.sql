-- Add extended patient fields for document storage and additional details
ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS insurance_member_id TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_deleted_by_dentist BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS medical_notes TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT DEFAULT 'phone';

-- Add index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_patients_is_deleted ON public.patients(is_deleted_by_dentist);

-- Comment for documentation
COMMENT ON COLUMN public.patients.is_deleted_by_dentist IS 'Soft delete flag - patient hidden from dentist dashboard but retained for super admin';
COMMENT ON COLUMN public.patients.documents IS 'Array of document references [{name, url, type, uploaded_at}]';