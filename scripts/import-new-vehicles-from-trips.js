#!/usr/bin/env node

/**
 * Import New Vehicles from MtData Trip History
 * 
 * Adds vehicles found in trip history but missing from fleet database.
 * Updates trip history records to link to newly created vehicle IDs.
 * 
 * Usage: node scripts/import-new-vehicles-from-trips.js [csv-file-path]
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
 * Get unmatched vehicles directly from database
 */
async function getUnmatchedVehiclesFromDB() {
  console.log('🔍 Querying unmatched vehicles directly from database...');
  
  const { data, error } = await supabase
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
  
  if (error) throw error;
  
  // Aggregate the data
  const vehicleMap = new Map();
  
  data.forEach(trip => {
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
      first_seen: vehicle.first_seen,
      last_seen: vehicle.last_seen,
      most_common_driver: mostCommonDriver,
      unique_drivers: vehicle.drivers.size
    };
  });
}

/**
 * Parse CSV file if provided
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }
  
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    
    // Create object from fields
    const vehicle = {};
    header.forEach((field, index) => {
      let value = fields[index] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      vehicle[field] = value;
    });
    
    return vehicle;
  });
}

/**
 * Map group to fleet and depot
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
    'Quairding': { fleet: 'Great Southern Fuels', depot: 'Quairading' },
    'GSF': { fleet: 'Great Southern Fuels', depot: 'Kewdale' },
    'Stevemacs': { fleet: 'Stevemacs', depot: 'Kewdale' },
    'Stevemacs GSF': { fleet: 'Stevemacs', depot: 'Kewdale' }
  };
  
  return groupMapping[group] || { fleet: 'Great Southern Fuels', depot: group || 'Unknown' };
}

/**
 * Normalize registration for comparison
 */
