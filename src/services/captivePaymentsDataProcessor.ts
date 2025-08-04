import { parse } from 'date-fns';

/**
 * Represents a single CSV record from captive payments data
 * Multiple records can belong to the same physical delivery
 */
export interface CaptivePaymentRecord {
  date: string;           // Delivery date in various formats (dd/mm/yyyy, mm/dd/yyyy, etc.)
  billOfLading: string;   // Bill of Lading number - key identifier for deliveries
  location: string;       // Terminal location (e.g., "AU TERM KEWDALE")
  customer: string;       // Customer name
  product: string;        // Product type (e.g., "ULSD 10PPM", "JET A-1")
  volume: number;         // Volume in litres (can be positive or negative)
}

/**
 * Monthly aggregated volume and delivery data
 * Deliveries are counted as unique BOL + Date + Customer combinations
 */
export interface MonthlyVolumeData {
  month: string;          // Month name (e.g., "Jan", "Feb")
  year: number;          // Year (e.g., 2024)
  deliveries: number;    // Count of unique deliveries (distinct BOL + Date + Customer)
  volumeLitres: number;  // Total volume in litres for the month
  volumeMegaLitres: number; // Total volume in megalitres for the month
}

/**
 * Comprehensive processed captive payments data with analytics
 * All delivery counts represent unique deliveries (BOL + Date + Customer combinations)
 * not individual CSV records
 */
export interface ProcessedCaptiveData {
  rawRecords: CaptivePaymentRecord[];    // All original CSV records
  monthlyData: MonthlyVolumeData[];      // Month-by-month breakdown
  
  // Summary metrics
  totalVolumeLitres: number;             // Total volume across all records
  totalVolumeMegaLitres: number;         // Total volume in megalitres
  totalDeliveries: number;               // Count of unique deliveries (not CSV rows)
  uniqueCustomers: number;               // Number of distinct customers
  terminals: string[];                   // List of all terminals
  products: string[];                    // List of all products
  
  // Date range analysis
  dateRange: {
    startDate: string;                   // Earliest delivery date
    endDate: string;                     // Latest delivery date
    monthsCovered: number;               // Number of months in dataset
  };
  
  // Performance metrics
  averageDeliverySize: number;           // Average volume per unique delivery
  
  // Top customers by volume (deliveries = unique BOL count)
  topCustomers: Array<{
    name: string;                        // Customer name
    deliveries: number;                  // Count of unique deliveries to this customer
    volumeLitres: number;               // Total volume delivered to this customer
    volumeMegaLitres: number;           // Total volume in megalitres
  }>;
  
  // Terminal performance (deliveries = unique BOL count per terminal)
  terminalAnalysis: Array<{
    terminal: string;                    // Terminal name
    deliveries: number;                  // Count of unique deliveries from this terminal
    volumeLitres: number;               // Total volume from this terminal
    percentage: number;                  // Percentage of total volume
  }>;
  
  // Product mix analysis (deliveries = unique BOL count per product)
  productMix: Array<{
    product: string;                     // Product name
    deliveries: number;                  // Count of unique deliveries for this product
    volumeLitres: number;               // Total volume for this product
    percentage: number;                  // Percentage of total volume
  }>;
  
  // Peak performance month
  peakMonth: {
    month: string;                       // Month name
    year: number;                       // Year
    volumeMegaLitres: number;           // Volume in megalitres for peak month
  };
}

/**
 * Parse volume string and convert to number
 * Handles comma-separated numbers and negative values
 */
export function parseVolume(volumeStr: string): number {
  if (!volumeStr || volumeStr.trim() === '') return 0;
  
  // Remove quotes and commas, then parse
  const cleanStr = volumeStr.replace(/[",]/g, '').trim();
  return parseFloat(cleanStr) || 0;
}

/**
 * Smart format detection for date strings
 * Analyzes patterns to determine if data uses Australian (dd/mm/yyyy) or US (mm/dd/yyyy) format
 */
export function detectDateFormat(dateStrings: string[]): 'australian' | 'us' | 'european' | 'unknown' {
  let australianScore = 0;
  let usScore = 0;
  let europeanScore = 0;
  let totalAnalyzed = 0;
  
  // Analyze up to 50 date samples for format detection
  const samplesToAnalyze = Math.min(50, dateStrings.length);
  
  for (let i = 0; i < samplesToAnalyze; i++) {
    const dateStr = dateStrings[i].trim();
    
    // Skip empty dates
    if (!dateStr) continue;
    
    // European format detection (DD.MM.YYYY)
    if (dateStr.includes('.')) {
      europeanScore += 10;
      totalAnalyzed++;
      continue;
    }
    
    // Analyze slash-separated dates
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        
        // If first number > 12, must be day (Australian format)
        if (first > 12) {
          australianScore += 10;
        }
        // If second number > 12, must be month in first position (US format)
        else if (second > 12) {
          usScore += 10;
        }
        // If both <= 12, check for other patterns
        else {
          // Slight preference for Australian since that's our expected format
          australianScore += 1;
        }
        totalAnalyzed++;
      }
    }
  }
  
  if (totalAnalyzed === 0) return 'unknown';
  
  if (europeanScore > australianScore && europeanScore > usScore) {
    return 'european';
  } else if (australianScore >= usScore) {
    return 'australian';
  } else {
    return 'us';
  }
}

/**
 * Parse date string handling multiple formats with smart detection:
 * - DD/MM/YYYY (Australian format): 15/10/2021, 1/09/2023
 * - MM/DD/YYYY (US format): 9/1/2023, 11/6/2023
 * - DD.MM.YYYY (European format): 21.05.2025, 30.05.2025
 * - DD/MM/YY (2-digit year): 29/05/25, 15/03/24
 */
