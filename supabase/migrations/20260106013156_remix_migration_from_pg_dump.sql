CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'district_manager',
    'dentist',
    'patient'
);


--
-- Name: professional_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.professional_type AS ENUM (
    'dentist',
    'hygienist',
    'assistant',
    'orthodontist',
    'endodontist',
    'periodontist',
    'prosthodontist',
    'oral_surgeon',
    'pediatric_dentist',
    'receptionist',
    'practice_manager'
);


--
-- Name: has_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(_user_id uuid, _permission text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _override RECORD;
  _role_perms TEXT[];
BEGIN
  -- Check for per-user override first
  SELECT * INTO _override FROM public.user_permission_overrides
  WHERE user_id = _user_id 
    AND permission_key = _permission
    AND (expires_at IS NULL OR expires_at > now());
  
  IF FOUND THEN
    RETURN _override.is_granted;
  END IF;
  
  -- Check if user is super_admin (has all permissions)
  IF has_role(_user_id, 'super_admin') THEN
    RETURN true;
  END IF;
  
  -- Check role-based permissions from global_settings
  SELECT (value->>ur.role::TEXT)::TEXT[] INTO _role_perms
  FROM public.global_settings gs, public.user_roles ur
  WHERE gs.key = 'role_permissions'
    AND ur.user_id = _user_id
  LIMIT 1;
  
  IF _role_perms IS NOT NULL AND ('*' = ANY(_role_perms) OR _permission = ANY(_role_perms)) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'district_manager')
  )
$$;


--
-- Name: notify_new_booking(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_booking() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.booking_notifications (appointment_id, title, message, notification_type)
  VALUES (
    NEW.id,
    'New Booking Request',
    'New appointment request from ' || NEW.patient_name || ' for ' || COALESCE(NEW.preferred_date, 'unspecified date'),
    'new_booking'
  );
  RETURN NEW;
END;
$$;


--
-- Name: owns_clinic(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_clinic(_user_id uuid, _clinic_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE id = _clinic_id
      AND claimed_by = _user_id
  )
$$;


--
-- Name: set_audit_log_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_audit_log_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_role IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT ur.role::text
      INTO NEW.user_role
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.user_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: ai_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid,
    error_code text,
    error_message text NOT NULL,
    stack_trace text,
    context_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    module text NOT NULL,
    clinic_id uuid,
    user_id uuid,
    triggered_by text DEFAULT 'system'::text,
    status text DEFAULT 'pending'::text,
    confidence_score numeric(5,2),
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: ai_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    feedback_notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_inputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_inputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    input_type text NOT NULL,
    input_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_module_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_module_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    is_enabled boolean DEFAULT true,
    config jsonb DEFAULT '{}'::jsonb,
    thresholds jsonb DEFAULT '{}'::jsonb,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    output_type text NOT NULL,
    output_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    explanation text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_prompt_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompt_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    module text NOT NULL,
    description text,
    prompt_template text NOT NULL,
    input_schema jsonb,
    output_schema jsonb,
    is_active boolean DEFAULT true,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    dentist_id uuid,
    treatment_id uuid,
    lead_id uuid,
    patient_id uuid,
    patient_name text NOT NULL,
    patient_phone text NOT NULL,
    patient_email text,
    preferred_date text,
    preferred_time text,
    confirmed_date text,
    confirmed_time text,
    status text DEFAULT 'pending'::text,
    notes text,
    admin_notes text,
    source text DEFAULT 'website'::text,
    is_disputed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image_url text,
    dentist_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email text,
    user_role text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    old_values jsonb,
    new_values jsonb,
    metadata jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid,
    status text NOT NULL,
    error_message text,
    details jsonb,
    executed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    rule_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_enabled boolean DEFAULT false,
    run_count integer DEFAULT 0,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text,
    featured_image_url text,
    author_id uuid,
    author_name text,
    category text,
    tags text[],
    status text DEFAULT 'draft'::text,
    is_featured boolean DEFAULT false,
    seo_title text,
    seo_description text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid,
    user_id uuid,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    notification_type text DEFAULT 'new_booking'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    country text,
    image_url text,
    dentist_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claim_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    user_id uuid NOT NULL,
    business_email text,
    business_phone text,
    verification_method text DEFAULT 'email'::text,
    verification_code text,
    verification_sent_at timestamp with time zone,
    verification_expires_at timestamp with time zone,
    verification_attempts integer DEFAULT 0,
    status text DEFAULT 'pending'::text,
    admin_notes text,
    documents jsonb,
    ai_confidence_score numeric(3,2),
    domain_verified boolean DEFAULT false,
    gmb_verified boolean DEFAULT false,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinic_automation_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_automation_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    reminder_2_days boolean DEFAULT true,
    reminder_1_day boolean DEFAULT true,
    reminder_3_hours boolean DEFAULT false,
    reminder_channel text DEFAULT 'sms'::text,
    followup_enabled boolean DEFAULT true,
    review_request_enabled boolean DEFAULT true,
    is_messaging_enabled boolean DEFAULT true,
    daily_message_limit integer DEFAULT 50,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinic_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    open_time text,
    close_time text,
    is_closed boolean DEFAULT false
);


--
-- Name: clinic_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    image_url text NOT NULL,
    caption text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinic_insurances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_insurances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    insurance_id uuid NOT NULL
);


--
-- Name: clinic_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    patient_id uuid,
    crm_number_id uuid,
    direction text DEFAULT 'outbound'::text NOT NULL,
    channel text DEFAULT 'sms'::text NOT NULL,
    recipient_phone text NOT NULL,
    message_content text NOT NULL,
    template_type text,
    status text DEFAULT 'pending'::text,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinic_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status text DEFAULT 'active'::text,
    starts_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    stripe_subscription_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: clinic_treatments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_treatments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    treatment_id uuid NOT NULL,
    price_from numeric(10,2),
    price_to numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    address text,
    phone text,
    email text,
    website text,
    city_id uuid,
    area_id uuid,
    latitude numeric(10,7),
    longitude numeric(10,7),
    rating numeric(2,1) DEFAULT 0,
    review_count integer DEFAULT 0,
    source text DEFAULT 'manual'::text,
    google_place_id text,
    gmb_data jsonb,
    cover_image_url text,
    claim_status text DEFAULT 'unclaimed'::text,
    verification_status text DEFAULT 'unverified'::text,
    claimed_by uuid,
    claimed_at timestamp with time zone,
    is_duplicate boolean DEFAULT false,
    duplicate_group_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gmb_connected boolean DEFAULT false NOT NULL,
    gmb_account_email text,
    gmb_location_id text,
    gmb_account_id text,
    gmb_last_sync_at timestamp with time zone,
    gmb_access_token text,
    gmb_refresh_token text,
    location_verified boolean DEFAULT false,
    location_pending_approval boolean DEFAULT false
);


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    code text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    phone_number text NOT NULL,
    provider text DEFAULT 'twilio'::text,
    is_active boolean DEFAULT true,
    is_whatsapp_enabled boolean DEFAULT false,
    assigned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dentists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dentists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    title text,
    bio text,
    phone text,
    email text,
    image_url text,
    clinic_id uuid,
    specializations text[],
    languages text[],
    years_experience integer,
    rating numeric(2,1) DEFAULT 0,
    review_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    professional_type text DEFAULT 'dentist'::text,
    is_primary boolean DEFAULT false,
    license_number text,
    department text
);


