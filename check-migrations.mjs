import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking applied migrations...\n');

// Check if anon has permissions on the schema
const { data: anonPerms, error: anonError } = await client.rpc('execute_sql', {
  query: `
    SELECT
      grantee,
      table_schema,
      table_name,
      privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = 'anon'
      AND table_schema = 'great_southern_fuels'
    LIMIT 10;
  `
});

console.log('Anon permissions on great_southern_fuels schema:');
if (anonError) {
  console.error('❌ Error checking permissions:', anonError.message);
  console.log('   Trying alternative check...\n');

  // Try direct query
  const { data: perms2, error: err2 } = await client.rpc('execute_sql', {
    query: `
      SELECT has_schema_privilege('anon', 'great_southern_fuels', 'USAGE') as has_usage;
    `
  });

  if (err2) {
    console.error('   Still failed:', err2.message);
  } else {
    console.log('   Schema usage permission:', perms2);
  }
} else if (!anonPerms || anonPerms.length === 0) {
  console.log('❌ No permissions found - migration 010 NOT applied');
} else {
  console.log('✅ Permissions found:', anonPerms.length, 'grants');
  console.log(anonPerms.slice(0, 3));
}

// Check schema exposure
console.log('\n⚠️  CRITICAL: You must also expose the schema in Supabase Dashboard');
console.log('   Settings → API → Exposed Schemas');
console.log('   Add: great_southern_fuels');
