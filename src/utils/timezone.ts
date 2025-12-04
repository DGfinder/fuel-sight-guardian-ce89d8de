/**
 * Centralized timezone utility for Perth, Western Australia
 * Uses simple UTC+8 calculation for reliability and performance
 * 
 * Perth, WA is UTC+8 year-round (no daylight saving time)
 * This approach avoids complex timezone libraries and browser compatibility issues
 */

// Perth timezone constant - Western Australia uses AWST (UTC+8)
// Can be overridden via environment variable for testing/deployment flexibility
export const PERTH_TIMEZONE = import.meta.env.VITE_TIMEZONE || 'Australia/Perth';

// UTC+8 offset in milliseconds for Perth timezone calculations
const PERTH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

// Create timezone-aware date formatter
const perthFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: PERTH_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

const perthDateFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: PERTH_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const perthTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: PERTH_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

/**
 * Convert any date/timestamp to Perth timezone
 */
export function toPerthTime(date: Date | string | number): Date {
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) {
    console.warn('Invalid date provided to toPerthTime:', date);
    return new Date();
  }
  return inputDate;
}

/**
 * Format timestamp in Perth timezone - standard format
 */
export function formatPerthTimestamp(date: Date | string | number): string {
  const perthDate = toPerthTime(date);
  try {
    return perthFormatter.format(perthDate).replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})/, '$3-$2-$1 $4:$5:$6');
  } catch (error) {
    console.error('Error formatting Perth timestamp:', error, date);
    return 'Invalid Date';
  }
}

/**
 * Format timestamp for display in Perth timezone
 */
export function formatPerthDisplay(date: Date | string | number): string {
  const perthDate = toPerthTime(date);
  try {
    const formatted = perthFormatter.format(perthDate);
    // Convert from DD/MM/YYYY, HH:MM:SS to more readable format
    return formatted.replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})/, '$1/$2/$3 $4:$5:$6');
  } catch (error) {
    console.error('Error formatting Perth display:', error, date);
    return 'Invalid Date';
  }
}

/**
 * Get current time in Perth timezone (UTC+8)
 */
export function getPerthNow(): Date {
  const now = new Date();
  // Return current UTC time for accurate time calculations
  return now;
}

/**
 * Get today's date in Perth timezone (UTC+8) as YYYY-MM-DD string
 */
export function getPerthToday(): string {
  const now = new Date();
  // Simple UTC+8 calculation (Perth timezone)
  const perthTime = new Date(now.getTime() + PERTH_UTC_OFFSET_MS);
  return perthTime.toISOString().slice(0, 10);
}

/**
 * Get tomorrow's date in Perth timezone (UTC+8) as YYYY-MM-DD string
 */
export function getPerthTomorrow(): string {
  const now = new Date();
  // Simple UTC+8 calculation, then add one day
  const perthTime = new Date(now.getTime() + PERTH_UTC_OFFSET_MS);
  perthTime.setUTCDate(perthTime.getUTCDate() + 1);
  return perthTime.toISOString().slice(0, 10);
}

/**
 * Get yesterday's date in Perth timezone (UTC+8) as YYYY-MM-DD string
 */
export function getPerthYesterday(): string {
  const now = new Date();
  // Simple UTC+8 calculation, then subtract one day
  const perthTime = new Date(now.getTime() + PERTH_UTC_OFFSET_MS);
  perthTime.setUTCDate(perthTime.getUTCDate() - 1);
  return perthTime.toISOString().slice(0, 10);
}

/**
 * Calculate time difference in minutes from Perth current time
 */
export function getMinutesFromNowInPerth(date: Date | string | number): number {
  const inputDate = toPerthTime(date);
  const perthNow = getPerthNow();
  return Math.floor((perthNow.getTime() - inputDate.getTime()) / (1000 * 60));
}

/**
 * Format relative time in Perth timezone with proper "Just now" logic
 */
export function formatPerthRelativeTime(date: Date | string | number): string {
  const inputDate = toPerthTime(date);
  const minutesAgo = getMinutesFromNowInPerth(inputDate);
  
  // Handle invalid dates
  if (isNaN(inputDate.getTime())) {
    return 'Invalid Date';
  }
  
  // Handle future dates (data quality issue indicator)
  if (minutesAgo < 0) {
    const futureMinutes = Math.abs(minutesAgo);
    if (futureMinutes < 60) {
      return `⚠️ ${futureMinutes} min in future`;
    } else if (futureMinutes < 1440) {
      return `⚠️ ${Math.floor(futureMinutes / 60)}h in future`;
    } else {
      return `⚠️ ${Math.floor(futureMinutes / 1440)}d in future`;
    }
  }
  
  // Format past times
  if (minutesAgo < 1) {
    return '<1 min';
  } else if (minutesAgo < 60) {
    return `${minutesAgo} min ago`;
  } else if (minutesAgo < 1440) { // Less than 24 hours
    const hours = Math.floor(minutesAgo / 60);
    const remainingMinutes = minutesAgo % 60;
    if (remainingMinutes === 0) {
      return `${hours}h ago`;
    }
    return `${hours}h ${remainingMinutes}m ago`;
  } else if (minutesAgo < 10080) { // Less than 7 days
    const days = Math.floor(minutesAgo / 1440);
    const remainingHours = Math.floor((minutesAgo % 1440) / 60);
    if (remainingHours === 0) {
      return `${days}d ago`;
    }
    return `${days}d ${remainingHours}h ago`;
  } else {
    // For older data, show the actual date
    return formatPerthDisplay(inputDate);
  }
}

