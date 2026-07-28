-- ============================================================
-- Migration: Add birthday_email_sent table
-- ============================================================

CREATE TABLE IF NOT EXISTS birthday_email_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, sent_date)
);

CREATE INDEX IF NOT EXISTS idx_birthday_sent_date ON birthday_email_sent(sent_date);