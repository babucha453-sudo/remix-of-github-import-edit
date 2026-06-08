-- Fix email_logs schema: add missing columns used by logEmail() in _shared/email.ts
-- The existing schema had: id, recipient, subject, type, status, dentist_id, clinic_id, appointment_id, error_message, created_at, updated_at
-- New columns needed: resend_id, user_id

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS resend_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ALTER COLUMN type TYPE TEXT,
  ALTER COLUMN status TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
