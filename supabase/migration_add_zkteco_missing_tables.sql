-- ============================================================
-- ZKTeco integration — Missing tables fix
-- Run this in Supabase SQL editor (or via: supabase db push)
-- ============================================================

-- 1. Access schedules (planning d'acces) - time windows per child per weekday
CREATE TABLE IF NOT EXISTS access_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0=Sunday ... 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_schedules_child ON access_schedules(child_id);

-- 2. Absences (marked by trainers during attendance)
CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('absence', 'retard', 'depart_anticipe')),
  justified BOOLEAN DEFAULT false,
  justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, exercise_id, date)
);

CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date);
CREATE INDEX IF NOT EXISTS idx_absences_child ON absences(child_id);

-- 3. Attendance records (tracks that attendance was marked for an exercise+date)
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exercise_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_exercise_date ON attendance_records(exercise_id, date);