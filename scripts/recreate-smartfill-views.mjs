/**
 * Recreate SmartFill views that were dropped during migration
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://postgres.wjzsdsvbtapriiuxzmih:Theskyisblue98%21@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

const views = [
  {
    name: 'ta_smartfill_consumption_daily',
    sql: `
CREATE OR REPLACE VIEW ta_smartfill_consumption_daily AS
SELECT
  r.tank_id,
  t.customer_id,
  c.name as customer_name,
  t.unit_number,
  t.tank_number,
  t.capacity,
  DATE(r.reading_at AT TIME ZONE COALESCE(r.timezone, 'Australia/Perth')) as reading_date,
  COUNT(*) as reading_count,
  MAX(r.volume) as max_volume,
  MIN(r.volume) as min_volume,
  GREATEST(0, MAX(r.volume) - MIN(r.volume)) as daily_consumption,
  AVG(r.volume_percent) as avg_fill_percent,
  MAX(r.volume_percent) as max_fill_percent,
  MIN(r.volume_percent) as min_fill_percent,
  BOOL_OR(r.is_refill) as had_refill
FROM ta_smartfill_readings r
JOIN ta_smartfill_tanks t ON r.tank_id = t.id
JOIN ta_smartfill_customers c ON t.customer_id = c.id
GROUP BY
  r.tank_id,
  t.customer_id,
  c.name,
  t.unit_number,
  t.tank_number,
  t.capacity,
  DATE(r.reading_at AT TIME ZONE COALESCE(r.timezone, 'Australia/Perth'));
`
  },
  {
    name: 'ta_smartfill_fleet_overview',
    sql: `
CREATE OR REPLACE VIEW ta_smartfill_fleet_overview AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.is_active,
  c.last_sync_at,
  c.last_sync_status,
  COUNT(DISTINCT l.id) as location_count,
  COUNT(DISTINCT t.id) as tank_count,
  SUM(t.capacity) as total_capacity,
  SUM(t.current_volume) as total_volume,
  AVG(t.current_volume_percent) as avg_fill_percent,
  COUNT(CASE WHEN t.current_volume_percent <= 20 THEN 1 END) as critical_tanks,
  COUNT(CASE WHEN t.current_volume_percent > 20 AND t.current_volume_percent <= 40 THEN 1 END) as warning_tanks,
  COUNT(CASE WHEN t.current_volume_percent > 40 THEN 1 END) as healthy_tanks,
  MAX(t.last_reading_at) as latest_reading
FROM ta_smartfill_customers c
LEFT JOIN ta_smartfill_locations l ON l.customer_id = c.id
LEFT JOIN ta_smartfill_tanks t ON t.customer_id = c.id
GROUP BY c.id, c.name, c.is_active, c.last_sync_at, c.last_sync_status;
`
  },
  {
    name: 'ta_smartfill_active_alerts',
    sql: `
CREATE OR REPLACE VIEW ta_smartfill_active_alerts AS
SELECT
  a.*,
  t.unit_number,
  t.tank_number,
  t.name as tank_name,
  c.name as customer_name
FROM ta_smartfill_alerts a
JOIN ta_smartfill_tanks t ON a.tank_id = t.id
JOIN ta_smartfill_customers c ON a.customer_id = c.id
WHERE a.resolved_at IS NULL
  AND a.is_active = true
ORDER BY
  CASE a.severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'info' THEN 3
    ELSE 4
  END,
  a.created_at DESC;
`
  },
  {
    name: 'ta_smartfill_sync_analytics',
    sql: `
CREATE OR REPLACE VIEW ta_smartfill_sync_analytics AS
SELECT
  DATE(started_at) as sync_date,
  COUNT(*) as sync_count,
  COUNT(CASE WHEN sync_status = 'success' THEN 1 END) as successful_syncs,
  COUNT(CASE WHEN sync_status = 'failed' THEN 1 END) as failed_syncs,
  COUNT(CASE WHEN sync_status = 'partial' THEN 1 END) as partial_syncs,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  SUM(customers_success) as total_customers_synced,
  SUM(tanks_processed) as total_tanks_processed,
  SUM(readings_stored) as total_readings_stored
FROM ta_smartfill_sync_logs
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(started_at)
ORDER BY sync_date DESC;
`
  },
  {
    name: 'ta_smartfill_tank_trends',
    sql: `
CREATE OR REPLACE VIEW ta_smartfill_tank_trends AS
SELECT
  t.id as tank_id,
  t.customer_id,
  c.name as customer_name,
  t.unit_number,
  t.tank_number,
  t.capacity,
  t.current_volume,
  t.current_volume_percent,
  t.health_status,
  AVG(r.volume) FILTER (WHERE r.reading_at >= NOW() - INTERVAL '7 days') as avg_volume_7d,
  AVG(r.volume_percent) FILTER (WHERE r.reading_at >= NOW() - INTERVAL '7 days') as avg_percent_7d,
  MAX(r.volume) FILTER (WHERE r.reading_at >= NOW() - INTERVAL '7 days') -
    MIN(r.volume) FILTER (WHERE r.reading_at >= NOW() - INTERVAL '7 days') as consumption_7d,
  COUNT(r.id) FILTER (WHERE r.reading_at >= NOW() - INTERVAL '7 days') as readings_7d,
  COUNT(r.id) FILTER (WHERE r.is_refill = true AND r.reading_at >= NOW() - INTERVAL '30 days') as refills_30d
FROM ta_smartfill_tanks t
JOIN ta_smartfill_customers c ON t.customer_id = c.id
LEFT JOIN ta_smartfill_readings r ON r.tank_id = t.id
GROUP BY t.id, t.customer_id, c.name, t.unit_number, t.tank_number,
         t.capacity, t.current_volume, t.current_volume_percent, t.health_status;
`
  },
  {
    name: 'ta_smartfill_customer_summary',
    sql: `
CREATE OR REPLACE VIEW ta_smartfill_customer_summary AS
SELECT
  c.id,
  c.name,
  c.api_reference,
  c.is_active,
  c.sync_enabled,
  c.last_sync_at,
  c.last_sync_status,
  c.consecutive_failures,
  COUNT(DISTINCT l.id) as location_count,
  COUNT(DISTINCT t.id) as tank_count,
  SUM(t.capacity) as total_capacity,
  SUM(t.current_volume) as total_volume,
  AVG(t.current_volume_percent) as avg_fill_percent,
  COUNT(CASE WHEN t.health_status = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN t.health_status = 'warning' THEN 1 END) as warning_count,
  COUNT(CASE WHEN t.health_status = 'healthy' THEN 1 END) as healthy_count
FROM ta_smartfill_customers c
LEFT JOIN ta_smartfill_locations l ON l.customer_id = c.id
LEFT JOIN ta_smartfill_tanks t ON t.customer_id = c.id
GROUP BY c.id, c.name, c.api_reference, c.is_active, c.sync_enabled,
         c.last_sync_at, c.last_sync_status, c.consecutive_failures;
`
  },
  {
    name: 'smartfill_current_status',
    sql: `
CREATE OR REPLACE VIEW smartfill_current_status AS
SELECT
  t.id as tank_id,
  t.customer_id,
  c.name as customer_name,
  t.unit_number,
  t.tank_number,
  t.name as tank_name,
  t.capacity,
  t.current_volume,
  t.current_volume_percent,
  t.current_status,
  t.health_status,
  t.last_reading_at,
  l.name as location_name,
  l.latitude,
  l.longitude
FROM ta_smartfill_tanks t
JOIN ta_smartfill_customers c ON t.customer_id = c.id
LEFT JOIN ta_smartfill_locations l ON t.location_id = l.id
WHERE t.is_active = true;
`
  },
  {
    name: 'smartfill_system_health',
    sql: `
CREATE OR REPLACE VIEW smartfill_system_health AS
SELECT
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT c.id) FILTER (WHERE c.is_active = true) as active_customers,
  COUNT(DISTINCT c.id) FILTER (WHERE c.last_sync_status = 'success') as healthy_syncs,
  COUNT(DISTINCT c.id) FILTER (WHERE c.last_sync_status = 'failed') as failed_syncs,
  COUNT(DISTINCT c.id) FILTER (WHERE c.consecutive_failures > 3) as stale_customers,
  COUNT(t.id) as total_tanks,
  COUNT(t.id) FILTER (WHERE t.health_status = 'critical') as critical_tanks,
  COUNT(t.id) FILTER (WHERE t.health_status = 'warning') as warning_tanks,
  COUNT(t.id) FILTER (WHERE t.health_status = 'healthy') as healthy_tanks,
  MAX(c.last_sync_at) as latest_sync,
  AVG(EXTRACT(EPOCH FROM (NOW() - c.last_sync_at))/3600) as avg_hours_since_sync
FROM ta_smartfill_customers c
LEFT JOIN ta_smartfill_tanks t ON t.customer_id = c.id;
`
  },
  {
    name: 'smartfill_active_customers',
    sql: `
CREATE OR REPLACE VIEW smartfill_active_customers AS
SELECT
  c.*,
  COUNT(DISTINCT t.id) as tank_count,
  AVG(t.current_volume_percent) as avg_fill_percent
FROM ta_smartfill_customers c
LEFT JOIN ta_smartfill_tanks t ON t.customer_id = c.id
WHERE c.is_active = true
GROUP BY c.id;
`
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('Recreating SmartFill Views');
  console.log('='.repeat(60));
  console.log('');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    for (const view of views) {
      console.log(`Creating ${view.name}...`);
      try {
        await client.query(view.sql);
        console.log(`✅ ${view.name} created`);
      } catch (error) {
        console.log(`❌ ${view.name} failed: ${error.message}`);
      }
    }

    // Grant permissions
    console.log('\nGranting permissions...');
    for (const view of views) {
      try {
        await client.query(`GRANT SELECT ON ${view.name} TO authenticated;`);
      } catch (e) {}
    }
    console.log('✅ Permissions granted');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Views recreated successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
