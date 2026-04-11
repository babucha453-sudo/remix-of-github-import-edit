-- ============================================
-- COMPLETE DATABASE SCHEMA FOR EXTERNAL SUPABASE
-- Generated from source database
-- Run this ONCE in your external Supabase SQL Editor
-- ============================================

-- Drop all existing tables to start fresh (OPTIONAL - uncomment if needed)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'district_manager', 'dentist', 'patient');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- CORE TABLES (in dependency order)
-- ============================================

-- Countries
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- States
CREATE TABLE IF NOT EXISTS public.states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  image_url TEXT,
  dentist_count INTEGER DEFAULT 0,
  clinic_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seo_status TEXT DEFAULT 'inactive',
  page_exists BOOLEAN DEFAULT false,
  population INTEGER,
  latitude NUMERIC,
  longitude NUMERIC,
  seo_page_id UUID,
  ai_confidence_score NUMERIC DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  auto_created BOOLEAN DEFAULT false,
  created_by_listing UUID
);

-- Insurances
CREATE TABLE IF NOT EXISTS public.insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treatments
CREATE TABLE IF NOT EXISTS public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon TEXT,
  image_url TEXT,
  price_from NUMERIC,
  price_to NUMERIC,
  duration_minutes INTEGER,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC,
  price_aed NUMERIC DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly',
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  stripe_price_id TEXT,
  max_leads INTEGER,
  max_appointments INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog Categories
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global Settings
CREATE TABLE IF NOT EXISTS public.global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feature Flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0,
  user_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Plan Features
CREATE TABLE IF NOT EXISTS public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SEO Pages
CREATE TABLE IF NOT EXISTS public.seo_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL,
  title TEXT,
  meta_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  content TEXT,
  is_thin_content BOOLEAN DEFAULT false,
  is_duplicate BOOLEAN DEFAULT false,
  word_count INTEGER DEFAULT 0,
  last_crawled_at TIMESTAMPTZ,
  last_audited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canonical_url TEXT,
  og_title TEXT,
  og_description TEXT,
  is_indexed BOOLEAN DEFAULT true,
  noindex_reason TEXT,
  similarity_score NUMERIC,
  similar_to_slug TEXT,
  metadata_hash TEXT,
  last_generated_at TIMESTAMPTZ,
  generation_version INTEGER DEFAULT 1,
  seo_score INTEGER DEFAULT 0,
  is_optimized BOOLEAN DEFAULT false,
  needs_optimization BOOLEAN DEFAULT true,
  optimized_at TIMESTAMPTZ
);

-- Cities
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID,
  state_id UUID REFERENCES public.states(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  abbreviation TEXT,
  country TEXT,
  image_url TEXT,
  dentist_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  latitude NUMERIC,
  longitude NUMERIC,
  population INTEGER,
  timezone TEXT,
  seo_status TEXT DEFAULT 'inactive',
  page_exists BOOLEAN DEFAULT false,
  seo_page_id UUID REFERENCES public.seo_pages(id),
  ai_confidence_score NUMERIC DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  auto_created BOOLEAN DEFAULT false,
  created_by_listing UUID,
  nearby_cities UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Areas
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  dentist_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinics
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  city_id UUID REFERENCES public.cities(id),
  area_id UUID REFERENCES public.areas(id),
  latitude NUMERIC,
  longitude NUMERIC,
  rating NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  google_place_id TEXT,
  cover_image_url TEXT,
  claim_status TEXT DEFAULT 'unclaimed',
  verification_status TEXT DEFAULT 'unverified',
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_group_id UUID,
  is_active BOOLEAN DEFAULT true,
  gmb_connected BOOLEAN DEFAULT false,
  gmb_data JSONB,
  location_verified BOOLEAN DEFAULT false,
  location_pending_approval BOOLEAN DEFAULT false,
  claim_emails TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dentists
CREATE TABLE IF NOT EXISTS public.dentists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT,
  specialty TEXT,
  department TEXT,
  bio TEXT,
  photo_url TEXT,
  image_url TEXT,
  years_experience INTEGER,
  education TEXT,
  languages TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  accepts_new_patients BOOLEAN DEFAULT true,
  consultation_fee NUMERIC,
  rating NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinic Treatments
CREATE TABLE IF NOT EXISTS public.clinic_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  price_from NUMERIC,
  price_to NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, treatment_id)
);

-- Clinic Insurances
CREATE TABLE IF NOT EXISTS public.clinic_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  insurance_id UUID NOT NULL REFERENCES public.insurances(id) ON DELETE CASCADE,
  UNIQUE(clinic_id, insurance_id)
);

-- Clinic Gallery
CREATE TABLE IF NOT EXISTS public.clinic_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinic Images
CREATE TABLE IF NOT EXISTS public.clinic_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinic Hours
CREATE TABLE IF NOT EXISTS public.clinic_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false
);

-- Dentist Settings
CREATE TABLE IF NOT EXISTS public.dentist_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
  booking_enabled BOOLEAN DEFAULT true,
  booking_lead_time_hours INTEGER DEFAULT 24,
  max_daily_appointments INTEGER DEFAULT 20,
  notification_email TEXT,
  notification_sms BOOLEAN DEFAULT false,
  auto_confirm BOOLEAN DEFAULT false,
  slot_duration_minutes INTEGER DEFAULT 30,
  buffer_minutes INTEGER DEFAULT 0,
  working_hours JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patients
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  insurance_id UUID,
  insurance_number TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visitor Sessions
CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  visitor_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  landing_page TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  total_pageviews INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  converted BOOLEAN DEFAULT false,
  conversion_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  city_id UUID REFERENCES public.cities(id),
  treatment_id UUID REFERENCES public.treatments(id),
  visitor_session_id UUID REFERENCES public.visitor_sessions(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'medium',
  insurance TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  is_delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  quota_counted BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointment Types
CREATE TABLE IF NOT EXISTS public.appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_from NUMERIC,
  price_to NUMERIC,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  dentist_id UUID REFERENCES public.dentists(id),
  treatment_id UUID REFERENCES public.treatments(id),
  lead_id UUID REFERENCES public.leads(id),
  patient_id UUID REFERENCES public.patients(id),
  visitor_session_id UUID REFERENCES public.visitor_sessions(id),
  appointment_type_id UUID REFERENCES public.appointment_types(id),
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  confirmed_date TEXT,
  confirmed_time TEXT,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  admin_notes TEXT,
  source TEXT DEFAULT 'website',
  is_disputed BOOLEAN DEFAULT false,
  is_returning_patient BOOLEAN DEFAULT false,
  manage_token TEXT,
  booking_page_path TEXT,
  booking_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  dentist_id UUID REFERENCES public.dentists(id),
  patient_id UUID,
  patient_name TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  source TEXT DEFAULT 'website',
  is_verified BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  response TEXT,
  responded_at TIMESTAMPTZ,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Internal Reviews
CREATE TABLE IF NOT EXISTS public.internal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  patient_id UUID REFERENCES public.patients(id),
  appointment_id UUID,
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  rating INTEGER NOT NULL,
  feedback TEXT,
  would_recommend BOOLEAN,
  is_public BOOLEAN DEFAULT false,
  follow_up_requested BOOLEAN DEFAULT false,
  token TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Google Reviews
CREATE TABLE IF NOT EXISTS public.google_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  google_review_id TEXT UNIQUE,
  author_name TEXT,
  author_url TEXT,
  profile_photo_url TEXT,
  rating INTEGER,
  comment TEXT,
  review_time TIMESTAMPTZ,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  sentiment TEXT,
  sentiment_score NUMERIC,
  ai_reply_suggestion TEXT,
  is_synced BOOLEAN DEFAULT false,
  needs_response BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Claim Requests
CREATE TABLE IF NOT EXISTS public.claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  user_id UUID NOT NULL,
  requester_name TEXT,
  requester_phone TEXT,
  requester_address TEXT,
  business_email TEXT,
  business_phone TEXT,
  status TEXT DEFAULT 'pending',
  claim_type TEXT,
  verification_method TEXT,
  verification_code TEXT,
  verification_sent_at TIMESTAMPTZ,
  verification_expires_at TIMESTAMPTZ,
  verification_attempts INTEGER DEFAULT 0,
  documents JSONB,
  domain_verified BOOLEAN DEFAULT false,
  gmb_verified BOOLEAN DEFAULT false,
  ai_confidence_score NUMERIC,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Onboarding
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  steps_completed JSONB DEFAULT '{}',
  current_step TEXT,
  is_complete BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog Topic Clusters
CREATE TABLE IF NOT EXISTS public.blog_topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name TEXT NOT NULL,
  primary_keyword TEXT NOT NULL,
  related_keywords TEXT[] DEFAULT '{}',
  pillar_page_slug TEXT,
  intent_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog Posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content JSONB,
  featured_image_url TEXT,
  author_id UUID,
  author_name TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  topic_cluster_id UUID REFERENCES public.blog_topic_clusters(id),
  similar_posts TEXT[] DEFAULT '{}',
  similarity_score NUMERIC,
  internal_links_added TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog Authors
CREATE TABLE IF NOT EXISTS public.blog_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT,
  social_links JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Static Pages
CREATE TABLE IF NOT EXISTS public.static_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  html_content TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_published BOOLEAN DEFAULT false,
  template TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Page Views
CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.visitor_sessions(id),
  page_path TEXT NOT NULL,
  page_type TEXT,
  page_title TEXT,
  entity_id UUID,
  entity_type TEXT,
  referrer TEXT,
  time_on_page INTEGER,
  scroll_depth INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visitor Events
CREATE TABLE IF NOT EXISTS public.visitor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.visitor_sessions(id),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  clinic_id UUID REFERENCES public.clinics(id),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  category TEXT,
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  satisfaction_rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket Messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID,
  sender_name TEXT,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  is_auto_reply BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  patient_id UUID REFERENCES public.patients(id),
  patient_phone TEXT,
  patient_name TEXT,
  channel TEXT DEFAULT 'sms',
  status TEXT DEFAULT 'active',
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id UUID,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  status TEXT DEFAULT 'sent',
  external_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinic Messages
CREATE TABLE IF NOT EXISTS public.clinic_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  patient_id UUID REFERENCES public.patients(id),
  crm_number_id UUID,
  recipient_phone TEXT NOT NULL,
  message_content TEXT NOT NULL,
  template_type TEXT,
  channel TEXT DEFAULT 'sms',
  direction TEXT DEFAULT 'outbound',
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRM Numbers
CREATE TABLE IF NOT EXISTS public.crm_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  friendly_name TEXT,
  provider TEXT DEFAULT 'twilio',
  status TEXT DEFAULT 'active',
  capabilities JSONB DEFAULT '{}',
  assigned_clinic_id UUID REFERENCES public.clinics(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation Rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  action_config JSONB DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  is_enabled BOOLEAN DEFAULT true,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation Logs
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.automation_rules(id),
  status TEXT NOT NULL,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outreach Templates
CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  channel TEXT DEFAULT 'email',
  template_type TEXT,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outreach Campaigns
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  template_id UUID REFERENCES public.outreach_templates(id),
  target_criteria JSONB DEFAULT '{}',
  schedule JSONB DEFAULT '{}',
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  bounce_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEO Bot Runs
CREATE TABLE IF NOT EXISTS public.seo_bot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  pages_processed INTEGER DEFAULT 0,
  pages_updated INTEGER DEFAULT 0,
  pages_created INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  logs JSONB DEFAULT '[]',
  config JSONB DEFAULT '{}',
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEO Metadata History
CREATE TABLE IF NOT EXISTS public.seo_metadata_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.seo_pages(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead Quotas
CREATE TABLE IF NOT EXISTS public.lead_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  plan_id UUID REFERENCES public.subscription_plans(id),
  leads_limit INTEGER NOT NULL DEFAULT 10,
  leads_used INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinic Subscriptions
CREATE TABLE IF NOT EXISTS public.clinic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) UNIQUE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'active',
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  amount_paid NUMERIC,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clinic Automation Settings
CREATE TABLE IF NOT EXISTS public.clinic_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) UNIQUE,
  is_messaging_enabled BOOLEAN DEFAULT false,
  reminder_channel TEXT DEFAULT 'sms',
  reminder_3_hours BOOLEAN DEFAULT true,
  reminder_1_day BOOLEAN DEFAULT true,
  reminder_2_days BOOLEAN DEFAULT false,
  followup_enabled BOOLEAN DEFAULT false,
  review_request_enabled BOOLEAN DEFAULT false,
  daily_message_limit INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinic OAuth Tokens
CREATE TABLE IF NOT EXISTS public.clinic_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) UNIQUE,
  gmb_access_token TEXT,
  gmb_refresh_token TEXT,
  gmb_account_id TEXT,
  gmb_account_email TEXT,
  gmb_location_id TEXT,
  gmb_connected BOOLEAN DEFAULT false,
  gmb_data JSONB,
  gmb_last_sync_at TIMESTAMPTZ,
  gmb_booking_link_enabled BOOLEAN DEFAULT false,
  gmb_booking_link_id TEXT,
  gmb_booking_link_set_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clinic Duplicate Groups
