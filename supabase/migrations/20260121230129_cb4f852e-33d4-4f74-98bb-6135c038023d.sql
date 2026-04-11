-- =====================================================
-- PHASE 1: MASTER LOCATION DATABASE ENHANCEMENTS
-- =====================================================

-- Add SEO status and page tracking to states table
ALTER TABLE public.states 
ADD COLUMN IF NOT EXISTS seo_status TEXT DEFAULT 'inactive' CHECK (seo_status IN ('inactive', 'draft', 'generated', 'live')),
ADD COLUMN IF NOT EXISTS page_exists BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS population INTEGER,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC,
ADD COLUMN IF NOT EXISTS seo_page_id UUID REFERENCES public.seo_pages(id),
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by_listing UUID REFERENCES auth.users(id);

-- Add SEO status and page tracking to cities table
ALTER TABLE public.cities 
ADD COLUMN IF NOT EXISTS seo_status TEXT DEFAULT 'inactive' CHECK (seo_status IN ('inactive', 'draft', 'generated', 'live')),
ADD COLUMN IF NOT EXISTS page_exists BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS population INTEGER,
ADD COLUMN IF NOT EXISTS seo_page_id UUID REFERENCES public.seo_pages(id),
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by_listing UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS nearby_cities UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- =====================================================
-- PAGE GENERATION QUEUE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.page_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL CHECK (page_type IN ('state', 'city', 'service_location')),
  entity_id UUID NOT NULL,
  entity_slug TEXT NOT NULL,
  state_slug TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'generated', 'failed', 'approved', 'published')),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('listing', 'admin', 'auto', 'gsc_data')),
  triggered_by_user UUID REFERENCES auth.users(id),
  triggered_by_clinic UUID REFERENCES public.clinics(id),
  ai_confidence_score NUMERIC,
  seo_validation_passed BOOLEAN,
  seo_validation_errors JSONB DEFAULT '[]',
  content_generated JSONB,
  generation_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- CONTENT VERSION HISTORY (ROLLBACK SUPPORT)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seo_page_id UUID REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_trigger TEXT NOT NULL CHECK (change_trigger IN ('new_page', 'ai_update', 'admin_edit', 'gsc_optimization', 'rollback')),
  ai_confidence_score NUMERIC,
  changed_by UUID REFERENCES auth.users(id),
  batch_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- SEO VALIDATION RULES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.seo_validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('content', 'meta', 'structure', 'duplicate', 'spam')),
  is_enabled BOOLEAN DEFAULT true,
  is_blocking BOOLEAN DEFAULT true,
  min_value INTEGER,
  max_value INTEGER,
  pattern TEXT,
  error_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default SEO validation rules
INSERT INTO public.seo_validation_rules (rule_name, rule_type, is_blocking, min_value, max_value, pattern, error_message) VALUES
('title_length', 'meta', true, 30, 60, NULL, 'Title must be 30-60 characters'),
('meta_description_length', 'meta', true, 120, 160, NULL, 'Meta description must be 120-160 characters'),
('h1_unique', 'content', true, NULL, NULL, NULL, 'H1 must be unique across all pages'),
('content_min_words', 'content', true, 300, NULL, NULL, 'Content must have at least 300 words'),
('no_keyword_stuffing', 'spam', true, NULL, 3, NULL, 'Primary keyword should appear max 3 times in first 100 words'),
('no_near_me_abuse', 'spam', true, NULL, 1, 'near me|nearby|close to me', 'Avoid "near me" keyword abuse'),
('no_doorway_pattern', 'spam', true, NULL, NULL, NULL, 'Content must not follow doorway page patterns'),
('internal_links_required', 'structure', true, 2, NULL, NULL, 'Page must have at least 2 internal links'),
('unique_content', 'duplicate', true, NULL, NULL, NULL, 'Content similarity must be below 70%')
ON CONFLICT (rule_name) DO NOTHING;

-- =====================================================
-- GEO EXPANSION SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.geo_expansion_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default settings
INSERT INTO public.geo_expansion_settings (setting_key, setting_value, description) VALUES
('auto_publish_enabled', 'false', 'Enable automatic publishing of pages above confidence threshold'),
('auto_publish_threshold', '0.85', 'Minimum AI confidence score for auto-publishing'),
('ai_generation_enabled', 'true', 'Enable AI content generation'),
('max_pages_per_batch', '50', 'Maximum pages to generate in a single batch'),
('content_min_words', '400', 'Minimum word count for generated content'),
('content_max_words', '800', 'Maximum word count for generated content'),
('duplicate_similarity_threshold', '0.7', 'Maximum allowed content similarity'),
('require_admin_approval', 'true', 'Require admin approval before publishing'),
('nearby_cities_radius_km', '50', 'Radius for finding nearby cities for internal linking')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_page_gen_queue_status ON public.page_generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_page_gen_queue_type_entity ON public.page_generation_queue(page_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_page ON public.content_versions(seo_page_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_entity ON public.content_versions(page_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_batch ON public.content_versions(batch_id);
CREATE INDEX IF NOT EXISTS idx_states_seo_status ON public.states(seo_status);
CREATE INDEX IF NOT EXISTS idx_cities_seo_status ON public.cities(seo_status);
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON public.cities(state_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.page_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_expansion_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage page_generation_queue" ON public.page_generation_queue
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage content_versions" ON public.content_versions
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage seo_validation_rules" ON public.seo_validation_rules
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage geo_expansion_settings" ON public.geo_expansion_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public read for validation rules (needed for edge functions)
CREATE POLICY "Public read seo_validation_rules" ON public.seo_validation_rules
  FOR SELECT USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_page_generation_queue_updated_at
  BEFORE UPDATE ON public.page_generation_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_geo_expansion_settings_updated_at
  BEFORE UPDATE ON public.geo_expansion_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();