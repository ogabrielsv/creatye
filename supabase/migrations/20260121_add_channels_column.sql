-- Migration: Add channels column to automations
-- Date: 2026-01-21 2

ALTER TABLE public.automations
    ADD COLUMN IF NOT EXISTS channels jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
