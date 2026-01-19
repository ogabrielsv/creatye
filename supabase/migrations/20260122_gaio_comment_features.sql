BEGIN;

-- 1) Automations: canal/tipo + alvo + soft delete + published_version_id
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'dm',
  ADD COLUMN IF NOT EXISTS target_mode text DEFAULT 'any', -- any|specific
  ADD COLUMN IF NOT EXISTS target_media_id text,           -- IG media id quando specific
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_version_id uuid;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_automations_user_status_channel
  ON public.automations (user_id, status, channel)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automations_target
  ON public.automations (channel, target_mode, target_media_id)
  WHERE deleted_at IS NULL;

-- 2) Cache de posts do IG para mostrar preview/seleção no UI
CREATE TABLE IF NOT EXISTS public.ig_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ig_connection_id uuid,
  media_id text NOT NULL,               -- id do post no Instagram Graph
  media_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  media_url text,
  timestamp timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_ig_media_user ON public.ig_media(user_id, timestamp DESC);

-- 3) Versões e Execuções
CREATE TABLE IF NOT EXISTS public.automation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir coluna version_id em executions (se não existir)
ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS version_id uuid;

-- Garantir FK correta para automation_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_executions_version_id_fkey'
  ) THEN
    ALTER TABLE public.automation_executions
      ADD CONSTRAINT automation_executions_version_id_fkey
      FOREIGN KEY (version_id) REFERENCES public.automation_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4) View de contagem real (somente sucesso)
CREATE OR REPLACE VIEW public.automation_execution_counts AS
SELECT
  automation_id,
  COUNT(*) FILTER (WHERE status = 'success')::int AS success_count,
  COUNT(*)::int AS total_count
FROM public.automation_executions
GROUP BY automation_id;

COMMIT;

SELECT pg_notify('pgrst', 'reload schema');
