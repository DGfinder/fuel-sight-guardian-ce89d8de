#!/usr/bin/env node

/**
 * Driver CSV Import Script
 * 
 * Imports driver names and mappings from Driver Names Mapping CSV to drivers and driver_name_mappings tables
 * Usage: node scripts/import-drivers-csv.js <csv-file-path>
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
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/import-drivers-csv.js <csv-file>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get CSV file path from command line argument
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error('❌ Please provide CSV file path as argument');
  console.error('   Usage: node scripts/import-drivers-csv.js <csv-file-path>');
  process.exit(1);
}

// Resolve absolute path
const absoluteCsvPath = path.resolve(csvFilePath);

if (!fs.existsSync(absoluteCsvPath)) {
  console.error(`❌ CSV file not found: ${absoluteCsvPath}`);
  process.exit(1);
}

console.log('👨‍💼 Driver CSV Import Script');
console.log('📁 CSV File:', absoluteCsvPath);
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Parse CSV line handling quoted fields properly
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
  if (!fleetName || fleetName.trim() === '') {
    return 'Stevemacs'; // Default fallback
  }
  
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
 * Normalize driver name - remove extra spaces, handle case
 */
function normalizeDriverName(name) {
  if (!name || name.trim() === '') {
    return '';
  }
  
  return name.trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[""]/g, '"') // Normalize quote characters
    .trim();
}

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create driver record from CSV row
 */
function createDriverRecord(rowData, headers) {
  const fleetIndex = headers.findIndex(h => h.toLowerCase().includes('fleet'));
  const standardNameIndex = headers.findIndex(h => h.toLowerCase().includes('standard driver name'));
  const depotIndex = headers.findIndex(h => h.toLowerCase().includes('depot'));
  
  const fleet = fleetIndex >= 0 ? normalizeFleetName(rowData[fleetIndex]) : 'Stevemacs';
  const standardName = standardNameIndex >= 0 ? normalizeDriverName(rowData[standardNameIndex]) : '';
  const depot = depotIndex >= 0 ? rowData[depotIndex]?.trim() || 'Unknown' : 'Unknown';
  
  if (!standardName) {
    return null; // Skip rows without a standard name
  }
  
  // Parse first and last name
  const nameParts = standardName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return {
    id: generateUUID(),
    first_name: firstName,
    last_name: lastName,
    preferred_name: null,
    full_name: standardName,
    employee_id: null,
    fleet: fleet,
    depot: depot,
    hire_date: null,
    status: 'Active',
    email: null,
    phone: null,
    address: null,
    drivers_license: null,
    license_expiry: null,
    certifications: null,
    safety_score: 0,
    lytx_score: 0,
    guardian_score: 0,
    overall_performance_rating: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null
  };
}

/**
 * Create name mapping records for each system
 */
function createNameMappings(driverId, rowData, headers) {
  const mappings = [];
  
  // Define system name mappings
  const systemMappings = [
    { system: 'Standard', headerPattern: 'standard driver name' },
    { system: 'LYTX', headerPattern: 'lytx driver name' },
    { system: 'MYOB', headerPattern: 'myob driver name' },
    { system: 'MtData', headerPattern: 'mtdata name' },
    { system: 'SmartFuel', headerPattern: 'fuel usage' },
    { system: 'Guardian', headerPattern: 'driver hours' }
  ];
  
  systemMappings.forEach(({ system, headerPattern }) => {
    const headerIndex = headers.findIndex(h => 
      h.toLowerCase().includes(headerPattern.toLowerCase())
    );
    
    if (headerIndex >= 0) {
      const mappedName = normalizeDriverName(rowData[headerIndex]);
      
      if (mappedName) {
        mappings.push({
          id: generateUUID(),
          driver_id: driverId,
          system_name: system,
          mapped_name: mappedName,
          is_primary: system === 'Standard',
          confidence_score: system === 'Standard' ? 1.0 : 0.95,
          created_at: new Date().toISOString(),
          created_by: null
        });
      }
    }
  });
  
  // Handle MYOB Driver Name 2 if present
  const myobName2Index = headers.findIndex(h => 
    h.toLowerCase().includes('myob driver name 2')
  );
  
  if (myobName2Index >= 0) {
    const myobName2 = normalizeDriverName(rowData[myobName2Index]);
    if (myobName2) {
      mappings.push({
        id: generateUUID(),
        driver_id: driverId,
        system_name: 'MYOB',
        mapped_name: myobName2,
        is_primary: false,
        confidence_score: 0.95,
        created_at: new Date().toISOString(),
        created_by: null
      });
    }
  }
  
  return mappings;
}

/**
 * Import drivers CSV
 */
