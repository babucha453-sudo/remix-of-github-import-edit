-- SEO Fix Jobs - Tracks bulk optimization runs
CREATE TABLE IF NOT EXISTS public.seo_fix_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'meta_optimization', 'content_enrichment', 'h1_fix', 'bulk_regenerate', 'indexing_fix'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  
  -- Configuration
  filters JSONB DEFAULT '{}', -- page_types, states, cities, services, issue_types
  regeneration_config JSONB DEFAULT '{}', -- which elements to regenerate: h1, h2, meta_title, meta_description, content, faq, internal_links
  target_word_count INTEGER DEFAULT 500,
  apply_mode TEXT DEFAULT 'draft', -- 'draft', 'auto_apply', 'quality_gated'
  quality_threshold INTEGER DEFAULT 70,
  
  -- Progress tracking
  total_pages INTEGER DEFAULT 0,
  processed_pages INTEGER DEFAULT 0,
  successful_pages INTEGER DEFAULT 0,
  failed_pages INTEGER DEFAULT 0,
  skipped_pages INTEGER DEFAULT 0,
  current_page_slug TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion TIMESTAMP WITH TIME ZONE,
  
  -- User
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  error_summary JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEO Fix Job Items - Individual page changes within a job
CREATE TABLE IF NOT EXISTS public.seo_fix_job_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.seo_fix_jobs(id) ON DELETE CASCADE,
  seo_page_id UUID REFERENCES public.seo_pages(id) ON DELETE SET NULL,
  page_slug TEXT NOT NULL,
  page_type TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped', 'rolled_back'
  
  -- Before/After snapshots
  before_snapshot JSONB, -- {meta_title, meta_description, h1, h2_sections, content, word_count, seo_score}
  after_snapshot JSONB,
  generated_content JSONB, -- AI-generated content before approval
  
  -- Quality metrics
  before_score INTEGER,
  after_score INTEGER,
  quality_passed BOOLEAN,
  uniqueness_score NUMERIC(5,2),
  
  -- Applied state
  is_applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMP WITH TIME ZONE,
  applied_by UUID REFERENCES auth.users(id),
  
  -- Rollback
  is_rolled_back BOOLEAN DEFAULT FALSE,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  rolled_back_by UUID REFERENCES auth.users(id),
  
  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Versions - Full history of SEO page changes for rollback
CREATE TABLE IF NOT EXISTS public.seo_content_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seo_page_id UUID NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  
  -- Full content snapshot
  meta_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  h2_sections JSONB,
  content TEXT,
  word_count INTEGER,
  seo_score INTEGER,
  faq JSONB,
  internal_links JSONB,
  
  -- Change metadata
  change_source TEXT, -- 'manual', 'ai_optimization', 'bulk_job', 'rollback'
  change_reason TEXT,
  job_id UUID REFERENCES public.seo_fix_jobs(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES auth.users(id),
  
  -- Flags
  is_current BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(seo_page_id, version_number)
);

-- Indexing Diagnostics - Results from crawl/index checks
CREATE TABLE IF NOT EXISTS public.seo_indexing_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seo_page_id UUID REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  page_slug TEXT NOT NULL,
  page_url TEXT NOT NULL,
  
  -- HTTP checks
  http_status INTEGER,
  response_time_ms INTEGER,
  is_redirect BOOLEAN DEFAULT FALSE,
  redirect_target TEXT,
  
  -- Robots/Indexing
  has_noindex BOOLEAN DEFAULT FALSE,
  robots_meta TEXT,
  x_robots_tag TEXT,
  
  -- Canonical
  canonical_url TEXT,
  is_self_canonical BOOLEAN,
  canonical_mismatch BOOLEAN DEFAULT FALSE,
  canonical_issue TEXT,
  
  -- Sitemap
  in_sitemap BOOLEAN DEFAULT FALSE,
  sitemap_lastmod TIMESTAMP WITH TIME ZONE,
  sitemap_priority NUMERIC(2,1),
  
  -- Internal Links
  internal_links_count INTEGER DEFAULT 0,
  inbound_links_count INTEGER DEFAULT 0,
  is_orphan BOOLEAN DEFAULT FALSE,
  linking_pages JSONB DEFAULT '[]',
  
  -- Rendered HTML
  has_rendered_content BOOLEAN DEFAULT FALSE,
  rendered_word_count INTEGER,
  has_h1_in_html BOOLEAN DEFAULT FALSE,
  has_meta_in_html BOOLEAN DEFAULT FALSE,
  js_render_required BOOLEAN DEFAULT FALSE,
  
  -- Duplicate detection
  is_near_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_score NUMERIC(5,2),
  similar_pages JSONB DEFAULT '[]',
  
  -- Overall assessment
  indexability_score INTEGER, -- 0-100
  primary_blocker TEXT, -- Main reason for indexing issues
  secondary_issues JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  
  -- Timestamps
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seo_fix_jobs_status ON public.seo_fix_jobs(status);
CREATE INDEX IF NOT EXISTS idx_seo_fix_jobs_created_by ON public.seo_fix_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_seo_fix_jobs_created_at ON public.seo_fix_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_fix_job_items_job_id ON public.seo_fix_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_seo_fix_job_items_status ON public.seo_fix_job_items(status);
CREATE INDEX IF NOT EXISTS idx_seo_fix_job_items_seo_page_id ON public.seo_fix_job_items(seo_page_id);

CREATE INDEX IF NOT EXISTS idx_seo_content_versions_page_id ON public.seo_content_versions(seo_page_id);
CREATE INDEX IF NOT EXISTS idx_seo_content_versions_current ON public.seo_content_versions(seo_page_id) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_seo_indexing_diagnostics_page ON public.seo_indexing_diagnostics(seo_page_id);
CREATE INDEX IF NOT EXISTS idx_seo_indexing_diagnostics_slug ON public.seo_indexing_diagnostics(page_slug);
CREATE INDEX IF NOT EXISTS idx_seo_indexing_diagnostics_orphan ON public.seo_indexing_diagnostics(is_orphan) WHERE is_orphan = true;
CREATE INDEX IF NOT EXISTS idx_seo_indexing_diagnostics_blocker ON public.seo_indexing_diagnostics(primary_blocker) WHERE primary_blocker IS NOT NULL;

-- Enable RLS
ALTER TABLE public.seo_fix_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_fix_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_indexing_diagnostics ENABLE ROW LEVEL SECURITY;

-- Super admin policies
CREATE POLICY "Super admins can manage seo_fix_jobs" ON public.seo_fix_jobs
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can manage seo_fix_job_items" ON public.seo_fix_job_items
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can manage seo_content_versions" ON public.seo_content_versions
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can manage seo_indexing_diagnostics" ON public.seo_indexing_diagnostics
  FOR ALL USING (public.is_admin(auth.uid()));

-- Update trigger for updated_at
CREATE TRIGGER update_seo_fix_jobs_updated_at
  BEFORE UPDATE ON public.seo_fix_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seo_fix_job_items_updated_at
  BEFORE UPDATE ON public.seo_fix_job_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seo_indexing_diagnostics_updated_at
  BEFORE UPDATE ON public.seo_indexing_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();