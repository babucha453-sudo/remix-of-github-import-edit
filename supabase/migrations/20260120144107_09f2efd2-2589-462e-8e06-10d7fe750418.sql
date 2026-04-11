-- Create blog_categories table for managing categories
CREATE TABLE public.blog_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blog_authors table for managing authors
CREATE TABLE public.blog_authors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'Author',
  is_active BOOLEAN DEFAULT true,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_authors ENABLE ROW LEVEL SECURITY;

-- RLS policies for blog_categories (admin only for write, public read)
CREATE POLICY "Blog categories are viewable by everyone" 
ON public.blog_categories FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage blog categories" 
ON public.blog_categories FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS policies for blog_authors (admin only for write, public read)
CREATE POLICY "Blog authors are viewable by everyone" 
ON public.blog_authors FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage blog authors" 
ON public.blog_authors FOR ALL USING (auth.uid() IS NOT NULL);

-- Add author_id column to blog_posts if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blog_posts' AND column_name = 'author_id') THEN
    ALTER TABLE public.blog_posts ADD COLUMN author_id UUID REFERENCES public.blog_authors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Insert default categories from existing posts
INSERT INTO public.blog_categories (name, slug) VALUES 
  ('Oral Health', 'oral-health'),
  ('Oral Hygiene', 'oral-hygiene'),
  ('Pediatric Dentistry', 'pediatric-dentistry'),
  ('Preventive Dentistry', 'preventive-dentistry'),
  ('Cosmetic Dentistry', 'cosmetic-dentistry'),
  ('Dental Procedures', 'dental-procedures'),
  ('Dental Technology', 'dental-technology'),
  ('Dental Tips', 'dental-tips'),
  ('General Dentistry', 'general-dentistry')
ON CONFLICT (name) DO NOTHING;

-- Create triggers for updated_at
CREATE TRIGGER update_blog_categories_updated_at
BEFORE UPDATE ON public.blog_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blog_authors_updated_at
BEFORE UPDATE ON public.blog_authors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();