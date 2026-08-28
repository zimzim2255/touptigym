-- ============================================================
-- ONE-TIME FIX: Assign historical activities to trainers
-- Run this in Supabase SQL Editor (ONCE)
-- ============================================================
-- Context:
--   Before the trainer-assignment system existed, activities
--   may have been created without a coach_id. This assigns
--   unassigned activities to trainers.
--
--   Future activities will be assigned through the system
--   normally - this is a one-time fix.
-- ============================================================

-- 1) Count unassigned activities
SELECT COUNT(*) AS unassigned_activities
FROM exercises
WHERE coach_id IS NULL;

-- 2) If there is exactly ONE trainer, assign all unassigned
--    activities to them. (Adjust the name below if needed.)
--    If there are multiple trainers, this does nothing and you
--    should assign manually or adjust the WHERE clause.
UPDATE exercises
SET coach_id = (
  SELECT id FROM trainers
  WHERE LOWER(TRIM(name)) = LOWER(TRIM('ANAS NAJI'))  -- <-- CHANGE THIS NAME
  LIMIT 1
)
WHERE coach_id IS NULL
  AND EXISTS (
    SELECT 1 FROM trainers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM('ANAS NAJI'))  -- <-- CHANGE THIS NAME
  );

-- 3) Verify the result
SELECT
  CASE WHEN e.coach_id IS NULL THEN 'UNASSIGNED' ELSE COALESCE(t.name, '?') END AS coach,
  COUNT(*) AS activities
FROM exercises e
LEFT JOIN trainers t ON t.id = e.coach_id
GROUP BY coach
ORDER BY coach;