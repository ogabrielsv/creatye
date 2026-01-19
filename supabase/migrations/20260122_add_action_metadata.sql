BEGIN;

-- Add metadata column to actions for rich content (cards, buttons, etc.)
ALTER TABLE public.automation_actions
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Also add to triggers just in case (e.g. specific conditions)
ALTER TABLE public.automation_triggers
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMIT;

SELECT pg_notify('pgrst', 'reload schema');
