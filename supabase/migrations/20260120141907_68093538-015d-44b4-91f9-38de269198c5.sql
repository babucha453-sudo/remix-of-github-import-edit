-- Allow public read of non-sensitive global settings keys (branding, footer, etc.)
-- and keep write access restricted to super admins.

-- IMPORTANT: Existing policy is RESTRICTIVE for ALL commands, which blocks public SELECT.
-- We replace it with permissive policies.

DROP POLICY IF EXISTS "Super admin global_settings" ON public.global_settings;

-- Super admins can manage all settings
CREATE POLICY "Super admin manage global_settings"
ON public.global_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Public can read ONLY the safe keys used by the public website
CREATE POLICY "Public read global_settings"
ON public.global_settings
FOR SELECT
TO anon, authenticated
USING (
  key = ANY (
    ARRAY[
      'platform',
      'contact_details',
      'social_links',
      'footer_config',
      'legal',
      'header_nav',
      'branding'
    ]::text[]
  )
);
