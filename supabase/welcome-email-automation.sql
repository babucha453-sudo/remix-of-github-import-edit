-- Welcome Email Automation for AppointPanda
-- Run this SQL in your Supabase SQL Editor

-- Create email_logs table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  dentist_id UUID REFERENCES dentists(id),
  clinic_id UUID REFERENCES clinics(id),
  appointment_id UUID REFERENCES appointments(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_dentist_id ON email_logs(dentist_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- Create automation_logs table for tracking automation runs
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'completed',
  details JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_type ON automation_logs(type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

-- Create email_templates table for storing email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(500),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- Insert default email templates
INSERT INTO email_templates (name, type, subject, content, variables, is_active) VALUES
(
  'Welcome Email',
  'welcome_email',
  'Welcome to AppointPanda, {{firstName}}!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome</title>
</head>
<body>
  <h1>Welcome to AppointPanda, {{firstName}}!</h1>
  <p>Your clinic {{clinicName}} is now registered.</p>
  <a href="{{profileUrl}}">Complete Your Profile</a>
  <a href="{{dashboardUrl}}">Go to Dashboard</a>
</body>
</html>',
  '["firstName", "clinicName", "profileUrl", "dashboardUrl"]',
  true
),
(
  'Day 0 Welcome',
  'onboarding_day_0',
  'Welcome to AppointPanda, {{firstName}}!',
  '<!DOCTYPE html>
<html>
<body>
  <h1>Hello {{firstName}},</h1>
  <p>Welcome to AppointPanda! Your journey to more bookings starts here.</p>
  <h2>Quick Start Guide:</h2>
  <ol>
    <li>Complete your profile</li>
    <li>Set up your calendar</li>
    <li>Start accepting bookings</li>
  </ol>
</body>
</html>',
  '["firstName", "clinicName", "profileUrl", "dashboardUrl"]',
  true
),
(
  'Day 3 Reminder',
  'onboarding_day_3',
  'Complete your profile - Day 3 reminder',
  '<!DOCTYPE html>
<html>
<body>
  <h1>Hi {{firstName}},</h1>
  <p>Don''t forget to complete your {{clinicName}} profile!</p>
  <p>Your profile is {{profileCompletionPercent}}% complete.</p>
  <a href="{{profileUrl}}">Finish Your Profile</a>
</body>
</html>',
  '["firstName", "clinicName", "profileUrl", "profileCompletionPercent"]',
  true
),
(
  'Day 7 Tips',
  'onboarding_day_7',
  '{{firstName}}, 7 tips to get more bookings',
  '<!DOCTYPE html>
<html>
<body>
  <h1>Pro Tips for {{firstName}}</h1>
  <ul>
    <li>Showcase your expertise</li>
    <li>Add photos of your clinic</li>
    <li>Encourage reviews</li>
    <li>Keep availability updated</li>
  </ul>
</body>
</html>',
  '["firstName", "clinicName", "dashboardUrl"]',
  true
)
ON CONFLICT (type) DO NOTHING;

-- Create dentist_onboarding_status table for tracking onboarding progress
CREATE TABLE IF NOT EXISTS dentist_onboarding_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dentist_id UUID NOT NULL REFERENCES dentists(id),
  welcome_email_sent BOOLEAN DEFAULT false,
  welcome_email_sent_at TIMESTAMPTZ,
  day3_email_sent BOOLEAN DEFAULT false,
  day3_email_sent_at TIMESTAMPTZ,
  day7_email_sent BOOLEAN DEFAULT false,
  day7_email_sent_at TIMESTAMPTZ,
  profile_completion_percent INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dentist_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status_dentist_id ON dentist_onboarding_status(dentist_id);

-- Function to update onboarding status
CREATE OR REPLACE FUNCTION update_onboarding_status(
  p_dentist_id UUID,
  p_email_type VARCHAR(50)
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO dentist_onboarding_status (dentist_id)
  VALUES (p_dentist_id)
  ON CONFLICT (dentist_id) DO UPDATE SET updated_at = NOW();

  IF p_email_type = 'welcome_email' OR p_email_type = 'onboarding_day_0' THEN
    UPDATE dentist_onboarding_status 
    SET welcome_email_sent = true, welcome_email_sent_at = NOW()
    WHERE dentist_id = p_dentist_id;
  ELSIF p_email_type = 'onboarding_day_3' THEN
    UPDATE dentist_onboarding_status 
    SET day3_email_sent = true, day3_email_sent_at = NOW()
    WHERE dentist_id = p_dentist_id;
  ELSIF p_email_type = 'onboarding_day_7' THEN
    UPDATE dentist_onboarding_status 
    SET day7_email_sent = true, day7_email_sent_at = NOW(),
        onboarding_completed = true
    WHERE dentist_id = p_dentist_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically send welcome email on new dentist registration
CREATE OR REPLACE FUNCTION notify_new_dentist_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert onboarding status record
  INSERT INTO dentist_onboarding_status (dentist_id)
  VALUES (NEW.id)
  ON CONFLICT (dentist_id) DO NOTHING;

  -- Log the registration for the onboarding trigger to pick up
  INSERT INTO automation_logs (type, status, details)
  VALUES ('new_dentist_registered', 'pending', jsonb_build_object(
    'dentist_id', NEW.id,
    'email', NEW.email,
    'first_name', NEW.first_name,
    'clinic_name', NEW.clinic_name
  ));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to fire on new dentist insertion
DROP TRIGGER IF EXISTS on_new_dentist_registration ON dentists;
CREATE TRIGGER on_new_dentist_registration
  AFTER INSERT ON dentists
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_dentist_registration();

-- Create a view for onboarding dashboard
CREATE OR REPLACE VIEW onboarding_dashboard AS
SELECT 
  d.id,
  d.email,
  d.first_name,
  d.clinic_name,
  d.created_at,
  dos.welcome_email_sent,
  dos.welcome_email_sent_at,
  dos.day3_email_sent,
  dos.day3_email_sent_at,
  dos.day7_email_sent,
  dos.day7_email_sent_at,
  dos.profile_completion_percent,
  dos.onboarding_completed,
  CASE 
    WHEN dos.onboarding_completed THEN 'Completed'
    WHEN dos.day7_email_sent THEN 'Day 7 Sent'
    WHEN dos.day3_email_sent THEN 'Day 3 Sent'
    WHEN dos.welcome_email_sent THEN 'Day 0 Sent'
    ELSE 'Pending'
  END as onboarding_status
FROM dentists d
LEFT JOIN dentist_onboarding_status dos ON d.id = dos.dentist_id
WHERE d.status = 'active';

-- Grant permissions (adjust as needed for your setup)
GRANT SELECT ON email_logs TO anon;
GRANT SELECT ON email_templates TO anon;
GRANT SELECT ON automation_logs TO anon;
GRANT SELECT ON dentist_onboarding_status TO anon;
GRANT SELECT ON onboarding_dashboard TO anon;

-- Optional: Create cron job SQL for Supabase pg_cron extension
-- Uncomment if you have pg_cron enabled
/*
SELECT cron.schedule(
  'onboarding-trigger-every-hour',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.external_url') || '/functions/v1/onboarding-trigger',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);
*/