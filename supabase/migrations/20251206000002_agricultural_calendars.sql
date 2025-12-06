-- Agricultural operations calendar by region
CREATE TABLE agricultural_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Region
  region text NOT NULL, -- 'Eastern Wheatbelt', 'Geraldton', 'Northern Agricultural', etc
  wa_region_code text, -- Official WA region codes

  -- Crop and operation
  crop_type text, -- 'wheat', 'barley', 'canola', 'lupin', 'chickpea', 'livestock'
  operation text NOT NULL, -- 'seeding', 'harvest', 'spraying', 'fertilizing'

  -- Timing windows (month numbers 1-12)
  typical_start_month int CHECK (typical_start_month BETWEEN 1 AND 12),
  typical_end_month int CHECK (typical_end_month BETWEEN 1 AND 12),
  peak_month int CHECK (peak_month BETWEEN 1 AND 12),

  -- Weather dependencies
  soil_moisture_min_mm float, -- Minimum soil moisture for operation
  soil_moisture_max_mm float,
  temperature_min_c float,
  temperature_max_c float,
  wind_speed_max_kmh float, -- Critical for spraying
  rainfall_trigger_mm float, -- Rainfall that triggers operation (e.g., seeding after rain)

  -- Fuel impact
  fuel_usage_multiplier float DEFAULT 1.0, -- Multiplier for baseline consumption
  typical_daily_consumption_l float, -- Typical L/day during this operation

  -- Metadata
  created_at timestamptz DEFAULT now(),
  notes text
);

-- Indexes
CREATE INDEX idx_ag_calendar_region ON agricultural_calendars(region);
CREATE INDEX idx_ag_calendar_operation ON agricultural_calendars(operation);
CREATE INDEX idx_ag_calendar_crop ON agricultural_calendars(crop_type);

-- Seed with WA agricultural knowledge
INSERT INTO agricultural_calendars (region, crop_type, operation, typical_start_month, typical_end_month, peak_month, soil_moisture_min_mm, temperature_min_c, temperature_max_c, wind_speed_max_kmh, fuel_usage_multiplier, typical_daily_consumption_l, notes) VALUES
  -- Wheatbelt - Wheat
  ('Eastern Wheatbelt', 'wheat', 'seeding', 4, 6, 5, 20, 8, 25, 30, 1.8, 300, 'Seeding window opens after autumn break (first 20mm+ rain)'),
  ('Eastern Wheatbelt', 'wheat', 'harvest', 10, 12, 11, NULL, 15, 35, NULL, 2.5, 800, 'Harvest Oct-Dec, headers run continuously'),
  ('Eastern Wheatbelt', 'wheat', 'spraying', 5, 9, 7, NULL, 10, 28, 15, 1.3, 120, 'Herbicide/fungicide application, wind-dependent'),

  -- Wheatbelt - Canola
  ('Eastern Wheatbelt', 'canola', 'seeding', 4, 6, 5, 25, 10, 22, 30, 1.8, 300, 'Canola needs adequate soil moisture'),
  ('Eastern Wheatbelt', 'canola', 'harvest', 11, 12, 11, NULL, 15, 30, NULL, 2.3, 750, 'Canola harvest later than wheat'),

  -- Geraldton Region
  ('Geraldton', 'wheat', 'seeding', 5, 6, 5, 15, 12, 28, 25, 1.6, 280, 'Northern ag region, earlier and shorter season'),
  ('Geraldton', 'wheat', 'harvest', 10, 11, 10, NULL, 18, 35, NULL, 2.4, 750, 'Harvest starts earlier than southern regions'),

  -- Livestock operations (year-round but seasonal peaks)
  ('All Regions', 'livestock', 'feeding', 1, 12, 1, NULL, NULL, NULL, NULL, 1.2, 150, 'Fuel for feed distribution, peaks in dry summer'),
  ('All Regions', 'livestock', 'mustering', 1, 12, 3, NULL, NULL, NULL, NULL, 1.5, 200, 'Mustering peaks autumn/spring');

COMMENT ON TABLE agricultural_calendars IS 'Agricultural operations calendar with weather dependencies and fuel impact';
