/*
  LYTX CSV Bulk Importer
  - Processes large LYTX CSV exports with 149 columns
  - Upserts into Supabase table `lytx_safety_events` on event_id
  - Overwrites existing records with updated data (handles Driver Unassigned → actual names)

  Usage:
    tsx tools/lytx-csv-bulk-import.ts --file "Event Data 2025-02-23_2025-08-21.csv" --batchSize 500 --dryRun
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type RecordMap = { [key: string]: any };

function parseArgs(): { file: string; batchSize: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  const map: RecordMap = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const val = args[i + 1];
    if (key) map[key] = val;
  }
  
  const file = map.file || '';
  const batchSize = parseInt(map.batchSize || map.bs || '500', 10);
  const dryRun = map.dryRun === 'true' || map.dryRun === '' || args.includes('--dryRun');
  
  if (!file) {
    throw new Error('Provide --file path to the CSV file');
  }
  
  return { file, batchSize, dryRun };
}

function getEnv(name: string, fallbackName?: string): string | undefined {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

function requireEnv(name: string, alt?: string): string {
  const val = getEnv(name, alt);
  if (!val) {
    throw new Error(`Missing environment variable: ${name}${alt ? ` (or ${alt})` : ''}`);
  }
  return val;
}

/**
 * Parse CSV row handling quoted values and commas
 */
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < row.length) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
      continue;
    } else {
      current += char;
    }
    i++;
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Map CSV row (149 columns) to database record format
 * Based on the CSV structure from "Event Data 2025-02-23_2025-08-21.csv"
 */
