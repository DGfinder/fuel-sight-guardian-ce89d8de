import * as XLSX from 'xlsx';

/**
 * MtData-specific Excel parser that handles their multi-row header format
 * Expected structure:
 * - Rows 1-9: Metadata
 * - Rows 10-11: Two-row headers
 * - Row 12+: Data
 */

export interface MtDataTripRow {
  group: string;
  driver: string;
  vehicleName: string;
  vehicleRego: string;
  unitSerialNumber: string;
  tripNo: number;
  startTime: Date;
  startLocation: string;
  startLatitude: number;
  startLongitude: number;
  endTime: Date;
  endLocation: string;
  endLatitude: number;
  endLongitude: number;
  travelTimeHours: number;
  idlingTimeHours: number;
  idlingPeriods: number;
  distanceKm: number;
  odometer: number;
}

export interface MtDataExcelParseResult {
  success: boolean;
  trips: MtDataTripRow[];
  errors: Array<{
    row: number;
    message: string;
    value?: unknown;
  }>;
  rowsParsed: number;
  rowsSkipped: number;
  metadata?: {
    reportTitle?: string;
    dateRange?: string;
    groupInfo?: string;
  };
}

/**
 * Parse MtData Excel file with multi-row headers
 */
export async function parseMtDataExcel(file: File): Promise<MtDataExcelParseResult> {
  const errors: MtDataExcelParseResult['errors'] = [];
  const trips: MtDataTripRow[] = [];
  let rowsParsed = 0;
  let rowsSkipped = 0;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: false, // We'll parse Excel serial dates manually
      raw: true
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to array of arrays to handle multi-row headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

    // Extract metadata (rows 0-8, accounting for 0-index)
    const metadata = extractMetadata(data);

    // Data starts at row 12 (index 11) - rows 0-9 are metadata, 10-11 are headers
    const DATA_START_ROW = 11;

    if (data.length <= DATA_START_ROW) {
      return {
        success: false,
        trips: [],
        errors: [{
          row: 0,
          message: 'Excel file appears to be empty or in an unexpected format. Expected MtData Trip History Report format.'
        }],
        rowsParsed: 0,
        rowsSkipped: 0,
        metadata
      };
    }

    // Parse each data row
    for (let i = DATA_START_ROW; i < data.length; i++) {
      const row = data[i] as unknown[];
      const rowNumber = i + 1; // Excel row number (1-indexed)

      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) {
        rowsSkipped++;
        continue;
      }

      try {
        const trip = parseMtDataRow(row, rowNumber);
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
      rowsSkipped,
      metadata
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
 * Extract metadata from the first few rows
 */
function extractMetadata(data: unknown[][]): MtDataExcelParseResult['metadata'] {
  const metadata: MtDataExcelParseResult['metadata'] = {};

  try {
    // Row 0 usually contains report title
    if (data[0] && data[0][0]) {
      metadata.reportTitle = String(data[0][0]);
    }

    // Look for date range in first few rows
    for (let i = 0; i < Math.min(9, data.length); i++) {
      const row = data[i];
      if (row && row[0]) {
        const text = String(row[0]);
        if (text.toLowerCase().includes('date') || text.includes('to')) {
          metadata.dateRange = text;
        }
        if (text.toLowerCase().includes('group')) {
          metadata.groupInfo = text;
        }
      }
    }
  } catch {
    // Ignore metadata extraction errors
  }

  return metadata;
}

/**
 * Parse a single MtData row
 * Expected columns (0-indexed):
 * 0: Group, 1: Driver, 2: Vehicle Name, 3: Vehicle Rego, 4: Unit Serial Number
 * 5: Trip No, 6: Start Time, 7: Start Location, 8: Start Lat, 9: Start Lon
 * 10: End Time, 11: End Location, 12: End Lat, 13: End Lon
 * 14: Travel Time, 15: Idle Time, 16: Idle Periods, 17: Kms, 18: Odo
 */
function parseMtDataRow(row: unknown[], rowNumber: number): MtDataTripRow | null {
  // Extract values
  const group = String(row[0] || '').trim();
  const driver = String(row[1] || '').trim();
  const vehicleName = String(row[2] || '').trim();
  const vehicleRego = String(row[3] || '').trim();
  const unitSerialNumber = String(row[4] || '').trim();
  const tripNo = parseNumber(row[5]);
  const startTimeRaw = row[6];
  const startLocation = String(row[7] || '').trim();
  const startLatitude = parseNumber(row[8]);
  const startLongitude = parseNumber(row[9]);
  const endTimeRaw = row[10];
  const endLocation = String(row[11] || '').trim();
  const endLatitude = parseNumber(row[12]);
  const endLongitude = parseNumber(row[13]);
  const travelTimeRaw = parseNumber(row[14]); // Decimal days
  const idlingTimeRaw = parseNumber(row[15]); // Decimal days
  const idlingPeriods = parseNumber(row[16]);
  const distanceKm = parseNumber(row[17]);
  const odometer = parseNumber(row[18]);

  // Skip rows with missing critical data
  if (!vehicleRego || !startLocation || !endLocation) {
    return null;
  }

  // Parse Excel serial date numbers
  const startTime = parseExcelDate(startTimeRaw);
  const endTime = parseExcelDate(endTimeRaw);

  if (!startTime || !endTime) {
    throw new Error(`Invalid date format in row ${rowNumber}`);
  }

  // Validate coordinates
  if (startLatitude === null || startLongitude === null ||
      endLatitude === null || endLongitude === null) {
    throw new Error(`Invalid coordinates in row ${rowNumber}`);
  }

  // Convert decimal days to hours
  const travelTimeHours = travelTimeRaw !== null ? travelTimeRaw * 24 : 0;
  const idlingTimeHours = idlingTimeRaw !== null ? idlingTimeRaw * 24 : 0;

  // Validate time order
  if (endTime <= startTime) {
    throw new Error(`End time must be after start time in row ${rowNumber}`);
  }

  return {
    group,
    driver,
    vehicleName,
    vehicleRego,
    unitSerialNumber,
    tripNo: tripNo !== null ? tripNo : 0,
    startTime,
    startLocation,
    startLatitude,
    startLongitude,
    endTime,
    endLocation,
    endLatitude,
    endLongitude,
    travelTimeHours,
    idlingTimeHours,
    idlingPeriods: idlingPeriods !== null ? idlingPeriods : 0,
    distanceKm: distanceKm !== null ? distanceKm : 0,
    odometer: odometer !== null ? odometer : 0
  };
}

/**
 * Parse Excel serial date number to JavaScript Date
 * Excel stores dates as days since 1900-01-01 (with 1900 leap year bug)
 */
function parseExcelDate(value: unknown): Date | null {
  if (!value) return null;

  // Already a Date object
  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  // Excel serial number
  if (typeof value === 'number') {
    // Excel epoch: January 1, 1900 (with leap year bug, so actually Dec 31, 1899)
    const excelEpoch = new Date(1899, 11, 30);
    const days = Math.floor(value);
    const fractionalDay = value - days;

    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);

    // Add the time portion
    const hours = Math.floor(fractionalDay * 24);
    const minutes = Math.floor((fractionalDay * 24 - hours) * 60);
    const seconds = Math.floor(((fractionalDay * 24 - hours) * 60 - minutes) * 60);

    date.setHours(hours, minutes, seconds);

    return isValidDate(date) ? date : null;
  }

  // Try parsing as string
  if (typeof value === 'string') {
    // Try MtData format: "dd/mm/yyyy hh:mm"
    const mtDataPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
    const match = value.match(mtDataPattern);

    if (match) {
      const [, day, month, year, hours, minutes] = match;
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      );
      return isValidDate(date) ? date : null;
    }

    // Try standard date parsing
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Parse a number from various formats
 */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

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
 * Validate MtData Excel file format before parsing
 */
export async function validateMtDataExcel(file: File): Promise<{
  valid: boolean;
  message: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      return { valid: false, message: 'Excel file contains no sheets' };
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    if (data.length < 12) {
      return {
        valid: false,
        message: 'Excel file has insufficient rows. Expected MtData Trip History Report format with metadata and headers.'
      };
    }

    // Check if it looks like an MtData report
    const firstRow = data[0] as unknown[];
    const hasReportTitle = firstRow && String(firstRow[0]).toLowerCase().includes('trip');

    if (!hasReportTitle) {
      return {
        valid: false,
        message: 'This does not appear to be an MtData Trip History Report. Expected "Trip History Report" in first row.'
      };
    }

    return { valid: true, message: 'Valid MtData Excel format' };
  } catch (error) {
    return {
      valid: false,
      message: `Error validating file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
