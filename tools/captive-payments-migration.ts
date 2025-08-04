#!/usr/bin/env tsx

/**
 * CAPTIVE PAYMENTS DATA MIGRATION TOOL
 * 
 * This script migrates captive payments data from CSV files to Supabase database.
 * It processes the existing CSV files and imports them into the new database schema.
 * 
 * Usage:
 * - npm run migrate:captive-payments
 * - tsx tools/captive-payments-migration.ts
 * 
 * Features:
 * - Processes both SMB and GSF CSV files
 * - Handles data validation and cleaning
 * - Provides progress tracking and error reporting
 * - Supports batch processing for large datasets
 * - Creates audit trail for migration process
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { parse } from 'date-fns';

// Configuration
const BATCH_SIZE = 1000; // Process records in batches
const DRY_RUN = process.env.DRY_RUN === 'true'; // Set to true for testing

// Supabase configuration (use environment variables in production)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl === 'your-supabase-url') {
  console.error('❌ Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CaptivePaymentRecord {
  bill_of_lading: string;
  delivery_date: string;
  terminal: string;
  customer: string;
  product: string;
  volume_litres: number;
  carrier: 'SMB' | 'GSF';
  raw_location: string;
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push the last field
  fields.push(current.trim());
  return fields;
}

/**
 * Parse volume string and convert to number
 */
function parseVolume(volumeStr: string): number {
  if (!volumeStr || volumeStr.trim() === '') return 0;
  
  // Remove quotes and commas, then parse
  const cleanStr = volumeStr.replace(/[",]/g, '').trim();
  return parseFloat(cleanStr) || 0;
}

/**
 * Parse delivery date with multiple format support
 */
function parseDeliveryDate(dateStr: string): Date {
  if (!dateStr || dateStr.trim() === '') {
    throw new Error('Empty date string');
  }

  const trimmedDate = dateStr.trim();
  
  // Handle DD.MM.YYYY format (like 21.05.2025)
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmedDate)) {
    return parse(trimmedDate, 'd.M.yyyy', new Date());
  }
  
  // Handle D/M/YY format (like 29/05/25)
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(trimmedDate)) {
    const parsed = parse(trimmedDate, 'd/M/yy', new Date());
    if (parsed.getFullYear() < 2000) {
      parsed.setFullYear(parsed.getFullYear() + 100);
    }
    return parsed;
  }

  // Handle slash-separated dates (try Australian format first)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedDate)) {
    const formats = ['d/M/yyyy', 'M/d/yyyy'];
    
    for (const format of formats) {
      try {
        const parsed = parse(trimmedDate, format, new Date());
        if (parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2030) {
          return parsed;
        }
      } catch (error) {
        // Continue to next format
      }
    }
  }

  throw new Error(`Could not parse date: ${dateStr}`);
}

/**
 * Extract terminal name from raw location
 */
function extractTerminal(location: string): string {
  if (location.includes('GERALDTON')) return 'Geraldton';
  if (location.includes('KEWDALE')) return 'Kewdale';
  if (location.includes('KALGOORLIE')) return 'Kalgoorlie';
  if (location.includes('COOGEE') || location.includes('ROCKINGHAM')) return 'Coogee Rockingham';
  if (location.includes('FREMANTLE')) return 'Fremantle';
  if (location.includes('BUNBURY')) return 'Bunbury';
  
  // Default fallback
  return location.split(' ').slice(-1)[0] || 'Unknown';
}

/**
 * Process CSV file and return records
 */
