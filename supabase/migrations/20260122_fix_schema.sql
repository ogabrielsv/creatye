-- Create instagram_accounts if not exists or update it
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    ig_user_id text NOT NULL,
    username text,
    access_token text NOT NULL,
    token_type text DEFAULT 'bearer',
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    status text DEFAULT 'connected', -- Extra column often used
    CONSTRAINT instagram_accounts_pkey PRIMARY KEY (id),
    CONSTRAINT instagram_unique_user_ig UNIQUE (user_id, ig_user_id)
);

-- Ensure username column exists if it was missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instagram_accounts' AND column_name = 'username') THEN
        ALTER TABLE public.instagram_accounts ADD COLUMN username text;
    END IF;
END $$;

-- Create webhook_events
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    received_at timestamptz DEFAULT now(),
    payload jsonb NOT NULL,
    processed_at timestamptz,
    CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);

-- Create automation_logs
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    level text,
    source text,
    message text,
    meta jsonb,
    user_id uuid, -- Optional but good for references
    job_id uuid, -- Optional
    instagram_account_id uuid, -- Optional
    CONSTRAINT automation_logs_pkey PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON public.webhook_events(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_logs_created ON public.automation_logs(created_at DESC);
