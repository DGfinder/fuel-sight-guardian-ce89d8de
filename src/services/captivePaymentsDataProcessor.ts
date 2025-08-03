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
 * Parse date string in M/D/YYYY format
 */
export function parseDeliveryDate(dateStr: string): Date {
  try {
    return parse(dateStr, 'M/d/yyyy', new Date());
  } catch {
    // Fallback parsing attempts
    try {
      return parse(dateStr, 'MM/dd/yyyy', new Date());
    } catch {
      try {
        return parse(dateStr, 'd/M/yyyy', new Date());
      } catch {
        console.warn(`Could not parse date: ${dateStr}`);
        return new Date();
      }
    }
  }
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
 */
export function processCSVData(csvText: string): CaptivePaymentRecord[] {
  const lines = csvText.split('\n');
  const records: CaptivePaymentRecord[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line - handle quoted fields properly
    const fields = parseCSVLine(line);
    if (fields.length < 6) continue;
    
    const volume = parseVolume(fields[5]);
    
    // Skip zero volume records or invalid data
    if (volume === 0) continue;
    
    const record: CaptivePaymentRecord = {
      date: fields[0],
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
  
  // Calculate totals (using absolute values)
  const totalVolumeLitres = rawRecords.reduce((sum, record) => sum + Math.abs(record.volume), 0);
  const totalVolumeMegaLitres = totalVolumeLitres / 1000000;
  const totalDeliveries = rawRecords.length;
  
  // Extract unique values
  const uniqueCustomers = new Set(rawRecords.map(r => r.customer)).size;
  const terminals = Array.from(new Set(rawRecords.map(r => extractTerminal(r.location))));
  const products = Array.from(new Set(rawRecords.map(r => r.product)));
  
  return {
    rawRecords,
    monthlyData,
    totalVolumeLitres,
    totalVolumeMegaLitres,
    totalDeliveries,
    uniqueCustomers,
    terminals,
    products
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