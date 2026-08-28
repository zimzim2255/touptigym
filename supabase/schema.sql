-- ============================================================
-- TOUPTI GYM - Database Schema (Supabase/PostgreSQL)
-- ============================================================

-- 1. Children (no dependencies)
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('Garçon', 'Fille')),
  birth_date DATE NOT NULL,
  age INT NOT NULL DEFAULT 0,
  school VARCHAR(255),
  school_type VARCHAR(50) CHECK (school_type IN ('Bilingue', 'Mission', 'Autre')),
  address TEXT,
  postal_code VARCHAR(20),
  client_type VARCHAR(20) DEFAULT 'Normal' CHECK (client_type IN ('Normal', 'VIP')),
  zkteco_id VARCHAR(50) UNIQUE,
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Parents (no dependencies)
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  id_card VARCHAR(50),
  gender VARCHAR(20) DEFAULT '' CHECK (gender IN ('', 'Père', 'Mère', 'Tuteur')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Parent-Child relationship
CREATE TABLE parent_children (
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);

-- 4. Trainers (no dependencies, created before users)
CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  birth_date DATE,
  id_card VARCHAR(50),
  photo TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  specialty VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Users (depends on trainers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'worker', 'trainer', 'parent')),
  password_hash VARCHAR(255) NOT NULL,
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id to trainers after users table exists
ALTER TABLE trainers ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 6. Prices
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('subscription', 'registration_fee', 'insurance')),
  activities INT,
  duration VARCHAR(20) CHECK (duration IN ('session', 'year')),
  amount DECIMAL(10,2) NOT NULL,
  editable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Discounts
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
  value DECIMAL(10,2) NOT NULL,
  condition TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Exercises (depends on trainers)
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

-- 9. Subscriptions (depends on children, users)
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
  paid_amount DECIMAL(10,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),
  confirmation_status VARCHAR(20) DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'unconfirmed')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Attendance / Absences
CREATE TABLE attendance (
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

-- 11. Checks
CREATE TABLE checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  bank VARCHAR(255),
  account_holder VARCHAR(255),
  date_emission DATE,
  date_execution DATE,
  file TEXT,
  montant_used DECIMAL(10,2) DEFAULT 0,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT[] DEFAULT '{}',
  check_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Urgent Requests
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'approuvée', 'rejetée')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. ZKTeco access logs
CREATE TABLE zkteco_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  device_id VARCHAR(100),
  event_type VARCHAR(50),
  event_time TIMESTAMPTZ,
  status VARCHAR(20),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. ZKTeco devices
CREATE TABLE zkteco_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(50),
  port INT DEFAULT 4370,
  serial_number VARCHAR(100),
  location VARCHAR(255),
  status VARCHAR(20) DEFAULT 'offline',
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_child ON attendance(child_id);
CREATE INDEX idx_subscriptions_child ON subscriptions(child_id);
CREATE INDEX idx_parent_children_child ON parent_children(child_id);
CREATE INDEX idx_parent_children_parent ON parent_children(parent_id);