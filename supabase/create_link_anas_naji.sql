-- ============================================================
-- CREATE + LINK USER ACCOUNT FOR ANAS NAJI
-- Run this in Supabase SQL Editor
-- ============================================================
-- The linking script found ANAS NAJI has NO user account.
-- This creates one (password: "password") and links it both ways.
-- ============================================================

-- ─── 1) CREATE the user account for ANAS NAJI ──────────────
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'ANASNAJI@gmail.com',
  'ANAS NAJI',
  'trainer',
  '$2b$10$B1dy.KE.tJnnhJiOluilOeKTIyySUh2PK/aHFns.nojHvYmTeMY.m',  -- bcryptjs("password")
  true
)
ON CONFLICT (email) DO UPDATE SET
  role = 'trainer',
  active = true
RETURNING id AS new_user_id;

-- ─── 2) LINK the trainer record to the new user account ────
UPDATE trainers t
SET user_id = u.id
FROM users u
WHERE t.email = 'ANASNAJI@gmail.com'
  AND LOWER(COALESCE(t.email, '')) = LOWER(u.email)
  AND u.role = 'trainer';

-- ─── 3) LINK the user account back to the trainer ──────────
UPDATE users u
SET trainer_id = t.id
FROM trainers t
WHERE t.user_id = u.id
  AND LOWER(t.email) = LOWER(u.email)
  AND u.trainer_id IS NULL;

-- ─── 4) VERIFY ─────────────────────────────────────────────
SELECT
  t.id AS trainer_id,
  t.name AS trainer_name,
  t.email,
  u.id AS user_id,
  u.email AS user_email,
  u.role
FROM trainers t
LEFT JOIN users u ON u.id = t.user_id
ORDER BY t.name;