--
-- Name: district_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.district_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    city text NOT NULL,
    area text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    subject text NOT NULL,
    html_content text NOT NULL,
    plain_content text,
    category text DEFAULT 'general'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_unsubscribes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_unsubscribes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    clinic_id uuid,
    reason text,
    unsubscribed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feature_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_registry (
    key text NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'general'::text,
    is_premium boolean DEFAULT false,
    display_order integer DEFAULT 0
);


--
-- Name: global_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gmb_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmb_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    search_query text,
    total_found integer DEFAULT 0,
    imported_count integer DEFAULT 0,
    duplicate_count integer DEFAULT 0,
    status text DEFAULT 'pending'::text,
    completed_at timestamp with time zone,
    error_log jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gmb_link_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmb_link_requests (
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    initiated_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consumed_at timestamp with time zone
);


--
-- Name: google_oauth_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_oauth_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    google_account_email text NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp with time zone,
    scopes text[] DEFAULT ARRAY[]::text[],
    gmb_connected boolean DEFAULT false,
    last_token_refresh_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: google_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    request_id uuid,
    google_review_id text,
    author_name text NOT NULL,
    author_photo_url text,
    rating integer NOT NULL,
    text_content text,
    review_time timestamp with time zone,
    reply_text text,
    reply_time timestamp with time zone,
    is_matched_to_request boolean DEFAULT false,
    matched_at timestamp with time zone,
    ai_suggested_reply text,
    reply_status text DEFAULT 'pending'::text,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT google_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT google_reviews_reply_status_check CHECK ((reply_status = ANY (ARRAY['pending'::text, 'drafted'::text, 'approved'::text, 'posted'::text, 'skipped'::text])))
);


--
-- Name: insurances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: internal_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    dentist_id uuid,
    patient_id uuid,
    request_id uuid,
    patient_name text NOT NULL,
    patient_email text,
    patient_phone text,
    rating integer NOT NULL,
    comment text,
    status text DEFAULT 'new'::text NOT NULL,
    resolution_notes text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    is_fake_suspected boolean DEFAULT false,
    fake_review_reason text,
    ai_suggested_response text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT internal_reviews_status_check CHECK ((status = ANY (ARRAY['new'::text, 'acknowledged'::text, 'follow_up'::text, 'resolved'::text, 'flagged_fake'::text])))
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    dentist_id uuid,
    treatment_id uuid,
    patient_name text NOT NULL,
    patient_email text,
    patient_phone text NOT NULL,
    preferred_date text,
    preferred_time text,
    message text,
    status text DEFAULT 'new'::text,
    source text DEFAULT 'website'::text,
    contacted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outreach_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    template_id uuid,
    target_filter jsonb DEFAULT '{}'::jsonb NOT NULL,
    schedule_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    max_sends_per_day integer DEFAULT 50,
    max_sends_per_clinic integer DEFAULT 3,
    is_active boolean DEFAULT false,
    total_sent integer DEFAULT 0,
    total_opened integer DEFAULT 0,
    total_clicked integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outreach_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    template_id uuid,
    clinic_id uuid,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error_message text,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    notes text,
    source text DEFAULT 'appointment'::text,
    first_visit_at timestamp with time zone,
    last_visit_at timestamp with time zone,
    total_visits integer DEFAULT 0,
    is_opted_in_sms boolean DEFAULT true,
    is_opted_in_whatsapp boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pending_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    city_id uuid NOT NULL,
    suggested_name text NOT NULL,
    suggested_slug text NOT NULL,
    submitted_by uuid NOT NULL,
    status text DEFAULT 'pending'::text,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pending_areas_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: plan_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    feature_key text NOT NULL,
    is_enabled boolean DEFAULT true,
    usage_limit integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: platform_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_type text NOT NULL,
    title text NOT NULL,
    message text,
    severity text DEFAULT 'info'::text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text,
    title text NOT NULL,
    message text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    action_type text,
    action_url text,
    action_data jsonb,
    entity_type text,
    entity_id text,
    is_read boolean DEFAULT false NOT NULL,
    is_dismissed boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reputation_kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reputation_kpis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    requests_sent integer DEFAULT 0,
    links_opened integer DEFAULT 0,
    positive_intents integer DEFAULT 0,
    negative_intents integer DEFAULT 0,
    google_redirects integer DEFAULT 0,
    google_reviews_received integer DEFAULT 0,
    internal_feedbacks integer DEFAULT 0,
    avg_google_rating numeric(2,1),
    total_google_reviews integer DEFAULT 0,
    response_rate numeric(5,2) DEFAULT 0,
    avg_resolution_time_hours numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    clinic_id uuid NOT NULL,
    action text NOT NULL,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_clicks_action_check CHECK ((action = ANY (ARRAY['link_opened'::text, 'thumbs_up'::text, 'thumbs_down'::text, 'google_redirect'::text, 'feedback_submitted'::text])))
);


--
-- Name: review_funnel_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_funnel_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    source text DEFAULT 'link'::text NOT NULL,
    event_type text NOT NULL,
    rating integer,
    comment text,
    visitor_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    patient_id uuid,
    recipient_name text,
    recipient_phone text NOT NULL,
    channel text DEFAULT 'sms'::text,
    template_type text DEFAULT 'review_request'::text,
    message_content text,
    status text DEFAULT 'pending'::text,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    dentist_id uuid,
    patient_name text,
    patient_email text,
    short_code text DEFAULT substr(md5((random())::text), 1, 8),
    opened_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    outcome text,
    google_redirect_clicked boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT review_requests_outcome_check CHECK ((outcome = ANY (ARRAY['positive'::text, 'negative'::text, 'no_action'::text])))
);


