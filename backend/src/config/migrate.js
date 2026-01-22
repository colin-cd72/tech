const { pool } = require('./database');
require('dotenv').config();

const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'crew' CHECK (role IN ('admin', 'scheduler', 'crew')),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sharepoint_id VARCHAR(255) UNIQUE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  location VARCHAR(500),
  venue VARCHAR(255),
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  load_in_time TIME,
  load_out_time TIME,
  cost_center VARCHAR(100),
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  default_rate DECIMAL(10,2),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crew members table
CREATE TABLE IF NOT EXISTS crew_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  department VARCHAR(100),
  default_position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
  hourly_rate DECIMAL(10,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment categories table
CREATE TABLE IF NOT EXISTS equipment_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES equipment_categories(id) ON DELETE SET NULL,
  description TEXT,
  serial_number VARCHAR(255),
  daily_rate DECIMAL(10,2) DEFAULT 0,
  replacement_cost DECIMAL(10,2),
  quantity_available INTEGER DEFAULT 1,
  location VARCHAR(255),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crew assignments table
CREATE TABLE IF NOT EXISTS crew_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  crew_member_id UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
  call_time TIME,
  end_time TIME,
  rate_override DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'no_show', 'completed')),
  notes TEXT,
  notification_sent_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, crew_member_id)
);

-- Equipment assignments table
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  rate_override DECIMAL(10,2),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, equipment_id)
);

-- SharePoint sync log
CREATE TABLE IF NOT EXISTS sharepoint_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  events_added INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  events_unchanged INTEGER DEFAULT 0,
  errors TEXT,
  synced_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Email settings table
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT false,
  smtp_user VARCHAR(255),
  smtp_pass VARCHAR(255),
  from_email VARCHAR(255),
  from_name VARCHAR(255) DEFAULT 'TGL Schedule',
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SharePoint settings table
CREATE TABLE IF NOT EXISTS sharepoint_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255),
  client_id VARCHAR(255),
  client_secret VARCHAR(255),
  site_url VARCHAR(500),
  list_name VARCHAR(255),
  field_mapping JSONB DEFAULT '{}',
  last_sync_at TIMESTAMP,
  sync_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification log table
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500),
  template VARCHAR(100),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  assignment_id UUID,
  status VARCHAR(50) DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_cost_center ON events(cost_center);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_event ON crew_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_crew ON crew_assignments(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignments_event ON equipment_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS crew_members_updated_at ON crew_members;
CREATE TRIGGER crew_members_updated_at BEFORE UPDATE ON crew_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS equipment_updated_at ON equipment;
CREATE TRIGGER equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS crew_assignments_updated_at ON crew_assignments;
CREATE TRIGGER crew_assignments_updated_at BEFORE UPDATE ON crew_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS equipment_assignments_updated_at ON equipment_assignments;
CREATE TRIGGER equipment_assignments_updated_at BEFORE UPDATE ON equipment_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS email_settings_updated_at ON email_settings;
CREATE TRIGGER email_settings_updated_at BEFORE UPDATE ON email_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS sharepoint_settings_updated_at ON sharepoint_settings;
CREATE TRIGGER sharepoint_settings_updated_at BEFORE UPDATE ON sharepoint_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`;

async function migrate() {
  console.log('Running database migrations...');

  try {
    await pool.query(schema);
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate();
