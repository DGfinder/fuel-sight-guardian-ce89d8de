/**
 * Baseline Calculator Service
 *
 * Calculates consumption baselines from historical tank readings,
 * excluding refills and known operation periods.
 *
 * Used for:
 * - Detecting consumption spikes that indicate operations starting
 * - Learning actual consumption rates vs predictions
 */

import { addDays, differenceInDays, isWithinInterval } from 'date-fns';

// Types
export interface TankReading {
  reading_at: string;
  level_percent: number;
  level_liters?: number | null;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface BaselineResult {
  baselinePctPerDay: number;
  baselineLitersPerDay: number | null;
  stdDeviationPct: number;
  spikeThresholdPct: number;
  dataPointsUsed: number;
}

export interface DailyConsumption {
  date: Date;
  consumptionPct: number;
  consumptionLiters: number | null;
  isRefillDay: boolean;
  isOperationDay: boolean;
}

// Constants
const REFILL_THRESHOLD_PCT = 10; // >10% increase = refill
const NOISE_THRESHOLD_PCT = 0.5; // Ignore changes < 0.5%
const MIN_DATA_POINTS = 7; // Need at least 7 days of data
const OUTLIER_STD_MULTIPLIER = 3; // Remove outliers > 3 std dev

/**
 * Calculate consumption baseline from historical readings
 */
export function calculateBaseline(
  readings: TankReading[],
  capacityLiters: number | null,
  excludePeriods: DateRange[] = [],
  calculationPeriodDays: number = 90
): BaselineResult | null {
  if (readings.length < 2) {
    return null;
  }

  // Sort readings by date (oldest first)
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime()
  );

  // Calculate daily consumption
  const dailyConsumptions = calculateDailyConsumptions(
    sortedReadings,
    capacityLiters,
    excludePeriods
  );

  // Filter to normal days only (no refills, no operations)
  const normalDays = dailyConsumptions.filter(
    (d) => !d.isRefillDay && !d.isOperationDay && d.consumptionPct > NOISE_THRESHOLD_PCT
  );

  if (normalDays.length < MIN_DATA_POINTS) {
    // Not enough data, return default baseline
    return {
      baselinePctPerDay: 2.0, // Default 2% per day
      baselineLitersPerDay: capacityLiters ? (capacityLiters * 0.02) : null,
      stdDeviationPct: 1.0,
      spikeThresholdPct: 4.0, // 2x default baseline
      dataPointsUsed: normalDays.length,
    };
  }

  // Calculate mean
  const consumptions = normalDays.map((d) => d.consumptionPct);
  const mean = consumptions.reduce((a, b) => a + b, 0) / consumptions.length;

  // Calculate standard deviation
  const squaredDiffs = consumptions.map((c) => Math.pow(c - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / consumptions.length;
  const stdDev = Math.sqrt(variance);

  // Remove outliers (> 3 std dev from mean)
  const filteredConsumptions = consumptions.filter(
    (c) => Math.abs(c - mean) <= OUTLIER_STD_MULTIPLIER * stdDev
  );

  // Recalculate mean without outliers
  const cleanMean = filteredConsumptions.reduce((a, b) => a + b, 0) / filteredConsumptions.length;
  const cleanSquaredDiffs = filteredConsumptions.map((c) => Math.pow(c - cleanMean, 2));
  const cleanVariance = cleanSquaredDiffs.reduce((a, b) => a + b, 0) / filteredConsumptions.length;
  const cleanStdDev = Math.sqrt(cleanVariance);

  // Spike threshold = 2x baseline + 1 std dev
  const spikeThreshold = cleanMean * 2 + cleanStdDev;

  return {
    baselinePctPerDay: Math.round(cleanMean * 100) / 100,
    baselineLitersPerDay: capacityLiters
      ? Math.round((capacityLiters * cleanMean / 100) * 100) / 100
      : null,
    stdDeviationPct: Math.round(cleanStdDev * 100) / 100,
    spikeThresholdPct: Math.round(spikeThreshold * 100) / 100,
    dataPointsUsed: filteredConsumptions.length,
  };
}

/**
 * Calculate daily consumptions from hourly/periodic readings
 * Uses "hourly decrease summation" approach
 */
export function calculateDailyConsumptions(
  readings: TankReading[],
  capacityLiters: number | null,
  excludePeriods: DateRange[] = []
): DailyConsumption[] {
  const dailyMap = new Map<string, TankReading[]>();

  // Group readings by date
  for (const reading of readings) {
    const date = new Date(reading.reading_at);
    const dateKey = date.toISOString().split('T')[0];

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, []);
    }
    dailyMap.get(dateKey)!.push(reading);
  }

  const results: DailyConsumption[] = [];
  const sortedDates = Array.from(dailyMap.keys()).sort();