--
-- Name: role_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seo_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seo_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    page_type text NOT NULL,
    title text,
    meta_title text,
    meta_description text,
    h1 text,
    content text,
    is_thin_content boolean DEFAULT false,
    is_duplicate boolean DEFAULT false,
    word_count integer DEFAULT 0,
    last_crawled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seo_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seo_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    task_type text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    page_url text,
    target_keyword text,
    current_position integer,
    suggested_action text,
    ai_confidence numeric(3,2),
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    ai_suggestion text
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    price_aed numeric DEFAULT 0,
    billing_period text DEFAULT 'yearly'::text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_ticket_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    user_id uuid NOT NULL,
    category text NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'medium'::text,
    assigned_to uuid,
    ai_suggested_category text,
    ai_urgency_score integer,
    resolution_notes text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: treatments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    image_url text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_onboarding (
    user_id uuid NOT NULL,
    onboarding_status text DEFAULT 'not_started'::text NOT NULL,
    first_login_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    google_auth_connected boolean DEFAULT false,
    gmb_profile_synced boolean DEFAULT false,
    gmb_business_count integer DEFAULT 0
);


--
-- Name: user_permission_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permission_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    permission_key text NOT NULL,
    is_granted boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    granted_by uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_errors ai_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_errors
    ADD CONSTRAINT ai_errors_pkey PRIMARY KEY (id);


--
-- Name: ai_events ai_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_events
    ADD CONSTRAINT ai_events_pkey PRIMARY KEY (id);


--
-- Name: ai_feedback ai_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_pkey PRIMARY KEY (id);


--
-- Name: ai_inputs ai_inputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_inputs
    ADD CONSTRAINT ai_inputs_pkey PRIMARY KEY (id);


--
-- Name: ai_module_settings ai_module_settings_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_module_settings
    ADD CONSTRAINT ai_module_settings_module_key UNIQUE (module);


--
-- Name: ai_module_settings ai_module_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_module_settings
    ADD CONSTRAINT ai_module_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_outputs ai_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_outputs
    ADD CONSTRAINT ai_outputs_pkey PRIMARY KEY (id);


--
-- Name: ai_prompt_templates ai_prompt_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompt_templates
    ADD CONSTRAINT ai_prompt_templates_name_key UNIQUE (name);


--
-- Name: ai_prompt_templates ai_prompt_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompt_templates
    ADD CONSTRAINT ai_prompt_templates_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: areas areas_city_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_city_id_slug_key UNIQUE (city_id, slug);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: areas areas_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_slug_unique UNIQUE (slug);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_logs automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: booking_notifications booking_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_pkey PRIMARY KEY (id);


--
-- Name: cities cities_country_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_country_id_slug_key UNIQUE (country_id, slug);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: claim_requests claim_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_requests
    ADD CONSTRAINT claim_requests_pkey PRIMARY KEY (id);


--
-- Name: clinic_automation_settings clinic_automation_settings_clinic_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_automation_settings
    ADD CONSTRAINT clinic_automation_settings_clinic_id_key UNIQUE (clinic_id);


--
-- Name: clinic_automation_settings clinic_automation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_automation_settings
    ADD CONSTRAINT clinic_automation_settings_pkey PRIMARY KEY (id);


--
-- Name: clinic_hours clinic_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_hours
    ADD CONSTRAINT clinic_hours_pkey PRIMARY KEY (id);


--
-- Name: clinic_images clinic_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_images
    ADD CONSTRAINT clinic_images_pkey PRIMARY KEY (id);


--
-- Name: clinic_insurances clinic_insurances_clinic_id_insurance_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_insurances
    ADD CONSTRAINT clinic_insurances_clinic_id_insurance_id_key UNIQUE (clinic_id, insurance_id);


--
-- Name: clinic_insurances clinic_insurances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_insurances
    ADD CONSTRAINT clinic_insurances_pkey PRIMARY KEY (id);


--
-- Name: clinic_messages clinic_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_messages
    ADD CONSTRAINT clinic_messages_pkey PRIMARY KEY (id);


--
-- Name: clinic_subscriptions clinic_subscriptions_clinic_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_subscriptions
    ADD CONSTRAINT clinic_subscriptions_clinic_id_key UNIQUE (clinic_id);


--
-- Name: clinic_subscriptions clinic_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_subscriptions
    ADD CONSTRAINT clinic_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: clinic_treatments clinic_treatments_clinic_id_treatment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_treatments
    ADD CONSTRAINT clinic_treatments_clinic_id_treatment_id_key UNIQUE (clinic_id, treatment_id);


--
-- Name: clinic_treatments clinic_treatments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_treatments
    ADD CONSTRAINT clinic_treatments_pkey PRIMARY KEY (id);


--
-- Name: clinics clinics_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_google_place_id_key UNIQUE (google_place_id);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);


--
-- Name: clinics clinics_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_slug_key UNIQUE (slug);


--
-- Name: countries countries_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_code_key UNIQUE (code);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: countries countries_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_slug_key UNIQUE (slug);


--
-- Name: crm_numbers crm_numbers_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_numbers
    ADD CONSTRAINT crm_numbers_phone_number_key UNIQUE (phone_number);


--
-- Name: crm_numbers crm_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_numbers
    ADD CONSTRAINT crm_numbers_pkey PRIMARY KEY (id);


--
-- Name: dentists dentists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dentists
    ADD CONSTRAINT dentists_pkey PRIMARY KEY (id);


--
-- Name: dentists dentists_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dentists
    ADD CONSTRAINT dentists_slug_key UNIQUE (slug);


--
-- Name: district_assignments district_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.district_assignments
    ADD CONSTRAINT district_assignments_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_slug_key UNIQUE (slug);


--
-- Name: email_unsubscribes email_unsubscribes_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribes
    ADD CONSTRAINT email_unsubscribes_email_key UNIQUE (email);


--
-- Name: email_unsubscribes email_unsubscribes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribes
    ADD CONSTRAINT email_unsubscribes_pkey PRIMARY KEY (id);


--
-- Name: feature_registry feature_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_registry
    ADD CONSTRAINT feature_registry_pkey PRIMARY KEY (key);


--
-- Name: global_settings global_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_settings
    ADD CONSTRAINT global_settings_key_key UNIQUE (key);


--
-- Name: global_settings global_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_settings
    ADD CONSTRAINT global_settings_pkey PRIMARY KEY (id);


--
-- Name: gmb_imports gmb_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmb_imports
    ADD CONSTRAINT gmb_imports_pkey PRIMARY KEY (id);


--
-- Name: gmb_link_requests gmb_link_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmb_link_requests
    ADD CONSTRAINT gmb_link_requests_pkey PRIMARY KEY (token);


--
-- Name: google_oauth_accounts google_oauth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_oauth_accounts
    ADD CONSTRAINT google_oauth_accounts_pkey PRIMARY KEY (id);


--
-- Name: google_oauth_accounts google_oauth_accounts_user_id_google_account_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_oauth_accounts
    ADD CONSTRAINT google_oauth_accounts_user_id_google_account_email_key UNIQUE (user_id, google_account_email);


