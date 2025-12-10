/**
 * Apply decimal precision migration to SmartFill tables
 * Uses pg package to connect directly to Supabase Postgres
 */

import pg from 'pg';
const { Client } = pg;

// Database connection - using session mode pooler (port 5432) for DDL operations
// Note: ! is URL encoded as %21
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.wjzsdsvbtapriiuxzmih:Theskyisblue98%21@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function main() {
  console.log('='.repeat(60));
  console.log('SmartFill Decimal Precision Migration');
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

    // Step 1: Find all views that depend on SmartFill tables
    console.log('Finding dependent views...');
    const { rows: dependentViews } = await client.query(`
      SELECT DISTINCT v.table_name as view_name
      FROM information_schema.view_column_usage v
      WHERE v.table_name IN (
        SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
      )
      AND v.column_name IN ('capacity', 'current_volume', 'safe_fill_level', 'volume', 'ullage',
                            'current_value', 'threshold_value', 'previous_value', 'volume_change',
                            'min_level', 'reorder_level', 'current_ullage', 'total_capacity', 'total_volume')
      ORDER BY v.table_name;
    `);

    // Also get views directly from system catalog
    const { rows: allViews } = await client.query(`
      SELECT viewname FROM pg_views WHERE schemaname = 'public';
    `);
    console.log('All views in database:', allViews.map(v => v.viewname).join(', '));

    // Step 2: Drop all views that might depend on these columns
    // Drop in reverse dependency order - most dependent first
    const viewsToDrop = [
      'customer_tanks_unified',
      'ta_tank_full_status',
      'ta_tank_dashboard',
      'ta_customer_tank_summary',
      'smartfill_tank_summary',
      'smartfill_customer_summary',
      'smartfill_current_status',
      'smartfill_system_health',
      'smartfill_active_customers',
      'ta_smartfill_customer_summary',
      'ta_smartfill_tank_trends',
      'ta_smartfill_sync_analytics',
      'ta_smartfill_active_alerts',
      'ta_smartfill_fleet_overview',
      'ta_smartfill_consumption_daily'
    ];

    console.log('\nDropping dependent views...');
    for (const view of viewsToDrop) {
      try {
        await client.query(`DROP VIEW IF EXISTS ${view} CASCADE;`);
        console.log(`✅ Dropped view: ${view}`);
      } catch (error) {
        console.log(`⚠️ Could not drop ${view}: ${error.message}`);
      }
    }

    // Step 3: Alter the tables
    console.log('\nAltering table columns to DECIMAL(15,2)...');

    const alterStatements = [
      {
        name: 'ta_smartfill_locations',
        sql: `ALTER TABLE ta_smartfill_locations
              ALTER COLUMN total_capacity TYPE DECIMAL(15,2),
              ALTER COLUMN total_volume TYPE DECIMAL(15,2);`
      },
      {
        name: 'ta_smartfill_tanks',
        sql: `ALTER TABLE ta_smartfill_tanks
              ALTER COLUMN capacity TYPE DECIMAL(15,2),
              ALTER COLUMN safe_fill_level TYPE DECIMAL(15,2),
              ALTER COLUMN min_level TYPE DECIMAL(15,2),
              ALTER COLUMN reorder_level TYPE DECIMAL(15,2),
              ALTER COLUMN current_volume TYPE DECIMAL(15,2),
              ALTER COLUMN current_ullage TYPE DECIMAL(15,2);`
      },
      {
        name: 'ta_smartfill_readings',
        sql: `ALTER TABLE ta_smartfill_readings
              ALTER COLUMN volume TYPE DECIMAL(15,2),
              ALTER COLUMN capacity TYPE DECIMAL(15,2),
              ALTER COLUMN safe_fill_level TYPE DECIMAL(15,2),
              ALTER COLUMN ullage TYPE DECIMAL(15,2),
              ALTER COLUMN volume_change TYPE DECIMAL(15,2);`
      },
      {
        name: 'ta_smartfill_alerts',
        sql: `ALTER TABLE ta_smartfill_alerts
              ALTER COLUMN current_value TYPE DECIMAL(15,2),
              ALTER COLUMN threshold_value TYPE DECIMAL(15,2),
              ALTER COLUMN previous_value TYPE DECIMAL(15,2);`
      }
    ];

    for (const stmt of alterStatements) {
      try {
        await client.query(stmt.sql);
        console.log(`✅ Altered ${stmt.name}`);
      } catch (error) {
        console.log(`❌ Failed to alter ${stmt.name}: ${error.message}`);
      }
    }

    // Step 4: Recreate the customer_tanks_unified view
    console.log('\nRecreating customer_tanks_unified view...');
    await client.query(`
      CREATE OR REPLACE VIEW customer_tanks_unified AS
      SELECT
        cta.id as access_id,
        cta.customer_account_id,
        cta.access_level,
        cta.tank_type,
        cta.assigned_at,
        cta.notes as access_notes,
        COALESCE(cta.tank_id, ts.ta_tank_id) as tank_id,
        COALESCE(t.name, al.name, sf.name, sf.unit_number) as tank_name,
        COALESCE(
          cta.tank_type,
          CASE
            WHEN cta.agbot_location_id IS NOT NULL THEN 'agbot'
            WHEN cta.smartfill_tank_id IS NOT NULL THEN 'smartfill'
            WHEN cta.tank_id IS NOT NULL THEN 'dip'
            ELSE 'unknown'
          END
        ) as source_type,
        COALESCE(loc.name, al.name) as location_name,
        COALESCE(loc.address, al.address) as address,
        COALESCE(loc.latitude, al.latitude) as latitude,
        COALESCE(loc.longitude, al.longitude) as longitude,
        COALESCE(t.capacity_liters, aa.capacity_liters, sf.capacity) as capacity_liters,
        COALESCE(t.safe_level_liters, aa.capacity_liters, sf.safe_fill_level) as safe_level_liters,
        COALESCE(
          aa.current_level_liters,
          sf.current_volume,
          t.current_level_liters
        ) as current_level_liters,
        COALESCE(
          aa.current_level_percent,
          sf.current_volume_percent,
          CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END
        ) as current_level_percent,
        COALESCE(
          aa.last_telemetry_at,
          sf.last_reading_at,
          t.current_level_datetime
        ) as last_reading_at,
        aa.daily_consumption_liters,
        aa.days_remaining,
        aa.is_online as device_online,
        aa.battery_voltage,
        aa.temperature_c,
        COALESCE(p.name, aa.commodity) as product_type,
        COALESCE(al.customer_name, sfc.name) as customer_name,
        cta.agbot_location_id,
        cta.smartfill_tank_id,
        aa.id as agbot_asset_id,
        CASE
          WHEN COALESCE(
            aa.current_level_percent,
            sf.current_volume_percent,
            CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
            100
          ) <= 10 THEN 'critical'
          WHEN COALESCE(
            aa.current_level_percent,
            sf.current_volume_percent,
            CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
            100
          ) <= 20 THEN 'urgent'
          WHEN COALESCE(aa.days_remaining, 999) <= 3 THEN 'urgent'
          WHEN COALESCE(
            aa.current_level_percent,
            sf.current_volume_percent,
            CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
            100
          ) <= 30 THEN 'warning'
          WHEN COALESCE(aa.days_remaining, 999) <= 7 THEN 'warning'
          WHEN COALESCE(
            aa.current_level_liters,
            sf.current_volume,
            t.current_level_liters,
            0
          ) <= COALESCE(t.safe_level_liters, aa.capacity_liters, sf.safe_fill_level, 0) THEN 'warning'
          ELSE 'ok'
        END as urgency_status,
        CASE
          WHEN COALESCE(
            aa.current_level_percent,
            sf.current_volume_percent,
            CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
            100
          ) <= 10 THEN 1
          WHEN COALESCE(
            aa.current_level_percent,
            sf.current_volume_percent,
            CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
            100
          ) <= 20 THEN 2
          WHEN COALESCE(aa.days_remaining, 999) <= 3 THEN 2
          WHEN COALESCE(
            aa.current_level_percent,
            sf.current_volume_percent,
            CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
            100
          ) <= 30 THEN 3
          WHEN COALESCE(aa.days_remaining, 999) <= 7 THEN 3
          ELSE 4
        END as priority_score
      FROM customer_tank_access cta
      LEFT JOIN ta_tanks t ON cta.tank_id = t.id
      LEFT JOIN ta_locations loc ON t.location_id = loc.id
      LEFT JOIN ta_products p ON t.product_id = p.id
      LEFT JOIN ta_tank_sources ts ON ts.ta_tank_id = t.id AND ts.is_active = true
      LEFT JOIN ta_agbot_locations al ON cta.agbot_location_id = al.id
      LEFT JOIN ta_agbot_assets aa ON aa.location_id = al.id
      LEFT JOIN ta_smartfill_tanks sf ON cta.smartfill_tank_id = sf.id
      LEFT JOIN ta_smartfill_customers sfc ON sf.customer_id = sfc.id;
    `);
    console.log('✅ View recreated');

    // Step 5: Grant permissions
    await client.query('GRANT SELECT ON customer_tanks_unified TO authenticated;');
    console.log('✅ Permissions granted');

    // Verify the changes
    console.log('\nVerifying column types...');
    const { rows: columns } = await client.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'ta_smartfill_tanks'
      AND column_name IN ('capacity', 'current_volume')
      ORDER BY column_name;
    `);
    console.log('Column types after migration:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}(${col.numeric_precision},${col.numeric_scale})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
