-- Add GMB booking link settings to clinic_oauth_tokens
ALTER TABLE public.clinic_oauth_tokens 
ADD COLUMN IF NOT EXISTS gmb_booking_link_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS gmb_booking_link_id text,
ADD COLUMN IF NOT EXISTS gmb_booking_link_set_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.clinic_oauth_tokens.gmb_booking_link_enabled IS 'When true, the platform booking link is set on the GMB profile';
COMMENT ON COLUMN public.clinic_oauth_tokens.gmb_booking_link_id IS 'The place action link ID returned by Google after setting the link';
COMMENT ON COLUMN public.clinic_oauth_tokens.gmb_booking_link_set_at IS 'When the booking link was last synced to GMB';