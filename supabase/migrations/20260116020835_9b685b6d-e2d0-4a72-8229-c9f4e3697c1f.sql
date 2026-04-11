-- Create table to track clinic enrichment runs
CREATE TABLE IF NOT EXISTS public.clinic_enrichment_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_clinics INT NOT NULL DEFAULT 0,
  processed INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinic_enrichment_runs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can access
CREATE POLICY "Super admins can manage enrichment runs"
ON public.clinic_enrichment_runs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Create a function to add default cover images to clinics
-- Uses a set of professional dental clinic placeholder images
CREATE OR REPLACE FUNCTION public.add_default_clinic_images()
RETURNS TABLE(updated_count INT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  placeholder_images TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=800&h=600&fit=crop'
  ];
  count_updated INT;
BEGIN
  -- Update clinics without cover images with random placeholder
  UPDATE clinics 
  SET cover_image_url = placeholder_images[1 + floor(random() * array_length(placeholder_images, 1))::int]
  WHERE cover_image_url IS NULL 
  AND is_active = true;
  
  GET DIAGNOSTICS count_updated = ROW_COUNT;
  
  RETURN QUERY SELECT count_updated;
END;
$$;