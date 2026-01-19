-- 1) Permitir execucao sem version_id (evita "Failed to create execution log")
ALTER TABLE public.automation_executions
  ALTER COLUMN version_id DROP NOT NULL;

-- 2) Garantir defaults essenciais (se ja existirem, manter)
ALTER TABLE public.automation_executions
  ALTER COLUMN created_at SET DEFAULT now();

-- 3) Indexes para contagem por automation_id/user_id
CREATE INDEX IF NOT EXISTS idx_exec_user_automation
  ON public.automation_executions (user_id, automation_id);

CREATE INDEX IF NOT EXISTS idx_exec_automation_created
  ON public.automation_executions (automation_id, created_at DESC);

-- 4) RPC para listar automacoes + contagem real (1 query)
-- UPDATED: Retorna TODAS as colunas de automations para evitar quebra de UI
CREATE OR REPLACE FUNCTION public.list_automations_with_exec_counts()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  description text,
  status text,
  type text,
  channels jsonb,
  folder_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  published_at timestamptz,
  title text, -- Caso exista
  executions_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
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
    COALESCE(e.cnt, 0) AS executions_count
  FROM public.automations a
  LEFT JOIN (
    SELECT automation_id, COUNT(*)::bigint AS cnt
    FROM public.automation_executions
    WHERE user_id = auth.uid()
    GROUP BY automation_id
  ) e ON e.automation_id = a.id
  WHERE a.user_id = auth.uid()
  ORDER BY a.created_at DESC;
$$;

-- Permissoes
GRANT EXECUTE ON FUNCTION public.list_automations_with_exec_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_automations_with_exec_counts() TO service_role;

-- Forcar reload do PostgREST para parar PGRST204
SELECT pg_notify('pgrst', 'reload schema');
