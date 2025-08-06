/**
 * CAPTIVE PAYMENTS CSV PROCESSOR
 * 
 * Processes SMB and GSF CSV files with automatic carrier detection,
 * data transformation, and validation for database import
 */

import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type { CaptivePaymentRecord } from '@/api/captivePayments';

export interface ProcessedCsvData {
  records: Omit<CaptivePaymentRecord, 'id' | 'created_at' | 'updated_at'>[];
  metadata: {
    carrier: 'SMB' | 'GSF';
    originalFilename: string;
    period: string;
    totalRows: number;
    validRows: number;
    skippedRows: number;
    errors: string[];
    warnings: string[];
    import_batch_id: string;
  };
  preview: {
    originalSample: any[];
    transformedSample: any[];
  };
}

export interface CsvRow {
  Date: string;
  'Bill of Lading': string;
  Location: string;
  Customer: string;
  Product: string;
  Volume: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Extract carrier and period from filename
 */
function parseFilename(filename: string): { carrier: 'SMB' | 'GSF'; period: string } {
  // Pattern: "Captive Payments - GSFS - Jul '25(YYOITRM06_Q_R0001_WEEKLY_00000).csv"
  const carrierMatch = filename.match(/Captive Payments - (GSFS?|SMB)/i);
  const periodMatch = filename.match(/- ([A-Za-z]{3} '\d{2})/);
  
  let carrier: 'SMB' | 'GSF' = 'SMB';
  if (carrierMatch) {
    const extracted = carrierMatch[1].toUpperCase();
    carrier = extracted === 'GSFS' || extracted === 'GSF' ? 'GSF' : 'SMB';
  }
  
  const period = periodMatch ? periodMatch[1] : 'Unknown Period';
  
  return { carrier, period };
}

/**
 * Convert date from DD.MM.YYYY to YYYY-MM-DD
 */
function convertDateFormat(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return '';
  
  // Handle DD.MM.YYYY format
  const match = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // If already in YYYY-MM-DD format, return as-is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  console.warn('Unexpected date format:', dateStr);
  return dateStr; // Return original if can't parse
}

/**
 * Process volume string to number
 */
function processVolume(volumeStr: string): number {
  if (!volumeStr || volumeStr.trim() === '') return 0.1;
  
  // Remove commas and quotes
  let cleaned = volumeStr.replace(/[",]/g, '').trim();
  
  // Handle negative values (preserve them - they are adjustments)
  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  const volume = parseFloat(cleaned);
  
  // If parsing failed, default to 0.1
  if (isNaN(volume)) return 0.1;
  
  // Preserve negative values (adjustments/corrections)
  if (isNegative) return -volume;
  
  // Convert zero to 0.1 (minimum fuel handling)
  if (volume === 0) return 0.1;
  
  return volume;
}

/**
 * Validate individual row data
 */
function validateRow(row: any, rowIndex: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields check
  if (!row.Date || row.Date.trim() === '') {
    errors.push(`Row ${rowIndex}: Missing date`);
  }
  
  if (!row['Bill of Lading'] || row['Bill of Lading'].trim() === '') {
    errors.push(`Row ${rowIndex}: Missing Bill of Lading`);
  }
  
  if (!row.Location || row.Location.trim() === '') {
    errors.push(`Row ${rowIndex}: Missing location/terminal`);
  }
  
  if (!row.Customer || row.Customer.trim() === '') {
    errors.push(`Row ${rowIndex}: Missing customer`);
  }
  
  if (!row.Product || row.Product.trim() === '') {
    warnings.push(`Row ${rowIndex}: Missing product - will use 'UNKNOWN'`);
  }
  
  // Date format validation
  if (row.Date && !row.Date.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/) && !row.Date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    errors.push(`Row ${rowIndex}: Invalid date format - expected DD.MM.YYYY or YYYY-MM-DD`);
  }
  
  // Volume validation
  const volume = processVolume(row.Volume);
  if (volume !== 0 && Math.abs(volume) < 0.01) {
    warnings.push(`Row ${rowIndex}: Very small volume (${volume}) - may be data entry error`);
  }
  if (Math.abs(volume) > 100000) {
    warnings.push(`Row ${rowIndex}: Very large volume (${volume}) - please verify`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if row is a section header or empty row
 */
function isDataRow(row: any): boolean {
  // Skip completely empty rows
  if (!row || Object.values(row).every(val => !val || String(val).trim() === '')) {
    return false;
  }
  
  // Skip section headers (rows where most fields are empty except first)
  const values = Object.values(row).map(val => String(val).trim());
  const nonEmptyCount = values.filter(val => val !== '').length;
  
  // If only 1-2 fields have values, it's likely a section header
  if (nonEmptyCount <= 2) {
    return false;
  }
  
  // Skip rows that look like headers
  const firstValue = String(row[Object.keys(row)[0]] || '').trim().toLowerCase();
  if (firstValue.includes('total') || firstValue.includes('summary')) {
    return false;
  }
  
  return true;
}

/**
 * Main CSV processing function
 */
export async function processCaptivePaymentsCsv(
  file: File,
  userId: string
): Promise<ProcessedCsvData> {
  return new Promise((resolve, reject) => {
    const { carrier, period } = parseFilename(file.name);
    const import_batch_id = uuidv4();
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rawData = results.data as any[];
          const errors: string[] = [...(results.errors?.map(e => e.message) || [])];
          const warnings: string[] = [];
          const records: Omit<CaptivePaymentRecord, 'id' | 'created_at' | 'updated_at'>[] = [];
          
          let validRows = 0;
          let skippedRows = 0;
          
          // Process each row
          rawData.forEach((row, index) => {
            // Skip non-data rows (headers, totals, empty)
            if (!isDataRow(row)) {
              skippedRows++;
              return;
            }
            
            // Validate row
            const validation = validateRow(row, index + 2); // +2 for header + 1-based indexing
            errors.push(...validation.errors);
            warnings.push(...validation.warnings);
            
            // Skip invalid rows
            if (!validation.isValid) {
              skippedRows++;
              return;
            }
            
            // Transform and create record
            try {
              const record: Omit<CaptivePaymentRecord, 'id' | 'created_at' | 'updated_at'> = {
                bill_of_lading: String(row['Bill of Lading']).trim(),
                delivery_date: convertDateFormat(String(row.Date).trim()),
                terminal: String(row.Location).trim(),
                customer: String(row.Customer).trim(),
                product: String(row.Product || 'UNKNOWN').trim(),
                volume_litres: processVolume(String(row.Volume)),
                carrier: carrier,
                raw_location: String(row.Location).trim(), // Store original location
                source_file: file.name,
                import_batch_id: import_batch_id,
                created_by: userId
              };
              
              records.push(record);
              validRows++;
              
            } catch (err) {
              errors.push(`Row ${index + 2}: Error processing data - ${err}`);
              skippedRows++;
            }
          });
          
          // Create preview samples
          const originalSample = rawData.filter(isDataRow).slice(0, 5);
          const transformedSample = records.slice(0, 5);
          
          const result: ProcessedCsvData = {
            records,
            metadata: {
              carrier,
              originalFilename: file.name,
              period,
              totalRows: rawData.length,
              validRows,
              skippedRows,
              errors,
              warnings,
              import_batch_id
            },
            preview: {
              originalSample,
              transformedSample
            }
          };
          
          resolve(result);
          
        } catch (error) {
          reject(new Error(`CSV processing failed: ${error}`));
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    });
  });
}

/**
 * Validate processed data before import
 */
export function validateProcessedData(data: ProcessedCsvData): ValidationResult {
  const errors: string[] = [...data.metadata.errors];
  const warnings: string[] = [...data.metadata.warnings];
  
  // Check if we have any valid records
  if (data.records.length === 0) {
    errors.push('No valid records found in CSV file');
  }
  
  // Check for suspicious data patterns
  const uniqueBOLs = new Set(data.records.map(r => r.bill_of_lading)).size;
  const uniqueDates = new Set(data.records.map(r => r.delivery_date)).size;
  
  if (uniqueBOLs < data.records.length / 10) {
    warnings.push('Very few unique Bill of Lading numbers - please verify data');
  }
  
  if (uniqueDates === 1) {
    warnings.push('All records have the same delivery date - please verify');
  }
  
  // Check volume distribution
  const volumes = data.records.map(r => r.volume_litres);
  const negativeCount = volumes.filter(v => v < 0).length;
  const zeroCount = volumes.filter(v => v === 0.1).length; // Our converted zeros
  
  if (negativeCount > data.records.length / 2) {
    warnings.push('More than half the records have negative volumes - please verify');
  }
  
  if (zeroCount > data.records.length / 4) {
    warnings.push('Many zero volumes detected and converted to 0.1L - please verify');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}