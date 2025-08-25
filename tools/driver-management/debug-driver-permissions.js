#!/usr/bin/env node
/**
 * Debug Driver Permissions Tool
 * Professional tool for diagnosing RLS and permission issues with driver records
 * 
 * Usage:
 *   node tools/driver-management/debug-driver-permissions.js --driver-id "uuid"
 *   node tools/driver-management/debug-driver-permissions.js --driver-name "John Smith"
 *   node tools/driver-management/debug-driver-permissions.js --test-rls
 *   node tools/driver-management/debug-driver-permissions.js --help
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.findIndex(arg => arg === `--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const driverName = getArg('driver-name');
const driverId = getArg('driver-id');
const testRls = args.includes('--test-rls');
const help = args.includes('--help');

if (help) {
  console.log(`
🔍 Debug Driver Permissions Tool

DESCRIPTION:
  Diagnoses RLS policy and permission issues that prevent frontend access to driver records.
  Tests both service role and anonymous access patterns.

USAGE:
  node tools/driver-management/debug-driver-permissions.js [OPTIONS]

OPTIONS:
  --driver-id "uuid"           Test specific driver by ID
  --driver-name "First Last"   Test specific driver by name
  --test-rls                   Test general RLS policies
  --help                       Show this help message

EXAMPLES:
  # Test specific driver permissions
  node tools/driver-management/debug-driver-permissions.js --driver-id "123e4567-e89b-12d3-a456-426614174000"
  
  # Test driver by name
  node tools/driver-management/debug-driver-permissions.js --driver-name "John Smith"
  
  # General RLS policy testing
  node tools/driver-management/debug-driver-permissions.js --test-rls
`);
  process.exit(0);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables');
  console.log('💡 Ensure SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

console.log('🔍 Debug Driver Permissions Tool');
console.log(`🔗 Supabase URL: ${supabaseUrl}`);

async function debugDriverPermissions() {
  try {
    let targetDriverId = driverId;

    // If searching by name, find the driver ID first
    if (driverName && !driverId) {
      console.log(`\n🔍 Finding driver by name: "${driverName}"`);
      
      const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const nameParts = driverName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';
      
      const { data: foundDrivers, error } = await serviceSupabase
        .from('drivers')
        .select('id, first_name, last_name, fleet')
        .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%`);

      if (error) {
        console.error('❌ Error finding driver:', error);
        return;
      }

      if (foundDrivers.length === 0) {
        console.log('❌ No drivers found with that name');
        return;
      }

      if (foundDrivers.length > 1) {
        console.log('⚠️ Multiple drivers found:');
        foundDrivers.forEach((driver, index) => {
          console.log(`   ${index + 1}. ${driver.first_name} ${driver.last_name} (${driver.fleet}) - ID: ${driver.id}`);
        });
        console.log('💡 Please use --driver-id with specific ID for precise testing');
        targetDriverId = foundDrivers[0].id; // Use first match
      } else {
        targetDriverId = foundDrivers[0].id;
      }
      
      console.log(`✅ Using driver ID: ${targetDriverId}`);
    }

    if (testRls || !targetDriverId) {
      await testGeneralRlsPolicies();
    }

    if (targetDriverId) {
      await testSpecificDriverAccess(targetDriverId);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

async function testGeneralRlsPolicies() {
  console.log('\n🔐 Testing General RLS Policies');

  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
  const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

  // Test service role access
  console.log('\n🔧 Service Role Test:');
  const { data: serviceData, error: serviceError, count: serviceCount } = await serviceSupabase
    .from('drivers')
    .select('id, first_name, last_name', { count: 'exact' })
    .limit(3);

  if (serviceError) {
    console.error('❌ Service role failed:', serviceError);
  } else {
    console.log(`✅ Service role can access ${serviceCount} drivers`);
    serviceData.forEach(driver => {
      console.log(`   • ${driver.first_name} ${driver.last_name} (ID: ${driver.id})`);
    });
  }

  // Test anonymous role access
  console.log('\n🌐 Anonymous Role Test:');
  const { data: anonData, error: anonError, count: anonCount } = await anonSupabase
    .from('drivers')
    .select('id, first_name, last_name', { count: 'exact' })
    .limit(3);

  if (anonError) {
    console.error('❌ Anonymous role failed:', anonError);
    
    if (anonError.code === '42501') {
      console.log('   🔒 RLS Policy is blocking anonymous access entirely');
    } else if (anonError.code === 'PGRST116' || anonCount === 0) {
      console.log('   📭 RLS is filtering out all records for anonymous users');
    }
  } else {
    console.log(`✅ Anonymous role can access ${anonCount} drivers`);
    anonData.forEach(driver => {
      console.log(`   • ${driver.first_name} ${driver.last_name} (ID: ${driver.id})`);
    });
  }

  // Summary of general RLS status
  console.log('\n📊 RLS Policy Summary:');
  const serviceWorking = serviceData && serviceCount > 0;
  const anonWorking = anonData && anonCount > 0;
  
  if (serviceWorking && anonWorking) {
    console.log('✅ Both service and anonymous roles have access - RLS configured correctly');
  } else if (serviceWorking && !anonWorking) {
    console.log('⚠️ Service role works but anonymous blocked - RLS policy needs adjustment');
    console.log('   💡 Frontend will fail because it uses anonymous role');
  } else if (!serviceWorking) {
    console.log('❌ Service role blocked - fundamental database issue');
  }
}

async function testSpecificDriverAccess(driverId) {
  console.log(`\n👤 Testing Specific Driver Access: ${driverId}`);

  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
  const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

  // Service role test
  console.log('\n🔧 Service Role Query:');
  const { data: serviceData, error: serviceError } = await serviceSupabase
    .from('drivers')
    .select('id, first_name, last_name, fleet, depot, status, created_at')
    .eq('id', driverId)
    .single();

  if (serviceError) {
    console.error('❌ Service role error:', serviceError);
    
    if (serviceError.code === 'PGRST116') {
      console.log('   📭 Driver record does not exist');
      return;
    }
  } else {
    console.log('✅ Service role can see driver:');
    console.log(`   • Name: ${serviceData.first_name} ${serviceData.last_name}`);
    console.log(`   • Fleet: ${serviceData.fleet}`);
    console.log(`   • Depot: ${serviceData.depot}`);
    console.log(`   • Status: ${serviceData.status}`);
    console.log(`   • Created: ${serviceData.created_at}`);
  }

  // Anonymous role test
  console.log('\n🌐 Anonymous Role Query:');
  const { data: anonData, error: anonError } = await anonSupabase
    .from('drivers')
    .select('id, first_name, last_name, fleet, depot, status')
    .eq('id', driverId)
    .single();

  if (anonError) {
    console.error('❌ Anonymous role error:', anonError);
    
    if (anonError.code === '42501') {
      console.log('   🔒 RLS Policy is blocking anonymous access');
    } else if (anonError.code === 'PGRST116') {
      console.log('   📭 Driver not visible to anonymous users (RLS filtering)');
    }
  } else {
    console.log('✅ Anonymous role can see driver:');
    console.log(`   • Name: ${anonData.first_name} ${anonData.last_name}`);
    console.log(`   • Fleet: ${anonData.fleet}`);
  }

  // Test search functionality (what driver management uses)
  console.log('\n🔍 Driver Search Test:');
  if (serviceData) {
    const { data: searchData, error: searchError } = await anonSupabase
      .from('drivers')
      .select('id, first_name, last_name, fleet')
      .or(`first_name.ilike.%${serviceData.first_name}%,last_name.ilike.%${serviceData.last_name}%`);

    if (searchError) {
      console.error('❌ Search failed:', searchError);
    } else {
      console.log(`✅ Search found ${searchData.length} driver(s):`);
      searchData.forEach(driver => {
        console.log(`   • ${driver.first_name} ${driver.last_name} (${driver.fleet})`);
      });
    }
  }

  // Test LYTX events linkage
  console.log('\n🛡️ LYTX Events Access Test:');
  const { count: eventCount, error: eventError } = await anonSupabase
    .from('lytx_safety_events')
    .select('*', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .gte('event_datetime', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (eventError) {
    console.error('❌ LYTX events access failed:', eventError);
  } else {
    console.log(`✅ Found ${eventCount} linked LYTX events (last 30 days)`);
  }

  // Final diagnosis
  console.log('\n🎯 DIAGNOSIS:');
  if (serviceData && anonData) {
    console.log('✅ WORKING: Driver accessible by both service and anonymous roles');
    console.log('   The driver modal should work correctly');
  } else if (serviceData && !anonData) {
    console.log('⚠️ ISSUE: Driver exists but not accessible to anonymous users');
    console.log('   The driver modal will fail to load');
    console.log('   SOLUTION: Fix RLS policies for anonymous access');
  } else if (!serviceData) {
    console.log('❌ CRITICAL: Driver record does not exist or database issue');
    console.log('   SOLUTION: Create the missing driver record first');
  }
}

debugDriverPermissions();