import * as XLSX from 'xlsx';
import type { RawTripData, ExcelParseError, ExcelParseResult } from '@/types/routeAnalysis';

/**
 * Parse an Excel file containing trip history data
 * @param file - The Excel file to parse
 * @returns Parsed trip data with any errors encountered
 */
export async function parseExcelTripReport(file: File): Promise<ExcelParseResult> {
  const errors: ExcelParseError[] = [];
  const trips: RawTripData[] = [];
  let rowsParsed = 0;
  let rowsSkipped = 0;

  try {
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

    // Try to identify column mappings (flexible to handle different formats)
    const columnMappings = identifyColumns(data[0] as Record<string, unknown>);

    if (!columnMappings) {
      return {
        success: false,
        trips: [],
        errors: [{
          row: 1,
          message: 'Could not identify required columns in Excel file. Expected columns for: vehicle, start location, end location, start time, end time, distance.'
        }],
        rowsParsed: 0,
        rowsSkipped: data.length
      };
    }

    // Parse each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, unknown>;
      const rowNumber = i + 2; // +2 because Excel rows are 1-indexed and we skip header

      try {
        const trip = parseRow(row, columnMappings, rowNumber);

        if (trip) {
          trips.push(trip);
          rowsParsed++;
        } else {
          rowsSkipped++;
        }
      } catch (error) {
        rowsSkipped++;
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          value: row
        });
      }
    }

    return {
      success: true,
      trips,
      errors,
      rowsParsed,
      rowsSkipped
    };
  } catch (error) {
    return {
      success: false,
      trips: [],
      errors: [{
        row: 0,
        message: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      rowsParsed: 0,
      rowsSkipped: 0
    };
  }
}

/**
 * Identify column names from the header row
 */
function identifyColumns(headerRow: Record<string, unknown>): Record<string, string> | null {
  const keys = Object.keys(headerRow);
  const mapping: Record<string, string> = {};

  // Common column name variations
  const patterns = {
    vehicle: /vehicle|truck|rego|registration|unit|asset/i,
    startLocation: /start.{0,10}location|origin|from.{0,10}location|departure/i,
    endLocation: /end.{0,10}location|destination|to.{0,10}location|arrival/i,
    startTime: /start.{0,10}time|start.{0,10}date|departure.{0,10}time/i,
    endTime: /end.{0,10}time|end.{0,10}date|arrival.{0,10}time/i,
    distance: /distance|km|kilometers|kilometres/i,
    driver: /driver|operator/i
  };

  // Match each required field
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = keys.find(key => pattern.test(key));
    if (match) {
      mapping[field] = match;
    }
  }

  // Check if we have all required fields
  const required = ['vehicle', 'startLocation', 'endLocation', 'startTime', 'endTime', 'distance'];
  const hasAllRequired = required.every(field => mapping[field]);

  return hasAllRequired ? mapping : null;
}

/**
 * Parse a single row into RawTripData
 */
function parseRow(
  row: Record<string, unknown>,
  columns: Record<string, string>,
  rowNumber: number
): RawTripData | null {
  // Extract values
  const vehicle = String(row[columns.vehicle] || '').trim();
  const startLocation = String(row[columns.startLocation] || '').trim();
  const endLocation = String(row[columns.endLocation] || '').trim();
  const startTimeRaw = row[columns.startTime];
  const endTimeRaw = row[columns.endTime];
  const distanceRaw = row[columns.distance];
  const driver = columns.driver ? String(row[columns.driver] || '').trim() : undefined;

  // Skip rows with missing critical data
  if (!vehicle || !startLocation || !endLocation) {
    return null;
  }

  // Parse dates
  const startTime = parseDateTime(startTimeRaw);
  const endTime = parseDateTime(endTimeRaw);

  if (!startTime || !endTime) {
    throw new Error(`Invalid date format in row ${rowNumber}`);
  }

  // Parse distance
  const distance = parseDistance(distanceRaw);

  if (distance === null || distance < 0) {
    throw new Error(`Invalid distance value in row ${rowNumber}`);
  }

  // Validate time order
  if (endTime <= startTime) {
    throw new Error(`End time must be after start time in row ${rowNumber}`);
  }

  return {
    vehicle,
    startLocation,
    endLocation,
    startTime,
    endTime,
    distance,
    driver
  };
}

/**
 * Parse a date/time value from various formats
 */
function parseDateTime(value: unknown): Date | null {
  if (!value) return null;

  // Already a Date object (from XLSX with cellDates: true)
  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  // Try parsing as string
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }

  // Try parsing as Excel serial date number
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      const jsDate = new Date(date.y, date.m - 1, date.d, date.H, date.M, date.S);
      return isValidDate(jsDate) ? jsDate : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Parse distance from various formats
 */
function parseDistance(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Already a number
  if (typeof value === 'number') {
    return value;
  }

  // Parse from string (remove non-numeric characters except decimal point)
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Check if a date is valid
 */
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Get a preview of the Excel file structure
 */
export async function getExcelPreview(file: File): Promise<{
  sheetNames: string[];
  headers: string[];
  sampleRows: Record<string, unknown>[];
} | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const headers = data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];
    const sampleRows = data.slice(0, 5) as Record<string, unknown>[];

    return {
      sheetNames: workbook.SheetNames,
      headers,
      sampleRows
    };
  } catch (error) {
    console.error('Error previewing Excel file:', error);
    return null;
  }
}
