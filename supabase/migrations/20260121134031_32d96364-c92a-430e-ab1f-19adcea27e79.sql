-- Add new team roles for SEO, Content, Support teams
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'seo_team';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'content_team';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'support_team';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'marketing_team';

-- Create tab permissions table to control which tabs each user can access
CREATE TABLE IF NOT EXISTS public.user_tab_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_key TEXT NOT NULL,
  can_access BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, tab_key)
);

-- Enable RLS
ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all tab permissions
CREATE POLICY "Super admins can manage tab permissions"
ON public.user_tab_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Users can view their own permissions
CREATE POLICY "Users can view own tab permissions"
ON public.user_tab_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_user_tab_permissions_updated_at
BEFORE UPDATE ON public.user_tab_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();