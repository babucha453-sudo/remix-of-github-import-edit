-- ========================================================
-- CLINIC SERVICE AREAS - Enable dentists to serve multiple areas
-- Run these in Supabase SQL Editor
-- ========================================================

-- 1. Clinic Service Areas Table (for multi-area coverage)
CREATE TABLE IF NOT EXISTS clinic_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable location change flag in clinics
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS allow_location_change BOOLEAN DEFAULT true;

-- 3. Add service_area_text for free-text service areas
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS service_areas_text TEXT;

-- 4. Add primary city/area change tracking
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS previous_city_id UUID REFERENCES cities(id);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS location_changed_at TIMESTAMPTZ;

-- ========================================================
-- INDEXES
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_clinic_service_areas_clinic ON clinic_service_areas(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_service_areas_area ON clinic_service_areas(area_id);

-- ========================================================
-- SEED: Sample service areas (optional)
-- ========================================================

-- This will allow the system to track which areas each clinic serves
-- Dentists can now select their primary city and add additional service areas

-- Row Level Security
ALTER TABLE clinic_service_areas ENABLE ROW LEVEL SECURITY;

-- Dentists can manage their own service areas
CREATE POLICY "Owners can manage service areas" ON clinic_service_areas 
FOR ALL USING (clinic_id IN (SELECT id FROM clinics WHERE claimed_by = auth.uid()));

-- Enable the location change capability
COMMENT ON COLUMN clinics.allow_location_change IS 'Allows dentist to change their clinic location';
COMMENT ON COLUMN clinics.service_areas_text IS 'Free-text description of service areas (e.g., Downtown, Westside)';