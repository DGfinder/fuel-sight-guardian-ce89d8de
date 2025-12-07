import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('🔄 Testing schema exposure every 10 seconds...\n');
console.log('Press Ctrl+C to stop\n');

let attempts = 0;
const maxAttempts = 18; // 3 minutes

async function testSchema() {
  attempts++;

  console.log(`[Attempt ${attempts}/${maxAttempts}] Testing...`);

  const { data, error } = await client
    .schema('great_southern_fuels')
    .from('ta_agbot_locations')
    .select('id')
    .limit(1);

  if (error) {
    if (error.code === 'PGRST106') {
      const match = error.message.match(/following: (.+)$/);
      if (match) {
        const schemas = match[1];
        console.log(`   ❌ Still not exposed. Current: ${schemas}`);

        if (!schemas.includes('great_southern_fuels')) {
          console.log('   ⚠️  great_southern_fuels is NOT in the API list yet\n');
        }
      } else {
        console.log(`   ❌ ${error.message}\n`);
      }
    } else {
      console.log(`   ❌ Different error: ${error.message}\n`);
    }
  } else {
    console.log('   ✅ SUCCESS! Schema is now accessible!');
    console.log('   🎉 Webhook should work now!\n');
    console.log('Run a test webhook request to verify.');
    process.exit(0);
  }

  if (attempts >= maxAttempts) {
    console.log('\n⏱️  Timed out after 3 minutes');
    console.log('⚠️  The setting may not have saved properly in the dashboard');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Go back to Supabase Dashboard → Settings → API');
    console.log('2. Check if "great_southern_fuels" is STILL in the Exposed Schemas list');
    console.log('3. If YES: Contact Supabase support (platform issue)');
    console.log('4. If NO: Add it again, click Save, watch for confirmation');
    process.exit(1);
  }

  // Wait 10 seconds before next attempt
  setTimeout(testSchema, 10000);
}

testSchema();