  for (let i = 0; i < sortedDates.length; i++) {
    const dateKey = sortedDates[i];
    const dayReadings = dailyMap.get(dateKey)!;
    const date = new Date(dateKey);

    // Sort readings by time
    dayReadings.sort(
      (a, b) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime()
    );

    // Calculate consumption using decrease summation
    let consumptionPct = 0;
    let consumptionLiters: number | null = capacityLiters ? 0 : null;
    let isRefillDay = false;

    for (let j = 1; j < dayReadings.length; j++) {
      const prev = dayReadings[j - 1];
      const curr = dayReadings[j];
      const diff = prev.level_percent - curr.level_percent;

      if (diff > NOISE_THRESHOLD_PCT) {
        // This is consumption (level decreased)
        consumptionPct += diff;
        if (capacityLiters && consumptionLiters !== null) {
          consumptionLiters += (capacityLiters * diff / 100);
        }
      } else if (diff < -REFILL_THRESHOLD_PCT) {
        // This is a refill (level increased significantly)
        isRefillDay = true;
      }
    }

    // Handle overnight consumption (from previous day's last reading)
    if (i > 0) {
      const prevDateKey = sortedDates[i - 1];
      const prevDayReadings = dailyMap.get(prevDateKey)!;
      const prevLastReading = prevDayReadings[prevDayReadings.length - 1];
      const currFirstReading = dayReadings[0];
      const overnightDiff = prevLastReading.level_percent - currFirstReading.level_percent;

      if (overnightDiff > NOISE_THRESHOLD_PCT && overnightDiff < REFILL_THRESHOLD_PCT) {
        consumptionPct += overnightDiff;
        if (capacityLiters && consumptionLiters !== null) {
          consumptionLiters += (capacityLiters * overnightDiff / 100);
        }
      }
    }

    // Check if this date is within an excluded operation period
    const isOperationDay = excludePeriods.some((period) =>
      isWithinInterval(date, { start: period.start, end: period.end })
    );

    results.push({
      date,
      consumptionPct: Math.round(consumptionPct * 100) / 100,
      consumptionLiters: consumptionLiters !== null
        ? Math.round(consumptionLiters * 100) / 100
        : null,
      isRefillDay,
      isOperationDay,
    });
  }

  return results;
}

/**
 * Check if a day's consumption represents a spike above baseline
 */
export function isConsumptionSpike(
  dailyConsumptionPct: number,
  baseline: BaselineResult,
  customThresholdMultiplier?: number
): boolean {
  const threshold = customThresholdMultiplier
    ? baseline.baselinePctPerDay * customThresholdMultiplier
    : baseline.spikeThresholdPct;

  return dailyConsumptionPct > threshold;
}

/**
 * Calculate the consumption multiplier vs baseline
 */
export function calculateMultiplier(
  dailyConsumptionPct: number,
  baseline: BaselineResult
): number {
  if (baseline.baselinePctPerDay === 0) return 1;
  return Math.round((dailyConsumptionPct / baseline.baselinePctPerDay) * 100) / 100;
}

/**
 * Calculate learned operation multipliers from historical events
 */
export function calculateLearnedMultipliers(
  operationEvents: Array<{
    operation_type: string;
    actual_daily_consumption_liters: number | null;
  }>,
  baselineLitersPerDay: number | null
): {
  harvest: number;
  seeding: number;
  spraying: number;
  livestock: number;
} {
  const defaults = {
    harvest: 2.5,
    seeding: 1.8,
    spraying: 1.3,
    livestock: 1.5,
  };

  if (!baselineLitersPerDay || baselineLitersPerDay === 0) {
    return defaults;
  }

  const byType = new Map<string, number[]>();

  for (const event of operationEvents) {
    if (event.actual_daily_consumption_liters) {
      const type = event.operation_type;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(event.actual_daily_consumption_liters);
    }
  }

  const result = { ...defaults };

  for (const [type, consumptions] of byType) {
    if (consumptions.length > 0) {
      const avg = consumptions.reduce((a, b) => a + b, 0) / consumptions.length;
      const multiplier = avg / baselineLitersPerDay;

      if (type === 'harvest') result.harvest = Math.round(multiplier * 100) / 100;
      if (type === 'seeding') result.seeding = Math.round(multiplier * 100) / 100;
      if (type === 'spraying') result.spraying = Math.round(multiplier * 100) / 100;
      if (type === 'livestock') result.livestock = Math.round(multiplier * 100) / 100;
    }
  }

  return result;
}

// Export singleton for use in hooks
export const baselineCalculator = {
  calculateBaseline,
  calculateDailyConsumptions,
  isConsumptionSpike,
  calculateMultiplier,
  calculateLearnedMultipliers,
};

export default baselineCalculator;
