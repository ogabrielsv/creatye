-- Migration: Add ig_profile_picture_url column to ig_connections
-- Date: 2026-01-21

ALTER TABLE public.ig_connections
ADD COLUMN IF NOT EXISTS ig_profile_picture_url text;
