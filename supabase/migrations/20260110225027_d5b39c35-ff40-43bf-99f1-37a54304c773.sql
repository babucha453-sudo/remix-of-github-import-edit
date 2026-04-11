-- Update state slugs to use abbreviations (lowercase)
UPDATE public.states 
SET slug = LOWER(abbreviation)
WHERE abbreviation IS NOT NULL;

-- Also update any cities that reference states to use the new abbreviation format
-- Note: Cities use state_id foreign key, so they don't need updating

-- Create trigger to call edge function directly instead of pg_notify
-- First, drop existing trigger if it exists
DROP TRIGGER IF EXISTS appointment_email_trigger ON public.appointments;

-- Create a new function that will be called by HTTP call from the app
-- (The app code will handle calling the edge function directly)