async function importDriversCSV() {
  try {
    console.log('📖 Reading driver CSV file...');
    
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
    const requiredHeaders = ['Fleet', 'Standard Driver Name', 'Depot'];
    const missingHeaders = requiredHeaders.filter(h => !headers.some(header => 
      header.toLowerCase().includes(h.toLowerCase())
    ));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    
    console.log('✅ CSV structure validated');
    
    // Process CSV rows
    const driverRecords = [];
    const allNameMappings = [];
    const errors = [];
    
    console.log('🔄 Processing CSV records...');
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        // Skip empty rows or rows with insufficient data
        if (values.length < headers.length - 2) {
          continue;
        }
        
        const driverRecord = createDriverRecord(values, headers);
        
        if (driverRecord) {
          driverRecords.push(driverRecord);
          
          // Create name mappings for this driver
          const nameMappings = createNameMappings(driverRecord.id, values, headers);
          allNameMappings.push(...nameMappings);
        }
        
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`✅ Processed ${driverRecords.length} valid driver records`);
    console.log(`📋 Generated ${allNameMappings.length} name mappings`);
    
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors found:`);
      errors.slice(0, 5).forEach(error => console.log(`   ${error}`));
      if (errors.length > 5) {
        console.log(`   ...and ${errors.length - 5} more errors`);
      }
    }
    
    if (driverRecords.length === 0) {
      throw new Error('No valid driver records to import');
    }
    
    // Show fleet distribution
    const fleetCounts = driverRecords.reduce((acc, driver) => {
      acc[driver.fleet] = (acc[driver.fleet] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Fleet distribution:');
    Object.entries(fleetCounts).forEach(([fleet, count]) => {
      console.log(`   ${fleet}: ${count} drivers`);
    });
    
    // Show depot distribution
    const depotCounts = driverRecords.reduce((acc, driver) => {
      acc[driver.depot] = (acc[driver.depot] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📍 Depot distribution:');
    Object.entries(depotCounts).forEach(([depot, count]) => {
      console.log(`   ${depot}: ${count} drivers`);
    });
    
    // Check for existing drivers
    console.log('🔍 Checking for existing drivers...');
    const { data: existingDrivers, error: checkError } = await supabase
      .from('drivers')
      .select('full_name')
      .in('full_name', driverRecords.map(d => d.full_name));
    
    if (checkError) {
      console.warn(`⚠️  Could not check existing drivers: ${checkError.message}`);
    } else if (existingDrivers && existingDrivers.length > 0) {
      console.log(`📋 Found ${existingDrivers.length} existing drivers that will be skipped`);
      
      // Filter out existing drivers
      const existingNames = new Set(existingDrivers.map(d => d.full_name));
      const newDriverRecords = driverRecords.filter(d => !existingNames.has(d.full_name));
      const newDriverIds = new Set(newDriverRecords.map(d => d.id));
      const newNameMappings = allNameMappings.filter(m => newDriverIds.has(m.driver_id));
      
      console.log(`➡️  Will import ${newDriverRecords.length} new drivers with ${newNameMappings.length} mappings`);
      
      if (newDriverRecords.length === 0) {
        console.log('✅ All drivers already exist in database');
        return;
      }
      
      // Update variables to use filtered data
      driverRecords.length = 0;
      driverRecords.push(...newDriverRecords);
      allNameMappings.length = 0;
      allNameMappings.push(...newNameMappings);
    }
    
    // Insert drivers first
    console.log('💾 Inserting drivers in database...');
    
    const driverBatchSize = 50;
    let insertedDriverCount = 0;
    let failedDriverCount = 0;
    
    for (let i = 0; i < driverRecords.length; i += driverBatchSize) {
      const batchRecords = driverRecords.slice(i, i + driverBatchSize);
      
      console.log(`   Processing driver batch ${Math.floor(i / driverBatchSize) + 1}/${Math.ceil(driverRecords.length / driverBatchSize)} (${batchRecords.length} records)...`);
      
      try {
        const { error: insertError } = await supabase
          .from('drivers')
          .insert(batchRecords);
        
        if (insertError) {
          console.error(`   ❌ Driver batch failed: ${insertError.message}`);
          failedDriverCount += batchRecords.length;
        } else {
          console.log(`   ✅ Driver batch processed successfully`);
          insertedDriverCount += batchRecords.length;
        }
      } catch (error) {
        console.error(`   ❌ Driver batch processing error: ${error.message}`);
        failedDriverCount += batchRecords.length;
      }
    }
    
    if (insertedDriverCount === 0) {
      throw new Error('Failed to insert any driver records');
    }
    
    // Insert name mappings
    console.log('💾 Inserting name mappings in database...');
    
    const mappingBatchSize = 100;
    let insertedMappingCount = 0;
    let failedMappingCount = 0;
    
    for (let i = 0; i < allNameMappings.length; i += mappingBatchSize) {
      const batchMappings = allNameMappings.slice(i, i + mappingBatchSize);
      
      console.log(`   Processing mapping batch ${Math.floor(i / mappingBatchSize) + 1}/${Math.ceil(allNameMappings.length / mappingBatchSize)} (${batchMappings.length} records)...`);
      
      try {
        const { error: insertError } = await supabase
          .from('driver_name_mappings')
          .insert(batchMappings);
        
        if (insertError) {
          console.error(`   ❌ Mapping batch failed: ${insertError.message}`);
          failedMappingCount += batchMappings.length;
        } else {
          console.log(`   ✅ Mapping batch processed successfully`);
          insertedMappingCount += batchMappings.length;
        }
      } catch (error) {
        console.error(`   ❌ Mapping batch processing error: ${error.message}`);
        failedMappingCount += batchMappings.length;
      }
    }
    
    console.log('');
    console.log('🎉 Driver import completed!');
    console.log(`✅ Successfully inserted: ${insertedDriverCount.toLocaleString()} drivers`);
    console.log(`✅ Successfully inserted: ${insertedMappingCount.toLocaleString()} name mappings`);
    console.log(`❌ Failed drivers: ${failedDriverCount.toLocaleString()}`);
    console.log(`❌ Failed mappings: ${failedMappingCount.toLocaleString()}`);
    
    if (insertedDriverCount > 0) {
      console.log('');
      console.log('🔍 You can now view the driver data in:');
      console.log('   • Driver Management: http://localhost:5173/driver-management');
      console.log('   • Trip data will now be able to correlate with drivers');
      console.log('   • Safety events can be matched to specific drivers');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import
importDriversCSV();