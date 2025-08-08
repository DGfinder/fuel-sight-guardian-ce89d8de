#!/usr/bin/env node

/**
 * Guardian CSV Import Script
 * 
 * Imports Guardian events CSV data directly to Supabase
 * Usage: node scripts/import-guardian-csv.js <csv-file-path>
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { 
  createRegistrationLookupMap, 
  lookupVehicleFleet,
  normalizeRegistration 
} from '../utils/registrationNormalizer.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../.env') });

// Supabase configuration (you'll need to set these environment variables)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   Please set it in your .env file or run with:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/import-guardian-csv.js <csv-file>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get CSV file path from command line argument
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error('❌ Please provide CSV file path as argument');
  console.error('   Usage: node scripts/import-guardian-csv.js <csv-file-path>');
  process.exit(1);
}

// Resolve absolute path
const absoluteCsvPath = path.resolve(csvFilePath);

if (!fs.existsSync(absoluteCsvPath)) {
  console.error(`❌ CSV file not found: ${absoluteCsvPath}`);
  process.exit(1);
}

console.log('🚀 Guardian CSV Import Script');
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
 * Parse date time from Guardian format with robust format detection
 */
function parseDateTime(dateTime, recordIndex = null) {
  const originalDateTime = dateTime;
  
  try {
    // Handle ISO format with T (e.g., 2024-03-31T10:30:00 or 2024-03-31T10:30:00.000Z)
    if (dateTime.includes('T') && dateTime.length >= 19) {
      const parsed = new Date(dateTime);
      if (!isNaN(parsed.getTime())) {
        const result = parsed.toISOString();
        console.log(`📅 Parsed ISO format: ${originalDateTime} → ${result}${recordIndex ? ` (row ${recordIndex})` : ''}`);
        return result;
      }
    }
    
    // Handle date-only formats (no time component)
    const dateOnlyMatch = dateTime.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/) || 
                          dateTime.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    
    if (dateOnlyMatch) {
      let day, month, year;
      
      // Determine if it's YYYY-MM-DD or DD/MM/YYYY format
      if (parseInt(dateOnlyMatch[1]) > 31) {
        // First part > 31, must be YYYY-MM-DD format
        year = parseInt(dateOnlyMatch[1]);
        month = parseInt(dateOnlyMatch[2]);
        day = parseInt(dateOnlyMatch[3]);
        console.log(`📅 Detected YYYY-MM-DD format: ${originalDateTime}`);
      } else if (parseInt(dateOnlyMatch[3]) > 31 || parseInt(dateOnlyMatch[3]) > 2000) {
        // Third part > 31 or > 2000, must be DD/MM/YYYY format
        day = parseInt(dateOnlyMatch[1]);
        month = parseInt(dateOnlyMatch[2]);
        year = parseInt(dateOnlyMatch[3]);
        console.log(`📅 Detected DD/MM/YYYY format: ${originalDateTime}`);
      } else {
        // Ambiguous case - need to make educated guess
        // Check if month value makes sense (1-12)
        if (parseInt(dateOnlyMatch[2]) <= 12) {
          // Could be either format, but prefer DD/MM/YYYY for Guardian data (Australian)
          day = parseInt(dateOnlyMatch[1]);
          month = parseInt(dateOnlyMatch[2]);
          year = parseInt(dateOnlyMatch[3]);
          console.log(`📅 Ambiguous date, assuming DD/MM/YYYY: ${originalDateTime}`);
        } else {
          // Second part > 12, must be MM/DD/YYYY format (but unlikely for Guardian)
          month = parseInt(dateOnlyMatch[1]);
          day = parseInt(dateOnlyMatch[2]);
          year = parseInt(dateOnlyMatch[3]);
          console.log(`📅 Detected MM/DD/YYYY format: ${originalDateTime}`);
        }
      }
      
      // Validate date components
      if (year < 2020 || year > 2030) {
        throw new Error(`Invalid year: ${year} (expected 2020-2030)`);
      }
      if (month < 1 || month > 12) {
        throw new Error(`Invalid month: ${month} (expected 1-12)`);
      }
      if (day < 1 || day > 31) {
        throw new Error(`Invalid day: ${day} (expected 1-31)`);
      }
      
      const parsed = new Date(year, month - 1, day);
      
      // Validate the date actually exists (e.g., not Feb 31)
      if (parsed.getFullYear() !== year || parsed.getMonth() !== (month - 1) || parsed.getDate() !== day) {
        throw new Error(`Invalid date: ${day}/${month}/${year} does not exist`);
      }
      
      // Check for future dates (data integrity check)
      const today = new Date();
      if (parsed > today) {
        console.warn(`⚠️  Future date detected: ${originalDateTime} → ${parsed.toISOString()}, rejecting record${recordIndex ? ` (row ${recordIndex})` : ''}`);
        throw new Error(`Future date not allowed: ${originalDateTime}`);
      }
      
      const result = parsed.toISOString();
      console.log(`📅 Successfully parsed: ${originalDateTime} → ${result}${recordIndex ? ` (row ${recordIndex})` : ''}`);
      return result;
    }
    
    // Try default JavaScript parsing as last resort (for complex formats)
    const parsed = new Date(dateTime);
    if (!isNaN(parsed.getTime())) {
      // Still check for future dates
      const today = new Date();
      if (parsed > today) {
        console.warn(`⚠️  Future date from JS parsing: ${originalDateTime}, rejecting record${recordIndex ? ` (row ${recordIndex})` : ''}`);
        throw new Error(`Future date not allowed: ${originalDateTime}`);
      }
      
      const result = parsed.toISOString();
      console.log(`📅 JS parsed: ${originalDateTime} → ${result}${recordIndex ? ` (row ${recordIndex})` : ''}`);
      return result;
    }
    
    throw new Error('No valid date format detected');
  } catch (error) {
    console.error(`❌ Date parsing failed for "${originalDateTime}": ${error.message}${recordIndex ? ` (row ${recordIndex})` : ''}`);
    throw error; // Reject the record - don't use fallback dates
  }
}