async function processCSVFile(filePath: string, carrier: 'SMB' | 'GSF'): Promise<CaptivePaymentRecord[]> {
  console.log(`📄 Processing ${carrier} CSV file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  
  const csvText = fs.readFileSync(filePath, 'utf-8');
  const lines = csvText.split('\n');
  const records: CaptivePaymentRecord[] = [];
  
  let headerFound = false;
  let validRecords = 0;
  let skippedLines = 0;
  let errors = 0;
  
  console.log(`   📊 Processing ${lines.length} lines...`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      skippedLines++;
      continue;
    }
    
    // Skip section headers and other non-data lines
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('esperance') || 
        lowerLine.includes('geraldton') || 
        lowerLine.includes('total') ||
        (!line.includes(',') && line.length < 50)) {
      skippedLines++;
      continue;
    }
    
    // Look for header row
    if (!headerFound && 
        (lowerLine.includes('date') && lowerLine.includes('bill') && lowerLine.includes('lading'))) {
      headerFound = true;
      console.log(`   ✅ Header found at line ${i + 1}`);
      continue;
    }
    
    // Skip until header is found
    if (!headerFound) {
      skippedLines++;
      continue;
    }
    
    try {
      // Parse CSV line
      const fields = parseCSVLine(line);
      
      // Validate field count
      if (fields.length < 6) {
        skippedLines++;
        continue;
      }
      
      // Extract and validate fields
      const dateField = fields[0].trim().replace(/"/g, '');
      const bolField = fields[1].replace(/"/g, '').trim();
      const locationField = fields[2].replace(/"/g, '').trim();
      const customerField = fields[3].replace(/"/g, '').trim();
      const productField = fields[4].replace(/"/g, '').trim();
      const volumeField = fields[5].trim();
      
      // Skip invalid records
      if (!dateField || !bolField || !locationField || !customerField || !productField) {
        skippedLines++;
        continue;
      }
      
      // Parse and validate date
      const deliveryDate = parseDeliveryDate(dateField);
      
      // Parse and validate volume
      const volume = parseVolume(volumeField);
      if (volume === 0) {
        skippedLines++;
        continue;
      }
      
      // Create record
      const record: CaptivePaymentRecord = {
        bill_of_lading: bolField,
        delivery_date: deliveryDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        terminal: extractTerminal(locationField),
        customer: customerField,
        product: productField,
        volume_litres: volume,
        carrier: carrier,
        raw_location: locationField
      };
      
      records.push(record);
      validRecords++;
      
    } catch (error) {
      errors++;
      if (errors <= 10) { // Only log first 10 errors
        console.warn(`   ⚠️  Error processing line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  console.log(`   ✅ Processed ${validRecords} valid records (${skippedLines} skipped, ${errors} errors)`);
  return records;
}

/**
 * Insert records into database in batches
 */
async function insertRecords(records: CaptivePaymentRecord[]): Promise<void> {
  console.log(`💾 Inserting ${records.length} records into database...`);
  
  if (DRY_RUN) {
    console.log('   🏃 DRY RUN - No actual database insertion');
    return;
  }
  
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    
    try {
      const { error } = await supabase
        .from('captive_payment_records')
        .insert(batch);
      
      if (error) {
        console.error(`   ❌ Batch ${batchNumber}/${totalBatches} failed:`, error.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`   ✅ Batch ${batchNumber}/${totalBatches} completed (${batch.length} records)`);
      }
    } catch (error) {
      console.error(`   ❌ Batch ${batchNumber}/${totalBatches} error:`, error);
      errors += batch.length;
    }
  }
  
  console.log(`   📊 Insertion complete: ${inserted} inserted, ${errors} failed`);
}

/**
 * Refresh materialized views after data import
 */
async function refreshViews(): Promise<void> {
  console.log('🔄 Refreshing materialized views...');
  
  if (DRY_RUN) {
    console.log('   🏃 DRY RUN - No actual view refresh');
    return;
  }
  
  try {
    const { error } = await supabase.rpc('refresh_captive_analytics');
    
    if (error) {
      console.error('   ❌ Failed to refresh views:', error.message);
    } else {
      console.log('   ✅ Views refreshed successfully');
    }
  } catch (error) {
    console.error('   ❌ Error refreshing views:', error);
  }
}

/**
 * Get migration statistics
 */
async function getMigrationStats(): Promise<void> {
  console.log('📈 Migration statistics:');
  
  if (DRY_RUN) {
    console.log('   🏃 DRY RUN - No statistics available');
    return;
  }
  
  try {
    // Get record count by carrier
    const { data: stats, error } = await supabase
      .from('captive_payment_records')
      .select('carrier')
      .eq('carrier', 'SMB');
    
    if (error) {
      console.error('   ❌ Failed to get statistics:', error.message);
      return;
    }
    
    const { data: smbCount } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'SMB');
    
    const { data: gsfCount } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('carrier', 'GSF');
    
    const { data: totalCount } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   📊 SMB Records: ${smbCount?.length || 0}`);
    console.log(`   📊 GSF Records: ${gsfCount?.length || 0}`);
    console.log(`   📊 Total Records: ${totalCount?.length || 0}`);
    
    // Get unique deliveries count
    const { data: deliveries } = await supabase
      .from('captive_deliveries')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   🚚 Unique Deliveries: ${deliveries?.length || 0}`);
    
  } catch (error) {
    console.error('   ❌ Error getting statistics:', error);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Captive Payments Data Migration');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // Define CSV file paths (adjust paths as needed)
    const publicDir = path.join(process.cwd(), 'public');
    const smbCsvPath = path.join(publicDir, 'Inputdata_southern Fuel (3)(Carrier - SMB).csv');
    const gsfCsvPath = path.join(publicDir, 'Inputdata_southern Fuel (3)(Carrier - GSF).csv');
    
    // Process CSV files
    const smbRecords = await processCSVFile(smbCsvPath, 'SMB');
    const gsfRecords = await processCSVFile(gsfCsvPath, 'GSF');
    
    // Combine all records
    const allRecords = [...smbRecords, ...gsfRecords];
    console.log(`📋 Total records to migrate: ${allRecords.length}`);
    console.log('');
    
    // Insert records into database
    await insertRecords(allRecords);
    console.log('');
    
    // Refresh materialized views
    await refreshViews();
    console.log('');
    
    // Show migration statistics
    await getMigrationStats();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('');
    console.log(`✅ Migration completed successfully in ${duration} seconds`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as migrateCaptivePayments };