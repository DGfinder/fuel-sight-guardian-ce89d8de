// Consumption Calculator for AgBot Tank Monitoring
// Uses "Hourly Decrease Summation" approach for accurate daily consumption
// Consistent with customer portal and SmartFill calculations

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Use service role key to access great_southern_fuels schema
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// Consumption calculation thresholds (consistent across all systems)
const NOISE_THRESHOLD_PCT = 0.5;    // Ignore changes < 0.5% (sensor noise)
const NOISE_THRESHOLD_LITERS = 5;   // Ignore changes < 5L (sensor noise)
const REFILL_THRESHOLD_PCT = 10;    // Increases > 10% = refill
const REFILL_THRESHOLD_LITERS = 250; // Increases > 250L = refill (bulk fuel)

interface Reading {
  level_percent: number;
  reading_at: string;
  level_liters: number | null;
}

/**
 * Check if level_percent data is reliable (not mostly zeros)
 */
function isPercentDataReliable(readings: Reading[]): boolean {
  if (readings.length === 0) return false;
  const nonZeroCount = readings.filter(r => r.level_percent > 0).length;
  // Consider reliable if at least 50% of readings have non-zero percentages
  return (nonZeroCount / readings.length) >= 0.5;
}

/**
 * Check if level_liters data is reliable (has enough non-null values)
 */
function isLitersDataReliable(readings: Reading[]): boolean {
  if (readings.length === 0) return false;
  const validCount = readings.filter(r => r.level_liters !== null && r.level_liters > 0).length;
  return (validCount / readings.length) >= 0.5;
}

interface ConsumptionResult {
  daily_consumption_litres: number | null;
  daily_consumption_percentage: number | null;
  days_remaining: number | null;
  trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  data_points: number;
}

/**
 * Calculate daily consumption rate from historical readings
 * Uses "Hourly Decrease Summation" for accurate consumption tracking:
 * - Groups readings by date
 * - Sums all decreases > noise threshold
 * - Ignores increases (refills)
 * - Calculates average daily consumption
 */
export async function calculateConsumption(
  assetId: string,
  currentLevel: number,
  tankCapacity: number | null,
  daysToAnalyze: number = 7
): Promise<ConsumptionResult> {
  try {
    // Fetch historical readings for the specified period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);

    const { data: readings, error } = await supabase
      .from('ta_agbot_readings')
      .select('level_percent, reading_at, level_liters')
      .eq('asset_id', assetId)
      .gte('reading_at', startDate.toISOString())
      .order('reading_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch readings for consumption calc:', error);
      return getEmptyResult();
    }

    if (!readings || readings.length < 3) {
      return {
        ...getEmptyResult(),
        data_points: readings?.length || 0,
        confidence: 'low'
      };
    }

    const typedReadings = readings as Reading[];

    // Determine which data source to use
    const usePercentData = isPercentDataReliable(typedReadings);
    const useLitersData = isLitersDataReliable(typedReadings);

    // Calculate consumption using hourly decrease summation
    const consumptionResult = calculateHourlySummation(
      typedReadings,
      usePercentData,
      useLitersData,
      tankCapacity
    );

    if (consumptionResult.daysWithData === 0) {
      return {
        ...getEmptyResult(),
        data_points: typedReadings.length,
        confidence: 'low'
      };
    }

    const dailyConsumptionPercentage = consumptionResult.avgDailyConsumptionPct;
    const dailyConsumptionLitres = consumptionResult.avgDailyConsumptionLiters;

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (dailyConsumptionPercentage > 0.1) {
      daysRemaining = currentLevel / dailyConsumptionPercentage;
    } else if (dailyConsumptionLitres && dailyConsumptionLitres > 0 && tankCapacity) {
      const currentLiters = (currentLevel / 100) * tankCapacity;
      daysRemaining = currentLiters / dailyConsumptionLitres;
    }

    // Cap days remaining at reasonable maximum
    if (daysRemaining !== null && daysRemaining > 365) {
      daysRemaining = 365;
    }
    if (daysRemaining !== null && daysRemaining < 0) {
      daysRemaining = 0;
    }

    // Determine trend and confidence
    const trend = determineTrend(-dailyConsumptionPercentage, typedReadings);
    const confidence = determineConfidence(
      consumptionResult.daysWithData,
      consumptionResult.dataQuality,
      daysToAnalyze
    );

    return {
      daily_consumption_litres: dailyConsumptionLitres ? Math.round(dailyConsumptionLitres) : null,
      daily_consumption_percentage: Math.round(dailyConsumptionPercentage * 100) / 100,
      days_remaining: daysRemaining !== null ? Math.round(daysRemaining) : null,
      trend,
      confidence,
      data_points: typedReadings.length
    };
  } catch (error) {
    console.error('Error calculating consumption:', error);
    return getEmptyResult();
  }
}

