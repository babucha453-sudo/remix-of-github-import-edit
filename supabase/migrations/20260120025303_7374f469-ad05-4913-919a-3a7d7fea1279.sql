
-- Add latitude/longitude columns to cities table for proximity matching
ALTER TABLE public.cities 
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

-- Create index for faster geo queries
CREATE INDEX IF NOT EXISTS idx_cities_coords ON public.cities (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create a function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 NUMERIC, lon1 NUMERIC,
  lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  R CONSTANT NUMERIC := 6371; -- Earth's radius in km
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Create a function to find the nearest city for a given coordinate
CREATE OR REPLACE FUNCTION public.find_nearest_city(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_state_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  nearest_city_id UUID;
BEGIN
  SELECT id INTO nearest_city_id
  FROM public.cities
  WHERE is_active = true
    AND latitude IS NOT NULL 
    AND longitude IS NOT NULL
    AND (p_state_id IS NULL OR state_id = p_state_id)
  ORDER BY public.calculate_distance_km(latitude, longitude, p_latitude, p_longitude)
  LIMIT 1;
  
  RETURN nearest_city_id;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Create a function to reassign a clinic to its nearest city based on coordinates
CREATE OR REPLACE FUNCTION public.reassign_clinic_to_nearest_city(
  p_clinic_id UUID
) RETURNS JSON AS $$
DECLARE
  v_clinic RECORD;
  v_old_city_id UUID;
  v_old_city_name TEXT;
  v_new_city_id UUID;
  v_new_city_name TEXT;
  v_distance NUMERIC;
BEGIN
  -- Get clinic info
  SELECT cl.id, cl.latitude, cl.longitude, cl.city_id, c.name as city_name, c.state_id
  INTO v_clinic
  FROM public.clinics cl
  LEFT JOIN public.cities c ON c.id = cl.city_id
  WHERE cl.id = p_clinic_id;
  
  IF v_clinic IS NULL OR v_clinic.latitude IS NULL OR v_clinic.longitude IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Clinic not found or missing coordinates');
  END IF;
  
  v_old_city_id := v_clinic.city_id;
  v_old_city_name := v_clinic.city_name;
  
  -- Find nearest city in same state
  SELECT c.id, c.name, 
         public.calculate_distance_km(c.latitude, c.longitude, v_clinic.latitude, v_clinic.longitude)
  INTO v_new_city_id, v_new_city_name, v_distance
  FROM public.cities c
  WHERE c.is_active = true
    AND c.latitude IS NOT NULL 
    AND c.longitude IS NOT NULL
    AND c.state_id = v_clinic.state_id
  ORDER BY public.calculate_distance_km(c.latitude, c.longitude, v_clinic.latitude, v_clinic.longitude)
  LIMIT 1;
  
  IF v_new_city_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No city with coordinates found in same state');
  END IF;
  
  -- Update clinic if city changed
  IF v_new_city_id != v_old_city_id OR v_old_city_id IS NULL THEN
    UPDATE public.clinics 
    SET city_id = v_new_city_id, updated_at = NOW()
    WHERE id = p_clinic_id;
    
    RETURN json_build_object(
      'success', true, 
      'changed', true,
      'old_city', v_old_city_name,
      'new_city', v_new_city_name,
      'distance_km', v_distance
    );
  END IF;
  
  RETURN json_build_object(
    'success', true, 
    'changed', false,
    'city', v_new_city_name,
    'distance_km', v_distance
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION public.calculate_distance_km IS 'Calculates distance between two coordinates using Haversine formula';
COMMENT ON FUNCTION public.find_nearest_city IS 'Finds the nearest city with coordinates for a given lat/long';
COMMENT ON FUNCTION public.reassign_clinic_to_nearest_city IS 'Reassigns a clinic to its nearest city based on coordinates';
