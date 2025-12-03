/**
 * Timestamp Normalizer
 * Handles Perth timezone (AWST/AWDT UTC+8) to UTC conversion for Gasbot webhooks
 *
 * NOTE: Gasbot sends timestamps in Perth local time WITHOUT timezone information.
 * We must interpret these as Perth time (UTC+8) before converting to UTC.
 *
 * Responsibilities:
 * - Convert Perth local time strings to UTC ISO strings
 * - Handle epoch timestamps (already in UTC)
 * - Validate timestamp ranges and data quality
 * - Convert to bigint for PostgreSQL timestamp storage
 *
 * Perth Timezone:
 * - AWST (Australian Western Standard Time): UTC+8
 * - No daylight saving time
 */

export const PERTH_TIMEZONE = 'Australia/Perth';
export const PERTH_OFFSET_HOURS = 8;

export interface TimestampValidationResult {
  valid: boolean;
  normalizedUTC: string;
  warnings: string[];
}

export class TimestampNormalizer {
  /**
   * Validates and normalizes a timestamp to UTC ISO string
   *
   * Gasbot sends timestamps in Perth local time without timezone info,
   * so we interpret them as Perth time (UTC+8) before converting to UTC.
   *
   * @param timestamp - String, number (epoch), or Date
   * @param fieldName - Field name for error logging
   * @returns UTC ISO string (e.g., "2025-12-03T14:30:00.000Z")
   */
  static validateAndNormalize(timestamp: string | number | Date | null | undefined, fieldName = 'timestamp'): string {
    if (!timestamp) {
      console.warn(`⚠️  Empty ${fieldName}, using current time`);
      return new Date().toISOString();
    }

    try {
      let date: Date;

      // Handle different input formats
      if (typeof timestamp === 'number') {
        // Epoch timestamps are already in UTC (milliseconds since 1970-01-01 UTC)
        // Check if milliseconds (>1000000000000) or seconds
        date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        // Check if timestamp already has timezone info
        const hasTimezone = timestamp.includes('Z') ||
                            timestamp.includes('+') ||
                            (timestamp.includes('-') && timestamp.lastIndexOf('-') > 9);

        if (hasTimezone) {
          // Already has timezone, parse as-is
          date = new Date(timestamp);
        } else {
          // No timezone info - Gasbot sends Perth local time, so treat as UTC+8
          // Append Perth timezone offset so JavaScript interprets correctly
          date = new Date(timestamp + '+08:00');
          console.log(`📍 Interpreted "${timestamp}" as Perth time -> ${date.toISOString()}`);
        }
      } else {
        throw new Error(`Invalid timestamp type: ${typeof timestamp}`);
      }

      // Validate the date is reasonable
      this.validateDateRange(date, timestamp, fieldName);

      // Return normalized ISO string (always UTC)
      return date.toISOString();

    } catch (error) {
      console.error(`🚫 Failed to parse ${fieldName}: ${timestamp}`, (error as Error).message);
      return new Date().toISOString();
    }
  }

  /**
   * Validates timestamp is within reasonable range
   */
  private static validateDateRange(date: Date, originalValue: any, fieldName: string): void {
    const now = new Date();
    const year = date.getFullYear();
    const minutesDiff = (now.getTime() - date.getTime()) / (1000 * 60);

    // Check for obvious data quality issues
    if (isNaN(date.getTime())) {
      console.error(`🚫 Invalid ${fieldName}: ${originalValue}`);
      throw new Error('Invalid date');
    }

    if (year < 2020 || year > now.getFullYear() + 1) {
      console.warn(`⚠️  Suspicious year in ${fieldName}: ${year} from ${originalValue}`);
    }

    if (minutesDiff < -60) { // More than 1 hour in the future
      console.warn(`⚠️  Future ${fieldName}: ${originalValue} (${Math.abs(minutesDiff).toFixed(0)} min ahead)`);
    }

    if (minutesDiff > 7 * 24 * 60) { // More than 1 week old
      console.warn(`⚠️  Very old ${fieldName}: ${originalValue} (${(minutesDiff / (24 * 60)).toFixed(0)} days old)`);
    }
  }

  /**
   * Safely converts epoch timestamp to integer for PostgreSQL bigint fields
   * Handles decimal values by flooring them
   *
   * @param value - Epoch timestamp (seconds or milliseconds)
   * @returns Integer epoch timestamp or null
   */
  static convertEpochToBigInt(value: number | string | null | undefined): number | null {
    if (!value) return null;

    try {
      const parsed = parseFloat(value.toString());
      if (isNaN(parsed)) return null;

      // Return floored value (PostgreSQL bigint requires integer)
      return Math.floor(parsed);
    } catch (error) {
      console.warn(`⚠️  Failed to convert epoch value: ${value}`);
      return null;
    }
  }

  /**
   * Converts UTC ISO string to epoch timestamp (milliseconds)
   */
  static isoToEpoch(isoString: string): number {
    return new Date(isoString).getTime();
  }

  /**
   * Checks if timestamp string has timezone information
   */
  static hasTimezoneInfo(timestamp: string): boolean {
    return timestamp.includes('Z') ||
           timestamp.includes('+') ||
           (timestamp.includes('-') && timestamp.lastIndexOf('-') > 9);
  }

  /**
   * Validates timestamp and returns detailed result
   */
  static validateTimestamp(timestamp: unknown, fieldName = 'timestamp'): TimestampValidationResult {
    const warnings: string[] = [];

    if (!timestamp) {
      return {
        valid: false,
        normalizedUTC: new Date().toISOString(),
        warnings: [`${fieldName} is empty or null`],
      };
    }

    try {
      const normalizedUTC = this.validateAndNormalize(timestamp as any, fieldName);

      // Check if timestamp is in reasonable range
      const date = new Date(normalizedUTC);
      const now = new Date();
      const minutesDiff = (now.getTime() - date.getTime()) / (1000 * 60);

      if (minutesDiff < -60) {
        warnings.push(`${fieldName} is ${Math.abs(minutesDiff).toFixed(0)} minutes in the future`);
      }

      if (minutesDiff > 7 * 24 * 60) {
        warnings.push(`${fieldName} is ${(minutesDiff / (24 * 60)).toFixed(0)} days old`);
      }

      return {
        valid: true,
        normalizedUTC,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        normalizedUTC: new Date().toISOString(),
        warnings: [`Failed to parse ${fieldName}: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Formats UTC timestamp for display in Perth timezone
   * Useful for logging and debugging
   */
  static formatForPerth(utcIsoString: string): string {
    try {
      const date = new Date(utcIsoString);
      // Add 8 hours for Perth (UTC+8)
      const perthDate = new Date(date.getTime() + (PERTH_OFFSET_HOURS * 60 * 60 * 1000));
      return perthDate.toISOString().replace('Z', ' AWST');
    } catch (error) {
      return utcIsoString;
    }
  }

  /**
   * Gets current time in Perth timezone as ISO string
   */
  static getCurrentPerthTime(): string {
    const now = new Date();
    const perthTime = new Date(now.getTime() + (PERTH_OFFSET_HOURS * 60 * 60 * 1000));
    return perthTime.toISOString().replace('Z', '+08:00');
  }

  /**
   * Logs data quality issues for monitoring
   */
  static logDataQuality(locationId: string, issues: string[]): void {
    if (issues.length > 0) {
      console.warn(`⚠️  Data quality issues for ${locationId}:`, issues);
      // Could add to monitoring/alerting system here
    }
  }
}
