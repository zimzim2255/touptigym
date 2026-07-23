-- ============================================================
-- Migration: Add gender column to parents table
-- Safe to run on existing database (uses IF NOT EXISTS)
-- ============================================================

-- Add gender column to parents table (safe, won't error if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parents' AND column_name = 'gender'
  ) THEN
    ALTER TABLE parents ADD COLUMN gender VARCHAR(20) DEFAULT '' CHECK (gender IN ('', 'Père', 'Mère'));
  END IF;
END $$;