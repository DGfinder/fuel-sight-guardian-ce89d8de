#!/usr/bin/env node
/**
 * Create Driver Record - Admin Tool
 * Professional tool for creating missing driver records using service role
 * 
 * Usage:
 *   node tools/driver-management/create-driver-record-admin.js --name "John Smith" --fleet "GSF" --depot "Perth"
 *   node tools/driver-management/create-driver-record-admin.js --driver-id "uuid" --name "John Smith" --fleet "GSF"
 *   node tools/driver-management/create-driver-record-admin.js --help
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

const driverName = getArg('name');
const driverId = getArg('driver-id');
const fleet = getArg('fleet');
const depot = getArg('depot');
const employeeId = getArg('employee-id');
const status = getArg('status') || 'Active';
const help = args.includes('--help');

if (help || !driverName || !fleet) {
  console.log(`
🔧 Create Driver Record - Admin Tool

DESCRIPTION:
  Creates missing driver records using service role to bypass RLS policies.
  Useful when LYTX events exist but driver record is missing.

USAGE:
  node tools/driver-management/create-driver-record-admin.js [OPTIONS]

REQUIRED OPTIONS:
  --name "First Last"          Driver's full name
  --fleet "Fleet Name"         Fleet name (e.g., "Great Southern Fuels", "Stevemacs")

OPTIONAL OPTIONS:
  --driver-id "uuid"           Specific driver ID to use (if known from LYTX events)
  --depot "Depot Name"         Depot location
  --employee-id "EMP123"       Employee ID number
  --status "Status"            Driver status (default: "Active")
  --help                       Show this help message

EXAMPLES:
  # Create basic driver record
  node tools/driver-management/create-driver-record-admin.js --name "John Smith" --fleet "Great Southern Fuels" --depot "Perth"
  
  # Create record with known ID from LYTX events
  node tools/driver-management/create-driver-record-admin.js --driver-id "123e4567-e89b-12d3-a456-426614174000" --name "John Smith" --fleet "GSF"
  
  # Create with all details
  node tools/driver-management/create-driver-record-admin.js --name "Jane Doe" --fleet "Stevemacs" --depot "Kewdale" --employee-id "EMP456" --status "Active"
`);
  process.exit(0);
}

// Initialize Supabase with service role
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  console.log('💡 This key is required for admin operations to bypass RLS policies');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔧 Create Driver Record - Admin Tool');
console.log(`🔗 Supabase URL: ${supabaseUrl}`);

async function createDriverRecord() {
  try {
    // Parse name into first and last
    const nameParts = driverName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (!firstName || !lastName) {
      console.error('❌ Please provide both first and last name (e.g., --name "John Smith")');
      return;
    }

    console.log(`\n👤 Creating driver record for: ${firstName} ${lastName}`);
    console.log(`🏢 Fleet: ${fleet}`);
    if (depot) console.log(`📍 Depot: ${depot}`);
    if (driverId) console.log(`🆔 Using specific ID: ${driverId}`);

    // Check if driver already exists (by ID if provided, otherwise by name)
    let existingDriver = null;
    
    if (driverId) {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name')
        .eq('id', driverId)
        .single();
      
      if (!error) {
        existingDriver = data;
      }
    } else {
      // Check by name
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name')
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .eq('fleet', fleet);
      
      if (!error && data.length > 0) {
        existingDriver = data[0];
      }
    }

    if (existingDriver) {
      console.log(`✅ Driver record already exists: ${existingDriver.first_name} ${existingDriver.last_name} (ID: ${existingDriver.id})`);
      console.log('   No action needed!');
      return;
    }

    console.log('✅ Confirmed: Driver record does not exist');

    // Create the driver record
    const driverData = {
      first_name: firstName,
      last_name: lastName,
      fleet: fleet,
      depot: depot || null,
      status: status,
      employee_id: employeeId || null,
      safety_score: 0,
      lytx_score: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add ID if specifically provided
    if (driverId) {
      driverData.id = driverId;
    }

    const { data: newDriver, error: insertError } = await supabase
      .from('drivers')
      .insert(driverData)
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error creating driver record:', insertError);
      return;
    }

    console.log('\n🎉 Driver record created successfully!');
    console.log(`   • ID: ${newDriver.id}`);
    console.log(`   • Name: ${newDriver.first_name} ${newDriver.last_name}`);
    console.log(`   • Fleet: ${newDriver.fleet}`);
    console.log(`   • Depot: ${newDriver.depot || 'Not specified'}`);
    console.log(`   • Status: ${newDriver.status}`);
    console.log(`   • Employee ID: ${newDriver.employee_id || 'Not specified'}`);

    // Test frontend accessibility
    console.log('\n🧪 Testing frontend accessibility...');
    const anonSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);
    
    const { data: testDriver, error: testError } = await anonSupabase
      .from('drivers')
      .select('id, first_name, last_name, fleet, depot, status')
      .eq('id', newDriver.id)
      .single();

    if (testError) {
      console.error('❌ Frontend accessibility test failed:', testError.message);
      console.log('⚠️ The driver record exists but may not be accessible from the frontend due to RLS policies');
    } else {
      console.log('✅ Frontend accessibility test passed!');
      console.log('   The driver modal should work properly for this driver');
    }

    // Check for existing LYTX events if ID was provided
    if (driverId) {
      console.log('\n🛡️ Checking for existing LYTX events...');
      const { count: eventCount, error: countError } = await supabase
        .from('lytx_safety_events')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driverId)
        .gte('event_datetime', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (countError) {
        console.error('❌ Error checking LYTX events:', countError);
      } else {
        console.log(`✅ Found ${eventCount} LYTX events linked to this driver (last 30 days)`);
        if (eventCount > 0) {
          console.log('   These events should now display properly in the driver modal');
        }
      }
    }

    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Test the driver modal in the application');
    console.log('   2. Verify all driver data displays correctly');
    console.log('   3. Check LYTX events are properly linked and visible');
    if (testError) {
      console.log('   4. Fix RLS policies to allow frontend access');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createDriverRecord();