/**
 * Determine device online status based on data freshness
 */
export function getDeviceStatus(lastReading: Date | string | number): {
  status: 'online' | 'offline' | 'stale' | 'no-data';
  minutesAgo: number;
  displayText: string;
  colorClass: string;
} {
  if (!lastReading) {
    return {
      status: 'no-data',
      minutesAgo: Infinity,
      displayText: 'No Data',
      colorClass: 'text-gray-500 bg-gray-100'
    };
  }
  
  const minutesAgo = getMinutesFromNowInPerth(lastReading);
  
  // Handle future timestamps (data quality issue)
  if (minutesAgo < 0) {
    return {
      status: 'offline',
      minutesAgo,
      displayText: 'Data Error',
      colorClass: 'text-red-600 bg-red-100'
    };
  }
  
  // Determine status based on data freshness
  // Gasbot cellular devices typically send data every 15-30 minutes
  if (minutesAgo <= 45) {
    return {
      status: 'online',
      minutesAgo,
      displayText: 'Online',
      colorClass: 'text-green-600 bg-green-100'
    };
  } else if (minutesAgo <= 240) { // 4 hours
    return {
      status: 'stale',
      minutesAgo,
      displayText: 'Stale Data',
      colorClass: 'text-yellow-600 bg-yellow-100'
    };
  } else {
    return {
      status: 'offline',
      minutesAgo,
      displayText: 'Offline',
      colorClass: 'text-red-600 bg-red-100'
    };
  }
}

/**
 * Validate timestamp and return data quality info
 * Updated thresholds to be more appropriate for manual dip readings
 */
export function validateTimestamp(timestamp: Date | string | number, options?: {
  staleThresholdHours?: number;
  warnOnStale?: boolean;
}): {
  isValid: boolean;
  isFuture: boolean;
  isStale: boolean;
  age: number;
  issues: string[];
} {
  const date = toPerthTime(timestamp);
  const minutesAgo = getMinutesFromNowInPerth(timestamp);
  const issues: string[] = [];
  
  // Configuration with sensible defaults for fuel tank readings
  const staleThresholdHours = options?.staleThresholdHours ?? 24; // 24 hours for manual readings
  const warnOnStale = options?.warnOnStale ?? false; // Don't warn on stale by default
  const staleThresholdMinutes = staleThresholdHours * 60;
  
  const isValid = !isNaN(date.getTime());
  const isFuture = minutesAgo < 0;
  const isStale = minutesAgo > staleThresholdMinutes;
  
  if (!isValid) {
    issues.push('Invalid timestamp format');
  }
  
  if (isFuture) {
    // Future timestamps are always critical issues
    const futureMinutes = Math.abs(minutesAgo);
    if (futureMinutes > 60) {
      issues.push(`Timestamp is ${Math.round(futureMinutes / 60)}h in the future (timezone issue?)`);
    } else {
      issues.push(`Timestamp is ${futureMinutes}min in the future (timezone issue?)`);
    }
  }
  
  if (isStale && isValid && !isFuture && warnOnStale) {
    const ageHours = Math.round(minutesAgo / 60);
    issues.push(`Data is ${ageHours} hours old (threshold: ${staleThresholdHours}h)`);
  }
  
  // Check for obviously wrong years
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  if (year < 2020 || year > currentYear + 1) {
    issues.push(`Suspicious year: ${year}`);
  }
  
  return {
    isValid,
    isFuture,
    isStale,
    age: minutesAgo,
    issues
  };
}

/**
 * Convert various timestamp formats to Perth timezone string
 */
export function normalizeToPerthString(timestamp: any): string {
  if (!timestamp) return '';
  
  try {
    // Handle different input formats
    let date: Date;
    
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      // Try to parse various string formats
      if (timestamp.includes('T')) {
        // ISO format
        date = new Date(timestamp);
      } else if (timestamp.includes('/')) {
        // DD/MM/YYYY or MM/DD/YYYY format
        date = new Date(timestamp);
      } else {
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return 'Invalid Format';
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return formatPerthTimestamp(date);
  } catch (error) {
    console.error('Error normalizing timestamp:', error, timestamp);
    return 'Error Parsing Date';
  }
}

// Export commonly used formatters
export {
  perthFormatter,
  perthDateFormatter,
  perthTimeFormatter
};