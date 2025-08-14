#!/usr/bin/env node

/**
 * Export New Vehicle Candidates from MtData Trip History
 * 
 * Identifies vehicles in trip history that don't exist in the fleet database
 * and exports them as candidates for addition to the fleet management system.
 * 
 * Usage: node scripts/export-new-vehicles.js [output-file-path]
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Map CSV group to database fleet and depot (reused from LYTX import)
 */
function mapGroupToFleetAndDepot(group) {
  const groupMapping = {
    'Kewdale': { fleet: 'Stevemacs', depot: 'Kewdale' },
    'Kalgoorlie': { fleet: 'Great Southern Fuels', depot: 'Kalgoorlie' },
    'Katanning': { fleet: 'Great Southern Fuels', depot: 'Katanning' },
    'Wongan Hills': { fleet: 'Great Southern Fuels', depot: 'Wongan Hills' },
    'Narrogin': { fleet: 'Great Southern Fuels', depot: 'Narrogin' },
    'Albany': { fleet: 'Great Southern Fuels', depot: 'Albany' },
    'Merredin': { fleet: 'Great Southern Fuels', depot: 'Merredin' },
    'Geraldton': { fleet: 'Great Southern Fuels', depot: 'Geraldton' },
    'Quairding': { fleet: 'Great Southern Fuels', depot: 'Quairding' },
    'GSF': { fleet: 'Great Southern Fuels', depot: 'Kewdale' },
    'Stevemacs': { fleet: 'Stevemacs', depot: 'Kewdale' },
    'Stevemacs GSF': { fleet: 'Stevemacs', depot: 'Kewdale' }
  };
  
  return groupMapping[group] || { fleet: 'Great Southern Fuels', depot: group || 'Unknown' };
}

/**
 * Detect if unit serial number could be a Guardian device
 */
function isLikelyGuardianDevice(serialNumber) {
  if (!serialNumber) return false;
  
  // Guardian devices typically follow pattern: AA123456 (2 letters, 6+ digits)
  return /^[A-Z]{2}[0-9]{6,}$/.test(serialNumber);
}

/**
 * Get unmatched vehicles from trip history
 */
