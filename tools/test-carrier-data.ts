#!/usr/bin/env npx tsx

/**
 * TEST CARRIER DATA ACCESS
 * 
 * Verify that carrier-specific filtering works correctly for SMB, GSF, and Combined data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',  
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function colorLog(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCarrierFiltering() {
  colorLog('cyan', '🚛 TESTING CARRIER DATA ACCESS');
  console.log('');
  
  // Test each carrier in both secure and regular views
  const carriers = ['SMB', 'GSF', 'Combined'];
  const views = [
    { name: 'captive_deliveries', description: 'Direct Materialized View' },
    { name: 'secure_captive_deliveries', description: 'Secure View' }
  ];
  
  for (const view of views) {
    colorLog('blue', `📊 Testing ${view.description} (${view.name})`);
    
    // Get all data first
    const { count: totalCount, error: totalError } = await supabase
      .from(view.name)
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      colorLog('red', `❌ Error accessing ${view.name}: ${totalError.message}`);
      continue;
    }
    
    colorLog('green', `✅ Total records: ${totalCount?.toLocaleString()}`);
    
    // Test each carrier
    for (const carrier of carriers) {
      const { count, error } = await supabase
        .from(view.name)
        .select('*', { count: 'exact', head: true })
        .eq('carrier', carrier);
      
      if (error) {
        colorLog('red', `❌ ${carrier} filter failed: ${error.message}`);
      } else {
        colorLog('green', `   ${carrier}: ${count?.toLocaleString() || 0} records`);
      }
    }
    
    // Get sample data to verify structure
    const { data: sampleData, error: sampleError } = await supabase
      .from(view.name)
      .select('*')
      .limit(3);
    
    if (!sampleError && sampleData && sampleData.length > 0) {
      colorLog('blue', '   Sample record structure:');
      const sample = sampleData[0];
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const displayValue = Array.isArray(value) ? `[${value.length} items]` : 
                           typeof value === 'string' ? value.substring(0, 30) + (value.length > 30 ? '...' : '') :
                           value;
        colorLog('cyan', `     ${key}: ${displayValue}`);
      });
    }
    
    console.log('');
  }
}

async function testAnalyticsViews() {
  colorLog('cyan', '📈 TESTING ANALYTICS VIEWS');
  console.log('');
  
  const analyticsViews = [
    'captive_monthly_analytics',
    'captive_customer_analytics', 
    'captive_terminal_analytics',
    'secure_captive_monthly_analytics',
    'secure_captive_customer_analytics',
    'secure_captive_terminal_analytics'
  ];
  
  for (const view of analyticsViews) {
    const { count, error } = await supabase
      .from(view)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      colorLog('red', `❌ ${view}: ${error.message}`);
    } else {
      colorLog('green', `✅ ${view}: ${count?.toLocaleString() || 0} records`);
      
      // If there's data, show carrier breakdown
      if (count && count > 0) {
        const { data: carrierBreakdown } = await supabase
          .from(view)
          .select('carrier')
          .limit(100);
        
        if (carrierBreakdown && carrierBreakdown.length > 0) {
          const carriers = [...new Set(carrierBreakdown.map(r => r.carrier))];
          colorLog('blue', `   Carriers: ${carriers.join(', ')}`);
        }
      }
    }
  }
}

async function testAPICompatibility() {
  colorLog('cyan', '🔗 TESTING API COMPATIBILITY');
  console.log('');
  
  // Test the queries that the frontend API layer would make
  const testQueries = [
    {
      name: 'Get all deliveries',
      query: () => supabase.from('secure_captive_deliveries').select('*').limit(10)
    },
    {
      name: 'Get SMB deliveries',
      query: () => supabase.from('secure_captive_deliveries').select('*').eq('carrier', 'SMB').limit(10)
    },
    {
      name: 'Get GSF deliveries',
      query: () => supabase.from('secure_captive_deliveries').select('*').eq('carrier', 'GSF').limit(10)
    },
    {
      name: 'Get Combined deliveries',
      query: () => supabase.from('secure_captive_deliveries').select('*').eq('carrier', 'Combined').limit(10)
    },
    {
      name: 'Get monthly analytics',
      query: () => supabase.from('secure_captive_monthly_analytics').select('*').limit(10)
    },
    {
      name: 'Get customer analytics (top 5)',
      query: () => supabase.from('secure_captive_customer_analytics').select('*').order('total_volume_litres', { ascending: false }).limit(5)
    }
  ];
  
  for (const test of testQueries) {
    try {
      const { data, error } = await test.query();
      
      if (error) {
        colorLog('red', `❌ ${test.name}: ${error.message}`);
      } else {
        colorLog('green', `✅ ${test.name}: ${data?.length || 0} records returned`);
      }
    } catch (err: any) {
      colorLog('red', `❌ ${test.name}: ${err.message}`);
    }
  }
}

async function checkDataConsistency() {
  colorLog('cyan', '🔍 CHECKING DATA CONSISTENCY');
  console.log('');
  
  // Compare base table to materialized view
  const { count: baseRecords } = await supabase
    .from('captive_payment_records')
    .select('*', { count: 'exact', head: true });
  
  const { count: deliveryRecords } = await supabase
    .from('captive_deliveries')
    .select('*', { count: 'exact', head: true });
    
  const { count: secureDeliveryRecords } = await supabase
    .from('secure_captive_deliveries')
    .select('*', { count: 'exact', head: true });
  
  colorLog('blue', `📊 Data Pipeline Status:`);
  colorLog('green', `   Base records: ${baseRecords?.toLocaleString() || 0}`);
  colorLog('green', `   Materialized deliveries: ${deliveryRecords?.toLocaleString() || 0}`);
  colorLog('green', `   Secure deliveries: ${secureDeliveryRecords?.toLocaleString() || 0}`);
  
  if (baseRecords === 0 && deliveryRecords && deliveryRecords > 0) {
    colorLog('yellow', '⚠️  Base table is empty but materialized view has data');
    colorLog('yellow', '   This suggests data was imported directly into the materialized view');
    colorLog('blue', '   This is fine for production as long as the materialized view has correct data');
  }
  
  if (deliveryRecords !== secureDeliveryRecords) {
    colorLog('yellow', '⚠️  Materialized view and secure view have different record counts');
    colorLog('blue', '   This might indicate RLS filtering is active');
  }
}

async function main() {
  colorLog('cyan', '🚀 CAPTIVE PAYMENTS CARRIER DATA TEST');
  console.log('');
  
  try {
    await testCarrierFiltering();
    await testAnalyticsViews();
    await testAPICompatibility();
    await checkDataConsistency();
    
    console.log('');
    colorLog('cyan', '📋 SUMMARY');
    console.log('='.repeat(50));
    colorLog('green', '✅ Carrier data testing completed');
    colorLog('blue', 'ℹ️  Check results above for any issues or warnings');
    
    process.exit(0);
  } catch (error: any) {
    colorLog('red', `❌ Test failed: ${error?.message || error}`);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main().catch(console.error);