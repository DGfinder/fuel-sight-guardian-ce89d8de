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
 * Parse date time from Guardian format
 */
function parseDateTime(dateTime) {
  try {
    if (dateTime.includes('T') && dateTime.length >= 19) {
      const parsed = new Date(dateTime);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    
    // Try parsing YYYY-MM-DD HH:MM:SS format
    const parsed = new Date(dateTime);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    
    throw new Error('Invalid date format');
  } catch {
    console.warn(`⚠️  Invalid date format: ${dateTime}, using current time`);
    return new Date().toISOString();
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
 * Determine fleet from Guardian data
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
        
        // Transform to database format
        const dbRecord = {
          external_event_id: record.event_id,
          vehicle_id: record.vehicle_id || null,
          vehicle_registration: record.vehicle,
          driver_name: record.driver || null,
          detection_time: parseDateTime(record.detection_time),
          utc_offset: record.utc_offset ? parseInt(record.utc_offset) : null,
          timezone: record.timezone || null,
          latitude: parseNumber(record.latitude),
          longitude: parseNumber(record.longitude),
          event_type: record.event_type,
          detected_event_type: record.detected_event_type || null,
          confirmation: record.confirmation || null,
          confirmation_time: record.confirmation_time ? parseDateTime(record.confirmation_time) : null,
          classification: record.classification || null,
          duration_seconds: parseNumber(record.duration_seconds),
          speed_kph: parseNumber(record.speed_kph),
          travel_metres: parseNumber(record.travel_metres),
          trip_distance_metres: parseNumber(record.trip_distance_metres),
          trip_time_seconds: record.trip_time_seconds ? parseInt(record.trip_time_seconds) : null,
          audio_alert: record.audio_alert === 'yes',
          vibration_alert: record.vibration_alert === 'yes',
          fleet: determineFleet(record.fleet || '', record.vehicle),
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