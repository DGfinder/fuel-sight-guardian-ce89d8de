/**
 * Operation Detector Service
 *
 * Detects when farming operations (harvest, seeding, spraying) start
 * based on consumption pattern changes.
 *
 * Uses the baseline calculator to identify spikes that indicate
 * operations have begun.
 */

import { differenceInDays, subDays } from 'date-fns';
import {
  calculateDailyConsumptions,
  isConsumptionSpike,
  calculateMultiplier,
  type TankReading,
  type BaselineResult,
  type DailyConsumption,
} from './baseline-calculator';

// Types
export type OperationType = 'harvest' | 'seeding' | 'spraying' | 'livestock' | 'unknown';

export interface OperationDetectionResult {
  operationDetected: boolean;
  operationType: OperationType;
  detectedStartDate: Date | null;
  confidenceLevel: number; // 0-100
  consumptionMultiplier: number;
  consecutiveSpikeDays: number;
  reason: string;
}

export interface DetectionConfig {
  spikeThresholdMultiplier: number; // Default 2.0
  minConsecutiveDays: number; // Default 2
  lookbackDays: number; // Default 7
}

// Constants
const DEFAULT_CONFIG: DetectionConfig = {
  spikeThresholdMultiplier: 2.0,
  minConsecutiveDays: 2,
  lookbackDays: 7,
};

// WA seasonal patterns for operation inference
const HARVEST_MONTHS = [10, 11, 12]; // Oct-Dec
const SEEDING_MONTHS = [4, 5, 6]; // Apr-Jun
const LIVESTOCK_MONTHS = [8, 9]; // Aug-Sep (shearing season)

/**
 * Detect if an operation has started based on recent consumption patterns
 */
export function detectOperationStart(
  readings: TankReading[],
  baseline: BaselineResult,
  capacityLiters: number | null,
  config: Partial<DetectionConfig> = {}
): OperationDetectionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Need at least a few days of data
  if (readings.length < 2) {
    return noDetection('Insufficient readings for detection');
  }

  // Calculate daily consumptions for the lookback period
  const dailyConsumptions = calculateDailyConsumptions(readings, capacityLiters, []);

  // Get recent days (up to lookbackDays)
  const recentDays = dailyConsumptions
    .slice(-cfg.lookbackDays)
    .filter((d) => !d.isRefillDay);

  if (recentDays.length < cfg.minConsecutiveDays) {
    return noDetection('Not enough recent non-refill days');
  }

  // Find consecutive spike days
  const spikeInfo = findConsecutiveSpikes(
    recentDays,
    baseline,
    cfg.spikeThresholdMultiplier,
    cfg.minConsecutiveDays
  );

  if (!spikeInfo.found) {
    return noDetection('No sustained consumption spike detected');
  }

  // Infer operation type from month and multiplier
  const currentMonth = new Date().getMonth() + 1;
  const operationType = inferOperationType(
    spikeInfo.avgMultiplier,
    currentMonth
  );

  // Calculate confidence based on:
  // - Number of consecutive days (more = higher confidence)
  // - Multiplier magnitude (higher = more confident)
  const confidence = calculateConfidence(
    spikeInfo.consecutiveDays,
    spikeInfo.avgMultiplier,
    operationType
  );

  return {
    operationDetected: true,
    operationType,
    detectedStartDate: spikeInfo.startDate,
    confidenceLevel: confidence,
    consumptionMultiplier: spikeInfo.avgMultiplier,
    consecutiveSpikeDays: spikeInfo.consecutiveDays,
    reason: formatDetectionReason(operationType, spikeInfo.avgMultiplier, spikeInfo.consecutiveDays),
  };
}

/**
 * Find consecutive days with consumption spikes
 */
function findConsecutiveSpikes(
  dailyConsumptions: DailyConsumption[],
  baseline: BaselineResult,
  thresholdMultiplier: number,
  minDays: number
): {
  found: boolean;
  startDate: Date | null;
  consecutiveDays: number;
  avgMultiplier: number;
} {
  // Work backwards from most recent day
  const reversedDays = [...dailyConsumptions].reverse();

  let consecutiveCount = 0;
  let spikeDays: DailyConsumption[] = [];

  for (const day of reversedDays) {
    const multiplier = calculateMultiplier(day.consumptionPct, baseline);

    if (multiplier >= thresholdMultiplier) {
      consecutiveCount++;
      spikeDays.push(day);
    } else {
      // Break in spike pattern
      break;
    }
  }

  if (consecutiveCount >= minDays) {
    // Reverse to get chronological order
    spikeDays = spikeDays.reverse();

    const avgMultiplier =
      spikeDays.reduce(
        (sum, day) => sum + calculateMultiplier(day.consumptionPct, baseline),
        0
      ) / spikeDays.length;

    return {
      found: true,
      startDate: spikeDays[0].date,
      consecutiveDays: consecutiveCount,
      avgMultiplier: Math.round(avgMultiplier * 100) / 100,
    };
  }

  return {
    found: false,
    startDate: null,
    consecutiveDays: 0,
    avgMultiplier: 1,
  };
}

