-- Composite indexes for SEO query optimization

-- Clinics table indexes
CREATE INDEX IF NOT EXISTS idx_clinics_state_active ON clinics(state_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_clinics_city_active ON clinics(city_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_clinics_slug ON clinics(slug);
CREATE INDEX IF NOT EXISTS idx_clinics_is_claimed ON clinics(is_claimed) WHERE is_claimed = true;

-- Cities table indexes
CREATE INDEX IF NOT EXISTS idx_cities_slug_active ON cities(slug, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state_id);

-- Dentists table indexes
CREATE INDEX IF NOT EXISTS idx_dentists_clinic_active ON dentists(clinic_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_dentists_slug ON dentists(slug);

-- SEO pages index
CREATE INDEX IF NOT EXISTS idx_seo_pages_slug ON seo_pages(slug);

-- Blog posts indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- Treatments index
CREATE INDEX IF NOT EXISTS idx_treatments_slug_active ON treatments(slug, is_active) WHERE is_active = true;