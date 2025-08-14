#!/usr/bin/env node

/**
 * Fix Duplicate Vehicle Registration
 * 
 * Consolidates duplicate vehicle records that differ only in registration formatting
 * (e.g., "1GCE176" vs "1GCE-176"). Preserves the original record with device mappings
 * and updates all trip history links.
 * 
 * Usage: node scripts/fix-duplicate-vehicle.js [original-registration] [duplicate-registration]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Normalize registration for comparison
 */
function normalizeRegistration(registration) {
  if (!registration) return null;
  return registration.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Find vehicles by registration (normalized)
 */
async function findVehiclesByRegistration(registration) {
  const normalized = normalizeRegistration(registration);
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*');
  
  if (error) throw error;
  
  return vehicles.filter(vehicle => 
    normalizeRegistration(vehicle.registration) === normalized
  );
}

/**
 * Get trip history for a vehicle
 */
async function getTripHistory(vehicleId) {
  const { data: trips, error } = await supabase
    .from('mtdata_trip_history')
    .select('id, vehicle_registration, start_time, end_time, distance_km')
    .eq('vehicle_id', vehicleId);
  
  if (error) throw error;
  return trips;
}

/**
 * Get unlinked trips by registration
 */
async function getUnlinkedTripsByRegistration(registration) {
  const normalized = normalizeRegistration(registration);
  
  const { data: allTrips, error } = await supabase
    .from('mtdata_trip_history')
    .select('id, vehicle_registration, vehicle_id, start_time, distance_km');
  
  if (error) throw error;
  
  return allTrips.filter(trip => 
    normalizeRegistration(trip.vehicle_registration) === normalized
  );
}

/**
 * Merge vehicle data from source to target
 */
function mergeVehicleData(targetVehicle, sourceVehicle) {
  const merged = { ...targetVehicle };
  
  // Preserve device mappings from target (original)
  // Update operational data from source if target lacks it
  
  if (!merged.guardian_unit && sourceVehicle.guardian_unit) {
    merged.guardian_unit = sourceVehicle.guardian_unit;
  }
  
  // Update kilometers if source has more recent data
  if (sourceVehicle.total_kilometers > merged.total_kilometers) {
    merged.total_kilometers = sourceVehicle.total_kilometers;
  }
  
  // Update other operational metrics if source has better data
  if (sourceVehicle.safety_score > merged.safety_score) {
    merged.safety_score = sourceVehicle.safety_score;
  }
  
  if (sourceVehicle.fuel_efficiency > merged.fuel_efficiency) {
    merged.fuel_efficiency = sourceVehicle.fuel_efficiency;
  }
  
  if (sourceVehicle.utilization > merged.utilization) {
    merged.utilization = sourceVehicle.utilization;
  }
  
  // Update delivery and event counts
  merged.total_deliveries = Math.max(merged.total_deliveries || 0, sourceVehicle.total_deliveries || 0);
  merged.fatigue_events = Math.max(merged.fatigue_events || 0, sourceVehicle.fatigue_events || 0);
  merged.safety_events = Math.max(merged.safety_events || 0, sourceVehicle.safety_events || 0);
  
  // Keep the more recent service dates
  if (sourceVehicle.last_service && (!merged.last_service || sourceVehicle.last_service > merged.last_service)) {
    merged.last_service = sourceVehicle.last_service;
  }
  
  if (sourceVehicle.next_service && (!merged.next_service || sourceVehicle.next_service < merged.next_service)) {
    merged.next_service = sourceVehicle.next_service;
  }
  
  // Update compliance dates to the most restrictive (earliest expiry)
  if (sourceVehicle.registration_expiry && (!merged.registration_expiry || sourceVehicle.registration_expiry < merged.registration_expiry)) {
    merged.registration_expiry = sourceVehicle.registration_expiry;
  }
  
  if (sourceVehicle.insurance_expiry && (!merged.insurance_expiry || sourceVehicle.insurance_expiry < merged.insurance_expiry)) {
    merged.insurance_expiry = sourceVehicle.insurance_expiry;
  }
  
  if (sourceVehicle.inspection_due && (!merged.inspection_due || sourceVehicle.inspection_due < merged.inspection_due)) {
    merged.inspection_due = sourceVehicle.inspection_due;
  }
  
  return merged;
}

/**
 * Consolidate duplicate vehicles
 */
async function consolidateVehicles(originalRegistration, duplicateRegistration) {
  console.log(`🔄 Consolidating vehicles: "${originalRegistration}" (keep) vs "${duplicateRegistration}" (remove)`);
  
  try {
    // Find both vehicles
    const [originalVehicles, duplicateVehicles] = await Promise.all([
      findVehiclesByRegistration(originalRegistration),
      findVehiclesByRegistration(duplicateRegistration)
    ]);
    
    if (originalVehicles.length === 0) {
      throw new Error(`Original vehicle "${originalRegistration}" not found`);
    }
    
    if (duplicateVehicles.length === 0) {
      throw new Error(`Duplicate vehicle "${duplicateRegistration}" not found`);
    }
    
    // Should have exactly one of each
    if (originalVehicles.length > 1) {
      console.warn(`⚠️ Multiple matches for original registration: ${originalVehicles.length}`);
    }
    
    if (duplicateVehicles.length > 1) {
      console.warn(`⚠️ Multiple matches for duplicate registration: ${duplicateVehicles.length}`);
    }
    
    const originalVehicle = originalVehicles[0];
    const duplicateVehicle = duplicateVehicles[0];
    
    console.log(`\n📋 Vehicle Details:`);
    console.log(`  Original: ${originalVehicle.registration} (ID: ${originalVehicle.id})`);
    console.log(`    Created: ${new Date(originalVehicle.created_at).toLocaleString()}`);
    console.log(`    LYTX: ${originalVehicle.lytx_device || 'None'}`);
    console.log(`    Guardian: ${originalVehicle.guardian_unit || 'None'}`);
    
    console.log(`  Duplicate: ${duplicateVehicle.registration} (ID: ${duplicateVehicle.id})`);
    console.log(`    Created: ${new Date(duplicateVehicle.created_at).toLocaleString()}`);
    console.log(`    LYTX: ${duplicateVehicle.lytx_device || 'None'}`);
    console.log(`    Guardian: ${duplicateVehicle.guardian_unit || 'None'}`);
    
    // Get trip history for both vehicles
    const [originalTrips, duplicateTrips] = await Promise.all([
      getTripHistory(originalVehicle.id),
      getTripHistory(duplicateVehicle.id)
    ]);
    
    console.log(`\n🚛 Trip History:`);
    console.log(`  Original vehicle trips: ${originalTrips.length}`);
    console.log(`  Duplicate vehicle trips: ${duplicateTrips.length}`);
    
    // Get all trips by registration (including unlinked)
    const allTrips = await getUnlinkedTripsByRegistration(originalRegistration);
    console.log(`  Total trips for this registration: ${allTrips.length}`);
    
    // Merge vehicle data
    const mergedData = mergeVehicleData(originalVehicle, duplicateVehicle);
    
    console.log(`\n🔄 Starting consolidation process...`);
    
    // Step 1: Update the original vehicle with merged data
    const { error: updateError } = await supabase
      .from('vehicles')
      .update({
        guardian_unit: mergedData.guardian_unit,
        total_kilometers: mergedData.total_kilometers,
        safety_score: mergedData.safety_score,
        fuel_efficiency: mergedData.fuel_efficiency,
        utilization: mergedData.utilization,
        total_deliveries: mergedData.total_deliveries,
        fatigue_events: mergedData.fatigue_events,
        safety_events: mergedData.safety_events,
        last_service: mergedData.last_service,
        next_service: mergedData.next_service,
        registration_expiry: mergedData.registration_expiry,
        insurance_expiry: mergedData.insurance_expiry,
        inspection_due: mergedData.inspection_due,
        updated_at: new Date().toISOString()
      })
      .eq('id', originalVehicle.id);
    
    if (updateError) throw updateError;
    console.log(`✅ Updated original vehicle with merged data`);
    
    // Step 2: Update all trip history records to point to original vehicle
    const { error: tripUpdateError } = await supabase
      .from('mtdata_trip_history')
      .update({ vehicle_id: originalVehicle.id })
      .or(`vehicle_id.eq.${duplicateVehicle.id},vehicle_id.is.null`)
      .eq('vehicle_registration', duplicateVehicle.registration);
    
    if (tripUpdateError) throw tripUpdateError;
    
    // Also update trips that might have the normalized registration
    const { error: tripUpdate2Error } = await supabase
      .from('mtdata_trip_history')
      .update({ vehicle_id: originalVehicle.id })
      .is('vehicle_id', null)
      .in('vehicle_registration', [originalRegistration, duplicateRegistration]);
    
    if (tripUpdate2Error) throw tripUpdate2Error;
    
    console.log(`✅ Updated trip history links to original vehicle`);
    
    // Step 3: Check for any driver assignments that need to be moved
    const { data: duplicateAssignments, error: assignmentError } = await supabase
      .from('driver_assignments')
      .select('*')
      .eq('vehicle_id', duplicateVehicle.id)
      .is('unassigned_at', null);
    
    if (assignmentError) throw assignmentError;
    
    if (duplicateAssignments && duplicateAssignments.length > 0) {
      console.log(`🔄 Moving ${duplicateAssignments.length} driver assignments...`);
      
      // Unassign from duplicate vehicle
      const { error: unassignError } = await supabase
        .from('driver_assignments')
        .update({ unassigned_at: new Date().toISOString() })
        .eq('vehicle_id', duplicateVehicle.id)
        .is('unassigned_at', null);
      
      if (unassignError) throw unassignError;
      
      // Create new assignments for original vehicle
      for (const assignment of duplicateAssignments) {
        const { error: reassignError } = await supabase
          .from('driver_assignments')
          .insert({
            vehicle_id: originalVehicle.id,
            driver_name: assignment.driver_name,
            driver_id: assignment.driver_id,
            assigned_at: assignment.assigned_at
          });
        
        if (reassignError) {
          console.warn(`⚠️ Failed to reassign driver ${assignment.driver_name}: ${reassignError.message}`);
        }
      }
      
      console.log(`✅ Moved driver assignments to original vehicle`);
    }
    
    // Step 4: Remove the duplicate vehicle
    const { error: deleteError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', duplicateVehicle.id);
    
    if (deleteError) throw deleteError;
    console.log(`✅ Removed duplicate vehicle record`);
    
    return {
      originalVehicle,
      duplicateVehicle,
      tripsConsolidated: allTrips.length,
      assignmentsMoved: duplicateAssignments?.length || 0
    };
    
  } catch (error) {
    console.error(`❌ Consolidation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Verify consolidation results
 */
async function verifyConsolidation(registration) {
  console.log(`\n🔍 Verifying consolidation for "${registration}"...`);
  
  try {
    // Check that only one vehicle exists
    const vehicles = await findVehiclesByRegistration(registration);
    console.log(`✅ Vehicles found: ${vehicles.length} (should be 1)`);
    
    if (vehicles.length === 1) {
      const vehicle = vehicles[0];
      
      // Check trip links
      const trips = await getTripHistory(vehicle.id);
      console.log(`✅ Trips linked to vehicle: ${trips.length}`);
      
      // Check for unlinked trips
      const allTrips = await getUnlinkedTripsByRegistration(registration);
      const unlinkedTrips = allTrips.filter(trip => !trip.vehicle_id);
      console.log(`✅ Unlinked trips remaining: ${unlinkedTrips.length} (should be 0)`);
      
      // Show final vehicle details
      console.log(`\n📋 Final Vehicle Details:`);
      console.log(`  Registration: ${vehicle.registration}`);
      console.log(`  Fleet: ${vehicle.fleet} - ${vehicle.depot}`);
      console.log(`  LYTX Device: ${vehicle.lytx_device || 'None'}`);
      console.log(`  Guardian Unit: ${vehicle.guardian_unit || 'None'}`);
      console.log(`  Total Kilometers: ${vehicle.total_kilometers}`);
      console.log(`  Linked Trips: ${trips.length}`);
      
      return {
        success: true,
        vehicleCount: vehicles.length,
        tripCount: trips.length,
        unlinkedCount: unlinkedTrips.length
      };
    } else {
      return {
        success: false,
        vehicleCount: vehicles.length,
        message: vehicles.length === 0 ? 'No vehicles found' : 'Multiple vehicles still exist'
      };
    }
    
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution function
 */
async function main() {
  const originalRegistration = process.argv[2] || '1GCE-176';
  const duplicateRegistration = process.argv[3] || '1GCE176';
  
  console.log('🔧 Duplicate Vehicle Consolidation Tool');
  console.log('======================================\n');
  
  console.log(`Original (keep): "${originalRegistration}"`);
  console.log(`Duplicate (remove): "${duplicateRegistration}"`);
  console.log(`Normalized form: "${normalizeRegistration(originalRegistration)}"`);
  
  try {
    // Perform consolidation
    const results = await consolidateVehicles(originalRegistration, duplicateRegistration);
    
    // Verify results
    const verification = await verifyConsolidation(originalRegistration);
    
    console.log(`\n📊 CONSOLIDATION RESULTS`);
    console.log('========================');
    console.log(`✅ Original vehicle preserved: ${results.originalVehicle.registration}`);
    console.log(`✅ Duplicate vehicle removed: ${results.duplicateVehicle.registration}`);
    console.log(`✅ Trips consolidated: ${results.tripsConsolidated}`);
    console.log(`✅ Driver assignments moved: ${results.assignmentsMoved}`);
    
    if (verification.success) {
      console.log(`✅ Verification passed:`);
      console.log(`  - Vehicles: ${verification.vehicleCount} (expected: 1)`);
      console.log(`  - Linked trips: ${verification.tripCount}`);
      console.log(`  - Unlinked trips: ${verification.unlinkedCount} (expected: 0)`);
    } else {
      console.log(`❌ Verification failed: ${verification.message || verification.error}`);
    }
    
    console.log('\n🎉 Consolidation completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  1. Verify fleet management UI shows single vehicle');
    console.log('  2. Check trip analytics correlation');
    console.log('  3. Update import scripts to prevent future duplicates');
    
  } catch (error) {
    console.error(`💥 Consolidation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  normalizeRegistration,
  findVehiclesByRegistration,
  getTripHistory,
  getUnlinkedTripsByRegistration,
  mergeVehicleData,
  consolidateVehicles,
  verifyConsolidation
};