-- ============================================================
-- Migration: Add admin confirmation status to subscriptions
-- Tracks whether an admin has confirmed/unconfirmed a subscription
-- pending = waiting for admin confirmation (default)
-- confirmed = green (admin confirmed)
-- unconfirmed = red (admin explicitly unconfirmed)
-- ============================================================

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(20) DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'unconfirmed'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;