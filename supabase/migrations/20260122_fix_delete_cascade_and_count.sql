BEGIN;

-- 0) Garantir FK CASCADE (pra deletar automação apagar tudo relacionado)
-- Triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_triggers') THEN
    ALTER TABLE public.automation_triggers
      DROP CONSTRAINT IF EXISTS automation_triggers_automation_id_fkey;
    ALTER TABLE public.automation_triggers
      ADD CONSTRAINT automation_triggers_automation_id_fkey
      FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Actions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_actions') THEN
    ALTER TABLE public.automation_actions
      DROP CONSTRAINT IF EXISTS automation_actions_automation_id_fkey;
    ALTER TABLE public.automation_actions
      ADD CONSTRAINT automation_actions_automation_id_fkey
      FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drafts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_drafts') THEN
    ALTER TABLE public.automation_drafts
      DROP CONSTRAINT IF EXISTS automation_drafts_automation_id_fkey;
    ALTER TABLE public.automation_drafts
      ADD CONSTRAINT automation_drafts_automation_id_fkey
      FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Executions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_executions') THEN
    ALTER TABLE public.automation_executions
      DROP CONSTRAINT IF EXISTS automation_executions_automation_id_fkey;
    ALTER TABLE public.automation_executions
      ADD CONSTRAINT automation_executions_automation_id_fkey
      FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1) VIEW de contagem REAL (count por automation_id)
-- Atualizado para incluir todas as colunas necessárias para o frontend
CREATE OR REPLACE VIEW public.automations_with_exec_count AS
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
  COALESCE(COUNT(e.id), 0)::int AS executions_count
FROM public.automations a
LEFT JOIN public.automation_executions e
  ON e.automation_id = a.id
GROUP BY a.id;

COMMIT;

-- Força PostgREST recarregar schema
SELECT pg_notify('pgrst', 'reload schema');
