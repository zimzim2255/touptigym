-- ============================================================
-- ZKTeco Integration Tables — PUSH SDK Support
-- ============================================================

-- 1. Access Logs (for ERP attendance tracking)
-- Stores granted/denied access events processed from ZKTeco device
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('entry', 'exit')),
  status VARCHAR(50) NOT NULL DEFAULT 'granted',
  mode VARCHAR(20) DEFAULT 'online',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_child ON access_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_child_time ON access_logs(child_id, timestamp);

-- 2. ZKTeco Commands (command queue for devices)
-- Stores commands to be sent to ZKTeco devices via PUSH SDK
CREATE TABLE IF NOT EXISTS zkteco_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES zkteco_devices(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  params JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zkteco_commands_device ON zkteco_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_zkteco_commands_status ON zkteco_commands(status);

-- 3. ZKTeco Logs (raw device logs — ensure table exists)
CREATE TABLE IF NOT EXISTS zkteco_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  device_id VARCHAR(100),
  event_type VARCHAR(50),
  event_time TIMESTAMPTZ,
  status VARCHAR(20),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zkteco_logs_event_time ON zkteco_logs(event_time);
CREATE INDEX IF NOT EXISTS idx_zkteco_logs_status ON zkteco_logs(status);
CREATE INDEX IF NOT EXISTS idx_zkteco_logs_child ON zkteco_logs(child_id);

-- 4. Add missing columns to zkteco_devices (ensure compatibility with old schema)
ALTER TABLE zkteco_devices ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
ALTER TABLE zkteco_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_zkteco_devices_ip ON zkteco_devices(ip_address);

-- Only create serial_number index if column now exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zkteco_devices' AND column_name = 'serial_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_zkteco_devices_serial ON zkteco_devices(serial_number);
  END IF;
END $$;
