-- Add status field to fuel_tanks table for archiving/decommissioning tanks
-- Migration: add_tank_status_field.sql

-- Create enum type for tank status
CREATE TYPE tank_status_enum AS ENUM ('active', 'archived', 'decommissioned');

-- Add status column to fuel_tanks table
ALTER TABLE fuel_tanks 
ADD COLUMN status tank_status_enum DEFAULT 'active' NOT NULL;

-- Create index for efficient filtering
CREATE INDEX idx_fuel_tanks_status ON fuel_tanks(status);

-- Update any existing tanks that should be archived (like Joondalup)
-- This will be handled in a separate migration script

-- Add comment to document the field
COMMENT ON COLUMN fuel_tanks.status IS 'Tank operational status: active=receiving dips, archived=no longer in use but data preserved, decommissioned=permanently removed from service';