-- =============================================================
-- PHASE 1 & 2: Zocdoc-like Booking Engine & Settings
-- All additive changes - no existing data is modified
-- =============================================================

-- 1. Appointment Types (e.g., Cleaning, Emergency, Consultation)
CREATE TABLE IF NOT EXISTS public.appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  price_from numeric,
  price_to numeric,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Dentist Availability Rules (weekly schedule)
CREATE TABLE IF NOT EXISTS public.dentist_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id uuid REFERENCES public.dentists(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  slot_duration_minutes integer DEFAULT 30,
  buffer_minutes integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, dentist_id, day_of_week)
);

-- 3. Availability Blocks (vacations, holidays, blocked times)
CREATE TABLE IF NOT EXISTS public.availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id uuid REFERENCES public.dentists(id) ON DELETE CASCADE,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  reason text,
  block_type text DEFAULT 'blocked' CHECK (block_type IN ('blocked', 'vacation', 'holiday', 'lunch', 'meeting')),
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- 4. Slot Locks (prevent double booking during checkout)
CREATE TABLE IF NOT EXISTS public.slot_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id uuid REFERENCES public.dentists(id) ON DELETE SET NULL,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  locked_by_user_id uuid,
  locked_by_session text,
  expires_at timestamptz NOT NULL,
  converted_to_appointment_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 5. Dentist/Clinic Settings (booking toggle, preferences)
CREATE TABLE IF NOT EXISTS public.dentist_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  booking_enabled boolean NOT NULL DEFAULT true,
  booking_require_approval boolean DEFAULT false,
  allow_same_day_booking boolean DEFAULT true,
  min_advance_booking_hours integer DEFAULT 2,
  max_advance_booking_days integer DEFAULT 60,
  allow_guest_booking boolean DEFAULT true,
  confirmation_email_enabled boolean DEFAULT true,
  reminder_sms_enabled boolean DEFAULT false,
  reminder_hours_before integer DEFAULT 24,
  cancellation_policy text,
  booking_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Add appointment_type_id to existing appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS appointment_type_id uuid REFERENCES public.appointment_types(id) ON DELETE SET NULL;

-- 7. Add start_datetime and end_datetime to appointments for slot-based booking
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS start_datetime timestamptz,
ADD COLUMN IF NOT EXISTS end_datetime timestamptz;

-- Enable RLS on all new tables
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentist_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentist_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointment_types
CREATE POLICY "Anyone can view active appointment types"
ON public.appointment_types FOR SELECT
USING (is_active = true);

CREATE POLICY "Clinic owners can manage appointment types"
ON public.appointment_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clinics 
    WHERE clinics.id = appointment_types.clinic_id 
    AND clinics.claimed_by = auth.uid()
  )
);

-- RLS Policies for dentist_availability_rules
CREATE POLICY "Anyone can view availability rules"
ON public.dentist_availability_rules FOR SELECT
USING (is_active = true);

CREATE POLICY "Clinic owners can manage availability"
ON public.dentist_availability_rules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clinics 
    WHERE clinics.id = dentist_availability_rules.clinic_id 
    AND clinics.claimed_by = auth.uid()
  )
);

-- RLS Policies for availability_blocks
CREATE POLICY "Anyone can view availability blocks"
ON public.availability_blocks FOR SELECT
USING (true);

CREATE POLICY "Clinic owners can manage blocks"
ON public.availability_blocks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clinics 
    WHERE clinics.id = availability_blocks.clinic_id 
    AND clinics.claimed_by = auth.uid()
  )
);

-- RLS Policies for slot_locks
CREATE POLICY "Anyone can view slot locks"
ON public.slot_locks FOR SELECT
USING (true);

CREATE POLICY "Anyone can create slot locks"
ON public.slot_locks FOR INSERT
WITH CHECK (true);

CREATE POLICY "Lock creator or clinic owner can delete"
ON public.slot_locks FOR DELETE
USING (
  locked_by_user_id = auth.uid() OR
  locked_by_session = current_setting('request.headers', true)::json->>'x-session-id' OR
  EXISTS (
    SELECT 1 FROM public.clinics 
    WHERE clinics.id = slot_locks.clinic_id 
    AND clinics.claimed_by = auth.uid()
  )
);

-- RLS Policies for dentist_settings
CREATE POLICY "Anyone can view dentist settings"
ON public.dentist_settings FOR SELECT
USING (true);

CREATE POLICY "Clinic owners can manage settings"
ON public.dentist_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clinics 
    WHERE clinics.id = dentist_settings.clinic_id 
    AND clinics.claimed_by = auth.uid()
  )
);

-- Admin bypass for all tables
CREATE POLICY "Admins can manage all appointment_types"
ON public.appointment_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can manage all availability_rules"
ON public.dentist_availability_rules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can manage all availability_blocks"
ON public.availability_blocks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can manage all slot_locks"
ON public.slot_locks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

CREATE POLICY "Admins can manage all dentist_settings"
ON public.dentist_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'district_manager')
  )
);

-- Function to clean up expired slot locks
CREATE OR REPLACE FUNCTION public.cleanup_expired_slot_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.slot_locks
  WHERE expires_at < now()
    AND converted_to_appointment_id IS NULL;
END;
$$;

-- Trigger to auto-create dentist_settings when clinic is claimed
CREATE OR REPLACE FUNCTION public.create_dentist_settings_on_claim()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.claimed_by IS NOT NULL AND OLD.claimed_by IS NULL THEN
    INSERT INTO public.dentist_settings (clinic_id)
    VALUES (NEW.id)
    ON CONFLICT (clinic_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_dentist_settings_trigger ON public.clinics;
CREATE TRIGGER create_dentist_settings_trigger
  AFTER UPDATE OF claimed_by ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.create_dentist_settings_on_claim();

-- Seed default appointment types for testing
INSERT INTO public.appointment_types (clinic_id, name, description, duration_minutes, is_active)
VALUES 
  (NULL, 'General Consultation', 'Initial consultation and exam', 30, true),
  (NULL, 'Teeth Cleaning', 'Professional dental cleaning', 45, true),
  (NULL, 'Dental Checkup', 'Routine dental examination', 30, true),
  (NULL, 'Emergency Visit', 'Urgent dental care', 30, true),
  (NULL, 'Teeth Whitening', 'Professional whitening treatment', 60, true),
  (NULL, 'Root Canal', 'Root canal therapy', 90, true),
  (NULL, 'Crown Fitting', 'Dental crown placement', 60, true),
  (NULL, 'Filling', 'Cavity filling', 45, true)
ON CONFLICT DO NOTHING;

-- Add realtime for slot_locks (for live availability updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.slot_locks;