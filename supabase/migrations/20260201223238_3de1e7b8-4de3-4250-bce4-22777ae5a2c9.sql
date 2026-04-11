-- Create schema_settings table to store organization-wide structured data configuration
CREATE TABLE public.schema_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.schema_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read schema settings
CREATE POLICY "Schema settings are readable by authenticated users"
ON public.schema_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only super admins can modify schema settings
CREATE POLICY "Only admins can modify schema settings"
ON public.schema_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  )
);

-- Insert default organization schema settings
INSERT INTO public.schema_settings (setting_key, setting_value) VALUES
('organization', jsonb_build_object(
  'name', 'AppointPanda',
  'url', 'https://www.appointpanda.com',
  'logo', 'https://www.appointpanda.com/logo.png',
  'description', 'Find and book appointments with top-rated dental professionals across the United States.',
  'email', '',
  'phone', '',
  'address', jsonb_build_object(
    'streetAddress', '',
    'addressLocality', '',
    'addressRegion', '',
    'postalCode', '',
    'addressCountry', 'US'
  ),
  'socialProfiles', jsonb_build_array(),
  'foundingDate', '',
  'founders', jsonb_build_array()
)),
('sitewide', jsonb_build_object(
  'defaultRating', 4.5,
  'enableBreadcrumbs', true,
  'enableFAQSchema', true,
  'enableReviewSchema', true,
  'enableLocalBusinessSchema', true
))
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_schema_settings_updated_at
BEFORE UPDATE ON public.schema_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();