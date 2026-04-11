-- Add FAQ column to seo_pages for storing FAQ arrays
ALTER TABLE public.seo_pages 
ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT NULL;

-- Add index for faster FAQ queries
CREATE INDEX IF NOT EXISTS idx_seo_pages_faqs_not_null 
ON public.seo_pages ((faqs IS NOT NULL));

-- Add comment for documentation
COMMENT ON COLUMN public.seo_pages.faqs IS 'Array of FAQ objects with question and answer fields, e.g. [{"question": "...", "answer": "..."}]';