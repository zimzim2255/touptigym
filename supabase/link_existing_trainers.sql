-- ============================================================
-- LINK EXISTING TRAINERS TO THEIR USER ACCOUNTS
-- Run this in Supabase SQL Editor
-- ============================================================
-- Purpose:
--   Existing trainers (created before the auto-linking was added)
--   need their user account linked so:
--   1. "Activités du Jour" only shows THEIR assigned activities
--   2. Password can be changed from "Modifier l'Entraîneur"
--
-- This script:
--   1. Syncs both directions for already-linked records
--   2. Matches trainer records to existing user accounts by EMAIL
--   3. Matches by PHONE fallback (phone@trainer.local naming)
-- ============================================================

-- ─── 1) SYNC ALREADY-LINKED PAIRS (both directions) ───────
-- If a trainer record already has user_id, make sure the user
-- also has trainer_id pointing back to it.
UPDATE users u
SET trainer_id = t.id
FROM trainers t
WHERE t.user_id = u.id
  AND (u.trainer_id IS NULL OR u.trainer_id <> t.id);

-- ─── 2) MATCH BY EMAIL ────────────────────────────────────
-- If the trainer's email matches a user account email with
-- role = 'trainer', link them.
UPDATE trainers t
SET user_id = u.id
FROM users u
WHERE t.user_id IS NULL
  AND LOWER(COALESCE(t.email, '')) = LOWER(u.email)
  AND u.role = 'trainer';

-- Sync the reverse link again
UPDATE users u
SET trainer_id = t.id
FROM trainers t
WHERE t.user_id = u.id
  AND (u.trainer_id IS NULL OR u.trainer_id <> t.id);

-- ─── 3) MATCH BY PHONE FALLBACK ───────────────────────────
-- If no email match, try the phone-based naming that was used
-- when creating trainer accounts: phone@trainer.local
-- (Handles formats: "06 12 34 56 78", "0612345678", "+212612345678")
UPDATE trainers t
SET user_id = u.id
FROM users u
WHERE t.user_id IS NULL
  AND LOWER(u.email) = LOWER(
    CONCAT(
      REPLACE(REPLACE(REPLACE(COALESCE(t.phone, ''), ' ', ''), '-', ''), '+', ''),
      '@trainer.local'
    )
  )
  AND u.role = 'trainer';

-- Sync the reverse link one final time
UPDATE users u
SET trainer_id = t.id
FROM trainers t
WHERE t.user_id = u.id
  AND (u.trainer_id IS NULL OR u.trainer_id <> t.id);

-- ─── 4) VERIFY ────────────────────────────────────────────
-- Shows which trainers are now linked to a user account.
-- Trainers with user_id = NULL still need an account created.
SELECT
  t.id AS trainer_id,
  t.name AS trainer_name,
  t.email,
  t.phone,
  u.id AS user_id,
  u.email AS user_email,
  u.role
FROM trainers t
LEFT JOIN users u ON u.id = t.user_id
ORDER BY t.name;

-- ============================================================
-- NOTE: If any trainers still show user_id = NULL after running:
--   They have NO user account yet. Create one for them via:
--   Entraîneurs → "Ajouter un Entraîneur" (enter the same info),
--   OR use the create_admin_account.sql pattern with their own
--   email/password.
-- ============================================================