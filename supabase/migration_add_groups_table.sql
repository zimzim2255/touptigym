-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new

-- Create groups table (safe to run multiple times)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add group_id to exercises table (safe to run multiple times)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Drop first to avoid "already exists" error, then recreate
DROP POLICY IF EXISTS "Allow all on groups" ON groups;
CREATE POLICY "Allow all on groups" ON groups
  FOR ALL USING (true) WITH CHECK (true);