-- Appointment Reminders Table
-- Tracks SMS reminders sent for appointments

CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  twilio_sid TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment_id ON public.appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_status ON public.appointment_reminders(status);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_type_status ON public.appointment_reminders(reminder_type, status);

-- Unique constraint to prevent duplicate reminders of same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_reminders_unique_24h ON public.appointment_reminders(appointment_id) WHERE reminder_type = '24h';
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_reminders_unique_1h ON public.appointment_reminders(appointment_id) WHERE reminder_type = '1h';

-- Add sms_reminder_enabled column to patients table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patients' AND column_name = 'sms_reminder_enabled'
  ) THEN
    ALTER TABLE public.patients ADD COLUMN sms_reminder_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- RLS for appointment_reminders
ALTER TABLE public.appointment_reminders ENABLE ROW SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access appointment_reminders" ON public.appointment_reminders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to read their own reminders
CREATE POLICY "Users read own appointment_reminders" ON public.appointment_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_reminders.appointment_id
      AND EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id = a.clinic_id
        AND c.claimed_by = auth.uid()
      )
    )
  );

COMMENT ON TABLE public.appointment_reminders IS 'Tracks SMS reminders sent to patients before appointments';
COMMENT ON COLUMN public.appointment_reminders.reminder_type IS 'Type of reminder: 24h (24 hours before) or 1h (1 hour before)';
COMMENT ON COLUMN public.appointment_reminders.status IS 'Status: pending, sent, failed, or skipped (patient opted out)';
COMMENT ON COLUMN public.appointment_reminders.twilio_sid IS 'Twilio message SID for tracking delivery';
COMMENT ON COLUMN public.appointment_reminders.sent_at IS 'Timestamp when the SMS was sent';