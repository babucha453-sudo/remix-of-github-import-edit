-- Add DELETE policy for gmb_scraper_sessions (missing from original setup)
CREATE POLICY "Admins can delete sessions"
ON public.gmb_scraper_sessions
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('super_admin', 'district_manager')
));