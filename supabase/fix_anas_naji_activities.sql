-- ============================================================
-- ONE-TIME FIX: Assign historical activities to ANAS NAJI
-- Run this in Supabase SQL Editor (ONCE)
-- ============================================================

-- 1) Count unassigned activities
SELECT COUNT(*) AS unassigned_activities
FROM exercises
WHERE coach_id IS NULL;

-- 2) Assign ALL unassigned activities to ANAS NAJI
UPDATE exercises
SET coach_id = (
  SELECT id FROM trainers
  WHERE LOWER(TRIM(name)) = LOWER(TRIM('ANAS NAJI'))
  LIMIT 1
)
WHERE coach_id IS NULL
  AND EXISTS (
    SELECT 1 FROM trainers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM('ANAS NAJI'))
  );

-- 3) Verify
SELECT
  CASE WHEN e.coach_id IS NULL THEN 'UNASSIGNED' ELSE COALESCE(t.name, '?') END AS coach,
  COUNT(*) AS activities
FROM exercises e
LEFT JOIN trainers t ON t.id = e.coach_id
GROUP BY coach
ORDER BY coach;