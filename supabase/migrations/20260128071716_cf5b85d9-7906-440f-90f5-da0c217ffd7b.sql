-- Add default pricing ranges to treatments table (for admin-managed budget ranges)
ALTER TABLE public.treatments 
ADD COLUMN IF NOT EXISTS default_price_min numeric,
ADD COLUMN IF NOT EXISTS default_price_max numeric,
ADD COLUMN IF NOT EXISTS price_unit text DEFAULT 'per_procedure';

-- Add per_unit_price columns to clinic_treatments for quantity-aware search
ALTER TABLE public.clinic_treatments
ADD COLUMN IF NOT EXISTS is_per_unit boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notes text;

-- Create a view for clinics with is_paid status based on active subscription
CREATE OR REPLACE VIEW public.clinic_paid_status AS
SELECT 
  c.id as clinic_id,
  c.name,
  c.slug,
  c.city_id,
  c.latitude,
  c.longitude,
  c.rating,
  c.review_count,
  c.cover_image_url,
  c.address,
  c.is_active,
  c.is_duplicate,
  CASE 
    WHEN cs.id IS NOT NULL AND cs.status = 'active' AND cs.expires_at > now() THEN true 
    ELSE false 
  END as is_paid
FROM public.clinics c
LEFT JOIN public.clinic_subscriptions cs ON cs.clinic_id = c.id AND cs.status = 'active' AND cs.expires_at > now();

-- Create table for admin budget range presets (for dentist dashboard dropdowns)
CREATE TABLE IF NOT EXISTS public.budget_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE CASCADE,
  label text NOT NULL,
  price_min numeric NOT NULL,
  price_max numeric NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on budget_ranges
ALTER TABLE public.budget_ranges ENABLE ROW LEVEL SECURITY;

-- Allow public read access to budget ranges
CREATE POLICY "Anyone can view budget ranges"
ON public.budget_ranges FOR SELECT
USING (is_active = true);

-- SuperAdmin can manage budget ranges
CREATE POLICY "SuperAdmin can manage budget ranges"
ON public.budget_ranges FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Insert some default budget ranges for common treatments
INSERT INTO public.budget_ranges (treatment_id, label, price_min, price_max, display_order)
SELECT 
  t.id,
  '$50 - $70',
  50, 70, 1
FROM public.treatments t WHERE t.slug = 'teeth-cleaning'
ON CONFLICT DO NOTHING;

INSERT INTO public.budget_ranges (treatment_id, label, price_min, price_max, display_order)
SELECT 
  t.id,
  '$70 - $90',
  70, 90, 2
FROM public.treatments t WHERE t.slug = 'teeth-cleaning'
ON CONFLICT DO NOTHING;

INSERT INTO public.budget_ranges (treatment_id, label, price_min, price_max, display_order)
SELECT 
  t.id,
  '$90 - $120',
  90, 120, 3
FROM public.treatments t WHERE t.slug = 'teeth-cleaning'
ON CONFLICT DO NOTHING;

-- Budget ranges for dental implants
INSERT INTO public.budget_ranges (treatment_id, label, price_min, price_max, display_order)
SELECT 
  t.id,
  '$1,000 - $1,500',
  1000, 1500, 1
FROM public.treatments t WHERE t.slug = 'dental-implants'
ON CONFLICT DO NOTHING;

INSERT INTO public.budget_ranges (treatment_id, label, price_min, price_max, display_order)
SELECT 
  t.id,
  '$1,500 - $2,000',
  1500, 2000, 2
FROM public.treatments t WHERE t.slug = 'dental-implants'
ON CONFLICT DO NOTHING;

INSERT INTO public.budget_ranges (treatment_id, label, price_min, price_max, display_order)
SELECT 
  t.id,
  '$2,000 - $2,500',
  2000, 2500, 3
FROM public.treatments t WHERE t.slug = 'dental-implants'
ON CONFLICT DO NOTHING;

-- Create ai_search_analytics table for admin insights
CREATE TABLE IF NOT EXISTS public.ai_search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  most_searched_budgets jsonb,
  most_searched_services jsonb,
  no_result_searches jsonb,
  total_searches integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_search_analytics ENABLE ROW LEVEL SECURITY;

-- Only admins can view analytics
CREATE POLICY "Admins can view search analytics"
ON public.ai_search_analytics FOR SELECT
USING (public.is_admin(auth.uid()));

-- Add index for faster budget-based queries
CREATE INDEX IF NOT EXISTS idx_clinic_treatments_price_range 
ON public.clinic_treatments(treatment_id, price_from, price_to);

-- Add index for faster geolocation queries
CREATE INDEX IF NOT EXISTS idx_clinics_geo 
ON public.clinics(latitude, longitude) 
WHERE is_active = true AND is_duplicate = false;