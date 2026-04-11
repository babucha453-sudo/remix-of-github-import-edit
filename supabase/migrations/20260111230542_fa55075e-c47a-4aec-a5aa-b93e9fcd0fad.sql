-- Update subscription_plans to new monthly-only structure
-- Clear existing plans and recreate with new model
DELETE FROM plan_features WHERE plan_id IN (
  SELECT id FROM subscription_plans WHERE slug IN ('starter', 'ai_growth', 'growth', 'premium', 'free', 'basic', 'professional', 'enterprise')
);

DELETE FROM subscription_plans WHERE slug IN ('starter', 'ai_growth', 'growth', 'premium', 'free', 'basic', 'professional', 'enterprise');

-- Create new monthly-only plans: Verified Presence, Growth Engine, Autopilot Growth
INSERT INTO subscription_plans (
  id, name, slug, description, price_aed, billing_period, is_active, display_order, price_yearly, features
) VALUES 
-- Free tier (unclaimed/basic listing)
(
  gen_random_uuid(), 
  'Free Listing', 
  'free', 
  'Basic visibility with unclaimed profile badge',
  0,
  'month',
  true,
  0,
  NULL,
  '{"lead_quota": 0, "verified_badge": false, "profile_control": false, "reputation_suite": false, "website_seo": false, "ai_tools": false, "priority_listing": false}'::jsonb
),
-- Tier 1: Verified Presence ($99/month)
(
  gen_random_uuid(), 
  'Verified Presence', 
  'verified-presence', 
  'Legitimacy, trust, and full profile control',
  99,
  'month',
  true,
  1,
  NULL,
  '{"lead_quota": 2, "verified_badge": true, "profile_control": true, "reputation_suite": "basic", "website_seo": false, "ai_tools": false, "priority_listing": false, "analytics": "basic"}'::jsonb
),
-- Tier 2: Growth Engine ($299/month) - Most Popular
(
  gen_random_uuid(), 
  'Growth Engine', 
  'growth-engine', 
  'Active patient demand and visibility growth',
  299,
  'month',
  true,
  2,
  NULL,
  '{"lead_quota": 6, "verified_badge": true, "profile_control": true, "reputation_suite": "full", "website_seo": true, "ai_tools": true, "priority_listing": true, "analytics": "advanced", "seo_content": true}'::jsonb
),
-- Tier 3: Autopilot Growth ($499/month)
(
  gen_random_uuid(), 
  'Autopilot Growth', 
  'autopilot-growth', 
  'Hands-off growth infrastructure for busy practices',
  499,
  'month',
  true,
  3,
  NULL,
  '{"lead_quota": 12, "verified_badge": true, "profile_control": true, "reputation_suite": "premium", "website_seo": true, "ai_tools": true, "priority_listing": true, "analytics": "enterprise", "seo_content": true, "dedicated_manager": true, "custom_website": true}'::jsonb
);

-- Insert plan features for each plan using explicit casting
-- Free plan features
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'basic_listing', true, NULL::integer FROM subscription_plans WHERE slug = 'free';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'public_reviews', true, NULL::integer FROM subscription_plans WHERE slug = 'free';

-- Verified Presence features
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'verified_badge', true, NULL::integer FROM subscription_plans WHERE slug = 'verified-presence';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'profile_control', true, NULL::integer FROM subscription_plans WHERE slug = 'verified-presence';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'enhanced_profile', true, NULL::integer FROM subscription_plans WHERE slug = 'verified-presence';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'basic_analytics', true, NULL::integer FROM subscription_plans WHERE slug = 'verified-presence';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_display', true, NULL::integer FROM subscription_plans WHERE slug = 'verified-presence';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_replies', true, 10 FROM subscription_plans WHERE slug = 'verified-presence';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'lead_tracking', true, 2 FROM subscription_plans WHERE slug = 'verified-presence';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'email_support', true, NULL::integer FROM subscription_plans WHERE slug = 'verified-presence';

-- Growth Engine features
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'verified_badge', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'profile_control', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'enhanced_profile', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'advanced_analytics', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_display', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_replies', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_manager', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'ai_reply_drafts', true, 50 FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'lead_tracking', true, 6 FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'priority_listing', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'website_seo', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'seo_content', true, 4 FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'ai_tools', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'priority_support', true, NULL::integer FROM subscription_plans WHERE slug = 'growth-engine';

-- Autopilot Growth features
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'verified_badge', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'profile_control', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'enhanced_profile', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'enterprise_analytics', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_display', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_replies', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'review_manager', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'ai_reply_drafts', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'lead_tracking', true, 12 FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'priority_listing', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'website_seo', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'seo_content', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'ai_tools', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'custom_website', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'dedicated_manager', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'phone_support', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';
INSERT INTO plan_features (plan_id, feature_key, is_enabled, usage_limit)
SELECT id, 'gmb_optimization', true, NULL::integer FROM subscription_plans WHERE slug = 'autopilot-growth';

