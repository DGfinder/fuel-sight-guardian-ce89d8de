/**
 * Urgency Calculator for Tank Refill Predictions
 *
 * Calculates urgency levels based on days remaining until tank is empty.
 * Used by both GSF fleet calendar and customer portal calendar.
 */

export type UrgencyLevel = 'critical' | 'warning' | 'normal' | 'unknown';

export interface RefillPrediction {
  tankId: string;
  tankName: string;
  customerName: string;
  locationId: string;
  address: string;
  currentLevel: number;
  daysRemaining: number | null;
  predictedRefillDate: Date | null;
  urgency: UrgencyLevel;
  confidence: 'high' | 'medium' | 'low';
  dailyConsumption: number | null;
  capacity: number | null;
  deviceOnline: boolean;
}

/**
 * Calculate urgency level based on days remaining
 */
export function calculateUrgency(daysRemaining: number | null): UrgencyLevel {
  if (daysRemaining === null || daysRemaining === undefined) {
    return 'unknown';
  }
  if (daysRemaining < 3) {
    return 'critical';
  }
  if (daysRemaining < 7) {
    return 'warning';
  }
  return 'normal';
}

/**
 * Calculate urgency with fill percentage fallback for manual dip tanks
 * Uses days remaining if available, otherwise falls back to fill percentage thresholds
 */
export function calculateUrgencyWithFallback(
  daysRemaining: number | null | undefined,
  fillPercentage: number | null | undefined
): UrgencyLevel {
  // Prefer days remaining if available
  if (daysRemaining != null && daysRemaining !== undefined) {
    if (daysRemaining < 3) return 'critical';
    if (daysRemaining < 7) return 'warning';
    return 'normal';
  }

  // Fallback to fill percentage for manual dip tanks
  if (fillPercentage != null && fillPercentage !== undefined) {
    if (fillPercentage < 20) return 'critical';
    if (fillPercentage < 35) return 'warning';
    return 'normal';
  }

  return 'unknown';
}

/**
 * Get color for urgency level
 */
export function getUrgencyColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return '#ef4444'; // red-500
    case 'warning':
      return '#f59e0b'; // amber-500
    case 'normal':
      return '#22c55e'; // green-500
    case 'unknown':
    default:
      return '#9ca3af'; // gray-400
  }
}

/**
 * Get background color for urgency level (lighter versions)
 */
export function getUrgencyBackgroundColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return '#fef2f2'; // red-50
    case 'warning':
      return '#fffbeb'; // amber-50
    case 'normal':
      return '#f0fdf4'; // green-50
    case 'unknown':
    default:
      return '#f9fafb'; // gray-50
  }
}

/**
 * Get CSS classes for urgency level
 */
export function getUrgencyClasses(urgency: UrgencyLevel): {
  bg: string;
  text: string;
  border: string;
  ring: string;
} {
  switch (urgency) {
    case 'critical':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-300 dark:border-red-700',
        ring: 'ring-red-400',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        border: 'border-yellow-300 dark:border-yellow-700',
        ring: 'ring-yellow-400',
      };
    case 'normal':
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-300 dark:border-green-700',
        ring: 'ring-green-400',
      };
    case 'unknown':
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-600 dark:text-gray-400',
        border: 'border-gray-300 dark:border-gray-700',
        ring: 'ring-gray-400',
      };
  }
}

/**
 * Calculate predicted refill date from days remaining
 */
export function calculatePredictedRefillDate(daysRemaining: number | null): Date | null {
  if (daysRemaining === null || daysRemaining <= 0) {
    return null;
  }

  const refillDate = new Date();
  refillDate.setDate(refillDate.getDate() + Math.floor(daysRemaining));
  return refillDate;
}

/**
 * Determine confidence level based on data quality
 */
export function determineConfidence(
  daysRemaining: number | null,
  dailyConsumption: number | null,
  deviceOnline: boolean
): 'high' | 'medium' | 'low' {
  // No prediction available
  if (daysRemaining === null || daysRemaining <= 0) {
    return 'low';
  }

  // Device offline - data may be stale
  if (!deviceOnline) {
    return 'low';
  }

  // No consumption data - using default estimate
  if (dailyConsumption === null || dailyConsumption <= 0) {
    return 'low';
  }

  // Reasonable consumption rate and days remaining
  if (daysRemaining > 1 && dailyConsumption > 0) {
    // Very long predictions are less reliable
    if (daysRemaining > 30) {
      return 'medium';
    }
    return 'high';
  }

  return 'medium';
}

/**
 * Format days remaining for display
 */
export function formatDaysRemaining(daysRemaining: number | null): string {
  if (daysRemaining === null || daysRemaining === undefined) {
    return 'Unknown';
  }
  if (daysRemaining < 1) {
    return 'Empty soon';
  }
  if (daysRemaining < 2) {
    return '1 day';
  }
  if (daysRemaining > 365) {
    return '365+ days';
  }
  return `${Math.round(daysRemaining)} days`;
}

/**
 * Get urgency label for display
 */
export function getUrgencyLabel(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return 'Critical';
    case 'warning':
      return 'Warning';
    case 'normal':
      return 'Normal';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

/**
 * Sort tanks by urgency (most urgent first)
 */
export function sortByUrgency<T extends { urgency: UrgencyLevel; daysRemaining?: number | null }>(
  items: T[]
): T[] {
  const urgencyOrder: Record<UrgencyLevel, number> = {
    critical: 0,
    warning: 1,
    normal: 2,
    unknown: 3,
  };

  return [...items].sort((a, b) => {
    // First sort by urgency level
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    // Then by days remaining (lower first)
    const aDays = a.daysRemaining ?? Infinity;
    const bDays = b.daysRemaining ?? Infinity;
    return aDays - bDays;
  });
}

/**
 * Group tanks by predicted refill date
 */
export function groupByRefillDate(predictions: RefillPrediction[]): Map<string, RefillPrediction[]> {
  const grouped = new Map<string, RefillPrediction[]>();

  for (const prediction of predictions) {
    const date = prediction.predictedRefillDate;
    const key = date ? date.toISOString().split('T')[0] : 'unknown';

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(prediction);
  }

  return grouped;
}

/**
 * Get tanks needing refill within a date range
 */
export function getTanksInDateRange(
  predictions: RefillPrediction[],
  startDate: Date,
  endDate: Date
): RefillPrediction[] {
  return predictions.filter((p) => {
    if (!p.predictedRefillDate) return false;
    return p.predictedRefillDate >= startDate && p.predictedRefillDate <= endDate;
  });
}

/**
 * Calculate refill urgency summary
 */
export function calculateUrgencySummary(predictions: RefillPrediction[]): {
  critical: number;
  warning: number;
  normal: number;
  unknown: number;
  total: number;
} {
  return predictions.reduce(
    (acc, p) => {
      acc[p.urgency]++;
      acc.total++;
      return acc;
    },
    { critical: 0, warning: 0, normal: 0, unknown: 0, total: 0 }
  );
}
