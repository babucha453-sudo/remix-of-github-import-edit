ALTER TABLE public.clinic_automation_settings
ADD COLUMN IF NOT EXISTS notification_config JSONB DEFAULT '{}'::jsonb;
