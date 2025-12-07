import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const serviceClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 COMPREHENSIVE SCHEMA DIAGNOSTICS\n');
console.log('Environment:');
console.log('  URL:', process.env.SUPABASE_URL);
console.log('  Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...');
console.log('  Anon Key:', process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...\n');

console.log('═'.repeat(70));
console.log('TEST 1: Check what schemas exist in the database');
console.log('═'.repeat(70));

// Check all schemas using PostgREST API metadata
const { data: schemas, error: schemaError } = await serviceClient
  .from('pg_namespace')
  .select('nspname')
  .order('nspname');

if (schemaError) {
  console.log('❌ Cannot query pg_namespace:', schemaError.message);
  console.log('   This is expected - trying alternative method...\n');
} else if (schemas) {
  console.log('✅ Found schemas in database:');
  schemas.forEach(s => {
    const marker = s.nspname === 'great_southern_fuels' ? ' ← TARGET' : '';
    console.log(`   - ${s.nspname}${marker}`);
  });
  console.log('');
}

console.log('═'.repeat(70));
console.log('TEST 2: Try accessing public schema (should work)');
console.log('═'.repeat(70));

const { data: publicTest, error: publicError } = await serviceClient
  .from('ta_agbot_locations')
  .select('id')
  .limit(1);

if (publicError) {
  console.log('❌ Cannot access public.ta_agbot_locations:', publicError.message);
} else {
  console.log('✅ public.ta_agbot_locations accessible (', publicTest?.length || 0, 'records )');
}

console.log('');
console.log('═'.repeat(70));
console.log('TEST 3: Try accessing great_southern_fuels schema with service role');
console.log('═'.repeat(70));

const { data: gsfTest, error: gsfError, status, statusText } = await serviceClient
  .schema('great_southern_fuels')
  .from('ta_agbot_locations')
  .select('id')
  .limit(1);

if (gsfError) {
  console.log('❌ FAILED:', gsfError.message);
  console.log('   Code:', gsfError.code);
  console.log('   Details:', gsfError.details);
  console.log('   Hint:', gsfError.hint);

  if (gsfError.code === 'PGRST106') {
    console.log('\n🔍 ERROR ANALYSIS: PGRST106 = Schema not in exposed list');
    console.log('   This means PostgREST API layer is blocking the schema');
    console.log('   Even though you added it to settings 2 hours ago!\n');

    console.log('💡 POSSIBLE CAUSES:');
    console.log('   1. Settings got reverted (check dashboard again)');
    console.log('   2. Supabase project was restarted/redeployed');
    console.log('   3. Someone else removed it from settings');
    console.log('   4. Supabase platform issue/bug');
    console.log('   5. Using wrong project (check project ref matches)\n');

    // Check project ref
    const projectRef = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    console.log('📋 VERIFY THIS MATCHES YOUR DASHBOARD:');
    console.log('   Project Ref:', projectRef);
    console.log('   URL:', process.env.SUPABASE_URL);
    console.log('   Go to: https://supabase.com/dashboard/project/' + projectRef + '/settings/api\n');
  }
} else {
  console.log('✅ great_southern_fuels.ta_agbot_locations accessible!');
  console.log('   Records found:', gsfTest?.length || 0);
  console.log('   ');
}

console.log('');
console.log('═'.repeat(70));
console.log('TEST 4: Check current API exposed schemas setting');
console.log('═'.repeat(70));

// The error message tells us what schemas ARE exposed
if (gsfError && gsfError.message.includes('must be one of')) {
  const match = gsfError.message.match(/following: (.+)$/);
  if (match) {
    const exposedSchemas = match[1].split(', ');
    console.log('Currently exposed schemas according to API:');
    exposedSchemas.forEach(schema => {
      console.log(`   ✓ ${schema}`);
    });

    if (!exposedSchemas.includes('great_southern_fuels')) {
      console.log('\n❌ great_southern_fuels is NOT in the exposed list');
      console.log('   Even though you said you added it 2 hours ago!\n');
      console.log('⚠️  ACTION REQUIRED: Check dashboard settings RIGHT NOW');
      console.log('   Go to Settings → API → Exposed Schemas');
      console.log('   Is "great_southern_fuels" still in the list?\n');
    }
  }
}

console.log('');
console.log('═'.repeat(70));
console.log('RECOMMENDATION');
console.log('═'.repeat(70));
console.log('1. Open Supabase Dashboard');
console.log('2. Go to Settings → API → Exposed Schemas');
console.log('3. Check if "great_southern_fuels" is there');
console.log('4. If YES: Screenshot it and contact Supabase support (platform bug)');
console.log('5. If NO: Add it again and WATCH for success confirmation');
console.log('6. After adding, wait 2 minutes then run: node diagnose-schema-issue.mjs\n');
