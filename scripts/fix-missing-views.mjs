/**
 * Fix missing views after decimal migration
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://postgres.wjzsdsvbtapriiuxzmih:Theskyisblue98%21@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

const views = [
  {
    name: 'ta_tank_dashboard',
    sql: `
DROP VIEW IF EXISTS ta_tank_full_status CASCADE;
DROP VIEW IF EXISTS ta_tank_dashboard CASCADE;

CREATE VIEW ta_tank_dashboard AS
SELECT
    t.id,
    t.name,
    t.business_id,
    b.name as business_name,
    b.code as business_code,
    t.group_id,
    g.name as group_name,
    t.subgroup_id,
    s.name as subgroup_name,
    t.product_id,
    t.capacity_liters,
    t.current_level_liters,
    t.current_level_datetime,
    t.current_level_source,
    t.fill_percent,
    t.safe_level_liters,
    t.min_level_liters,
    t.critical_level_liters,
    t.rolling_avg_liters_per_day,
    t.days_to_min_level,
    t.unit,
    t.installation_type,
    t.has_sensor,
    t.status,
    t.notes,
    t.created_at,
    t.updated_at
FROM ta_tanks t
LEFT JOIN ta_businesses b ON t.business_id = b.id
LEFT JOIN ta_groups g ON t.group_id = g.id
LEFT JOIN ta_subgroups s ON t.subgroup_id = s.id
WHERE t.archived_at IS NULL;
`
  },
  {
    name: 'ta_tank_full_status',
    sql: `
CREATE VIEW ta_tank_full_status AS
SELECT
    d.*,
    p.name as product_name,
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
    COALESCE(a.readings_in_period, 0) as readings_in_period,
    a.calculated_at as analytics_updated_at,
    CASE
        WHEN d.fill_percent <= 10 THEN 'critical'
        WHEN d.fill_percent <= 20 THEN 'urgent'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 'urgent'
        WHEN d.fill_percent <= 30 THEN 'warning'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 'warning'
        WHEN d.current_level_liters <= d.min_level_liters THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    CASE
        WHEN d.fill_percent <= 10 THEN 1
        WHEN d.fill_percent <= 20 THEN 2
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 2
        WHEN d.fill_percent <= 30 THEN 3
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 3
        ELSE 4
    END as priority_score
FROM ta_tank_dashboard d
LEFT JOIN ta_products p ON d.product_id = p.id
LEFT JOIN ta_tank_analytics a ON d.id = a.tank_id;
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
  COALESCE(SUM(t.capacity), 0) as total_capacity,
  COALESCE(SUM(t.current_volume), 0) as total_volume,
  COALESCE(AVG(t.current_volume_percent), 0) as avg_fill_percent,
  COUNT(CASE WHEN t.current_volume_percent <= 20 THEN 1 END) as critical_tanks,
  COUNT(CASE WHEN t.current_volume_percent > 20 AND t.current_volume_percent <= 40 THEN 1 END) as warning_tanks,
  COUNT(CASE WHEN t.current_volume_percent > 40 THEN 1 END) as healthy_tanks,
  MAX(t.last_reading_at) as latest_reading
FROM ta_smartfill_customers c
LEFT JOIN ta_smartfill_locations l ON l.customer_id = c.id
LEFT JOIN ta_smartfill_tanks t ON t.customer_id = c.id
GROUP BY c.id, c.name, c.is_active, c.last_sync_at, c.last_sync_status;
`
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('Fixing Missing Views');
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

        // Grant permissions
        await client.query(`GRANT SELECT ON ${view.name} TO authenticated;`);
        await client.query(`GRANT SELECT ON ${view.name} TO anon;`);
      } catch (error) {
        console.log(`❌ ${view.name} failed: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Views fixed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
