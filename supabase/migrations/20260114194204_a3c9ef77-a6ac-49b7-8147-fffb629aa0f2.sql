-- Add missing columns for SEO Content Optimizer
ALTER TABLE public.seo_pages 
ADD COLUMN IF NOT EXISTS seo_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_optimized boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_optimization boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS optimized_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_audited_at timestamp with time zone;

-- Create index for optimization queries
CREATE INDEX IF NOT EXISTS idx_seo_pages_needs_optimization ON public.seo_pages(needs_optimization) WHERE needs_optimization = true;
CREATE INDEX IF NOT EXISTS idx_seo_pages_seo_score ON public.seo_pages(seo_score);

-- Create SEO audit runs table for tracking batch operations
CREATE TABLE IF NOT EXISTS public.seo_audit_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type text NOT NULL DEFAULT 'audit',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  triggered_by uuid,
  total_pages integer DEFAULT 0,
  processed_pages integer DEFAULT 0,
  fixed_pages integer DEFAULT 0,
  error_count integer DEFAULT 0,
  error_log jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on seo_audit_runs
ALTER TABLE public.seo_audit_runs ENABLE ROW LEVEL SECURITY;

-- RLS policy for super_admin only
CREATE POLICY "Super admins can manage seo_audit_runs" 
ON public.seo_audit_runs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);