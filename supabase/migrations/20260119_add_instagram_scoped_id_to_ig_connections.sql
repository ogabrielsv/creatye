ALTER TABLE public.ig_connections
  ADD COLUMN IF NOT EXISTS instagram_scoped_id text;

CREATE INDEX IF NOT EXISTS ig_connections_instagram_scoped_id_idx
  ON public.ig_connections(instagram_scoped_id);
