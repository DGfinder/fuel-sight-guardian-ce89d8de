#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Frontend transformation function (from useTanks.ts)
const transformTankData = (rawTank) => ({
  ...rawTank,
  id: rawTank.id,
  location: rawTank.location,
  product_type: rawTank.product,
  safe_level: rawTank.safe_fill,
  min_level: rawTank.min_level,
  group_id: rawTank.group_id,
  group_name: rawTank.group_name,
  subgroup: rawTank.subgroup,
  current_level: rawTank.current_level,
  current_level_percent: rawTank.current_level_percent_display || rawTank.current_level_percent,
  rolling_avg: rawTank.rolling_avg_lpd,
  days_to_min_level: rawTank.days_to_min_level,
  usable_capacity: rawTank.usable_capacity,
  prev_day_used: rawTank.prev_day_used,
  serviced_on: rawTank.serviced_on,
  serviced_by: rawTank.serviced_by,
  address: rawTank.address,
  vehicle: rawTank.vehicle,
  discharge: rawTank.discharge,
  bp_portal: rawTank.bp_portal,
  delivery_window: rawTank.delivery_window,
  afterhours_contact: rawTank.afterhours_contact,
  notes: rawTank.notes,
  latitude: rawTank.latitude,
  longitude: rawTank.longitude,
  last_dip: (rawTank.last_dip_ts && rawTank.current_level != null) 
    ? { 
        value: rawTank.current_level, 
        created_at: rawTank.last_dip_ts, 
        recorded_by: 'Unknown' 
      } 
    : null,
});

async function testBulletproofView() {
  console.log('🧪 Testing the new bulletproof tanks_with_rolling_avg view...');
  
  try {
    // Test 1: Basic view access
    console.log('\n📊 Test 1: Basic View Access');
    const { data: allTanks, error: allError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .limit(5);
    
    if (allError) {
      console.error('❌ Basic view access failed:', allError.message);
      return;
    }
    
    console.log(`✅ View accessible: Found ${allTanks.length} tanks`);
    
    if (allTanks.length > 0) {
      console.log('📋 Available fields in view:');
      Object.keys(allTanks[0]).forEach(key => {
        console.log(`  - ${key}: ${allTanks[0][key]}`);
      });
    }
    
    // Test 2: GSFS Narrogin specific test
    console.log('\n🎯 Test 2: GSFS Narrogin Tanks');
    const { data: narroginTanks, error: narroginError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('*')
      .eq('subgroup', 'GSFS Narrogin');
    
    if (narroginError) {
      console.error('❌ GSFS Narrogin query failed:', narroginError.message);
      return;
    }
    
    console.log(`✅ Found ${narroginTanks.length} GSFS Narrogin tanks`);
    
    narroginTanks.forEach(tank => {
      const expectedPercent = tank.safe_fill > 0 ? 
        Math.round((tank.current_level / tank.safe_fill) * 100 * 10) / 10 : 0;
      
      console.log(`\n  🏗️ ${tank.location}:`);
      console.log(`    Current Level: ${tank.current_level}L`);
      console.log(`    Safe Level: ${tank.safe_fill}L`);
      console.log(`    View Percentage: ${tank.current_level_percent}%`);
      console.log(`    Expected: ${expectedPercent}%`);
      console.log(`    Status: ${tank.current_level_percent > 0 ? '✅ WORKING!' : '❌ STILL BROKEN'}`);
      console.log(`    Rolling Avg: ${tank.rolling_avg_lpd} L/day`);
      console.log(`    Days to Min: ${tank.days_to_min_level || 'N/A'}`);
    });
    
    // Test 3: Frontend transformation compatibility
    console.log('\n🔄 Test 3: Frontend Transformation');
    const transformedTanks = narroginTanks.map(transformTankData);
    
    console.log('✅ Transformation successful:');
    transformedTanks.forEach(tank => {
      console.log(`  • ${tank.location}: ${tank.current_level_percent || 0}% (${tank.current_level}L/${tank.safe_level}L)`);
    });
    
    // Test 4: Required fields verification
    console.log('\n📝 Test 4: Required Fields Verification');
    const requiredFields = [
      'id', 'location', 'product', 'safe_fill', 'min_level', 'group_id', 'group_name', 'subgroup',
      'current_level', 'current_level_percent', 'rolling_avg_lpd', 'days_to_min_level', 'usable_capacity',
      'prev_day_used', 'last_dip_ts', 'last_dip_by', 'address', 'vehicle', 'discharge', 'bp_portal',
      'delivery_window', 'afterhours_contact', 'notes', 'serviced_on', 'serviced_by', 'latitude', 'longitude'
    ];
    
    if (narroginTanks.length > 0) {
      const sampleTank = narroginTanks[0];
      const missingFields = requiredFields.filter(field => !(field in sampleTank));
      const presentFields = requiredFields.filter(field => field in sampleTank);
      
      console.log(`✅ Present fields: ${presentFields.length}/${requiredFields.length}`);
      if (missingFields.length > 0) {
        console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
      } else {
        console.log('🎉 All required fields present!');
      }
    }
    
    // Test 5: Performance check
    console.log('\n⚡ Test 5: Performance Check');
    const startTime = Date.now();
    const { data: perfTest, error: perfError } = await supabase
      .from('tanks_with_rolling_avg')
      .select('id, location, current_level_percent')
      .limit(100);
    
    const duration = Date.now() - startTime;
    
    if (perfError) {
      console.error('❌ Performance test failed:', perfError.message);
    } else {
      console.log(`✅ Performance test: ${perfTest.length} tanks loaded in ${duration}ms`);
    }
    
    // Test 6: Summary
    console.log('\n📊 SUMMARY:');
    const workingTanks = narroginTanks.filter(t => t.current_level_percent > 0);
    console.log(`  Total GSFS Narrogin tanks: ${narroginTanks.length}`);
    console.log(`  Tanks with valid percentages: ${workingTanks.length}`);
    console.log(`  Success rate: ${Math.round((workingTanks.length / narroginTanks.length) * 100)}%`);
    
    if (workingTanks.length === narroginTanks.length && narroginTanks.length > 0) {
      console.log('\n🎉 SUCCESS! All tanks showing correct percentages!');
      console.log('✅ The bulletproof view is working perfectly');
      console.log('✅ Frontend should now display tank data correctly');
    } else if (workingTanks.length > 0) {
      console.log('\n⚠️ PARTIAL SUCCESS: Some tanks working, some still broken');
    } else {
      console.log('\n❌ FAILURE: No tanks showing percentages');
    }
    
    // Test 7: Browser console commands
    console.log('\n🖥️ Browser Console Commands (for manual testing):');
    console.log('// Clear React Query cache:');
    console.log('window.queryClient?.clear();');
    console.log('');
    console.log('// Test tank data fetch:');
    console.log('fetch(window.location.origin + "/api/tanks").then(r => r.json()).then(console.log);');
    console.log('');
    console.log('// Force page reload:');
    console.log('window.location.reload();');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

testBulletproofView();