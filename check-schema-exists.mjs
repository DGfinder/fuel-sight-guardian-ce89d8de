import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

// Check if we have DB password
const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!password) {
  console.log('❌ No database password found');
  console.log('This script needs direct database access to check if the schema exists');
  console.log('\nPlease run this SQL in Supabase SQL Editor instead:');
  console.log('─'.repeat(70));
  console.log(`
SELECT
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name LIKE '%great%' OR schema_name LIKE '%southern%'
ORDER BY schema_name;
  `);
  console.log('─'.repeat(70));
  console.log('\nIf you see "great_southern_fuels" in the results, the schema exists.');
  console.log('If NOT, the schema was deleted and needs to be recreated!');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];

const connectionString = `postgresql://postgres.${projectRef}:${password}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;

console.log('🔍 Checking if great_southern_fuels schema exists in database...\n');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();

  const { rows } = await client.query(`
    SELECT
      schema_name,
      schema_owner
    FROM information_schema.schemata
    WHERE schema_name LIKE '%great%' OR schema_name LIKE '%southern%' OR schema_name = 'great_southern_fuels'
    ORDER BY schema_name;
  `);

  if (rows.length === 0) {
    console.log('❌ NO SCHEMAS FOUND matching "great" or "southern"');
    console.log('\n⚠️  CRITICAL: The great_southern_fuels schema DOES NOT EXIST!');
    console.log('\nThis explains why you can\'t expose it - it\'s not there!');
    console.log('\n📋 YOU NEED TO:');
    console.log('1. Run migrations to create the schema');
    console.log('2. Start with: database/migrations/004_create_gsf_schema.sql');
    console.log('3. Then run subsequent gsf migrations\n');
  } else {
    console.log('✅ Found matching schemas:\n');
    rows.forEach(row => {
      console.log(`   - ${row.schema_name} (owner: ${row.schema_owner})`);
    });

    const hasCorrectSchema = rows.some(r => r.schema_name === 'great_southern_fuels');

    if (hasCorrectSchema) {
      console.log('\n✅ Schema "great_southern_fuels" EXISTS in database');
      console.log('\n⚠️  So the problem is NOT that the schema is missing');
      console.log('   The problem is that Supabase settings are not saving/applying');
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Try adding the schema in a different browser');
      console.log('2. Or try Supabase CLI configuration');
      console.log('3. Or contact Supabase support\n');
    } else {
      console.log('\n❌ Schema "great_southern_fuels" NOT FOUND');
      console.log('   Found similar names but not the exact match');
      console.log('\n📋 ACTION: Create the schema by running migrations\n');
    }
  }

  // Also check if there are any tables in the schema (if it exists)
  const { rows: tables } = await client.query(`
    SELECT COUNT(*) as table_count
    FROM information_schema.tables
    WHERE table_schema = 'great_southern_fuels';
  `);

  if (tables[0].table_count > 0) {
    console.log(`✅ Schema contains ${tables[0].table_count} tables\n`);
  } else if (rows.some(r => r.schema_name === 'great_southern_fuels')) {
    console.log('⚠️  Schema exists but contains NO TABLES!\n');
  }

} catch (err) {
  console.error('❌ Database connection error:', err.message);
  console.log('\nCannot check directly. Please run this SQL in Supabase SQL Editor:');
  console.log('─'.repeat(70));
  console.log(`
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'great_southern_fuels';
  `);
  console.log('─'.repeat(70));
} finally {
  await client.end().catch(() => {});
}
