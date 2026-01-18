
-- Migration: Add Automation Drafts Table
-- Date: 2026-01-21

CREATE TABLE IF NOT EXISTS public.automation_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    nodes jsonb DEFAULT '[]'::jsonb,
    edges jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(automation_id) -- Only one draft per automation for now, or remove if supporting version history
);

-- RLS
ALTER TABLE public.automation_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage Own Drafts" ON public.automation_drafts;
CREATE POLICY "Manage Own Drafts" ON public.automation_drafts USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
