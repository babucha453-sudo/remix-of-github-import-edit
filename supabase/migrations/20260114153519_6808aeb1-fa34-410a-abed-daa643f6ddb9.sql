-- SECURITY FIX: Create separate secure table for GMB OAuth tokens
-- This addresses the critical issue of OAuth tokens being exposed in the public clinics table

-- 1. Create a secure table for clinic OAuth tokens
CREATE TABLE public.clinic_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  gmb_access_token text,
  gmb_refresh_token text,
  gmb_account_email text,
  gmb_account_id text,
  gmb_location_id text,
  gmb_connected boolean DEFAULT false,
  gmb_last_sync_at timestamp with time zone,
  gmb_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS on the new table
ALTER TABLE public.clinic_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Create strict RLS policies - only clinic owners and admins can access
CREATE POLICY "Clinic owners can view their own oauth tokens"
ON public.clinic_oauth_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clinics c 
    WHERE c.id = clinic_oauth_tokens.clinic_id 
    AND c.claimed_by = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Clinic owners can update their own oauth tokens"
ON public.clinic_oauth_tokens
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clinics c 
    WHERE c.id = clinic_oauth_tokens.clinic_id 
    AND c.claimed_by = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Clinic owners can insert their own oauth tokens"
ON public.clinic_oauth_tokens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clinics c 
    WHERE c.id = clinic_oauth_tokens.clinic_id 
    AND c.claimed_by = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Clinic owners can delete their own oauth tokens"
ON public.clinic_oauth_tokens
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clinics c 
    WHERE c.id = clinic_oauth_tokens.clinic_id 
    AND c.claimed_by = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

-- 4. Migrate existing tokens to the new secure table
INSERT INTO public.clinic_oauth_tokens (
  clinic_id, gmb_access_token, gmb_refresh_token, gmb_account_email,
  gmb_account_id, gmb_location_id, gmb_connected, gmb_last_sync_at, gmb_data
)
SELECT 
  id, gmb_access_token, gmb_refresh_token, gmb_account_email,
  gmb_account_id, gmb_location_id, gmb_connected, gmb_last_sync_at, gmb_data
FROM public.clinics
WHERE gmb_access_token IS NOT NULL OR gmb_refresh_token IS NOT NULL OR gmb_connected = true
ON CONFLICT (clinic_id) DO UPDATE SET
  gmb_access_token = EXCLUDED.gmb_access_token,
  gmb_refresh_token = EXCLUDED.gmb_refresh_token,
  gmb_account_email = EXCLUDED.gmb_account_email,
  gmb_account_id = EXCLUDED.gmb_account_id,
  gmb_location_id = EXCLUDED.gmb_location_id,
  gmb_connected = EXCLUDED.gmb_connected,
  gmb_last_sync_at = EXCLUDED.gmb_last_sync_at,
  gmb_data = EXCLUDED.gmb_data;

-- 5. Remove sensitive token columns from clinics table (keep gmb_connected for backward compatibility)
ALTER TABLE public.clinics DROP COLUMN IF EXISTS gmb_access_token;
ALTER TABLE public.clinics DROP COLUMN IF EXISTS gmb_refresh_token;
ALTER TABLE public.clinics DROP COLUMN IF EXISTS gmb_account_email;
ALTER TABLE public.clinics DROP COLUMN IF EXISTS gmb_account_id;
ALTER TABLE public.clinics DROP COLUMN IF EXISTS gmb_location_id;
ALTER TABLE public.clinics DROP COLUMN IF EXISTS gmb_last_sync_at;
ALTER TABLE public.clinics DROP COLUMN IF EXISTS gmb_data;

-- 6. Add updated_at trigger for the new table
CREATE TRIGGER update_clinic_oauth_tokens_updated_at
BEFORE UPDATE ON public.clinic_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();