-- Migration: Fix schema and updated features
-- Date: 2026-01-21

-- 1. Update ig_connections table
ALTER TABLE public.ig_connections
    ADD COLUMN IF NOT EXISTS ig_username text,
    ADD COLUMN IF NOT EXISTS ig_name text,
    ADD COLUMN IF NOT EXISTS ig_profile_picture_url text,
    ADD COLUMN IF NOT EXISTS connected_at timestamp with time zone default now(),
    ADD COLUMN IF NOT EXISTS disconnected_at timestamp with time zone;

-- Ensure constraints are set (best effort if data allows)
-- We won't enforce NOT NULL on new columns immediately to avoid breaking existing rows without data,
-- but we set connected_at default.

-- 2. Update automations table
ALTER TABLE public.automations
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

-- Handle 'type' column. If it exists, ensure it has a default or is not null given a default.
-- If it doesn't exist, create it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='automations' AND column_name='type') THEN
        ALTER TABLE public.automations ADD COLUMN type text NOT NULL DEFAULT 'dm';
    ELSE
        -- If it exists, try to set a default if not present
        ALTER TABLE public.automations ALTER COLUMN type SET DEFAULT 'dm';
    END IF;
END $$;

-- 3. Create folders table if not exists
CREATE TABLE IF NOT EXISTS public.folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS for folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders" ON public.folders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;
CREATE POLICY "Users can insert their own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
CREATE POLICY "Users can update their own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
CREATE POLICY "Users can delete their own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- RLS for ig_connections (ensure security)
ALTER TABLE public.ig_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own connections" ON public.ig_connections;
CREATE POLICY "Users can view their own connections" ON public.ig_connections FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own connections" ON public.ig_connections;
CREATE POLICY "Users can insert their own connections" ON public.ig_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage their own connections" ON public.ig_connections;
CREATE POLICY "Users can manage their own connections" ON public.ig_connections FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automations_status ON public.automations(status);
CREATE INDEX IF NOT EXISTS idx_automations_folder_id ON public.automations(folder_id);
