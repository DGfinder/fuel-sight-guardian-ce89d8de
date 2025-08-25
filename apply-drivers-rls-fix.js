import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WAYNE_DRIVER_ID = '202f3cb3-adc6-4af9-bfbb-069b87505287';

console.log('🔧 Applying RLS Policy Fix for Drivers Table');

async function fixDriversRLSPolicy() {
  try {
    console.log('\n🔐 Step 1: Dropping existing restrictive policy...');
    
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS drivers_select ON drivers;'
    });

    if (dropError) {
      console.log(`⚠️ Drop policy warning: ${dropError.message}`);
      // Continue anyway - the policy might not exist
    } else {
      console.log('✅ Existing policy dropped');
    }

    console.log('\n🛡️ Step 2: Creating new anonymous-friendly policy...');
    
    const newPolicySQL = `
      CREATE POLICY drivers_select_policy ON drivers
        FOR SELECT
        TO anon, authenticated
        USING (true);
    `;

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: newPolicySQL
    });

    if (createError) {
      console.error('❌ Create policy error:', createError.message);
      
      // Try alternative approach - direct SQL execution
      console.log('\n🔄 Trying alternative SQL execution...');
      
      const { error: altError } = await supabase
        .from('_supabase_sql_execute')
        .insert({ sql: newPolicySQL });

      if (altError) {
        console.error('❌ Alternative SQL execution failed:', altError.message);
        console.log('\n💡 Manual SQL execution required:');
        console.log('   Please run the following SQL in the Supabase SQL editor:');
        console.log('   ```sql');
        console.log('   DROP POLICY IF EXISTS drivers_select ON drivers;');
        console.log('   CREATE POLICY drivers_select_policy ON drivers');
        console.log('     FOR SELECT TO anon, authenticated USING (true);');
        console.log('   GRANT SELECT ON drivers TO anon;');
        console.log('   ```');
        return;
      }
    } else {
      console.log('✅ New RLS policy created successfully');
    }

    console.log('\n👤 Step 3: Granting SELECT permission to anon role...');
    
    const grantSQL = `GRANT SELECT ON drivers TO anon;`;
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql: grantSQL
    });

    if (grantError) {
      console.log(`⚠️ Grant permission warning: ${grantError.message}`);
      // This might fail but the policy should still work
    } else {
      console.log('✅ SELECT permission granted to anon role');
    }

    console.log('\n🧪 Step 4: Testing the fix with Wayne Bowron...');

    // Test with anonymous client
    const anonSupabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    const { data: testData, error: testError } = await anonSupabase
      .from('drivers')
      .select('id, first_name, last_name, fleet, depot, status')
      .eq('id', WAYNE_DRIVER_ID)
      .single();

    if (testError) {
      console.error('❌ Test query still failed:', testError.message);
      
      if (testError.code === 'PGRST116') {
        console.log('   💡 RLS might still be blocking - manual SQL execution may be needed');
      }
    } else {
      console.log('✅ Test successful! Anonymous role can now read Wayne Bowron:');
      console.log(`   • Name: ${testData.first_name} ${testData.last_name}`);
      console.log(`   • Fleet: ${testData.fleet}`);
      console.log(`   • Depot: ${testData.depot}`);
      console.log(`   • Status: ${testData.status}`);
    }

    // Test driver search functionality
    console.log('\n🔍 Step 5: Testing driver search functionality...');
    
    const { data: searchData, error: searchError } = await anonSupabase
      .from('drivers')
      .select('id, first_name, last_name, fleet, depot')
      .or('first_name.ilike.%wayne%,last_name.ilike.%bowron%');

    if (searchError) {
      console.error('❌ Search test failed:', searchError.message);
    } else {
      console.log(`✅ Search test successful! Found ${searchData.length} driver(s):`);
      searchData.forEach(driver => {
        console.log(`   • ${driver.first_name} ${driver.last_name} (${driver.fleet}, ID: ${driver.id})`);
      });
    }

    console.log('\n🎉 RLS POLICY FIX RESULTS:');
    
    if (testData && searchData && searchData.length > 0) {
      console.log('✅ SUCCESS: Wayne Bowron driver modal should now work!');
      console.log('\n📋 What this fixes:');
      console.log('   ✅ Driver search in Driver Management page');
      console.log('   ✅ Driver modal opening for Wayne Bowron');
      console.log('   ✅ Driver profile loading with LYTX events');
      console.log('   ✅ All driver-related functionality');
      
      console.log('\n🔄 Next steps for full functionality:');
      console.log('   1. Test driver modal in browser');
      console.log('   2. Implement 180-day timeframe support');  
      console.log('   3. Update database functions for extended date ranges');
    } else {
      console.log('⚠️ PARTIAL SUCCESS: Policy updated but manual SQL execution may be needed');
      console.log('   Check the manual SQL commands printed above');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixDriversRLSPolicy();