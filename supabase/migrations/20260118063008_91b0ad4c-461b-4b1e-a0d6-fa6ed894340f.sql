-- Create storage bucket for pre-generated static HTML pages
INSERT INTO storage.buckets (id, name, public) 
VALUES ('static-pages', 'static-pages', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to static pages
CREATE POLICY "Public can read static pages"
ON storage.objects FOR SELECT
USING (bucket_id = 'static-pages');

-- Allow service role to manage static pages
CREATE POLICY "Service role can manage static pages"
ON storage.objects FOR ALL
USING (bucket_id = 'static-pages')
WITH CHECK (bucket_id = 'static-pages');

-- Table to track generated static pages
CREATE TABLE IF NOT EXISTS static_page_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  content_hash TEXT,
  is_stale BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast path lookups
CREATE INDEX IF NOT EXISTS idx_static_page_cache_path ON static_page_cache(path);
CREATE INDEX IF NOT EXISTS idx_static_page_cache_page_type ON static_page_cache(page_type);

-- Enable RLS but allow public read
ALTER TABLE static_page_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read static page cache"
ON static_page_cache FOR SELECT
USING (true);

CREATE POLICY "Service role can manage static page cache"
ON static_page_cache FOR ALL
USING (true)
WITH CHECK (true);