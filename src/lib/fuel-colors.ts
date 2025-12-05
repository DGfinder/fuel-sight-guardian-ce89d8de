/**
 * Centralized fuel status color system
 * Uses Tailwind design tokens from tailwind.config.ts
 * Ensures consistent styling across all fuel visualization components
 */

import type { Tank } from '@/types/fuel';
import { validateTankData, calculatePercentAboveMin } from './tank-validation';

export type FuelStatus = 'critical' | 'low' | 'normal' | 'unknown' | 'stale';

/**
 * Determine fuel status based on percentage and days remaining
 */
export function getFuelStatus(
  percent: number | null | undefined,
  daysToMin?: number | null
): FuelStatus {
  // If no percent data is available, return unknown
  if (percent === null || percent === undefined) {
    return 'unknown';
  }

  const pct = percent;

  // Critical: Immediate action required (≤10% OR ≤1.5 days)
  if (pct <= 10 || (daysToMin !== null && daysToMin !== undefined && daysToMin <= 1.5)) {
    return 'critical';
  }

  // Low: Schedule soon (≤20% OR ≤2.5 days)
  if (pct <= 20 || (daysToMin !== null && daysToMin !== undefined && daysToMin <= 2.5)) {
    return 'low';
  }

  // Normal: No immediate concern
  return 'normal';
}

/**
 * Determine fuel status with data validation
 *
 * This function validates tank data freshness and configuration before
 * determining fuel status. Tanks with stale data or invalid configuration
 * are marked as 'unknown' regardless of their fuel percentage.
 *
 * @param tank The tank to evaluate
 * @param maxDataAgeDays Maximum age in days for data to be considered fresh (default: 14)
 * @returns Fuel status: 'critical', 'low', 'normal', or 'unknown'
 */
export function getFuelStatusWithValidation(
  tank: Tank,
  maxDataAgeDays: number = 14
): FuelStatus {
  // Validate data freshness and configuration
  const validation = validateTankData(tank, maxDataAgeDays);

  // If validation fails, return 'stale' status (data exists but is too old or config invalid)
  if (!validation.isValid) {
    return 'stale';
  }

  // CRITICAL FIX: Calculate percent instead of using database field
  // This ensures consistency with row-level status display
  const percent = calculatePercentAboveMin(tank);

  // Use existing logic for valid tanks
  return getFuelStatus(percent, tank.days_to_min_level);
}

/**
 * Status-based styling using fuel design tokens
 * These map to the fuel-critical, fuel-low, fuel-normal palettes in tailwind.config.ts
 */
export const fuelStatusStyles = {
  critical: {
    bg: 'bg-fuel-critical-50',
    bgSubtle: 'bg-fuel-critical/10',
    border: 'border-fuel-critical-200',
    text: 'text-fuel-critical-700',
    textDark: 'dark:text-fuel-critical-400',
    badge: 'bg-fuel-critical-100 text-fuel-critical-700 border-fuel-critical-200',
    bar: 'bg-fuel-critical',
  },
  low: {
    bg: 'bg-fuel-low-50',
    bgSubtle: 'bg-fuel-low/20',
    border: 'border-fuel-low-200',
    text: 'text-fuel-low-700',
    textDark: 'dark:text-fuel-low-400',
    badge: 'bg-fuel-low-100 text-fuel-low-700 border-fuel-low-200',
    bar: 'bg-fuel-low',
  },
  normal: {
    bg: 'bg-fuel-normal-50',
    bgSubtle: 'bg-fuel-normal/10',
    border: 'border-fuel-normal-200',
    text: 'text-fuel-normal-700',
    textDark: 'dark:text-fuel-normal-400',
    badge: 'bg-fuel-normal-100 text-fuel-normal-700 border-fuel-normal-200',
    bar: 'bg-fuel-normal',
  },
  unknown: {
    bg: 'bg-fuel-unknown-50',
    bgSubtle: 'bg-fuel-unknown/10',
    border: 'border-fuel-unknown-200',
    text: 'text-fuel-unknown-700',
    textDark: 'dark:text-fuel-unknown-400',
    badge: 'bg-fuel-unknown-100 text-fuel-unknown-700 border-fuel-unknown-200',
    bar: 'bg-fuel-unknown',
  },
  stale: {
    bg: 'bg-amber-50',
    bgSubtle: 'bg-amber-50/30',
    border: 'border-amber-200',
    text: 'text-amber-700',
    textDark: 'dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
  },
} as const;

/**
 * Get bar/indicator color class based on percentage
 */
export function getBarColor(percent: number): string {
  if (percent < 20) return fuelStatusStyles.critical.bar;
  if (percent < 40) return fuelStatusStyles.low.bar;
  return fuelStatusStyles.normal.bar;
}

/**
 * Get status styles object for a given status
 */
export function getStatusStyles(status: FuelStatus) {
  return fuelStatusStyles[status];
}

/**
 * Get combined card styling for fuel status (bg + border)
 */
export function getCardClasses(status: FuelStatus): string {
  const styles = fuelStatusStyles[status];
  return `${styles.bg} ${styles.border}`;
}

/**
 * Get badge variant class for shadcn Badge component
 */
export function getBadgeVariant(status: FuelStatus): 'destructive' | 'secondary' | 'default' | 'outline' {
  switch (status) {
    case 'critical': return 'destructive';
    case 'low': return 'secondary';
    default: return 'default';
  }
}

/**
 * Status badge styles for table cells - lighter backgrounds with stronger text
 */
export const statusBadgeStyles = {
  critical: 'bg-fuel-critical/10 text-fuel-critical-700',
  low: 'bg-fuel-low/20 text-fuel-low-700',
  normal: 'bg-fuel-normal/10 text-fuel-normal-700',
  unknown: 'bg-fuel-unknown/10 text-fuel-unknown-600',
  stale: 'bg-amber-50/20 text-amber-700',
} as const;

/**
 * Group accordion status colors (border-left indicator)
 */
export const groupStatusColors = {
  critical: 'border-l-fuel-critical bg-fuel-critical-50/50 hover:bg-fuel-critical-50',
  warning: 'border-l-fuel-low bg-fuel-low-50/50 hover:bg-fuel-low-50',
  normal: 'border-l-fuel-normal bg-fuel-normal-50/50 hover:bg-fuel-normal-50',
  stale: 'border-l-amber-500 bg-amber-50/50 hover:bg-amber-50',
} as const;

/**
 * Get days-to-min text color class
 */
export function getDaysTextColor(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'text-fuel-unknown-500';
  if (days <= 2) return 'text-fuel-critical';
  if (days <= 5) return 'text-fuel-low';
  return 'text-fuel-unknown-500';
}
