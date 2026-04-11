-- Add claim_emails array column to clinics for storing multiple business emails
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS claim_emails text[] DEFAULT '{}';

-- Add index for efficient searching of claim emails
CREATE INDEX IF NOT EXISTS idx_clinics_claim_emails ON public.clinics USING GIN(claim_emails);

-- Create a function to merge unique emails into claim_emails array
CREATE OR REPLACE FUNCTION public.add_clinic_claim_emails(
  p_clinic_id uuid,
  p_emails text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE clinics
  SET 
    claim_emails = (
      SELECT ARRAY(SELECT DISTINCT unnest FROM unnest(claim_emails || p_emails) ORDER BY 1)
    ),
    updated_at = now()
  WHERE id = p_clinic_id;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN public.clinics.claim_emails IS 'Array of emails discovered from website scraping that can be used for claim verification';
