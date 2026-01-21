CREATE TABLE IF NOT EXISTS public.instagram_accounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ig_user_id text,
    page_id text,
    page_access_token text,
    user_access_token text,
    ig_username text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    disconnected_at timestamptz,
    CONSTRAINT uniq_user_instagram_account UNIQUE (user_id)
);

-- RLS Policies
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instagram account"
    ON public.instagram_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own instagram account"
    ON public.instagram_accounts FOR ALL
    USING (auth.uid() = user_id);
