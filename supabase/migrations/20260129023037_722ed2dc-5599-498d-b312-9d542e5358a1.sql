-- Add policy to allow public read of gmb_data for review funnel
-- This is needed because patients scanning QR codes are not authenticated
CREATE POLICY "Public can read gmb_data for review funnel" 
ON public.clinic_oauth_tokens 
FOR SELECT 
USING (true);

-- Drop the old owner-only select policy since it's now redundant
DROP POLICY IF EXISTS "Clinic owners can view their own oauth tokens" ON public.clinic_oauth_tokens;