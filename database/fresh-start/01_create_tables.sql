-- CLEAN DATABASE SCHEMA FOR FRESH START
-- This creates all tables with proper structure and NO problematic RLS policies

-- ============================================================================
-- STEP 1: Create all tables with proper structure
-- ============================================================================

-- Tank Groups table
CREATE TABLE IF NOT EXISTS tank_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fuel Tanks table  
CREATE TABLE IF NOT EXISTS fuel_tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT NOT NULL,
  product_type TEXT DEFAULT 'Diesel',
  safe_level INTEGER DEFAULT 10000,
  min_level INTEGER DEFAULT 0,
  group_id UUID REFERENCES tank_groups(id),
  subgroup TEXT,
  address TEXT,
  vehicle TEXT,
  discharge TEXT,
  bp_portal TEXT,
  delivery_window TEXT,
  afterhours_contact TEXT,
  notes TEXT,
  serviced_on DATE,
  serviced_by TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles table (CRITICAL: Simple structure, no recursive policies)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One role per user
);

-- User Group Permissions table
CREATE TABLE IF NOT EXISTS user_group_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES tank_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id) -- One permission per user per group
);

-- User Subgroup Permissions table
CREATE TABLE IF NOT EXISTS user_subgroup_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES tank_groups(id) ON DELETE CASCADE,
  subgroup_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id, subgroup_name)
);

-- Dip Readings table
CREATE TABLE IF NOT EXISTS dip_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES fuel_tanks(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value >= 0),
  recorded_by UUID REFERENCES auth.users(id),
  created_by_name TEXT, -- Store actual name for display
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ -- For soft deletes
);

-- Tank Alerts table
CREATE TABLE IF NOT EXISTS tank_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES fuel_tanks(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_fuel', 'critical_fuel', 'no_reading', 'maintenance')),
  message TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (for user display names)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_fuel_tanks_group_id ON fuel_tanks(group_id);
CREATE INDEX IF NOT EXISTS idx_fuel_tanks_subgroup ON fuel_tanks(subgroup);
CREATE INDEX IF NOT EXISTS idx_dip_readings_tank_id ON dip_readings(tank_id);
CREATE INDEX IF NOT EXISTS idx_dip_readings_created_at ON dip_readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dip_readings_archived_at ON dip_readings(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_group_permissions_user_id ON user_group_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subgroup_permissions_user_id ON user_subgroup_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_tank_alerts_tank_id ON tank_alerts(tank_id);

-- ============================================================================
-- STEP 3: Create update triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_tank_groups_updated_at BEFORE UPDATE ON tank_groups FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_fuel_tanks_updated_at BEFORE UPDATE ON fuel_tanks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_dip_readings_updated_at BEFORE UPDATE ON dip_readings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

SELECT 'CLEAN DATABASE SCHEMA CREATED SUCCESSFULLY' as result;
SELECT 'Ready for data import and RLS setup' as next_step; 