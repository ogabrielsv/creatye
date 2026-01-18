-- Migration: Add folders table and update automations
-- Date: 2026-01-21

-- Create folders table
CREATE TABLE IF NOT EXISTS public.folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add unique constraint to folders (user_id, name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'folders_user_id_name_key'
    ) THEN
        ALTER TABLE public.folders ADD CONSTRAINT folders_user_id_name_key UNIQUE (user_id, name);
    END IF;
END $$;

-- Enable RLS on folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Policies for folders
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders" ON public.folders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;
CREATE POLICY "Users can insert their own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
CREATE POLICY "Users can update their own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
CREATE POLICY "Users can delete their own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);


-- Update automations table
ALTER TABLE public.automations
ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;

-- Create index on automations for ordering and filtering
CREATE INDEX IF NOT EXISTS idx_automations_user_id_updated_at ON public.automations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_automations_folder_id ON public.automations(folder_id);
CREATE INDEX IF NOT EXISTS idx_automations_status ON public.automations(status);

-- Create updated_at function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for folders
DROP TRIGGER IF EXISTS handle_folders_updated_at ON public.folders;
CREATE TRIGGER handle_folders_updated_at
    BEFORE UPDATE ON public.folders
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Trigger for automations (ensure it exists)
DROP TRIGGER IF EXISTS handle_automations_updated_at ON public.automations;
CREATE TRIGGER handle_automations_updated_at
    BEFORE UPDATE ON public.automations
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