-- Update feature registry with new features
INSERT INTO feature_registry (key, name, description, category, is_premium, display_order)
VALUES 
  ('verified_badge', 'Verified Practice Badge', 'Identity-verified trust badge on profile', 'trust', false, 1),
  ('profile_control', 'Full Profile Control', 'Edit all profile details, photos, services', 'profile', false, 2),
  ('enhanced_profile', 'Enhanced Profile', 'Services, insurance, photos, hours, staff', 'profile', false, 3),
  ('review_display', 'Public Review Display', 'Show reviews on your profile', 'reputation', false, 4),
  ('review_replies', 'Review Reply Management', 'Respond to patient reviews', 'reputation', false, 5),
  ('review_manager', 'Full Reputation Suite', 'BirdEye-style review management', 'reputation', true, 6),
  ('ai_reply_drafts', 'AI Reply Drafts', 'Gemini-powered reply suggestions', 'ai', true, 7),
  ('lead_tracking', 'Lead Intelligence', 'Track calls, forms, chat intent', 'leads', true, 8),
  ('priority_listing', 'Priority Search Ranking', 'Higher visibility in search results', 'visibility', true, 9),
  ('website_seo', 'Website & SEO', 'Platform-hosted dental website', 'marketing', true, 10),
  ('seo_content', 'SEO Content Creation', 'AI blog drafts with approval', 'marketing', true, 11),
  ('custom_website', 'Custom Website Design', 'Fully customized website design', 'marketing', true, 12),
  ('dedicated_manager', 'Dedicated Account Manager', 'Personal growth consultant', 'support', true, 13),
  ('gmb_optimization', 'GMB Optimization', 'Google Business Profile optimization', 'marketing', true, 14),
  ('basic_analytics', 'Basic Analytics', 'Profile views and basic metrics', 'analytics', false, 15),
  ('advanced_analytics', 'Advanced Analytics', 'Lead tracking and conversion metrics', 'analytics', true, 16),
  ('enterprise_analytics', 'Enterprise Analytics', 'Full business intelligence dashboard', 'analytics', true, 17)
ON CONFLICT (key) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_premium = EXCLUDED.is_premium,
  display_order = EXCLUDED.display_order;

-- Update global_settings with new pricing plans configuration
INSERT INTO global_settings (key, value, description)
VALUES (
  'pricing_plans',
  '[
    {
      "id": "verified-presence",
      "name": "Verified Presence",
      "slug": "verified-presence",
      "price_usd": 99,
      "billing_period": "month",
      "tagline": "For clinics that want legitimacy, trust, and control",
      "color": "slate",
      "lead_quota": 2,
      "features": {
        "verified_badge": {"enabled": true, "name": "Verified Practice Badge"},
        "profile_control": {"enabled": true, "name": "Full Profile Control"},
        "enhanced_profile": {"enabled": true, "name": "Enhanced Profile (photos, services, hours)"},
        "review_display": {"enabled": true, "name": "Public Review Display"},
        "review_replies": {"enabled": true, "limit": 10, "name": "AI-Assisted Review Replies"},
        "basic_analytics": {"enabled": true, "name": "Profile Views & Basic Analytics"},
        "lead_tracking": {"enabled": true, "limit": 2, "name": "Lead Tracking (2 verified leads/mo)"},
        "email_support": {"enabled": true, "name": "Email Support"}
      }
    },
    {
      "id": "growth-engine",
      "name": "Growth Engine",
      "slug": "growth-engine",
      "price_usd": 299,
      "billing_period": "month",
      "tagline": "For clinics actively seeking patient demand and visibility",
      "color": "primary",
      "popular": true,
      "lead_quota": 6,
      "features": {
        "verified_badge": {"enabled": true, "name": "Verified Practice Badge"},
        "profile_control": {"enabled": true, "name": "Full Profile Control"},
        "enhanced_profile": {"enabled": true, "name": "Enhanced Profile"},
        "review_display": {"enabled": true, "name": "Public Review Display"},
        "review_replies": {"enabled": true, "name": "Unlimited AI-Assisted Replies"},
        "review_manager": {"enabled": true, "name": "Full Reputation Suite"},
        "advanced_analytics": {"enabled": true, "name": "Advanced Analytics & Lead Intelligence"},
        "lead_tracking": {"enabled": true, "limit": 6, "name": "Lead Tracking (6 verified leads/mo)"},
        "priority_listing": {"enabled": true, "name": "Priority Search Ranking"},
        "website_seo": {"enabled": true, "name": "Platform-Hosted Website & SEO"},
        "seo_content": {"enabled": true, "limit": 4, "name": "AI Blog Drafts (4/month)"},
        "ai_tools": {"enabled": true, "name": "AI Growth Tools"},
        "priority_support": {"enabled": true, "name": "Priority Support"}
      }
    },
    {
      "id": "autopilot-growth",
      "name": "Autopilot Growth",
      "slug": "autopilot-growth",
      "price_usd": 499,
      "billing_period": "month",
      "tagline": "For practices that want hands-off growth infrastructure",
      "color": "gold",
      "lead_quota": 12,
      "features": {
        "verified_badge": {"enabled": true, "name": "Premium Verified Badge"},
        "profile_control": {"enabled": true, "name": "Full Profile Control"},
        "enhanced_profile": {"enabled": true, "name": "Enhanced Profile"},
        "review_display": {"enabled": true, "name": "Public Review Display"},
        "review_replies": {"enabled": true, "name": "Unlimited AI-Assisted Replies"},
        "review_manager": {"enabled": true, "name": "Premium Reputation Suite"},
        "enterprise_analytics": {"enabled": true, "name": "Enterprise Analytics & Insights"},
        "lead_tracking": {"enabled": true, "limit": 12, "name": "Lead Tracking (12 verified leads/mo)"},
        "priority_listing": {"enabled": true, "name": "Top Priority Search Ranking"},
        "website_seo": {"enabled": true, "name": "Custom Website & Full SEO"},
        "seo_content": {"enabled": true, "name": "Unlimited AI Blog Drafts"},
        "ai_tools": {"enabled": true, "name": "Full AI Growth Suite"},
        "custom_website": {"enabled": true, "name": "Custom Website Design"},
        "dedicated_manager": {"enabled": true, "name": "Dedicated Account Manager"},
        "gmb_optimization": {"enabled": true, "name": "GMB Optimization Assistance"},
        "phone_support": {"enabled": true, "name": "Priority Phone Support"}
      }
    }
  ]'::jsonb,
  'Monthly subscription pricing plans for dental practices'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();