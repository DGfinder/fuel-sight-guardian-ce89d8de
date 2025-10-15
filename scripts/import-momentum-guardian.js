#!/usr/bin/env node

/**
 * Momentum Guardian CSV Import Script
 *
 * Imports enhanced Guardian events from Momentum dashboard export
 * Usage: node scripts/import-momentum-guardian.js <csv-file-path>
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
  console.error('   Please set it in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get CSV file path from command line or default
const csvFilePath = process.argv[2] || 'eventAnalysis (2).csv';
const absoluteCsvPath = path.resolve(csvFilePath);

if (!fs.existsSync(absoluteCsvPath)) {
  console.error(`❌ CSV file not found: ${absoluteCsvPath}`);
  process.exit(1);
}

console.log('🚀 Momentum Guardian CSV Import Script');
console.log('📁 CSV File:', absoluteCsvPath);
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Parse CSV line handling quoted fields and commas within quotes
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
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Clean field value (remove quotes, trim)
 */
function cleanField(value) {
  if (!value) return null;
  const cleaned = value.replace(/^"|"$/g, '').trim();
  return cleaned === '' || cleaned === 'null' ? null : cleaned;
}

/**
 * Parse number from string
 */
function parseNumber(value) {
  if (!value || value === 'null' || value === '') return null;
  const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse boolean from string
 */
function parseBoolean(value) {
  if (!value || value === 'null') return false;
  return value.toLowerCase() === 'true';
}

/**
 * Determine fleet from Momentum fleet name
 */
function determineFleet(fleetName) {
  if (!fleetName) return 'Stevemacs'; // Default

  const fleetLower = fleetName.toLowerCase();

  if (fleetLower.includes('great southern') || fleetLower.includes('gsf')) {
    return 'Great Southern Fuels';
  }
  if (fleetLower.includes('stevemacs') || fleetLower.includes('steve')) {
    return 'Stevemacs';
  }

  return 'Stevemacs'; // Default
}

/**
 * Map Momentum confirmation state to Guardian status
 */
function mapConfirmationToStatus(confirmationState, falsePositive) {
  if (falsePositive) return 'False Positive';
  if (!confirmationState || confirmationState === 'null') return 'Active';

  const state = confirmationState.toLowerCase();

  if (state === 'verified') return 'Verified';
  if (state.includes('false positive')) return 'False Positive';
  if (state.includes('pending')) return 'Pending Review';

  return 'Active';
}

/**
 * Map severity from event type
 */
function mapSeverity(eventType, confirmationState) {
  if (!eventType) return 'Low';

  const type = eventType.toLowerCase();

  // Critical events
  if (type.includes('fatigue') || type.includes('microsleep')) {
    return 'Critical';
  }

  // High severity events
  if (type.includes('distraction') && confirmationState === 'verified') {
    return 'High';
  }

  if (type.includes('phone') || type.includes('mobile')) {
    return 'High';
  }

  // Medium severity
  if (type.includes('distraction')) {
    return 'Medium';
  }

  if (type.includes('fov')) {
    return 'Medium';
  }

  return 'Low';
}

/**
 * Parse Momentum media JSON
 */
function parseMedia(mediaStr) {
  if (!mediaStr || mediaStr === 'null') return null;

  try {
    const media = JSON.parse(mediaStr);
    return media;
  } catch (error) {
    return null;
  }
}

/**
 * Infer depot from vehicle registration
 */
function inferDepot(vehicleReg) {
  if (!vehicleReg) return 'Unknown';

  const reg = vehicleReg.toLowerCase();

  if (reg.includes('kal') || reg.startsWith('k')) return 'Kalgoorlie';
  if (reg.includes('alb') || reg.startsWith('a')) return 'Albany';
  if (reg.includes('kew') || reg.includes('per') || reg.startsWith('p')) return 'Kewdale';
  if (reg.includes('bun') || reg.startsWith('b')) return 'Bunbury';

  return 'Unknown';
}

/**
 * Process Momentum CSV and import to Supabase
 */
async function importMomentumCsv() {
  try {
    console.log('📖 Reading CSV file...');

    const csvContent = fs.readFileSync(absoluteCsvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty or has no data rows');
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]);
    console.log('📊 CSV has', headers.length, 'columns');
    console.log('📈 Data rows:', (lines.length - 1).toLocaleString());
    console.log('');

    // Create import batch record
    const batchReference = `momentum_guardian_${Date.now()}`;
    const fileName = path.basename(absoluteCsvPath);

    console.log('📝 Creating import batch record...');

    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'guardian_events',
        source_subtype: 'Momentum',
        file_name: fileName,
        batch_reference: batchReference,
        status: 'processing',
        created_by: null
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Failed to create import batch: ${batchError.message}`);
    }

    console.log('📦 Import batch created:', batch.id);
    console.log('');

    // Process CSV rows
    const dbRecords = [];
    const errors = [];
    let processed = 0;

    console.log('🔄 Processing CSV records...');

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);

        if (values.length < 44) {
          errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        // Map Momentum columns to variables
        const guardianAssetEventId = cleanField(values[0]);
        const assetEventId = cleanField(values[1]);
        const eventTimeLocal = cleanField(values[6]);
        const timeZoneShortName = cleanField(values[7]);
        const eventTimeUtc = cleanField(values[8]);
        const eventType = cleanField(values[13]);
        const eventDetectionType = cleanField(values[14]);
        const latitude = cleanField(values[15]);
        const longitude = cleanField(values[16]);
        const durationSecs = cleanField(values[22]);
        const speedMps = cleanField(values[23]);
        const confirmationState = cleanField(values[25]);
        const assetDisplayId = cleanField(values[34]); // Vehicle registration
        const externalReference = cleanField(values[35]);
        const falsePositive = cleanField(values[36]);
        const subEventTypes = cleanField(values[37]);
        const serialNumber = cleanField(values[39]);
        const media = cleanField(values[40]);
        const fleetName = cleanField(values[41]);
        const isReviewed = cleanField(values[43]);

        // Validate required fields
        if (!guardianAssetEventId || !assetDisplayId || !eventTimeUtc || !eventType) {
          errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }

        // Parse datetime (Momentum uses ISO format)
        let detectionTime;
        try {
          detectionTime = new Date(eventTimeUtc);
          if (isNaN(detectionTime.getTime())) {
            throw new Error('Invalid date');
          }
          detectionTime = detectionTime.toISOString();
        } catch (error) {
          errors.push(`Row ${i + 1}: Invalid date format: ${eventTimeUtc}`);
          continue;
        }

        // Build database record
        const dbRecord = {
          external_event_id: guardianAssetEventId,
          vehicle_registration: assetDisplayId,
          driver_name: null, // Momentum doesn't have driver names
          detection_time: detectionTime,
          timezone: timeZoneShortName,
          latitude: parseNumber(latitude),
          longitude: parseNumber(longitude),
          event_type: eventType,
          detected_event_type: eventDetectionType,
          confirmation: confirmationState,
          classification: subEventTypes,
          duration_seconds: parseNumber(durationSecs),
          speed_kph: speedMps ? parseNumber(speedMps) * 3.6 : null, // Convert m/s to km/h
          verified: confirmationState === 'verified',
          status: mapConfirmationToStatus(confirmationState, parseBoolean(falsePositive)),
          severity: mapSeverity(eventType, confirmationState),
          fleet: determineFleet(fleetName),
          depot: inferDepot(assetDisplayId),
          guardian_unit: serialNumber,
          import_batch_id: batchReference,
          raw_data: {
            momentum_event_id: assetEventId,
            event_time_local: eventTimeLocal,
            false_positive: parseBoolean(falsePositive),
            sub_event_types: subEventTypes,
            media: parseMedia(media),
            is_reviewed: parseBoolean(isReviewed),
            external_reference: externalReference
          }
        };

        dbRecords.push(dbRecord);
        processed++;

        // Progress indicator every 10,000 records
        if (processed % 10000 === 0) {
          console.log(`   📊 Processed ${processed.toLocaleString()} records...`);
        }

      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    console.log(`\n✅ Processed ${dbRecords.length.toLocaleString()} valid records`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors (showing first 10):`);
      errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
    }
    console.log('');

    if (dbRecords.length === 0) {
      throw new Error('No valid records to import');
    }

    // Insert records in batches
    console.log('💾 Inserting records to database...');

    const batchSize = 500; // Larger batches for faster import
    let insertedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < dbRecords.length; i += batchSize) {
      const batchRecords = dbRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(dbRecords.length / batchSize);

      console.log(`   Batch ${batchNum}/${totalBatches} (${batchRecords.length} records)...`);

      const { error: insertError } = await supabase
        .from('guardian_events')
        .insert(batchRecords);

      if (insertError) {
        console.error(`   ❌ Batch ${batchNum} failed: ${insertError.message}`);
        failedCount += batchRecords.length;
      } else {
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
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 IMPORT COMPLETED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Successfully imported: ${insertedCount.toLocaleString()} records`);
    console.log(`❌ Failed: ${failedCount.toLocaleString()} records`);
    console.log(`📦 Batch ID: ${batch.id}`);
    console.log(`📊 Status: ${status}`);
    console.log('');
    console.log('🔍 Next: Verify results and test correlation');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the import
importMomentumCsv();
