-- ============================================================
-- TOUPTI GYM - Database Schema (Supabase/PostgreSQL)
-- ============================================================

-- 1. Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'worker', 'trainer', 'parent')),
  password_hash VARCHAR(255) NOT NULL,
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Children
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('Garçon', 'Fille')),
  birth_date DATE NOT NULL,
  age INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM AGE(birth_date))) STORED,
  school VARCHAR(255),
  school_type VARCHAR(50) CHECK (school_type IN ('Bilingue', 'Mission', 'Autre')),
  address TEXT,
  postal_code VARCHAR(20),
  client_type VARCHAR(20) DEFAULT 'Normal' CHECK (client_type IN ('Normal', 'VIP')),
  zkteco_id VARCHAR(50) UNIQUE,
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Parents
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  id_card VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Parent-Child relationship
CREATE TABLE parent_children (
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);

-- 5. Prices
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('subscription', 'registration_fee', 'insurance')),
  activities INT,
  duration VARCHAR(20) CHECK (duration IN ('session', 'year')),
  amount DECIMAL(10,2) NOT NULL,
  editable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Discounts
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
  value DECIMAL(10,2) NOT NULL,
  condition TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Trainers
CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  birth_date DATE,
  id_card VARCHAR(50),
  photo TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  specialty VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Exercises
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  day VARCHAR(20) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Football', 'Basketball', 'Swimming', 'Gymnastics', 'Other')),
  start_date DATE,
  end_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  coach_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Session', 'Annuel')),
  sub_type VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  insurance DECIMAL(10,2) DEFAULT 0,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'en_attente' CHECK (status IN ('actif', 'en_attente', 'expiré', 'résilié')),
  exercises UUID[] DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(50)[] NOT NULL,
  check_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Checks
CREATE TABLE checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  bank VARCHAR(255),
  account_holder VARCHAR(255),
  used BOOLEAN DEFAULT false,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ZKTeco Devices
CREATE TABLE zkteco_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(50),
  port INT DEFAULT 4370,
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
  location VARCHAR(255),
  last_log TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Access Schedules
CREATE TABLE access_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  window_before INT DEFAULT 15,
  window_after INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Access Logs
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  device_id UUID REFERENCES zkteco_devices(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('entry', 'exit')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('granted', 'denied', 'error')),
  denial_reason TEXT,
  mode VARCHAR(20) DEFAULT 'online' CHECK (mode IN ('online', 'offline')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Absences
CREATE TABLE absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('absence', 'retard', 'depart_anticipe')),
  justified BOOLEAN DEFAULT false,
  justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Urgent Requests
CREATE TABLE urgent_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'approuvée', 'rejetée')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_children_name ON children(name);
CREATE INDEX idx_children_zkteco ON children(zkteco_id);
CREATE INDEX idx_subscriptions_child ON subscriptions(child_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_access_logs_child ON access_logs(child_id);
CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp);
CREATE INDEX idx_absences_child ON absences(child_id);
CREATE INDEX idx_absences_date ON absences(date);
CREATE INDEX idx_urgent_requests_status ON urgent_requests(status);
CREATE INDEX idx_exercises_coach ON exercises(coach_id);
CREATE INDEX idx_exercises_day ON exercises(day);