function normalizeRegistration(registration) {
  if (!registration) return null;
  return registration.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Check if registration already exists (with normalization)
 */
async function checkExistingVehicles(vehicles) {
  console.log('🔍 Checking for existing vehicles with normalized registration matching...');
  
  // Get all existing vehicles for normalized comparison
  const { data: allExisting, error } = await supabase
    .from('vehicles')
    .select('id, registration, fleet, depot');
  
  if (error) throw error;
  
  // Create normalized lookup map
  const existingNormalizedMap = new Map();
  allExisting.forEach(vehicle => {
    const normalized = normalizeRegistration(vehicle.registration);
    if (normalized) {
      existingNormalizedMap.set(normalized, vehicle);
    }
  });
  
  const newVehicles = [];
  const duplicates = [];
  
  vehicles.forEach(vehicle => {
    const reg = vehicle.vehicle_registration || vehicle.registration;
    const normalized = normalizeRegistration(reg);
    
    if (normalized && existingNormalizedMap.has(normalized)) {
      const existing = existingNormalizedMap.get(normalized);
      duplicates.push({
        candidate: reg,
        existing: existing.registration,
        vehicleId: existing.id,
        fleet: existing.fleet,
        depot: existing.depot
      });
    } else {
      newVehicles.push(vehicle);
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️ Found ${duplicates.length} potential duplicates (normalized registration matches):`);
    duplicates.forEach(dup => {
      console.log(`  - "${dup.candidate}" matches existing "${dup.existing}" (${dup.fleet} - ${dup.depot})`);
    });
    console.log('\n💡 These vehicles will be skipped. Use find-registration-variants.js to investigate.');
  }
  
  return newVehicles;
}

/**
 * Insert new vehicles into database
 */
async function insertVehicles(vehicles) {
  console.log(`🚀 Inserting ${vehicles.length} new vehicles...`);
  
  const results = {
    inserted: 0,
    errors: [],
    vehicleIds: new Map() // registration -> id mapping
  };
  
  for (const vehicle of vehicles) {
    try {
      const fleetInfo = mapGroupToFleetAndDepot(vehicle.group_name);
      
      // Determine if unit serial could be Guardian device
      const isGuardianDevice = vehicle.unit_serial_number && 
        /^[A-Z]{2}[0-9]{6,}$/.test(vehicle.unit_serial_number);
      
      const newVehicle = {
        registration: vehicle.vehicle_registration || vehicle.registration,
        fleet: vehicle.fleet || fleetInfo.fleet,
        depot: vehicle.depot || fleetInfo.depot,
        status: vehicle.status || 'Active',
        guardian_unit: isGuardianDevice ? vehicle.unit_serial_number : null,
        lytx_device: null, // To be populated from LYTX imports later
        safety_score: 0.0,
        fuel_efficiency: 0.0,
        utilization: 0,
        total_deliveries: 0,
        total_kilometers: Math.round(vehicle.total_distance_km || 0),
        fatigue_events: 0,
        safety_events: 0
      };
      
      const { data, error } = await supabase
        .from('vehicles')
        .insert(newVehicle)
        .select('id, registration')
        .single();
      
      if (error) throw error;
      
      results.vehicleIds.set(newVehicle.registration, data.id);
      results.inserted++;
      
      console.log(`✅ Inserted: ${newVehicle.registration} (${newVehicle.fleet} - ${newVehicle.depot})`);
      
    } catch (error) {
      const errorMsg = `Failed to insert ${vehicle.vehicle_registration || vehicle.registration}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }
  
  return results;
}

/**
 * Update trip history records to link to new vehicle IDs
 */
async function updateTripHistoryLinks(vehicleIds) {
  console.log(`🔗 Updating trip history links for ${vehicleIds.size} vehicles...`);
  
  const results = {
    updated: 0,
    errors: []
  };
  
  for (const [registration, vehicleId] of vehicleIds) {
    try {
      const { error } = await supabase
        .from('mtdata_trip_history')
        .update({ vehicle_id: vehicleId })
        .eq('vehicle_registration', registration)
        .is('vehicle_id', null);
      
      if (error) throw error;
      
      // Count how many trips were updated
      const { count, error: countError } = await supabase
        .from('mtdata_trip_history')
        .select('*', { count: 'exact', head: true })
        .eq('vehicle_id', vehicleId);
      
      if (!countError) {
        results.updated += count || 0;
        console.log(`✅ Linked ${count || 0} trips to ${registration}`);
      }
      
    } catch (error) {
      const errorMsg = `Failed to update trips for ${registration}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }
  
  return results;
}

/**
 * Verify import results
 */
async function verifyImport() {
  console.log('🔍 Verifying import results...');
  
  // Check total vehicles
  const { count: totalVehicles, error: countError } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.warn('Could not verify total vehicle count');
  } else {
    console.log(`📊 Total vehicles in database: ${totalVehicles}`);
  }
  
  // Check unmatched trips remaining
  const { count: unmatchedTrips, error: unmatchedError } = await supabase
    .from('mtdata_trip_history')
    .select('*', { count: 'exact', head: true })
    .is('vehicle_id', null);
  
  if (unmatchedError) {
    console.warn('Could not verify unmatched trips count');
  } else {
    console.log(`📊 Remaining unmatched trips: ${unmatchedTrips}`);
    
    if (unmatchedTrips === 0) {
      console.log('🎉 Perfect! All trips are now linked to vehicles!');
    } else {
      console.log(`📈 Correlation improvement achieved`);
    }
  }
  
  // Show fleet distribution
  const { data: fleetStats, error: fleetError } = await supabase
    .from('vehicles')
    .select('fleet, depot')
    .order('fleet, depot');
  
  if (!fleetError && fleetStats) {
    const distribution = fleetStats.reduce((acc, vehicle) => {
      const key = `${vehicle.fleet} - ${vehicle.depot}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n🏢 Updated Fleet Distribution:');
    Object.entries(distribution).forEach(([fleet, count]) => {
      console.log(`  - ${fleet}: ${count} vehicles`);
    });
  }
}

/**
 * Main execution function
 */
async function main() {
  const csvFilePath = process.argv[2];
  
  console.log('🚛 New Vehicle Import Tool from MtData Trip History');
  console.log('===================================================\n');
  
  try {
    let vehicles;
    
    if (csvFilePath && fs.existsSync(csvFilePath)) {
      console.log(`📂 Reading vehicles from CSV: ${csvFilePath}`);
      const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
      vehicles = parseCSV(csvContent);
    } else {
      console.log('📂 No CSV provided, querying unmatched vehicles from database...');
      vehicles = await getUnmatchedVehiclesFromDB();
    }
    
    if (!vehicles || vehicles.length === 0) {
      console.log('✅ No unmatched vehicles found - all vehicles are already in the database!');
      return;
    }
    
    console.log(`📊 Found ${vehicles.length} candidate vehicles`);
    
    // Check for existing vehicles
    const newVehicles = await checkExistingVehicles(vehicles);
    const alreadyExists = vehicles.length - newVehicles.length;
    
    if (alreadyExists > 0) {
      console.log(`⚠️ ${alreadyExists} vehicles already exist in database`);
    }
    
    if (newVehicles.length === 0) {
      console.log('✅ All candidate vehicles already exist in the database!');
      return;
    }
    
    console.log(`\n🚀 Proceeding to import ${newVehicles.length} new vehicles...`);
    
    // Show preview of what will be imported
    console.log('\n📋 Preview of vehicles to be imported:');
    newVehicles.slice(0, 5).forEach((vehicle, index) => {
      const fleetInfo = mapGroupToFleetAndDepot(vehicle.group_name);
      const reg = vehicle.vehicle_registration || vehicle.registration;
      console.log(`  ${index + 1}. ${reg} (${fleetInfo.fleet} - ${fleetInfo.depot})`);
    });
    
    if (newVehicles.length > 5) {
      console.log(`  ... and ${newVehicles.length - 5} more vehicles`);
    }
    
    // Insert vehicles
    const insertResults = await insertVehicles(newVehicles);
    
    console.log(`\n📊 Vehicle Insert Results:`);
    console.log(`  - Inserted: ${insertResults.inserted} vehicles`);
    console.log(`  - Errors: ${insertResults.errors.length}`);
    
    if (insertResults.errors.length > 0) {
      console.log('\n❌ Insert Errors:');
      insertResults.errors.slice(0, 5).forEach(error => console.log(`  - ${error}`));
      if (insertResults.errors.length > 5) {
        console.log(`  ... and ${insertResults.errors.length - 5} more errors`);
      }
    }
    
    // Update trip history links
    if (insertResults.vehicleIds.size > 0) {
      const linkResults = await updateTripHistoryLinks(insertResults.vehicleIds);
      
      console.log(`\n🔗 Trip History Link Results:`);
      console.log(`  - Updated trips: ${linkResults.updated}`);
      console.log(`  - Errors: ${linkResults.errors.length}`);
      
      if (linkResults.errors.length > 0) {
        console.log('\n❌ Link Update Errors:');
        linkResults.errors.slice(0, 3).forEach(error => console.log(`  - ${error}`));
      }
    }
    
    // Verify results
    await verifyImport();
    
    console.log('\n🎉 Vehicle import completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  1. Check the fleet management interface for new vehicles');
    console.log('  2. Verify trip analytics correlation improvements');
    console.log('  3. Update LYTX device mappings if needed');
    
  } catch (error) {
    console.error(`💥 Import failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  getUnmatchedVehiclesFromDB,
  parseCSV,
  mapGroupToFleetAndDepot,
  checkExistingVehicles,
  insertVehicles,
  updateTripHistoryLinks,
  verifyImport
};