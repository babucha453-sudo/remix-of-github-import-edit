-- Quick way to add coordinates to all clinics based on their city
-- Run this in Supabase SQL Editor

-- First, let's see what cities we have
SELECT c.id, c.name, c.city_id, city.name as city_name
FROM clinics c
LEFT JOIN cities city ON c.city_id = city.id
WHERE c.is_active = true AND c.latitude IS NULL
LIMIT 20;

-- Update clinics with city coordinates (Dubai example)
UPDATE clinics c
SET 
  latitude = 25.2048,
  longitude = 55.2708
FROM cities city
WHERE c.city_id = city.id 
  AND city.name ILIKE '%dubai%'
  AND c.is_active = true
  AND c.latitude IS NULL;

-- Check how many have coordinates now
SELECT 
  COUNT(*) as total,
  COUNT(latitude) as with_latitude,
  COUNT(longitude) as with_longitude
FROM clinics 
WHERE is_active = true;