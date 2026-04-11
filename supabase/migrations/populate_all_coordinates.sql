-- This script will add coordinates to ALL clinics based on their city
-- Run this in Supabase SQL Editor

-- First let's see what cities we have
SELECT city_id, cities.name as city_name, COUNT(*) as clinic_count
FROM clinics 
LEFT JOIN cities ON clinics.city_id = cities.id
WHERE clinics.is_active = true AND (clinics.latitude IS NULL OR clinics.latitude = 0)
GROUP BY city_id, cities.name
ORDER BY clinic_count DESC
LIMIT 20;

-- Now let's add coordinates based on city names
-- Dubai
UPDATE clinics c
SET latitude = 25.2048, longitude = 55.2708
FROM cities city
WHERE c.city_id = city.id AND city.name ILIKE '%dubai%' AND c.is_active = true;

-- Abu Dhabi
UPDATE clinics c
SET latitude = 24.4539, longitude = 54.3773
FROM cities city
WHERE c.city_id = city.id AND city.name ILIKE '%abu dhabi%' AND c.is_active = true;

-- Sharjah
UPDATE clinics c
SET latitude = 25.3463, longitude = 55.4209
FROM cities city
WHERE c.city_id = city.id AND city.name ILIKE '%sharjah%' AND c.is_active = true;

-- Al Ain
UPDATE clinics c
SET latitude = 24.2075, longitude = 55.7447
FROM cities city
WHERE c.city_id = city.id AND city.name ILIKE '%al ain%' AND c.is_active = true;

-- Ajman
UPDATE clinics c
SET latitude = 25.4052, longitude = 55.5136
FROM cities city
WHERE c.city_id = city.id AND city.name ILIKE '%ajman%' AND c.is_active = true;

-- Ras Al Khaimah
UPDATE clinics c
SET latitude = 25.7895, longitude = 55.9432
FROM cities city
WHERE c.city_id = city.id AND (city.name ILIKE '%ras al khaimah%' OR city.name ILIKE '%rak%') AND c.is_active = true;

-- Fujairah
UPDATE clinics c
SET latitude = 25.1288, longitude = 56.3265
FROM cities city
WHERE c.city_id = city.id AND city.name ILIKE '%fujairah%' AND c.is_active = true;

-- Umm Al Quwain
UPDATE clinics c
SET latitude = 25.5647, longitude = 55.5553
FROM cities city
WHERE c.city_id = city.id AND city.name ILIKE '%umm al quwain%' AND c.is_active = true;

-- Check the results
SELECT 
  COUNT(*) as total,
  COUNT(latitude) as with_latitude,
  COUNT(longitude) as with_longitude
FROM clinics 
WHERE is_active = true;