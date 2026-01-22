-- Create automation_runs table
CREATE TABLE IF NOT EXISTS public.automation_runs (
    run_id uuid NOT NULL DEFAULT gen_random_uuid(),
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    status text DEFAULT 'running', -- running, completed, diff_error
    error text,
    counts jsonb DEFAULT '{}'::jsonb, -- e.g. { processed: 10, failed: 1 }
    CONSTRAINT automation_runs_pkey PRIMARY KEY (run_id)
);

-- Update automation_logs to include run_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_logs' AND column_name = 'run_id') THEN
        ALTER TABLE public.automation_logs ADD COLUMN run_id uuid;
    END IF;
END $$;

-- Also fix scope and username in instagram_accounts if needed (already done properly in previous steps but just in case)
-- Ensure automation_logs has automation_id if useful, but we use job_id mostly. (Prompt asks for automation_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_logs' AND column_name = 'automation_id') THEN
        ALTER TABLE public.automation_logs ADD COLUMN automation_id uuid;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON public.automation_runs(started_at DESC);