--
-- Name: google_reviews google_reviews_google_review_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_reviews
    ADD CONSTRAINT google_reviews_google_review_id_key UNIQUE (google_review_id);


--
-- Name: google_reviews google_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_reviews
    ADD CONSTRAINT google_reviews_pkey PRIMARY KEY (id);


--
-- Name: insurances insurances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurances
    ADD CONSTRAINT insurances_pkey PRIMARY KEY (id);


--
-- Name: insurances insurances_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurances
    ADD CONSTRAINT insurances_slug_key UNIQUE (slug);


--
-- Name: internal_reviews internal_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_reviews
    ADD CONSTRAINT internal_reviews_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: outreach_campaigns outreach_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campaigns
    ADD CONSTRAINT outreach_campaigns_pkey PRIMARY KEY (id);


--
-- Name: outreach_messages outreach_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_messages
    ADD CONSTRAINT outreach_messages_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: pending_areas pending_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_areas
    ADD CONSTRAINT pending_areas_pkey PRIMARY KEY (id);


--
-- Name: plan_features plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_pkey PRIMARY KEY (id);


--
-- Name: plan_features plan_features_plan_id_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_plan_id_feature_key_key UNIQUE (plan_id, feature_key);


--
-- Name: platform_alerts platform_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_alerts
    ADD CONSTRAINT platform_alerts_pkey PRIMARY KEY (id);


--
-- Name: platform_notifications platform_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_notifications
    ADD CONSTRAINT platform_notifications_pkey PRIMARY KEY (id);


--
-- Name: reputation_kpis reputation_kpis_clinic_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reputation_kpis
    ADD CONSTRAINT reputation_kpis_clinic_id_date_key UNIQUE (clinic_id, date);


--
-- Name: reputation_kpis reputation_kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reputation_kpis
    ADD CONSTRAINT reputation_kpis_pkey PRIMARY KEY (id);


--
-- Name: review_clicks review_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_clicks
    ADD CONSTRAINT review_clicks_pkey PRIMARY KEY (id);


--
-- Name: review_funnel_events review_funnel_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_funnel_events
    ADD CONSTRAINT review_funnel_events_pkey PRIMARY KEY (id);


--
-- Name: review_requests review_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_pkey PRIMARY KEY (id);


--
-- Name: review_requests review_requests_short_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_short_code_key UNIQUE (short_code);


--
-- Name: role_presets role_presets_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_presets
    ADD CONSTRAINT role_presets_name_key UNIQUE (name);


--
-- Name: role_presets role_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_presets
    ADD CONSTRAINT role_presets_pkey PRIMARY KEY (id);


--
-- Name: seo_pages seo_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_pages
    ADD CONSTRAINT seo_pages_pkey PRIMARY KEY (id);


--
-- Name: seo_pages seo_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_pages
    ADD CONSTRAINT seo_pages_slug_key UNIQUE (slug);


--
-- Name: seo_tasks seo_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_tasks
    ADD CONSTRAINT seo_tasks_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);


--
-- Name: support_ticket_replies support_ticket_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_replies
    ADD CONSTRAINT support_ticket_replies_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: treatments treatments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatments
    ADD CONSTRAINT treatments_pkey PRIMARY KEY (id);


--
-- Name: treatments treatments_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatments
    ADD CONSTRAINT treatments_slug_key UNIQUE (slug);


--
-- Name: treatments treatments_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatments
    ADD CONSTRAINT treatments_slug_unique UNIQUE (slug);


--
-- Name: user_onboarding user_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_pkey PRIMARY KEY (user_id);


--
-- Name: user_permission_overrides user_permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id);


--
-- Name: user_permission_overrides user_permission_overrides_user_id_permission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_permission_key_key UNIQUE (user_id, permission_key);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_ai_events_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_events_clinic ON public.ai_events USING btree (clinic_id);


--
-- Name: idx_ai_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_events_created ON public.ai_events USING btree (created_at DESC);


--
-- Name: idx_ai_events_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_events_module ON public.ai_events USING btree (module);


--
-- Name: idx_ai_feedback_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feedback_event ON public.ai_feedback USING btree (event_id);


--
-- Name: idx_ai_outputs_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_outputs_event ON public.ai_outputs USING btree (event_id);


--
-- Name: idx_areas_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_areas_city ON public.areas USING btree (city_id);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_automation_logs_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_logs_rule ON public.automation_logs USING btree (rule_id);


--
-- Name: idx_blog_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status);


--
-- Name: idx_clinic_messages_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_messages_clinic ON public.clinic_messages USING btree (clinic_id);


--
-- Name: idx_clinic_messages_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_messages_patient ON public.clinic_messages USING btree (patient_id);


--
-- Name: idx_clinic_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_messages_status ON public.clinic_messages USING btree (status);


--
-- Name: idx_clinic_subscriptions_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_subscriptions_clinic ON public.clinic_subscriptions USING btree (clinic_id);


--
-- Name: idx_clinic_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_subscriptions_status ON public.clinic_subscriptions USING btree (status);


--
-- Name: idx_clinics_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_area ON public.clinics USING btree (area_id);


--
-- Name: idx_clinics_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_city ON public.clinics USING btree (city_id);


--
-- Name: idx_clinics_claim_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_claim_status ON public.clinics USING btree (claim_status);


--
-- Name: idx_clinics_gmb_connected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_gmb_connected ON public.clinics USING btree (gmb_connected);


--
-- Name: idx_clinics_location_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_location_verified ON public.clinics USING btree (location_verified);


--
-- Name: idx_clinics_verification_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_verification_status ON public.clinics USING btree (verification_status);


--
-- Name: idx_dentists_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dentists_clinic ON public.dentists USING btree (clinic_id);


--
-- Name: idx_gmb_link_requests_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gmb_link_requests_clinic_id ON public.gmb_link_requests USING btree (clinic_id);


--
-- Name: idx_gmb_link_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gmb_link_requests_created_at ON public.gmb_link_requests USING btree (created_at DESC);


--
-- Name: idx_gmb_link_requests_initiated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gmb_link_requests_initiated_by ON public.gmb_link_requests USING btree (initiated_by);


--
-- Name: idx_google_oauth_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_google_oauth_accounts_user_id ON public.google_oauth_accounts USING btree (user_id);


--
-- Name: idx_google_reviews_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_google_reviews_clinic ON public.google_reviews USING btree (clinic_id);


--
-- Name: idx_internal_reviews_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_reviews_clinic ON public.internal_reviews USING btree (clinic_id);


--
-- Name: idx_internal_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_reviews_status ON public.internal_reviews USING btree (status);


--
-- Name: idx_outreach_messages_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_messages_campaign ON public.outreach_messages USING btree (campaign_id);


--
-- Name: idx_outreach_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_messages_status ON public.outreach_messages USING btree (status);


