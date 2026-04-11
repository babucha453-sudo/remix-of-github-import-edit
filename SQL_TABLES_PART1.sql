-- ============================================================================
-- SIMPLIFIED LISTING & CLAIM TABLES
-- Run ONE COMMAND AT A TIME in Supabase SQL Editor
-- ============================================================================

-- 1. Create listing_drafts table
CREATE TABLE listing_drafts (
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

-- 2. Enable RLS
ALTER TABLE listing_drafts ENABLE ROW LEVEL SECURITY;

-- 3. Create policy
DO $$ BEGIN
  CREATE POLICY "drafts_policy" ON listing_drafts FOR ALL USING (true);
END $$;