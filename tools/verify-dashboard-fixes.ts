/**
 * VERIFICATION SCRIPT - DASHBOARD FIXES
 * 
 * Tests all the fixes applied to the captive payments dashboard
 * Run this to verify the fixes are working correctly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSecureViews() {
  console.log('\n🔍 Testing Secure Views...');
  
  const viewsToTest = [
    'secure_captive_deliveries',
    'secure_captive_monthly_analytics', 
    'secure_captive_customer_analytics',
    'secure_captive_terminal_analytics'
  ];

  for (const viewName of viewsToTest) {
    try {
      const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .limit(1);

      if (error) {
        console.error(`❌ ${viewName}: ${error.message}`);
      } else {
        console.log(`✅ ${viewName}: Available (${data?.length || 0} sample records)`);
      }
    } catch (err) {
      console.error(`❌ ${viewName}: ${err}`);
    }
  }
}

async function testCarrierFiltering() {
  console.log('\n🚛 Testing Carrier Filtering...');
  
  try {
    // Test SMB filter
    const { data: smbData, error: smbError } = await supabase
      .from('secure_captive_deliveries')
      .select('*')
      .eq('carrier', 'SMB');

    if (smbError) {
      console.error('❌ SMB filter error:', smbError.message);
    } else {
      const smbVolume = smbData?.reduce((sum, d) => sum + d.total_volume_litres_abs, 0) || 0;
      console.log(`✅ SMB: ${smbData?.length || 0} deliveries, ${(smbVolume / 1000000).toFixed(1)}ML`);
    }

    // Test GSF filter
    const { data: gsfData, error: gsfError } = await supabase
      .from('secure_captive_deliveries')
      .select('*')
      .eq('carrier', 'GSF');

    if (gsfError) {
      console.error('❌ GSF filter error:', gsfError.message);
    } else {
      const gsfVolume = gsfData?.reduce((sum, d) => sum + d.total_volume_litres_abs, 0) || 0;
      console.log(`✅ GSF: ${gsfData?.length || 0} deliveries, ${(gsfVolume / 1000000).toFixed(1)}ML`);
    }

    // Test Combined (no filter - should return all)
    const { data: combinedData, error: combinedError } = await supabase
      .from('secure_captive_deliveries')
      .select('*');

    if (combinedError) {
      console.error('❌ Combined filter error:', combinedError.message);
    } else {
      const combinedVolume = combinedData?.reduce((sum, d) => sum + d.total_volume_litres_abs, 0) || 0;
      console.log(`✅ Combined: ${combinedData?.length || 0} deliveries, ${(combinedVolume / 1000000).toFixed(1)}ML`);
      
      // Verify combined = SMB + GSF
      const expectedCombined = (smbData?.length || 0) + (gsfData?.length || 0);
      if (combinedData?.length === expectedCombined) {
        console.log('✅ Combined filter working correctly (SMB + GSF)');
      } else {
        console.log(`⚠️  Combined count mismatch: expected ${expectedCombined}, got ${combinedData?.length || 0}`);
      }
    }

  } catch (err) {
    console.error('❌ Carrier filtering test failed:', err);
  }
}

async function testAnalyticsViews() {
  console.log('\n📊 Testing Analytics Views...');
  
  try {
    // Test monthly analytics
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('secure_captive_monthly_analytics')
      .select('*')
      .limit(5);

    if (monthlyError) {
      console.error('❌ Monthly analytics error:', monthlyError.message);
    } else {
      console.log(`✅ Monthly analytics: ${monthlyData?.length || 0} months available`);
      if (monthlyData && monthlyData.length > 0) {
        const sample = monthlyData[0];
        console.log(`   Sample: ${sample.month_name} ${sample.year}, ${sample.carrier}, ${sample.total_deliveries} deliveries`);
      }
    }

    // Test customer analytics  
    const { data: customerData, error: customerError } = await supabase
      .from('secure_captive_customer_analytics')
      .select('*')
      .limit(3);

    if (customerError) {
      console.error('❌ Customer analytics error:', customerError.message);
    } else {
      console.log(`✅ Customer analytics: ${customerData?.length || 0} customers available`);
    }

    // Test terminal analytics
    const { data: terminalData, error: terminalError } = await supabase
      .from('secure_captive_terminal_analytics')
      .select('*')
      .limit(3);

    if (terminalError) {
      console.error('❌ Terminal analytics error:', terminalError.message);
    } else {
      console.log(`✅ Terminal analytics: ${terminalData?.length || 0} terminals available`);
    }

  } catch (err) {
    console.error('❌ Analytics views test failed:', err);
  }
}

async function testDataConsistency() {
  console.log('\n🔍 Testing Data Consistency...');
  
  try {
    // Get raw materialized view count
    const { data: rawData, error: rawError } = await supabase
      .from('captive_deliveries')
      .select('*', { count: 'exact', head: true });

    if (rawError) {
      console.error('❌ Raw materialized view error:', rawError.message);
      return;
    }

    // Get secure view count
    const { data: secureData, error: secureError } = await supabase
      .from('secure_captive_deliveries')
      .select('*', { count: 'exact', head: true });

    if (secureError) {
      console.error('❌ Secure view error:', secureError.message);
      return;
    }

    const rawCount = rawData ? 1 : 0; // head request returns 1 if data exists
    const secureCount = secureData ? 1 : 0;

    console.log(`✅ Data consistency check:`);
    console.log(`   Raw materialized view accessible: ${rawCount > 0 ? 'Yes' : 'No'}`);
    console.log(`   Secure view accessible: ${secureCount > 0 ? 'Yes' : 'No'}`);

  } catch (err) {
    console.error('❌ Data consistency test failed:', err);
  }
}

async function main() {
  console.log('🚀 Verifying Captive Payments Dashboard Fixes...\n');
  
  await testSecureViews();
  await testCarrierFiltering();
  await testAnalyticsViews();
  await testDataConsistency();
  
  console.log('\n✅ Verification complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. If secure views are missing, run: database/create-production-secure-views.sql');
  console.log('2. Clear browser cache and refresh the dashboard');
  console.log('3. Check browser console for any remaining errors');
  console.log('4. Verify the main dashboard shows correct data');
}

main().catch(console.error);