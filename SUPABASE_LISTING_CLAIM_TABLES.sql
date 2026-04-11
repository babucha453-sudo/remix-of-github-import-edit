-- ============================================================================
-- APPOINTPANDA LISTING & CLAIM SYSTEM TABLES
-- Updated: Fixed RLS and column issues
-- Run these commands in Supabase SQL Editor
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: listing_drafts
-- Saves progress during multi-step onboarding
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  step_1_data JSONB DEFAULT '{}',
  step_2_data JSONB DEFAULT '{}',
  step_3_data JSONB DEFAULT '{}',
  step_4_data JSONB DEFAULT '{}',
  step_5_data JSONB DEFAULT '{}',
  step_6_data JSONB DEFAULT '{}',
  step_7_data JSONB DEFAULT '{}',
  step_8_data JSONB DEFAULT '{}',
  
  current_step INTEGER DEFAULT 1,
  completion_score INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'in_progress',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE listing_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own drafts" ON listing_drafts
  FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- TABLE 2: listing_claims
-- For claiming existing listings with verification workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  claim_method TEXT DEFAULT 'business_email',
  claim_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_verified_at TIMESTAMPTZ,
  
  claimant_name TEXT,
  claimant_email TEXT,
  claimant_phone TEXT,
  claimant_role TEXT,
  proof_documents JSONB DEFAULT '[]',
  verification_notes TEXT,
  
  status TEXT DEFAULT 'initiated',
  rejection_reason TEXT,
  
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listing_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create claims" ON listing_claims
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own claims" ON listing_claims
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================================
-- TABLE 3: clinic_members
-- Manage owners and team members for each clinic
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role TEXT DEFAULT 'staff',
  status TEXT DEFAULT 'active',
  
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_members_unique 
  ON clinic_members(clinic_id, user_id);

CREATE POLICY "Team can manage members" ON clinic_members
  FOR ALL USING (
    user_id = auth.uid() OR 
    EXISTS(SELECT 1 FROM clinic_members cm2 WHERE cm2.clinic_id = clinic_id AND cm2.user_id = auth.uid() AND cm2.role IN ('owner', 'admin'))
  );

-- ============================================================================
-- TABLE 4: listing_documents
-- Verification documents, licenses, insurance, photos
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  listing_claim_id UUID REFERENCES listing_claims(id) ON DELETE SET NULL,
  
  document_type TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  
  verification_status TEXT DEFAULT 'pending',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listing_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents" ON listing_documents
  FOR ALL USING (
    EXISTS(SELECT 1 FROM clinic_members WHERE clinic_id = clinic_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ============================================================================
-- TABLE 5: onboarding_progress
-- Track user progress through listing creation
-- ============================================================================
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  current_step INTEGER DEFAULT 1,
  completed_steps JSONB DEFAULT '[]',
  skipped_steps JSONB DEFAULT '[]',
  
  basic_info_complete BOOLEAN DEFAULT false,
  location_complete BOOLEAN DEFAULT false,
  profile_complete BOOLEAN DEFAULT false,
  services_complete BOOLEAN DEFAULT false,
  insurance_complete BOOLEAN DEFAULT false,
  media_complete BOOLEAN DEFAULT false,
  verification_complete BOOLEAN DEFAULT false,
  final_review_complete BOOLEAN DEFAULT false,
  
  last_step_visited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress" ON onboarding_progress
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- TABLE 6: listing_activity_logs
-- Audit trail for all listing actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  action TEXT,
  action_details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listing_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log activities" ON listing_activity_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own clinic activities" ON listing_activity_logs
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid())
  );

-- ============================================================================
-- TABLE 7: listing_approval_logs
-- Admin actions on listings (approve, reject, suspend, verify)
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  action TEXT,
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listing_approval_logs ENABLE ROW LEVEL SECURITY;

-- Admin policy - adjust based on your admin detection method
CREATE POLICY "Admins can view approval logs" ON listing_approval_logs
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS(SELECT 1 FROM clinic_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'owner')
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_listing_drafts_user ON listing_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_drafts_status ON listing_drafts(status);
CREATE INDEX IF NOT EXISTS idx_listing_claims_clinic ON listing_claims(clinic_id);
CREATE INDEX IF NOT EXISTS idx_listing_claims_user ON listing_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_claims_status ON listing_claims(status);
CREATE INDEX IF NOT EXISTS idx_clinic_members_clinic ON clinic_members(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_members_user ON clinic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_documents_clinic ON listing_documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_listing_documents_type ON listing_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_activity_clinic ON listing_activity_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_listing_activity_created ON listing_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_approval_clinic ON listing_approval_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_listing_approval_created ON listing_approval_logs(created_at DESC);

-- ============================================================================
-- UPDATE EXISTING CLINICS TABLE - Add missing columns (without CHECK constraints)
-- ============================================================================
ALTER TABLE clinics 
  ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS listing_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS completion_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================================
-- HELPER FUNCTION: Calculate listing profile completion score
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_listing_completion(clinic_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  clinic_record RECORD;
BEGIN
  SELECT * INTO clinic_record FROM clinics WHERE id = clinic_id;
  
  IF clinic_record IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Basic Info (20%)
  IF clinic_record.name IS NOT NULL AND length(clinic_record.name) > 2 THEN
    score := score + 20;
  END IF;
  
  -- Location (15%)
  IF clinic_record.address IS NOT NULL AND clinic_record.city_id IS NOT NULL THEN
    score := score + 15;
  END IF;
  
  -- Contact (10%)
  IF clinic_record.phone IS NOT NULL OR clinic_record.email IS NOT NULL THEN
    score := score + 10;
  END IF;
  
  -- About (15%)
  IF clinic_record.description IS NOT NULL AND length(clinic_record.description) > 50 THEN
    score := score + 15;
  END IF;
  
  -- Services (15%)
  IF EXISTS(SELECT 1 FROM clinic_services WHERE clinic_id = clinic_id AND is_active = true) THEN
    score := score + 15;
  END IF;
  
  -- Media (10%)
  IF clinic_record.cover_image_url IS NOT NULL OR clinic_record.logo_url IS NOT NULL THEN
    score := score + 10;
  END IF;
  
  -- Verification (10%)
  IF clinic_record.verification_status = 'verified' THEN
    score := score + 10;
  END IF;
  
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Log listing activity
-- ============================================================================
CREATE OR REPLACE FUNCTION log_listing_activity(
  p_clinic_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_action_details JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO listing_activity_logs (clinic_id, user_id, action, action_details)
  VALUES (p_clinic_id, p_user_id, p_action, p_action_details);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Log admin approval action
-- ============================================================================
CREATE OR REPLACE FUNCTION log_approval_action(
  p_clinic_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_notes TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO listing_approval_logs (clinic_id, user_id, action, previous_status, new_status, notes)
  VALUES (p_clinic_id, p_user_id, p_action, p_previous_status, p_new_status, p_notes);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETE
-- ============================================================================