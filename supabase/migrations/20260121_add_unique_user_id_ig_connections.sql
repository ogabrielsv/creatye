-- Migration: Add unique constraint on user_id to ig_connections
-- Date: 2026-01-21

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ig_connections_user_id_key'
    ) THEN
        ALTER TABLE "public"."ig_connections" ADD CONSTRAINT "ig_connections_user_id_key" UNIQUE ("user_id");
    END IF;
END $$;
