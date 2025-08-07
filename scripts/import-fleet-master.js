#!/usr/bin/env node

/**
 * Fleet Master CSV Import Script
 * 
 * Imports vehicle fleet assignments from Master CSV to vehicles table
 * Usage: node scripts/import-fleet-master.js <csv-file-path>
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

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
  console.error('   Please set it in your .env file or run with:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/import-fleet-master.js <csv-file>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get CSV file path from command line argument
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error('❌ Please provide CSV file path as argument');
  console.error('   Usage: node scripts/import-fleet-master.js <csv-file-path>');
  process.exit(1);
}

// Resolve absolute path
const absoluteCsvPath = path.resolve(csvFilePath);

if (!fs.existsSync(absoluteCsvPath)) {
  console.error(`❌ CSV file not found: ${absoluteCsvPath}`);
  process.exit(1);
}

console.log('🚛 Fleet Master CSV Import Script');
console.log('📁 CSV File:', absoluteCsvPath);
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Normalize fleet name to match database enum
 */
function normalizeFleetName(fleetName) {
  const fleet = fleetName.toLowerCase().trim();
  
  if (fleet.includes('great southern') || fleet === 'great southern') {
    return 'Great Southern Fuels';
  }
  
  if (fleet.includes('stevemacs') || fleet === 'stevemacs') {
    return 'Stevemacs';
  }
  
  // Default fallback
  console.warn(`⚠️  Unknown fleet name: "${fleetName}", defaulting to Stevemacs`);
  return 'Stevemacs';
}

/**
 * Normalize depot name
 */
function normalizeDepotName(depotName) {
  if (!depotName || depotName.trim() === '') {
    return 'Unknown';
  }
  
  // Clean up depot name
  return depotName.trim();
}

/**
 * Clean registration number
 */
function cleanRegistration(registration) {
  if (!registration) return '';
  
  // Remove extra spaces and normalize
  return registration.trim().replace(/\s+/g, '').toUpperCase();
}

/**
 * Import fleet master CSV to vehicles table
 */
