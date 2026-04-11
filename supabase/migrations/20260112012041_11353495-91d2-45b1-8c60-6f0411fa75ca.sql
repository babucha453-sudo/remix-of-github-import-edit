-- Enable pgcrypto extension for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recreate the function to ensure it works
CREATE OR REPLACE FUNCTION generate_appointment_token()
RETURNS TRIGGER AS $$
BEGIN
  NEW.manage_token := encode(gen_random_bytes(16), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;