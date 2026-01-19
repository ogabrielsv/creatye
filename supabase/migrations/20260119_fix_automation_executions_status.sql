BEGIN;

-- 1) garantir que a tabela existe
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) garantir colunas (caso tabela exista mas falte algo)
ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS payload jsonb;

ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS error text;

ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 3) defaults e NOT NULL seguros
UPDATE public.automation_executions SET payload = '{}'::jsonb WHERE payload IS NULL;
ALTER TABLE public.automation_executions ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_executions ALTER COLUMN payload SET NOT NULL;

-- Garante que status seja text e not null
ALTER TABLE public.automation_executions ALTER COLUMN status TYPE text USING status::text;
UPDATE public.automation_executions SET status = 'running' WHERE status IS NULL;
ALTER TABLE public.automation_executions ALTER COLUMN status SET DEFAULT 'running';
ALTER TABLE public.automation_executions ALTER COLUMN status SET NOT NULL;

-- 4) (opcional) check básico de status para padronizar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'automation_executions_status_check'
  ) THEN
    ALTER TABLE public.automation_executions
      ADD CONSTRAINT automation_executions_status_check
      CHECK (status IN ('running','success','failed'));
  END IF;
END $$;

COMMIT;
