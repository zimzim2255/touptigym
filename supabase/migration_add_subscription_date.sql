-- ============================================================
-- Migration: Add subscription_date column to subscriptions table
-- Safe to run on existing database (uses IF NOT EXISTS)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'subscription_date'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN subscription_date DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;