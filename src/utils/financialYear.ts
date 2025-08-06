/**
 * AUSTRALIAN FINANCIAL YEAR UTILITIES
 * 
 * Utilities for handling Australian Financial Year calculations (July 1 - June 30)
 * Used for terminal and customer analytics reporting
 */

import { format, startOfMonth, endOfMonth, isWithinInterval, getYear, getMonth } from 'date-fns';

/**
 * Australian Financial Year interface
 */
export interface AustralianFY {
  fyYear: number; // The ending year (e.g., 2024 for FY2024)
  fyLabel: string; // "FY2024" or "2023-24" format
  startDate: Date; // July 1st of the starting year
  endDate: Date; // June 30th of the ending year
  isCurrentFY: boolean; // Whether this is the current FY
}

/**
 * Get the current Australian Financial Year
 * FY runs from July 1 to June 30
 * @returns Current Australian Financial Year details
 */
export function getCurrentAustralianFY(): AustralianFY {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based (0 = January, 6 = July)
  
  // If we're in July-December, we're in the FY that ends next year
  // If we're in January-June, we're in the FY that ends this year
  const fyEndYear = currentMonth >= 6 ? currentYear + 1 : currentYear;
  
  return getAustralianFY(fyEndYear);
}

/**
 * Get Australian Financial Year details for a specific FY ending year
 * @param fyYear The ending year of the financial year (e.g., 2024 for FY2024)
 * @returns Australian Financial Year details
 */
export function getAustralianFY(fyYear: number): AustralianFY {
  const startDate = new Date(fyYear - 1, 6, 1); // July 1st of previous year (month 6 = July)
  const endDate = new Date(fyYear, 5, 30); // June 30th of FY year (month 5 = June)
  const currentFY = getCurrentAustralianFY();
  
  return {
    fyYear,
    fyLabel: `FY${fyYear}`,
    startDate,
    endDate,
    isCurrentFY: fyYear === currentFY.fyYear
  };
}

/**
 * Get Australian Financial Year details for a specific date
 * @param date Date to get the FY for
 * @returns Australian Financial Year containing the date
 */
export function getAustralianFYForDate(date: Date): AustralianFY {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // If date is July-December, it's in the FY ending next year
  // If date is January-June, it's in the FY ending this year
  const fyEndYear = month >= 6 ? year + 1 : year;
  
  return getAustralianFY(fyEndYear);
}

/**
 * Get a range of Australian Financial Years
 * @param startFY Starting FY year (inclusive)
 * @param endFY Ending FY year (inclusive) - defaults to current FY
 * @returns Array of Australian Financial Years
 */
export function getAustralianFYRange(startFY: number, endFY?: number): AustralianFY[] {
  if (!endFY) {
    endFY = getCurrentAustralianFY().fyYear;
  }
  
  const fyRange: AustralianFY[] = [];
  for (let fyYear = startFY; fyYear <= endFY; fyYear++) {
    fyRange.push(getAustralianFY(fyYear));
  }
  
  return fyRange;
}

/**
 * Format Australian Financial Year label
 * @param fyYear The ending year of the financial year
 * @param format Format style ('short' = 'FY2024', 'long' = '2023-24')
 * @returns Formatted FY label
 */
export function formatAustralianFY(fyYear: number, formatStyle: 'short' | 'long' = 'short'): string {
  if (formatStyle === 'long') {
    return `${fyYear - 1}-${fyYear.toString().slice(-2)}`;
  }
  return `FY${fyYear}`;
}

/**
 * Check if a date falls within a specific Australian Financial Year
 * @param date Date to check
 * @param fyYear FY ending year to check against
 * @returns Whether the date is in the specified FY
 */
export function isDateInAustralianFY(date: Date, fyYear: number): boolean {
  const fy = getAustralianFY(fyYear);
  return isWithinInterval(date, { start: fy.startDate, end: fy.endDate });
}

/**
 * Group monthly analytics data by Australian Financial Year
 * @param monthlyData Array of monthly data with month_start property
 * @returns Map of FY year to aggregated data
 */
export function groupDataByAustralianFY<T extends { month_start: string; total_deliveries: number; total_volume_megalitres: number }>(
  monthlyData: T[]
): Map<number, {
  fyYear: number;
  fyLabel: string;
  totalDeliveries: number;
  totalVolumeMegaLitres: number;
  monthCount: number;
  months: T[];
}> {
  const fyGroups = new Map<number, {
    fyYear: number;
    fyLabel: string;
    totalDeliveries: number;
    totalVolumeMegaLitres: number;
    monthCount: number;
    months: T[];
  }>();

  monthlyData.forEach(month => {
    const monthDate = new Date(month.month_start);
    const fy = getAustralianFYForDate(monthDate);
    
    if (!fyGroups.has(fy.fyYear)) {
      fyGroups.set(fy.fyYear, {
        fyYear: fy.fyYear,
        fyLabel: fy.fyLabel,
        totalDeliveries: 0,
        totalVolumeMegaLitres: 0,
        monthCount: 0,
        months: []
      });
    }
    
    const fyGroup = fyGroups.get(fy.fyYear)!;
    fyGroup.totalDeliveries += month.total_deliveries;
    fyGroup.totalVolumeMegaLitres += month.total_volume_megalitres;
    fyGroup.monthCount++;
    fyGroup.months.push(month);
  });

  return fyGroups;
}

