BEGIN;

-- 1. Ensure instagram_accounts has correct schema for Basic Display
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    ig_user_id text NOT NULL,
    username text,
    access_token text,
    token_type text DEFAULT 'bearer',
    expires_at timestamptz,
    connected_at timestamptz DEFAULT now(),
    status text DEFAULT 'connected', -- 'connected', 'expired', 'revoked', 'error'
    last_sync_at timestamptz,
    last_error text,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT instagram_accounts_user_id_unique UNIQUE (user_id)
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_user_id ON public.instagram_accounts(user_id);

-- 2. Automation Jobs Table
CREATE TABLE IF NOT EXISTS public.automation_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instagram_account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL, -- 'SYNC_MEDIA', 'ALERT_NEW_MEDIA'
    enabled boolean DEFAULT true,
    schedule text, -- '*/5 * * * *'
    config jsonb DEFAULT '{}'::jsonb,
    last_run_at timestamptz,
    next_run_at timestamptz,
    last_status text, -- 'ok', 'error', 'skipped'
    created_at timestamptz DEFAULT now()
);

-- Index for runner
CREATE INDEX IF NOT EXISTS idx_automation_jobs_runner ON public.automation_jobs(user_id, enabled);

-- 3. Automation Logs Table
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id uuid REFERENCES public.automation_jobs(id) ON DELETE SET NULL,
    instagram_account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,
    level text NOT NULL, -- 'info', 'warn', 'error'
    message text NOT NULL,
    meta jsonb,
    created_at timestamptz DEFAULT now()
);

-- Index for viewing logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_created ON public.automation_logs(user_id, created_at DESC);

COMMIT;

NOTIFY pgrst, 'reload schema';
