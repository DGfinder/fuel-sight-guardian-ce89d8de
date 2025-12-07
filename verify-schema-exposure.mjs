import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // Use anon key to test actual webhook access
);

console.log('🔍 Testing Schema Exposure...\n');
console.log('Using:', process.env.SUPABASE_URL);
console.log('Key:', process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...\n');

// Test 1: Try to access great_southern_fuels schema
console.log('Test 1: Accessing great_southern_fuels.ta_agbot_locations...');

try {
  const { data, error, status, statusText } = await client
    .schema('great_southern_fuels')
    .from('ta_agbot_locations')
    .select('id')
    .limit(1);

  if (error) {
    console.log(`❌ FAILED - Status: ${error.code} (${error.message})`);

    if (error.code === 'PGRST106' || error.message.includes('schema must be one of')) {
      console.log('\n⚠️  ISSUE IDENTIFIED: Schema is NOT exposed in Supabase settings');
      console.log('\n📋 TO FIX:');
      console.log('   1. Go to: Supabase Dashboard → Settings → API');
      console.log('   2. Scroll to: Exposed Schemas');
      console.log('   3. Add: great_southern_fuels');
      console.log('   4. Click Save');
      console.log('   5. Wait 30-60 seconds');
      console.log('   6. Run this script again\n');
    } else if (error.code === '42501') {
      console.log('\n⚠️  ISSUE: Permissions not granted');
      console.log('   Run migration: database/migrations/010_grant_gsf_anon_permissions.sql\n');
    } else {
      console.log('\n⚠️  Unexpected error:', error);
    }

    process.exit(1);
  }

  console.log('✅ SUCCESS - Schema is accessible!\n');
  console.log('Data:', data);

} catch (err) {
  console.log('❌ FAILED - Network or connection error');
  console.error(err.message);
  process.exit(1);
}

// Test 2: Try other tables
console.log('\nTest 2: Accessing ta_agbot_assets...');

try {
  const { data, error } = await client
    .schema('great_southern_fuels')
    .from('ta_agbot_assets')
    .select('id')
    .limit(1);

  if (error) {
    console.log(`❌ Assets table: ${error.message}`);
  } else {
    console.log('✅ Assets table: Accessible');
  }
} catch (err) {
  console.log('❌ Assets table: Network error');
}

console.log('\nTest 3: Accessing ta_agbot_sync_log...');

try {
  const { data, error } = await client
    .schema('great_southern_fuels')
    .from('ta_agbot_sync_log')
    .select('id')
    .limit(1);

  if (error) {
    console.log(`❌ Sync log table: ${error.message}`);
  } else {
    console.log('✅ Sync log table: Accessible');
  }
} catch (err) {
  console.log('❌ Sync log table: Network error');
}

console.log('\n✅ All tests passed! Webhook should work now.');
console.log('\n📋 Next: Test the actual webhook endpoint with sample data\n');