export function parseDeliveryDate(dateStr: string, detectedFormat?: 'australian' | 'us' | 'european'): Date {
  if (!dateStr || dateStr.trim() === '') {
    console.warn('Empty date string provided');
    return new Date();
  }

  const trimmedDate = dateStr.trim();
  
  // Handle DD.MM.YYYY format (like 21.05.2025) - June 2025 format
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmedDate)) {
    try {
      return parse(trimmedDate, 'd.M.yyyy', new Date());
    } catch (error) {
      console.warn(`Failed to parse DD.MM.YYYY date: ${trimmedDate}`, error);
    }
  }
  
  // Handle D/M/YY format (like 29/05/25) - convert YY to full year
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(trimmedDate)) {
    try {
      const parsed = parse(trimmedDate, 'd/M/yy', new Date());
      // Ensure years 20-99 map to 2020-2099, 00-19 map to 2000-2019
      if (parsed.getFullYear() < 2000) {
        parsed.setFullYear(parsed.getFullYear() + 100);
      }
      return parsed;
    } catch (error) {
      console.warn(`Failed to parse D/M/YY date: ${trimmedDate}`, error);
    }
  }

  // Handle slash-separated dates with smart format detection
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedDate)) {
    const formats = detectedFormat === 'us' 
      ? ['M/d/yyyy', 'd/M/yyyy'] // Try US first if detected
      : ['d/M/yyyy', 'M/d/yyyy']; // Default: Try Australian first
    
    for (const format of formats) {
      try {
        const parsed = parse(trimmedDate, format, new Date());
        // Validate the parsed date makes sense (reasonable range)
        if (parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2030) {
          return parsed;
        }
      } catch (error) {
        // Continue to next format
      }
    }
    
    console.warn(`Failed to parse date with detected format (${detectedFormat || 'australian'}): ${trimmedDate}`);
  }

  // Additional fallback attempts for other variations (Australian format prioritized)
  const fallbackFormats = [
    'dd/MM/yyyy',  // 29/05/2023 (Australian with leading zeros)
    'd/M/yyyy',    // 29/5/2023 (Australian without leading zeros)
    'MM/dd/yyyy',  // 09/01/2023 (US format)
    'M/d/yy',      // 9/1/23 (US format 2-digit year)
    'MM/dd/yy',    // 09/01/23 (US format 2-digit year)
    'dd.MM.yyyy',  // 21.05.2025 (European dot notation)
    'd.M.yy',      // 21.5.25 (European dot notation 2-digit year)
  ];

  for (const format of fallbackFormats) {
    try {
      const parsed = parse(trimmedDate, format, new Date());
      // Handle 2-digit years
      if (format.includes('yy') && !format.includes('yyyy') && parsed.getFullYear() < 2000) {
        parsed.setFullYear(parsed.getFullYear() + 100);
      }
      return parsed;
    } catch {
      // Continue to next format
    }
  }

  console.warn(`Could not parse date with any format: "${dateStr}". Tried Australian dd/mm/yyyy, US mm/dd/yyyy, and ${fallbackFormats.length} other formats.`);
  
  // Return a clearly invalid date instead of current date to make issues more visible
  const invalidDate = new Date('1900-01-01');
  console.error(`Returning fallback date for invalid input: ${dateStr}`);
  return invalidDate;
}

/**
 * Extract terminal name from location string
 */
