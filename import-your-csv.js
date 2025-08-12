/**
 * Direct CSV Import Script
 * Imports your LYTX Events CSV file directly to the database
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// CSV Processing Functions (simplified version of the service)
class SimpleCSVProcessor {
  static parseCsv(csvContent) {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      if (values.length === 0) continue;
      
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });
      rows.push(rowData);
    }

    return { headers, rows };
  }

  static mapRowToEvent(row) {
    const getFieldValue = (possibleNames) => {
      for (const name of possibleNames) {
        const value = row[name];
        if (value && value.trim()) return value.trim();
      }
      return undefined;
    };

    return {
      eventId: getFieldValue(['event_id', 'eventId', 'id', 'Event ID']),
      name: getFieldValue(['vehicle', 'vehicleId', 'name', 'Vehicle', 'Vehicle Registration']),
      driverName: getFieldValue(['driver', 'driverName', 'Driver', 'Driver Name']),
      groupName: getFieldValue(['group', 'groupName', 'Group', 'Group Name', 'Depot']),
      eventDateTime: getFieldValue(['event_datetime', 'eventDateTime', 'Event Date', 'Date/Time', 'Date']),
      trigger: getFieldValue(['trigger', 'Trigger', 'Event Type']),
      status: getFieldValue(['status', 'Status', 'Event Status']),
      behaviors: getFieldValue(['behaviors', 'Behaviors', 'Behaviour', 'Behavior']),
      score: getFieldValue(['score', 'Score', 'Risk Score']),
      deviceSerialNumber: getFieldValue(['device', 'deviceSerialNumber', 'Device', 'Device Serial']),
      employeeId: getFieldValue(['employeeId', 'employee_id', 'Employee ID']),
      timezone: 'Australia/Perth'
    };
  }

  static transformToDbRecord(eventData) {
    const eventId = eventData.eventId || `csv_import_${Date.now()}_${Math.random()}`;
    const groupName = eventData.groupName || '';
    const driverName = eventData.driverName || 'Driver Unassigned';
    const vehicle = eventData.name || null;
    const device = eventData.deviceSerialNumber || '';
    const status = (eventData.status || '').toString();
    const trigger = eventData.trigger || '';
    const behaviorsStr = eventData.behaviors || '';

    // Parse date
    let eventDateTime;
    try {
      eventDateTime = new Date(eventData.eventDateTime).toISOString();
    } catch {
      eventDateTime = new Date().toISOString();
    }

    // Normalize status
    const safeStatus = (() => {
      const s = status.toLowerCase();
      if (s.includes('face') || s.includes('coach')) return 'Face-To-Face';
      if (s.includes('fyi') || s.includes('notify')) return 'FYI Notify';
      if (s.includes('resolved') || s.includes('closed')) return 'Resolved';
      return 'New';
    })();

    // Determine carrier
    const safeCarrier = (() => {
      const g = groupName.toLowerCase();
      if (g.includes('stevemacs') || g.includes('smb') || g.includes('kewdale')) return 'Stevemacs';
      return 'Great Southern Fuels';
    })();

    // Determine depot
    const depot = (() => {
      const g = groupName.toLowerCase();
      if (g.includes('kewdale')) return 'Kewdale';
      if (g.includes('geraldton')) return 'Geraldton';
      if (g.includes('kalgoorlie')) return 'Kalgoorlie';
      if (g.includes('narrogin')) return 'Narrogin';
      if (g.includes('albany')) return 'Albany';
      if (g.includes('bunbury')) return 'Bunbury';
      if (g.includes('fremantle')) return 'Fremantle';
      return groupName || 'Unknown';
    })();

    // Determine event type
    const eventType = (() => {
      const t = (trigger || '').toLowerCase();
      return t.includes('tagged') ? 'Driver Tagged' : 'Coachable';
    })();

    return {
      event_id: eventId,
      vehicle_registration: vehicle,
      device_serial: device,
      driver_name: driverName,
      employee_id: eventData.employeeId || null,
      group_name: groupName,
      depot,
      carrier: safeCarrier,
      event_datetime: eventDateTime,
      timezone: 'Australia/Perth',
      score: Number(eventData.score || 0),
      status: safeStatus,
      trigger,
      behaviors: behaviorsStr,
      event_type: eventType,
      excluded: false,
      assigned_date: null,
      reviewed_by: null,
      notes: null,
      raw_data: eventData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

async function importCsvFile() {
  console.log('🚀 LYTX CSV Direct Import Tool');
  console.log('===============================\n');

  try {
    // Check if CSV file exists
    const csvPath = './Events 2024-09-01_2024-12-31.csv';
    if (!fs.existsSync(csvPath)) {
      console.log('❌ CSV file not found at:', csvPath);
      console.log('\n💡 Please copy your CSV file to the project directory and rename it to:');
      console.log('   "Events 2024-09-01_2024-12-31.csv"');
      console.log('\n   Or update the csvPath variable in this script to point to your file.');
      return;
    }

    // Setup Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase configuration');
      console.log('Please set environment variables:');
      console.log('- SUPABASE_URL or VITE_SUPABASE_URL');
      console.log('- SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read and process CSV
    console.log('📖 Reading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const { headers, rows } = SimpleCSVProcessor.parseCsv(csvContent);
    
    console.log(`✅ Parsed ${rows.length} rows with ${headers.length} columns`);
    console.log('📋 Headers:', headers.slice(0, 5).join(', '), '...\n');

    // Transform rows
    console.log('⚙️ Processing events...');
    const processedRecords = [];
    let validCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        const mappedEvent = SimpleCSVProcessor.mapRowToEvent(rows[i]);
        
        // Skip empty rows
        if (!mappedEvent.eventId && !mappedEvent.driverName && !mappedEvent.eventDateTime) {
          skippedCount++;
          continue;
        }

        // Generate event ID if missing
        if (!mappedEvent.eventId) {
          mappedEvent.eventId = `csv_import_${Date.now()}_${i}`;
        }

        const dbRecord = SimpleCSVProcessor.transformToDbRecord(mappedEvent);
        processedRecords.push(dbRecord);
        validCount++;
      } catch (error) {
        console.log(`⚠️ Skipped row ${i + 1}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`✅ Processed ${validCount} valid events, skipped ${skippedCount}\n`);

    // Create import batch record
    console.log('📝 Creating import batch record...');
    const batchReference = `lytx_csv_direct_${Date.now()}`;
    const { data: batch, error: batchError } = await supabase
      .from('data_import_batches')
      .insert({
        source_type: 'lytx_events',
        source_subtype: 'CSV_DIRECT_IMPORT',
        file_name: 'Events 2024-09-01_2024-12-31.csv',
        batch_reference: batchReference,
        status: 'processing',
        records_processed: 0,
        records_failed: 0,
        processing_metadata: {
          totalRows: rows.length,
          validRows: validCount,
          skippedRows: skippedCount,
          importedAt: new Date().toISOString()
        },
        created_by: null
      })
      .select()
      .single();

    if (batchError) {
      console.log('❌ Failed to create batch record:', batchError.message);
      return;
    }

    console.log(`✅ Created batch: ${batch.id}\n`);

    // Import to database in chunks
    console.log('💾 Importing to database...');
    const chunkSize = 100;
    let imported = 0;
    let failed = 0;
    let duplicates = 0;

    for (let i = 0; i < processedRecords.length; i += chunkSize) {
      const batch = processedRecords.slice(i, i + chunkSize);
      console.log(`  Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(processedRecords.length / chunkSize)}...`);

      try {
        const { error } = await supabase
          .from('lytx_safety_events')
          .upsert(batch, { onConflict: 'event_id', ignoreDuplicates: false });

        if (error) {
          // Try individual inserts on error
          for (const record of batch) {
            try {
              const { error: individualError } = await supabase
                .from('lytx_safety_events')
                .upsert(record, { onConflict: 'event_id', ignoreDuplicates: false });

              if (individualError) {
                if (individualError.message.toLowerCase().includes('duplicate')) {
                  duplicates++;
                } else {
                  failed++;
                  console.log(`    ❌ Failed to import event ${record.event_id}: ${individualError.message}`);
                }
              } else {
                imported++;
              }
            } catch (err) {
              failed++;
              console.log(`    ❌ Exception importing event ${record.event_id}: ${err.message}`);
            }
          }
        } else {
          imported += batch.length;
        }
      } catch (batchError) {
        console.log(`  ❌ Batch error: ${batchError.message}`);
        failed += batch.length;
      }
    }

    // Update batch record
    await supabase
      .from('data_import_batches')
      .update({
        status: failed === 0 ? 'completed' : 'partial',
        records_processed: imported,
        records_failed: failed,
        processing_metadata: {
          totalRows: rows.length,
          validRows: validCount,
          skippedRows: skippedCount,
          imported,
          duplicates,
          failed,
          completedAt: new Date().toISOString()
        }
      })
      .eq('id', batch.id);

    // Results summary
    console.log('\n🎉 Import Complete!');
    console.log('==================');
    console.log(`✅ Successfully imported: ${imported} events`);
    console.log(`🔄 Duplicates skipped: ${duplicates} events`);
    console.log(`❌ Failed to import: ${failed} events`);
    console.log(`📊 Total processed: ${processedRecords.length} events`);
    
    if (imported > 0) {
      console.log('\n💡 Next Steps:');
      console.log('1. Visit the LYTX Safety Dashboard');
      console.log('2. Your imported data should now be visible in the analytics');
      console.log('3. Use the filters to view data by carrier, date range, etc.');
      console.log('4. The events are now available for analysis and reporting');
    }

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('\nStack trace:', error.stack);
  }
}

// Run the import
importCsvFile();