/**
 * Infer operation type from consumption multiplier and current month
 */
export function inferOperationType(
  consumptionMultiplier: number,
  month: number
): OperationType {
  // Harvest: Oct-Dec with high multiplier (>2x typically means headers running)
  if (HARVEST_MONTHS.includes(month) && consumptionMultiplier >= 2.0) {
    return 'harvest';
  }

  // Seeding: Apr-Jun with moderate-high multiplier
  if (SEEDING_MONTHS.includes(month) && consumptionMultiplier >= 1.5) {
    return 'seeding';
  }

  // Livestock operations: Aug-Sep (shearing) or any time with moderate spike
  if (LIVESTOCK_MONTHS.includes(month) && consumptionMultiplier >= 1.3) {
    return 'livestock';
  }

  // Spraying: Low-moderate multiplier, can happen any month
  if (consumptionMultiplier >= 1.2 && consumptionMultiplier < 2.0) {
    return 'spraying';
  }

  // Very high multiplier outside typical seasons
  if (consumptionMultiplier >= 2.0) {
    // Could be harvest preparation, contract work, etc.
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Calculate confidence level (0-100) for detection
 */
function calculateConfidence(
  consecutiveDays: number,
  multiplier: number,
  operationType: OperationType
): number {
  let confidence = 50; // Base confidence

  // More consecutive days = higher confidence
  confidence += Math.min(consecutiveDays * 8, 24); // +8 per day, max +24

  // Higher multiplier = higher confidence
  if (multiplier >= 2.5) confidence += 15;
  else if (multiplier >= 2.0) confidence += 10;
  else if (multiplier >= 1.5) confidence += 5;

  // Known operation type = higher confidence
  if (operationType !== 'unknown') confidence += 10;

  // Cap at 95 (never 100% certain from consumption alone)
  return Math.min(confidence, 95);
}

/**
 * Format a human-readable reason for the detection
 */
function formatDetectionReason(
  operationType: OperationType,
  multiplier: number,
  consecutiveDays: number
): string {
  const operationName = operationType === 'unknown' ? 'Activity' : capitalize(operationType);

  return `${operationName} detected: consumption at ${multiplier}x normal for ${consecutiveDays} consecutive days`;
}

/**
 * Helper: Create a "no detection" result
 */
function noDetection(reason: string): OperationDetectionResult {
  return {
    operationDetected: false,
    operationType: 'unknown',
    detectedStartDate: null,
    confidenceLevel: 0,
    consumptionMultiplier: 1,
    consecutiveSpikeDays: 0,
    reason,
  };
}

/**
 * Helper: Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Detect if an operation has ended (consumption returned to baseline)
 */
export function detectOperationEnd(
  readings: TankReading[],
  baseline: BaselineResult,
  capacityLiters: number | null,
  operationStartDate: Date,
  config: Partial<DetectionConfig> = {}
): {
  ended: boolean;
  endDate: Date | null;
  totalConsumptionLiters: number | null;
  durationDays: number;
} {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const dailyConsumptions = calculateDailyConsumptions(readings, capacityLiters, []);

  // Filter to days after operation start
  const operationDays = dailyConsumptions.filter(
    (d) => d.date >= operationStartDate && !d.isRefillDay
  );

  if (operationDays.length < 2) {
    return { ended: false, endDate: null, totalConsumptionLiters: null, durationDays: 0 };
  }

  // Check recent days for return to baseline
  const recentDays = operationDays.slice(-3);
  const allBelowSpike = recentDays.every(
    (d) => !isConsumptionSpike(d.consumptionPct, baseline, cfg.spikeThresholdMultiplier)
  );

  if (allBelowSpike && operationDays.length >= 3) {
    // Find the last spike day
    let endIndex = operationDays.length - 1;
    for (let i = operationDays.length - 1; i >= 0; i--) {
      if (isConsumptionSpike(operationDays[i].consumptionPct, baseline, cfg.spikeThresholdMultiplier)) {
        endIndex = i;
        break;
      }
    }

    const operationPeriod = operationDays.slice(0, endIndex + 1);
    const totalConsumption = capacityLiters
      ? operationPeriod.reduce((sum, d) => sum + (d.consumptionLiters || 0), 0)
      : null;

    return {
      ended: true,
      endDate: operationPeriod[operationPeriod.length - 1]?.date || null,
      totalConsumptionLiters: totalConsumption
        ? Math.round(totalConsumption * 100) / 100
        : null,
      durationDays: operationPeriod.length,
    };
  }

  return { ended: false, endDate: null, totalConsumptionLiters: null, durationDays: operationDays.length };
}

// Export singleton
export const operationDetector = {
  detectOperationStart,
  detectOperationEnd,
  inferOperationType,
};

export default operationDetector;