/**
 * Calculate Financial Year totals for a dataset
 * @param data Array of data with date and numeric properties
 * @param dateField Field name containing the date
 * @param valueFields Object mapping result field names to data field names
 * @returns Array of FY totals
 */
export function calculateAustralianFYTotals<T extends Record<string, any>>(
  data: T[],
  dateField: keyof T,
  valueFields: Record<string, keyof T>
): Array<{
  fyYear: number;
  fyLabel: string;
  startDate: string;
  endDate: string;
  isCurrentFY: boolean;
  [key: string]: any;
}> {
  const fyTotals = new Map<number, any>();

  // Group data by FY
  data.forEach(item => {
    const itemDate = new Date(item[dateField] as string);
    const fy = getAustralianFYForDate(itemDate);
    
    if (!fyTotals.has(fy.fyYear)) {
      const fyData: any = {
        fyYear: fy.fyYear,
        fyLabel: fy.fyLabel,
        startDate: format(fy.startDate, 'yyyy-MM-dd'),
        endDate: format(fy.endDate, 'yyyy-MM-dd'),
        isCurrentFY: fy.isCurrentFY
      };
      
      // Initialize value fields
      Object.keys(valueFields).forEach(resultField => {
        fyData[resultField] = 0;
      });
      
      fyTotals.set(fy.fyYear, fyData);
    }
    
    const fyData = fyTotals.get(fy.fyYear)!;
    
    // Sum the value fields
    Object.entries(valueFields).forEach(([resultField, dataField]) => {
      fyData[resultField] += Number(item[dataField]) || 0;
    });
  });

  return Array.from(fyTotals.values()).sort((a, b) => b.fyYear - a.fyYear);
}

/**
 * Get the previous Financial Year relative to a given FY
 * @param fyYear Current FY year
 * @returns Previous FY details
 */
export function getPreviousAustralianFY(fyYear: number): AustralianFY {
  return getAustralianFY(fyYear - 1);
}

/**
 * Calculate year-over-year growth between two Financial Years
 * @param currentFY Current FY data
 * @param previousFY Previous FY data
 * @param valueField Field to calculate growth for
 * @returns Growth percentage and change details
 */
export function calculateFYGrowth(
  currentFY: any,
  previousFY: any,
  valueField: string
): {
  growthRate: number;
  changeAmount: number;
  direction: 'increase' | 'decrease' | 'no-change';
} {
  const currentValue = Number(currentFY[valueField]) || 0;
  const previousValue = Number(previousFY[valueField]) || 0;
  
  if (previousValue === 0) {
    return {
      growthRate: currentValue > 0 ? 100 : 0,
      changeAmount: currentValue,
      direction: currentValue > 0 ? 'increase' : 'no-change'
    };
  }
  
  const changeAmount = currentValue - previousValue;
  const growthRate = (changeAmount / previousValue) * 100;
  
  return {
    growthRate: Math.round(growthRate * 100) / 100,
    changeAmount: Math.round(changeAmount * 100) / 100,
    direction: growthRate > 0 ? 'increase' : growthRate < 0 ? 'decrease' : 'no-change'
  };
}

/**
 * Get Financial Year quarters (Australian FY)
 * @param fyYear FY ending year
 * @returns Array of quarter details
 */
export function getAustralianFYQuarters(fyYear: number): Array<{
  quarter: number;
  label: string;
  startDate: Date;
  endDate: Date;
  months: string[];
}> {
  const fy = getAustralianFY(fyYear);
  
  return [
    {
      quarter: 1,
      label: 'Q1',
      startDate: new Date(fyYear - 1, 6, 1), // July
      endDate: new Date(fyYear - 1, 8, 30), // September
      months: ['July', 'August', 'September']
    },
    {
      quarter: 2,
      label: 'Q2',
      startDate: new Date(fyYear - 1, 9, 1), // October
      endDate: new Date(fyYear - 1, 11, 31), // December
      months: ['October', 'November', 'December']
    },
    {
      quarter: 3,
      label: 'Q3',
      startDate: new Date(fyYear, 0, 1), // January
      endDate: new Date(fyYear, 2, 31), // March
      months: ['January', 'February', 'March']
    },
    {
      quarter: 4,
      label: 'Q4',
      startDate: new Date(fyYear, 3, 1), // April
      endDate: new Date(fyYear, 5, 30), // June
      months: ['April', 'May', 'June']
    }
  ];
}