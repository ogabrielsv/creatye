-- Migration: Add Automation Triggers, Actions, and Executions
-- Date: 2026-01-21

-- table: automation_triggers
CREATE TABLE IF NOT EXISTS public.automation_triggers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    kind text NOT NULL, -- e.g., 'keyword'
    keyword_text text, -- e.g., 'oi'
    match_mode text DEFAULT 'contains', -- 'contains', 'exact'
    case_insensitive boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- table: automation_actions
CREATE TABLE IF NOT EXISTS public.automation_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    kind text NOT NULL, -- e.g., 'send_dm'
    message_text text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- table: automation_executions
CREATE TABLE IF NOT EXISTS public.automation_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
    status text NOT NULL, -- 'running', 'success', 'failed'
    error text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

-- Policies (assuming automations are owned by user, triggers/actions accessed via automation ownership)
-- Ideally we join with automations, but for simplicity/speed let's assume we can rely on standard CRUD if we check automation ownership in API.
-- Actually, RLS is safer. Let's do simple RLS:
-- We need to check if the user owns the automation.
-- CREATE POLICY "Users can manage triggers of their automations" ... this is complex without a helper view or user_id column.
-- For standard CRUD, we might just duplicate user_id to these tables or rely on API logic.
-- Given the time, I'll add user_id to these tables to simplify RLS, or just trust the API (service role) for executions and ensuring access.
-- Let's add user_id to be safe and consistent with previous tables.

ALTER TABLE public.automation_triggers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.automation_actions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.automation_executions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Manage triggers" ON public.automation_triggers;
CREATE POLICY "Manage triggers" ON public.automation_triggers USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage actions" ON public.automation_actions;
CREATE POLICY "Manage actions" ON public.automation_actions USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage executions" ON public.automation_executions;
CREATE POLICY "Manage executions" ON public.automation_executions USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_triggers_automation_id ON public.automation_triggers(automation_id);
CREATE INDEX IF NOT EXISTS idx_actions_automation_id ON public.automation_actions(automation_id);
CREATE INDEX IF NOT EXISTS idx_executions_automation_id ON public.automation_executions(automation_id);

NOTIFY pgrst, 'reload schema';
