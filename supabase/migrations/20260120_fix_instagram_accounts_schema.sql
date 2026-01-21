DO $$
BEGIN
    ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS page_access_token text;
    ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS ig_username text;
    ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;
    ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
    ALTER TABLE public.instagram_accounts ADD COLUMN IF NOT EXISTS page_id text;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column already exists, skipping';
END
$$;

NOTIFY pgrst, 'reload schema';
