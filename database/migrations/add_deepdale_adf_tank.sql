-- Migration: Add Deepdale ADF Tank
-- Created: 2025-12-03
-- Description: Adds a new 110,000L ADF tank to the Deepdale subgroup in Geraldton

INSERT INTO ta_tanks (
  name,
  business_id,
  group_id,
  subgroup_id,
  location_id,
  product_id,
  capacity_liters,
  safe_level_liters,
  min_level_liters,
  status,
  created_at,
  updated_at
) VALUES (
  'Deepdale ADF',
  '1bc7929d-9a3f-4074-9031-2dc950b187a6', -- Great Southern Fuel Supplies
  'e8ac6e24-a001-454e-9e28-e42cc81c9167', -- Geraldton group
  '2b8704ff-006c-4bcb-bf13-302b9ae8dd51', -- Deepdale subgroup
  'c469bd81-d874-45d3-bc01-b51af18594e2', -- Legacy / Unassigned location
  '8b2d80bb-b4e1-471b-9545-ca213e6224e7', -- ADF product
  110000,
  110000,
  20000,
  'active',
  NOW(),
  NOW()
);
