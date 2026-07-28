-- ============================================================
-- Migration: Add subscription_type_option to subscriptions
-- ============================================================

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_type_option VARCHAR(50) DEFAULT 'Nouvel abonnement' CHECK (subscription_type_option IN ('Nouvel abonnement', 'Réabonnement'));