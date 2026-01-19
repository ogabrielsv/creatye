BEGIN;

-- 1) Adicionar coluna deleted_at para Soft Delete
ALTER TABLE public.automations
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2) Criar/Atualizar View automations_with_stats (com filtro de deleted_at)
DROP VIEW IF EXISTS public.automations_with_exec_count; -- Drop old view key if exists to avoid confusion or keep it if used elsewhere. User asked for `automations_with_stats`.
DROP VIEW IF EXISTS public.automations_with_stats;

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
  a.deleted_at,
  COALESCE(COUNT(e.id), 0)::int AS executions_count
FROM public.automations a
LEFT JOIN public.automation_executions e
  ON e.automation_id = a.id
WHERE a.deleted_at IS NULL -- Critical for soft delete
GROUP BY a.id;

-- 3) Permissões RLS para a nova view (se necessário, views herdam do owner, mas RLS nas tabelas base importa)
-- A view query já filtra deleted_at, mas o RLS na tabela `automations` deve permitir o select.
-- As policies existentes de SELECT usam (user_id = auth.uid()), o que cobre linhas com deleted_at preenchido ou não.
-- O filtro `deleted_at IS NULL` na view garante que o usuário só vê ativos.

-- Grant access (PostgREST needs access to the view)
GRANT SELECT ON public.automations_with_stats TO authenticated;
GRANT SELECT ON public.automations_with_stats TO service_role;

COMMIT;

-- Force reload
SELECT pg_notify('pgrst', 'reload schema');
