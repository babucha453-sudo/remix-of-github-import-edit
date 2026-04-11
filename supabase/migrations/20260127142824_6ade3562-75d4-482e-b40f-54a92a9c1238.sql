-- Add new fields to dentist_settings for enhanced notification preferences
ALTER TABLE public.dentist_settings 
ADD COLUMN IF NOT EXISTS notification_email_secondary text,
ADD COLUMN IF NOT EXISTS notification_whatsapp_number text,
ADD COLUMN IF NOT EXISTS notification_new_appointment boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_form_submission boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_cancellation boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_message boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_channel_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_channel_whatsapp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_channel_dashboard boolean DEFAULT true;

-- Add is_assigned and assigned_to fields to appointments for routing
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS is_assigned boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
ADD COLUMN IF NOT EXISTS original_clinic_id uuid REFERENCES public.clinics(id),
ADD COLUMN IF NOT EXISTS routing_notes text;

-- Create form_workflow_settings table for automation
CREATE TABLE IF NOT EXISTS public.form_workflow_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default Workflow',
  is_active boolean DEFAULT true,
  trigger_event text NOT NULL DEFAULT 'booking_confirmed', -- booking_confirmed, booking_pending, manual
  form_sequence jsonb DEFAULT '[]'::jsonb, -- Array of {form_template_id, delay_hours, delivery_method}
  delivery_destinations jsonb DEFAULT '{"email": true, "dashboard": true, "google_drive": false}'::jsonb,
  require_otp_verification boolean DEFAULT false,
  capture_ip_address boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, name)
);

-- Enable RLS on form_workflow_settings
ALTER TABLE public.form_workflow_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for form_workflow_settings
CREATE POLICY "Dentists can manage own workflows"
ON public.form_workflow_settings
FOR ALL
USING (public.owns_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage all workflows"
ON public.form_workflow_settings
FOR ALL
USING (public.is_admin(auth.uid()));

-- Add IP address and OTP fields to patient_form_submissions
ALTER TABLE public.patient_form_submissions
ADD COLUMN IF NOT EXISTS submitted_ip_address text,
ADD COLUMN IF NOT EXISTS otp_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS otp_verification_method text; -- email or phone

-- Create index for unassigned appointments
CREATE INDEX IF NOT EXISTS idx_appointments_unassigned ON public.appointments(is_assigned) WHERE is_assigned = false;

-- Update trigger for form_workflow_settings
CREATE TRIGGER update_form_workflow_settings_updated_at
BEFORE UPDATE ON public.form_workflow_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();