--
-- Name: idx_patients_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_clinic ON public.patients USING btree (clinic_id);


--
-- Name: idx_patients_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_phone ON public.patients USING btree (phone);


--
-- Name: idx_pending_areas_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_areas_city ON public.pending_areas USING btree (city_id);


--
-- Name: idx_pending_areas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_areas_status ON public.pending_areas USING btree (status);


--
-- Name: idx_plan_features_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_features_plan ON public.plan_features USING btree (plan_id);


--
-- Name: idx_platform_notifications_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_notifications_role ON public.platform_notifications USING btree (role);


--
-- Name: idx_platform_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_notifications_unread ON public.platform_notifications USING btree (is_read) WHERE (is_read = false);


--
-- Name: idx_platform_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_notifications_user ON public.platform_notifications USING btree (user_id);


--
-- Name: idx_reputation_kpis_clinic_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reputation_kpis_clinic_date ON public.reputation_kpis USING btree (clinic_id, date);


--
-- Name: idx_review_clicks_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_clicks_clinic ON public.review_clicks USING btree (clinic_id);


--
-- Name: idx_review_clicks_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_clicks_request ON public.review_clicks USING btree (request_id);


--
-- Name: idx_review_funnel_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_funnel_clinic ON public.review_funnel_events USING btree (clinic_id);


--
-- Name: idx_review_requests_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_requests_clinic ON public.review_requests USING btree (clinic_id);


--
-- Name: idx_review_requests_short_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_requests_short_code ON public.review_requests USING btree (short_code);


--
-- Name: idx_review_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_requests_status ON public.review_requests USING btree (status);


--
-- Name: idx_seo_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seo_pages_slug ON public.seo_pages USING btree (slug);


--
-- Name: idx_seo_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seo_tasks_status ON public.seo_tasks USING btree (status);


--
-- Name: idx_support_ticket_replies_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_replies_ticket ON public.support_ticket_replies USING btree (ticket_id);


--
-- Name: idx_support_tickets_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_clinic ON public.support_tickets USING btree (clinic_id);


--
-- Name: idx_support_tickets_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_user_onboarding_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_onboarding_status ON public.user_onboarding USING btree (onboarding_status);


--
-- Name: idx_user_permission_overrides_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_overrides_expires ON public.user_permission_overrides USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_user_permission_overrides_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_overrides_user ON public.user_permission_overrides USING btree (user_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: appointments on_new_booking; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_booking AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_new_booking();


--
-- Name: audit_logs set_audit_log_user_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_audit_log_user_role BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_user_role();


--
-- Name: google_oauth_accounts update_google_oauth_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_google_oauth_accounts_updated_at BEFORE UPDATE ON public.google_oauth_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_errors ai_errors_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_errors
    ADD CONSTRAINT ai_errors_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.ai_events(id) ON DELETE CASCADE;


--
-- Name: ai_events ai_events_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_events
    ADD CONSTRAINT ai_events_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;


--
-- Name: ai_feedback ai_feedback_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.ai_events(id) ON DELETE CASCADE;


--
-- Name: ai_inputs ai_inputs_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_inputs
    ADD CONSTRAINT ai_inputs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.ai_events(id) ON DELETE CASCADE;


--
-- Name: ai_outputs ai_outputs_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_outputs
    ADD CONSTRAINT ai_outputs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.ai_events(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_dentist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_dentist_id_fkey FOREIGN KEY (dentist_id) REFERENCES public.dentists(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_treatment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatments(id) ON DELETE SET NULL;


--
-- Name: areas areas_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE CASCADE;


--
-- Name: automation_logs automation_logs_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;


--
-- Name: booking_notifications booking_notifications_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: cities cities_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id);


--
-- Name: claim_requests claim_requests_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_requests
    ADD CONSTRAINT claim_requests_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_automation_settings clinic_automation_settings_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_automation_settings
    ADD CONSTRAINT clinic_automation_settings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_hours clinic_hours_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_hours
    ADD CONSTRAINT clinic_hours_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_images clinic_images_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_images
    ADD CONSTRAINT clinic_images_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_insurances clinic_insurances_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_insurances
    ADD CONSTRAINT clinic_insurances_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_insurances clinic_insurances_insurance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_insurances
    ADD CONSTRAINT clinic_insurances_insurance_id_fkey FOREIGN KEY (insurance_id) REFERENCES public.insurances(id) ON DELETE CASCADE;


--
-- Name: clinic_messages clinic_messages_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_messages
    ADD CONSTRAINT clinic_messages_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_messages clinic_messages_crm_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_messages
    ADD CONSTRAINT clinic_messages_crm_number_id_fkey FOREIGN KEY (crm_number_id) REFERENCES public.crm_numbers(id) ON DELETE SET NULL;


--
-- Name: clinic_messages clinic_messages_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_messages
    ADD CONSTRAINT clinic_messages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: clinic_subscriptions clinic_subscriptions_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_subscriptions
    ADD CONSTRAINT clinic_subscriptions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_subscriptions clinic_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_subscriptions
    ADD CONSTRAINT clinic_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: clinic_treatments clinic_treatments_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_treatments
    ADD CONSTRAINT clinic_treatments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_treatments clinic_treatments_treatment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_treatments
    ADD CONSTRAINT clinic_treatments_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatments(id) ON DELETE CASCADE;


--
-- Name: clinics clinics_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: clinics clinics_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);


--
-- Name: crm_numbers crm_numbers_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_numbers
    ADD CONSTRAINT crm_numbers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;


--
-- Name: dentists dentists_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dentists
    ADD CONSTRAINT dentists_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;


--
-- Name: email_unsubscribes email_unsubscribes_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribes
    ADD CONSTRAINT email_unsubscribes_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;


--
-- Name: gmb_link_requests gmb_link_requests_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmb_link_requests
    ADD CONSTRAINT gmb_link_requests_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: google_oauth_accounts google_oauth_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_oauth_accounts
    ADD CONSTRAINT google_oauth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: google_reviews google_reviews_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_reviews
    ADD CONSTRAINT google_reviews_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: google_reviews google_reviews_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_reviews
    ADD CONSTRAINT google_reviews_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.review_requests(id) ON DELETE SET NULL;


--
-- Name: internal_reviews internal_reviews_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_reviews
    ADD CONSTRAINT internal_reviews_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: internal_reviews internal_reviews_dentist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_reviews
    ADD CONSTRAINT internal_reviews_dentist_id_fkey FOREIGN KEY (dentist_id) REFERENCES public.dentists(id) ON DELETE SET NULL;


--
-- Name: internal_reviews internal_reviews_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_reviews
    ADD CONSTRAINT internal_reviews_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: internal_reviews internal_reviews_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_reviews
    ADD CONSTRAINT internal_reviews_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.review_requests(id) ON DELETE SET NULL;


--
-- Name: leads leads_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;


--
-- Name: leads leads_dentist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_dentist_id_fkey FOREIGN KEY (dentist_id) REFERENCES public.dentists(id) ON DELETE SET NULL;


--
-- Name: leads leads_treatment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatments(id) ON DELETE SET NULL;


--
-- Name: outreach_campaigns outreach_campaigns_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_campaigns
    ADD CONSTRAINT outreach_campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;


--
-- Name: outreach_messages outreach_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_messages
    ADD CONSTRAINT outreach_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL;


--
-- Name: outreach_messages outreach_messages_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_messages
    ADD CONSTRAINT outreach_messages_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: outreach_messages outreach_messages_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_messages
    ADD CONSTRAINT outreach_messages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;


--
-- Name: patients patients_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: pending_areas pending_areas_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_areas
    ADD CONSTRAINT pending_areas_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE CASCADE;


--
-- Name: pending_areas pending_areas_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_areas
    ADD CONSTRAINT pending_areas_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: plan_features plan_features_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE;


--
-- Name: platform_notifications platform_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_notifications
    ADD CONSTRAINT platform_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reputation_kpis reputation_kpis_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reputation_kpis
    ADD CONSTRAINT reputation_kpis_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: review_clicks review_clicks_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_clicks
    ADD CONSTRAINT review_clicks_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: review_clicks review_clicks_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_clicks
    ADD CONSTRAINT review_clicks_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.review_requests(id) ON DELETE CASCADE;


--
-- Name: review_funnel_events review_funnel_events_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_funnel_events
    ADD CONSTRAINT review_funnel_events_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: review_requests review_requests_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: review_requests review_requests_dentist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_dentist_id_fkey FOREIGN KEY (dentist_id) REFERENCES public.dentists(id) ON DELETE SET NULL;


--
-- Name: review_requests review_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: support_ticket_replies support_ticket_replies_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_replies
    ADD CONSTRAINT support_ticket_replies_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: user_permission_overrides user_permission_overrides_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: user_permission_overrides user_permission_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: claim_requests Admin all claim_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all claim_requests" ON public.claim_requests USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role)));


--
-- Name: clinic_automation_settings Admin all clinic_automation_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all clinic_automation_settings" ON public.clinic_automation_settings USING (true) WITH CHECK (true);


--
-- Name: clinic_messages Admin all clinic_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all clinic_messages" ON public.clinic_messages USING (true) WITH CHECK (true);


--
-- Name: clinic_subscriptions Admin all clinic_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all clinic_subscriptions" ON public.clinic_subscriptions USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: feature_registry Admin all feature_registry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all feature_registry" ON public.feature_registry USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: patients Admin all patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all patients" ON public.patients USING (true) WITH CHECK (true);


--
-- Name: pending_areas Admin all pending_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all pending_areas" ON public.pending_areas USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: plan_features Admin all plan_features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all plan_features" ON public.plan_features USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: subscription_plans Admin all plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all plans" ON public.subscription_plans USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: review_requests Admin all review_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all review_requests" ON public.review_requests USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: seo_pages Admin all seo_pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all seo_pages" ON public.seo_pages USING (true) WITH CHECK (true);


--
-- Name: seo_tasks Admin all seo_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all seo_tasks" ON public.seo_tasks USING (true) WITH CHECK (true);


--
-- Name: support_ticket_replies Admin all support_ticket_replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all support_ticket_replies" ON public.support_ticket_replies USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role)));


--
-- Name: support_tickets Admin all support_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin all support_tickets" ON public.support_tickets USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role)));


--
-- Name: crm_numbers Admin crm_numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin crm_numbers" ON public.crm_numbers USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: district_assignments Admin district_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin district_assignments" ON public.district_assignments USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: gmb_imports Admin gmb_imports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gmb_imports" ON public.gmb_imports USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: leads Admin manage leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage leads" ON public.leads USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role)));


--
-- Name: leads Admin read all leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin read all leads" ON public.leads FOR SELECT USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role)));


--
-- Name: automation_logs Admin read automation_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin read automation_logs" ON public.automation_logs FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: email_unsubscribes Admin view unsubscribes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin view unsubscribes" ON public.email_unsubscribes FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: areas Admin write areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write areas" ON public.areas USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: blog_posts Admin write blog_posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write blog_posts" ON public.blog_posts USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: cities Admin write cities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write cities" ON public.cities USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: clinic_hours Admin write clinic_hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write clinic_hours" ON public.clinic_hours USING ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))))) WITH CHECK ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))));


--
-- Name: clinic_images Admin write clinic_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write clinic_images" ON public.clinic_images USING ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))))) WITH CHECK ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))));


--
-- Name: clinic_insurances Admin write clinic_insurances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write clinic_insurances" ON public.clinic_insurances USING ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))))) WITH CHECK ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))));


--
-- Name: clinic_treatments Admin write clinic_treatments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write clinic_treatments" ON public.clinic_treatments USING ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))))) WITH CHECK ((public.is_admin(auth.uid()) OR (clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))));


--
-- Name: clinics Admin write clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write clinics" ON public.clinics USING ((public.is_admin(auth.uid()) OR (claimed_by = auth.uid()))) WITH CHECK ((public.is_admin(auth.uid()) OR (claimed_by = auth.uid())));


--
-- Name: countries Admin write countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write countries" ON public.countries USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: dentists Admin write dentists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write dentists" ON public.dentists USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: email_templates Admin write email_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write email_templates" ON public.email_templates USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: insurances Admin write insurances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write insurances" ON public.insurances USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: outreach_campaigns Admin write outreach_campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write outreach_campaigns" ON public.outreach_campaigns USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: outreach_messages Admin write outreach_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write outreach_messages" ON public.outreach_messages USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: platform_alerts Admin write platform_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write platform_alerts" ON public.platform_alerts USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: treatments Admin write treatments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin write treatments" ON public.treatments USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: booking_notifications Admins all booking_notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins all booking_notifications" ON public.booking_notifications TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role)));


--
-- Name: role_presets Authenticated read role_presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read role_presets" ON public.role_presets FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: gmb_link_requests Authenticated users can create link requests for their clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create link requests for their clinics" ON public.gmb_link_requests FOR INSERT TO authenticated WITH CHECK (((initiated_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.clinics
  WHERE ((clinics.id = gmb_link_requests.clinic_id) AND (clinics.claimed_by = auth.uid()))))));


