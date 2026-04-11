-- Add fields for manual claim review requests
ALTER TABLE public.claim_requests 
ADD COLUMN IF NOT EXISTS requester_name TEXT,
ADD COLUMN IF NOT EXISTS requester_phone TEXT,
ADD COLUMN IF NOT EXISTS requester_address TEXT,
ADD COLUMN IF NOT EXISTS claim_type TEXT DEFAULT 'otp' CHECK (claim_type IN ('otp', 'manual_review'));