async function importFleetMaster() {
  try {
    console.log('📖 Reading fleet master CSV file...');
    
    const csvContent = fs.readFileSync(absoluteCsvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty or has no data rows');
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    console.log('📊 Headers found:', headers);
    console.log('📈 Data rows:', lines.length - 1);
    
    // Validate expected headers
    const expectedHeaders = ['Registration', 'Fleet', 'Depot'];
    const missingHeaders = expectedHeaders.filter(h => !headers.some(header => 
      header.toLowerCase().includes(h.toLowerCase())
    ));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    
    console.log('✅ CSV structure validated');
    
    // Find header indexes
    const registrationIndex = headers.findIndex(h => h.toLowerCase().includes('registration'));
    const fleetIndex = headers.findIndex(h => h.toLowerCase().includes('fleet'));
    const depotIndex = headers.findIndex(h => h.toLowerCase().includes('depot'));
    
    if (registrationIndex === -1 || fleetIndex === -1 || depotIndex === -1) {
      throw new Error('Could not find required columns in CSV');
    }
    
    console.log(`📍 Column mapping: Registration=${registrationIndex}, Fleet=${fleetIndex}, Depot=${depotIndex}`);
    
    // Process CSV rows
    const vehicleRecords = [];
    const errors = [];
    const duplicateCheck = new Map();
    
    console.log('🔄 Processing CSV records...');
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        if (values.length < Math.max(registrationIndex, fleetIndex, depotIndex) + 1) {
          errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }
        
        const registration = cleanRegistration(values[registrationIndex]);
        const fleetName = values[fleetIndex]?.trim();
        const depotName = values[depotIndex]?.trim();
        
        // Validate required fields
        if (!registration || !fleetName) {
          errors.push(`Row ${i + 1}: Missing registration or fleet`);
          continue;
        }
        
        // Check for duplicates
        if (duplicateCheck.has(registration)) {
          console.warn(`⚠️  Duplicate registration found: ${registration} (keeping first occurrence)`);
          continue;
        }
        duplicateCheck.set(registration, true);
        
        // Create vehicle record
        const vehicleRecord = {
          registration: registration,
          fleet: normalizeFleetName(fleetName),
          depot: normalizeDepotName(depotName),
          status: 'Active',
          make: null,
          model: null,
          year: null,
          vin: null,
          guardian_unit: null,
          lytx_device: null,
          safety_score: 0,
          fuel_efficiency: 0,
          utilization: 0,
          total_deliveries: 0,
          total_kilometers: 0,
          fatigue_events: 0,
          safety_events: 0,
          last_service: null,
          next_service: null,
          registration_expiry: null,
          insurance_expiry: null,
          inspection_due: null
        };
        
        vehicleRecords.push(vehicleRecord);
        
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`✅ Processed ${vehicleRecords.length} valid vehicle records`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors found:`);
      errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (errors.length > 10) {
        console.log(`   ...and ${errors.length - 10} more errors`);
      }
    }
    
    if (vehicleRecords.length === 0) {
      throw new Error('No valid vehicle records to import');
    }
    
    // Show fleet distribution
    const fleetCounts = vehicleRecords.reduce((acc, vehicle) => {
      acc[vehicle.fleet] = (acc[vehicle.fleet] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Fleet distribution:');
    Object.entries(fleetCounts).forEach(([fleet, count]) => {
      console.log(`   ${fleet}: ${count} vehicles`);
    });
    
    // Show depot distribution
    const depotCounts = vehicleRecords.reduce((acc, vehicle) => {
      acc[vehicle.depot] = (acc[vehicle.depot] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📍 Depot distribution:');
    Object.entries(depotCounts).forEach(([depot, count]) => {
      console.log(`   ${depot}: ${count} vehicles`);
    });
    
    // Check for existing vehicles
    console.log('🔍 Checking for existing vehicles...');
    const existingRegistrations = [];
    const { data: existingVehicles, error: checkError } = await supabase
      .from('vehicles')
      .select('registration')
      .in('registration', vehicleRecords.map(v => v.registration));
    
    if (checkError) {
      console.warn(`⚠️  Could not check existing vehicles: ${checkError.message}`);
    } else if (existingVehicles && existingVehicles.length > 0) {
      existingRegistrations.push(...existingVehicles.map(v => v.registration));
      console.log(`📋 Found ${existingRegistrations.length} existing vehicles that will be updated`);
    }
    
    // Insert/Update records in batches
    console.log('💾 Inserting/updating vehicles in database...');
    
    const batchSize = 50;
    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < vehicleRecords.length; i += batchSize) {
      const batchRecords = vehicleRecords.slice(i, i + batchSize);
      
      console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vehicleRecords.length / batchSize)} (${batchRecords.length} records)...`);
      
      try {
        // Use upsert to handle both insert and update
        const { error: upsertError, count } = await supabase
          .from('vehicles')
          .upsert(batchRecords, { 
            onConflict: 'registration',
            count: 'exact'
          });
        
        if (upsertError) {
          console.error(`   ❌ Batch failed: ${upsertError.message}`);
          failedCount += batchRecords.length;
        } else {
          console.log(`   ✅ Batch processed successfully`);
          
          // Count inserts vs updates
          const batchInserted = batchRecords.filter(v => !existingRegistrations.includes(v.registration)).length;
          const batchUpdated = batchRecords.length - batchInserted;
          
          insertedCount += batchInserted;
          updatedCount += batchUpdated;
        }
      } catch (error) {
        console.error(`   ❌ Batch processing error: ${error.message}`);
        failedCount += batchRecords.length;
      }
    }
    
    console.log('');
    console.log('🎉 Fleet master import completed!');
    console.log(`✅ Successfully inserted: ${insertedCount.toLocaleString()} new vehicles`);
    console.log(`🔄 Successfully updated: ${updatedCount.toLocaleString()} existing vehicles`);
    console.log(`❌ Failed: ${failedCount.toLocaleString()} vehicles`);
    
    if (insertedCount > 0 || updatedCount > 0) {
      console.log('');
      console.log('🔍 You can now view the fleet data in:');
      console.log('   • Vehicle Database: http://localhost:5173/fleet-management/vehicles');
      console.log('   • Guardian Dashboard will use correct fleet assignments');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import
importFleetMaster();