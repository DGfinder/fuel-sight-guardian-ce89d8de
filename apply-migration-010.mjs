import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📋 Applying migration 010_grant_gsf_anon_permissions.sql...\n');

// Read migration file
const migrationPath = join(__dirname, 'database', 'migrations', '010_grant_gsf_anon_permissions.sql');
const migration = readFileSync(migrationPath, 'utf-8');

console.log('Migration content:');
console.log('─'.repeat(60));
console.log(migration.substring(0, 500) + '...');
console.log('─'.repeat(60));
console.log('');

try {
  // Execute the migration using a raw SQL query
  // Note: We need to use the postgres connection, not the REST API
  const { data, error } = await client.rpc('exec_sql', {
    sql: migration
  });

  if (error) {
    console.error('❌ Error executing migration:', error);

    // Try alternative: Split the migration into individual statements
    console.log('\n⚙️  Trying to execute statements individually...\n');

    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt) {
        console.log(`   [${i + 1}/${statements.length}] ${stmt.substring(0, 60)}...`);
        // Execute each statement
        // Note: This may not work via REST API - you may need to use psql or Supabase dashboard
      }
    }

    console.log('\n⚠️  Please apply this migration manually via Supabase SQL Editor:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/[project-id]/sql/new');
    console.log('   2. Copy contents of: database/migrations/010_grant_gsf_anon_permissions.sql');
    console.log('   3. Paste and run the SQL');

    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
  console.log(data);

} catch (err) {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
}