/**
 * Calculate consumption using hourly decrease summation
 * Groups readings by date and sums all decreases > noise threshold
 */
function calculateHourlySummation(
  readings: Reading[],
  usePercent: boolean,
  useLiters: boolean,
  tankCapacity: number | null
): {
  avgDailyConsumptionPct: number;
  avgDailyConsumptionLiters: number | null;
  daysWithData: number;
  dataQuality: number;
} {
  // Group readings by date
  const readingsByDate: Record<string, Reading[]> = {};
  readings.forEach(reading => {
    const dateKey = new Date(reading.reading_at).toISOString().split('T')[0];
    if (!readingsByDate[dateKey]) {
      readingsByDate[dateKey] = [];
    }
    readingsByDate[dateKey].push(reading);
  });

  const sortedDates = Object.keys(readingsByDate).sort();
  let totalConsumptionPct = 0;
  let totalConsumptionLiters = 0;
  let daysWithData = 0;

  sortedDates.forEach((dateKey, dateIndex) => {
    const dayReadings = readingsByDate[dateKey];
    let dailyConsumptionPct = 0;
    let dailyConsumptionLiters = 0;

    // Sum all decreases within the day
    for (let i = 1; i < dayReadings.length; i++) {
      const older = dayReadings[i - 1];
      const newer = dayReadings[i];

      // Check percentage consumption
      if (usePercent) {
        const changePct = older.level_percent - newer.level_percent;
        if (changePct > NOISE_THRESHOLD_PCT) {
          dailyConsumptionPct += changePct;
        }
      }

      // Check liters consumption
      if (useLiters && older.level_liters !== null && newer.level_liters !== null) {
        const changeLiters = older.level_liters - newer.level_liters;
        if (changeLiters > NOISE_THRESHOLD_LITERS) {
          dailyConsumptionLiters += changeLiters;
        }
      }
    }

    // Handle overnight consumption (previous day's last → today's first)
    if (dateIndex > 0 && dayReadings.length > 0) {
      const prevDateKey = sortedDates[dateIndex - 1];
      const prevDayReadings = readingsByDate[prevDateKey];
      if (prevDayReadings.length > 0) {
        const prevDayLast = prevDayReadings[prevDayReadings.length - 1];
        const todayFirst = dayReadings[0];

        if (usePercent) {
          const overnightChangePct = prevDayLast.level_percent - todayFirst.level_percent;
          if (overnightChangePct > NOISE_THRESHOLD_PCT) {
            dailyConsumptionPct += overnightChangePct;
          }
        }

        if (useLiters && prevDayLast.level_liters !== null && todayFirst.level_liters !== null) {
          const overnightChangeLiters = prevDayLast.level_liters - todayFirst.level_liters;
          if (overnightChangeLiters > NOISE_THRESHOLD_LITERS) {
            dailyConsumptionLiters += overnightChangeLiters;
          }
        }
      }
    }

    if (dailyConsumptionPct > 0 || dailyConsumptionLiters > 0) {
      totalConsumptionPct += dailyConsumptionPct;
      totalConsumptionLiters += dailyConsumptionLiters;
      daysWithData++;
    }
  });

  // Calculate averages
  const avgDailyConsumptionPct = daysWithData > 0 ? totalConsumptionPct / daysWithData : 0;
  let avgDailyConsumptionLiters: number | null = null;

  if (useLiters && daysWithData > 0) {
    avgDailyConsumptionLiters = totalConsumptionLiters / daysWithData;
  } else if (tankCapacity && tankCapacity > 0 && avgDailyConsumptionPct > 0) {
    // Calculate liters from percentage
    avgDailyConsumptionLiters = (avgDailyConsumptionPct / 100) * tankCapacity;
  }

  // Data quality: ratio of days with data to total days
  const dataQuality = sortedDates.length > 0 ? daysWithData / sortedDates.length : 0;

  return {
    avgDailyConsumptionPct,
    avgDailyConsumptionLiters,
    daysWithData,
    dataQuality
  };
}

/**
 * Filter out refill events (sudden increases in fuel level)
 */
function filterRefillEvents(readings: Reading[]): Reading[] {
  if (readings.length < 2) return readings;

  const filtered: Reading[] = [readings[0]];

  for (let i = 1; i < readings.length; i++) {
    const prev = filtered[filtered.length - 1]; // Compare to last filtered reading, not previous in original array
    const current = readings[i];
    const change = current.level_percent - prev.level_percent;

    // Skip if this looks like a refill (increase > 10%)
    if (change > 10) {
      continue;
    }

    filtered.push(current);
  }

  return filtered;
}

