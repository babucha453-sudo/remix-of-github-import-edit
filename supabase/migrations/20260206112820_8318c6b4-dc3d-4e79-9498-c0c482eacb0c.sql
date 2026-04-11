-- Phase 1: Add structured content columns for granular SEO tool separation
-- These columns enable strict tool separation between Content Studio, FAQ Studio, and Meta Optimizer

-- Structured content columns for granular content management
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS page_intro TEXT;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS h2_sections JSONB;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS internal_links_intro TEXT;

-- Tracking fields to enforce tool separation and audit trail
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS last_content_edit_source TEXT;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS last_faq_edit_source TEXT;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS last_meta_edit_source TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.seo_pages.page_intro IS 'Intro paragraph only - managed by Content Studio';
COMMENT ON COLUMN public.seo_pages.h2_sections IS 'Structured H2 sections JSONB - managed by Content Studio';
COMMENT ON COLUMN public.seo_pages.internal_links_intro IS 'Bridge text before internal links - managed by Content Studio';
COMMENT ON COLUMN public.seo_pages.last_content_edit_source IS 'Last tool that edited body content (content_studio, manual)';
COMMENT ON COLUMN public.seo_pages.last_faq_edit_source IS 'Last tool that edited FAQs (faq_studio, manual)';
COMMENT ON COLUMN public.seo_pages.last_meta_edit_source IS 'Last tool that edited meta fields (meta_optimizer, manual)';