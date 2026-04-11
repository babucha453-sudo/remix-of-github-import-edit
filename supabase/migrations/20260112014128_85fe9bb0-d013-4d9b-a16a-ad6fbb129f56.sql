-- Fix token generation: pgcrypto is installed in the `extensions` schema on this project
-- so the trigger function must reference it explicitly (or include it in search_path).

CREATE OR REPLACE FUNCTION public.generate_appointment_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  NEW.manage_token := encode(extensions.gen_random_bytes(16), 'hex');
  RETURN NEW;
END;
$$;