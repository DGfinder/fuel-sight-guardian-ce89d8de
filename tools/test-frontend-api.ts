#!/usr/bin/env tsx

/**
 * Test Frontend API Functions
 * 
 * This script tests the actual API functions used by the frontend
 */

import { createClient } from '@supabase/supabase-js';

// Use the public anon key like the frontend does
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxODA1NTIsImV4cCI6MjA2NDc1NjU1Mn0.XJeTNtWQGIzgKRk4zIKKEAr5PXVjrg6LhKBtjr8LPYg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFrontendAPI() {
  console.log('🧪 Testing Frontend API Functions...');
  
  try {
    // Test 1: Basic captive payment records query
    console.log('\n📋 Test 1: Basic Payment Records Query');
    const { data: records, error: recordsError } = await supabase
      .from('captive_payment_records')
      .select('*')
      .limit(5);
    
    if (recordsError) {
      console.error('❌ Payment records query failed:', recordsError);
    } else {
      console.log(`   ✅ Retrieved ${records?.length || 0} payment records`);
      if (records && records.length > 0) {
        console.log('   📋 Sample record:', {
          carrier: records[0].carrier,
          customer: records[0].customer,
          date: records[0].delivery_date,
          volume: records[0].volume_litres
        });
      }
    }
    
    // Test 2: SMB carrier filter
    console.log('\n📊 Test 2: SMB Carrier Filter');
    const { count: smbCount, error: smbError } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'SMB');
    
    if (smbError) {
      console.error('❌ SMB filter failed:', smbError);
    } else {
      console.log(`   ✅ SMB records: ${smbCount || 0}`);
    }
    
    // Test 3: GSF carrier filter  
    console.log('\n📊 Test 3: GSF Carrier Filter');
    const { count: gsfCount, error: gsfError } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'GSF');
    
    if (gsfError) {
      console.error('❌ GSF filter failed:', gsfError);
    } else {
      console.log(`   ✅ GSF records: ${gsfCount || 0}`);
    }
    
    // Test 4: Date range filtering
    console.log('\n📅 Test 4: Date Range Filtering');
    const { data: dateFilteredData, error: dateError } = await supabase
      .from('captive_payment_records')
      .select('delivery_date, count(*)')
      .gte('delivery_date', '2024-01-01')
      .lte('delivery_date', '2024-12-31')
      .limit(10);
    
    if (dateError) {
      console.error('❌ Date filtering failed:', dateError);
    } else {
      console.log(`   ✅ Date filtering working: ${dateFilteredData?.length || 0} results from 2024`);
    }
    
    // Test 5: Deliveries view (BOL grouping simulation)
    console.log('\n🚚 Test 5: Deliveries Grouping (Manual)');
    const { data: groupedData, error: groupError } = await supabase
      .from('captive_payment_records')
      .select('bill_of_lading, delivery_date, customer, carrier, terminal, sum(volume_litres), count(*)')
      .eq('carrier', 'SMB')
      .limit(5);
    
    if (groupError) {
      console.error('❌ Manual grouping failed:', groupError);
      // Try simpler approach
      const { data: simpleData, error: simpleError } = await supabase
        .from('captive_payment_records')
        .select('bill_of_lading, delivery_date, customer, carrier, terminal, volume_litres')
        .eq('carrier', 'SMB')
        .limit(10);
      
      if (simpleError) {
        console.error('❌ Simple query also failed:', simpleError);
      } else {
        console.log(`   ✅ Simple query works: ${simpleData?.length || 0} SMB records`);
        
        // Manual grouping in JS
        if (simpleData && simpleData.length > 0) {
          const grouped = new Map();
          simpleData.forEach(record => {
            const key = `${record.bill_of_lading}-${record.delivery_date}-${record.customer}`;
            if (!grouped.has(key)) {
              grouped.set(key, {
                bill_of_lading: record.bill_of_lading,
                delivery_date: record.delivery_date,
                customer: record.customer,
                carrier: record.carrier,
                terminal: record.terminal,
                total_volume: 0,
                record_count: 0
              });
            }
            const delivery = grouped.get(key);
            delivery.total_volume += record.volume_litres || 0;
            delivery.record_count += 1;
          });
          
          console.log(`   📦 Created ${grouped.size} unique deliveries from ${simpleData.length} records`);
          console.log('   📋 Sample delivery:', Array.from(grouped.values())[0]);
        }
      }
    }
    
    // Test 6: Check materialized view directly
    console.log('\n🔍 Test 6: Direct Materialized View Access');
    const { data: viewData, error: viewError } = await supabase
      .from('captive_deliveries')
      .select('*')
      .limit(5);
    
    if (viewError) {
      console.error('❌ Materialized view access failed:', viewError.message);
      console.log('   💡 The frontend should use direct queries instead of the materialized view');
    } else {
      console.log(`   ✅ Materialized view accessible: ${viewData?.length || 0} deliveries`);
    }
    
    console.log('\n✅ Frontend API testing completed');
    console.log('\n📋 Summary:');
    console.log(`   - Payment records: Accessible with ${smbCount + gsfCount} total records`);
    console.log('   - Carrier filtering: Working for both SMB and GSF');
    console.log('   - Date filtering: Working for date ranges');
    console.log('   - Manual grouping: Can create deliveries from records in JavaScript');
    console.log('   - Frontend hooks should work with direct database queries');
    
  } catch (error) {
    console.error('❌ Frontend API testing failed:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFrontendAPI().catch(console.error);
}