export function extractTerminal(location: string): string {
  // Extract terminal from strings like "AU THDPTY GSF X GERALDTON" or "AU TERM KEWDALE"
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
 * Process raw CSV data into structured format with performance optimizations
 * Handles Australian d/m/y date format and various CSV structures
 * Optimized for large datasets (50K+ records)
 */
export function processCSVData(csvText: string, debugMode: boolean = false, maxRecords?: number): CaptivePaymentRecord[] {
  const lines = csvText.split('\n');
  // Performance optimization: pre-allocate array if we know the size
  const records: CaptivePaymentRecord[] = maxRecords ? new Array(maxRecords) : [];
  let recordIndex = 0;
  let headerFound = false;
  let headerRowIndex = -1;
  let skippedLines = 0;
  let validRecords = 0;
  let dateParseErrors = 0;
  
  // Chronological validation tracking
  let lastValidDate: Date | null = null;
  let chronologyWarnings = 0;
  let dateFormatDetected: string | null = null;
  let smartFormatDetected: 'australian' | 'us' | 'european' | 'unknown' | null = null;
  
  // Performance tracking
  const startTime = Date.now();
  
  // Smart format detection - analyze first 100 lines to detect date format
  if (debugMode) {
    const dateStringsForAnalysis: string[] = [];
    for (let i = 0; i < Math.min(lines.length, 100); i++) {
      const line = lines[i].trim();
      if (line && line.includes(',')) {
        const fields = parseCSVLine(line);
        if (fields.length >= 1 && fields[0].trim()) {
          const dateField = fields[0].trim().replace(/"/g, '');
          if (dateField && /\d/.test(dateField) && !dateField.toLowerCase().includes('date')) {
            dateStringsForAnalysis.push(dateField);
          }
        }
      }
    }
    
    if (dateStringsForAnalysis.length > 0) {
      smartFormatDetected = detectDateFormat(dateStringsForAnalysis);
      console.log(`🧺 Smart format detection: ${smartFormatDetected} (analyzed ${dateStringsForAnalysis.length} samples)`);
      console.log(`   Sample dates: ${dateStringsForAnalysis.slice(0, 5).join(', ')}`);
    }
  }
  
  if (debugMode) {
    console.log(`🔍 Processing CSV with ${lines.length} total lines`);
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip completely empty lines
    if (!line) {
      skippedLines++;
      continue;
    }
    
    // Enhanced section header detection - skip lines that are clearly headers
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('esperance') || 
        lowerLine.includes('geraldton') || 
        lowerLine.includes('total') ||
        (!line.includes(',') && line.length < 50)) {
      if (debugMode) console.log(`⏭️  Skipping section header at line ${i + 1}: ${line.substring(0, 50)}...`);
      skippedLines++;
      continue;
    }
    
    // Split by comma to check field count (basic validation)
    const basicSplit = line.split(',');
    if (basicSplit.length < 3) {
      skippedLines++;
      continue;
    }
    
    // Look for the actual data header row (contains "Date,Bill of Lading,Location,Customer,Product,Volume")
    if (!headerFound && 
        (lowerLine.includes('date') && lowerLine.includes('bill') && lowerLine.includes('lading')) ||
        (lowerLine.includes('date') && lowerLine.includes('location') && lowerLine.includes('customer'))) {
      headerFound = true;
      headerRowIndex = i;
      if (debugMode) console.log(`✅ Found header row at line ${i + 1}: ${line}`);
      continue;
    }
    
    // Skip lines until we find the header
    if (!headerFound) {
      skippedLines++;
      continue;
    }
    
    // Parse CSV line properly handling quoted fields
    const fields = parseCSVLine(line);
    
    // Ensure we have enough fields (Date, BOL, Location, Customer, Product, Volume)
    if (fields.length < 6) {
      if (debugMode && fields.length > 0) {
        console.log(`⚠️  Insufficient fields at line ${i + 1} (${fields.length} fields): ${fields.join('|')}`);
      }
      skippedLines++;
      continue;
    }
    
    // Validate and clean the date field
    const dateField = fields[0].trim().replace(/"/g, ''); // Remove any quotes
    if (!dateField) {
      skippedLines++;
      continue;
    }
    
    // Enhanced Australian date validation (d/m/y or dd/mm/yyyy)
    const australianDatePattern = /^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}$/;
    if (!australianDatePattern.test(dateField)) {
      if (debugMode) console.log(`❌ Invalid date format at line ${i + 1}: "${dateField}"`);
      dateParseErrors++;
      skippedLines++;
      continue;
    }
    
    // Parse and validate the date for chronological order
    let parsedDate: Date;
    try {
      parsedDate = parseDeliveryDate(dateField, smartFormatDetected || undefined);
      
      // Validate the parsed date isn't clearly wrong (like year 1900)
      if (parsedDate.getFullYear() < 2020) {
        if (debugMode) console.log(`❌ Suspicious date at line ${i + 1}: "${dateField}" → ${parsedDate.toISOString()}`);
        dateParseErrors++;
        skippedLines++;
        continue;
      }
      
      // Chronological validation (data should be sorted chronologically)
      if (lastValidDate && parsedDate < lastValidDate) {
        chronologyWarnings++;
        if (debugMode && chronologyWarnings <= 5) {
          console.log(`⚠️  Chronology warning at line ${i + 1}: ${parsedDate.toLocaleDateString()} comes after ${lastValidDate.toLocaleDateString()}`);
        }
      } else {
        lastValidDate = parsedDate;
      }
      
      // Detect date format for logging
      if (!dateFormatDetected && validRecords === 0) {
        if (dateField.includes('.')) {
          dateFormatDetected = 'DD.MM.YYYY (European)';
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateField)) {
          dateFormatDetected = smartFormatDetected === 'us' ? 'MM/DD/YYYY (US)' : 'DD/MM/YYYY (Australian)';
        } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateField)) {
          dateFormatDetected = smartFormatDetected === 'us' ? 'MM/DD/YY (US)' : 'DD/MM/YY (Australian)';
        }
      }
      
    } catch (error) {
      if (debugMode) console.log(`❌ Date parsing failed at line ${i + 1}: "${dateField}"`);
      dateParseErrors++;
      skippedLines++;
      continue;
    }
    
    // Parse and validate volume
    const volumeStr = fields[5].trim();
    const volume = parseVolume(volumeStr);
    
    // Allow negative volumes (adjustments) but skip zero volumes
    if (volume === 0) {
      skippedLines++;
      continue;
    }
    
    // Performance optimization: stop processing if we've reached max records
    if (maxRecords && recordIndex >= maxRecords) {
      if (debugMode) console.log(`🛑 Reached maximum record limit: ${maxRecords}`);
      break;
    }
    
    // Create the record with minimal string operations
    const record: CaptivePaymentRecord = {
      date: dateField,
      billOfLading: fields[1].replace(/"/g, '').trim(),
      location: fields[2].replace(/"/g, '').trim(),
      customer: fields[3].replace(/"/g, '').trim(),
      product: fields[4].replace(/"/g, '').trim(),
      volume: volume
    };
    
    if (maxRecords) {
      records[recordIndex] = record;
    } else {
      records.push(record);
    }
    recordIndex++;
    validRecords++;
  }
  
  const endTime = Date.now();
  const processingTime = endTime - startTime;
  
  // Trim array if we pre-allocated but didn't fill it completely
  const finalRecords = maxRecords ? records.slice(0, recordIndex) : records;
  
  if (debugMode) {
    console.log(`📊 CSV Processing Summary:`);
    console.log(`   Total lines: ${lines.length}`);
    console.log(`   Header found at line: ${headerRowIndex + 1}`);
    console.log(`   Valid records: ${validRecords}`);
    console.log(`   Skipped lines: ${skippedLines}`);
    console.log(`   Date parse errors: ${dateParseErrors}`);
    console.log(`   Chronology warnings: ${chronologyWarnings}`);
    console.log(`   Date format detected: ${dateFormatDetected || 'Unknown'}`);
    console.log(`   Smart format: ${smartFormatDetected || 'Not detected'}`);
    console.log(`   Success rate: ${((validRecords / lines.length) * 100).toFixed(1)}%`);
    console.log(`   Processing time: ${processingTime}ms`);
    console.log(`   Records per second: ${Math.round(validRecords / (processingTime / 1000))}`);
    
    if (finalRecords.length > 0) {
      const sampleRecord = finalRecords[0];
      const lastRecord = finalRecords[finalRecords.length - 1];
      console.log(`   First record:`, sampleRecord);
      console.log(`   Last record:`, lastRecord);
      
      // Test date parsing for first and last records
      try {
        const firstDate = parseDeliveryDate(sampleRecord.date, smartFormatDetected || undefined);
        const lastDate = parseDeliveryDate(lastRecord.date, smartFormatDetected || undefined);
        console.log(`   Date range: ${firstDate.toLocaleDateString()} → ${lastDate.toLocaleDateString()}`);
        console.log(`   Chronological span: ${Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))} days`);
        
        // Validate chronological order
        if (firstDate > lastDate) {
          console.warn(`   ⚠️  WARNING: First date (${firstDate.toLocaleDateString()}) is after last date (${lastDate.toLocaleDateString()}). Data may not be chronologically sorted or date format may be incorrect.`);
        }
      } catch (error) {
        console.log(`   Date range calculation failed:`, error);
      }
    }
  }
  
  // Final validation: warn if too many chronology issues
  if (chronologyWarnings > validRecords * 0.1) {
    console.warn(`⚠️  High chronology warning rate: ${chronologyWarnings}/${validRecords} records (${(chronologyWarnings/validRecords*100).toFixed(1)}%). Data may not be properly sorted or date format may be incorrect.`);
  }
  
  return finalRecords;
}

/**
 * Generate a unique delivery key for BOL grouping
 * 
 * Business Logic: A delivery is defined as a unique combination of:
 * - Bill of Lading number (BOL)
 * - Delivery date  
 * - Customer name
 * 
 * Multiple CSV records with different products/quantities but same BOL, date, 
 * and customer represent one physical delivery with multiple compartments.
 * 
 * @param record - The captive payment record
 * @returns Unique key in format "BOL-Date-Customer"
 * @example "8139648161-1/09/2023-SOUTH32 WORSLEY REFINERY GARAGE"
 */
export function generateDeliveryKey(record: CaptivePaymentRecord): string {
  return `${record.billOfLading}-${record.date}-${record.customer}`;
}

/**
 * Count unique deliveries from a set of records
 * 
 * This function implements the core business logic for delivery counting:
 * - Each unique BOL + Date + Customer combination = 1 delivery
 * - Multiple CSV rows with same BOL/Date/Customer = still 1 delivery
 * - Used throughout the application for accurate delivery metrics
 * 
 * @param records - Array of captive payment records
 * @returns Number of unique deliveries (not CSV record count)
 */
export function countUniqueDeliveries(records: CaptivePaymentRecord[]): number {
  const uniqueDeliveries = new Set<string>();
  records.forEach(record => {
    uniqueDeliveries.add(generateDeliveryKey(record));
  });
  return uniqueDeliveries.size;
}

/**
 * Group records by delivery (BOL + Date + Customer) and aggregate volumes
 */
export function groupRecordsByDelivery(records: CaptivePaymentRecord[]): Map<string, {
  billOfLading: string;
  date: string;
  customer: string;
  location: string;
  totalVolume: number;
  products: string[];
  recordCount: number;
}> {
  const deliveryGroups = new Map<string, {
    billOfLading: string;
    date: string;
    customer: string;
    location: string;
    totalVolume: number;
    products: string[];
    recordCount: number;
  }>();

  records.forEach(record => {
    const key = generateDeliveryKey(record);
    
    if (!deliveryGroups.has(key)) {
      deliveryGroups.set(key, {
        billOfLading: record.billOfLading,
        date: record.date,
        customer: record.customer,
        location: record.location,
        totalVolume: 0,
        products: [],
        recordCount: 0
      });
    }

    const group = deliveryGroups.get(key)!;
    group.totalVolume += Math.abs(record.volume);
    if (!group.products.includes(record.product)) {
      group.products.push(record.product);
    }
    group.recordCount++;
  });

  return deliveryGroups;
}

/**
 * Parse a CSV line handling quoted fields
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
 * Generate monthly aggregated data from records
 * FIXED: Now counts unique deliveries (BOL + Date + Customer) per month instead of counting CSV rows
 */
export function generateMonthlyData(records: CaptivePaymentRecord[]): MonthlyVolumeData[] {
  const monthlyMap = new Map<string, { deliveries: Set<string>; volume: number; year: number }>();
  
  records.forEach(record => {
    const date = parseDeliveryDate(record.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const deliveryKey = generateDeliveryKey(record);
    
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { deliveries: new Set<string>(), volume: 0, year: date.getFullYear() });
    }
    
    const entry = monthlyMap.get(monthKey)!;
    entry.deliveries.add(deliveryKey); // Add unique delivery key to Set
    entry.volume += Math.abs(record.volume); // Use absolute value for volume calculations
  });
  
  // Convert to array and sort by date
  const monthlyData: MonthlyVolumeData[] = [];
  
  Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      monthlyData.push({
        month: monthName,
        year: parseInt(year),
        deliveries: data.deliveries.size, // FIXED: Use Set size for unique delivery count
        volumeLitres: data.volume,
        volumeMegaLitres: data.volume / 1000000
      });
    });
  
  return monthlyData;
}