CREATE TABLE IF NOT EXISTS public.clinic_duplicate_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_ids UUID[] NOT NULL,
  primary_clinic_id UUID REFERENCES public.clinics(id),
  match_reason TEXT,
  similarity_score NUMERIC,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clinic Enrichment Runs
CREATE TABLE IF NOT EXISTS public.clinic_enrichment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending',
  total_clinics INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinic Membership Plans
CREATE TABLE IF NOT EXISTS public.clinic_membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC NOT NULL,
  price_yearly NUMERIC,
  benefits JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  max_members INTEGER,
  current_members INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clinic Memberships
CREATE TABLE IF NOT EXISTS public.clinic_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.clinic_membership_plans(id),
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  status TEXT DEFAULT 'active',
  billing_cycle TEXT DEFAULT 'monthly',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Availability Blocks
CREATE TABLE IF NOT EXISTS public.availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  dentist_id UUID REFERENCES public.dentists(id),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  block_type TEXT DEFAULT 'unavailable',
  reason TEXT,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Slot Locks
CREATE TABLE IF NOT EXISTS public.slot_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  dentist_id UUID REFERENCES public.dentists(id),
  slot_datetime TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  locked_by_session TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  converted_to_appointment_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Booking Notifications
CREATE TABLE IF NOT EXISTS public.booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id),
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Intake Forms
CREATE TABLE IF NOT EXISTS public.intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  name TEXT NOT NULL,
  description TEXT,
  form_schema JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  send_before_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Form Submissions
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.intake_forms(id),
  patient_id UUID REFERENCES public.patients(id),
  appointment_id UUID REFERENCES public.appointments(id),
  submission_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Review Requests
