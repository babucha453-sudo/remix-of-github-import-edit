-- Add unique constraint on slug for cities table
ALTER TABLE cities ADD CONSTRAINT cities_slug_unique UNIQUE (slug);