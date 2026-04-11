-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, slug, description, price_aed, billing_period, is_active, display_order)
VALUES 
  (gen_random_uuid(), 'Basic', 'basic', 'Essential features for getting started', 99, 'yearly', true, 1),
  (gen_random_uuid(), 'Professional', 'professional', 'Advanced tools for growing practices', 499, 'yearly', true, 2),
  (gen_random_uuid(), 'Enterprise', 'enterprise', 'Full suite for multi-location practices', 999, 'yearly', true, 3)
ON CONFLICT (slug) DO UPDATE SET 
  price_aed = EXCLUDED.price_aed,
  description = EXCLUDED.description,
  is_active = true;

-- Insert features for each plan
-- First get plan IDs
DO $$
DECLARE
  basic_id UUID;
  professional_id UUID;
  enterprise_id UUID;
BEGIN
  SELECT id INTO basic_id FROM subscription_plans WHERE slug = 'basic';
  SELECT id INTO professional_id FROM subscription_plans WHERE slug = 'professional';
  SELECT id INTO enterprise_id FROM subscription_plans WHERE slug = 'enterprise';

  -- Basic plan features
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit) VALUES
    (basic_id, 'claim_profile', true, NULL),
    (basic_id, 'profile_listing', true, 1),
    (basic_id, 'appointment_booking', true, NULL),
    (basic_id, 'basic_analytics', true, NULL),
    (basic_id, 'review_collection', true, 10),
    (basic_id, 'email_support', true, NULL),
    (basic_id, 'verification_badge', false, NULL),
    (basic_id, 'priority_listing', false, NULL),
    (basic_id, 'sms_reminders', false, NULL),
    (basic_id, 'reputation_management', false, NULL),
    (basic_id, 'gmb_sync', false, NULL),
    (basic_id, 'review_manager', false, NULL)
  ON CONFLICT DO NOTHING;

  -- Professional plan features
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit) VALUES
    (professional_id, 'claim_profile', true, NULL),
    (professional_id, 'profile_listing', true, 3),
    (professional_id, 'appointment_booking', true, NULL),
    (professional_id, 'basic_analytics', true, NULL),
    (professional_id, 'review_collection', true, 100),
    (professional_id, 'email_support', true, NULL),
    (professional_id, 'verification_badge', true, NULL),
    (professional_id, 'priority_listing', true, NULL),
    (professional_id, 'sms_reminders', true, 200),
    (professional_id, 'reputation_management', true, NULL),
    (professional_id, 'gmb_sync', true, NULL),
    (professional_id, 'review_manager', true, NULL)
  ON CONFLICT DO NOTHING;

  -- Enterprise plan features (all unlimited)
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit) VALUES
    (enterprise_id, 'claim_profile', true, NULL),
    (enterprise_id, 'profile_listing', true, NULL),
    (enterprise_id, 'appointment_booking', true, NULL),
    (enterprise_id, 'basic_analytics', true, NULL),
    (enterprise_id, 'review_collection', true, NULL),
    (enterprise_id, 'email_support', true, NULL),
    (enterprise_id, 'verification_badge', true, NULL),
    (enterprise_id, 'priority_listing', true, NULL),
    (enterprise_id, 'sms_reminders', true, NULL),
    (enterprise_id, 'reputation_management', true, NULL),
    (enterprise_id, 'gmb_sync', true, NULL),
    (enterprise_id, 'review_manager', true, NULL),
    (enterprise_id, 'custom_branding', true, NULL),
    (enterprise_id, 'api_access', true, NULL),
    (enterprise_id, 'dedicated_manager', true, NULL)
  ON CONFLICT DO NOTHING;
END $$;