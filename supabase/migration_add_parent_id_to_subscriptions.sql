-- ============================================================
-- Migration: Add parent_id column to subscriptions table
-- Safe to run on existing database (uses IF NOT EXISTS)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN parent_id UUID REFERENCES parents(id) ON DELETE SET NULL;
  END IF;
END $$;