-- Drop existing restrictive write policy
DROP POLICY IF EXISTS "Admin write blog_posts" ON public.blog_posts;

-- Create separate policies for different operations

-- INSERT: Allow admins and content_team to create blog posts
CREATE POLICY "blog_posts_insert" ON public.blog_posts
FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'content_team'::app_role)
);

-- UPDATE: Allow admins and content_team to update blog posts
CREATE POLICY "blog_posts_update" ON public.blog_posts
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'content_team'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'content_team'::app_role)
);

-- DELETE: Only admins can delete blog posts
CREATE POLICY "blog_posts_delete" ON public.blog_posts
FOR DELETE TO authenticated
USING (is_admin(auth.uid()));