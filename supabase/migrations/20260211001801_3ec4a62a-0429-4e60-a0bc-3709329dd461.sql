-- Fix schema_settings to allow public (anonymous) SELECT access
-- This is needed so bots and public visitors see the structured data (address, org info, etc.)
DROP POLICY IF EXISTS "Schema settings are readable by authenticated users" ON public.schema_settings;

CREATE POLICY "Schema settings are publicly readable"
  ON public.schema_settings
  FOR SELECT
  USING (true);