const { createClient } = require('@supabase/supabase-js');

async function debugLytxData() {
  console.log('🔍 LYTX Data Access Debug Tool\n');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔧 Environment Check:');
  console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('  SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.log('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  console.log('');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  // Test with service role (bypasses RLS)
  console.log('🔐 Testing with SERVICE ROLE (bypasses RLS):');
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Get total count
    const { count, error: countError } = await serviceClient
      .from('lytx_safety_events')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('  ❌ Count query failed:', countError.message);
    } else {
      console.log('  📊 Total events:', count);
    }

    // Get sample data
    const { data: sampleData, error: sampleError } = await serviceClient
      .from('lytx_safety_events')
      .select('carrier, depot, event_datetime, event_type, status, score')
      .limit(5);

    if (sampleError) {
      console.log('  ❌ Sample query failed:', sampleError.message);
    } else {
      console.log('  📝 Sample events:', sampleData.length);
      sampleData.forEach((event, i) => {
        console.log(`    ${i+1}. ${event.carrier} | ${event.depot} | ${event.event_type} | ${new Date(event.event_datetime).toISOString().split('T')[0]}`);
      });
    }

    // Check carrier distribution
    const { data: carrierData, error: carrierError } = await serviceClient
      .from('lytx_safety_events')
      .select('carrier')
      .limit(1000);

    if (!carrierError && carrierData) {
      const carrierCounts = {};
      carrierData.forEach(event => {
        carrierCounts[event.carrier] = (carrierCounts[event.carrier] || 0) + 1;
      });
      console.log('  🏢 Carrier distribution (from 1000 sample):', carrierCounts);
    }

  } catch (error) {
    console.log('  ❌ Service role test failed:', error.message);
  }

  console.log('');

  // Test with anon key (respects RLS)
  if (supabaseAnonKey) {
    console.log('🔑 Testing with ANON KEY (respects RLS):');
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    try {
      // Test without auth
      const { count: anonCount, error: anonCountError } = await anonClient
        .from('lytx_safety_events')
        .select('*', { count: 'exact', head: true });

      if (anonCountError) {
        console.log('  ❌ Anon count query failed:', anonCountError.message);
      } else {
        console.log('  📊 Anon accessible events:', anonCount);
      }

      const { data: anonSample, error: anonSampleError } = await anonClient
        .from('lytx_safety_events')
        .select('carrier, depot, event_datetime, event_type, status, score')
        .limit(5);

      if (anonSampleError) {
        console.log('  ❌ Anon sample query failed:', anonSampleError.message);
        console.log('  📝 This is expected - RLS blocks unauthenticated access');
      } else {
        console.log('  📝 Anon sample events:', anonSample.length);
        if (anonSample.length > 0) {
          console.log('  ⚠️  Unexpected: RLS should block unauthenticated access');
        }
      }

    } catch (error) {
      console.log('  ❌ Anon test failed:', error.message);
    }
  }

  console.log('');

  // Check RLS policies
  console.log('🛡️  Checking RLS policies:');
  try {
    const { data: policies, error: policiesError } = await serviceClient
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'lytx_safety_events');

    if (policiesError) {
      console.log('  ❌ Could not fetch policies:', policiesError.message);
    } else {
      console.log(`  📋 Found ${policies.length} RLS policies:`);
      policies.forEach(policy => {
        console.log(`    - ${policy.policyname} (${policy.cmd}) - ${policy.roles?.join(', ') || 'all roles'}`);
      });
    }
  } catch (error) {
    console.log('  ❌ Policy check failed:', error.message);
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Run this script: node debug-lytx-data.js');
  console.log('2. Check the dashboard browser console for the debug logs');
  console.log('3. Compare service role vs anon results');
  console.log('4. If service role shows data but anon doesn\'t, it\'s an RLS issue');
  console.log('5. Check user authentication and permissions in the app');
}

debugLytxData().catch(console.error);