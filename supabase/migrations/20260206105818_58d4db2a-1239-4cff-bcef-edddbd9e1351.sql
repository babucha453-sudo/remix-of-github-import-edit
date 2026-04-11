-- Allow public site pages to read SEO content + FAQs
-- Current setup only allows admins to access seo_pages, which causes public pages to show fallback/dummy FAQs.

-- Ensure RLS stays enabled
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

-- Public read access (only for pages meant to be shown)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seo_pages'
      AND policyname = 'Public can read indexed seo_pages'
  ) THEN
    CREATE POLICY "Public can read indexed seo_pages"
    ON public.seo_pages
    FOR SELECT
    TO anon, authenticated
    USING (
      COALESCE(is_indexed, true) = true
      AND COALESCE(is_duplicate, false) = false
    );
  END IF;
END $$;