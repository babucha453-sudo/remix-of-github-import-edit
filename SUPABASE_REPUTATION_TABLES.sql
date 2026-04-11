-- ========================================================
-- REPUTATION MANAGEMENT SYSTEM - DATABASE TABLES
-- Run these in Supabase SQL Editor
-- ========================================================

-- 1. Review Campaigns Table
-- For bulk review request campaigns
CREATE TABLE IF NOT EXISTS review_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Response Templates Table
-- Auto-response templates based on rating
CREATE TABLE IF NOT EXISTS response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  rating_trigger INTEGER NOT NULL CHECK (rating_trigger BETWEEN 1 AND 5),
  response_text TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Reputation Settings Table
-- Automated workflow settings per clinic
CREATE TABLE IF NOT EXISTS reputation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
  auto_thank_you BOOLEAN DEFAULT true,
  auto_respond_5_star BOOLEAN DEFAULT true,
  auto_respond_1_2_star BOOLEAN DEFAULT true,
  reminder_after_days INTEGER DEFAULT 3,
  escalation_enabled BOOLEAN DEFAULT true,
  escalation_email TEXT,
  sla_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sentiment Analysis Cache Table
-- Cache sentiment analysis results
CREATE TABLE IF NOT EXISTS sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id TEXT NOT NULL,
  review_source TEXT NOT NULL,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  confidence DECIMAL(3,2),
  key_topics TEXT[],
  suggested_response TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Review Metrics History Table
-- Daily metrics for tracking
CREATE TABLE IF NOT EXISTS reputation_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_reviews INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  five_star_count INTEGER DEFAULT 0,
  four_star_count INTEGER DEFAULT 0,
  three_star_count INTEGER DEFAULT 0,
  two_star_count INTEGER DEFAULT 0,
  one_star_count INTEGER DEFAULT 0,
  positive_sentiment_pct DECIMAL(5,2),
  negative_sentiment_pct DECIMAL(5,2),
  response_rate DECIMAL(5,2),
  avg_response_time_hours DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, date)
);

-- ========================================================
-- SEEDS - Default Response Templates
-- ========================================================

INSERT INTO response_templates (name, rating_trigger, response_text, is_default) VALUES
  ('5-Star Thank You', 5, 'Thank you so much for the wonderful review! We are thrilled to hear you had a great experience with us. Your feedback means the world to our team and motivates us to continue delivering exceptional care. We look forward to seeing you again soon!', true),
  ('4-Star Thank You', 4, 'Thank you for the great review! We are glad you had a positive experience. We appreciate your feedback and would love to hear if there is anything we can improve on. Hope to see you again soon!', true),
  ('3-Star Follow Up', 3, 'Thank you for your feedback. We are always looking to improve our services. We would appreciate the opportunity to discuss your experience further. Please feel free to reach out to us directly.', true),
  ('2-Star Escalation', 2, 'We sincerely apologize for your experience. This is not the standard of care we strive for. We would like to make this right. Please contact us directly so we can address your concerns.', true),
  ('1-Star Urgent Escalation', 1, 'We are deeply sorry for this experience. This is unacceptable. Please contact us immediately at [ clinic phone ] so we can personally address your concerns and find a solution.', true)
ON CONFLICT DO NOTHING;

-- ========================================================
-- INDEXES - For Performance
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_review_campaigns_clinic ON review_campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_review_campaigns_status ON review_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_response_templates_rating ON response_templates(rating_trigger);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_clinic ON sentiment_analysis(clinic_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_review ON sentiment_analysis(review_id, review_source);
CREATE INDEX IF NOT EXISTS idx_reputation_metrics_daily_clinic_date ON reputation_metrics_daily(clinic_id, date);

-- ========================================================
-- ROW LEVEL SECURITY (Optional)
-- ========================================================

ALTER TABLE review_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_metrics_daily ENABLE ROW LEVEL SECURITY;

-- Dentists can only see their own data
CREATE POLICY "Dentists can view own campaigns" ON review_campaigns FOR SELECT USING (clinic_id IN (SELECT id FROM clinics WHERE claimed_by = auth.uid()));
CREATE POLICY "Dentists can view own templates" ON response_templates FOR SELECT USING (clinic_id IN (SELECT id FROM clinics WHERE claimed_by = auth.uid()) OR is_default = true);
CREATE POLICY "Admins can manage all" ON review_campaigns FOR ALL USING (true);