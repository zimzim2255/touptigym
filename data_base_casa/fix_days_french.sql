-- ============================================================
-- TOUPTI GYM - FIX DAYS FROM ENGLISH TO FRENCH
-- ============================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new
--
-- This updates all day values in the `exercises` table
-- from English (Monday, Tuesday...) to French (Lundi, Mardi...)
-- ============================================================

-- Update days in exercises table
UPDATE exercises SET day = 'Lundi' WHERE day = 'Monday';
UPDATE exercises SET day = 'Mardi' WHERE day = 'Tuesday';
UPDATE exercises SET day = 'Mercredi' WHERE day = 'Wednesday';
UPDATE exercises SET day = 'Jeudi' WHERE day = 'Thursday';
UPDATE exercises SET day = 'Vendredi' WHERE day = 'Friday';
UPDATE exercises SET day = 'Samedi' WHERE day = 'Saturday';
UPDATE exercises SET day = 'Dimanche' WHERE day = 'Sunday';

-- ============================================================
-- VERIFY: Check the days are now in French
-- ============================================================
SELECT day, COUNT(*) AS total
FROM exercises
GROUP BY day
ORDER BY day;

-- ============================================================
-- DONE! All days are now in French.
-- ============================================================