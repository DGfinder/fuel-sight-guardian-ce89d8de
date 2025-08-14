#!/usr/bin/env node

/**
 * Fix Trip History Links
 * 
 * Links unconnected trip history records to their correct vehicles
 * by matching registration numbers (with normalization).
 * 
 * Usage: node scripts/fix-trip-links.js
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
 * Fix trip links for a specific registration
 */
async function fixTripLinksForRegistration(targetRegistration) {
  console.log(`🔗 Fixing trip links for registration pattern: "${targetRegistration}"`);
  
  const targetNormalized = normalizeRegistration(targetRegistration);
  
  try {
    // Find the vehicle with this normalized registration
    const { data: vehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, registration, fleet, depot');
    
    if (vehicleError) throw vehicleError;
    
    const matchingVehicle = vehicles.find(vehicle => 
      normalizeRegistration(vehicle.registration) === targetNormalized
    );
    
    if (!matchingVehicle) {
      console.log(`❌ No vehicle found with normalized registration "${targetNormalized}"`);
      return { success: false, reason: 'Vehicle not found' };
    }
    
    console.log(`✅ Found vehicle: ${matchingVehicle.registration} (ID: ${matchingVehicle.id})`);
    
    // Find all trip history records with matching normalized registration
    const { data: allTrips, error: tripError } = await supabase
      .from('mtdata_trip_history')
      .select('id, vehicle_registration, vehicle_id');
    
    if (tripError) throw tripError;
    
    const matchingTrips = allTrips.filter(trip => 
      normalizeRegistration(trip.vehicle_registration) === targetNormalized
    );
    
    console.log(`📊 Found ${matchingTrips.length} trips with matching registration pattern`);
    
    // Separate linked and unlinked trips
    const linkedTrips = matchingTrips.filter(trip => trip.vehicle_id);
    const unlinkedTrips = matchingTrips.filter(trip => !trip.vehicle_id);
    const wronglyLinkedTrips = matchingTrips.filter(trip => 
      trip.vehicle_id && trip.vehicle_id !== matchingVehicle.id
    );
    
    console.log(`  - Already linked correctly: ${linkedTrips.filter(t => t.vehicle_id === matchingVehicle.id).length}`);
    console.log(`  - Unlinked: ${unlinkedTrips.length}`);
    console.log(`  - Wrongly linked: ${wronglyLinkedTrips.length}`);
    
    let updatedCount = 0;
    
    // Update unlinked trips
    if (unlinkedTrips.length > 0) {
      const { error: updateError } = await supabase
        .from('mtdata_trip_history')
        .update({ vehicle_id: matchingVehicle.id })
        .in('id', unlinkedTrips.map(trip => trip.id));
      
      if (updateError) throw updateError;
      
      updatedCount += unlinkedTrips.length;
      console.log(`✅ Linked ${unlinkedTrips.length} unlinked trips`);
    }
    
    // Update wrongly linked trips
    if (wronglyLinkedTrips.length > 0) {
      const { error: updateError } = await supabase
        .from('mtdata_trip_history')
        .update({ vehicle_id: matchingVehicle.id })
        .in('id', wronglyLinkedTrips.map(trip => trip.id));
      
      if (updateError) throw updateError;
      
      updatedCount += wronglyLinkedTrips.length;
      console.log(`✅ Fixed ${wronglyLinkedTrips.length} wrongly linked trips`);
    }
    
    return {
      success: true,
      vehicleId: matchingVehicle.id,
      vehicleRegistration: matchingVehicle.registration,
      totalTrips: matchingTrips.length,
      updatedTrips: updatedCount,
      alreadyLinked: linkedTrips.filter(t => t.vehicle_id === matchingVehicle.id).length
    };
    
  } catch (error) {
    console.error(`❌ Failed to fix links for ${targetRegistration}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fix all unlinked trips
 */
async function fixAllUnlinkedTrips() {
  console.log('🔍 Finding all unlinked trips...');
  
  try {
    // Get all unlinked trips
    const { data: unlinkedTrips, error: tripError } = await supabase
      .from('mtdata_trip_history')
      .select('vehicle_registration')
      .is('vehicle_id', null);
    
    if (tripError) throw tripError;
    
    // Get unique registrations
    const uniqueRegistrations = [...new Set(unlinkedTrips.map(trip => trip.vehicle_registration))];
    console.log(`📊 Found ${unlinkedTrips.length} unlinked trips across ${uniqueRegistrations.length} registrations`);
    
    const results = [];
    
    for (const registration of uniqueRegistrations) {
      console.log(`\n🔧 Processing registration: "${registration}"`);
      const result = await fixTripLinksForRegistration(registration);
      results.push({ registration, ...result });
    }
    
    return results;
    
  } catch (error) {
    console.error(`❌ Failed to fix all unlinked trips: ${error.message}`);
    throw error;
  }
}

/**
 * Verify trip links
 */
async function verifyTripLinks() {
  console.log('\n🔍 Verifying trip links...');
  
  try {
    // Count total trips
    const { count: totalTrips, error: totalError } = await supabase
      .from('mtdata_trip_history')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) throw totalError;
    
    // Count linked trips
    const { count: linkedTrips, error: linkedError } = await supabase
      .from('mtdata_trip_history')
      .select('*', { count: 'exact', head: true })
      .not('vehicle_id', 'is', null);
    
    if (linkedError) throw linkedError;
    
    // Count unlinked trips
    const { count: unlinkedTrips, error: unlinkedError } = await supabase
      .from('mtdata_trip_history')
      .select('*', { count: 'exact', head: true })
      .is('vehicle_id', null);
    
    if (unlinkedError) throw unlinkedError;
    
    const correlationRate = totalTrips > 0 ? (linkedTrips / totalTrips * 100).toFixed(1) : 0;
    
    console.log(`📊 Trip Link Verification:`);
    console.log(`  - Total trips: ${totalTrips.toLocaleString()}`);
    console.log(`  - Linked trips: ${linkedTrips.toLocaleString()}`);
    console.log(`  - Unlinked trips: ${unlinkedTrips.toLocaleString()}`);
    console.log(`  - Correlation rate: ${correlationRate}%`);
    
    return {
      totalTrips,
      linkedTrips,
      unlinkedTrips,
      correlationRate: parseFloat(correlationRate)
    };
    
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    return null;
  }
}

/**
 * Main execution function
 */
async function main() {
  const targetRegistration = process.argv[2];
  
  console.log('🔗 Trip History Link Repair Tool');
  console.log('=================================\n');
  
  try {
    if (targetRegistration) {
      // Fix specific registration
      console.log(`🎯 Targeting specific registration: "${targetRegistration}"`);
      const result = await fixTripLinksForRegistration(targetRegistration);
      
      if (result.success) {
        console.log(`\n✅ Successfully processed "${targetRegistration}"`);
        console.log(`  - Vehicle: ${result.vehicleRegistration} (${result.vehicleId})`);
        console.log(`  - Total trips: ${result.totalTrips}`);
        console.log(`  - Updated trips: ${result.updatedTrips}`);
        console.log(`  - Already linked: ${result.alreadyLinked}`);
      } else {
        console.log(`\n❌ Failed to process "${targetRegistration}": ${result.reason || result.error}`);
      }
    } else {
      // Fix all unlinked trips
      console.log('🔧 Processing all unlinked trips...');
      const results = await fixAllUnlinkedTrips();
      
      console.log(`\n📊 BATCH PROCESSING RESULTS`);
      console.log('===========================');
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`✅ Successful: ${successful.length} registrations`);
      console.log(`❌ Failed: ${failed.length} registrations`);
      
      if (successful.length > 0) {
        console.log(`\n🎯 Successful Updates:`);
        successful.forEach(result => {
          console.log(`  - ${result.registration}: ${result.updatedTrips} trips linked`);
        });
      }
      
      if (failed.length > 0) {
        console.log(`\n⚠️ Failed Updates:`);
        failed.forEach(result => {
          console.log(`  - ${result.registration}: ${result.reason || result.error}`);
        });
      }
    }
    
    // Verify final state
    const verification = await verifyTripLinks();
    
    if (verification) {
      if (verification.correlationRate >= 99) {
        console.log('\n🎉 Excellent! Trip correlation is at 99%+ - nearly perfect!');
      } else if (verification.correlationRate >= 95) {
        console.log('\n✅ Good! Trip correlation is above 95%');
      } else {
        console.log('\n⚠️ Trip correlation could be improved');
      }
    }
    
    console.log('\n💡 Next steps:');
    console.log('  1. Check trip analytics for improved correlation');
    console.log('  2. Verify fleet management interface');
    console.log('  3. Update import scripts to prevent future issues');
    
  } catch (error) {
    console.error(`💥 Link repair failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  normalizeRegistration,
  fixTripLinksForRegistration,
  fixAllUnlinkedTrips,
  verifyTripLinks
};