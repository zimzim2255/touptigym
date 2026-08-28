-- ============================================================
-- TOUPTI GYM - WIPE ALL DATABASE TABLES
-- ============================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new
--
-- ⚠️ WARNING: This will DELETE ALL ROWS from all tables!
-- Only run if you want to start fresh and re-import.
-- ============================================================

-- Delete in order to respect foreign key constraints

-- 1. Junction tables
DELETE FROM subscription_courses;
DELETE FROM subscription_groups;
DELETE FROM subscription_activities;

-- 2. Payment-dependent tables
DELETE FROM payments;

-- 3. Subscription-dependent tables
DELETE FROM subscriptions;

-- 4. Child-dependent tables
DELETE FROM attendance;
DELETE FROM requests;
DELETE FROM access_logs;
DELETE FROM zkteco_logs;

-- 5. Parent-child junction
DELETE FROM parent_children;

-- 6. Independent/log tables
DELETE FROM checks;
DELETE FROM zkteco_commands;
DELETE FROM zkteco_devices;

-- 7. Core tables
DELETE FROM children;
DELETE FROM parents;
DELETE FROM exercises;
DELETE FROM trainers;
DELETE FROM groups;
DELETE FROM prices;
DELETE FROM discounts;

-- 8. Birthday email log
DELETE FROM birthday_email_sent;

-- ============================================================
-- VERIFY: Check all tables are empty
-- ============================================================
SELECT 'subscription_courses' AS table_name, COUNT(*) AS rows FROM subscription_courses
UNION ALL SELECT 'subscription_groups', COUNT(*) FROM subscription_groups
UNION ALL SELECT 'subscription_activities', COUNT(*) FROM subscription_activities
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance
UNION ALL SELECT 'requests', COUNT(*) FROM requests
UNION ALL SELECT 'access_logs', COUNT(*) FROM access_logs
UNION ALL SELECT 'zkteco_logs', COUNT(*) FROM zkteco_logs
UNION ALL SELECT 'parent_children', COUNT(*) FROM parent_children
UNION ALL SELECT 'checks', COUNT(*) FROM checks
UNION ALL SELECT 'zkteco_commands', COUNT(*) FROM zkteco_commands
UNION ALL SELECT 'zkteco_devices', COUNT(*) FROM zkteco_devices
UNION ALL SELECT 'children', COUNT(*) FROM children
UNION ALL SELECT 'parents', COUNT(*) FROM parents
UNION ALL SELECT 'exercises', COUNT(*) FROM exercises
UNION ALL SELECT 'trainers', COUNT(*) FROM trainers
UNION ALL SELECT 'groups', COUNT(*) FROM groups
UNION ALL SELECT 'prices', COUNT(*) FROM prices
UNION ALL SELECT 'discounts', COUNT(*) FROM discounts
UNION ALL SELECT 'birthday_email_sent', COUNT(*) FROM birthday_email_sent;

-- ============================================================
-- DONE! All tables are now empty.
-- You can now re-import the data:
-- Run import files in order: 01, 02, 03, ... 20
-- ============================================================