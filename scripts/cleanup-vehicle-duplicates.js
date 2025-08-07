#!/usr/bin/env node

/**
 * Conservative Vehicle Duplicate Cleanup Script
 * 
 * Only removes vehicles that are EXACT matches after normalization
 * (formatting differences only, not sequential numbers)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeRegistration } from '../utils/registrationNormalizer.js';

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

console.log('🧹 Conservative Vehicle Duplicate Cleanup Script');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Find exact registration duplicates (format differences only)
 */
async function findExactDuplicates() {
  console.log('📊 Fetching all vehicles from database...');
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('registration');
  
  if (error) {
    throw new Error(`Failed to fetch vehicles: ${error.message}`);
  }
  
  console.log(`📋 Found ${vehicles.length} vehicles in database`);
  
  // Group vehicles by normalized registration
  const normalizedGroups = new Map();
  
  vehicles.forEach(vehicle => {
    const normalized = normalizeRegistration(vehicle.registration);
    
    if (!normalizedGroups.has(normalized)) {
      normalizedGroups.set(normalized, []);
    }
    normalizedGroups.get(normalized).push(vehicle);
  });
  
  // Find groups with multiple vehicles (exact duplicates)
  const exactDuplicateGroups = Array.from(normalizedGroups.entries())
    .filter(([normalized, vehicles]) => vehicles.length > 1)
    .map(([normalized, vehicles]) => ({
      normalized,
      vehicles,
      count: vehicles.length
    }));
  
  console.log(`🔍 Found ${exactDuplicateGroups.length} groups with exact duplicates:`);
  console.log('');
  
  exactDuplicateGroups.forEach(group => {
    console.log(`   Normalized: "${group.normalized}" (${group.count} vehicles)`);
    group.vehicles.forEach(vehicle => {
      console.log(`      "${vehicle.registration}" - ${vehicle.fleet} - ID: ${vehicle.id}`);
    });
    console.log('');
  });
  
  return exactDuplicateGroups;
}

/**
 * Clean up exact duplicates by keeping the first vehicle and removing others
 */
async function cleanupExactDuplicates(duplicateGroups) {
  console.log('🧹 Starting cleanup of exact duplicates...');
  console.log('   Strategy: Keep first vehicle in each group, remove others');
  console.log('');
  
  let totalRemoved = 0;
  let totalKept = duplicateGroups.length;
  
  for (const group of duplicateGroups) {
    const keepVehicle = group.vehicles[0]; // Keep first one
    const removeVehicles = group.vehicles.slice(1); // Remove others
    
    console.log(`🔄 Processing group: ${group.normalized}`);
    console.log(`   ✅ Keeping: "${keepVehicle.registration}" (ID: ${keepVehicle.id})`);
    
    for (const vehicle of removeVehicles) {
      console.log(`   🗑️  Removing: "${vehicle.registration}" (ID: ${vehicle.id})`);
      
      try {
        // First, update any guardian_events that reference this vehicle
        const { error: updateError } = await supabase
          .from('guardian_events')
          .update({ 
            vehicle_registration: keepVehicle.registration,
            fleet: keepVehicle.fleet 
          })
          .eq('vehicle_registration', vehicle.registration);
        
        if (updateError) {
          console.warn(`     ⚠️  Failed to update Guardian events: ${updateError.message}`);
        } else {
          console.log(`     ✅ Updated Guardian events to reference kept vehicle`);
        }
        
        // Then remove the duplicate vehicle
        const { error: deleteError } = await supabase
          .from('vehicles')
          .delete()
          .eq('id', vehicle.id);
        
        if (deleteError) {
          console.error(`     ❌ Failed to delete vehicle: ${deleteError.message}`);
        } else {
          console.log(`     ✅ Vehicle deleted successfully`);
          totalRemoved++;
        }
        
      } catch (error) {
        console.error(`     ❌ Error processing vehicle ${vehicle.id}: ${error.message}`);
      }
    }
    
    console.log('');
  }
  
  console.log('🎉 Cleanup completed!');
  console.log(`   Vehicles kept: ${totalKept}`);
  console.log(`   Vehicles removed: ${totalRemoved}`);
  console.log(`   Final count should be: ${229 - totalRemoved} vehicles`);
  
  return { kept: totalKept, removed: totalRemoved };
}

/**
 * Verify the cleanup results
 */
async function verifyCleanup() {
  console.log('');
  console.log('🔍 Verifying cleanup results...');
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('registration');
  
  if (error) {
    console.error(`❌ Failed to verify: ${error.message}`);
    return;
  }
  
  console.log(`📊 Final vehicle count: ${vehicles.length}`);
  
  // Check for remaining duplicates
  const normalizedGroups = new Map();
  vehicles.forEach(vehicle => {
    const normalized = normalizeRegistration(vehicle.registration);
    if (!normalizedGroups.has(normalized)) {
      normalizedGroups.set(normalized, []);
    }
    normalizedGroups.get(normalized).push(vehicle);
  });
  
  const remainingDuplicates = Array.from(normalizedGroups.entries())
    .filter(([normalized, vehicles]) => vehicles.length > 1);
  
  if (remainingDuplicates.length === 0) {
    console.log('✅ No remaining exact duplicates found');
  } else {
    console.log(`⚠️  ${remainingDuplicates.length} groups still have duplicates:`);
    remainingDuplicates.forEach(([normalized, vehicles]) => {
      console.log(`   ${normalized}: ${vehicles.map(v => v.registration).join(', ')}`);
    });
  }
  
  // Show final fleet distribution
  const fleetCounts = vehicles.reduce((acc, vehicle) => {
    acc[vehicle.fleet] = (acc[vehicle.fleet] || 0) + 1;
    return acc;
  }, {});
  
  console.log('');
  console.log('📊 Final fleet distribution:');
  Object.entries(fleetCounts).forEach(([fleet, count]) => {
    console.log(`   ${fleet}: ${count} vehicles`);
  });
  
  const totalAfterCleanup = vehicles.length;
  if (totalAfterCleanup <= 150) {
    console.log('');
    console.log('🎯 SUCCESS: Vehicle count now aligns with expected ~147 from CSV!');
  } else {
    console.log('');
    console.log(`ℹ️  Vehicle count (${totalAfterCleanup}) still higher than expected 147`);
    console.log('   This may indicate the original CSV had more vehicles than initially counted');
    console.log('   or there are legitimate additional vehicles in the database');
  }
}

/**
 * Main cleanup process
 */
async function cleanupVehicleDuplicates() {
  try {
    const duplicateGroups = await findExactDuplicates();
    
    if (duplicateGroups.length === 0) {
      console.log('✅ No exact duplicates found. Database is already clean!');
      return;
    }
    
    console.log(`💡 Found ${duplicateGroups.length} groups with exact formatting duplicates`);
    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + (group.count - 1), 0);
    console.log(`   This will remove ${totalDuplicates} duplicate vehicles`);
    console.log(`   Final count will be: ${229 - totalDuplicates} vehicles`);
    console.log('');
    
    console.log('🚀 Proceeding with cleanup...');
    console.log('');
    
    const results = await cleanupExactDuplicates(duplicateGroups);
    await verifyCleanup();
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupVehicleDuplicates();