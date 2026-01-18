-- Migration: Fix ig_connections schema for standard Instagram OAuth
-- Date: 2026-01-21

-- Ensure table structure is compatible
ALTER TABLE public.ig_connections
    ADD COLUMN IF NOT EXISTS ig_user_id text,
    ADD COLUMN IF NOT EXISTS ig_username text,
    ADD COLUMN IF NOT EXISTS ig_name text,
    ADD COLUMN IF NOT EXISTS ig_profile_picture_url text,
    ADD COLUMN IF NOT EXISTS disconnected_at timestamp with time zone,
    ALTER COLUMN page_id DROP NOT NULL; -- Ensure page_id is nullable

-- We will ignore 'username' column if it exists, code will use 'ig_username'.

-- Add schema cache reload notification
NOTIFY pgrst, 'reload schema';
