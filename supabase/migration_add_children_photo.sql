-- ============================================================
-- Migration: ensure children.photo + ZKTeco support columns
-- Run once in the Supabase SQL editor.
-- Safe (uses IF NOT EXISTS).
-- ============================================================

-- 1. children.photo (profile picture URL, Cloudinary)
ALTER TABLE children ADD COLUMN IF NOT EXISTS photo TEXT;

-- 2. Ensure zkteco_id is unique (for looking up photos/access by PIN)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'children'
      AND indexdef ILIKE '%zkteco_id%'
      AND indexdef ILIKE '%UNIQUE%'
  ) THEN
    ALTER TABLE children ADD CONSTRAINT uq_children_zkteco_id UNIQUE (zkteco_id);
  END IF;
END $$;

-- 3. (Optional) index on zkteco_id for fast photo sync lookups
CREATE INDEX IF NOT EXISTS idx_children_zkteco_id ON children(zkteco_id);