CREATE TABLE IF NOT EXISTS public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  patient_id UUID REFERENCES public.patients(id),
  appointment_id UUID REFERENCES public.appointments(id),
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  channel TEXT DEFAULT 'sms',
  status TEXT DEFAULT 'pending',
  token TEXT UNIQUE,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  internal_rating INTEGER,
  google_clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Permission Overrides
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission_key TEXT NOT NULL,
  is_granted BOOLEAN NOT NULL,
  granted_by UUID,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

-- Tab Permissions
CREATE TABLE IF NOT EXISTS public.tab_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_key TEXT NOT NULL,
  allowed_roles public.app_role[] DEFAULT '{}',
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Tables
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  channel TEXT NOT NULL DEFAULT 'chat',
  status TEXT NOT NULL DEFAULT 'active',
  outcome TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  module TEXT NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id),
  user_id UUID,
  triggered_by TEXT DEFAULT 'system',
  status TEXT DEFAULT 'pending',
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.ai_events(id),
  input_type TEXT NOT NULL,
  input_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.ai_events(id),
  output_type TEXT NOT NULL,
  output_data JSONB NOT NULL DEFAULT '{}',
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.ai_events(id),
  user_id UUID,
  action TEXT NOT NULL,
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.ai_events(id),
  error_code TEXT,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_module_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  thresholds JSONB DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  input_schema JSONB,
  output_schema JSONB,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RBAC FUNCTION (after user_roles exists)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role IN ('super_admin', 'district_manager')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.owns_clinic(_user_id uuid, _clinic_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinics 
    WHERE id = _clinic_id AND claimed_by = _user_id
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Public read policies for public-facing data
DROP POLICY IF EXISTS "Public read states" ON public.states;
CREATE POLICY "Public read states" ON public.states AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read cities" ON public.cities;
CREATE POLICY "Public read cities" ON public.cities AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read areas" ON public.areas;
CREATE POLICY "Public read areas" ON public.areas AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read clinics" ON public.clinics;
CREATE POLICY "Public read clinics" ON public.clinics AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read dentists" ON public.dentists;
CREATE POLICY "Public read dentists" ON public.dentists AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read treatments" ON public.treatments;
CREATE POLICY "Public read treatments" ON public.treatments AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read insurances" ON public.insurances;
CREATE POLICY "Public read insurances" ON public.insurances AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
CREATE POLICY "Public read reviews" ON public.reviews AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_published = true);

