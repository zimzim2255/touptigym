-- ============================================================
-- CREATE ADMIN / TRAINER / WORKER ACCOUNTS
-- Run this in Supabase SQL Editor
-- ============================================================
-- Password for ALL accounts below: password
-- Uses a VERIFIED bcryptjs hash (same library the login uses).
-- Re-running it will UPDATE existing accounts.
-- ============================================================

-- ─── 1) ADMIN ───────────────────────────────────────────────
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'admin@gym.com',
  'Administrateur',
  'admin',
  '$2b$10$B1dy.KE.tJnnhJiOluilOeKTIyySUh2PK/aHFns.nojHvYmTeMY.m',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  active = true;

-- ─── 2) TRAINER (optional) ─────────────────────────────────
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'trainer@gym.com',
  'Entraineur Test',
  'trainer',
  '$2b$10$B1dy.KE.tJnnhJiOluilOeKTIyySUh2PK/aHFns.nojHvYmTeMY.m',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  active = true;

-- ─── 3) WORKER (optional) ──────────────────────────────────
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'employe@gym.com',
  'Employe Test',
  'worker',
  '$2b$10$B1dy.KE.tJnnhJiOluilOeKTIyySUh2PK/aHFns.nojHvYmTeMY.m',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  active = true;

-- ─── VERIFY ────────────────────────────────────────────────
SELECT email, name, role, active FROM users WHERE email IN ('admin@gym.com','trainer@gym.com','employe@gym.com');