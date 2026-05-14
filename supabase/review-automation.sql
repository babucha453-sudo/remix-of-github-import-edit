-- ========================================================
-- REVIEW REQUEST AUTOMATION TABLES
-- Run these in Supabase SQL Editor
-- ========================================================

-- 1. Review Automation Log Table
-- Tracks all review request automation attempts
CREATE TABLE IF NOT EXISTS review_automation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  sequence_step INTEGER NOT NULL CHECK (sequence_step IN (0, 3, 7)),
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'whatsapp')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'completed')),
  email_sent BOOLEAN DEFAULT false,
  email_error TEXT,
  sms_sent BOOLEAN DEFAULT false,
  sms_error TEXT,
  platform TEXT DEFAULT 'appointpanda' CHECK (platform IN ('appointpanda', 'google', 'both')),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns to appointments table for review tracking
ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS review_requested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'requested', 'completed', 'declined', 'expired')),
  ADD COLUMN IF NOT EXISTS review_platform TEXT CHECK (review_platform IN ('google', 'platform', 'both'));

-- 3. Automation Run Log Table
-- Tracks automation execution history
CREATE TABLE IF NOT EXISTS automation_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL,
  appointments_processed INTEGER DEFAULT 0,
  day0_sent INTEGER DEFAULT 0,
  day3_sent INTEGER DEFAULT 0,
  day7_sent INTEGER DEFAULT 0,
  errors TEXT[],
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial_success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_automation_appointment ON review_automation_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_review_automation_clinic ON review_automation_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_review_automation_step ON review_automation_log(sequence_step);
CREATE INDEX IF NOT EXISTS idx_review_automation_status ON review_automation_log(status);
CREATE INDEX IF NOT EXISTS idx_appointments_review ON appointments(review_requested, review_status) WHERE review_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_automation_run_type ON automation_run_log(automation_type, triggered_at);

-- 5. Create function to auto-trigger review request on appointment completion
CREATE OR REPLACE FUNCTION trigger_review_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO review_automation_log (
      appointment_id,
      clinic_id,
      patient_name,
      patient_email,
      patient_phone,
      sequence_step,
      channel,
      status
    ) VALUES (
      NEW.id,
      NEW.clinic_id,
      NEW.patient_name,
      NEW.patient_email,
      NEW.patient_phone,
      0,
      CASE WHEN NEW.patient_email IS NOT NULL THEN 'email' ELSE 'sms' END,
      'pending'
    );
    
    UPDATE appointments 
    SET review_requested = true, review_requested_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for auto-trigger on completion
DROP TRIGGER IF EXISTS auto_review_request_on_completion ON appointments;
CREATE TRIGGER auto_review_request_on_completion
AFTER UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION trigger_review_on_completion();

-- 7. Update existing completed appointments to be eligible for review requests
UPDATE appointments 
SET review_requested = false 
WHERE status = 'completed' AND review_requested IS NULL;

-- 8. Grant permissions (adjust as needed for your RLS setup)
GRANT SELECT ON review_automation_log TO authenticated;
GRANT SELECT ON automation_run_log TO authenticated;
GRANT ALL ON review_automation_log TO service_role;
GRANT ALL ON automation_run_log TO service_role;

-- 9. Enable RLS on new tables
ALTER TABLE review_automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_run_log ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for review_automation_log
CREATE POLICY "Service role full access" ON review_automation_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin read access" ON review_automation_log FOR SELECT USING (true);
CREATE POLICY "Automation log service role insert" ON automation_run_log FOR INSERT WITH CHECK (true);

COMMENT ON TABLE review_automation_log IS 'Tracks all review request automation attempts for appointments';
COMMENT ON TABLE automation_run_log IS 'Tracks automation execution history for monitoring and debugging';
COMMENT ON COLUMN review_automation_log.sequence_step IS 'Day offset: 0=initial request, 3=day 3 reminder, 7=day 7 final reminder';