DROP POLICY IF EXISTS "Public read blog_posts" ON public.blog_posts;
CREATE POLICY "Public read blog_posts" ON public.blog_posts AS PERMISSIVE FOR SELECT TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS "Public read blog_categories" ON public.blog_categories;
CREATE POLICY "Public read blog_categories" ON public.blog_categories AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read blog_authors" ON public.blog_authors;
CREATE POLICY "Public read blog_authors" ON public.blog_authors AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read static_pages" ON public.static_pages;
CREATE POLICY "Public read static_pages" ON public.static_pages AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_published = true);

DROP POLICY IF EXISTS "Public read seo_pages" ON public.seo_pages;
CREATE POLICY "Public read seo_pages" ON public.seo_pages AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read subscription_plans" ON public.subscription_plans;
CREATE POLICY "Public read subscription_plans" ON public.subscription_plans AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read clinic_treatments" ON public.clinic_treatments;
CREATE POLICY "Public read clinic_treatments" ON public.clinic_treatments AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read clinic_insurances" ON public.clinic_insurances;
CREATE POLICY "Public read clinic_insurances" ON public.clinic_insurances AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read clinic_gallery" ON public.clinic_gallery;
CREATE POLICY "Public read clinic_gallery" ON public.clinic_gallery AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read clinic_images" ON public.clinic_images;
CREATE POLICY "Public read clinic_images" ON public.clinic_images AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read clinic_hours" ON public.clinic_hours;
CREATE POLICY "Public read clinic_hours" ON public.clinic_hours AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read appointment_types" ON public.appointment_types;
CREATE POLICY "Public read appointment_types" ON public.appointment_types AS PERMISSIVE FOR SELECT TO anon, authenticated USING (is_active = true);

