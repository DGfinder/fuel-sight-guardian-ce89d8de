-- Migration: Create Customer Contacts System for Email Reports
-- This creates tables for managing customer contact information
-- and email report preferences for AgBot monitoring notifications

-- Customer Contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_guid TEXT,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_position TEXT,
  report_frequency TEXT DEFAULT 'daily' CHECK (report_frequency IN ('daily', 'weekly', 'monthly')),
  report_format TEXT DEFAULT 'summary' CHECK (report_format IN ('summary', 'detailed')),
  enabled BOOLEAN DEFAULT true,
  last_email_sent_at TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email delivery log table for tracking sent emails
CREATE TABLE IF NOT EXISTS customer_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_contact_id UUID REFERENCES customer_contacts(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'daily_report', 'weekly_summary', 'alert', etc.
  email_subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'failed')),
  external_email_id TEXT, -- Resend email ID for tracking
  error_message TEXT,
  locations_count INT DEFAULT 0,
  low_fuel_alerts INT DEFAULT 0,
  critical_alerts INT DEFAULT 0,
  email_metadata JSONB -- Store additional metadata (open rate, click rate, etc.)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_name ON customer_contacts(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_enabled ON customer_contacts(enabled);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email ON customer_contacts(contact_email);
CREATE INDEX IF NOT EXISTS idx_customer_email_logs_contact_id ON customer_email_logs(customer_contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_email_logs_sent_at ON customer_email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_email_logs_customer_name ON customer_email_logs(customer_name);

-- RLS Policies
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_email_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins and managers to view and manage customer contacts
CREATE POLICY "Admins can view customer contacts" ON customer_contacts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can manage customer contacts" ON customer_contacts
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

-- Email logs can be viewed by admins
CREATE POLICY "Admins can view email logs" ON customer_email_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- System can insert email logs (for cron jobs)
CREATE POLICY "System can insert email logs" ON customer_email_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW EXECUTE FUNCTION update_customer_contacts_updated_at();

-- Seed initial customer contacts (example - replace with real data)
INSERT INTO customer_contacts (customer_name, customer_guid, contact_email, contact_name, enabled)
VALUES
  ('Great Southern Fuel Supplies', 'customer-great-southern-fuel-supplies', 'admin@greatsouthernfuel.com.au', 'Fleet Manager', true),
  ('Indosolutions', 'customer-indosolutions', 'contact@indosolutions.com.au', 'Operations Manager', true)
ON CONFLICT DO NOTHING;

SELECT 'Customer contacts system created successfully' as result;