function mapCsvRowToDbRecord(csvRow: string[], headers: string[]): any {
  // Create a mapping of header name to value
  const rowData: RecordMap = {};
  headers.forEach((header, index) => {
    rowData[header] = csvRow[index]?.trim() || '';
  });

  // Extract key fields based on known column positions and names
  const eventId = rowData['event_id'] || '';
  const driverName = rowData['driver_full_name'] || 'Driver Unassigned';
  const vehicleReg = rowData['vehicle_description'] || '';
  const deviceSerial = rowData['er_serial_number'] || '';
  const groupName = rowData['group_level_3'] || rowData['group_level_2'] || rowData['group_level_1'] || '';
  const eventStatus = rowData['event_status'] || 'New';
  const eventScore = parseInt(rowData['event_score'] || '0', 10);
  
  // Build event datetime from record_date and record_time
  const recordDate = rowData['record_date'] || '';
  const recordTime = rowData['record_time'] || '00:00:00';
  const timeZone = rowData['time_zone'] || 'AUW';
  
  let eventDateTime: string;
  try {
    // Parse date like "08/21/2025" and time like "07:44:20"
    if (recordDate && recordTime) {
      const [month, day, year] = recordDate.split('/');
      const dateTimeStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${recordTime}`;
      eventDateTime = new Date(dateTimeStr).toISOString();
    } else {
      eventDateTime = new Date().toISOString();
    }
  } catch {
    eventDateTime = new Date().toISOString();
  }

  // Normalize status using same logic as existing imports
  const normalizedStatus = (() => {
    const s = eventStatus.toLowerCase();
    if (s.includes('face') || s.includes('coach')) return 'Face-To-Face';
    if (s.includes('fyi') || s.includes('notify')) return 'FYI Notify';
    if (s.includes('resolved') || s.includes('closed')) return 'Resolved';
    return 'New';
  })() as 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';

  // Determine carrier from group name
  const carrier = (() => {
    const g = groupName.toLowerCase();
    if (g.includes('stevemacs') || g.includes('smb') || g.includes('kewdale')) return 'Stevemacs';
    return 'Great Southern Fuels';
  })() as 'Stevemacs' | 'Great Southern Fuels';

  // Determine depot from group name
  const depot = (() => {
    const g = groupName.toLowerCase();
    if (g.includes('kewdale')) return 'Kewdale';
    if (g.includes('geraldton')) return 'Geraldton';
    if (g.includes('kalgoorlie')) return 'Kalgoorlie';
    if (g.includes('narrogin')) return 'Narrogin';
    if (g.includes('albany')) return 'Albany';
    if (g.includes('bunbury')) return 'Bunbury';
    if (g.includes('fremantle')) return 'Fremantle';
    if (g.includes('wongan')) return 'Wongan Hills';
    return groupName || 'Unknown';
  })();

  // Collect behavior triggers from CSV columns
  const behaviors: string[] = [];
  const triggerColumns = [
    'handheld_device_trigger', 'no_seat_belt_trigger', 'food_or_drink_trigger',
    'driver_smoking_trigger', 'inattentive_trigger', 'accelerating_trigger',
    'cornering_trigger', 'braking_trigger', 'speeding_trigger', 'lane_departure_trigger',
    'critical_distance_trigger', 'following_distance_trigger', 'fatigue_trigger',
    'driver_tagged_trigger'
  ];
  
  triggerColumns.forEach(col => {
    if (rowData[col] === '1') {
      behaviors.push(col.replace('_trigger', '').replace('_', ' '));
    }
  });

  // Determine event type and trigger
  const isDriverTagged = rowData['driver_tagged_trigger'] === '1' || rowData['driver_tagged'] === '1';
  const eventType = isDriverTagged ? 'Driver Tagged' : 'Coachable';
  const trigger = behaviors.length > 0 ? behaviors[0] : 'Unknown';

  return {
    event_id: eventId,
    vehicle_registration: vehicleReg || null,
    device_serial: deviceSerial,
    driver_name: driverName,
    employee_id: rowData['driver_id'] || null,
    group_name: groupName,
    depot,
    carrier,
    event_datetime: eventDateTime,
    timezone: timeZone === 'AUW' ? 'Australia/Perth' : timeZone,
    score: eventScore,
    status: normalizedStatus,
    trigger,
    behaviors: behaviors.join(', '),
    event_type: eventType,
    excluded: false,
    assigned_date: null, // Will be preserved if exists in database
    reviewed_by: null,   // Will be preserved if exists in database
    notes: null,         // Will be preserved if exists in database
    raw_data: rowData,   // Store full CSV row for reference
  };
}

async function main() {
  const { file, batchSize, dryRun } = parseArgs();
  
  console.log(`Starting LYTX CSV import:`);
  console.log(`File: ${file}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('');

  // Setup Supabase client
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') || '';
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read and parse CSV file
  const filePath = resolve(file);
  console.log(`Reading CSV file: ${filePath}`);
  
  let csvContent: string;
  try {
    csvContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read CSV file: ${error}`);
  }

  // Parse CSV content
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }

  // Remove BOM if present and parse headers
  const firstLine = lines[0].replace(/^\uFEFF/, '');
  const headers = parseCSVRow(firstLine);
  console.log(`Found ${headers.length} columns in CSV`);
  console.log(`Total data rows: ${lines.length - 1}`);
  console.log('');

  // Parse data rows
  const records: any[] = [];
  let skipped = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    try {
      if (!lines[i].trim()) {
        skipped++;
        continue;
      }

      const csvRow = parseCSVRow(lines[i]);
      if (csvRow.length !== headers.length) {
        console.warn(`Row ${i}: Column count mismatch (expected ${headers.length}, got ${csvRow.length})`);
        skipped++;
        continue;
      }

      const dbRecord = mapCsvRowToDbRecord(csvRow, headers);
      
      // Skip if no event ID
      if (!dbRecord.event_id) {
        skipped++;
        continue;
      }

      records.push(dbRecord);
    } catch (error) {
      console.error(`Row ${i}: Parse error - ${error}`);
      errors++;
    }
  }

  console.log(`Parsed ${records.length} valid records`);
  console.log(`Skipped ${skipped} rows`);
  console.log(`Errors: ${errors}`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN - No database changes will be made');
    console.log('Sample records:');
    records.slice(0, 3).forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  Event ID: ${record.event_id}`);
      console.log(`  Driver: ${record.driver_name}`);
      console.log(`  Vehicle: ${record.vehicle_registration}`);
      console.log(`  Status: ${record.status}`);
      console.log(`  Depot: ${record.depot}`);
      console.log(`  Carrier: ${record.carrier}`);
    });
    return;
  }

  // Import to database in batches
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    try {
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: records ${i + 1}-${Math.min(i + batch.length, records.length)}`);
      
      const { error } = await supabase
        .from('lytx_safety_events')
        .upsert(batch, { 
          onConflict: 'event_id',
          ignoreDuplicates: false  // This ensures existing records get updated
        });

      if (error) {
        console.error(`Batch error: ${error.message}`);
        
        // Try individual records in this batch
        for (const record of batch) {
          try {
            const { error: individualError } = await supabase
              .from('lytx_safety_events')
              .upsert(record, { 
                onConflict: 'event_id',
                ignoreDuplicates: false 
              });

            if (individualError) {
              console.error(`Failed to upsert event ${record.event_id}: ${individualError.message}`);
              failed++;
            } else {
              imported++;
            }
          } catch (err) {
            console.error(`Error processing event ${record.event_id}: ${err}`);
            failed++;
          }
        }
      } else {
        imported += batch.length;
      }
      
      process.stdout.write(`\rProgress: ${Math.min(i + batch.length, records.length)}/${records.length} (${Math.round((Math.min(i + batch.length, records.length) / records.length) * 100)}%)`);
    } catch (batchError) {
      console.error(`\nBatch processing error: ${batchError}`);
      failed += batch.length;
    }
  }

  console.log(`\n\nImport complete:`);
  console.log(`✅ Imported/Updated: ${imported}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${imported + failed}`);
  console.log(`📋 Records in CSV: ${records.length}`);
}

main().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});