#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testData() {
  console.log('🧪 Testing captive payments data...');
  
  try {
    // Test payment records
    console.log('📋 Testing captive_payment_records...');
    const { count: totalRecords, error: recordsError } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true });
    
    if (recordsError) {
      console.error('❌ Error accessing payment records:', recordsError);
      return;
    }
    
    console.log(`   ✅ Total payment records: ${totalRecords}`);
    
    // Test by carrier
    const { count: smbCount } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'SMB');
    
    const { count: gsfCount } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'GSF');
    
    console.log(`   📊 SMB records: ${smbCount}`);
    console.log(`   📊 GSF records: ${gsfCount}`);
    
    // Test sample data
    const { data: sampleRecords } = await supabase
      .from('captive_payment_records')
      .select('*')
      .limit(3);
    
    console.log('   📋 Sample records:');
    sampleRecords?.forEach((record, i) => {
      console.log(`     ${i + 1}. ${record.carrier} - ${record.customer} - ${record.bill_of_lading} - ${record.delivery_date}`);
    });
    
    // Test API hooks directly
    console.log('\n🔗 Testing API endpoints...');
    await testAPI();
    
  } catch (error) {
    console.error('❌ Error testing data:', error);
  }
}

async function testAPI() {
  try {
    // Test basic API endpoints
    const { data: smbData, error: smbError } = await supabase
      .from('captive_payment_records')
      .select('*')
      .eq('carrier', 'SMB')
      .limit(10);
    
    if (smbError) {
      console.error('❌ SMB API test failed:', smbError);
    } else {
      console.log(`   ✅ SMB API: ${smbData?.length || 0} records`);
    }
    
    const { data: gsfData, error: gsfError } = await supabase
      .from('captive_payment_records')
      .select('*')
      .eq('carrier', 'GSF')
      .limit(10);
    
    if (gsfError) {
      console.error('❌ GSF API test failed:', gsfError);
    } else {
      console.log(`   ✅ GSF API: ${gsfData?.length || 0} records`);
    }
    
    // Test date filtering
    const { data: recentData, error: recentError } = await supabase
      .from('captive_payment_records')
      .select('*')
      .gte('delivery_date', '2024-01-01')
      .limit(5);
    
    if (recentError) {
      console.error('❌ Date filter test failed:', recentError);
    } else {
      console.log(`   ✅ Date filtering: ${recentData?.length || 0} records from 2024+`);
    }
    
    // Check if we can query deliveries view
    console.log('\n🚚 Testing deliveries view...');
    const { data: deliveriesData, error: deliveriesError } = await supabase
      .from('captive_deliveries')
      .select('*')
      .limit(5);
    
    if (deliveriesError) {
      console.error('❌ Deliveries view not accessible:', deliveriesError.message);
      console.log('   📝 The materialized view needs to be manually created in the database');
    } else {
      console.log(`   ✅ Deliveries view: ${deliveriesData?.length || 0} deliveries`);
      if (deliveriesData && deliveriesData.length > 0) {
        console.log('   📋 Sample delivery:', {
          bol: deliveriesData[0].bill_of_lading,
          customer: deliveriesData[0].customer,
          date: deliveriesData[0].delivery_date,
          volume: deliveriesData[0].total_volume_litres
        });
      }
    }
    
  } catch (error) {
    console.error('❌ API testing failed:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testData().catch(console.error);
}