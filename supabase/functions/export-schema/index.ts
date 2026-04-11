import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Core schema SQL for the dental directory platform
// This is a pre-built schema export since we can't run pg_dump from edge functions
const SCHEMA_SQL = `
-- ===========================================
-- DENTAL DIRECTORY PLATFORM - SCHEMA EXPORT
-- ===========================================

-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'district_manager', 'dentist', 'patient');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM ('unclaimed', 'pending', 'claimed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.clinic_source AS ENUM ('manual', 'gmb', 'import');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost', 'spam');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN  
  CREATE TYPE public.seo_page_type AS ENUM ('state', 'city', 'treatment', 'city_treatment', 'clinic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Countries
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- States
CREATE TABLE IF NOT EXISTS public.states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  abbreviation TEXT,
  country_code TEXT DEFAULT 'US',
  image_url TEXT,
  dentist_count INTEGER DEFAULT 0,
  clinic_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cities
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  country TEXT DEFAULT 'United States',
  image_url TEXT,
  dentist_count INTEGER DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slug, state_id)
);

-- Areas
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  dentist_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treatments
CREATE TABLE IF NOT EXISTS public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insurances
CREATE TABLE IF NOT EXISTS public.insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clinics
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  whatsapp TEXT,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  google_place_id TEXT,
  claim_status public.claim_status DEFAULT 'unclaimed',
  verification_status public.verification_status DEFAULT 'unverified',
  source public.clinic_source DEFAULT 'manual',
  owner_id UUID,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  seo_visible BOOLEAN DEFAULT true,
  rank_score INTEGER DEFAULT 0,
  duplicate_group_id UUID,
  is_duplicate BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  gmb_data JSONB,
  total_reviews INTEGER DEFAULT 0,
  average_rating NUMERIC(2,1) DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verification_expires_at TIMESTAMPTZ
);

-- Dentists
CREATE TABLE IF NOT EXISTS public.dentists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_id UUID,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT,
  bio TEXT,
  photo_url TEXT,
  qualifications TEXT[],
  experience_years INTEGER,
  languages TEXT[],
  email TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  total_reviews INTEGER DEFAULT 0,
  average_rating NUMERIC(2,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  dentist_id UUID REFERENCES public.dentists(id) ON DELETE SET NULL,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  status public.lead_status DEFAULT 'new',
  notes TEXT,
  is_spam BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  dentist_id UUID REFERENCES public.dentists(id) ON DELETE SET NULL,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  patient_id UUID,
  preferred_date DATE,
  preferred_time TIME,
  confirmed_date DATE,
  confirmed_time TIME,
  status public.appointment_status DEFAULT 'pending',
  notes TEXT,
  admin_notes TEXT,
  is_disputed BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog Posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content JSONB,
  excerpt TEXT,
  featured_image TEXT,
  author_id UUID,
  category_id UUID,
  status TEXT DEFAULT 'draft',
  meta_title TEXT,
  meta_description TEXT,
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- SEO Pages
CREATE TABLE IF NOT EXISTS public.seo_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type public.seo_page_type NOT NULL,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  content TEXT,
  is_indexed BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT true,
  is_thin_content BOOLEAN DEFAULT false,
  is_duplicate BOOLEAN DEFAULT false,
  ai_suggestions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly NUMERIC(10,2) DEFAULT 0,
  price_yearly NUMERIC(10,2) DEFAULT 0,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clinic Treatments (junction)
CREATE TABLE IF NOT EXISTS public.clinic_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE CASCADE,
  price_range TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, treatment_id)
);

-- Clinic Insurances (junction)
CREATE TABLE IF NOT EXISTS public.clinic_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  insurance_id UUID REFERENCES public.insurances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, insurance_id)
);

-- Dentist Settings
CREATE TABLE IF NOT EXISTS public.dentist_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
  booking_enabled BOOLEAN DEFAULT true,
  allow_guest_booking BOOLEAN DEFAULT true,
  require_phone BOOLEAN DEFAULT true,
  min_advance_hours INTEGER DEFAULT 24,
  max_advance_days INTEGER DEFAULT 30,
  slot_duration_minutes INTEGER DEFAULT 30,
  booking_notes TEXT,
  auto_confirm BOOLEAN DEFAULT false,
  notification_email TEXT,
  notification_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_clinics_city ON public.clinics(city_id);
CREATE INDEX IF NOT EXISTS idx_clinics_active ON public.clinics(is_active, is_duplicate, seo_visible);
CREATE INDEX IF NOT EXISTS idx_clinics_slug ON public.clinics(slug);
CREATE INDEX IF NOT EXISTS idx_cities_state ON public.cities(state_id);
CREATE INDEX IF NOT EXISTS idx_cities_slug ON public.cities(slug);
CREATE INDEX IF NOT EXISTS idx_states_slug ON public.states(slug);
CREATE INDEX IF NOT EXISTS idx_dentists_clinic ON public.dentists(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leads_clinic ON public.leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ===========================================
-- RLS POLICIES
-- ===========================================

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Public read policies for directory data
CREATE POLICY "Public can view active states" ON public.states FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active cities" ON public.cities FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active areas" ON public.areas FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active treatments" ON public.treatments FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active insurances" ON public.insurances FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active clinics" ON public.clinics FOR SELECT USING (is_active = true AND seo_visible = true);
CREATE POLICY "Public can view active dentists" ON public.dentists FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view published blog posts" ON public.blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Public can view published seo pages" ON public.seo_pages FOR SELECT USING (is_published = true);
CREATE POLICY "Public can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);

-- Admin policies
CREATE POLICY "Admins can manage all states" ON public.states FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all cities" ON public.cities FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all areas" ON public.areas FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all treatments" ON public.treatments FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all insurances" ON public.insurances FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all clinics" ON public.clinics FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all dentists" ON public.dentists FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can view user roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all leads" ON public.leads FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can manage all appointments" ON public.appointments FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- User can view own role
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Dentists can manage their own clinic
CREATE POLICY "Dentists can view own clinic" ON public.clinics FOR SELECT USING (claimed_by = auth.uid());
CREATE POLICY "Dentists can update own clinic" ON public.clinics FOR UPDATE USING (claimed_by = auth.uid());
CREATE POLICY "Dentists can view own leads" ON public.leads FOR SELECT USING (
  clinic_id IN (SELECT id FROM public.clinics WHERE claimed_by = auth.uid())
);
CREATE POLICY "Dentists can view own appointments" ON public.appointments FOR SELECT USING (
  clinic_id IN (SELECT id FROM public.clinics WHERE claimed_by = auth.uid())
);

-- ===========================================
-- TRIGGERS
-- ===========================================

CREATE TRIGGER update_states_updated_at BEFORE UPDATE ON public.states 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON public.cities 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dentists_updated_at BEFORE UPDATE ON public.dentists 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON public.treatments 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "get-schema") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          schema: SCHEMA_SQL,
          instructions: [
            "1. Copy the schema SQL above",
            "2. Go to your external Supabase project dashboard",
            "3. Open SQL Editor",
            "4. Paste and run the schema SQL",
            "5. Once complete, you can start migrating data"
          ]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: get-schema" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