/**
 * Calculate linear regression to find consumption trend
 * Returns slope (per day) and R² (quality of fit)
 * @param readings - Array of readings
 * @param mode - 'percent' for level_percent, 'liters' for level_liters
 */
function calculateLinearRegression(
  readings: Reading[],
  mode: 'percent' | 'liters' = 'percent'
): { slope: number; r2: number } {
  // Convert timestamps to days since first reading
  const firstTime = new Date(readings[0].reading_at).getTime();
  const points: { x: number; y: number }[] = readings
    .filter((r) => mode === 'percent' ? true : r.level_liters !== null)
    .map((r) => ({
      x: (new Date(r.reading_at).getTime() - firstTime) / (1000 * 60 * 60 * 24),
      y: mode === 'percent' ? r.level_percent : (r.level_liters || 0)
    }));

  if (points.length < 2) {
    return { slope: 0, r2: 0 };
  }

  // Calculate means using filtered points length
  const pointsCount = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / pointsCount;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / pointsCount;

  // Calculate slope and R²
  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  }

  const slope = numerator / denominatorX;
  const r2 = (numerator * numerator) / (denominatorX * denominatorY);

  return { slope, r2 };
}

/**
 * Determine consumption trend
 */
function determineTrend(
  slope: number,
  readings: Reading[]
): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
  if (readings.length < 3) return 'unknown';

  // Compare first half to second half of readings
  const mid = Math.floor(readings.length / 2);
  const firstHalfAvg =
    readings.slice(0, mid).reduce((sum, r) => sum + r.level_percent, 0) / mid;
  const secondHalfAvg =
    readings.slice(mid).reduce((sum, r) => sum + r.level_percent, 0) /
    (readings.length - mid);

  const change = secondHalfAvg - firstHalfAvg;

  if (Math.abs(slope) < 0.5) return 'stable';
  if (change < -5) return 'increasing'; // Consumption increasing (level decreasing faster)
  if (change > 5) return 'decreasing'; // Consumption decreasing (level decreasing slower)

  return slope < 0 ? 'stable' : 'unknown';
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(
  dataPoints: number,
  r2: number,
  daysAnalyzed: number
): 'high' | 'medium' | 'low' {
  // High confidence: Many data points, good fit, full analysis period
  if (dataPoints >= 7 && r2 > 0.7 && daysAnalyzed >= 7) return 'high';

  // Medium confidence: Decent data but not ideal
  if (dataPoints >= 5 && r2 > 0.5) return 'medium';

  // Low confidence: Limited data or poor fit
  return 'low';
}

/**
 * Return empty result structure
 */
function getEmptyResult(): ConsumptionResult {
  return {
    daily_consumption_litres: null,
    daily_consumption_percentage: null,
    days_remaining: null,
    trend: 'unknown',
    confidence: 'low',
    data_points: 0
  };
}

/**
 * Update asset with calculated consumption values
 */
export async function updateAssetConsumption(
  assetId: string,
  consumption: ConsumptionResult
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ta_agbot_assets')
      .update({
        daily_consumption_liters: consumption.daily_consumption_litres,
        days_remaining: consumption.days_remaining,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId);

    if (error) {
      console.error('Failed to update asset consumption:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating asset consumption:', error);
    return false;
  }
}

/**
 * Calculate and update consumption for all active assets
 * Used by scheduled job to keep calculations fresh
 */
export async function recalculateAllAssets(): Promise<{
  processed: number;
  updated: number;
  failed: number;
}> {
  try {
    // Fetch all active assets with current levels and capacity
    const { data: assets, error } = await supabase
      .from('ta_agbot_assets')
      .select(
        `
        id,
        current_level_percent,
        capacity_liters,
        ta_agbot_locations!inner (
          is_disabled
        )
      `
      )
      .eq('ta_agbot_locations.is_disabled', false);

    if (error) {
      console.error('Failed to fetch assets for recalculation:', error);
      return { processed: 0, updated: 0, failed: 0 };
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (const asset of assets || []) {
      processed++;

      try {
        const consumption = await calculateConsumption(
          asset.id,
          asset.current_level_percent || 0,
          asset.capacity_liters
        );

        const success = await updateAssetConsumption(asset.id, consumption);

        if (success) {
          updated++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to recalculate asset ${asset.id}:`, error);
        failed++;
      }
    }

    console.log(
      `Consumption recalculation complete: ${updated} updated, ${failed} failed, ${processed} total`
    );

    return { processed, updated, failed };
  } catch (error) {
    console.error('Error in recalculateAllAssets:', error);
    return { processed: 0, updated: 0, failed: 0 };
  }
}
