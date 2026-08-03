-- ============================================================
-- Migration: Add active column to users table
-- Allows admin to deactivate/reactivate employee accounts
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;