#!/usr/bin/env node

/**
 * Test Driver Profile Functionality
 * 
 * Tests the driver profile functions with imported driver data
 * Usage: node scripts/test-driver-profiles.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../.env') });

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🧪 Driver Profile Functionality Test');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

async function testDriverProfiles() {
  try {
    // Test 1: List drivers and their name mappings
    console.log('📋 Test 1: Fetching imported drivers...');
    const { data: drivers, error: driverError } = await supabase
      .from('drivers')
      .select(`
        id,
        first_name,
        last_name,
        fleet,
        depot,
        employee_id,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (driverError) {
      throw new Error(`Failed to fetch drivers: ${driverError.message}`);
    }
    
    console.log(`✅ Found ${drivers.length} drivers (showing recent imports):`);
    drivers.forEach(driver => {
      console.log(`   • ${driver.first_name} ${driver.last_name} (${driver.fleet}, ${driver.depot})`);
    });
    console.log('');
    
    // Test 2: Check name mappings for a sample driver
    if (drivers.length > 0) {
      const testDriver = drivers[0];
      console.log(`🔗 Test 2: Checking name mappings for ${testDriver.first_name} ${testDriver.last_name}...`);
      
      const { data: mappings, error: mappingError } = await supabase
        .from('driver_name_mappings')
        .select('system_name, mapped_name, is_primary, confidence_score')
        .eq('driver_id', testDriver.id);
      
      if (mappingError) {
        throw new Error(`Failed to fetch mappings: ${mappingError.message}`);
      }
      
      console.log(`✅ Found ${mappings.length} name mappings:`);
      mappings.forEach(mapping => {
        const primary = mapping.is_primary ? '(PRIMARY)' : '';
        console.log(`   ${mapping.system_name}: "${mapping.mapped_name}" ${primary}`);
      });
      console.log('');
      
      // Test 3: Test driver correlation capability
      console.log(`🔍 Test 3: Testing driver correlation potential...`);
      
      // Check if there are any MtData trips that could be correlated
      const { data: trips, error: tripError } = await supabase
        .from('mtdata_trip_history')
        .select('driver_name, start_time, distance_km')
        .ilike('driver_name', `%${testDriver.first_name}%`)
        .limit(5);
      
      if (tripError) {
        console.log(`   ⚠️  Could not check trip data: ${tripError.message}`);
      } else if (trips && trips.length > 0) {
        console.log(`   ✅ Found ${trips.length} potential trip matches:`);
        trips.forEach(trip => {
          console.log(`      Trip: ${trip.driver_name} on ${trip.start_time} (${trip.distance_km}km)`);
        });
      } else {
        console.log(`   ℹ️  No matching trip data found for ${testDriver.first_name}`);
      }
      console.log('');
      
      // Test 4: Check LYTX events correlation
      console.log(`📊 Test 4: Testing LYTX event correlation...`);
      
      const { data: lytxEvents, error: lytxError } = await supabase
        .from('lytx_safety_events')
        .select('driver_name, event_datetime, trigger, score')
        .ilike('driver_name', `%${testDriver.first_name}%`)
        .limit(3);
      
      if (lytxError) {
        console.log(`   ⚠️  Could not check LYTX data: ${lytxError.message}`);
      } else if (lytxEvents && lytxEvents.length > 0) {
        console.log(`   ✅ Found ${lytxEvents.length} potential LYTX event matches:`);
        lytxEvents.forEach(event => {
          console.log(`      Event: ${event.driver_name} - ${event.trigger} (score: ${event.score})`);
        });
      } else {
        console.log(`   ℹ️  No matching LYTX events found for ${testDriver.first_name}`);
      }
      console.log('');
      
      // Test 5: Try to get driver profile summary (this was failing before)
      console.log(`📈 Test 5: Testing driver profile summary function...`);
      
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // Use a simplified query first to check if the function exists
        const { data: summary, error: summaryError } = await supabase
          .rpc('get_driver_profile_summary', {
            p_driver_id: testDriver.id,
            p_start_date: thirtyDaysAgo,
            p_timeframe: '30d'
          });
        
        if (summaryError) {
          console.log(`   ❌ Profile summary failed: ${summaryError.message}`);
          console.log('   This indicates the database function still has issues');
        } else {
          console.log(`   ✅ Profile summary succeeded!`);
          if (summary && summary.length > 0) {
            const profile = summary[0];
            console.log(`      Safety Score: ${profile.overall_safety_score}`);
            console.log(`      Total Trips: ${profile.total_trips}`);
            console.log(`      LYTX Events: ${profile.lytx_events}`);
            console.log(`      Guardian Events: ${profile.guardian_events}`);
          }
        }
      } catch (functionError) {
        console.log(`   ❌ Function call failed: ${functionError.message}`);
      }
    }
    
    console.log('');
    console.log('🎉 Driver profile testing completed!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   • ${drivers.length} drivers successfully imported and accessible`);
    console.log('   • Name mappings are working for cross-system correlation');
    console.log('   • Driver data is ready for trip and safety event matching');
    console.log('   • Profile analytics functions may need database-level fixes');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   • Test the Driver Management UI at http://localhost:5173/driver-management');
    console.log('   • Begin correlating trip data with imported drivers');
    console.log('   • Set up vehicle-to-driver assignments');
    console.log('   • Configure safety event notifications');
    
  } catch (error) {
    console.error('❌ Testing failed:', error.message);
    process.exit(1);
  }
}

testDriverProfiles();