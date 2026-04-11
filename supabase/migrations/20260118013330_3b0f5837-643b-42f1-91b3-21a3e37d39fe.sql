-- Email Enrichment System Tables

-- Track enrichment sessions
CREATE TABLE public.email_enrichment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID REFERENCES states(id),
  city_id UUID REFERENCES cities(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  total_to_process INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track individual enrichment results
CREATE TABLE public.email_enrichment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES email_enrichment_sessions(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  website_url TEXT,
  pages_scraped TEXT[] DEFAULT '{}',
  emails_found TEXT[] DEFAULT '{}',
  email_selected TEXT,
  description_found TEXT,
  additional_data JSONB DEFAULT '{}',
  match_confidence INT DEFAULT 0 CHECK (match_confidence >= 0 AND match_confidence <= 100),
  match_method TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'no_email', 'skipped')),
  error_message TEXT,
  needs_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, clinic_id)
);

-- Track duplicate groups for manual review
CREATE TABLE public.clinic_duplicate_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_ids UUID[] NOT NULL,
  similarity_score INT DEFAULT 0,
  match_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'kept_separate', 'dismissed')),
  primary_clinic_id UUID REFERENCES clinics(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_email_enrichment_sessions_status ON email_enrichment_sessions(status);
CREATE INDEX idx_email_enrichment_sessions_state ON email_enrichment_sessions(state_id);
CREATE INDEX idx_email_enrichment_results_session ON email_enrichment_results(session_id);
CREATE INDEX idx_email_enrichment_results_clinic ON email_enrichment_results(clinic_id);
CREATE INDEX idx_email_enrichment_results_status ON email_enrichment_results(status);
CREATE INDEX idx_email_enrichment_results_needs_review ON email_enrichment_results(needs_review) WHERE needs_review = true;
CREATE INDEX idx_clinic_duplicate_groups_status ON clinic_duplicate_groups(status);

-- Enable RLS
ALTER TABLE email_enrichment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_enrichment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_duplicate_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access
CREATE POLICY "Admins can manage enrichment sessions"
ON email_enrichment_sessions FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage enrichment results"
ON email_enrichment_results FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage duplicate groups"
ON clinic_duplicate_groups FOR ALL
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_email_enrichment_sessions_updated_at
  BEFORE UPDATE ON email_enrichment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_enrichment_results_updated_at
  BEFORE UPDATE ON email_enrichment_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();