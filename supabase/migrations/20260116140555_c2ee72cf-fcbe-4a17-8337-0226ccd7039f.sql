-- Create blog-images bucket for storing featured images uploaded via n8n
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to blog images
CREATE POLICY "Public can view blog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

-- Allow service role to upload blog images
CREATE POLICY "Service role can upload blog images"  
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'blog-images');

-- Allow service role to update/overwrite blog images
CREATE POLICY "Service role can update blog images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'blog-images');