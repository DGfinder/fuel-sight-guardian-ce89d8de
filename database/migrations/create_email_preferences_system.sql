-- Email Preferences and Unsubscribe System
-- Manages customer email preferences, unsubscribe tokens, and delivery tracking

-- Drop existing table if exists (for clean re-run)
DROP TABLE IF EXISTS customer_email_preferences CASCADE;

-- Create email preferences table
CREATE TABLE customer_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_contact_id UUID NOT NULL REFERENCES customer_contacts(id) ON DELETE CASCADE,

  -- Unsubscribe token (secure, URL-safe)
  unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,

  -- Preference settings
  enabled BOOLEAN NOT NULL DEFAULT true,
  report_frequency VARCHAR(20) DEFAULT 'daily' CHECK (report_frequency IN ('daily', 'weekly', 'monthly', 'disabled')),

  -- Tank filtering (NULL = all tanks, array = specific tank IDs)
  selected_tanks JSONB DEFAULT NULL,

  -- Delivery preferences
  include_low_fuel_only BOOLEAN DEFAULT false,
  include_critical_only BOOLEAN DEFAULT false,

  -- Tracking
  unsubscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  last_preference_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  user_agent TEXT,
  ip_address INET,

  CONSTRAINT unique_contact_preference UNIQUE (customer_contact_id)
);

-- Add indexes for performance
CREATE INDEX idx_email_preferences_token ON customer_email_preferences(unsubscribe_token);
CREATE INDEX idx_email_preferences_contact ON customer_email_preferences(customer_contact_id);
CREATE INDEX idx_email_preferences_enabled ON customer_email_preferences(enabled);

-- Add unsubscribe_token column to existing customer_contacts table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_contacts'
    AND column_name = 'unsubscribe_token'
  ) THEN
    ALTER TABLE customer_contacts
    ADD COLUMN unsubscribe_token VARCHAR(64) UNIQUE;

    -- Generate tokens for existing contacts
    UPDATE customer_contacts
    SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
    WHERE unsubscribe_token IS NULL;

    -- Make it NOT NULL after population
    ALTER TABLE customer_contacts
    ALTER COLUMN unsubscribe_token SET NOT NULL;

    CREATE INDEX idx_customer_contacts_token ON customer_contacts(unsubscribe_token);
  END IF;
END $$;

-- Enhance customer_email_logs table for delivery tracking
DO $$
BEGIN
  -- Add bounce tracking columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_email_logs'
    AND column_name = 'bounce_type'
  ) THEN
    ALTER TABLE customer_email_logs
    ADD COLUMN bounce_type VARCHAR(20) CHECK (bounce_type IN ('hard', 'soft', 'complaint', NULL)),
    ADD COLUMN bounce_reason TEXT,
    ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN opened_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN clicked_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add index for bounce tracking
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_email_logs_bounce_type'
  ) THEN
    CREATE INDEX idx_email_logs_bounce_type ON customer_email_logs(bounce_type)
    WHERE bounce_type IS NOT NULL;
  END IF;
END $$;

-- Function to generate secure unsubscribe token
CREATE OR REPLACE FUNCTION generate_unsubscribe_token()
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to handle unsubscribe
CREATE OR REPLACE FUNCTION unsubscribe_contact(token VARCHAR(64))
RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
  result JSONB;
BEGIN
  -- Find contact by token
  SELECT id, contact_email, customer_name, enabled
  INTO contact_record
  FROM customer_contacts
  WHERE unsubscribe_token = token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid unsubscribe token');
  END IF;

  -- Update contact
  UPDATE customer_contacts
  SET
    enabled = false,
    updated_at = NOW()
  WHERE id = contact_record.id;

  -- Create/update preference record
  INSERT INTO customer_email_preferences (
    customer_contact_id,
    unsubscribe_token,
    enabled,
    report_frequency,
    unsubscribed_at
  ) VALUES (
    contact_record.id,
    token,
    false,
    'disabled',
    NOW()
  )
  ON CONFLICT (customer_contact_id)
  DO UPDATE SET
    enabled = false,
    report_frequency = 'disabled',
    unsubscribed_at = NOW(),
    last_preference_update = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully unsubscribed',
    'email', contact_record.contact_email,
    'customer', contact_record.customer_name
  );
END;
$$ LANGUAGE plpgsql;

