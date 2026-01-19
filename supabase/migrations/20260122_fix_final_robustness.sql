BEGIN;

-- 1) Soft delete em automations
ALTER TABLE IF EXISTS public.automations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS automations_user_deleted_idx
  ON public.automations (user_id, deleted_at);

-- 2) automation_executions: permitir insert estável (corrige “Failed to create execution log”)
-- Se existir version_id e estiver NOT NULL, derruba exigência (se seu sistema ainda não usa versions)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='automation_executions' AND column_name='version_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.automation_executions ALTER COLUMN version_id DROP NOT NULL';
  END IF;
END $$;

-- Garante coluna payload/status se faltar (caso seu schema esteja incompleto)
ALTER TABLE IF EXISTS public.automation_executions
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS payload jsonb;

-- Defaults úteis
ALTER TABLE IF EXISTS public.automation_executions
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

-- id/created_at defaults (se existirem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='automation_executions' AND column_name='id'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.automation_executions ALTER COLUMN id SET DEFAULT gen_random_uuid()';
    EXCEPTION WHEN others THEN
      -- ignore se já tiver default ou função diferente
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='automation_executions' AND column_name='created_at'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.automation_executions ALTER COLUMN created_at SET DEFAULT now()';
    EXCEPTION WHEN others THEN
    END;
  END IF;
END $$;

-- 3) View de contagem real de execuções por automação (apenas automations não deletadas)
DROP VIEW IF EXISTS public.automation_execution_counts;
CREATE VIEW public.automation_execution_counts AS
SELECT
  a.id AS automation_id,
  COUNT(e.*) FILTER (WHERE e.status IS NULL OR e.status <> 'failed')::int AS executions_count
FROM public.automations a
LEFT JOIN public.automation_executions e
  ON e.automation_id = a.id
WHERE a.deleted_at IS NULL
GROUP BY a.id;

COMMIT;

-- 4) Force PostgREST schema reload (mata PGRST204 / cache)
SELECT pg_notify('pgrst', 'reload schema');
