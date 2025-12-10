/**
 * Add performance indexes for slow queries identified in Supabase query stats
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://postgres.wjzsdsvbtapriiuxzmih:Theskyisblue98%21@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

const indexes = [
  // tank_alerts - the slowest query (2.2s avg)
  {
    name: 'idx_tank_alerts_acknowledged_null',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tank_alerts_acknowledged_null
          ON tank_alerts (created_at DESC)
          WHERE acknowledged_at IS NULL;`,
    description: 'Partial index for unacknowledged alerts (most common query)'
  },
  {
    name: 'idx_tank_alerts_tank_id',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tank_alerts_tank_id
          ON tank_alerts (tank_id);`,
    description: 'Index for JOIN to fuel_tanks'
  },
  {
    name: 'idx_tank_alerts_snoozed',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tank_alerts_snoozed
          ON tank_alerts (snoozed_until)
          WHERE acknowledged_at IS NULL;`,
    description: 'Index for snoozed alerts filter'
  },
  // fuel_tanks - for the JOIN
  {
    name: 'idx_fuel_tanks_group_id',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fuel_tanks_group_id
          ON fuel_tanks (group_id);`,
    description: 'Index for JOIN to tank_groups'
  },
  {
    name: 'idx_fuel_tanks_status',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fuel_tanks_status
          ON fuel_tanks (status, location);`,
    description: 'Index for status filter with location sort'
  },
  // ta_tank_dips - also showing in slow queries
  {
    name: 'idx_ta_tank_dips_tank_created',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ta_tank_dips_tank_created
          ON ta_tank_dips (tank_id, created_at DESC)
          WHERE archived_at IS NULL;`,
    description: 'Composite index for tank dips queries'
  },
  // ta_agbot_readings - for consumption calculations
  {
    name: 'idx_ta_agbot_readings_asset_reading',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ta_agbot_readings_asset_reading
          ON ta_agbot_readings (asset_id, reading_at DESC);`,
    description: 'Composite index for readings by asset'
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('Adding Performance Indexes');
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

    for (const index of indexes) {
      console.log(`Creating ${index.name}...`);
      console.log(`  ${index.description}`);
      try {
        // CONCURRENTLY doesn't work in transaction, so we run each separately
        await client.query(index.sql);
        console.log(`  ✅ Created\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️ Already exists\n`);
        } else {
          console.log(`  ❌ Failed: ${error.message}\n`);
        }
      }
    }

    // Analyze tables to update statistics
    console.log('Analyzing tables to update statistics...');
    const tables = ['tank_alerts', 'fuel_tanks', 'tank_groups', 'ta_tank_dips', 'ta_agbot_readings'];
    for (const table of tables) {
      try {
        await client.query(`ANALYZE ${table};`);
        console.log(`  ✅ Analyzed ${table}`);
      } catch (error) {
        console.log(`  ⚠️ Could not analyze ${table}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Performance indexes added!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
