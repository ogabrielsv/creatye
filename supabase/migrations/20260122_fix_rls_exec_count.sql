BEGIN;

-- Extensão p/ UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tabela de execuções (garante colunas que o código usa)
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id uuid NULL,
  status text NOT NULL,
  payload jsonb NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Se existe automation_versions, mantém FK; se não existir, ignora sem quebrar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='automation_versions'
  ) THEN
    -- cria FK se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'automation_executions_version_id_fkey'
    ) THEN
      ALTER TABLE public.automation_executions
      ADD CONSTRAINT automation_executions_version_id_fkey
      FOREIGN KEY (version_id) REFERENCES public.automation_versions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_automation_executions_user_created
  ON public.automation_executions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_auto_created
  ON public.automation_executions (automation_id, created_at DESC);

-- 2) View com contagem real (todas execuções; se quiser só success, troque o filtro)
CREATE OR REPLACE VIEW public.automations_with_exec_count AS
SELECT
  a.*,
  COALESCE(COUNT(e.id), 0)::int AS executions_count
FROM public.automations a
LEFT JOIN public.automation_executions e
  ON e.automation_id = a.id
GROUP BY a.id;

-- 3) RLS ON + Policies (o painel precisa disso pra “não sumir”)
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

-- AUTOMATIONS
DROP POLICY IF EXISTS "automations_select_own" ON public.automations;
DROP POLICY IF EXISTS "automations_insert_own" ON public.automations;
DROP POLICY IF EXISTS "automations_update_own" ON public.automations;
DROP POLICY IF EXISTS "automations_delete_own" ON public.automations;

CREATE POLICY "automations_select_own"
ON public.automations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "automations_insert_own"
ON public.automations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "automations_update_own"
ON public.automations FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "automations_delete_own"
ON public.automations FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- DRAFTS
DROP POLICY IF EXISTS "drafts_select_own" ON public.automation_drafts;
DROP POLICY IF EXISTS "drafts_upsert_own" ON public.automation_drafts;
DROP POLICY IF EXISTS "drafts_delete_own" ON public.automation_drafts;

CREATE POLICY "drafts_select_own"
ON public.automation_drafts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "drafts_upsert_own"
ON public.automation_drafts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "drafts_delete_own"
ON public.automation_drafts FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- TRIGGERS
DROP POLICY IF EXISTS "triggers_select_own" ON public.automation_triggers;
DROP POLICY IF EXISTS "triggers_write_own" ON public.automation_triggers;
DROP POLICY IF EXISTS "triggers_delete_own" ON public.automation_triggers;

CREATE POLICY "triggers_select_own"
ON public.automation_triggers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "triggers_write_own"
ON public.automation_triggers FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "triggers_delete_own"
ON public.automation_triggers FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ACTIONS
DROP POLICY IF EXISTS "actions_select_own" ON public.automation_actions;
DROP POLICY IF EXISTS "actions_write_own" ON public.automation_actions;
DROP POLICY IF EXISTS "actions_delete_own" ON public.automation_actions;

CREATE POLICY "actions_select_own"
ON public.automation_actions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "actions_write_own"
ON public.automation_actions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "actions_delete_own"
ON public.automation_actions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- EXECUTIONS
DROP POLICY IF EXISTS "exec_select_own" ON public.automation_executions;
DROP POLICY IF EXISTS "exec_insert_own" ON public.automation_executions;

CREATE POLICY "exec_select_own"
ON public.automation_executions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "exec_insert_own"
ON public.automation_executions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

COMMIT;

-- 4) Força o PostgREST recarregar o schema (mata PGRST204)
SELECT pg_notify('pgrst', 'reload schema');
