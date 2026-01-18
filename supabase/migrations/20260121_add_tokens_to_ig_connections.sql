-- Add missing columns to ig_connections
ALTER TABLE public.ig_connections 
ADD COLUMN IF NOT EXISTS ig_username text,
ADD COLUMN IF NOT EXISTS page_access_token text,
ADD COLUMN IF NOT EXISTS user_access_token text;
