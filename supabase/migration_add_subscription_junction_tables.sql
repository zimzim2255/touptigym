-- ============================================================
-- Migration: Add junction tables for subscription multi-select
-- ============================================================

-- 1. Subscription → Activities junction table
CREATE TABLE IF NOT EXISTS subscription_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, activity_id)
);

-- 2. Subscription → Groups junction table
CREATE TABLE IF NOT EXISTS subscription_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, group_id)
);

-- 3. Subscription → Courses (exercises) junction table (replaces exercises UUID[])
CREATE TABLE IF NOT EXISTS subscription_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, exercise_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sub_activities_sub ON subscription_activities(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_groups_sub ON subscription_groups(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_courses_sub ON subscription_courses(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_activities_activity ON subscription_activities(activity_id);
CREATE INDEX IF NOT EXISTS idx_sub_groups_group ON subscription_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_sub_courses_exercise ON subscription_courses(exercise_id);

-- Add activities and groups columns to subscriptions for denormalized storage (optional, helps with queries)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS activity_ids UUID[] DEFAULT '{}';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS group_ids UUID[] DEFAULT '{}';