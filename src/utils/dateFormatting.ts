// Australian date formatting utility
// Great Southern Fuels operates in Australian time zones (AWST, AEST, ACST)

const AUSTRALIAN_LOCALE = 'en-AU';
const DEFAULT_TIMEZONE = 'Australia/Perth'; // AWST - Great Southern Fuels primary timezone

export interface DateFormatOptions {
  locale?: string;
  timezone?: string;
  includeTime?: boolean;
  includeSeconds?: boolean;
  shortFormat?: boolean;
}

/**
 * Format date for Australian locale (DD/MM/YYYY)
 * @param date - Date string, Date object, or timestamp
 * @param options - Formatting options
 * @returns Formatted date string in Australian format
 */
export function formatAustralianDate(
  date: string | Date | null | undefined,
  options: DateFormatOptions = {}
): string {
  if (!date) return 'No date';

  const {
    locale = AUSTRALIAN_LOCALE,
    timezone = DEFAULT_TIMEZONE,
    includeTime = false,
    includeSeconds = false,
    shortFormat = false,
  } = options;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    // Short relative format (e.g., "5m ago", "2h ago")
    if (shortFormat) {
      return formatRelativeTime(dateObj);
    }

    // Format for Australian locale with timezone
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };

    if (includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = true; // 12-hour format with AM/PM

      if (includeSeconds) {
        formatOptions.second = '2-digit';
      }
    }

    return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
  } catch (error) {
    console.error('[DATE FORMAT] Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Format date and time for Australian locale
 * @param date - Date string, Date object, or timestamp
 * @param timezone - Australian timezone (default: Australia/Perth)
 * @returns Formatted date/time string (DD/MM/YYYY, HH:MM AM/PM)
 */
export function formatAustralianDateTime(
  date: string | Date | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatAustralianDate(date, { includeTime: true, timezone });
}

/**
 * Format relative time (e.g., "5 minutes ago", "2 hours ago")
 * @param date - Date to compare against now
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      // Fall back to Australian date format
      return formatAustralianDate(dateObj);
    }
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format timestamp for Australian locale with full details
 * Useful for audit logs, detailed records
 */
export function formatAustralianTimestamp(
  date: string | Date | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatAustralianDate(date, {
    includeTime: true,
    includeSeconds: true,
    timezone
  });
}

/**
 * Get current time in Australian timezone
 * @param timezone - Australian timezone (default: Australia/Perth)
 * @returns Current time formatted for Australian locale
 */
export function getCurrentAustralianTime(timezone: string = DEFAULT_TIMEZONE): string {
  return formatAustralianDateTime(new Date(), timezone);
}

/**
 * Australian timezone options for Great Southern Fuels operations
 */
export const AUSTRALIAN_TIMEZONES = {
  PERTH: 'Australia/Perth',      // AWST (UTC+8)
  SYDNEY: 'Australia/Sydney',    // AEST (UTC+10) / AEDT (UTC+11)
  MELBOURNE: 'Australia/Melbourne', // AEST (UTC+10) / AEDT (UTC+11)
  BRISBANE: 'Australia/Brisbane', // AEST (UTC+10)
  ADELAIDE: 'Australia/Adelaide', // ACST (UTC+9.5) / ACDT (UTC+10.5)
  DARWIN: 'Australia/Darwin',    // ACST (UTC+9.5)
} as const;

/**
 * Detect and format time with appropriate Australian timezone
 * Attempts to detect timezone from browser if available
 */
export function formatWithDetectedTimezone(date: string | Date | null | undefined): string {
  try {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Check if browser timezone is Australian
    const isAustralianTZ = Object.values(AUSTRALIAN_TIMEZONES).includes(
      browserTimezone as any
    );

    const timezone = isAustralianTZ ? browserTimezone : DEFAULT_TIMEZONE;
    return formatAustralianDateTime(date, timezone);
  } catch {
    return formatAustralianDateTime(date);
  }
}
