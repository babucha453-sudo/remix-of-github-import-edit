-- Create storage bucket for site branding assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-branding',
  'site-branding',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/ico', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view branding assets (public bucket)
CREATE POLICY "Public can view branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-branding');

-- Only super admins can upload/modify branding assets
CREATE POLICY "Super admins can manage branding assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-branding' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can update branding assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-branding' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can delete branding assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-branding' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);