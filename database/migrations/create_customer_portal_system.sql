-- Migration: Create Customer Portal System
-- This creates tables for customer self-service portal with tank access and delivery requests
-- Enables multi-tenant access where customers only see their assigned tanks

-- =============================================
-- CUSTOMER ACCOUNTS TABLE
-- =============================================
-- Links Supabase Auth users to customer accounts
-- Separate from customer_contacts (which is for email recipients)
CREATE TABLE IF NOT EXISTS customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to Supabase Auth user
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Optional link to existing customer_contacts (for upgrading email recipients to portal users)
  customer_contact_id UUID REFERENCES customer_contacts(id) ON DELETE SET NULL,
  -- Customer identification
  customer_name TEXT NOT NULL,
  customer_guid TEXT,
  -- Contact info (may differ from auth user email)
  contact_name TEXT,
  contact_phone TEXT,
  company_name TEXT,
  -- Account settings
  account_type TEXT DEFAULT 'customer' CHECK (account_type IN ('customer', 'gsf_staff')),
  is_active BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  -- Branding (for future white-label support)
  logo_url TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  -- Constraints
  UNIQUE(user_id)
);

-- Indexes for customer_accounts
CREATE INDEX IF NOT EXISTS idx_customer_accounts_user_id ON customer_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer_guid ON customer_accounts(customer_guid);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer_name ON customer_accounts(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_is_active ON customer_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_account_type ON customer_accounts(account_type);

-- =============================================
-- CUSTOMER TANK ACCESS TABLE
-- =============================================
-- Many-to-many: which tanks a customer can see in their portal
CREATE TABLE IF NOT EXISTS customer_tank_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  agbot_location_id UUID NOT NULL REFERENCES agbot_locations(id) ON DELETE CASCADE,
  -- Access level for future granularity
  access_level TEXT DEFAULT 'read' CHECK (access_level IN ('read', 'request_delivery', 'admin')),
  -- Assignment tracking
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  -- Prevent duplicate assignments
  UNIQUE(customer_account_id, agbot_location_id)
);

-- Indexes for customer_tank_access
CREATE INDEX IF NOT EXISTS idx_customer_tank_access_account_id ON customer_tank_access(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_customer_tank_access_location_id ON customer_tank_access(agbot_location_id);

-- =============================================
-- DELIVERY REQUESTS TABLE
-- =============================================
-- Customer requests for fuel delivery
CREATE TABLE IF NOT EXISTS delivery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to customer
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  -- Link to tank
  agbot_location_id UUID NOT NULL REFERENCES agbot_locations(id) ON DELETE CASCADE,
  -- Request details
  request_type TEXT NOT NULL DEFAULT 'standard' CHECK (request_type IN ('standard', 'urgent', 'scheduled')),
  requested_date DATE,
  requested_litres INTEGER,
  current_level_pct NUMERIC(5,2),
  predicted_empty_date DATE,
  notes TEXT,
  -- Status workflow: pending -> acknowledged -> scheduled -> in_progress -> completed
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Customer submitted, GSF not yet viewed
    'acknowledged',      -- GSF has seen the request
    'scheduled',         -- Delivery date confirmed
    'in_progress',       -- Driver en route
    'completed',         -- Delivery done
    'cancelled'          -- Request cancelled
  )),
  -- GSF workflow fields
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  scheduled_date DATE,
  scheduled_notes TEXT,
  assigned_driver TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  actual_litres_delivered INTEGER,
  delivery_notes TEXT,
  -- Cancellation tracking
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for delivery_requests
CREATE INDEX IF NOT EXISTS idx_delivery_requests_customer ON delivery_requests(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_location ON delivery_requests(agbot_location_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created ON delivery_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_requested_date ON delivery_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_scheduled_date ON delivery_requests(scheduled_date);

-- =============================================
-- DELIVERY REQUEST NOTIFICATIONS TABLE
-- =============================================
-- Track notifications sent for delivery requests
CREATE TABLE IF NOT EXISTS delivery_request_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_request_id UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'customer_requested',      -- Sent to GSF when customer requests
    'gsf_acknowledged',        -- Sent to customer when GSF acknowledges
    'gsf_scheduled',           -- Sent to customer when delivery scheduled
    'delivery_completed',      -- Sent to customer when delivery done
    'status_update',           -- Generic status change notification
    'reminder'                 -- Reminder for upcoming delivery
  )),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'gsf_staff')),
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  external_email_id TEXT,  -- Resend email ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_request ON delivery_request_notifications(delivery_request_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_type ON delivery_request_notifications(notification_type);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tank_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_request_notifications ENABLE ROW LEVEL SECURITY;

-- CUSTOMER ACCOUNTS POLICIES

-- Customers can view their own account
CREATE POLICY "Customers view own account" ON customer_accounts
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
  );

-- GSF staff can view all customer accounts
CREATE POLICY "GSF staff view all customer accounts" ON customer_accounts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- GSF staff can manage customer accounts
CREATE POLICY "GSF staff manage customer accounts" ON customer_accounts
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Customers can update their own account (limited fields)
CREATE POLICY "Customers update own account" ON customer_accounts
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
  ) WITH CHECK (
    user_id = auth.uid()
  );

