-- Add columns to seo_pages for unique metadata enforcement
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS og_title text;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS og_description text;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS is_indexed boolean DEFAULT true;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS noindex_reason text;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS similarity_score numeric;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS similar_to_slug text;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS metadata_hash text;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS last_generated_at timestamp with time zone;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS generation_version integer DEFAULT 1;

-- Create SEO metadata history table for rollback capability
CREATE TABLE IF NOT EXISTS public.seo_metadata_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id uuid REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  slug text NOT NULL,
  previous_title text,
  previous_meta_description text,
  previous_h1 text,
  previous_og_title text,
  previous_og_description text,
  new_title text,
  new_meta_description text,
  new_h1 text,
  new_og_title text,
  new_og_description text,
  change_reason text,
  changed_by uuid,
  batch_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create SEO bot settings table
CREATE TABLE IF NOT EXISTS public.seo_bot_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Insert default SEO bot settings
INSERT INTO public.seo_bot_settings (setting_key, setting_value, description)
VALUES 
  ('rate_limits', '{"requests_per_minute": 30, "pages_per_batch": 100}', 'API rate limit controls'),
  ('cost_guardrails', '{"daily_budget_usd": 10, "max_pages_per_run": 500}', 'Cost protection settings'),
  ('generation_config', '{"title_min_length": 40, "title_max_length": 60, "description_min_length": 120, "description_max_length": 160}', 'Metadata generation constraints'),
  ('similarity_threshold', '{"title": 0.85, "description": 0.75, "content": 0.70}', 'Duplicate detection thresholds'),
  ('auto_fix_enabled', 'false', 'Enable automatic fixes without approval'),
  ('excluded_page_types', '["noindex", "filtered"]', 'Page types to skip in audits')
ON CONFLICT (setting_key) DO NOTHING;

-- Create SEO audit runs table for tracking batch operations
CREATE TABLE IF NOT EXISTS public.seo_audit_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type text NOT NULL DEFAULT 'full', -- full, metadata, duplicates, content
  status text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  total_pages integer DEFAULT 0,
  processed_pages integer DEFAULT 0,
  fixed_pages integer DEFAULT 0,
  skipped_pages integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  summary jsonb DEFAULT '{}',
  triggered_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create blog topic clusters table for anti-cannibalization
CREATE TABLE IF NOT EXISTS public.blog_topic_clusters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_name text NOT NULL,
  primary_keyword text NOT NULL,
  related_keywords text[] DEFAULT '{}',
  pillar_page_slug text, -- Main money page for this topic
  intent_type text, -- informational, commercial, transactional
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add topic cluster reference to blog posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS topic_cluster_id uuid REFERENCES public.blog_topic_clusters(id);
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS similarity_score numeric;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS similar_posts text[];
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS internal_links_added text[];

-- Enable RLS
ALTER TABLE public.seo_metadata_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_topic_clusters ENABLE ROW LEVEL SECURITY;

-- RLS policies for super_admin access
CREATE POLICY "Super admin can manage seo_metadata_history"
ON public.seo_metadata_history FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can manage seo_bot_settings"
ON public.seo_bot_settings FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can manage seo_audit_runs"
ON public.seo_audit_runs FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can manage blog_topic_clusters"
ON public.blog_topic_clusters FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seo_pages_metadata_hash ON public.seo_pages(metadata_hash);
CREATE INDEX IF NOT EXISTS idx_seo_pages_similarity ON public.seo_pages(similar_to_slug);
CREATE INDEX IF NOT EXISTS idx_seo_metadata_history_page ON public.seo_metadata_history(page_id);
CREATE INDEX IF NOT EXISTS idx_seo_metadata_history_batch ON public.seo_metadata_history(batch_id);
CREATE INDEX IF NOT EXISTS idx_seo_audit_runs_status ON public.seo_audit_runs(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_cluster ON public.blog_posts(topic_cluster_id);