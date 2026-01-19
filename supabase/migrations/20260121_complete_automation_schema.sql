-- Migration: Complete Automation Schema Alignment
-- Date: 2026-01-21

-- 1. Automations Table (Ensure columns)
ALTER TABLE public.automations
    ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'dm';

-- Ensure defaults and checks
ALTER TABLE public.automations ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_status_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_status_check CHECK (status IN ('draft', 'published'));

-- 2. Automation Triggers
-- Re-creating or altering to match strict requirements (keyword instead of keyword_text)
CREATE TABLE IF NOT EXISTS public.automation_triggers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    kind text NOT NULL DEFAULT 'keyword' CHECK (kind IN ('keyword')),
    keyword text, -- Rename from keyword_text if exists or create new
    match_mode text NOT NULL DEFAULT 'contains' CHECK (match_mode IN ('contains', 'equals', 'exact')),
    case_insensitive boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Attempt to migrate keyword_text if it exists from previous step
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_triggers' AND column_name='keyword_text') THEN
        ALTER TABLE public.automation_triggers RENAME COLUMN keyword_text TO keyword;
    END IF;
END $$;

-- 3. Automation Actions
CREATE TABLE IF NOT EXISTS public.automation_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    kind text NOT NULL DEFAULT 'send_dm' CHECK (kind IN ('send_dm')),
    message_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Automation Executions
CREATE TABLE IF NOT EXISTS public.automation_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id), -- Add foreign key for RLS
    status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    error text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

-- Policies (User can only manage their own data)
-- Automations
DROP POLICY IF EXISTS "Manage Own Automations" ON public.automations;
CREATE POLICY "Manage Own Automations" ON public.automations USING (auth.uid() = user_id);

-- Triggers (Join automations to check permission) - Simpler: assuming we add user_id to triggers/actions as redundant key or join
-- User asked "SELECT/INSERT/UPDATE/DELETE somente quando user_id = auth.uid()"
-- Adding user_id to