-- CUSTOMER TANK ACCESS POLICIES

-- Customers can view their own tank access
CREATE POLICY "Customers view own tank access" ON customer_tank_access
  FOR SELECT TO authenticated USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

-- GSF staff can view all tank access
CREATE POLICY "GSF staff view all tank access" ON customer_tank_access
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- GSF staff can manage tank access
CREATE POLICY "GSF staff manage tank access" ON customer_tank_access
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- AGBOT LOCATIONS - Add policy for customer access
-- (Extends existing RLS - customers can view their assigned tanks)
CREATE POLICY "Customers view assigned agbot locations" ON agbot_locations
  FOR SELECT TO authenticated USING (
    id IN (
      SELECT agbot_location_id FROM customer_tank_access
      WHERE customer_account_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      )
    )
  );

-- AGBOT ASSETS - Add policy for customer access
CREATE POLICY "Customers view assigned agbot assets" ON agbot_assets
  FOR SELECT TO authenticated USING (
    location_id IN (
      SELECT agbot_location_id FROM customer_tank_access
      WHERE customer_account_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      )
    )
  );

-- AGBOT READINGS HISTORY - Add policy for customer access
CREATE POLICY "Customers view assigned tank readings" ON agbot_readings_history
  FOR SELECT TO authenticated USING (
    asset_id IN (
      SELECT aa.id FROM agbot_assets aa
      WHERE aa.location_id IN (
        SELECT agbot_location_id FROM customer_tank_access
        WHERE customer_account_id IN (
          SELECT id FROM customer_accounts WHERE user_id = auth.uid()
        )
      )
    )
  );

-- DELIVERY REQUESTS POLICIES

-- Customers can view their own delivery requests
CREATE POLICY "Customers view own delivery requests" ON delivery_requests
  FOR SELECT TO authenticated USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

-- Customers can create delivery requests for their assigned tanks
CREATE POLICY "Customers create delivery requests" ON delivery_requests
  FOR INSERT TO authenticated WITH CHECK (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
    AND agbot_location_id IN (
      SELECT agbot_location_id FROM customer_tank_access
      WHERE customer_account_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      )
      AND access_level IN ('request_delivery', 'admin')
    )
  );

-- GSF staff can view all delivery requests
CREATE POLICY "GSF staff view all delivery requests" ON delivery_requests
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- GSF staff can manage delivery requests
CREATE POLICY "GSF staff manage delivery requests" ON delivery_requests
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- DELIVERY REQUEST NOTIFICATIONS POLICIES

-- Users can view notifications for their own requests
CREATE POLICY "Users view own request notifications" ON delivery_request_notifications
  FOR SELECT TO authenticated USING (
    delivery_request_id IN (
      SELECT id FROM delivery_requests
      WHERE customer_account_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- System can insert notifications
CREATE POLICY "System can insert notifications" ON delivery_request_notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

-- Trigger for customer_accounts
CREATE OR REPLACE FUNCTION update_customer_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_accounts_updated_at
  BEFORE UPDATE ON customer_accounts
  FOR EACH ROW EXECUTE FUNCTION update_customer_accounts_updated_at();

-- Trigger for delivery_requests
CREATE OR REPLACE FUNCTION update_delivery_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delivery_requests_updated_at
  BEFORE UPDATE ON delivery_requests
  FOR EACH ROW EXECUTE FUNCTION update_delivery_requests_updated_at();

-- =============================================
-- HELPER VIEWS
-- =============================================

-- View: Customer accounts with tank count
CREATE OR REPLACE VIEW customer_accounts_with_tank_count AS
SELECT
  ca.*,
  COUNT(cta.agbot_location_id) as assigned_tank_count,
  MAX(ca.last_login_at) as last_activity
FROM customer_accounts ca
LEFT JOIN customer_tank_access cta ON ca.id = cta.customer_account_id
GROUP BY ca.id;

-- View: Delivery requests with customer and tank details
CREATE OR REPLACE VIEW delivery_requests_detailed AS
SELECT
  dr.*,
  ca.customer_name,
  ca.contact_name as customer_contact_name,
  al.location_id as tank_location_id,
  al.address1 as tank_address,
  al.latest_calibrated_fill_percentage as current_tank_level,
  aa.asset_days_remaining,
  aa.asset_daily_consumption
FROM delivery_requests dr
JOIN customer_accounts ca ON dr.customer_account_id = ca.id
JOIN agbot_locations al ON dr.agbot_location_id = al.id
LEFT JOIN agbot_assets aa ON aa.location_id = al.id;

-- Grant access to views
GRANT SELECT ON customer_accounts_with_tank_count TO authenticated;
GRANT SELECT ON delivery_requests_detailed TO authenticated;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE customer_accounts IS 'Customer portal accounts - links Supabase Auth users to customer data for self-service portal access';
COMMENT ON TABLE customer_tank_access IS 'Many-to-many table controlling which tanks a customer can view in their portal';
COMMENT ON TABLE delivery_requests IS 'Customer fuel delivery requests with GSF workflow tracking';
COMMENT ON TABLE delivery_request_notifications IS 'Email notification log for delivery request status updates';

-- =============================================
-- COMPLETION
-- =============================================

SELECT 'Customer portal system created successfully' as result;
