-- ============================================================
-- TOUPTI GYM - WIPE SUBSCRIPTIONS ONLY
-- ============================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new
--
-- ⚠️ This will DELETE ALL subscriptions and related data!
-- It removes:
--   - subscription_courses (junction)
--   - subscription_groups (junction)
--   - subscription_activities (junction)
--   - payments (linked to subscriptions)
--   - subscriptions (all rows)
--
-- It will NOT delete children, parents, exercises, groups, trainers.
-- ============================================================

-- 1. Delete junction tables first (FK dependencies)
DELETE FROM subscription_courses;
DELETE FROM subscription_groups;
DELETE FROM subscription_activities;

-- 2. Delete payments (FK to subscriptions)
DELETE FROM payments;

-- 3. Delete all subscriptions
DELETE FROM subscriptions;

-- ============================================================
-- VERIFY: Check all subscription tables are empty
-- ============================================================
SELECT 'subscription_courses' AS table_name, COUNT(*) AS rows FROM subscription_courses
UNION ALL SELECT 'subscription_groups', COUNT(*) FROM subscription_groups
UNION ALL SELECT 'subscription_activities', COUNT(*) FROM subscription_activities
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions;

-- ============================================================
-- DONE! All subscriptions have been removed.
-- Children, parents, activities, groups, and trainers are kept.
-- ============================================================