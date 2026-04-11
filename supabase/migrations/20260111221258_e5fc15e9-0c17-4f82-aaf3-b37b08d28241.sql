-- ============================================
-- PHASE 1: COMPREHENSIVE PLATFORM UPDATE (FIXED)
-- ============================================

-- 1. ALTER subscription_plans to support both monthly and yearly pricing
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_yearly NUMERIC;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';

-- Rename price_aed to price_monthly if it exists (keep for backwards compat)
UPDATE subscription_plans SET price_monthly = price_aed WHERE price_monthly IS NULL AND price_aed IS NOT NULL;

-- 2. UPDATE SUBSCRIPTION PLANS - New structure with monthly/annual options
UPDATE subscription_plans SET is_active = false WHERE slug IN ('basic', 'professional', 'enterprise');

-- Create new plan tiers
INSERT INTO subscription_plans (slug, name, description, price_monthly, price_yearly, billing_period, is_active, features, display_order)
VALUES 
  ('starter', 'Starter', 'Essential visibility for your practice', 99, 999, 'both', true, 
   '{"leads_per_year": 2, "verified_listing": true, "basic_analytics": true, "basic_reputation": true}', 1),
  
  ('growth', 'Growth', 'Accelerate your practice growth with AI-powered tools', 499, 4999, 'both', true,
   '{"leads_per_year": 6, "verified_listing": true, "featured_placement": true, "online_booking": true, "ai_assistant": true, "insurance_eligibility": true, "advanced_reputation": true, "marketing_toolkit": true}', 2),
  
  ('ai_growth', 'AI Growth', 'Perfect balance of AI features and value', 299, 2999, 'both', true,
   '{"leads_per_year": 4, "verified_listing": true, "online_booking": true, "ai_assistant": true, "ai_review_replies": true, "basic_analytics": true}', 3),
  
  ('premium', 'Premium', 'Complete solution for ambitious practices', 999, 9999, 'both', true,
   '{"leads_per_year": 12, "verified_listing": true, "featured_placement": true, "priority_placement": true, "online_booking": true, "ai_assistant": true, "ai_analytics": true, "insurance_eligibility": true, "telehealth": true, "membership_plans": true, "advanced_marketing": true, "dedicated_manager": true, "hipaa_compliance": true}', 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  billing_period = EXCLUDED.billing_period,
  is_active = EXCLUDED.is_active,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;

-- 3. LEAD MANAGEMENT SYSTEM
CREATE TABLE IF NOT EXISTS lead_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  quota_limit INTEGER NOT NULL DEFAULT 2,
  leads_used INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 year'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(clinic_id)
);

ALTER TABLE lead_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead quotas" ON lead_quotas
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Clinic owners can view their quotas" ON lead_quotas
  FOR SELECT USING (public.owns_clinic(auth.uid(), clinic_id));

-- 4. PROVIDER VERIFICATION SYSTEM
CREATE TABLE IF NOT EXISTS provider_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES dentists(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  documents JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE provider_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage verifications" ON provider_verifications
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Providers can view own verifications" ON provider_verifications
  FOR SELECT USING (
    clinic_id IN (SELECT id FROM clinics WHERE claimed_by = auth.uid()) OR
    dentist_id IN (SELECT id FROM dentists WHERE clinic_id IN (SELECT id FROM clinics WHERE claimed_by = auth.uid()))
  );

-- 5. PROFILE ANALYTICS TRACKING
CREATE TABLE IF NOT EXISTS profile_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES dentists(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE profile_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all analytics" ON profile_analytics
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Clinic owners can view their analytics" ON profile_analytics
  FOR SELECT USING (public.owns_clinic(auth.uid(), clinic_id));

CREATE POLICY "Anyone can insert analytics" ON profile_analytics
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_profile_analytics_clinic_created ON profile_analytics(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_analytics_event_type ON profile_analytics(event_type, created_at DESC);

-- 6. AI ASSISTANT CONVERSATIONS
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  channel TEXT NOT NULL DEFAULT 'chat',
  status TEXT NOT NULL DEFAULT 'active',
  outcome TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage AI conversations" ON ai_conversations
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Clinic owners can view their conversations" ON ai_conversations
  FOR SELECT USING (public.owns_clinic(auth.uid(), clinic_id));

CREATE POLICY "Anyone can insert conversations" ON ai_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage AI messages" ON ai_messages
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can insert messages" ON ai_messages
  FOR INSERT WITH CHECK (true);

-- 7. MEMBERSHIP PLANS (for clinics to create their own)
CREATE TABLE IF NOT EXISTS clinic_membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  benefits JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  max_members INTEGER,
  current_members INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinic_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES clinic_membership_plans(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE clinic_membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage membership plans" ON clinic_membership_plans
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Clinic owners can manage their membership plans" ON clinic_membership_plans
  FOR ALL USING (public.owns_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage memberships" ON clinic_memberships
  FOR ALL USING (public.is_admin(auth.uid()));

-- 8. PAYMENT TRANSACTIONS LOG
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES clinic_subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all transactions" ON payment_transactions
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Clinic owners can view their transactions" ON payment_transactions
  FOR SELECT USING (public.owns_clinic(auth.uid(), clinic_id));

-- 9. HIPAA AUDIT LOG
CREATE TABLE IF NOT EXISTS hipaa_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  risk_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE hipaa_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view HIPAA logs" ON hipaa_audit_log
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert HIPAA logs" ON hipaa_audit_log
  FOR INSERT WITH CHECK (true);

-- 10. ADD REVIEW SENTIMENT TRACKING
ALTER TABLE internal_reviews ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE internal_reviews ADD COLUMN IF NOT EXISTS sentiment_label TEXT;
ALTER TABLE internal_reviews ADD COLUMN IF NOT EXISTS hipaa_flagged BOOLEAN DEFAULT false;
ALTER TABLE internal_reviews ADD COLUMN IF NOT EXISTS hipaa_flag_reason TEXT;

ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS sentiment_label TEXT;
ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS hipaa_flagged BOOLEAN DEFAULT false;
ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS hipaa_flag_reason TEXT;

-- 11. UPDATE CLINIC SUBSCRIPTIONS FOR BILLING CYCLE
ALTER TABLE clinic_subscriptions ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'yearly';
ALTER TABLE clinic_subscriptions ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2);
ALTER TABLE clinic_subscriptions ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;

-- 12. LEAD DELIVERY TRACKING
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quota_counted BOOLEAN DEFAULT false;

-- 13. Create function to track lead quota usage
CREATE OR REPLACE FUNCTION public.increment_lead_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_delivered = true AND (OLD.is_delivered IS NULL OR OLD.is_delivered = false) THEN
    UPDATE lead_quotas 
    SET leads_used = leads_used + 1, updated_at = now()
    WHERE clinic_id = NEW.clinic_id 
    AND period_end > now();
    
    NEW.quota_counted = true;
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_increment_lead_quota ON leads;
CREATE TRIGGER trigger_increment_lead_quota
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION increment_lead_quota();

-- 14. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_quotas_clinic ON lead_quotas(clinic_id);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_clinic ON provider_verifications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_status ON provider_verifications(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_clinic ON ai_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_clinic ON payment_transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_log_clinic ON hipaa_audit_log(clinic_id);