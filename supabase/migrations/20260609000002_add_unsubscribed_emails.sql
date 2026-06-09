CREATE TABLE IF NOT EXISTS public.unsubscribed_emails (
  email TEXT PRIMARY KEY,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.unsubscribed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public upsert for unsubscribe" ON public.unsubscribed_emails
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated" ON public.unsubscribed_emails
  FOR SELECT TO authenticated
  USING (true);
