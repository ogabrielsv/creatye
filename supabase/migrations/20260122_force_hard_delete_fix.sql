BEGIN;

-- 1) Ensure CASCADE triggers/constraints are robust (Hard Delete Safety)
DO $$
BEGIN
  -- Triggers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_triggers') THEN
    ALTER TABLE public.automation_triggers DROP CONSTRAINT IF EXISTS automation_triggers_automation_id_fkey;
    ALTER TABLE public.automation_triggers ADD CONSTRAINT automation_triggers_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;

  -- Actions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_actions') THEN
    ALTER TABLE public.automation_actions DROP CONSTRAINT IF EXISTS automation_actions_automation_id_fkey;
    ALTER TABLE public.automation_actions ADD CONSTRAINT automation_actions_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;

  -- Drafts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_drafts') THEN
    ALTER TABLE public.automation_drafts DROP CONSTRAINT IF EXISTS automation_drafts_automation_id_fkey;
    ALTER TABLE public.automation_drafts ADD CONSTRAINT automation_drafts_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;

  -- Executions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_executions') THEN
    ALTER TABLE public.automation_executions DROP CONSTRAINT IF EXISTS automation_executions_automation_id_fkey;
    ALTER TABLE public.automation_executions ADD CONSTRAINT automation_executions_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Re-create View automations_with_stats (Ensures executions_count exists and logic is correct)
DROP VIEW IF EXISTS public.automations_with_stats;
DROP VIEW IF EXISTS public.automations_with_exec_count;

CREATE OR REPLACE VIEW public.automations_with_stats AS
SELECT
  a.id,
  a.user_id,
  a.name,
  a.description,
  a.status,
  a.type,
  a.channels,
  a.folder_id,
  a.created_at,
  a.updated_at,
  a.published_at,
  a.title,
  a.deleted_at, -- Even if we hard delete, this column might exist. If not, this line fails. 
  -- We assume deleted_at exists from previous migration. If hard deleting, this view will just show remaining rows.
  COALESCE(e.cnt, 0)::int AS executions_count
FROM public.automations a
LEFT JOIN (
  SELECT automation_id, COUNT(id) as cnt
  FROM public.automation_executions
  GROUP BY automation_id
) e ON e.automation_id = a.id
-- We only show non-deleted items (if soft delete happened previously)
WHERE (a.deleted_at IS NULL);

-- 3) Ensure RLS Policies for DELETE are present and correct
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automations_delete_own" ON public.automations;
CREATE POLICY "automations_delete_own"
ON public.automations FOR DELETE
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT ON public.automations_with_stats TO authenticated;
GRANT SELECT ON public.automations_with_stats TO service_role;

COMMIT;

-- Force reload
SELECT pg_notify('pgrst', 'reload schema');