/**
 * Process CSV data into comprehensive analytics structure with performance optimizations
 * Optimized for large datasets (50K+ records)
 */
export function processCaptivePaymentsData(csvText: string, maxRecords?: number): ProcessedCaptiveData {
  const rawRecords = processCSVData(csvText, false, maxRecords);
  const monthlyData = generateMonthlyData(rawRecords);
  
  // Calculate totals (using absolute values for volume calculations)
  const totalVolumeLitres = rawRecords.reduce((sum, record) => sum + Math.abs(record.volume), 0);
  const totalVolumeMegaLitres = totalVolumeLitres / 1000000;
  const totalDeliveries = countUniqueDeliveries(rawRecords); // FIXED: Count unique BOLs instead of CSV rows
  const averageDeliverySize = totalDeliveries > 0 ? totalVolumeLitres / totalDeliveries : 0;
  
  // Extract unique values
  const uniqueCustomers = new Set(rawRecords.map(r => r.customer)).size;
  const terminals = Array.from(new Set(rawRecords.map(r => extractTerminal(r.location))));
  const products = Array.from(new Set(rawRecords.map(r => r.product)));
  
  // Calculate date range
  const dates = rawRecords.map(r => parseDeliveryDate(r.date)).sort((a, b) => a.getTime() - b.getTime());
  const startDate = dates.length > 0 ? dates[0] : new Date();
  const endDate = dates.length > 0 ? dates[dates.length - 1] : new Date();
  const monthsCovered = monthlyData.length;
  
  // Calculate top customers by volume (count unique deliveries per customer)
  const customerMap = new Map<string, { deliveries: Set<string>; volume: number }>();
  rawRecords.forEach(record => {
    const volume = Math.abs(record.volume);
    const deliveryKey = generateDeliveryKey(record);
    if (!customerMap.has(record.customer)) {
      customerMap.set(record.customer, { deliveries: new Set<string>(), volume: 0 });
    }
    const entry = customerMap.get(record.customer)!;
    entry.deliveries.add(deliveryKey); // Track unique deliveries with Set
    entry.volume += volume;
  });
  
  const topCustomers = Array.from(customerMap.entries())
    .map(([name, data]) => ({
      name,
      deliveries: data.deliveries.size, // FIXED: Use Set size for unique delivery count
      volumeLitres: data.volume,
      volumeMegaLitres: data.volume / 1000000
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres)
    .slice(0, 10); // Top 10 customers
  
  // Calculate terminal analysis (count unique deliveries per terminal)
  const terminalMap = new Map<string, { deliveries: Set<string>; volume: number }>();
  rawRecords.forEach(record => {
    const terminal = extractTerminal(record.location);
    const volume = Math.abs(record.volume);
    const deliveryKey = generateDeliveryKey(record);
    if (!terminalMap.has(terminal)) {
      terminalMap.set(terminal, { deliveries: new Set<string>(), volume: 0 });
    }
    const entry = terminalMap.get(terminal)!;
    entry.deliveries.add(deliveryKey); // Track unique deliveries with Set
    entry.volume += volume;
  });
  
  const terminalAnalysis = Array.from(terminalMap.entries())
    .map(([terminal, data]) => ({
      terminal,
      deliveries: data.deliveries.size, // FIXED: Use Set size for unique delivery count
      volumeLitres: data.volume,
      percentage: totalVolumeLitres > 0 ? (data.volume / totalVolumeLitres) * 100 : 0
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres);
  
  // Calculate product mix (count unique deliveries per product)
  const productMap = new Map<string, { deliveries: Set<string>; volume: number }>();
  rawRecords.forEach(record => {
    const volume = Math.abs(record.volume);
    const deliveryKey = generateDeliveryKey(record);
    if (!productMap.has(record.product)) {
      productMap.set(record.product, { deliveries: new Set<string>(), volume: 0 });
    }
    const entry = productMap.get(record.product)!;
    entry.deliveries.add(deliveryKey); // Track unique deliveries with Set
    entry.volume += volume;
  });
  
  const productMix = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      deliveries: data.deliveries.size, // FIXED: Use Set size for unique delivery count
      volumeLitres: data.volume,
      percentage: totalVolumeLitres > 0 ? (data.volume / totalVolumeLitres) * 100 : 0
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres);
  
  // Find peak month
  const peakMonth = monthlyData.reduce((peak, current) => 
    current.volumeMegaLitres > peak.volumeMegaLitres ? current : peak,
    monthlyData[0] || { month: 'N/A', year: 0, volumeMegaLitres: 0 }
  );
  
  return {
    rawRecords,
    monthlyData,
    totalVolumeLitres,
    totalVolumeMegaLitres,
    totalDeliveries,
    uniqueCustomers,
    terminals,
    products,
    dateRange: {
      startDate: startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      endDate: endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      monthsCovered
    },
    averageDeliverySize,
    topCustomers,
    terminalAnalysis,
    productMix,
    peakMonth
  };
}

/**
 * Load and process GSF CSV data
 */
export async function loadGSFData(): Promise<ProcessedCaptiveData> {
  try {
    const response = await fetch('/Inputdata_southern Fuel (3)(Carrier - GSF).csv');
    if (!response.ok) throw new Error('Failed to load GSF data');
    const csvText = await response.text();
    return processCaptivePaymentsData(csvText);
  } catch (error) {
    console.error('Error loading GSF data:', error);
    throw error;
  }
}

/**
 * Load and process SMB CSV data
 * Dataset covers September 1, 2023 to June 30, 2025 (23,000+ records)
 */
export async function loadSMBData(): Promise<ProcessedCaptiveData> {
  try {
    const response = await fetch('/Inputdata_southern Fuel (3)(Carrier - SMB).csv');
    if (!response.ok) throw new Error('Failed to load SMB data');
    const csvText = await response.text();
    return processCaptivePaymentsData(csvText);
  } catch (error) {
    console.error('Error loading SMB data:', error);
    throw error;
  }
}

/**
 * Format volume for display (automatically choose best unit)
 */
export function formatVolume(litres: number, showUnit: boolean = true): string {
  if (litres >= 1000000) {
    const megaLitres = litres / 1000000;
    return `${megaLitres.toFixed(2)}${showUnit ? ' ML' : ''}`;
  } else if (litres >= 1000) {
    const kiloLitres = litres / 1000;
    return `${kiloLitres.toFixed(0)}${showUnit ? ' KL' : ''}`;
  } else {
    return `${litres.toFixed(0)}${showUnit ? ' L' : ''}`;
  }
}

/**
 * Calculate year-over-year growth
 */
export function calculateGrowth(current: number, previous: number): { value: number; percentage: string } {
  if (previous === 0) return { value: current, percentage: 'N/A' };
  
  const growth = ((current - previous) / previous) * 100;
  return {
    value: current - previous,
    percentage: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`
  };
}

/**
 * DATE FILTERING FUNCTIONS: Advanced date range filtering capabilities with performance caching
 */

// Simple in-memory cache for filtered data results
interface CacheEntry {
  key: string;
  data: ProcessedCaptiveData;
  timestamp: number;
  expiry: number;
}

class FilterCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly MAX_ENTRIES = 50; // Limit cache size

  generateKey(csvText: string, startDate: Date | null, endDate: Date | null): string {
    const textHash = this.simpleHash(csvText.substring(0, 500)); // Hash first 500 chars for uniqueness
    const startStr = startDate ? startDate.toISOString().split('T')[0] : 'null';
    const endStr = endDate ? endDate.toISOString().split('T')[0] : 'null';
    return `${textHash}-${startStr}-${endStr}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  get(key: string): ProcessedCaptiveData | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) {
      return entry.data;
    }
    
    // Remove expired entry
    if (entry) {
      this.cache.delete(key);
    }
    
    return null;
  }

  set(key: string, data: ProcessedCaptiveData): void {
    // Clean old entries if cache is getting full
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    const now = Date.now();
    this.cache.set(key, {
      key,
      data,
      timestamp: now,
      expiry: now + this.TTL
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics for debugging
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Global cache instance
const filterCache = new FilterCache();

/**
 * Filter records by date range
 */
export function filterRecordsByDateRange(
  records: CaptivePaymentRecord[], 
  startDate: Date | null, 
  endDate: Date | null
): CaptivePaymentRecord[] {
  if (!startDate && !endDate) {
    return records; // No filtering
  }

  return records.filter(record => {
    const recordDate = parseDeliveryDate(record.date);
    
    // Handle invalid dates
    if (isNaN(recordDate.getTime())) {
      console.warn(`Invalid date in record: ${record.date}`);
      return false;
    }

    // Apply date range filters
    if (startDate && recordDate < startDate) {
      return false;
    }
    
    if (endDate) {
      // Set end date to end of day for inclusive filtering
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (recordDate > endOfDay) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Process filtered captive payments data with date range (with caching)
 */
export function processFilteredCaptiveData(
  csvText: string, 
  startDate: Date | null = null, 
  endDate: Date | null = null,
  debugMode: boolean = false
): ProcessedCaptiveData {
  // Check cache first for performance optimization (skip cache in debug mode)
  if (!debugMode) {
    const cacheKey = filterCache.generateKey(csvText, startDate, endDate);
    const cachedResult = filterCache.get(cacheKey);
    
    if (cachedResult) {
      console.log(`Cache hit for date filter: ${startDate?.toISOString().split('T')[0]} - ${endDate?.toISOString().split('T')[0]}`);
      return cachedResult;
    }
  }

  if (debugMode) {
    console.log(`🔄 Processing filtered data (debug mode): ${startDate?.toISOString().split('T')[0]} - ${endDate?.toISOString().split('T')[0]}`);
  } else {
    console.log(`Processing filtered data: ${startDate?.toISOString().split('T')[0]} - ${endDate?.toISOString().split('T')[0]}`);
  }
  
  // Process data with debug mode enabled
  const allRecords = processCSVData(csvText, debugMode);
  
  if (debugMode) {
    console.log(`📋 Total records parsed: ${allRecords.length}`);
  }
  
  const filteredRecords = filterRecordsByDateRange(allRecords, startDate, endDate);
  
  if (debugMode) {
    console.log(`🎯 Records after date filtering: ${filteredRecords.length}`);
  }
  
  const result = processCaptivePaymentsDataFromRecords(filteredRecords);
  
  // Cache the result for future use (unless in debug mode)
  if (!debugMode) {
    const cacheKey = filterCache.generateKey(csvText, startDate, endDate);
    filterCache.set(cacheKey, result);
  }
  
  return result;
}

/**
 * Get available date range from records
 */
export function getAvailableDateRange(records: CaptivePaymentRecord[]): {
  minDate: Date;
  maxDate: Date;
  totalRecords: number;
} {
  if (records.length === 0) {
    const today = new Date();
    return {
      minDate: today,
      maxDate: today,
      totalRecords: 0
    };
  }

  const dates = records
    .map(record => parseDeliveryDate(record.date))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    minDate: dates[0] || new Date(),
    maxDate: dates[dates.length - 1] || new Date(),
    totalRecords: records.length
  };
}

/**
 * Load and process SMB data with optional date filtering
 */
export async function loadSMBDataWithDateFilter(
  startDate: Date | null = null, 
  endDate: Date | null = null,
  debugMode: boolean = false
): Promise<ProcessedCaptiveData> {
  try {
    const response = await fetch('/Inputdata_southern Fuel (3)(Carrier - SMB).csv');
    if (!response.ok) throw new Error('Failed to load SMB data');
    const csvText = await response.text();
    return processFilteredCaptiveData(csvText, startDate, endDate, debugMode);
  } catch (error) {
    console.error('Error loading SMB data:', error);
    throw error;
  }
}

/**
 * Load and process GSF data with optional date filtering
 */
export async function loadGSFDataWithDateFilter(
  startDate: Date | null = null, 
  endDate: Date | null = null,
  debugMode: boolean = false
): Promise<ProcessedCaptiveData> {
  try {
    const response = await fetch('/Inputdata_southern Fuel (3)(Carrier - GSF).csv');
    if (!response.ok) throw new Error('Failed to load GSF data');
    const csvText = await response.text();
    
    if (debugMode) {
      console.log(`🔄 Processing GSF data with date filter: ${startDate?.toDateString()} - ${endDate?.toDateString()}`);
    }
    
    return processFilteredCaptiveData(csvText, startDate, endDate, debugMode);
  } catch (error) {
    console.error('Error loading GSF data:', error);
    throw error;
  }
}

/**
 * Load and process combined captive payments data with date filtering
 */
export async function loadCombinedCaptiveDataWithDateFilter(
  startDate: Date | null = null, 
  endDate: Date | null = null,
  debugMode: boolean = false
): Promise<{
  smbData: ProcessedCaptiveData;
  gsfData: ProcessedCaptiveData;
  combinedData: ProcessedCaptiveData;
}> {
  try {
    const [smbData, gsfData] = await Promise.all([
      loadSMBDataWithDateFilter(startDate, endDate, debugMode),
      loadGSFDataWithDateFilter(startDate, endDate, debugMode)
    ]);

    // Combine filtered records from both carriers
    const combinedRecords = [...smbData.rawRecords, ...gsfData.rawRecords];
    const combinedData = processCaptivePaymentsDataFromRecords(combinedRecords);

    if (debugMode) {
      console.log(`🔄 Combined data: SMB(${smbData.rawRecords.length}) + GSF(${gsfData.rawRecords.length}) = ${combinedRecords.length} total records`);
    }

    return {
      smbData,
      gsfData,
      combinedData
    };
  } catch (error) {
    console.error('Error loading combined captive data:', error);
    throw error;
  }
}

/**
 * Calculate filter statistics for UI feedback
 */
export function calculateFilterStats(
  allRecords: CaptivePaymentRecord[],
  filteredRecords: CaptivePaymentRecord[]
): {
  totalRecords: number;
  filteredRecords: number;
  filteredPercentage: number;
  dateRange: string;
} {
  const totalRecords = allRecords.length;
  const filteredCount = filteredRecords.length;
  const percentage = totalRecords > 0 ? (filteredCount / totalRecords) * 100 : 0;
  
  let dateRange = 'All dates';
  if (filteredRecords.length > 0) {
    const dates = filteredRecords
      .map(r => parseDeliveryDate(r.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length > 0) {
      const start = dates[0];
      const end = dates[dates.length - 1];
      dateRange = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
  }

  return {
    totalRecords,
    filteredRecords: filteredCount,
    filteredPercentage: percentage,
    dateRange
  };
}

/**
 * CACHE MANAGEMENT UTILITIES
 */

/**
 * Clear all cached filter results (useful for debugging or memory management)
 */
export function clearFilterCache(): void {
  filterCache.clear();
  console.log('Filter cache cleared');
}

/**
 * Get cache statistics for performance monitoring
 */
export function getFilterCacheStats(): { size: number; entries: string[] } {
  return filterCache.getStats();
}

/**
 * OPTION B PREPARATION: Multi-file data aggregation functions
 */

/**
 * Load and combine multiple CSV files for comprehensive analytics
 */
export async function loadCombinedGSFData(): Promise<ProcessedCaptiveData> {
  const filesToLoad = [
    '/Inputdata_southern Fuel (3)(Carrier - GSF).csv', // Current June 2025 data
    // Add historical files here when implementing Option B
  ];
  
  let allRecords: CaptivePaymentRecord[] = [];
  
  for (const file of filesToLoad) {
    try {
      const response = await fetch(file);
      if (response.ok) {
        const csvText = await response.text();
        const records = processCSVData(csvText);
        allRecords = allRecords.concat(records);
      }
    } catch (error) {
      console.warn(`Failed to load ${file}:`, error);
    }
  }
  
  // Remove duplicates based on Bill of Lading + Date + Volume
  const deduplicatedRecords = removeDuplicateRecords(allRecords);
  
  return processCaptivePaymentsDataFromRecords(deduplicatedRecords);
}

/**
 * Load and combine multiple SMB CSV files
 */
export async function loadCombinedSMBData(): Promise<ProcessedCaptiveData> {
  const filesToLoad = [
    '/Inputdata_southern Fuel (3)(Carrier - SMB).csv', // Current June 2025 data
    // Add historical files here when implementing Option B
  ];
  
  let allRecords: CaptivePaymentRecord[] = [];
  
  for (const file of filesToLoad) {
    try {
      const response = await fetch(file);
      if (response.ok) {
        const csvText = await response.text();
        const records = processCSVData(csvText);
        allRecords = allRecords.concat(records);
      }
    } catch (error) {
      console.warn(`Failed to load ${file}:`, error);
    }
  }
  
  // Remove duplicates based on Bill of Lading + Date + Volume
  const deduplicatedRecords = removeDuplicateRecords(allRecords);
  
  return processCaptivePaymentsDataFromRecords(deduplicatedRecords);
}

/**
 * Remove duplicate records based on Bill of Lading + Date + Volume
 */
export function removeDuplicateRecords(records: CaptivePaymentRecord[]): CaptivePaymentRecord[] {
  const seen = new Set<string>();
  const deduplicated: CaptivePaymentRecord[] = [];
  
  for (const record of records) {
    // Create unique key from BOL + Date + Volume
    const key = `${record.billOfLading}-${record.date}-${record.volume}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(record);
    }
  }
  
  console.log(`Deduplication: ${records.length} records → ${deduplicated.length} unique records`);
  return deduplicated;
}

/**
 * Process records directly without CSV parsing (for combined data)
 */
export function processCaptivePaymentsDataFromRecords(records: CaptivePaymentRecord[]): ProcessedCaptiveData {
  const monthlyData = generateMonthlyData(records);
  
  // Calculate totals (using absolute values for volume calculations)
  const totalVolumeLitres = records.reduce((sum, record) => sum + Math.abs(record.volume), 0);
  const totalVolumeMegaLitres = totalVolumeLitres / 1000000;
  const totalDeliveries = countUniqueDeliveries(records); // FIXED: Count unique BOLs instead of CSV rows
  const averageDeliverySize = totalDeliveries > 0 ? totalVolumeLitres / totalDeliveries : 0;
  
  // Extract unique values
  const uniqueCustomers = new Set(records.map(r => r.customer)).size;
  const terminals = Array.from(new Set(records.map(r => extractTerminal(r.location))));
  const products = Array.from(new Set(records.map(r => r.product)));
  
  // Calculate date range
  const dates = records.map(r => parseDeliveryDate(r.date)).sort((a, b) => a.getTime() - b.getTime());
  const startDate = dates.length > 0 ? dates[0] : new Date();
  const endDate = dates.length > 0 ? dates[dates.length - 1] : new Date();
  const monthsCovered = monthlyData.length;
  
  // Calculate top customers by volume
  // FIXED: Count unique deliveries per customer instead of CSV rows
  const customerMap = new Map<string, { deliveries: Set<string>; volume: number }>();
  records.forEach(record => {
    const volume = Math.abs(record.volume);
    const deliveryKey = generateDeliveryKey(record);
    
    if (!customerMap.has(record.customer)) {
      customerMap.set(record.customer, { deliveries: new Set<string>(), volume: 0 });
    }
    const entry = customerMap.get(record.customer)!;
    entry.deliveries.add(deliveryKey); // Add unique delivery key to Set
    entry.volume += volume;
  });
  
  const topCustomers = Array.from(customerMap.entries())
    .map(([name, data]) => ({
      name,
      deliveries: data.deliveries.size, // FIXED: Use Set size for unique delivery count
      volumeLitres: data.volume,
      volumeMegaLitres: data.volume / 1000000
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres)
    .slice(0, 10); // Top 10 customers
  
  // Calculate terminal analysis (count unique deliveries per terminal)
  const terminalMap = new Map<string, { deliveries: Set<string>; volume: number }>();
  records.forEach(record => {
    const terminal = extractTerminal(record.location);
    const volume = Math.abs(record.volume);
    const deliveryKey = generateDeliveryKey(record);
    if (!terminalMap.has(terminal)) {
      terminalMap.set(terminal, { deliveries: new Set<string>(), volume: 0 });
    }
    const entry = terminalMap.get(terminal)!;
    entry.deliveries.add(deliveryKey); // Track unique deliveries with Set
    entry.volume += volume;
  });
  
  const terminalAnalysis = Array.from(terminalMap.entries())
    .map(([terminal, data]) => ({
      terminal,
      deliveries: data.deliveries.size, // FIXED: Use Set size for unique delivery count
      volumeLitres: data.volume,
      percentage: totalVolumeLitres > 0 ? (data.volume / totalVolumeLitres) * 100 : 0
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres);
  
  // Calculate product mix (count unique deliveries per product)
  const productMap = new Map<string, { deliveries: Set<string>; volume: number }>();
  records.forEach(record => {
    const volume = Math.abs(record.volume);
    const deliveryKey = generateDeliveryKey(record);
    if (!productMap.has(record.product)) {
      productMap.set(record.product, { deliveries: new Set<string>(), volume: 0 });
    }
    const entry = productMap.get(record.product)!;
    entry.deliveries.add(deliveryKey); // Track unique deliveries with Set
    entry.volume += volume;
  });
  
  const productMix = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      deliveries: data.deliveries.size, // FIXED: Use Set size for unique delivery count
      volumeLitres: data.volume,
      percentage: totalVolumeLitres > 0 ? (data.volume / totalVolumeLitres) * 100 : 0
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres);
  
  // Find peak month
  const peakMonth = monthlyData.reduce((peak, current) => 
    current.volumeMegaLitres > peak.volumeMegaLitres ? current : peak,
    monthlyData[0] || { month: 'N/A', year: 0, volumeMegaLitres: 0 }
  );
  
  return {
    rawRecords: records,
    monthlyData,
    totalVolumeLitres,
    totalVolumeMegaLitres,
    totalDeliveries,
    uniqueCustomers,
    terminals,
    products,
    dateRange: {
      startDate: startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      endDate: endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      monthsCovered
    },
    averageDeliverySize,
    topCustomers,
    terminalAnalysis,
    productMix,
    peakMonth
  };
}