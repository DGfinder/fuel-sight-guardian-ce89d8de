import { parse } from 'date-fns';

export interface CaptivePaymentRecord {
  date: string;
  billOfLading: string;
  location: string;
  customer: string;
  product: string;
  volume: number; // in litres
}

export interface MonthlyVolumeData {
  month: string;
  year: number;
  deliveries: number;
  volumeLitres: number;
  volumeMegaLitres: number;
}

export interface ProcessedCaptiveData {
  rawRecords: CaptivePaymentRecord[];
  monthlyData: MonthlyVolumeData[];
  totalVolumeLitres: number;
  totalVolumeMegaLitres: number;
  totalDeliveries: number;
  uniqueCustomers: number;
  terminals: string[];
  products: string[];
  // Enhanced analytics
  dateRange: {
    startDate: string;
    endDate: string;
    monthsCovered: number;
  };
  averageDeliverySize: number;
  topCustomers: Array<{
    name: string;
    deliveries: number;
    volumeLitres: number;
    volumeMegaLitres: number;
  }>;
  terminalAnalysis: Array<{
    terminal: string;
    deliveries: number;
    volumeLitres: number;
    percentage: number;
  }>;
  productMix: Array<{
    product: string;
    deliveries: number;
    volumeLitres: number;
    percentage: number;
  }>;
  peakMonth: {
    month: string;
    year: number;
    volumeMegaLitres: number;
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
 * Parse date string handling multiple formats:
 * - M/D/YYYY (early data): 9/1/2023, 11/6/2023
 * - D/M/YY (later data): 29/05/25, 15/03/24
 * - DD.MM.YYYY (June 2025 data): 21.05.2025, 30.05.2025
 */
export function parseDeliveryDate(dateStr: string): Date {
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

  // Handle M/D/YYYY format (like 9/1/2023)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedDate)) {
    try {
      return parse(trimmedDate, 'M/d/yyyy', new Date());
    } catch (error) {
      console.warn(`Failed to parse M/D/YYYY date: ${trimmedDate}`, error);
    }
  }

  // Additional fallback attempts for other variations
  const fallbackFormats = [
    'MM/dd/yyyy',  // 09/01/2023
    'd/M/yyyy',    // 29/5/2023
    'dd/MM/yyyy',  // 29/05/2023
    'M/d/yy',      // 9/1/23
    'MM/dd/yy',    // 09/01/23
    'dd.MM.yyyy',  // 21.05.2025 alternative
    'd.M.yy',      // 21.5.25
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

  console.warn(`Could not parse date with any format: ${dateStr}`);
  return new Date(); // Return current date as last resort
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
 * Process raw CSV data into structured format
 * Handles both old format and new June 2025 format with section headers
 */
export function processCSVData(csvText: string): CaptivePaymentRecord[] {
  const lines = csvText.split('\n');
  const records: CaptivePaymentRecord[] = [];
  let headerFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip section headers (like "ESPERANCE", "GERALDTON 3PL TOTAL")
    if (!line.includes(',') || line.split(',').length < 3) continue;
    
    // Look for the actual header row (contains "Date,Bill of Lading,Location,Customer,Product,Volume")
    if (line.toLowerCase().includes('date') && line.toLowerCase().includes('bill') && !headerFound) {
      headerFound = true;
      continue;
    }
    
    // Skip until we find the header
    if (!headerFound) continue;
    
    // Parse CSV line - handle quoted fields properly
    const fields = parseCSVLine(line);
    if (fields.length < 6) continue;
    
    // Skip lines where the first field (date) is empty or invalid
    if (!fields[0] || fields[0].trim() === '') continue;
    
    // Check if first field looks like a date
    const dateField = fields[0].trim();
    if (!/^\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}$/.test(dateField)) continue;
    
    const volume = parseVolume(fields[5]);
    
    // Skip zero volume records or invalid data
    if (volume === 0) continue;
    
    const record: CaptivePaymentRecord = {
      date: dateField,
      billOfLading: fields[1],
      location: fields[2],
      customer: fields[3],
      product: fields[4],
      volume: volume
    };
    
    records.push(record);
  }
  
  return records;
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
 */
export function generateMonthlyData(records: CaptivePaymentRecord[]): MonthlyVolumeData[] {
  const monthlyMap = new Map<string, { deliveries: number; volume: number; year: number }>();
  
  records.forEach(record => {
    const date = parseDeliveryDate(record.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { deliveries: 0, volume: 0, year: date.getFullYear() });
    }
    
    const entry = monthlyMap.get(monthKey)!;
    entry.deliveries += 1;
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
        deliveries: data.deliveries,
        volumeLitres: data.volume,
        volumeMegaLitres: data.volume / 1000000
      });
    });
  
  return monthlyData;
}

