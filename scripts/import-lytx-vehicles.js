#!/usr/bin/env node

/**
 * LYTX Vehicle Import Script
 * 
 * Imports vehicle data from LYTX CSV export into the fleet management system.
 * Maps LYTX device serial numbers to vehicles for safety event correlation.
 * 
 * Usage: node scripts/import-lytx-vehicles.js [csv-file-path]
 * 
 * CSV Format Expected:
 * Vehicle,Group,Driver,Device,Last Check In,Status,VIN,Year,Make,Model,License Plate State,License Plate #,Vehicle Type,Seat Belt Type
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
 * Parse LYTX device serial from format "SF80118888 (SF64)" -> "SF80118888"
 */
function parseDeviceSerial(deviceStr) {
  if (!deviceStr || deviceStr.trim() === '') return null;
  
  // Extract serial number before the parentheses
  const match = deviceStr.match(/^([A-Z0-9]+)\s*\(/);
  if (match) {
    return match[1].trim();
  }
  
  // If no parentheses, return the whole string cleaned up
  return deviceStr.trim();
}

/**
 * Map CSV group to database fleet and depot
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
    'Quairading': { fleet: 'Great Southern Fuels', depot: 'Quairading' },
    'GSF': { fleet: 'Great Southern Fuels', depot: 'Kewdale' },
    'Stevemacs': { fleet: 'Stevemacs', depot: 'Kewdale' }
  };
  
  return groupMapping[group] || { fleet: 'Great Southern Fuels', depot: group || 'Unknown' };
}

/**
 * Map CSV status to database status
 */
function mapStatus(csvStatus) {
  const statusMapping = {
    'In Service': 'Active',
    'Out Of Service': 'Out of Service',
    'Active': 'Active',
    'Maintenance': 'Maintenance'
  };
  
  return statusMapping[csvStatus] || 'Available'; // Default to Available
}

/**
 * Clean and normalize registration number
 */
function normalizeRegistration(registration) {
  if (!registration) return null;
  
  // Remove spaces, convert to uppercase
  return registration.replace(/\s+/g, '').toUpperCase();
}

/**
 * Parse CSV content
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }
  
  const header = lines[0];
  const dataLines = lines.slice(1);
  
  console.log(`📊 Processing ${dataLines.length} vehicle records...`);
  
  const vehicles = [];
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handle quoted fields)
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim()); // Add the last field
    
    // Clean up quoted fields
    const cleanFields = fields.map(field => {
      if (field.startsWith('"') && field.endsWith('"')) {
        return field.slice(1, -1);
      }
      return field;
    });
    
    // Map CSV fields to vehicle object
    const [
      vehicleReg, group, driver, device, lastCheckIn, status, 
      vin, year, make, model, licensePlateState, licensePlate, 
      vehicleType, seatBeltType
    ] = cleanFields;
    
    const registration = normalizeRegistration(vehicleReg);
    if (!registration) {
      console.warn(`⚠️ Skipping row ${i + 2}: No valid registration`);
      continue;
    }
    
    const lytxDevice = parseDeviceSerial(device);
    if (!lytxDevice) {
      console.warn(`⚠️ Row ${i + 2}: No LYTX device for ${registration}`);
    }
    
    const fleetInfo = mapGroupToFleetAndDepot(group);
    
    const vehicle = {
      registration,
      fleet: fleetInfo.fleet,
      depot: fleetInfo.depot,
      status: mapStatus(status),
      lytx_device: lytxDevice,
      make: make && make !== '' ? make : null,
      model: model && model !== '' ? model : null,
      year: year && !isNaN(parseInt(year)) ? parseInt(year) : null,
      vin: vin && vin !== '' ? vin : null,
      // Additional tracking fields
      last_lytx_checkin: lastCheckIn && lastCheckIn !== '' ? new Date(lastCheckIn).toISOString() : null,
      vehicle_type: vehicleType && vehicleType !== '' ? vehicleType : null,
      current_driver: driver && driver.trim() !== '' ? driver.trim() : null
    };
    
    vehicles.push(vehicle);
  }
  
  return vehicles;
}

/**
 * Upsert vehicles into database
 */
async function upsertVehicles(vehicles) {
  console.log(`🚀 Upserting ${vehicles.length} vehicles...`);
  
  const results = {
    inserted: 0,
    updated: 0,
    errors: []
  };
  
  for (const vehicle of vehicles) {
    try {
      // Check if vehicle exists
      const { data: existingVehicle, error: fetchError } = await supabase
        .from('vehicles')
        .select('id, registration, lytx_device')
        .eq('registration', vehicle.registration)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }
      
      if (existingVehicle) {
        // Update existing vehicle
        const { error: updateError } = await supabase
          .from('vehicles')
          .update({
            fleet: vehicle.fleet,
            depot: vehicle.depot,
            status: vehicle.status,
            lytx_device: vehicle.lytx_device,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            vin: vehicle.vin,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVehicle.id);
        
        if (updateError) throw updateError;
        
        console.log(`✅ Updated vehicle: ${vehicle.registration} (LYTX: ${vehicle.lytx_device || 'none'})`);
        results.updated++;
      } else {
        // Insert new vehicle
        const { error: insertError } = await supabase
          .from('vehicles')
          .insert({
            registration: vehicle.registration,
            fleet: vehicle.fleet,
            depot: vehicle.depot,
            status: vehicle.status,
            lytx_device: vehicle.lytx_device,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            vin: vehicle.vin,
            safety_score: 0.0,
            fuel_efficiency: 0.0,
            utilization: 0
          });
        
        if (insertError) throw insertError;
        
        console.log(`✅ Inserted vehicle: ${vehicle.registration} (LYTX: ${vehicle.lytx_device || 'none'})`);
        results.inserted++;
      }
      
      // Update driver assignment if current driver is specified
      if (vehicle.current_driver && vehicle.current_driver !== ' ') {
        // This would require additional logic to handle driver assignments
        // For now, we'll just log it
        console.log(`👤 Driver noted for ${vehicle.registration}: ${vehicle.current_driver}`);
      }
      
    } catch (error) {
      const errorMsg = `Failed to process ${vehicle.registration}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }
  
  return results;
}

/**
 * Verify LYTX device mappings
 */
async function verifyLytxMappings() {
  console.log('\n🔍 Verifying LYTX device mappings...');
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('registration, lytx_device, fleet, depot')
    .not('lytx_device', 'is', null)
    .order('registration');
  
  if (error) {
    console.error('❌ Failed to verify mappings:', error.message);
    return;
  }
  
  console.log(`\n📱 ${vehicles.length} vehicles with LYTX devices:`);
  vehicles.forEach(vehicle => {
    console.log(`  ${vehicle.registration}: ${vehicle.lytx_device} (${vehicle.fleet} - ${vehicle.depot})`);
  });
  
  // Check for duplicate device assignments
  const deviceCounts = {};
  vehicles.forEach(vehicle => {
    if (vehicle.lytx_device) {
      deviceCounts[vehicle.lytx_device] = (deviceCounts[vehicle.lytx_device] || 0) + 1;
    }
  });
  
  const duplicates = Object.entries(deviceCounts).filter(([device, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('\n⚠️ Duplicate LYTX device assignments detected:');
    duplicates.forEach(([device, count]) => {
      console.log(`  ${device}: assigned to ${count} vehicles`);
    });
  } else {
    console.log('\n✅ No duplicate LYTX device assignments found');
  }
}

/**
 * Main execution function
 */
async function main() {
  const csvFilePath = process.argv[2] || './2025-08-14_Vehicles_Lytx.csv';
  
  console.log('🚛 LYTX Vehicle Import Tool');
  console.log('==========================\n');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    console.log('\nUsage: node scripts/import-lytx-vehicles.js [csv-file-path]');
    process.exit(1);
  }
  
  try {
    // Read and parse CSV
    console.log(`📂 Reading CSV file: ${csvFilePath}`);
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const vehicles = parseCSV(csvContent);
    
    console.log(`\n📋 Parsed vehicle data:`);
    console.log(`  - Total vehicles: ${vehicles.length}`);
    console.log(`  - With LYTX devices: ${vehicles.filter(v => v.lytx_device).length}`);
    console.log(`  - Fleet distribution:`);
    
    const fleetCounts = vehicles.reduce((acc, vehicle) => {
      acc[vehicle.fleet] = (acc[vehicle.fleet] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(fleetCounts).forEach(([fleet, count]) => {
      console.log(`    - ${fleet}: ${count} vehicles`);
    });
    
    // Auto-proceed with import (no interactive confirmation in this environment)
    console.log('\n🚀 Proceeding with import...');
    
    // Perform the import
    const results = await upsertVehicles(vehicles);
    
    // Display results
    console.log('\n📊 Import Results:');
    console.log(`  - Inserted: ${results.inserted} vehicles`);
    console.log(`  - Updated: ${results.updated} vehicles`);
    console.log(`  - Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Verify the mappings
    await verifyLytxMappings();
    
    console.log('\n🎉 LYTX vehicle import completed!');
    
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
  parseDeviceSerial,
  mapGroupToFleetAndDepot,
  mapStatus,
  normalizeRegistration,
  parseCSV,
  upsertVehicles,
  verifyLytxMappings
};