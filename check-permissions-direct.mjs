import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Use SERVICE_ROLE_KEY to bypass RLS and check actual permissions
const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking if anon role has permissions on great_southern_fuels schema...\n');
console.log('─'.repeat(60));

// Let's try a simpler approach - just test if we can access the table with service role
const { data: testData, error: testError } = await client
  .schema('great_southern_fuels')
  .from('ta_agbot_locations')
  .select('id')
  .limit(1);

if (testError) {
  console.log('❌ Service role CANNOT access schema:', testError.message);
  console.log('\n⚠️  This means the schema may not exist or has issues\n');
} else {
  console.log('✅ Service role CAN access schema (found', testData?.length || 0, 'records)');

  // Now test with anon key
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: anonData, error: anonError } = await anonClient
    .schema('great_southern_fuels')
    .from('ta_agbot_locations')
    .select('id')
    .limit(1);

  if (anonError) {
    console.log('❌ Anon role CANNOT access schema:', anonError.message);

    if (anonError.code === 'PGRST106') {
      console.log('\n⚠️  Schema exposure issue - even though it\'s in settings');
      console.log('   Possible causes:');
      console.log('   1. Settings not saved properly - try saving again');
      console.log('   2. Changes not propagated - wait 2-3 minutes');
      console.log('   3. Cache issue - try hard refresh in dashboard\n');
      console.log('💡 TRY THIS:');
      console.log('   1. Remove great_southern_fuels from Exposed Schemas');
      console.log('   2. Click Save');
      console.log('   3. Wait 10 seconds');
      console.log('   4. Add great_southern_fuels back');
      console.log('   5. Click Save');
      console.log('   6. Wait 60 seconds');
      console.log('   7. Run this script again\n');
    } else if (anonError.code === '42501') {
      console.log('\n⚠️  Permission denied - need to apply migration 010');
      console.log('   Run the SQL in: database/migrations/010_grant_gsf_anon_permissions.sql\n');
    }
  } else {
    console.log('✅ Anon role CAN access schema (found', anonData?.length || 0, 'records)');
    console.log('\n🎉 Everything is working! Webhook should work now.\n');
  }
}

console.log('─'.repeat(60));