/**
 * Process CSV data into comprehensive analytics structure
 */
export function processCaptivePaymentsData(csvText: string): ProcessedCaptiveData {
  const rawRecords = processCSVData(csvText);
  const monthlyData = generateMonthlyData(rawRecords);
  
  // Calculate totals (using absolute values for volume calculations)
  const totalVolumeLitres = rawRecords.reduce((sum, record) => sum + Math.abs(record.volume), 0);
  const totalVolumeMegaLitres = totalVolumeLitres / 1000000;
  const totalDeliveries = rawRecords.length;
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
  
  // Calculate top customers by volume
  const customerMap = new Map<string, { deliveries: number; volume: number }>();
  rawRecords.forEach(record => {
    const volume = Math.abs(record.volume);
    if (!customerMap.has(record.customer)) {
      customerMap.set(record.customer, { deliveries: 0, volume: 0 });
    }
    const entry = customerMap.get(record.customer)!;
    entry.deliveries += 1;
    entry.volume += volume;
  });
  
  const topCustomers = Array.from(customerMap.entries())
    .map(([name, data]) => ({
      name,
      deliveries: data.deliveries,
      volumeLitres: data.volume,
      volumeMegaLitres: data.volume / 1000000
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres)
    .slice(0, 10); // Top 10 customers
  
  // Calculate terminal analysis
  const terminalMap = new Map<string, { deliveries: number; volume: number }>();
  rawRecords.forEach(record => {
    const terminal = extractTerminal(record.location);
    const volume = Math.abs(record.volume);
    if (!terminalMap.has(terminal)) {
      terminalMap.set(terminal, { deliveries: 0, volume: 0 });
    }
    const entry = terminalMap.get(terminal)!;
    entry.deliveries += 1;
    entry.volume += volume;
  });
  
  const terminalAnalysis = Array.from(terminalMap.entries())
    .map(([terminal, data]) => ({
      terminal,
      deliveries: data.deliveries,
      volumeLitres: data.volume,
      percentage: totalVolumeLitres > 0 ? (data.volume / totalVolumeLitres) * 100 : 0
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres);
  
  // Calculate product mix
  const productMap = new Map<string, { deliveries: number; volume: number }>();
  rawRecords.forEach(record => {
    const volume = Math.abs(record.volume);
    if (!productMap.has(record.product)) {
      productMap.set(record.product, { deliveries: 0, volume: 0 });
    }
    const entry = productMap.get(record.product)!;
    entry.deliveries += 1;
    entry.volume += volume;
  });
  
  const productMix = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      deliveries: data.deliveries,
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
  const totalDeliveries = records.length;
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
  const customerMap = new Map<string, { deliveries: number; volume: number }>();
  records.forEach(record => {
    const volume = Math.abs(record.volume);
    if (!customerMap.has(record.customer)) {
      customerMap.set(record.customer, { deliveries: 0, volume: 0 });
    }
    const entry = customerMap.get(record.customer)!;
    entry.deliveries += 1;
    entry.volume += volume;
  });
  
  const topCustomers = Array.from(customerMap.entries())
    .map(([name, data]) => ({
      name,
      deliveries: data.deliveries,
      volumeLitres: data.volume,
      volumeMegaLitres: data.volume / 1000000
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres)
    .slice(0, 10); // Top 10 customers
  
  // Calculate terminal analysis
  const terminalMap = new Map<string, { deliveries: number; volume: number }>();
  records.forEach(record => {
    const terminal = extractTerminal(record.location);
    const volume = Math.abs(record.volume);
    if (!terminalMap.has(terminal)) {
      terminalMap.set(terminal, { deliveries: 0, volume: 0 });
    }
    const entry = terminalMap.get(terminal)!;
    entry.deliveries += 1;
    entry.volume += volume;
  });
  
  const terminalAnalysis = Array.from(terminalMap.entries())
    .map(([terminal, data]) => ({
      terminal,
      deliveries: data.deliveries,
      volumeLitres: data.volume,
      percentage: totalVolumeLitres > 0 ? (data.volume / totalVolumeLitres) * 100 : 0
    }))
    .sort((a, b) => b.volumeLitres - a.volumeLitres);
  
  // Calculate product mix
  const productMap = new Map<string, { deliveries: number; volume: number }>();
  records.forEach(record => {
    const volume = Math.abs(record.volume);
    if (!productMap.has(record.product)) {
      productMap.set(record.product, { deliveries: 0, volume: 0 });
    }
    const entry = productMap.get(record.product)!;
    entry.deliveries += 1;
    entry.volume += volume;
  });
  
  const productMix = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      deliveries: data.deliveries,
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