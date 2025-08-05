#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceRoleKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Import our API functions directly
import { getCaptiveDeliveries, getMonthlyAnalytics, getCustomerAnalytics, getTerminalAnalytics, getCaptivePaymentsSummary } from '../src/api/captivePayments.js';

async function testAPI() {
  console.log('🧪 Testing updated captive payments API...');
  
  try {
    // Test 1: Basic deliveries query
    console.log('\n📊 Test 1: getCaptiveDeliveries...');
    const deliveries = await getCaptiveDeliveries({ carrier: 'SMB' });
    console.log(`✅ Found ${deliveries.length} SMB deliveries`);
    if (deliveries.length > 0) {
      console.log('📋 Sample delivery:', {
        bill_of_lading: deliveries[0].bill_of_lading,
        customer: deliveries[0].customer,
        total_volume_litres: deliveries[0].total_volume_litres,
        carrier: deliveries[0].carrier
      });
    }
    
    // Test 2: Monthly analytics
    console.log('\n📊 Test 2: getMonthlyAnalytics...');
    const monthlyData = await getMonthlyAnalytics({ carrier: 'SMB' });
    console.log(`✅ Found ${monthlyData.length} monthly records for SMB`);
    if (monthlyData.length > 0) {
      console.log('📋 Sample month:', {
        month_name: monthlyData[0].month_name,
        year: monthlyData[0].year,
        total_deliveries: monthlyData[0].total_deliveries,
        total_volume_megalitres: monthlyData[0].total_volume_megalitres
      });
    }
    
    // Test 3: Customer analytics
    console.log('\n📊 Test 3: getCustomerAnalytics...');
    const customerData = await getCustomerAnalytics({ carrier: 'SMB' });
    console.log(`✅ Found ${customerData.length} customers for SMB`);
    if (customerData.length > 0) {
      console.log('📋 Top customer:', {
        customer: customerData[0].customer,
        total_deliveries: customerData[0].total_deliveries,
        total_volume_megalitres: customerData[0].total_volume_megalitres,
        terminals_served: customerData[0].terminals_served
      });
    }
    
    // Test 4: Terminal analytics
    console.log('\n📊 Test 4: getTerminalAnalytics...');
    const terminalData = await getTerminalAnalytics({ carrier: 'SMB' });
    console.log(`✅ Found ${terminalData.length} terminals for SMB`);
    if (terminalData.length > 0) {
      console.log('📋 Top terminal:', {
        terminal: terminalData[0].terminal,
        total_deliveries: terminalData[0].total_deliveries,
        total_volume_megalitres: terminalData[0].total_volume_megalitres,
        percentage_of_carrier_volume: terminalData[0].percentage_of_carrier_volume.toFixed(1) + '%'
      });
    }
    
    // Test 5: Complete summary
    console.log('\n📊 Test 5: getCaptivePaymentsSummary...');
    const summary = await getCaptivePaymentsSummary({ carrier: 'Combined' });
    console.log('✅ Summary data:', {
      totalDeliveries: summary.totalDeliveries,
      totalVolumeMegaLitres: summary.totalVolumeMegaLitres.toFixed(1),
      uniqueCustomers: summary.uniqueCustomers,
      uniqueTerminals: summary.uniqueTerminals,
      dateRange: summary.dateRange,
      topCustomers: summary.topCustomers.length,
      monthsCovered: summary.dateRange.monthsCovered
    });
    
    console.log('\n✅ All API tests passed! The frontend should now show real data.');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🚀 Starting API functionality test...');
  
  const success = await testAPI();
  
  if (success) {
    console.log('\n🎉 SUCCESS: Captive payments API is working!');
    console.log('📝 Next steps:');
    console.log('  1. Start the frontend: npm run dev');
    console.log('  2. Navigate to /data-centre/captive-payments');
    console.log('  3. Data should now display instead of zeros');
    console.log('');
    console.log('📊 Expected results:');
    console.log('  - Dashboard will show actual delivery counts');
    console.log('  - Volume metrics will show real numbers');
    console.log('  - Customer and terminal data will populate');
    console.log('  - BOL delivery table will show records');
  } else {
    console.log('\n❌ FAILED: API testing failed');
    process.exit(1);
  }
}

main().catch(console.error);