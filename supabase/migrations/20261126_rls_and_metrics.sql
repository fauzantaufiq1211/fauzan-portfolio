-- Schema update: optional JSONB highlight metrics on portfolio_sections
ALTER TABLE public.portfolio_sections
  ADD COLUMN IF NOT EXISTS metrics jsonb DEFAULT '[]'::jsonb;

-- Enable Row Level Security across all six portfolio and CMS tables
ALTER TABLE public.portfolio_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Public read policies for published portfolio and profile tables
DROP POLICY IF EXISTS "Public read portfolio_sections" ON public.portfolio_sections;
CREATE POLICY "Public read portfolio_sections"
  ON public.portfolio_sections
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read portfolio_items" ON public.portfolio_items;
CREATE POLICY "Public read portfolio_items"
  ON public.portfolio_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read experience" ON public.experience;
CREATE POLICY "Public read experience"
  ON public.experience
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read education" ON public.education;
CREATE POLICY "Public read education"
  ON public.education
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read competencies" ON public.competencies;
CREATE POLICY "Public read competencies"
  ON public.competencies
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public inquiry submission policy on messages (insert only, no public read)
DROP POLICY IF EXISTS "Public insert messages" ON public.messages;
CREATE POLICY "Public insert messages"
  ON public.messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(coalesce(name, ''))) BETWEEN 1 AND 100
    AND char_length(trim(coalesce(email, ''))) BETWEEN 3 AND 150
    AND char_length(trim(coalesce(message, ''))) BETWEEN 1 AND 2000
  );

-- Single-administrator full CRUD policies restricted to admin@fauzantaufiq.id
DROP POLICY IF EXISTS "Admin manage portfolio_sections" ON public.portfolio_sections;
CREATE POLICY "Admin manage portfolio_sections"
  ON public.portfolio_sections
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id');

DROP POLICY IF EXISTS "Admin manage portfolio_items" ON public.portfolio_items;
CREATE POLICY "Admin manage portfolio_items"
  ON public.portfolio_items
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id');

DROP POLICY IF EXISTS "Admin manage experience" ON public.experience;
CREATE POLICY "Admin manage experience"
  ON public.experience
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id');

DROP POLICY IF EXISTS "Admin manage education" ON public.education;
CREATE POLICY "Admin manage education"
  ON public.education
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id');

DROP POLICY IF EXISTS "Admin manage competencies" ON public.competencies;
CREATE POLICY "Admin manage competencies"
  ON public.competencies
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id');

DROP POLICY IF EXISTS "Admin manage messages" ON public.messages;
CREATE POLICY "Admin manage messages"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id');

-- Storage policies for portfolio-images bucket (public read, admin write)
DROP POLICY IF EXISTS "Public read portfolio-images" ON storage.objects;
CREATE POLICY "Public read portfolio-images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'portfolio-images');

DROP POLICY IF EXISTS "Admin manage portfolio-images" ON storage.objects;
CREATE POLICY "Admin manage portfolio-images"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'portfolio-images'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id'
  )
  WITH CHECK (
    bucket_id = 'portfolio-images'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@fauzantaufiq.id'
  );
