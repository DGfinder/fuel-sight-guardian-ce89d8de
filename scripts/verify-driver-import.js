#!/usr/bin/env node

/**
 * Driver Import Verification Script
 * 
 * Verifies that the driver import was successful by checking database records
 * Usage: node scripts/verify-driver-import.js
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

console.log('🔍 Driver Import Verification');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

async function verifyDriverImport() {
  try {
    // Check driver count
    console.log('📊 Checking driver records...');
    const { data: drivers, error: driverError } = await supabase
      .from('drivers')
      .select('id, full_name, fleet, depot, created_at')
      .order('created_at', { ascending: false })
      .limit(150);
    
    if (driverError) {
      throw new Error(`Failed to fetch drivers: ${driverError.message}`);
    }
    
    console.log(`✅ Found ${drivers.length} drivers in database`);
    
    // Show recent imports (likely from our script)
    const recentDrivers = drivers.filter(d => {
      const createdAt = new Date(d.created_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return createdAt > oneHourAgo;
    });
    
    console.log(`📅 Recent imports (last hour): ${recentDrivers.length} drivers`);
    
    if (recentDrivers.length > 0) {
      console.log('📋 Recent driver samples:');
      recentDrivers.slice(0, 5).forEach(driver => {
        console.log(`   • ${driver.full_name} (${driver.fleet}, ${driver.depot})`);
      });
      if (recentDrivers.length > 5) {
        console.log(`   ...and ${recentDrivers.length - 5} more`);
      }
    }
    
    // Check fleet distribution
    const fleetCounts = drivers.reduce((acc, driver) => {
      acc[driver.fleet] = (acc[driver.fleet] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Fleet distribution:');
    Object.entries(fleetCounts).forEach(([fleet, count]) => {
      console.log(`   ${fleet}: ${count} drivers`);
    });
    
    // Check depot distribution  
    const depotCounts = drivers.reduce((acc, driver) => {
      acc[driver.depot] = (acc[driver.depot] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📍 Depot distribution:');
    Object.entries(depotCounts).forEach(([depot, count]) => {
      console.log(`   ${depot}: ${count} drivers`);
    });
    
    console.log('');
    
    // Check name mappings
    console.log('🔗 Checking name mappings...');
    const { data: mappings, error: mappingError } = await supabase
      .from('driver_name_mappings')
      .select('id, driver_id, system_name, mapped_name, is_primary, confidence_score, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (mappingError) {
      throw new Error(`Failed to fetch mappings: ${mappingError.message}`);
    }
    
    console.log(`✅ Found ${mappings.length} name mappings in database`);
    
    // Show recent mappings
    const recentMappings = mappings.filter(m => {
      const createdAt = new Date(m.created_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return createdAt > oneHourAgo;
    });
    
    console.log(`📅 Recent mappings (last hour): ${recentMappings.length} mappings`);
    
    // Show system distribution
    const systemCounts = mappings.reduce((acc, mapping) => {
      acc[mapping.system_name] = (acc[mapping.system_name] || 0) + 1;
      return acc;
    }, {});
    
    console.log('🔧 System name distribution:');
    Object.entries(systemCounts).forEach(([system, count]) => {
      console.log(`   ${system}: ${count} mappings`);
    });
    
    console.log('');
    
    // Test driver correlation capability
    console.log('🔍 Testing driver correlation...');
    
    // Pick a few sample drivers and show their name mappings
    const sampleDrivers = drivers.slice(0, 3);
    
    for (const driver of sampleDrivers) {
      const driverMappings = mappings.filter(m => m.driver_id === driver.id);
      console.log(`👤 ${driver.full_name}:`);
      driverMappings.forEach(mapping => {
        const primary = mapping.is_primary ? '(PRIMARY)' : '';
        console.log(`   ${mapping.system_name}: "${mapping.mapped_name}" ${primary}`);
      });
      console.log('');
    }
    
    console.log('✅ Driver import verification completed successfully!');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   • Drivers can now be matched to trip data via name mappings');
    console.log('   • Safety events can be correlated to specific drivers');
    console.log('   • Vehicle assignments can reference driver IDs');
    console.log('   • Performance analytics can track driver metrics');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyDriverImport();