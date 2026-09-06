-- ============================================================
-- Migration: profiles storage bucket (original-person photos)
-- ------------------------------------------------------------
-- This is the second half of the registration workflow:
--   Person ID + original photo
--     → uploaded to Supabase Storage as  profiles/{ID}.jpg
--     → linked in zkteco_photos (photo_url) by zkteco_id
--     → auto-shown in the app when the admin types that ID.
--
-- Creates a PUBLIC storage bucket so the photo URL can be used
-- directly in <img src> without signed URLs.
-- Run once in the Supabase SQL editor (Casa project).
-- ============================================================

-- 1) Public bucket `profiles`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles',
  'profiles',
  true,
  5242880,                                          -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/bmp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Storage policies (public read + anon insert/update/upsert so the
--    gym-PC registration script can upload with the anon key).
DROP POLICY IF EXISTS "profiles-public-read" ON storage.objects;
CREATE POLICY "profiles-public-read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profiles');

DROP POLICY IF EXISTS "profiles-anon-insert" ON storage.objects;
CREATE POLICY "profiles-anon-insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profiles');

DROP POLICY IF EXISTS "profiles-anon-upsert" ON storage.objects;
CREATE POLICY "profiles-anon-upsert"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profiles')
  WITH CHECK (bucket_id = 'profiles');

-- 3) zkteco_photos holding table (ensure it exists — from
--    migration_zkteco_photos_hold.sql) so register_person.js can link ID->photo
CREATE TABLE IF NOT EXISTS zkteco_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zkteco_id VARCHAR(50) NOT NULL,
  photo_url TEXT,
  cloudinary_public_id TEXT,
  source VARCHAR(20) DEFAULT 'device',
  status VARCHAR(20) DEFAULT 'pending',   -- pending | claimed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  UNIQUE (zkteco_id)
);
CREATE INDEX IF NOT EXISTS idx_zkteco_photos_status ON zkteco_photos(status);