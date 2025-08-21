/**
 * Import Drivers from CSV
 * Script to import driver data from the CSV file into the database
 */

import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importDriversFromCSV() {
  const csvFilePath = './Inputdata_southern Fuel (3)(Driver Names Mapping).csv';
  const drivers = [];
  
  console.log('Reading CSV file...');
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        // Clean and validate the data
        const driver = {
          fleet: row.Fleet?.trim() || null,
          standard_driver_name: row['Standard Driver Name']?.trim() || null,
          driver_hours_driver_name: row['Driver Hours Driver Name']?.trim() || null,
          myob_driver_name: row['MYOB Driver Name']?.trim() || null,
          myob_driver_name_2: row['MYOB Driver Name 2']?.trim() || null,
          mtdata_name: row['MtData Name']?.trim() || null,
          fuel_usage_smartfuel_name: row['Fuel Usage/SmartFuel Name']?.trim() || null,
          lytx_driver_name: row['Lytx Driver Name']?.trim() || null,
          depot: row.Depot?.trim() || null
        };
        
        // Only include rows with valid driver names
        if (driver.standard_driver_name && driver.fleet) {
          drivers.push(driver);
        }
      })
      .on('end', async () => {
        console.log(`CSV processing complete. Found ${drivers.length} drivers.`);
        
        try {
          await processDrivers(drivers);
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function processDrivers(drivers) {
  console.log('Processing drivers...');
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const driver of drivers) {
    try {
      // Parse the standard driver name
      const nameParts = driver.standard_driver_name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      if (!firstName || !lastName) {
        console.log(`Skipping invalid name: ${driver.standard_driver_name}`);
        skippedCount++;
        continue;
      }
      
      // Normalize fleet name to match database constraint
      const normalizedFleet = driver.fleet === 'Great Southern' ? 'Great Southern Fuels' : driver.fleet;
      
      // Check if driver already exists (use proper query without .single())
      const { data: existingDrivers, error: queryError } = await supabase
        .from('drivers')
        .select('id, employee_id')
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .eq('fleet', normalizedFleet);
      
      if (queryError) {
        console.error(`Error checking for existing driver ${driver.standard_driver_name}: ${queryError.message}`);
        skippedCount++;
        continue;
      }
      
      if (existingDrivers && existingDrivers.length > 0) {
        console.log(`Driver already exists: ${driver.standard_driver_name} (${existingDrivers.length} existing record(s))`);
        skippedCount++;
        continue;
      }
      
      // Insert the driver (without auto-generated employee_id)
      const { data: newDriver, error: insertError } = await supabase
        .from('drivers')
        .insert({
          first_name: firstName,
          last_name: lastName,
          fleet: normalizedFleet,
          depot: driver.depot || 'Unknown',
          status: 'Active'
          // employee_id will be set manually when needed or from LYTX data
        })
        .select()
        .single();
      
      if (insertError) {
        console.error(`Error inserting driver ${driver.standard_driver_name}:`, insertError);
        continue;
      }
      
      // Insert name mappings
      await insertNameMappings(newDriver.id, driver);
      
      insertedCount++;
      console.log(`Inserted: ${driver.standard_driver_name} (${driver.fleet})`);
      
    } catch (error) {
      console.error(`Error processing driver ${driver.standard_driver_name}:`, error);
    }
  }
  
  console.log(`\nImport complete:`);
  console.log(`- Inserted: ${insertedCount} drivers`);
  console.log(`- Skipped: ${skippedCount} drivers`);
}

async function insertNameMappings(driverId, driver) {
  const mappings = [];
  
  // Standard name mapping (primary)
  if (driver.standard_driver_name) {
    mappings.push({
      driver_id: driverId,
      system_name: 'Standard',
      mapped_name: driver.standard_driver_name,
      is_primary: true,
      confidence_score: 1.0
    });
  }
  
  // Driver Hours mapping
  if (driver.driver_hours_driver_name && driver.driver_hours_driver_name !== driver.standard_driver_name) {
    mappings.push({
      driver_id: driverId,
      system_name: 'Hours',
      mapped_name: driver.driver_hours_driver_name,
      is_primary: false,
      confidence_score: 0.9
    });
  }
  
  // MYOB mapping
  if (driver.myob_driver_name && driver.myob_driver_name !== driver.standard_driver_name) {
    mappings.push({
      driver_id: driverId,
      system_name: 'MYOB',
      mapped_name: driver.myob_driver_name,
      is_primary: false,
      confidence_score: 0.8
    });
  }
  
  // MYOB mapping 2
  if (driver.myob_driver_name_2 && driver.myob_driver_name_2 !== driver.standard_driver_name) {
    mappings.push({
      driver_id: driverId,
      system_name: 'MYOB',
      mapped_name: driver.myob_driver_name_2,
      is_primary: false,
      confidence_score: 0.8
    });
  }
  
  // MtData mapping
  if (driver.mtdata_name && driver.mtdata_name !== driver.standard_driver_name) {
    mappings.push({
      driver_id: driverId,
      system_name: 'MtData',
      mapped_name: driver.mtdata_name,
      is_primary: false,
      confidence_score: 0.9
    });
  }
  
  // SmartFuel mapping
  if (driver.fuel_usage_smartfuel_name && driver.fuel_usage_smartfuel_name !== driver.standard_driver_name) {
    mappings.push({
      driver_id: driverId,
      system_name: 'SmartFuel',
      mapped_name: driver.fuel_usage_smartfuel_name,
      is_primary: false,
      confidence_score: 0.9
    });
  }
  
  // LYTX mapping
  if (driver.lytx_driver_name && driver.lytx_driver_name !== driver.standard_driver_name) {
    mappings.push({
      driver_id: driverId,
      system_name: 'LYTX',
      mapped_name: driver.lytx_driver_name,
      is_primary: false,
      confidence_score: 0.9
    });
  }
  
  // Insert all mappings
  if (mappings.length > 0) {
    const { error: mappingError } = await supabase
      .from('driver_name_mappings')
      .insert(mappings);
    
    if (mappingError) {
      console.error(`Error inserting name mappings for driver ${driverId}:`, mappingError);
    }
  }
}

function generateEmployeeId(firstName, lastName) {
  // Generate a deterministic employee ID based on name (no timestamp)
  const prefix = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  // Use a hash of the full name for consistency
  const nameHash = (firstName + lastName).toLowerCase()
    .split('')
    .reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0);
    }, 0);
  const suffix = Math.abs(nameHash).toString().padStart(4, '0').slice(-4);
  return `${prefix}${suffix}`;
}

async function verifyImport() {
  console.log('\nVerifying import...');
  
  // Count total drivers
  const { count: driverCount } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true });
  
  // Count total name mappings
  const { count: mappingCount } = await supabase
    .from('driver_name_mappings')
    .select('*', { count: 'exact', head: true });
  
  // Count by fleet
  const { data: fleetStats } = await supabase
    .from('drivers')
    .select('fleet')
    .eq('status', 'Active');
  
  const fleetCounts = fleetStats.reduce((acc, driver) => {
    acc[driver.fleet] = (acc[driver.fleet] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`\nImport verification:`);
  console.log(`- Total drivers: ${driverCount}`);
  console.log(`- Total name mappings: ${mappingCount}`);
  console.log(`- Fleet breakdown:`);
  Object.entries(fleetCounts).forEach(([fleet, count]) => {
    console.log(`  - ${fleet}: ${count} drivers`);
  });
}

// Main execution
async function main() {
  try {
    console.log('Starting driver import...');
    await importDriversFromCSV();
    await verifyImport();
    console.log('\nDriver import completed successfully!');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
