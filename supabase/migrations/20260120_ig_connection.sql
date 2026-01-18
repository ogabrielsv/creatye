-- Migration: Create ig_connections table and policies
-- Date: 2026-01-20

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ig_connections (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'instagram',
    access_token text NOT NULL,
    token_expires_at timestamp with time zone,
    page_id text,
    ig_user_id text,
    username text,
    connected_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, provider)
);

-- RLS
ALTER TABLE public.ig_connections ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to allow clean re-run
DROP POLICY IF EXISTS "Users can view their own connections" ON public.ig_connections;
DROP POLICY IF EXISTS "Users can insert their own connections" ON public.ig_connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON public.ig_connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON public.ig_connections;

-- Create Policies
CREATE POLICY "Users can view their own connections" 
    ON public.ig_connections FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections" 
    ON public.ig_connections FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections" 
    ON public.ig_connections FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections" 
    ON public.ig_connections FOR DELETE 
    USING (auth.uid() = user_id);

-- Add updated_at trigger if not exists
-- (Assuming handle_updated_at function exists from previous migrations, otherwise create it)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS handle_ig_connections_updated_at ON public.ig_connections;
CREATE TRIGGER handle_ig_connections_updated_at
    BEFORE UPDATE ON public.ig_connections
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