--
-- Name: support_ticket_replies Dentist create ticket replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist create ticket replies" ON public.support_ticket_replies FOR INSERT WITH CHECK (((ticket_id IN ( SELECT support_tickets.id
   FROM public.support_tickets
  WHERE (support_tickets.clinic_id IN ( SELECT clinics.id
           FROM public.clinics
          WHERE (clinics.claimed_by = auth.uid()))))) AND (user_id = auth.uid()) AND (is_internal = false)));


--
-- Name: support_tickets Dentist create tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist create tickets" ON public.support_tickets FOR INSERT WITH CHECK (((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))) AND (user_id = auth.uid())));


--
-- Name: ai_feedback Dentist feedback own ai; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist feedback own ai" ON public.ai_feedback FOR INSERT WITH CHECK ((event_id IN ( SELECT ai_events.id
   FROM public.ai_events
  WHERE (ai_events.clinic_id IN ( SELECT clinics.id
           FROM public.clinics
          WHERE (clinics.claimed_by = auth.uid()))))));


--
-- Name: clinic_automation_settings Dentist manage own automation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist manage own automation" ON public.clinic_automation_settings USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))) WITH CHECK ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: internal_reviews Dentist manage own clinic internal_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist manage own clinic internal_reviews" ON public.internal_reviews USING (public.owns_clinic(auth.uid(), clinic_id));


--
-- Name: dentists Dentist manage own clinic team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist manage own clinic team" ON public.dentists USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))) WITH CHECK ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: patients Dentist manage own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist manage own patients" ON public.patients USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))) WITH CHECK ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: review_requests Dentist manage own review_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist manage own review_requests" ON public.review_requests USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid())))) WITH CHECK ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: appointments Dentist read own clinic appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist read own clinic appointments" ON public.appointments FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: leads Dentist read own clinic leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist read own clinic leads" ON public.leads FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: clinic_messages Dentist send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist send messages" ON public.clinic_messages FOR INSERT WITH CHECK ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: appointments Dentist update own clinic appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist update own clinic appointments" ON public.appointments FOR UPDATE USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: google_reviews Dentist update own clinic google_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist update own clinic google_reviews" ON public.google_reviews FOR UPDATE USING (public.owns_clinic(auth.uid(), clinic_id));


--
-- Name: support_tickets Dentist update own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist update own tickets" ON public.support_tickets FOR UPDATE USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: crm_numbers Dentist view assigned number; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view assigned number" ON public.crm_numbers FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: ai_events Dentist view own ai_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own ai_events" ON public.ai_events FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: ai_outputs Dentist view own ai_outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own ai_outputs" ON public.ai_outputs FOR SELECT USING ((event_id IN ( SELECT ai_events.id
   FROM public.ai_events
  WHERE (ai_events.clinic_id IN ( SELECT clinics.id
           FROM public.clinics
          WHERE (clinics.claimed_by = auth.uid()))))));


--
-- Name: google_reviews Dentist view own clinic google_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own clinic google_reviews" ON public.google_reviews FOR SELECT USING (public.owns_clinic(auth.uid(), clinic_id));


--
-- Name: patients Dentist view own clinic patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own clinic patients" ON public.patients FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: reputation_kpis Dentist view own clinic reputation_kpis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own clinic reputation_kpis" ON public.reputation_kpis FOR SELECT USING (public.owns_clinic(auth.uid(), clinic_id));


--
-- Name: review_clicks Dentist view own clinic review_clicks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own clinic review_clicks" ON public.review_clicks FOR SELECT USING (public.owns_clinic(auth.uid(), clinic_id));


--
-- Name: clinic_messages Dentist view own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own messages" ON public.clinic_messages FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: clinic_subscriptions Dentist view own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own subscription" ON public.clinic_subscriptions FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: support_tickets Dentist view own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view own tickets" ON public.support_tickets FOR SELECT USING ((clinic_id IN ( SELECT clinics.id
   FROM public.clinics
  WHERE (clinics.claimed_by = auth.uid()))));


--
-- Name: support_ticket_replies Dentist view ticket replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dentist view ticket replies" ON public.support_ticket_replies FOR SELECT USING (((ticket_id IN ( SELECT support_tickets.id
   FROM public.support_tickets
  WHERE (support_tickets.clinic_id IN ( SELECT clinics.id
           FROM public.clinics
          WHERE (clinics.claimed_by = auth.uid()))))) AND (is_internal = false)));


--
-- Name: gmb_link_requests Initiators can delete their own unused GMB link requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Initiators can delete their own unused GMB link requests" ON public.gmb_link_requests FOR DELETE TO authenticated USING (((initiated_by = auth.uid()) AND (consumed_at IS NULL)));


--
-- Name: appointments Public insert appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert appointments" ON public.appointments FOR INSERT WITH CHECK (true);


--
-- Name: internal_reviews Public insert internal_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert internal_reviews" ON public.internal_reviews FOR INSERT WITH CHECK (true);


--
-- Name: leads Public insert leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert leads" ON public.leads FOR INSERT WITH CHECK (true);


--
-- Name: review_clicks Public insert review_clicks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert review_clicks" ON public.review_clicks FOR INSERT WITH CHECK (true);


--
-- Name: email_unsubscribes Public insert unsubscribe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert unsubscribe" ON public.email_unsubscribes FOR INSERT WITH CHECK (true);


--
-- Name: areas Public read areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read areas" ON public.areas FOR SELECT USING (true);


--
-- Name: blog_posts Public read blog_posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read blog_posts" ON public.blog_posts FOR SELECT USING (((status = 'published'::text) OR true));


--
-- Name: cities Public read cities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read cities" ON public.cities FOR SELECT USING (true);


--
-- Name: clinic_hours Public read clinic_hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read clinic_hours" ON public.clinic_hours FOR SELECT USING (true);


--
-- Name: clinic_images Public read clinic_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read clinic_images" ON public.clinic_images FOR SELECT USING (true);


--
-- Name: clinic_insurances Public read clinic_insurances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read clinic_insurances" ON public.clinic_insurances FOR SELECT USING (true);


--
-- Name: clinic_treatments Public read clinic_treatments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read clinic_treatments" ON public.clinic_treatments FOR SELECT USING (true);


--
-- Name: clinics Public read clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read clinics" ON public.clinics FOR SELECT USING (true);


--
-- Name: countries Public read countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read countries" ON public.countries FOR SELECT USING (true);


--
-- Name: dentists Public read dentists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read dentists" ON public.dentists FOR SELECT USING (true);


--
-- Name: feature_registry Public read feature_registry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read feature_registry" ON public.feature_registry FOR SELECT USING (true);


--
-- Name: insurances Public read insurances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read insurances" ON public.insurances FOR SELECT USING (true);


--
-- Name: plan_features Public read plan_features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read plan_features" ON public.plan_features FOR SELECT USING (true);