/**
 * Parse number from string
 */
function parseNumber(value) {
  if (!value || value === '') return null;
  const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Map Guardian severity based on event type and classification
 */
function mapGuardianSeverity(eventType, classification, confirmation) {
  const type = eventType.toLowerCase();
  const classif = classification.toLowerCase();
  const confirm = confirmation.toLowerCase();
  
  // Critical events
  if (type.includes('fatigue') || type.includes('microsleep')) {
    return 'Critical';
  }
  
  // High severity events
  if (type.includes('distraction') && !type.includes('minor')) {
    return 'High';
  }
  
  if (type.includes('phone') || type.includes('mobile')) {
    return 'High';
  }
  
  // Medium severity events
  if (type.includes('eating') || type.includes('drinking') || type.includes('smoking')) {
    return 'Medium';
  }
  
  if (type.includes('fov') && type.includes('exception')) {
    return 'Medium';
  }
  
  // Check classification for severity indicators
  if (classif.includes('verified') || confirm.includes('verified')) {
    if (type.includes('distraction')) return 'High';
    return 'Medium';
  }
  
  return 'Low';
}

/**
 * Map Guardian status based on confirmation and classification
 */
function mapGuardianStatus(confirmation, classification) {
  const confirm = confirmation.toLowerCase();
  const classif = classification.toLowerCase();
  
  if (confirm.includes('verified') || classif.includes('verified')) {
    return 'Verified';
  }
  
  if (confirm.includes('false') || classif.includes('false')) {
    return 'False Positive';
  }
  
  if (confirm.includes('criteria not met') || classif.includes('criteria not met')) {
    return 'Criteria Not Met';
  }
  
  if (confirm.includes('pending') || classif.includes('pending')) {
    return 'Pending Review';
  }
  
  return 'Active';
}

/**
 * Enhanced fleet lookup with database integration
 */
function getVehicleFleet(vehicleRegistration, csvFleetValue, fleetLookupMap) {
  // First try database lookup with fuzzy matching
  if (fleetLookupMap) {
    const fleetFromDb = lookupVehicleFleet(vehicleRegistration, fleetLookupMap);
    if (fleetFromDb) {
      return fleetFromDb;
    }
  }
  
  // Fall back to pattern-based detection
  return determineFleet(csvFleetValue || '', vehicleRegistration);
}

/**
 * Determine fleet from Guardian data (fallback method)
 */
function determineFleet(fleetValue, vehicleRegistration) {
  const fleetLower = fleetValue.toLowerCase();
  
  if (fleetLower.includes('great southern') || fleetLower.includes('gsf')) {
    return 'Great Southern Fuels';
  }
  if (fleetLower.includes('stevemacs') || fleetLower.includes('steve')) {
    return 'Stevemacs';
  }
  
  // Infer from vehicle registration patterns
  const rego = vehicleRegistration.toLowerCase();
  
  if (rego.startsWith('gsf') || rego.includes('southern')) {
    return 'Great Southern Fuels';
  }
  
  if (rego.startsWith('sm') || rego.includes('steve')) {
    return 'Stevemacs';
  }
  
  // Default based on sample data (all appears to be Stevemacs)
  return 'Stevemacs';
}

/**
 * Infer depot from vehicle registration
 */
function inferDepotFromVehicle(vehicleRegistration) {
  const vehicle = vehicleRegistration.toLowerCase();
  
  // Customize these patterns based on actual fleet vehicle numbering
  if (vehicle.includes('kal') || vehicle.startsWith('k')) return 'Kalgoorlie';
  if (vehicle.includes('alb') || vehicle.startsWith('a')) return 'Albany';
  if (vehicle.includes('kew') || vehicle.includes('per') || vehicle.startsWith('p')) return 'Kewdale';
  if (vehicle.includes('bun') || vehicle.startsWith('b')) return 'Bunbury';
  
  return 'Unknown';
}

/**
 * Process CSV and import to Supabase
 */
async function importGuardianCsv() {
  try {
    console.log('📖 Reading CSV file...');
    
    const csvContent = fs.readFileSync(absoluteCsvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty or has no data rows');
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    console.log('📊 Headers found:', headers.length);
    console.log('📈 Data rows:', lines.length - 1);
    
    // Validate expected headers
    const expectedHeaders = ['event_id', 'vehicle_id', 'vehicle', 'detection_time', 'event_type'];
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    
    console.log('✅ CSV structure validated');
    
    // Create import batch record
    const batchReference = `guardian_csv_${Date.now()}`;
    const fileName = path.basename(absoluteCsvPath);
    
    console.log('📝 Creating import batch record...');
    
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'guardian_events',
        source_subtype: 'CSV',
        file_name: fileName,
        batch_reference: batchReference,
        status: 'processing',
        created_by: null // System import, no specific user
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Failed to create import batch: ${batchError.message}`);
    }
    
    console.log('📦 Import batch created:', batch.id);
    
    // Load vehicle fleet data for accurate lookups
    console.log('🚚 Loading vehicle fleet data for accurate matching...');
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('registration, fleet');
    
    if (vehiclesError) {
      console.warn(`⚠️  Could not load vehicle fleet data: ${vehiclesError.message}`);
      console.log('   Falling back to pattern-based fleet detection');
    }
    
    // Create enhanced fleet lookup map
    const fleetLookupMap = vehicles ? createRegistrationLookupMap(vehicles, 'registration', 'fleet') : null;
    
    if (fleetLookupMap) {
      console.log(`✅ Loaded fleet data for ${vehicles.length} vehicles`);
    }
    
    // Process CSV rows
    const dbRecords = [];
    const errors = [];
    
    console.log('🔄 Processing CSV records...');
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        if (values.length < headers.length) {
          errors.push(`Row ${i + 1}: Insufficient columns (${values.length} vs ${headers.length})`);
          continue;
        }
        
        // Map values to object
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        
        // Validate required fields
        if (!record.event_id || !record.vehicle || !record.detection_time || !record.event_type) {
          errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }
        
        // Parse detection_time (required) - reject record if parsing fails
        let detection_time;
        try {
          detection_time = parseDateTime(record.detection_time, i + 1);
        } catch (error) {
          errors.push(`Row ${i + 1}: Invalid detection_time format: ${record.detection_time} - ${error.message}`);
          continue;
        }
        
        // Skip confirmation_time parsing - it uses different format and we focus on detection_time only
        let confirmation_time = null;
        if (record.confirmation_time) {
          // Simply store as null since detection_time is the key field and confirmation_time uses different format
          console.log(`Row ${i + 1}: Skipping confirmation_time parsing (${record.confirmation_time}) - focusing on detection_time only`);
        }
        
        // Transform to database format
        const dbRecord = {
          external_event_id: record.event_id,
          vehicle_id: record.vehicle_id || null,
          vehicle_registration: record.vehicle,
          driver_name: record.driver || null,
          detection_time: detection_time,
          utc_offset: record.utc_offset ? parseInt(record.utc_offset) : null,
          timezone: record.timezone || null,
          latitude: parseNumber(record.latitude),
          longitude: parseNumber(record.longitude),
          event_type: record.event_type,
          detected_event_type: record.detected_event_type || null,
          confirmation: record.confirmation || null,
          confirmation_time: confirmation_time,
          classification: record.classification || null,
          duration_seconds: parseNumber(record.duration_seconds),
          speed_kph: parseNumber(record.speed_kph),
          travel_metres: parseNumber(record.travel_metres),
          trip_distance_metres: parseNumber(record.trip_distance_metres),
          trip_time_seconds: record.trip_time_seconds ? parseInt(record.trip_time_seconds) : null,
          audio_alert: record.audio_alert === 'yes',
          vibration_alert: record.vibration_alert === 'yes',
          fleet: getVehicleFleet(record.vehicle, record.fleet, fleetLookupMap),
          account: record.account || null,
          service_provider: record.service_provider || null,
          shift_info: record.shift || null,
          crew: record.crew || null,
          guardian_unit: record.guardian_unit || null,
          software_version: record.software_version || null,
          tags: record.tags || null,
          severity: mapGuardianSeverity(record.event_type, record.classification || '', record.confirmation || ''),
          verified: (record.confirmation || '').toLowerCase().includes('verified'),
          status: mapGuardianStatus(record.confirmation || '', record.classification || ''),
          depot: inferDepotFromVehicle(record.vehicle),
          import_batch_id: batchReference,
          raw_data: {
            complete_guardian_record: record
          }
        };
        
        dbRecords.push(dbRecord);
        
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`✅ Processed ${dbRecords.length} valid records`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors found:`);
      errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (errors.length > 10) {
        console.log(`   ...and ${errors.length - 10} more errors`);
      }
    }
    
    if (dbRecords.length === 0) {
      throw new Error('No valid records to import');
    }
    
    // Insert records in batches
    console.log('💾 Inserting records to database...');
    
    const batchSize = 100;
    let insertedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < dbRecords.length; i += batchSize) {
      const batchRecords = dbRecords.slice(i, i + batchSize);
      
      console.log(`   Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dbRecords.length / batchSize)} (${batchRecords.length} records)...`);
      
      const { error: insertError } = await supabase
        .from('guardian_events')
        .insert(batchRecords);
      
      if (insertError) {
        console.error(`   ❌ Batch failed: ${insertError.message}`);
        failedCount += batchRecords.length;
      } else {
        console.log(`   ✅ Batch inserted successfully`);
        insertedCount += batchRecords.length;
      }
    }
    
    // Update batch status
    const status = failedCount > 0 ? (insertedCount > 0 ? 'partial' : 'failed') : 'completed';
    
    await supabase
      .from('data_import_batches')
      .update({
        records_processed: insertedCount,
        records_failed: failedCount,
        status: status,
        completed_at: new Date().toISOString(),
        error_summary: errors.length > 0 ? { errors: errors.slice(0, 100) } : null
      })
      .eq('id', batch.id);
    
    console.log('');
    console.log('🎉 Import completed!');
    console.log(`✅ Successfully imported: ${insertedCount.toLocaleString()} records`);
    console.log(`❌ Failed: ${failedCount.toLocaleString()} records`);
    console.log(`📦 Batch ID: ${batch.id}`);
    console.log(`📊 Status: ${status}`);
    
    if (insertedCount > 0) {
      console.log('');
      console.log('🔍 You can now view the Guardian events in:');
      console.log('   • Guardian Dashboard: http://localhost:5173/data-centre/guardian');
      console.log('   • Data Import page: http://localhost:5173/data-centre/import');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import
importGuardianCsv();