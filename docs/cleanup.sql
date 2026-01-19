-- Clean up automations that are published but invalid (missing triggers or actions)
-- This script sets them to 'draft' to avoid silent failures in the webhook.

BEGIN;

-- 1) Count invalid automations before update
DO $$
DECLARE
    invalid_count integer;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM public.automations a
    WHERE a.status = 'published'
    AND (
        NOT EXISTS (SELECT 1 FROM public.automation_triggers t WHERE t.automation_id = a.id)
        OR
        NOT EXISTS (SELECT 1 FROM public.automation_actions ac WHERE ac.automation_id = a.id)
    );
    
    RAISE NOTICE 'Found % automations to unpublish.', invalid_count;
END $$;

-- 2) Update status to 'draft' for invalid automations
UPDATE public.automations a
SET status = 'draft', updated_at = now()
WHERE a.status = 'published'
AND (
    NOT EXISTS (SELECT 1 FROM public.automation_triggers t WHERE t.automation_id = a.id)
    OR
    NOT EXISTS (SELECT 1 FROM public.automation_actions ac WHERE ac.automation_id = a.id)
);

-- 3) (Optional) Delete clearly test automations if needed. 
-- Uncomment and edit user_id to use safely.
/*
DELETE FROM public.automations
WHERE status = 'draft' 
AND (name ILIKE '%teste%' OR name ILIKE '%test%')
AND created_at < now() - INTERVAL '7 days';
*/

COMMIT;
