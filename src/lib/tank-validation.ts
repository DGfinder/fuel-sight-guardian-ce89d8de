/**
 * Tank Data Validation Utility
 *
 * Centralized validation logic for tank data quality checks.
 * Ensures consistent filtering across dashboard and table components.
 *
 * Validation criteria:
 * - Data freshness: Readings must be ≤14 days old (configurable)
 * - Configuration validity: Tank must have proper min_level/safe_level setup
 * - Alert inclusion: Both fresh data AND valid configuration required
 */

import type { Tank } from '@/types/fuel';

export interface TankValidationResult {
  isValid: boolean;
  reasons: string[];
}

/**
 * Check if tank has fresh data (recent readings)
 *
 * @param tank The tank to check
 * @param maxAgeDays Maximum age in days for data to be considered fresh (default: 14)
 * @returns true if tank has fresh data, false otherwise
 */
export function hasFreshData(tank: Tank, maxAgeDays: number = 14): boolean {
  // Prefer days_since_last_dip if available (from enhanced analytics)
  if (typeof tank.days_since_last_dip === 'number') {
    return tank.days_since_last_dip <= maxAgeDays;
  }

  // Fall back to data_quality field
  if (tank.data_quality) {
    // 'fresh' (≤3 days) and 'stale' (≤7 days) are acceptable
    // 'outdated' (>7 days) and 'no_data' are not
    return tank.data_quality === 'fresh' || tank.data_quality === 'stale';
  }

  // Last resort: check last_dip timestamp manually
  if (tank.last_dip?.created_at) {
    const lastDipDate = new Date(tank.last_dip.created_at);
    const daysSince = (Date.now() - lastDipDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= maxAgeDays;
  }

  // No valid data source found
  return false;
}

/**
 * Check if tank has valid configuration
 *
 * @param tank The tank to check
 * @returns true if tank has valid min_level, safe_level, and current_level
 */
export function hasValidConfiguration(tank: Tank): boolean {
  // Must have numeric values (not null, not undefined)
  const hasMinLevel = typeof tank.min_level === 'number' && tank.min_level > 0;
  const hasSafeLevel = typeof tank.safe_level === 'number' && tank.safe_level > 0;
  const hasCurrentLevel = typeof tank.current_level === 'number';

  // Safe level must be greater than min level for valid range
  const validRange = hasSafeLevel && hasMinLevel && tank.safe_level > tank.min_level;

  return hasCurrentLevel && hasMinLevel && hasSafeLevel && validRange;
}

/**
 * Check if tank should be included in alert calculations
 *
 * Combines data freshness and configuration validity checks.
 * Only tanks passing both checks should trigger low-fuel alerts.
 *
 * @param tank The tank to check
 * @param maxDataAgeDays Maximum age in days for data to be considered fresh (default: 14)
 * @returns true if tank should be included in alerts, false otherwise
 */
export function shouldIncludeInAlerts(tank: Tank, maxDataAgeDays: number = 14): boolean {
  return hasFreshData(tank, maxDataAgeDays) && hasValidConfiguration(tank);
}

/**
 * Comprehensive validation with detailed reasons
 *
 * @param tank The tank to validate
 * @param maxDataAgeDays Maximum age in days for data to be considered fresh (default: 14)
 * @returns Validation result with isValid flag and reasons for failure
 */
export function validateTankData(tank: Tank, maxDataAgeDays: number = 14): TankValidationResult {
  const reasons: string[] = [];

  // Check data freshness
  if (!hasFreshData(tank, maxDataAgeDays)) {
    if (typeof tank.days_since_last_dip === 'number') {
      reasons.push(`Data is ${tank.days_since_last_dip} days old (>${maxDataAgeDays} days)`);
    } else if (tank.data_quality === 'outdated') {
      reasons.push('Data is outdated');
    } else if (tank.data_quality === 'no_data') {
      reasons.push('No data available');
    } else {
      reasons.push('No recent readings');
    }
  }

  // Check configuration
  if (!hasValidConfiguration(tank)) {
    if (typeof tank.min_level !== 'number' || tank.min_level <= 0) {
      reasons.push('Missing or invalid min_level');
    }
    if (typeof tank.safe_level !== 'number' || tank.safe_level <= 0) {
      reasons.push('Missing or invalid safe_level');
    }
    if (typeof tank.current_level !== 'number') {
      reasons.push('Missing current_level');
    }
    if (typeof tank.safe_level === 'number' &&
        typeof tank.min_level === 'number' &&
        tank.safe_level <= tank.min_level) {
      reasons.push('Invalid range (safe_level ≤ min_level)');
    }
  }

  return {
    isValid: reasons.length === 0,
    reasons
  };
}
