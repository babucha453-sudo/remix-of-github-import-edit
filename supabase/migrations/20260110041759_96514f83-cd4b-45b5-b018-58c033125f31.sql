-- Create page_content table to store CMS content for all page types
CREATE TABLE public.page_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_type TEXT NOT NULL,
  page_slug TEXT NOT NULL UNIQUE,
  reference_id UUID,
  
  -- SEO Fields
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT[],
  og_image TEXT,
  noindex BOOLEAN DEFAULT false,
  
  -- Hero Section
  h1 TEXT,
  hero_subtitle TEXT,
  hero_intro TEXT,
  hero_image TEXT,
  hero_stats JSONB DEFAULT '[]'::jsonb,
  
  -- Content Sections
  section_1_title TEXT,
  section_1_content TEXT,
  section_2_title TEXT,
  section_2_content TEXT,
  section_3_title TEXT,
  section_3_content TEXT,
  body_content TEXT,
  cta_text TEXT,
  cta_button_text TEXT,
  cta_button_url TEXT,
  
  -- FAQ Section
  faqs JSONB DEFAULT '[]'::jsonb,
  
  -- Media
  featured_image TEXT,
  gallery_images JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  is_published BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;

-- Policies: Public read, super_admin write
CREATE POLICY "Page content is viewable by everyone"
ON public.page_content
FOR SELECT
USING (true);

CREATE POLICY "Only super_admins can insert page content"
ON public.page_content
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Only super_admins can update page content"
ON public.page_content
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Only super_admins can delete page content"
ON public.page_content
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Create indexes
CREATE INDEX idx_page_content_slug ON public.page_content(page_slug);
CREATE INDEX idx_page_content_type ON public.page_content(page_type);
CREATE INDEX idx_page_content_reference ON public.page_content(reference_id);

-- Trigger for updated_at
CREATE TRIGGER update_page_content_updated_at
BEFORE UPDATE ON public.page_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();