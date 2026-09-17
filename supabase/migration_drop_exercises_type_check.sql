-- ============================================================
-- Allow custom activity "type" names on the exercises table.
-- The old CHECK constraint only allowed
-- ('Football', 'Basketball', 'Swimming', 'Gymnastics', 'Other'),
-- which rejected any user-typed type. Dropping it lets admins
-- store any activity name (e.g. "Danse", "Judo", "Boxe").
-- ============================================================
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_type_check;

-- Sanity check: list the constraint should now be gone
SELECT conname
FROM pg_constraint
WHERE conrelid = 'exercises'::regclass AND conname = 'exercises_type_check';