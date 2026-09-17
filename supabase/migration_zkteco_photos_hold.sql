-- ============================================================
-- Migration: zkteco_photos (hold device/photo until claimed by the app)
-- The relay uploads person photos from ZKBio into this table, tied to the
-- ZKTeco PIN. When the app creates/edits a child with that PIN, it claims
-- the photo as the child's profile picture.
--
-- RLS is intentionally left OFF so the gym-PC relay (anon REST key) can
-- insert/read rows. Run once in the Supabase SQL editor.
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_zkteco_photos_zkteco_id ON zkteco_photos(zkteco_id);
CREATE INDEX IF NOT EXISTS idx_zkteco_photos_status ON zkteco_photos(status);