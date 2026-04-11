-- Add unique token column for appointment management links
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS manage_token text UNIQUE;

-- Create function to generate unique tokens for appointments
CREATE OR REPLACE FUNCTION public.generate_appointment_token()
RETURNS TRIGGER AS $$
BEGIN
  NEW.manage_token := encode(gen_random_bytes(16), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate tokens on insert
DROP TRIGGER IF EXISTS set_appointment_token ON public.appointments;
CREATE TRIGGER set_appointment_token
BEFORE INSERT ON public.appointments
FOR EACH ROW
WHEN (NEW.manage_token IS NULL)
EXECUTE FUNCTION public.generate_appointment_token();

-- Update existing appointments with tokens
UPDATE public.appointments 
SET manage_token = encode(gen_random_bytes(16), 'hex')
WHERE manage_token IS NULL;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_appointments_manage_token ON public.appointments(manage_token);

-- Allow public read access for appointment management via token
CREATE POLICY "Anyone can view appointments by token" 
ON public.appointments 
FOR SELECT 
USING (manage_token IS NOT NULL);

-- Allow public update for rescheduling/cancellation via token
CREATE POLICY "Anyone can update appointments by token for cancel/reschedule" 
ON public.appointments 
FOR UPDATE 
USING (manage_token IS NOT NULL)
WITH CHECK (manage_token IS NOT NULL);