async function getUnmatchedVehicles() {
  console.log('🔍 Querying unmatched vehicles from trip history...');
  
  const { data, error } = await supabase.rpc('get_unmatched_vehicles_summary');
  
  if (error) {
    // If the function doesn't exist, fall back to direct query
    console.log('RPC function not found, using direct query...');
    
    const { data: directData, error: directError } = await supabase
      .from('mtdata_trip_history')
      .select(`
        vehicle_registration,
        mtdata_vehicle_id,
        group_name,
        unit_serial_number,
        driver_name,
        start_time,
        distance_km
      `)
      .is('vehicle_id', null);
    
    if (directError) throw directError;
    
    // Aggregate the data manually
    const vehicleMap = new Map();
    
    directData.forEach(trip => {
      const key = trip.vehicle_registration;
      
      if (!vehicleMap.has(key)) {
        vehicleMap.set(key, {
          vehicle_registration: trip.vehicle_registration,
          mtdata_vehicle_id: trip.mtdata_vehicle_id,
          group_name: trip.group_name,
          unit_serial_number: trip.unit_serial_number,
          trip_count: 0,
          total_distance_km: 0,
          first_seen: trip.start_time,
          last_seen: trip.start_time,
          drivers: new Set(),
          all_trips: []
        });
      }
      
      const vehicle = vehicleMap.get(key);
      vehicle.trip_count++;
      vehicle.total_distance_km += parseFloat(trip.distance_km || 0);
      vehicle.all_trips.push(trip);
      
      if (trip.start_time < vehicle.first_seen) {
        vehicle.first_seen = trip.start_time;
      }
      if (trip.start_time > vehicle.last_seen) {
        vehicle.last_seen = trip.start_time;
      }
      
      if (trip.driver_name) {
        vehicle.drivers.add(trip.driver_name);
      }
    });
    
    // Convert to array and add computed fields
    return Array.from(vehicleMap.values()).map(vehicle => {
      // Find most common driver
      const driverCounts = {};
      vehicle.all_trips.forEach(trip => {
        if (trip.driver_name) {
          driverCounts[trip.driver_name] = (driverCounts[trip.driver_name] || 0) + 1;
        }
      });
      
      const mostCommonDriver = Object.entries(driverCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || null;
      
      return {
        vehicle_registration: vehicle.vehicle_registration,
        mtdata_vehicle_id: vehicle.mtdata_vehicle_id,
        group_name: vehicle.group_name,
        unit_serial_number: vehicle.unit_serial_number,
        trip_count: vehicle.trip_count,
        total_distance_km: Math.round(vehicle.total_distance_km * 100) / 100,
        avg_distance_km: Math.round((vehicle.total_distance_km / vehicle.trip_count) * 100) / 100,
        first_seen: vehicle.first_seen,
        last_seen: vehicle.last_seen,
        most_common_driver: mostCommonDriver,
        unique_drivers: vehicle.drivers.size
      };
    });
  }
  
  return data;
}

/**
 * Normalize registration for comparison
 */
function normalizeRegistration(registration) {
  if (!registration) return null;
  return registration.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Check for potential duplicates with existing vehicles (with normalization)
 */
async function checkForDuplicates(unmatchedVehicles) {
  console.log('🔍 Checking for potential duplicates with existing vehicles...');
  
  const { data: existingVehicles, error } = await supabase
    .from('vehicles')
    .select('registration, fleet, depot, guardian_unit, lytx_device');
  
  if (error) throw error;
  
  // Create normalized lookup map
  const existingNormalizedMap = new Map();
  existingVehicles.forEach(vehicle => {
    const normalized = normalizeRegistration(vehicle.registration);
    if (normalized) {
      existingNormalizedMap.set(normalized, vehicle);
    }
  });
  
  const potentialDuplicates = [];
  const cleanCandidates = [];
  
  unmatchedVehicles.forEach(candidate => {
    const candidateNormalized = normalizeRegistration(candidate.vehicle_registration);
    
    if (candidateNormalized && existingNormalizedMap.has(candidateNormalized)) {
      const existing = existingNormalizedMap.get(candidateNormalized);
      potentialDuplicates.push({
        candidate: candidate.vehicle_registration,
        existing: existing.registration,
        fleet: existing.fleet,
        depot: existing.depot,
        matchType: 'normalized_exact'
      });
    } else {
      // Also check for partial matches (similarity-based)
      let foundSimilar = false;
      for (const [normalized, existing] of existingNormalizedMap.entries()) {
        if (candidateNormalized && candidateNormalized.length >= 4 && normalized.length >= 4) {
          // Check for high similarity or substring matches
          if ((candidateNormalized.includes(normalized) || normalized.includes(candidateNormalized)) &&
              Math.abs(candidateNormalized.length - normalized.length) <= 2) {
            potentialDuplicates.push({
              candidate: candidate.vehicle_registration,
              existing: existing.registration,
              fleet: existing.fleet,
              depot: existing.depot,
              matchType: 'similarity_match'
            });
            foundSimilar = true;
            break;
          }
        }
      }
      
      if (!foundSimilar) {
        cleanCandidates.push(candidate);
      }
    }
  });
  
  return { potentialDuplicates, cleanCandidates };
}

/**
 * Generate CSV export of new vehicle candidates
 */
function generateCSV(vehicles) {
  const headers = [
    'registration',
    'fleet',
    'depot',
    'status',
    'mtdata_vehicle_id',
    'guardian_unit',
    'trip_count',
    'total_distance_km',
    'avg_distance_km',
    'first_seen',
    'last_seen',
    'most_common_driver',
    'unique_drivers',
    'group_name',
    'unit_serial_number'
  ];
  
  const csvRows = [headers.join(',')];
  
  vehicles.forEach(vehicle => {
    const fleetInfo = mapGroupToFleetAndDepot(vehicle.group_name);
    const isGuardianDevice = isLikelyGuardianDevice(vehicle.unit_serial_number);
    
    const row = [
      `"${vehicle.vehicle_registration}"`,
      `"${fleetInfo.fleet}"`,
      `"${fleetInfo.depot}"`,
      '"Active"',
      `"${vehicle.mtdata_vehicle_id || ''}"`,
      `"${isGuardianDevice ? vehicle.unit_serial_number : ''}"`,
      vehicle.trip_count,
      vehicle.total_distance_km,
      vehicle.avg_distance_km,
      `"${vehicle.first_seen}"`,
      `"${vehicle.last_seen}"`,
      `"${vehicle.most_common_driver || ''}"`,
      vehicle.unique_drivers,
      `"${vehicle.group_name}"`,
      `"${vehicle.unit_serial_number || ''}"`
    ];
    
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Main execution function
 */
async function main() {
  const outputPath = process.argv[2] || './new-vehicles-from-trips.csv';
  
  console.log('🚛 New Vehicle Export Tool from MtData Trip History');
  console.log('=====================================================\n');
  
  try {
    // Get unmatched vehicles
    const unmatchedVehicles = await getUnmatchedVehicles();
    
    if (!unmatchedVehicles || unmatchedVehicles.length === 0) {
      console.log('✅ No unmatched vehicles found - all trip data is correlated!');
      return;
    }
    
    console.log(`📊 Found ${unmatchedVehicles.length} unmatched vehicles in trip history`);
    
    // Check for duplicates
    const { potentialDuplicates, cleanCandidates } = await checkForDuplicates(unmatchedVehicles);
    
    console.log(`\n📋 Analysis Results:`);
    console.log(`  - Total unmatched vehicles: ${unmatchedVehicles.length}`);
    console.log(`  - Potential duplicates: ${potentialDuplicates.length}`);
    console.log(`  - Clean candidates for import: ${cleanCandidates.length}`);
    
    if (potentialDuplicates.length > 0) {
      console.log(`\n⚠️ Potential Duplicates Detected:`);
      potentialDuplicates.forEach(dup => {
        console.log(`  - "${dup.candidate}" matches existing "${dup.existing}" (${dup.fleet} - ${dup.depot})`);
      });
    }
    
    // Fleet distribution
    const fleetDistribution = cleanCandidates.reduce((acc, vehicle) => {
      const fleetInfo = mapGroupToFleetAndDepot(vehicle.group_name);
      const key = `${fleetInfo.fleet} - ${fleetInfo.depot}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n🏢 Fleet Distribution:`);
    Object.entries(fleetDistribution).forEach(([fleet, count]) => {
      console.log(`  - ${fleet}: ${count} vehicles`);
    });
    
    // Guardian device analysis
    const guardianDevices = cleanCandidates.filter(v => 
      isLikelyGuardianDevice(v.unit_serial_number)
    ).length;
    
    console.log(`\n📱 Device Analysis:`);
    console.log(`  - Vehicles with Guardian-like devices: ${guardianDevices}`);
    console.log(`  - Vehicles without device mapping: ${cleanCandidates.length - guardianDevices}`);
    
    // Generate CSV export
    const csvContent = generateCSV(cleanCandidates);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    
    console.log(`\n📄 Export completed:`);
    console.log(`  - File: ${outputPath}`);
    console.log(`  - Records: ${cleanCandidates.length}`);
    
    // Show top candidates by usage
    console.log(`\n🔝 Top 10 candidates by trip count:`);
    const topCandidates = cleanCandidates
      .sort((a, b) => b.trip_count - a.trip_count)
      .slice(0, 10);
    
    topCandidates.forEach((vehicle, index) => {
      const fleetInfo = mapGroupToFleetAndDepot(vehicle.group_name);
      console.log(`  ${index + 1}. ${vehicle.vehicle_registration} - ${vehicle.trip_count} trips (${fleetInfo.fleet})`);
    });
    
    if (potentialDuplicates.length > 0) {
      // Export duplicates for manual review
      const duplicatesPath = outputPath.replace('.csv', '-potential-duplicates.csv');
      const duplicatesCSV = [
        'candidate_registration,existing_registration,existing_fleet,existing_depot',
        ...potentialDuplicates.map(dup => 
          `"${dup.candidate}","${dup.existing}","${dup.fleet}","${dup.depot}"`
        )
      ].join('\n');
      
      fs.writeFileSync(duplicatesPath, duplicatesCSV, 'utf-8');
      console.log(`\n⚠️ Potential duplicates exported to: ${duplicatesPath}`);
    }
    
    console.log('\n🎉 Export completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  1. Review the generated CSV file');
    console.log('  2. Verify fleet assignments are correct');
    console.log('  3. Run: node scripts/import-new-vehicles-from-trips.js');
    
  } catch (error) {
    console.error(`💥 Export failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  mapGroupToFleetAndDepot,
  isLikelyGuardianDevice,
  getUnmatchedVehicles,
  checkForDuplicates,
  generateCSV
};