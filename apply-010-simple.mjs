import pg from 'pg';
import { readFileSync } from 'fs';
import 'dotenv/config';

const { Client } = pg;

// Parse Supabase connection string
const supabaseUrl = process.env.SUPABASE_URL;
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!password) {
  console.error('❌ Missing SUPABASE_DB_PASSWORD or DB_PASSWORD in .env');
  console.log('   Add: SUPABASE_DB_PASSWORD=your_database_password');
  console.log('   You can find this in Supabase Dashboard → Settings → Database');
  process.exit(1);
}

const connectionString = `postgresql://postgres.${projectRef}:${password}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;

console.log('📋 Connecting to Supabase database...\n');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('✅ Connected to database\n');

  // Read and execute migration
  const migration = readFileSync('./database/migrations/010_grant_gsf_anon_permissions.sql', 'utf-8');

  console.log('⚙️  Executing migration 010_grant_gsf_anon_permissions.sql...\n');

  const result = await client.query(migration);

  console.log('✅ Migration applied successfully!\n');

  // Verify permissions
  console.log('🔍 Verifying permissions...\n');

  const verifyQuery = `
    SELECT
      grantee,
      table_schema,
      table_name,
      privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = 'anon'
      AND table_schema = 'great_southern_fuels'
    ORDER BY table_name
    LIMIT 10;
  `;

  const { rows } = await client.query(verifyQuery);

  if (rows.length > 0) {
    console.log(`✅ Found ${rows.length} permission grants for anon role:\n`);
    rows.forEach(row => {
      console.log(`   - ${row.table_name}: ${row.privilege_type}`);
    });
  } else {
    console.log('❌ No permissions found - migration may have failed');
  }

  console.log('\n⚠️  NEXT STEP: Expose schema in Supabase Dashboard');
  console.log('   1. Go to: Settings → API → Exposed Schemas');
  console.log('   2. Add: great_southern_fuels');
  console.log('   3. Save and wait 30 seconds\n');

} catch (err) {
  console.error('❌ Error:', err.message);
  console.error('\nFull error:', err);
  process.exit(1);
} finally {
  await client.end();
}