-- Super admin full access
DROP POLICY IF EXISTS "Super admin full access states" ON public.states;
CREATE POLICY "Super admin full access states" ON public.states AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access cities" ON public.cities;
CREATE POLICY "Super admin full access cities" ON public.cities AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access clinics" ON public.clinics;
CREATE POLICY "Super admin full access clinics" ON public.clinics AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access dentists" ON public.dentists;
CREATE POLICY "Super admin full access dentists" ON public.dentists AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access leads" ON public.leads;
CREATE POLICY "Super admin full access leads" ON public.leads AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access appointments" ON public.appointments;
CREATE POLICY "Super admin full access appointments" ON public.appointments AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access reviews" ON public.reviews;
CREATE POLICY "Super admin full access reviews" ON public.reviews AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access audit_logs" ON public.audit_logs;
CREATE POLICY "Super admin full access audit_logs" ON public.audit_logs AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access global_settings" ON public.global_settings;
CREATE POLICY "Super admin full access global_settings" ON public.global_settings AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access user_roles" ON public.user_roles;
CREATE POLICY "Super admin full access user_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Dentist access to own clinic data
DROP POLICY IF EXISTS "Dentist access own clinic" ON public.clinics;
CREATE POLICY "Dentist access own clinic" ON public.clinics AS PERMISSIVE FOR ALL TO authenticated USING (claimed_by = auth.uid());

DROP POLICY IF EXISTS "Dentist access own leads" ON public.leads;
CREATE POLICY "Dentist access own leads" ON public.leads AS PERMISSIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.clinics WHERE id = leads.clinic_id AND claimed_by = auth.uid()));

DROP POLICY IF EXISTS "Dentist access own appointments" ON public.appointments;
CREATE POLICY "Dentist access own appointments" ON public.appointments AS PERMISSIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.clinics WHERE id = appointments.clinic_id AND claimed_by = auth.uid()));

DROP POLICY IF EXISTS "Dentist access own patients" ON public.patients;
CREATE POLICY "Dentist access own patients" ON public.patients AS PERMISSIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.clinics WHERE id = patients.clinic_id AND claimed_by = auth.uid()));

DROP POLICY IF EXISTS "Dentist access own reviews" ON public.reviews;
CREATE POLICY "Dentist access own reviews" ON public.reviews AS PERMISSIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.clinics WHERE id = reviews.clinic_id AND claimed_by = auth.uid()));

-- Public insert policies for leads and appointments
DROP POLICY IF EXISTS "Public insert leads" ON public.leads;
CREATE POLICY "Public insert leads" ON public.leads AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert appointments" ON public.appointments;
CREATE POLICY "Public insert appointments" ON public.appointments AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert visitor_sessions" ON public.visitor_sessions;
CREATE POLICY "Public insert visitor_sessions" ON public.visitor_sessions AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert page_views" ON public.page_views;
CREATE POLICY "Public insert page_views" ON public.page_views AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert visitor_events" ON public.visitor_events;
CREATE POLICY "Public insert visitor_events" ON public.visitor_events AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert internal_reviews" ON public.internal_reviews;
CREATE POLICY "Public insert internal_reviews" ON public.internal_reviews AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON public.cities(state_id);
CREATE INDEX IF NOT EXISTS idx_cities_slug ON public.cities(slug);
CREATE INDEX IF NOT EXISTS idx_cities_is_active ON public.cities(is_active);
CREATE INDEX IF NOT EXISTS idx_clinics_city_id ON public.clinics(city_id);
CREATE INDEX IF NOT EXISTS idx_clinics_slug ON public.clinics(slug);
CREATE INDEX IF NOT EXISTS idx_clinics_is_active ON public.clinics(is_active);
CREATE INDEX IF NOT EXISTS idx_clinics_claimed_by ON public.clinics(claimed_by);
CREATE INDEX IF NOT EXISTS idx_dentists_clinic_id ON public.dentists(clinic_id);
CREATE INDEX IF NOT EXISTS idx_dentists_slug ON public.dentists(slug);
CREATE INDEX IF NOT EXISTS idx_leads_clinic_id ON public.leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_reviews_clinic_id ON public.reviews(clinic_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_seo_pages_slug ON public.seo_pages(slug);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_session_id ON public.visitor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ============================================
-- DONE! Schema is ready for data migration
-- ============================================
