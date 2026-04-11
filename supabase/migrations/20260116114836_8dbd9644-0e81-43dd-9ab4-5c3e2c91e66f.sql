-- Convert existing text content to jsonb format
-- First, update the column type with data conversion
ALTER TABLE public.blog_posts 
ALTER COLUMN content TYPE jsonb 
USING CASE 
  WHEN content IS NULL THEN NULL
  ELSE jsonb_build_object('type', 'markdown', 'body', content)
END;