-- Create a function to get the actual clinic count for a city
CREATE OR REPLACE FUNCTION public.get_city_clinic_count(city_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  clinic_count integer;
BEGIN
  SELECT count(*)::integer INTO clinic_count
  FROM clinics
  WHERE city_id = city_id_param
    AND is_active = true
    AND is_duplicate = false;
  
  RETURN COALESCE(clinic_count, 0);
END;
$$;

-- Update all cities with their actual clinic counts
UPDATE cities c
SET dentist_count = (
  SELECT count(*)::integer
  FROM clinics cl
  WHERE cl.city_id = c.id
    AND cl.is_active = true
    AND (cl.is_duplicate IS NULL OR cl.is_duplicate = false)
);

-- Update all areas with their actual clinic counts
UPDATE areas a
SET dentist_count = (
  SELECT count(*)::integer
  FROM clinics cl
  WHERE cl.area_id = a.id
    AND cl.is_active = true
    AND (cl.is_duplicate IS NULL OR cl.is_duplicate = false)
);