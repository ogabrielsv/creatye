BEGIN;

ALTER TABLE public.automations
ADD COLUMN IF NOT EXISTS trigger_type text DEFAULT 'dm_keyword';

COMMIT;

SELECT pg_notify('pgrst', 'reload schema');