-- Function to update email preferences
CREATE OR REPLACE FUNCTION update_email_preferences(
  token VARCHAR(64),
  new_frequency VARCHAR(20) DEFAULT NULL,
  new_enabled BOOLEAN DEFAULT NULL,
  selected_tank_ids JSONB DEFAULT NULL,
  low_fuel_only BOOLEAN DEFAULT NULL,
  critical_only BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
BEGIN
  -- Find contact by token
  SELECT id, contact_email, customer_name
  INTO contact_record
  FROM customer_contacts
  WHERE unsubscribe_token = token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid token');
  END IF;

  -- Update customer_contacts if enabled status changed
  IF new_enabled IS NOT NULL THEN
    UPDATE customer_contacts
    SET
      enabled = new_enabled,
      report_frequency = COALESCE(new_frequency, report_frequency),
      updated_at = NOW()
    WHERE id = contact_record.id;
  END IF;

  -- Create or update preferences
  INSERT INTO customer_email_preferences (
    customer_contact_id,
    unsubscribe_token,
    enabled,
    report_frequency,
    selected_tanks,
    include_low_fuel_only,
    include_critical_only,
    last_preference_update
  ) VALUES (
    contact_record.id,
    token,
    COALESCE(new_enabled, true),
    COALESCE(new_frequency, 'daily'),
    selected_tank_ids,
    COALESCE(low_fuel_only, false),
    COALESCE(critical_only, false),
    NOW()
  )
  ON CONFLICT (customer_contact_id)
  DO UPDATE SET
    enabled = COALESCE(new_enabled, customer_email_preferences.enabled),
    report_frequency = COALESCE(new_frequency, customer_email_preferences.report_frequency),
    selected_tanks = COALESCE(selected_tank_ids, customer_email_preferences.selected_tanks),
    include_low_fuel_only = COALESCE(low_fuel_only, customer_email_preferences.include_low_fuel_only),
    include_critical_only = COALESCE(critical_only, customer_email_preferences.include_critical_only),
    last_preference_update = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Preferences updated successfully',
    'email', contact_record.contact_email
  );
END;
$$ LANGUAGE plpgsql;

-- Function to track email bounces
CREATE OR REPLACE FUNCTION record_email_bounce(
  email_id VARCHAR(255),
  bounce_type VARCHAR(20),
  bounce_reason TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE customer_email_logs
  SET
    delivery_status = 'bounced',
    bounce_type = bounce_type,
    bounce_reason = bounce_reason
  WHERE external_email_id = email_id;

  -- Auto-disable contacts after 3 hard bounces
  IF bounce_type = 'hard' THEN
    UPDATE customer_contacts
    SET enabled = false
    WHERE id IN (
      SELECT customer_contact_id
      FROM customer_email_logs
      WHERE bounce_type = 'hard'
      GROUP BY customer_contact_id
      HAVING COUNT(*) >= 3
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get contact preferences by token
CREATE OR REPLACE FUNCTION get_contact_preferences(token VARCHAR(64))
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'success', true,
    'contact', jsonb_build_object(
      'email', cc.contact_email,
      'name', cc.contact_name,
      'customer', cc.customer_name,
      'enabled', cc.enabled,
      'frequency', cc.report_frequency
    ),
    'preferences', jsonb_build_object(
      'enabled', COALESCE(cep.enabled, cc.enabled),
      'frequency', COALESCE(cep.report_frequency, cc.report_frequency),
      'selected_tanks', cep.selected_tanks,
      'low_fuel_only', COALESCE(cep.include_low_fuel_only, false),
      'critical_only', COALESCE(cep.include_critical_only, false),
      'unsubscribed_at', cep.unsubscribed_at,
      'last_updated', cep.last_preference_update
    )
  ) INTO result
  FROM customer_contacts cc
  LEFT JOIN customer_email_preferences cep ON cep.customer_contact_id = cc.id
  WHERE cc.unsubscribe_token = token;

  IF result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid token');
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your RLS setup)
GRANT SELECT, INSERT, UPDATE ON customer_email_preferences TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_unsubscribe_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unsubscribe_contact(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_email_preferences(VARCHAR, VARCHAR, BOOLEAN, JSONB, BOOLEAN, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_email_bounce(VARCHAR, VARCHAR, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_contact_preferences(VARCHAR) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE customer_email_preferences IS 'Stores email preferences and unsubscribe tokens for customer contacts';
COMMENT ON COLUMN customer_email_preferences.unsubscribe_token IS 'Secure token for one-click unsubscribe and preference management';
COMMENT ON COLUMN customer_email_preferences.selected_tanks IS 'JSON array of tank IDs to include in reports. NULL = all tanks';
COMMENT ON FUNCTION unsubscribe_contact IS 'Unsubscribe a contact using their unique token';
COMMENT ON FUNCTION update_email_preferences IS 'Update email preferences for a contact using their token';
COMMENT ON FUNCTION record_email_bounce IS 'Record an email bounce and auto-disable contacts with multiple hard bounces';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Email preferences system created successfully';
  RAISE NOTICE 'Tables: customer_email_preferences';
  RAISE NOTICE 'Functions: generate_unsubscribe_token, unsubscribe_contact, update_email_preferences, record_email_bounce, get_contact_preferences';
END $$;
