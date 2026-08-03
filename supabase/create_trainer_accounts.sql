-- ============================================================
-- CREATE USER ACCOUNTS FOR ALL EXISTING TRAINERS
-- Run this in Supabase SQL Editor (ONCE)
-- ============================================================
-- Creates a login account for every trainer that has an email,
-- and links it both ways (trainer.user_id + user.trainer_id).
--
-- Default password for all: password
-- (Change after first login via "Modifier l'Entraîneur")
-- ============================================================

-- ─── 1) CREATE user accounts for trainers that have an email ──
INSERT INTO users (email, name, role, password_hash, active)
SELECT
  LOWER(TRIM(t.email)),
  t.name,
  'trainer',
  '$2b$10$B1dy.KE.tJnnhJiOluilOeKTIyySUh2PK/aHFns.nojHvYmTeMY.m',  -- bcryptjs("password")
  true
FROM trainers t
WHERE t.email IS NOT NULL
  AND LOWER(TRIM(t.email)) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(t.email))
  );

-- ─── 2) LINK trainer records to their user accounts ──────────
UPDATE trainers t
SET user_id = u.id
FROM users u
WHERE t.user_id IS NULL
  AND LOWER(COALESCE(t.email, '')) = LOWER(u.email)
  AND u.role = 'trainer';

-- ─── 3) LINK user accounts back to their trainer records ─────
UPDATE users u
SET trainer_id = t.id
FROM trainers t
WHERE t.user_id = u.id
  AND (u.trainer_id IS NULL OR u.trainer_id <> t.id);

-- ─── 4) VERIFY ───────────────────────────────────────────────
SELECT
  t.id AS trainer_id,
  t.name AS trainer_name,
  t.email,
  u.id AS user_id,
  u.email AS user_email,
  u.role,
  CASE WHEN u.id IS NULL THEN 'NO ACCOUNT' ELSE 'LINKED' END AS status
FROM trainers t
LEFT JOIN users u ON u.id = t.user_id
ORDER BY t.name;