--
-- Name: subscription_plans Public read plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read plans" ON public.subscription_plans FOR SELECT USING ((is_active = true));


--
-- Name: treatments Public read treatments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read treatments" ON public.treatments FOR SELECT USING (true);


--
-- Name: review_funnel_events Public review_funnel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public review_funnel" ON public.review_funnel_events USING (true) WITH CHECK (true);


--
-- Name: review_requests Public select review_requests by short_code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public select review_requests by short_code" ON public.review_requests FOR SELECT USING ((short_code IS NOT NULL));


--
-- Name: review_requests Public update review_requests status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public update review_requests status" ON public.review_requests FOR UPDATE USING ((short_code IS NOT NULL)) WITH CHECK ((short_code IS NOT NULL));


--
-- Name: ai_errors Super admin all ai_errors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all ai_errors" ON public.ai_errors USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: ai_events Super admin all ai_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all ai_events" ON public.ai_events USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: ai_feedback Super admin all ai_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all ai_feedback" ON public.ai_feedback USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: ai_inputs Super admin all ai_inputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all ai_inputs" ON public.ai_inputs USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: ai_module_settings Super admin all ai_module_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all ai_module_settings" ON public.ai_module_settings USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: ai_outputs Super admin all ai_outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all ai_outputs" ON public.ai_outputs USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: ai_prompt_templates Super admin all ai_prompt_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all ai_prompt_templates" ON public.ai_prompt_templates USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: google_reviews Super admin all google_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all google_reviews" ON public.google_reviews USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: internal_reviews Super admin all internal_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all internal_reviews" ON public.internal_reviews USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: reputation_kpis Super admin all reputation_kpis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all reputation_kpis" ON public.reputation_kpis USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: review_clicks Super admin all review_clicks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all review_clicks" ON public.review_clicks USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: role_presets Super admin all role_presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all role_presets" ON public.role_presets USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: support_ticket_replies Super admin all support_ticket_replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all support_ticket_replies" ON public.support_ticket_replies USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: support_tickets Super admin all support_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all support_tickets" ON public.support_tickets USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_permission_overrides Super admin all user_permission_overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin all user_permission_overrides" ON public.user_permission_overrides USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: automation_rules Super admin automation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin automation_rules" ON public.automation_rules USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: platform_notifications Super admin delete notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin delete notifications" ON public.platform_notifications FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: appointments Super admin full access appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin full access appointments" ON public.appointments USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'district_manager'::public.app_role)));


--
-- Name: user_onboarding Super admin full access user_onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin full access user_onboarding" ON public.user_onboarding USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: global_settings Super admin global_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin global_settings" ON public.global_settings USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: platform_notifications Super admin insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin insert notifications" ON public.platform_notifications FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles Super admin manage user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin manage user_roles" ON public.user_roles USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: audit_logs Super admin only audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin only audit_logs" ON public.audit_logs USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: automation_logs System write automation_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System write automation_logs" ON public.automation_logs FOR INSERT WITH CHECK (true);


--
-- Name: support_ticket_replies Users add replies to own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users add replies to own tickets" ON public.support_ticket_replies FOR INSERT WITH CHECK ((ticket_id IN ( SELECT support_tickets.id
   FROM public.support_tickets
  WHERE (support_tickets.user_id = auth.uid()))));


--
-- Name: support_tickets Users can create own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own tickets" ON public.support_tickets FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: google_oauth_accounts Users can delete own OAuth accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own OAuth accounts" ON public.google_oauth_accounts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: google_oauth_accounts Users can insert own OAuth accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own OAuth accounts" ON public.google_oauth_accounts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pending_areas Users can insert pending areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert pending areas" ON public.pending_areas FOR INSERT WITH CHECK ((submitted_by = auth.uid()));


--
-- Name: audit_logs Users can insert their own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_onboarding Users can insert their own onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own onboarding" ON public.user_onboarding FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: gmb_link_requests Users can read their own link requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own link requests" ON public.gmb_link_requests FOR SELECT TO authenticated USING ((initiated_by = auth.uid()));


--
-- Name: google_oauth_accounts Users can update own OAuth accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own OAuth accounts" ON public.google_oauth_accounts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: support_tickets Users can update own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own tickets" ON public.support_tickets FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: user_onboarding Users can update their own onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own onboarding" ON public.user_onboarding FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: google_oauth_accounts Users can view own OAuth accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own OAuth accounts" ON public.google_oauth_accounts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: support_tickets Users can view own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own tickets" ON public.support_tickets FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: audit_logs Users can view their own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_onboarding Users can view their own onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own onboarding" ON public.user_onboarding FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: pending_areas Users can view their own pending areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own pending areas" ON public.pending_areas FOR SELECT USING ((submitted_by = auth.uid()));


--
-- Name: claim_requests Users insert own claim_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own claim_requests" ON public.claim_requests FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: claim_requests Users update own claim_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own claim_requests" ON public.claim_requests FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: platform_notifications Users update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own notifications" ON public.platform_notifications FOR UPDATE USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: claim_requests Users view own claim_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own claim_requests" ON public.claim_requests FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: platform_notifications Users view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own notifications" ON public.platform_notifications FOR SELECT USING (((user_id = auth.uid()) OR ((user_id IS NULL) AND (role IN ( SELECT (ur.role)::text AS role
   FROM public.user_roles ur
  WHERE (ur.user_id = auth.uid())))) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: support_ticket_replies Users view replies on own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view replies on own tickets" ON public.support_ticket_replies FOR SELECT USING ((ticket_id IN ( SELECT support_tickets.id
   FROM public.support_tickets
  WHERE (support_tickets.user_id = auth.uid()))));


--
-- Name: ai_errors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_errors ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_inputs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_inputs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_module_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_module_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_outputs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_outputs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompt_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: cities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claim_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_automation_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_automation_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_images ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_insurances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_insurances ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_treatments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_treatments ENABLE ROW LEVEL SECURITY;

--
-- Name: clinics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

--
-- Name: countries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_numbers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_numbers ENABLE ROW LEVEL SECURITY;

--
-- Name: dentists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dentists ENABLE ROW LEVEL SECURITY;

--
-- Name: district_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.district_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: email_unsubscribes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_registry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_registry ENABLE ROW LEVEL SECURITY;

--
-- Name: global_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: gmb_imports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmb_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: gmb_link_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmb_link_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: google_oauth_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_oauth_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: google_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: insurances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: outreach_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: outreach_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pending_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_features; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: reputation_kpis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reputation_kpis ENABLE ROW LEVEL SECURITY;

--
-- Name: review_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: review_funnel_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_funnel_events ENABLE ROW LEVEL SECURITY;

--
-- Name: review_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: role_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seo_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: treatments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_onboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permission_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;